---
date: 2026-02-23
topic: Conversational search to SQL filters and vector re-ranking
status: complete
tags: [NL2SQL, function-calling, structured-output, pgvector, conversational-search, vector-reranking, recommendation-engine, tool-use]
related: [2026-02-23-multi-modal-venue-recommendation-engine.md, 2026-02-18-wedding-venue-finder-stack.md]
---

# Translating LLM Conversations into SQL Filters and Vector Re-Ranking

## Context

Follow-up to the multi-modal venue recommendation engine research. The recommendation engine uses Pinterest board imports to generate multi-cluster taste profiles (CLIP embeddings), then ranks wedding venues by visual + text similarity. The next layer is a conversational interface where users refine results by talking naturally. The system must translate natural language into (1) structured SQL filters on a fixed schema, (2) vector query adjustments for aesthetic re-ranking, and (3) relative references ("more like #3"). Existing stack: TypeScript, PostgreSQL + pgvector + PostGIS, CLIP ViT-B/32, Ollama, nomic-embed-text.

## 1. Natural Language to SQL (NL2SQL): State of the Art

### Current Landscape (2024-2026)

NL2SQL has improved dramatically with LLMs, exceeding 80% accuracy on benchmarks like Spider. However, production deployment remains challenging due to schema complexity, ambiguity, and the gap between benchmarks and real-world queries.

**Key systems:**

**Vanna.ai** — Open-source RAG framework for NL2SQL. Two-step: (1) train a RAG "model" by feeding it your schema, DDL, documentation, and example queries; (2) user asks a question, Vanna retrieves relevant schema context via RAG, constructs a prompt, and the LLM generates SQL. Vanna 2.0 (late 2025) added user-aware filtering, row-level security, and evolved into a production agent framework.

**SQLCoder** — Fine-tuned Llama 3 models (8B parameter) from Defog, trained on 20,000+ human-curated question-SQL pairs across 10 database schemas. Open-source, runnable locally. Good for general NL2SQL but not specialized for domain-specific schemas.

**DIN-SQL** — Decomposed In-Context Learning approach (NeurIPS 2023). Four-module pipeline:
1. **Schema linking** — identify which tables/columns are relevant
2. **Query classification** — categorize as easy (single table), non-nested (joins), or nested (subqueries + set ops)
3. **SQL generation** — class-specific prompting (simple few-shot for easy, chain-of-thought for hard)
4. **Self-correction** — LLM reviews and fixes its own SQL

DIN-SQL improved accuracy by ~10% over naive few-shot, achieving 85.3% on Spider (was 79.9 SOTA). Key insight: **decomposition beats single-shot generation.**

### Is Full NL2SQL Overkill for This Use Case?

**Yes. Full NL2SQL is overkill for a fixed schema with ~10 filterable columns.**

The NL2SQL problem is hard because of:
- Unknown schemas (the model must discover table structures)
- Complex joins across many tables
- Arbitrary SQL (aggregations, subqueries, window functions)
- Open-ended natural language with ambiguous intent

None of these apply to the venue search use case. The schema is fixed and small. The queries are always "filter + rank venues." The filterable columns are known in advance. The SQL is always a WHERE clause with optional ORDER BY — no joins, no aggregations, no subqueries.

**The right approach: structured output / function calling.** Define a "search_venues" tool with typed parameters. The LLM extracts filter values from conversation. The application code constructs the SQL.

This is simpler, more reliable, more testable, and doesn't risk SQL injection.

### Sources
- [NL2SQL Handbook (HKU)](https://github.com/HKUSTDial/NL2SQL_Handbook)
- [State of Text2SQL 2024 (PremAI)](https://blog.premai.io/state-of-text2sql-2024/)
- [Vanna.ai](https://vanna.ai/) | [GitHub](https://github.com/vanna-ai/vanna)
- [DIN-SQL paper (arXiv)](https://arxiv.org/pdf/2304.11015)
- [NL2SQL System Design Guide 2025 (Medium)](https://medium.com/@adityamahakali/nl2sql-system-design-guide-2025-c517a00ae34d)

---

## 2. LLM Function Calling / Tool Use for Filter Generation

### Architecture Pattern

Function calling is the correct approach for this use case. The pattern:

1. **Define a tool schema** describing the search parameters
2. **Send conversation history + tool definitions** to the LLM
3. **LLM returns structured JSON** with extracted filter parameters
4. **Application code builds the SQL** WHERE clause from those parameters
5. **Execute query** and return results
6. **LLM receives results** and either presents them or requests more tool calls

The LLM never sees or generates SQL. It only extracts structured parameters. The application owns all query construction.

### Tool Definition for Venue Search

```typescript
const searchVenuesTool = {
  name: "search_venues",
  description: "Search for wedding venues with optional filters. Only include parameters the user has explicitly mentioned or that can be inferred from conversation context. Omit parameters the user hasn't specified.",
  parameters: {
    type: "object",
    properties: {
      // Structured filters (become SQL WHERE clauses)
      pricing_tier: {
        type: "string",
        enum: ["budget", "moderate", "premium", "luxury"],
        description: "Budget tier. Map: under $5K=budget, $5-15K=moderate, $15-30K=premium, $30K+=luxury"
      },
      max_price: {
        type: "number",
        description: "Maximum venue price in dollars"
      },
      min_capacity: {
        type: "integer",
        description: "Minimum guest capacity"
      },
      max_capacity: {
        type: "integer",
        description: "Maximum guest capacity"
      },
      has_lodging: {
        type: "boolean",
        description: "Whether the venue must have on-site lodging"
      },
      lodging_capacity: {
        type: "integer",
        description: "Minimum number of guests lodging can accommodate"
      },
      is_outdoor: {
        type: "boolean",
        description: "Whether venue must have outdoor ceremony/reception space"
      },
      is_estate: {
        type: "boolean",
        description: "Whether venue is a private estate"
      },
      is_historic: {
        type: "boolean",
        description: "Whether venue is a historic property"
      },
      location_lat: { type: "number" },
      location_lng: { type: "number" },
      location_radius_miles: {
        type: "number",
        description: "Search radius from location in miles"
      },
      location_name: {
        type: "string",
        description: "Human-readable location name for geocoding (e.g., 'Austin, TX')"
      },

      // Aesthetic/vibe modifiers (become vector adjustments)
      aesthetic_query: {
        type: "string",
        description: "Natural language description of desired aesthetic/vibe (e.g., 'rustic but elegant', 'modern minimalist'). Used for vector re-ranking."
      },
      boost_cluster_index: {
        type: "integer",
        description: "Index of the taste cluster to boost (0-indexed). Used when user says 'show me more like my rustic pins.'"
      },
      similar_to_venue_id: {
        type: "string",
        description: "ID of a venue to find similar results to ('more like this one')"
      },
      similar_to_result_index: {
        type: "integer",
        description: "1-indexed position in current results ('more like the third one')"
      }
    },
    required: [] // No required fields — everything is optional
  }
};
```

### How It Works with Anthropic Claude

Claude's tool use works as follows:
1. You define tools with JSON Schema parameters
2. Claude analyzes the conversation and decides whether to call a tool
3. If calling a tool, Claude returns a `tool_use` content block with the tool name and extracted arguments
4. You execute the tool (build SQL, run query), return results as a `tool_result` message
5. Claude generates a natural language response incorporating the results

Claude supports **strict mode** (`strict: true`) as of late 2025, which compiles the JSON schema into a grammar and constrains token generation during inference — guaranteeing 100% schema compliance. No parsing errors, no retries needed.

### How It Works with Ollama (Local LLMs)

Ollama added function calling support in version 0.4 (2024). Works with Llama 3.1, Llama 3.2, Mistral, Qwen 2.5. Also supports structured output via JSON schema since February 2025.

**Key limitation:** Ollama does not yet support streaming tool calls or the `tool_choice` parameter (as of early 2026). You cannot force a specific tool to be called or receive tool call responses in streaming mode. This means:
- Use non-streaming for filter extraction (generate the tool call synchronously)
- Use streaming for the natural language response after results are retrieved

**Quality tradeoff:** Local 8B models (Llama 3.1-8B) will be less reliable at complex filter extraction than Claude or GPT-4. For a fixed schema with ~10 parameters, accuracy should be acceptable. Test with eval sets to verify.

### Multi-Turn Conversation: Accumulating Filters

The key design decision is **how to track filter state across turns.** Two approaches:

**Approach A: Full State in Each Turn (Recommended)**

Pass the complete current filter state to the LLM with each message. The LLM returns the COMPLETE new filter state — not just changes.

```
System prompt: "The user is searching for wedding venues. Current active filters:
{pricing_tier: 'moderate', is_outdoor: true, location: 'Austin, TX', radius: 50mi}

When the user modifies their search, call search_venues with the COMPLETE updated filter set.
If they say 'actually, budget doesn't matter', remove the pricing_tier filter.
If they say 'also needs lodging', add has_lodging: true while keeping existing filters."
```

**Why full state:** The LLM sees all active filters explicitly. No need to reason about diffs or history. Reduces hallucination risk. Makes "undo" straightforward — the LLM just omits the filter.

**Approach B: Diff-Based (More Complex, Not Recommended)**

LLM returns only filter changes (add/remove/modify). Application merges diffs into state. Requires more complex prompting, more error-prone, harder to debug.

### Handling "Undo" and "Relax" Requests

| User Says | LLM Behavior |
|-----------|-------------|
| "Actually, budget doesn't matter" | Omit `pricing_tier` and `max_price` from tool call |
| "Forget the location requirement" | Omit `location_*` fields |
| "Show me everything again" | Call tool with all filters removed (empty params) |
| "Go back to what I had before outdoor" | Requires conversation history — LLM reads back to find the pre-outdoor state |
| "Relax the capacity requirement" | Increase `min_capacity` threshold or remove it |

The full-state approach handles most of these naturally. For "go back to what I had before X," the conversation history provides context. For complex undo, consider maintaining a **filter state stack** on the application side — push state on each search, pop on "go back."

### Sources
- [Function calling using LLMs (Martin Fowler)](https://martinfowler.com/articles/function-call-LLM.html)
- [Prompt Engineering Guide: Function Calling](https://www.promptingguide.ai/applications/function_calling)
- [OpenAI Function Calling docs](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Ollama Tool Calling docs](https://docs.ollama.com/capabilities/tool-calling)
- [Ollama Structured Outputs blog](https://ollama.com/blog/structured-outputs)
- [The guide to structured outputs and function calling (Agenta)](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Vercel AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)

---

## 3. Vector Query Modification from Conversation

### Strategy Overview

Conversational statements about aesthetics/vibe need to modify the vector search, not the SQL filters. Three mechanisms:

1. **Text-to-vector query injection** — embed the user's aesthetic description and blend it into the query
2. **Cluster weight adjustment** — change the importance of existing taste clusters
3. **"More like this" via venue embedding** — use a specific venue's embedding as a query vector

### Mechanism 1: Text-to-Vector Query Injection

When a user says "I want something more rustic" or "romantic garden vibes":

1. Embed the aesthetic description using nomic-embed-text → 768d vector
2. Use this as an additional query vector alongside the taste cluster embeddings
3. Add it as a high-weight "cluster" in the MaxSim scoring

**Critical discovery: Nomic Embed Vision shares the same latent space as nomic-embed-text.**

Nomic Embed Vision v1.5 is aligned to the same latent space as nomic-embed-text-v1.5. This means you can embed text with nomic-embed-text and query it against image embeddings created by nomic-embed-vision. This is a game-changer for this use case:

- Currently using CLIP ViT-B/32 (512d) for venue photo embeddings
- nomic-embed-text (768d) for text embeddings
- These are different spaces — cannot cross-query

**Potential migration path:** If venue photo embeddings were re-generated with nomic-embed-vision-v1.5 (768d), then:
- Text aesthetic queries ("rustic but elegant") embedded with nomic-embed-text-v1.5 could directly query against venue photo embeddings
- No need for separate image and text scoring — unified latent space
- Pinterest pin embeddings would also need re-embedding with nomic-embed-vision-v1.5
- nomic-embed-vision-v1.5 is not yet officially in Ollama, but a community build exists (DC1LEX/nomic-embed-text-v1.5-multimodal)

**For now (with CLIP + nomic):** Keep separate spaces. Embed aesthetic queries with nomic-embed-text, compare against venue text embeddings (also nomic). Combine at score level with visual scores:

```
final_score = w_visual * visual_cluster_score + w_text * text_score + w_aesthetic * aesthetic_text_score
```

Start with: w_visual=0.5, w_text=0.2, w_aesthetic=0.3 (when aesthetic query is present).

### Mechanism 2: Cluster Weight Adjustment

When a user says "I care more about the outdoor photos" or "less rustic":

- The taste profile has 2-5 clusters with weights (normalized by pin count)
- "More of cluster X" → increase that cluster's weight in the weighted MaxSim scoring
- "Less of cluster X" → decrease its weight (but don't zero it)

**Implementation:** The `boost_cluster_index` parameter in the tool definition. When the LLM extracts this, the application adjusts the cluster weight vector:

```typescript
// Original weights: [0.4, 0.35, 0.25] for 3 clusters
// User says "more like my outdoor pins" (cluster 0)
// Boosted weights: [0.6, 0.25, 0.15] — boost target by 50%, proportionally reduce others
function boostCluster(weights: number[], index: number, boostFactor = 1.5): number[] {
  const boosted = [...weights];
  boosted[index] *= boostFactor;
  const sum = boosted.reduce((a, b) => a + b, 0);
  return boosted.map(w => w / sum); // Re-normalize
}
```

**Challenge:** The LLM needs to know what each cluster "means" to map user language to cluster indices. Solution: when presenting the taste profile to the user, label clusters (e.g., "Cluster 1: Rustic/Barn, Cluster 2: Modern/Minimalist, Cluster 3: Garden/Outdoor"). Include these labels in the system prompt so the LLM can map "more rustic" → boost cluster 1.

### Mechanism 3: "More Like This" via Venue Embedding

When a user says "more like the third one" or "similar to Vintage Villas":

1. Look up the referenced venue's photo embeddings
2. Use the venue's best-matching photo (or centroid) as a new query vector
3. Either replace or blend with the existing taste cluster queries

**Implementation:**
- `similar_to_result_index` → map to venue_id from current displayed results
- `similar_to_venue_id` → direct lookup
- Fetch the venue's photo centroid or top-3 photos
- Add as a high-weight query vector to the CROSS JOIN LATERAL pattern

```sql
-- "More like venue X": use its photos as query vectors
WITH reference_photos AS (
  SELECT embedding FROM venue_photos WHERE venue_id = $reference_venue_id
),
candidate_scores AS (
  SELECT
    vp.venue_id,
    MAX(1 - (vp.embedding <=> rp.embedding)) as similarity
  FROM venue_photos vp
  CROSS JOIN reference_photos rp
  WHERE vp.venue_id != $reference_venue_id
  GROUP BY vp.venue_id
)
SELECT * FROM candidate_scores ORDER BY similarity DESC LIMIT 20;
```

### Embedding Arithmetic for Direction Adjustment

The classic word2vec "king - man + woman = queen" principle applies in embedding space generally. For recommendations:

- "More rustic" = current_query + direction_of("rustic")
- "Less modern, more classic" = current_query - direction_of("modern") + direction_of("classic")

However, this works best in a **unified embedding space.** With the current split setup (CLIP for images, nomic for text), arithmetic is only meaningful within each space:
- Text direction arithmetic with nomic embeddings: embed("rustic venue") - embed("modern venue") = rustic direction vector. Add to text query.
- Image direction arithmetic is harder — would need reference images representing "rustic" and "modern" to compute directions in CLIP space.

**Practical recommendation:** For v1, use text-based aesthetic queries (Mechanism 1) rather than embedding arithmetic. Arithmetic is powerful but harder to debug and explain. Text queries are more interpretable and the LLM can always reformulate.

### Sources
- [Nomic Embed Vision (arXiv)](https://arxiv.org/html/2406.18587v1)
- [Nomic Embed Vision blog](https://www.nomic.ai/blog/posts/nomic-embed-vision)
- [Nomic Embed Ecosystem](https://www.nomic.ai/blog/posts/embed-ecosystem)
- [DC1LEX/nomic-embed-text-v1.5-multimodal (Ollama community)](https://ollama.com/DC1LEX/nomic-embed-text-v1.5-multimodal)
- [Word Embedding Analogies (Carnegie Mellon)](https://www.cs.cmu.edu/~dst/WordEmbeddingDemo/tutorial.html)
- [Embedding in Recommender Systems Survey (arXiv)](https://arxiv.org/html/2310.18608v2)

---

## 4. Conversational Search Systems and State Management

### How Production Systems Handle This

**Perplexity AI** — Multi-stage pipeline:
1. Query understanding: LLM semantically interprets the user's question
2. Hybrid retrieval: both lexical (keyword) and dense (vector) retrieval
3. Contextual reranking: progressively more sophisticated models (lexical scorer → embedding scorer → cross-encoder reranker)
4. LLM synthesis: grounded generation with citations
5. Multi-turn: maintains conversation context; follow-up questions trigger new retrieval while considering established context

**Bing Chat / Copilot** — Five-stage flow:
1. Query understanding (intent + entity extraction)
2. Hybrid retrieval
3. Contextual reranking
4. LLM grounding and synthesis
5. Presentation with citations and actions

**Key insight for venue search:** These systems all treat each turn as a potential new retrieval event. They don't just re-rank existing results — they re-query with refined understanding. This is the right model for venue search: each conversational refinement triggers a new database query with updated filters + vector adjustments.

### Airbnb (February 2026)

Airbnb just launched (early testing) a conversational search where users describe what they want in natural language (e.g., "a quiet cabin near hiking with a fast kitchen"). Key details:
- Rebuilt around an LLM for conversational discovery
- Results remain photo-forward and visual
- Supports follow-up questions about specific listings
- New CTO Ahmad Al-Dahle (ex-Meta Llama) driving AI strategy
- Traffic from AI chatbot referrals converts better than Google referrals
- Approach: rapid iteration, not big launches — testing with small percentage of traffic

### Zillow (2023-2025)

Zillow's natural language search progression:
- **January 2023:** First major real estate platform with NL search — "homes with a pool near good schools"
- **September 2024:** Enhanced with commute time, affordability, school district, and POI search
- **October 2025:** Integrated directly into ChatGPT — users can search Zillow from ChatGPT conversations

Architecture (inferred from public details): NLP extracts structured filters from natural language → maps to Zillow's existing structured filter system → returns listings. The AI scans millions of listing details to match against user-defined criteria. Handles typos, shorthand, and misspelled words.

### State Management Patterns

**Slot Filling (Recommended for Venue Search)**

Borrowed from dialogue systems (Rasa, Dialogflow). The "slot" model:
- Define slots for each filter parameter (pricing_tier, location, capacity, etc.)
- Each conversation turn can fill, modify, or clear slots
- Current slot state = current filter state
- LLM's job: given conversation history + current slots, output updated slots

This is exactly what the tool-calling approach in Section 2 implements — the tool parameters ARE the slots.

**Finite State Machine**

For more complex flows (e.g., onboarding wizard → free search → booking). Each state has allowed transitions and context. Overkill for simple filter refinement but useful if the conversation has distinct phases.

**Message History as Implicit State**

Pass the full conversation history to the LLM each turn. The LLM reconstructs filter state from history. Simple but:
- Context window grows with each turn
- More expensive per call
- LLM may be inconsistent about what filters are "active"
- Not recommended as sole state mechanism

**Recommended hybrid:** Maintain explicit filter state (slot filling) on the application side. Pass current state + recent conversation history to the LLM. The LLM produces updated state via tool calls. Application validates and applies.

### When to Re-Query vs. Re-Rank

| Scenario | Action |
|----------|--------|
| User adds/changes a SQL filter (price, location, capacity) | **Re-query** — filters change the candidate set |
| User adjusts aesthetic direction ("more rustic") | **Re-rank** existing results if set is large enough; otherwise re-query with adjusted vectors |
| "More like the third one" | **Re-query** with new vector query (the reference venue's embedding) |
| "Sort by distance" or "sort by price" | **Re-rank** — data already fetched, just re-sort |
| User completely changes search ("actually, show me Austin instead of Dallas") | **Re-query** — different candidate set |
| "Show me the next page" | **Re-rank** / paginate existing results if cached; otherwise re-query with OFFSET |

**Practical rule:** If the WHERE clause changes, re-query. If only scoring weights change, re-rank from cached results (if available). If the vector query changes significantly ("more like X"), re-query.

### Sources
- [Behind Perplexity's Architecture (FrugalTesting)](https://www.frugaltesting.com/blog/behind-perplexitys-architecture-how-ai-search-handles-real-time-web-data)
- [AI Search Architecture Deep Dive (iPullRank)](https://ipullrank.com/ai-search-manual/search-architecture)
- [How Perplexity Built an AI Google (ByteByteGo)](https://blog.bytebytego.com/p/how-perplexity-built-an-ai-google)
- [Airbnb AI Strategy 2026 (RentalScaleUp)](https://www.rentalscaleup.com/airbnbs-ai-strategy-2026/)
- [Airbnb Tests AI Search (gHacks)](https://www.ghacks.net/2026/02/16/airbnb-tests-ai-powered-natural-language-search-for-rental-bookings/)
- [Airbnb TechCrunch Feb 2026](https://techcrunch.com/2026/02/13/airbnb-plans-to-bake-in-ai-features-for-search-discovery-and-support/)
- [Zillow NL Search Sept 2024](https://investors.zillowgroup.com/investors/news-and-events/news/news-details/2024/Zillows-AI-powered-home-search-gets-smarter-with-new-natural-language-features/default.aspx)
- [Zillow + ChatGPT Oct 2025](https://jennifervaughan.com/blog/why-zillows-new-chatgpt-integration-changes-the-game-for-real-estate-agents-and-sellers)
- [Query Transformations (LangChain blog)](https://blog.langchain.com/query-transformations/)
- [Conversational Search with RAG (OpenSearch)](https://docs.opensearch.org/latest/vector-search/ai-search/conversational-search/)

---

## 5. Hybrid Approach: Combining SQL Filters with Vector Similarity

### The Filtering Problem in Vector Search

Unlike traditional databases where adding a WHERE clause speeds things up (smaller scan), adding filters to vector search often **slows it down or reduces accuracy.** The core issue: HNSW indexes traverse a graph of nearest neighbors. If post-filtering removes most candidates, you get too few results (the "empty results" problem).

### Three Filtering Strategies

**Post-Filtering (Traditional pgvector pre-0.8):**
1. HNSW scans graph → returns top-K by distance
2. WHERE clause removes non-matching results
3. Problem: if filter matches 10% of data and K=40, only ~4 results survive on average

**Pre-Filtering (e.g., Weaviate ACORN, Qdrant):**
1. Apply structured filters first → get candidate set
2. Vector search only within candidates
3. Better results but requires specialized index support
4. pgvector does NOT natively support pre-filtering on HNSW

**Iterative Scan (pgvector 0.8.0 — October 2024):**
1. HNSW scans and applies filters simultaneously
2. If not enough results pass filters, automatically continues scanning deeper
3. Repeats until LIMIT satisfied or max_scan_tuples reached
4. **This solves the filtered vector search problem for pgvector**

### pgvector 0.8.0 Iterative Scan Details

**Configuration:**
```sql
-- Enable iterative scanning (per-session or per-query)
SET hnsw.iterative_scan = relaxed_order;  -- or strict_order, or off

-- Max tuples to visit during iterative scan (default: 20000)
SET hnsw.max_scan_tuples = 20000;

-- Memory multiplier for recall improvement (default: 1)
SET hnsw.scan_mem_multiplier = 1;
```

**Two modes:**
- `strict_order` — maintains exact distance ordering. Iteratively expands search until LIMIT results found or max_scan_tuples reached. Correct ordering but may be slower.
- `relaxed_order` — allows approximate ordering for better performance. Uses a discarded-candidates heap for improved recall. 95-99% result quality vs strict. **Recommended for production.**

**Performance:** Up to 5.7x improvement over pgvector 0.7.x for filtered queries. Dramatically better than the old approach of over-fetching and post-filtering.

### Recommended Query Architecture for Venue Search

**Phase 1: SQL pre-filter via CTE, then vector rank within filtered set**

```sql
-- Step 1: Apply all structured filters
WITH filtered_venues AS (
  SELECT v.id as venue_id
  FROM venues v
  WHERE 1=1
    AND ($1::text IS NULL OR v.pricing_tier = $1)
    AND ($2::integer IS NULL OR v.capacity >= $2)
    AND ($3::boolean IS NULL OR v.has_lodging = $3)
    AND ($4::integer IS NULL OR v.lodging_capacity >= $4)
    AND ($5::boolean IS NULL OR v.is_outdoor = $5)
    AND ($6::boolean IS NULL OR v.is_estate = $6)
    AND ($7::boolean IS NULL OR v.is_historic = $7)
    -- PostGIS: location within radius
    AND (
      $8::float IS NULL OR $9::float IS NULL OR $10::float IS NULL
      OR ST_DWithin(
        v.location::geography,
        ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography,
        $10 * 1609.34  -- miles to meters
      )
    )
),
-- Step 2: Vector rank filtered venues
photo_scores AS (
  SELECT
    vp.venue_id,
    MAX(1 - (vp.embedding <=> $11::vector)) as best_photo_sim
  FROM venue_photos vp
  WHERE vp.venue_id IN (SELECT venue_id FROM filtered_venues)
  GROUP BY vp.venue_id
  ORDER BY best_photo_sim DESC
  LIMIT 50
)
SELECT v.*, ps.best_photo_sim
FROM venues v
JOIN photo_scores ps ON v.id = ps.venue_id
ORDER BY ps.best_photo_sim DESC
LIMIT 20;
```

This pattern does **application-level pre-filtering** (SQL WHERE in CTE) then **vector ranking on the filtered set.** It avoids the HNSW filtered scan problem entirely for small result sets because the vector comparison in the photo_scores CTE operates only on photos belonging to filtered venues.

**Phase 2: Use iterative scan for larger datasets**

When the venue count grows and the filtered set is large (1000+ venues after filtering), switch to:

```sql
SET hnsw.iterative_scan = relaxed_order;

SELECT
  vp.venue_id,
  1 - (vp.embedding <=> $1::vector) as similarity
FROM venue_photos vp
JOIN venues v ON vp.venue_id = v.id
WHERE v.pricing_tier = $2
  AND v.is_outdoor = true
  AND ST_DWithin(v.location::geography, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5)
ORDER BY vp.embedding <=> $1::vector
LIMIT 100;
```

With iterative scan enabled, pgvector will automatically continue exploring the HNSW graph when results are filtered out, until LIMIT is satisfied.

### PostGIS + pgvector + SQL Filters: Index Strategy

**Required indexes:**
```sql
-- Vector similarity (HNSW)
CREATE INDEX idx_venue_photos_embedding ON venue_photos
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Spatial (GiST for PostGIS)
CREATE INDEX idx_venues_location ON venues
  USING gist (location);

-- Structured filters (B-tree)
CREATE INDEX idx_venues_pricing ON venues (pricing_tier);
CREATE INDEX idx_venues_capacity ON venues (capacity);
CREATE INDEX idx_venues_features ON venues (is_outdoor, has_lodging, is_estate, is_historic);
```

**Performance characteristics:**
- At 300 venues / ~4,500 photo vectors: No HNSW index needed. Sequential scan + CTE pre-filter is fast enough.
- At 1,000+ venues: HNSW index becomes worthwhile.
- PostGIS `ST_DWithin` on a GiST index is very fast (sub-millisecond for reasonable radius queries).
- Combined queries (PostGIS distance + vector similarity + SQL filters) execute as: GiST index scan for spatial → B-tree for structured → vector scan on filtered set. The CTE approach ensures PostgreSQL can optimize each step independently.

### Combined Score: Filters + Vectors + Location

For the full scoring formula incorporating all signals:

```
final_score = w_visual * visual_score
            + w_text * text_score
            + w_aesthetic * aesthetic_score (if aesthetic query present)
            + w_distance * distance_score (if location specified)
```

Where:
- `visual_score` = weighted MaxSim across taste clusters vs venue photos
- `text_score` = cosine similarity of venue text embedding vs user preference summary
- `aesthetic_score` = cosine similarity of aesthetic query embedding vs venue text embedding
- `distance_score` = 1 - (distance / max_radius), normalized to 0-1

Weights should be tunable and context-dependent. When user specifies location, boost w_distance. When user describes aesthetics, boost w_aesthetic. Default: w_visual=0.5, w_text=0.15, w_aesthetic=0.2, w_distance=0.15.

### Sources
- [pgvector 0.8.0 Release](https://www.postgresql.org/about/news/pgvector-080-released-2952/)
- [pgvector 0.8.0 on Aurora (AWS)](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/)
- [pgvector 0.8.0 on Nile](https://www.thenile.dev/blog/pgvector-080)
- [Pre-filtering vs Post-filtering (APXML)](https://apxml.com/courses/advanced-vector-search-llms/chapter-2-optimizing-vector-search-performance/advanced-filtering-strategies)
- [Achilles Heel of Vector Search: Filters](https://yudhiesh.github.io/2025/05/09/the-achilles-heel-of-vector-search-filters/)
- [pgvector with PostGIS (GitHub)](https://github.com/scitus-ca/pgvector_with_postgis)
- [Hybrid Search in PostgreSQL (ParadeDB)](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)
- [pgvector HNSW Configuration (DeepWiki)](https://deepwiki.com/pgvector/pgvector/5.1.4-hnsw-configuration-parameters)
- [Optimizing Filtered Vector Queries (Clarvo)](https://www.clarvo.ai/blog/optimizing-filtered-vector-queries-from-tens-of-seconds-to-single-digit-milliseconds-in-postgresql)
- [VectorChord 0.4 Prefiltering](https://blog.vectorchord.ai/vectorchord-04-faster-postgresql-vector-search-with-advanced-io-and-prefiltering)

---

## 6. Production Examples and Implementation Patterns

### Airbnb (Conversational Search, Feb 2026)

- Testing conversational search for "quiet cabin near hiking" style queries
- Users describe property type + amenities in natural language instead of selecting filters
- Supports follow-up questions about specific listings
- Photo-forward results (aesthetic still primary)
- LLM interprets natural language → maps to structured listing attributes
- AI chatbot referral traffic converts better than Google referral traffic
- Gradual rollout, rapid iteration approach

**Relevance to venue search:** Nearly identical use case. Airbnb's approach validates the "LLM extracts filters + aesthetic understanding" pattern. Key difference: Airbnb has millions of listings, massive training data, and a custom LLM stack. A wedding venue app can achieve similar UX with function calling on a fixed schema.

### Zillow (Natural Language Property Search, 2023-2025)

- Progressive NL expansion: basic text search → commute time → affordability → school districts → ChatGPT integration
- NLP extracts structured filters from natural language queries
- Handles typos, shorthand, misspelled words
- Maps to Zillow's existing filter system (price, bedrooms, features, location)
- ChatGPT integration: users refine via follow-up prompts ("Show only those with a pool", "Under $1.2M near coffee shops")

**Relevance:** Validates the approach of mapping NL to a fixed filter set. Zillow's schema is similar in complexity to the venue schema (~15-20 filterable attributes). They did NOT build full NL2SQL — they extract structured filters.

### Realtor.com and Homes.com (October 2025)

Both portals launched AI-powered search tools following Zillow's lead. The industry is converging on the same pattern: NL input → structured filter extraction → existing search infrastructure.

### The Knot "Make it Yours" (September 2025)

Wedding-specific. AI scans 1M+ images and recommends vendors based on saved favorites + location. Reduced venue search from 3.5 hours/week over 6 weeks to minutes.

**Relevance:** Closest direct competitor. Image-based matching for wedding venues is validated at scale. However, The Knot's approach appears to be browse + save → recommend, not conversational refinement.

### Wedding Venue AI Chatbots (2025)

Several products exist but serve a different purpose:
- **VenueAI / VenueBot** — Sales assistant chatbots that answer venue-specific questions (availability, pricing, tours). Lead qualification, not discovery.
- **AgentiveAIQ** — No-code chatbot with RAG + knowledge graph for venue Q&A

None of these are conversational search/recommendation engines. The discovery use case (helping couples find the right venue through conversation) appears to be an open opportunity.

### Vercel AI SDK Patterns for Implementation

**AI SDK 6 (latest):**
- Unified `generateText` with `output` property replaces deprecated `generateObject`
- Multi-step tool calling loops with structured output at the end
- `stopWhen` + `stepCountIs` for controlling agent loop depth
- `maxToolRoundtrips` for limiting tool call cycles
- `response.messages` for maintaining conversation history
- Agent class manages loops, message arrays, and stopping conditions

**Implementation pattern for search:**
```
1. User sends message via useChat (React hook)
2. Server receives message + conversation history
3. streamText with tools: { search_venues: { ... } }
4. LLM decides to call search_venues with extracted filters
5. Tool execution: build SQL from params, query DB, return results
6. LLM receives results, generates natural language response
7. Stream response back to client
8. Client renders results + response
```

**Key AI SDK features for this use case:**
- `streamText` with tool calling: LLM can call search_venues mid-response
- `onToolCall`: server-side handler for executing the search
- `useChat` with `onToolCall`: client-side handling for search execution
- `maxToolRoundtrips: 2`: allow the LLM to refine its search if first results aren't good
- Tool results can include structured data (venue cards) rendered by the client

### Sources
- [Airbnb AI Strategy (TechCrunch)](https://techcrunch.com/2026/02/13/airbnb-plans-to-bake-in-ai-features-for-search-discovery-and-support/)
- [Zillow NL Search](https://investors.zillowgroup.com/investors/news-and-events/news/news-details/2024/Zillows-AI-powered-home-search-gets-smarter-with-new-natural-language-features/default.aspx)
- [2 More Portals Embrace AI Search](https://www.realestatenews.com/2025/10/14/2-more-portals-embrace-ai-powered-home-search-tools)
- [The Knot AI Tool](https://www.digitalcommerce360.com/2025/09/29/the-knot-adds-ai-tool-to-its-online-wedding-planner/)
- [AI SDK 6 (Vercel)](https://vercel.com/blog/ai-sdk-6)
- [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Building AI Agents with Vercel](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [AI SDK Agents](https://sdk.vercel.ai/docs/foundations/agents)

---

## Recommended Architecture

### End-to-End Flow

```
User Message
    ↓
[Conversation History + Current Filter State]
    ↓
LLM (Ollama/Claude via Vercel AI SDK)
  ├── Decides: tool call or direct response
  ├── If tool call: extracts search_venues params
  │     ├── Structured filters → SQL WHERE builder
  │     ├── aesthetic_query → nomic-embed-text → vector score
  │     ├── similar_to_venue_id → venue embedding lookup → vector query
  │     └── boost_cluster_index → cluster weight adjustment
  │           ↓
  │     [SQL CTE: filter → vector rank → combine scores]
  │           ↓
  │     Query Results (venue cards with scores)
  │           ↓
  │     Tool Result → back to LLM
  │           ↓
  └── Natural language response with venue recommendations
          ↓
      [Update Filter State on App Side]
          ↓
      Stream to Client (text + structured venue data)
```

### Key Design Decisions

1. **Function calling over NL2SQL** — Fixed schema, typed parameters, application builds SQL. Safer, more testable, no injection risk.

2. **Full filter state per turn** — LLM receives current state, outputs complete new state. No diffs, no history reconstruction.

3. **CTE pre-filter then vector rank** — SQL WHERE in first CTE, vector scoring on filtered set in second CTE. Avoids HNSW filtered scan issues at small scale. Switch to iterative scan at 1000+ venues.

4. **Separate vector spaces for now** — CLIP for images, nomic for text. Combine at score level. Migration path to unified nomic space when nomic-embed-vision-v1.5 is stable in Ollama.

5. **Re-query on filter changes, re-rank on weight changes** — Filter mutations always hit the database. Aesthetic adjustments can re-rank cached results if the candidate set is unchanged.

6. **Vercel AI SDK streamText with tools** — Handles the full loop: user message → tool call → query execution → LLM response → streaming to client.

7. **Filter state stack for undo** — Push filter state on each search. "Go back" = pop stack. Simple, deterministic, doesn't depend on LLM reasoning about history.

## Open Questions

1. **Ollama tool calling quality:** How reliably does Llama 3.1-8B extract correct filter parameters from natural language? Needs eval set with example queries and expected extractions. If quality is too low, may need Claude API for the conversational layer even if Ollama handles embedding.

2. **nomic-embed-vision-v1.5 readiness:** The unified latent space is compelling but not yet in official Ollama. Track the GitHub issue (#7159) and the community build. If it stabilizes, re-embedding venues with nomic-embed-vision would simplify the architecture significantly (single space for text queries + image matching).

3. **Cluster labeling:** How to generate human-readable labels for taste clusters so the LLM can map "more rustic" to the right cluster index? Options: (a) LLM describes the medoid image, (b) find nearest text labels in CLIP space, (c) user labels during onboarding.

4. **Geocoding "2 hours from Austin":** The tool definition includes `location_name` for geocoding. Need a geocoding service (Mapbox, Google Maps, Nominatim) to convert to lat/lng. Also need to convert "2 hours" to a radius — ~120 miles assuming highway driving. The LLM could do this conversion or the application could use a routing API.

5. **Result caching and session management:** How long to cache query results for re-ranking? Per-session in memory? Redis? If the user adjusts only aesthetic weights, re-ranking cached results avoids a DB round trip. But stale caches become a problem with concurrent sessions modifying venue data.

6. **When to show the filter state:** Should the UI display the current active filters as tags/pills alongside the conversation? This provides transparency ("you're filtering for: outdoor, under $15K, Austin area") and lets users click to remove filters. Most production search UIs do this.

## Extracted Principles

- **Function calling over NL2SQL for fixed schemas**: When you have a known, bounded set of filterable columns, use structured output / tool calling to extract typed parameters. The LLM never generates SQL. The application owns query construction. This is simpler, safer, and more testable than full NL2SQL.
- **Full state per turn, not diffs**: In multi-turn filter refinement, pass the complete current filter state to the LLM and have it return the complete new state. No diff merging, no history reconstruction, no accumulated errors. "Undo" is just the LLM omitting a filter.
- **CTE pre-filter then vector rank**: Use SQL CTEs to first reduce the candidate set with structured WHERE clauses, then vector-rank only the filtered results. This avoids the fundamental tension between structured filters and HNSW graph traversal at small-medium scale.
- **pgvector 0.8 iterative scan solves filtered vector search**: At scale, enable `hnsw.iterative_scan = relaxed_order` instead of the CTE approach. pgvector automatically re-scans the HNSW graph when results are filtered out, up to 5.7x faster than pre-0.8 approaches.
- **Unified embedding spaces are the future**: Nomic Embed Vision v1.5 shares the same latent space as nomic-embed-text-v1.5, enabling direct cross-modal queries (text query → image results). This eliminates the need for separate image/text scoring pipelines. Worth migrating to when stable.
- **Re-query on filter changes, re-rank on weight changes**: SQL filter mutations always need a fresh database query. Aesthetic weight adjustments can re-rank cached results if the candidate set hasn't changed.

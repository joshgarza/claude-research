---
date: 2026-02-23
topic: Multi-modal venue recommendation engine
status: complete
tags: [recommendation-system, embeddings, pgvector, CLIP, multi-modal, vector-search, wedding-venues]
related: [2026-02-18-wedding-venue-finder-stack.md]
---

# Multi-Modal Venue Recommendation Engine

## Context

Research into best practices for building a recommendation engine that matches wedding venues (represented by 10-20 photos + full website text) against user taste profiles (Pinterest board images). Core challenges: representing venues in vector space, modeling diverse user taste (not just averaging), matching strategy, text embedding for long descriptions, and pgvector-specific implementation concerns. Starting at ~300 venues, scaling to 10,000+.

## 1. Venue Representation in Vector Space

### Simple Centroid (Mean of All Embeddings)

**How it works:** Average all image embeddings for a venue into a single vector.

**Pros:**
- Trivial to compute and store — one vector per venue
- Fast queries (single distance calculation per venue)
- Works well when venue images are stylistically coherent (same venue, same aesthetic)
- pgvector's built-in `AVG()` aggregate function computes this directly: `SELECT venue_id, AVG(embedding) FROM venue_images GROUP BY venue_id`

**Cons:**
- Loses information about the RANGE of visual content (e.g., a venue with both rustic barn interiors and elegant garden exteriors gets averaged into a meaningless middle)
- Outlier images (one bad photo, one detail shot) can skew the centroid
- Cannot represent multiple distinct visual "themes" within a venue
- The "topic drift" problem — the centroid may not correspond to any real image the venue has

**When it works:** Venues with visually consistent imagery. Good enough for an MVP with 300 venues.

**Source:** [Ref2Vec Centroid approach at Weaviate](https://weaviate.io/blog/ref2vec-centroid) documents the centroid pattern extensively. Pinterest's PinnerSage paper explicitly moved AWAY from centroids because "a single embedding is not sufficient for encoding multiple facets."

### Weighted Combinations of Image + Text

**Approach:** Create separate image and text embeddings, then combine with a tunable weight.

Stitch Fix uses exactly this pattern. Their scoring formula:

```
s_i = alpha * (1 - d_image) + (1 - alpha) * a_text
```

Where `alpha` balances image relevance against textual affinity. This is the simplest form of late fusion.

**Practical implementation:**
- Store image embedding and text embedding as separate columns
- At query time, compute similarity against each, then combine: `score = w_image * image_sim + w_text * text_sim`
- Start with equal weights (0.5/0.5), tune based on user feedback
- Can also use Reciprocal Rank Fusion (RRF) if you want rank-based combination rather than score-based

**Source:** [Stitch Fix: Stitching Together Spaces](https://multithreaded.stitchfix.com/blog/2021/08/13/stitching-together-spaces-for-query-based-recommendations/)

### Multi-Vector Representation (Store Each Photo Separately)

**How it works:** Each venue photo gets its own row in the embeddings table. Queries return the best-matching photo per venue, and the venue score is derived from its best (or top-N) photo matches.

**Pros:**
- No information loss — preserves the full visual diversity of the venue
- Enables "this photo matched your taste" explainability
- More accurate for venues with diverse imagery
- Naturally handles venues with different numbers of photos

**Cons:**
- More storage: 300 venues x 15 photos = 4,500 vectors (manageable); 10,000 venues x 15 photos = 150,000 vectors (still very manageable for pgvector)
- Queries are more complex — need aggregation per venue
- Index performance: HNSW index over 150K vectors is well within pgvector's comfort zone

**This is the recommended approach.** The storage cost is trivial, the information preservation is significant, and pgvector handles this scale easily.

### Pinterest's ItemSage: The Gold Standard for Multi-Modal Item Embeddings

Pinterest's ItemSage (KDD 2022) is the most directly relevant production system. It creates a SINGLE embedding per product that fuses multiple images + text features using a **transformer-based architecture**:

- A product has a list of images (different angles/contexts) and text features
- The transformer aggregates information from both modalities into a unified embedding
- Trained with multi-task learning (optimized for multiple engagement types)
- Production results: +7% GMV/user, +11% click volume

**Why this matters for venues:** ItemSage proves that multi-modal fusion into a single embedding works at scale. However, it requires training a custom model. For a startup, the multi-vector approach (store separately, aggregate at query time) gives you 80% of the benefit with 0% of the training cost.

**Source:** [ItemSage paper (Stanford/Pinterest)](https://cs.stanford.edu/people/jure/pubs/itemsage-kdd22.pdf), [arXiv](https://arxiv.org/abs/2205.11728)

### Recommended Venue Representation Strategy

**Phase 1 (MVP, 300 venues):**
- Store each venue photo as a separate CLIP embedding row
- Store one text embedding per venue (see Section 4)
- Query: find best-matching photos, aggregate per venue, combine with text score

**Phase 2 (scaling, 1,000+ venues):**
- Precompute a venue centroid from its photos for fast first-pass filtering
- Use individual photos for re-ranking the top candidates
- Two-stage: centroid ANN retrieval -> individual photo re-ranking

**Phase 3 (10,000+ venues, if needed):**
- Consider fine-tuning a domain-specific CLIP model on wedding imagery (like FashionCLIP was fine-tuned for fashion)
- Or train a simple fusion model a la ItemSage

## 2. User Taste Profile from Pinterest

### The Centroid Problem

The naive approach — average all Pinterest pin embeddings into a single "taste vector" — has a well-documented failure mode:

**Example:** A user pins both "rustic barn weddings" and "modern minimalist venues." The centroid lands somewhere in the middle, matching neither style well. This is not a theoretical concern — it's the primary reason Pinterest built PinnerSage.

### PinnerSage: The Definitive Approach to Multi-Interest User Representation

PinnerSage (KDD 2020, Pinterest) is the most relevant production system for this exact problem. Key details:

**Clustering algorithm:** Ward's hierarchical agglomerative clustering on user action embeddings. Ward was chosen because it doesn't require specifying the number of clusters upfront — it builds a dendrogram and cuts at a natural level.

**Adaptive cluster count:**
- Light user: 3-5 clusters
- Heavy user: 75-100 clusters
- The number emerges from the data, not a hyperparameter

**Medoid representation (NOT centroid):** Each cluster is represented by its medoid — the actual pin closest to the cluster center. This avoids topic drift (the centroid might not correspond to any real image), is more interpretable ("this pin represents your rustic barn interest"), and is storage-efficient (just store a pin ID, not a computed vector).

**Importance scoring:** Each cluster gets an importance score based on recency and size. When recommending, the system samples 3 medoids proportional to importance scores and retrieves nearest neighbors for each.

**Real-time updates:** User actions are processed in real-time to update clusters. Importance scores are updated daily.

**Production results:** Significant gains in engagement volume (repins + clicks) AND engagement propensity (per-user rates), directly attributable to increased quality and diversity.

**Source:** [PinnerSage paper](https://arxiv.org/abs/2007.03634), [Pinterest Engineering blog post](https://medium.com/pinterest-engineering/pinnersage-multi-modal-user-embedding-framework-for-recommendations-at-pinterest-bfd116b49475)

### Practical Adaptation for Wedding Venue Matching

Pinterest boards are typically 20-200 pins. A wedding-specific board might have 30-80 pins. The approach:

**Step 1: Embed all pins** using the same CLIP model used for venue photos.

**Step 2: Cluster pins** using Ward's hierarchical clustering or k-means (simpler, fine for <100 pins). With 30-80 pins, expect 2-5 natural clusters representing distinct taste dimensions (e.g., "outdoor garden," "industrial loft," "classic ballroom").

**Step 3: Represent each cluster** with either:
- Its medoid (PinnerSage approach) — simpler, more interpretable
- Its centroid — acceptable when clusters are tight/coherent

**Step 4: Query for each cluster** separately against venue photos, then combine results.

**Why NOT GMM:** Gaussian Mixture Models are more theoretically elegant but practically unnecessary for <100 pins. K-means or Ward clustering is sufficient. GMM adds complexity (covariance estimation, convergence issues with small samples) without meaningful benefit at this scale.

### Pinterest's Newer Work: Synergizing Implicit and Explicit Interests (2025)

Pinterest's latest retrieval framework (2025) uses both implicit user interests (inferred from behavior) and explicit interests (stated preferences). For a wedding venue app, this maps to:
- **Implicit:** CLIP embeddings of their Pinterest pins
- **Explicit:** User-stated preferences (budget, location, capacity, indoor/outdoor, style tags)

The combination significantly boosts performance across all user segments.

**Source:** [Synergizing Implicit and Explicit User Interests (arXiv 2025)](https://arxiv.org/html/2506.23060v1)

## 3. Matching Strategy

### Multi-Cluster Query Approach

With 2-5 taste clusters and venues represented by individual photos, the matching problem is: how to score venues given multiple query vectors.

**Option A: Max-Similarity (recommended for this use case)**

For each venue, score = max similarity between ANY user cluster and ANY venue photo.

```
venue_score = MAX over all (cluster, photo) pairs of cosine_sim(cluster_embedding, photo_embedding)
```

**Why max-sim:** A venue only needs to match ONE dimension of the user's taste to be relevant. A user who likes both "rustic barns" and "modern lofts" should see great rustic barns AND great modern lofts — not venues that are mediocre at both. This is the intuition behind ColBERT's MaxSim scoring.

**Option B: Weighted Average Across Clusters**

```
venue_score = SUM over clusters of (cluster_importance * max_sim(cluster, venue_photos))
```

This weights each taste dimension by its importance (how many pins were in that cluster). A cluster with 40 pins matters more than one with 5 pins.

**Option C: Top-K Photo Average**

Instead of pure max, take the average of the top-3 matching photos per venue. This reduces noise from a single lucky match.

**Recommended approach:** Start with Option B (weighted max-sim per cluster), which balances simplicity with taste diversity. Use cluster sizes as importance weights.

### ColBERT-Style MaxSim: Theoretical Foundation

The MaxSim pattern from ColBERT is directly applicable. ColBERT computes relevance as:

1. For each query token, find its maximum similarity with any document token
2. Sum these maximum similarities

Adapted for venue matching:
1. For each taste cluster, find its maximum similarity with any venue photo
2. Weight by cluster importance and sum

This ensures every facet of the user's taste gets to "vote" for its best match within each venue.

**Source:** [Late Interaction Overview (Weaviate)](https://weaviate.io/blog/late-interaction-overview)

### Hybrid Scoring: Image + Text

Combine image similarity with text similarity using late fusion:

```
final_score = w_visual * visual_score + w_text * text_score
```

Where:
- `visual_score` = max-sim between user taste clusters and venue photos
- `text_score` = similarity between user's stated preferences (or a text summary of their pins) and venue text embedding
- Start with `w_visual = 0.7, w_text = 0.3` — images are the primary signal for aesthetic matching; text captures factual attributes (capacity, location, amenities)

Alternatively, use **Reciprocal Rank Fusion (RRF)** to combine rankings from visual and text retrieval:

```
RRF_score = 1/(k + rank_visual) + 1/(k + rank_text)
```

Where k is a constant (typically 60). RRF is attractive because it doesn't require calibrating score scales between modalities.

**Source:** [Hybrid Search Explained (Weaviate)](https://weaviate.io/blog/hybrid-search-explained), [RRF explanation (ParadeDB)](https://www.paradedb.com/learn/search-concepts/reciprocal-rank-fusion)

### How Fashion/Venue Systems Handle This in Practice

**Stitch Fix:** Uses Pinterest pins as input. Embeds pinned images with CNNs, averages anchor embeddings per clothing type, then scores items with a weighted combination of visual distance and learned user affinity. Human stylists re-rank the final shortlist.

**The Knot (wedding platform):** Launched "Make it Yours" AI in 2025 that scans 1M+ images and recommends vendors based on saved favorites + location. Reduced venue search from 3.5 hours/week over 6 weeks to minutes.

**Real estate visual search:** Platforms like Restb.ai and Jitty use deep learning to encode property images into vectors, store in vector databases (FAISS/Milvus), and return visually similar properties. The pattern is identical: embed images -> store vectors -> nearest neighbor retrieval.

**Source:** [Stitch Fix Latent Style](https://multithreaded.stitchfix.com/blog/2018/06/28/latent-style/), [The Knot AI launch](https://www.digitalcommerce360.com/2025/09/29/the-knot-adds-ai-tool-to-its-online-wedding-planner/), [Restb.ai Visual Similarities](https://restb.ai/solutions/visual-similarities/)

## 4. Text Embedding for Venue Descriptions

### The Core Problem

Venue websites contain long-form markdown (1,000-10,000+ words) covering amenities, history, location, pricing, capacity, style descriptions, testimonials. This is too long for a single embedding and contains multiple distinct topics.

### CLIP Text Encoder: NOT Suitable for Venue Descriptions

CLIP's text encoder has a **77-token hard limit** and an **effective length of only ~20 tokens** due to how positional embeddings were trained. It was designed for short image captions like "a rustic barn wedding venue with string lights."

**Use CLIP text encoder for:** Short style descriptions, tags, captions
**Do NOT use CLIP text encoder for:** Full venue descriptions, website markdown

**Source:** [Long-CLIP paper (arXiv)](https://arxiv.org/html/2403.15378v1), [Understanding CLIP](https://medium.com/@paluchasz/understanding-openais-clip-model-6b52bade3fa3)

### Recommended Approach: Summarize-Then-Embed

For venue descriptions, a two-step approach:

**Step 1: LLM Summarization**
Use an LLM (Claude, GPT-4, etc.) to generate structured summaries from the full website markdown:

- **Aesthetic summary** (2-3 sentences): The visual style, ambiance, design philosophy
- **Factual summary** (2-3 sentences): Capacity, location, amenities, pricing tier
- **Vibe summary** (1-2 sentences): The emotional feeling, what kind of couple it suits

**Step 2: Embed the Summaries**
Use a dedicated text embedding model (NOT CLIP's text encoder):

- **For aesthetic matching:** Embed the aesthetic summary — this is what gets compared against user taste
- **For factual filtering:** Use structured data (capacity as integer, location as PostGIS point, price as range) — don't embed these, query them with SQL
- **Model choice:** OpenAI `text-embedding-3-small` (1536d) or `text-embedding-3-large` (3072d, supports dimension reduction via Matryoshka). Or open-source: `nomic-embed-text-v1.5` (768d, good quality/size tradeoff), `sentence-transformers/all-MiniLM-L6-v2` (384d, fast)

### Alternative: Chunk-Then-Embed

Split the website markdown into semantic chunks (by section/heading), embed each chunk separately, and store as separate rows (like venue photos).

**Pros:** No information loss, fine-grained matching
**Cons:** Many more vectors to store and query, chunks may lack context

**Anthropic's Contextual Retrieval** (2024) addresses the context loss problem by prepending a document-level context summary to each chunk before embedding. This reduced retrieval failure rates by 35-49%.

**For venue descriptions specifically:** Summarize-then-embed is preferred over chunking because:
1. Venue descriptions are relatively short (not multi-page documents)
2. You want a single "venue personality" embedding, not chunks
3. The LLM summarization step extracts exactly the signal you need (aesthetic, factual, vibe) and discards noise (navigation, legal disclaimers, etc.)

**Source:** [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval), [Chunking Strategies (Pinecone)](https://www.pinecone.io/learn/chunking-strategies/)

### How to Weight Text vs. Image Similarity

Start with **images dominant (70-80%)** for aesthetic matching:

- Wedding venue selection is overwhelmingly visual — couples want to "see" themselves there
- Text provides factual grounding (does it fit 200 guests?) and tie-breaking
- Over time, log user behavior (clicks, saves, inquiries) to learn optimal weights

For users who provide ONLY a Pinterest board (no text query): use image similarity exclusively for ranking, then use text embeddings for diversity/tie-breaking among similarly-scored venues.

For users who also provide text preferences ("outdoor, rustic, under $10K, 150 guests"): embed the text query with the same text model, combine with image similarity using the hybrid scoring approach from Section 3.

## 5. pgvector Specifics

### Index Selection by Scale

| Scale | Venue Photos | Total Vectors | Recommended Index |
|-------|-------------|---------------|-------------------|
| 300 venues | ~4,500 | ~5,000 | **No index (sequential scan)** |
| 1,000 venues | ~15,000 | ~16,000 | **No index or HNSW** |
| 3,000 venues | ~45,000 | ~50,000 | **HNSW** |
| 10,000 venues | ~150,000 | ~160,000 | **HNSW** |

**Key thresholds from benchmarks:**
- Sequential scan is fine up to ~10K rows at ~36ms query time
- Sequential scan becomes costly at ~50K rows
- At 30K+ rows, HNSW is already significantly faster than sequential scan

**At 300 venues (4,500 photo vectors + 300 text vectors = 4,800 total):** Don't bother with an index. Sequential scan will be fast enough (<50ms). You get 100% recall (exact results).

**At 10,000 venues (150K photo vectors + 10K text vectors = 160K total):** HNSW is required. Build with `ef_construction = 64` and `m = 16` (good defaults). Query with `ef_search = 40` for a balance of speed and recall.

**Source:** [Crunchy Data: HNSW Indexes with pgvector](https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector), [Neon: pgvector search optimization](https://neon.com/docs/ai/ai-vector-search-optimization)

### HNSW vs IVFFlat

**Use HNSW** (recommended for this use case):
- Better query performance (speed-recall tradeoff)
- No need to rebuild when data changes
- Can be built on empty tables (unlike IVFFlat which needs data first)
- Higher memory usage and slower build time, but at 160K vectors this is negligible

**Use IVFFlat** only if:
- Memory is severely constrained
- You need faster index build times
- You're doing frequent bulk data loads

For IVFFlat sizing: `lists = rows / 1000` for up to 1M rows. At 160K vectors: 160 lists. Query with `probes = sqrt(lists)` = ~13 probes.

**Source:** [pgvector HNSW vs IVFFlat study](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931), [AWS deep dive on pgvector indexing](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)

### Multi-Vector Query Patterns in pgvector

**Pattern 1: CROSS JOIN LATERAL for batch queries**

Query multiple taste cluster embeddings against venue photos in a single SQL statement:

```sql
SELECT
  results.venue_id,
  results.photo_id,
  results.similarity,
  clusters.cluster_idx
FROM unnest(
  ARRAY[$1::vector, $2::vector, $3::vector]  -- taste cluster embeddings
) WITH ORDINALITY AS clusters(embedding, cluster_idx)
CROSS JOIN LATERAL (
  SELECT
    vp.venue_id,
    vp.id as photo_id,
    1 - (vp.embedding <=> clusters.embedding) as similarity
  FROM venue_photos vp
  ORDER BY vp.embedding <=> clusters.embedding
  LIMIT 20  -- top 20 photos per cluster
) AS results
ORDER BY clusters.cluster_idx, results.similarity DESC;
```

This efficiently queries all clusters in one database round trip. The HNSW index is used for each LATERAL subquery.

**Source:** [Batch Vector Search with pgvector (Murhabazi)](https://www.murhabazi.com/batch-vector-search-pgvector-postgresql-cross-lateral-joins), [pgvector GitHub issue #645](https://github.com/pgvector/pgvector/issues/645)

**Pattern 2: Aggregate to venue-level scores**

```sql
WITH cluster_matches AS (
  -- Pattern 1 query above
),
venue_scores AS (
  SELECT
    venue_id,
    -- Max similarity across all (cluster, photo) pairs per venue
    MAX(similarity) as max_sim,
    -- Or: weighted by cluster importance
    SUM(similarity * cluster_weight) / SUM(cluster_weight) as weighted_sim
  FROM cluster_matches
  JOIN taste_clusters ON cluster_matches.cluster_idx = taste_clusters.idx
  GROUP BY venue_id
)
SELECT v.*, vs.max_sim, vs.weighted_sim
FROM venues v
JOIN venue_scores vs ON v.id = vs.venue_id
ORDER BY vs.weighted_sim DESC
LIMIT 20;
```

**Pattern 3: Two-stage retrieval (for 10K+ venues)**

```sql
-- Stage 1: Fast ANN retrieval using venue centroids
WITH candidate_venues AS (
  SELECT venue_id, 1 - (centroid <=> $1) as centroid_sim
  FROM venue_centroids
  ORDER BY centroid <=> $1
  LIMIT 100  -- broad recall
),
-- Stage 2: Re-rank using individual photos (exact distance)
photo_scores AS (
  SELECT vp.venue_id, MAX(1 - (vp.embedding <=> $1)) as best_photo_sim
  FROM venue_photos vp
  WHERE vp.venue_id IN (SELECT venue_id FROM candidate_venues)
  GROUP BY vp.venue_id
)
SELECT v.*, ps.best_photo_sim
FROM venues v
JOIN photo_scores ps ON v.id = ps.venue_id
ORDER BY ps.best_photo_sim DESC
LIMIT 20;
```

### Practical pgvector Considerations

**Vector dimensions:** CLIP ViT-B/32 produces 512-dimensional vectors. CLIP ViT-L/14 produces 768-dimensional vectors. Either works with pgvector (supports up to 2,000 dimensions).

**Distance operator:** Use `<=>` (cosine distance) for CLIP embeddings. CLIP was trained to maximize cosine similarity.

**Storage:** A 512-dimensional float32 vector takes ~2KB. 160K vectors = ~320MB. Trivial.

**Inline centroid computation:** `SELECT venue_id, AVG(embedding) as centroid FROM venue_photos GROUP BY venue_id` — pgvector supports this natively.

**Combined image + text columns:** Don't try to combine CLIP image embeddings (512d) with text embeddings (1536d) into a single vector — they're in different embedding spaces with different dimensions. Keep them as separate columns and combine scores at query time.

## 6. Known Systems and Papers

### Directly Relevant Production Systems

| System | Year | Key Technique | Relevance |
|--------|------|--------------|-----------|
| **PinnerSage** (Pinterest) | 2020 | Ward clustering -> medoids for multi-interest user representation | Directly solves the "diverse taste" problem |
| **ItemSage** (Pinterest) | 2022 | Transformer fusion of multi-image + text into single product embedding | Gold standard for multi-modal item embeddings |
| **PinnerFormer** (Pinterest) | 2022 | Long-term interest + short-term intention user modeling | User modeling evolution |
| **The Knot "Make it Yours"** | 2025 | AI matching couples to vendors from 1M+ images | Direct wedding venue competitor |
| **Stitch Fix** | 2018-2021 | Latent style space, Pinterest pin -> inventory matching | Pinterest-to-recommendation pipeline |
| **FashionCLIP** | 2022 | CLIP fine-tuned on 700K fashion image-text pairs | Domain-specific CLIP adaptation |
| **VL-CLIP** | 2025 | Visual grounding + LLM-augmented CLIP for e-commerce | +18.6% CTR improvement |

### Architecture Patterns Worth Studying

**ColBERT's MaxSim (2020):** Multi-vector retrieval with sum-of-maximum-similarities scoring. Directly applicable pattern for matching multi-cluster user taste against multi-photo venues.
- Source: [ColBERT paper](https://people.eecs.berkeley.edu/~matei/papers/2020/sigir_colbert.pdf)

**Ref2Vec Centroid (Weaviate):** "User-as-query" pattern where user is represented by the centroid of items they've interacted with. Good starting point, upgrade to multi-embedding when needed.
- Source: [Weaviate Ref2Vec blog](https://weaviate.io/blog/ref2vec-centroid)

**Pinterest Multi-Embedding Retrieval Framework (2025):** Combines implicit (behavioral) and explicit (stated) user interest models. Both models contribute retrieval candidates that are merged and re-ranked.
- Source: [arXiv 2506.23060](https://arxiv.org/html/2506.23060v1)

### Key Papers

1. **PinnerSage: Multi-Modal User Embedding Framework** (KDD 2020) — [arXiv:2007.03634](https://arxiv.org/abs/2007.03634)
2. **ItemSage: Learning Product Embeddings for Shopping Recommendations** (KDD 2022) — [arXiv:2205.11728](https://arxiv.org/abs/2205.11728)
3. **ColBERT: Efficient and Effective Passage Search** (SIGIR 2020) — [Stanford paper](https://people.eecs.berkeley.edu/~matei/papers/2020/sigir_colbert.pdf)
4. **Long-CLIP: Unlocking the Long-Text Capability of CLIP** (2024) — [arXiv:2403.15378](https://arxiv.org/html/2403.15378v1)
5. **VL-CLIP: Enhancing Multimodal Recommendations** (RecSys 2025) — [arXiv:2507.17080](https://arxiv.org/abs/2507.17080)
6. **FashionCLIP** — [GitHub](https://github.com/patrickjohncyh/fashion-clip)
7. **Late Chunking: Contextual Chunk Embeddings** (2024) — [arXiv:2409.04701](https://arxiv.org/pdf/2409.04701)

## Decisions Made

Based on discussion with the project owner, these architectural decisions are locked:

### UX Paradigm: LLM-Based Search (Not Swipe)
The swipe-based onboarding is being scrapped. The new flow:
1. User connects their Pinterest account
2. System ingests board images via Pinterest API v5, embeds with CLIP, clusters into taste profile
3. User sees initial venue matches ranked by taste similarity
4. User refines results by conversing with an LLM ("I want outdoor only, under $15K, within 2 hours of Austin")
5. LLM translates conversation into structured filters (SQL WHERE clauses) + re-weighted vector queries

This means the taste profile is built entirely from Pinterest — no swipe signal.

### Cluster Count: Auto-Detect via Silhouette Score
Use silhouette score to find optimal k (testing k=2 through k=8). For a typical wedding board (30-80 pins), expect 2-5 clusters. Silhouette score measures how well each point fits its assigned cluster vs. the nearest neighbor cluster — higher is better.

```python
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

best_k, best_score = 2, -1
for k in range(2, min(9, len(pins))):
    labels = KMeans(n_clusters=k, n_init=10).fit_predict(pin_embeddings)
    score = silhouette_score(pin_embeddings, labels)
    if score > best_score:
        best_k, best_score = k, score
```

Edge case: if all silhouette scores are low (<0.15), the pins are either too uniform (use single centroid) or too scattered (present clusters to user for validation).

### Text Embedding: Local-First (Ollama + nomic-embed-text)
- Use `nomic-embed-text-v1.5` via Ollama for v1 — runs locally, 768d output, good quality
- Upgrade path to OpenAI `text-embedding-3-small` (1536d) if quality or latency becomes a bottleneck
- Embed LLM-generated aesthetic summaries, not raw website markdown
- Note: nomic and CLIP produce different vector spaces — store in separate columns, combine at score level

### Taste Profile: Multi-Cluster (Migrate from Single Centroid)
Replace the existing `taste_profiles` table (single centroid) with `taste_clusters` table:

```sql
CREATE TABLE taste_clusters (
  cluster_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  cluster_index INT NOT NULL,
  medoid_vector VECTOR(512) NOT NULL,
  centroid_vector VECTOR(512) NOT NULL,
  weight FLOAT NOT NULL,  -- normalized cluster size (0-1)
  pin_count INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cluster_index)
);

CREATE INDEX idx_taste_clusters_user ON taste_clusters(user_id);
```

Store both medoid (for interpretability — "this pin represents your rustic taste") and centroid (for querying — slightly better recall). Use centroid for similarity search, medoid for UI display.

### Implicit Learning: Deferred to Post-V1
Without guaranteed like/dislike actions, learning signals are weak. Possible future approaches:
- **Click-through on venue cards** — implicit positive signal (noisy)
- **Time spent on venue detail page** — dwell time as interest proxy
- **Inquiry/contact actions** — strong positive signal but rare
- **LLM conversation analysis** — extract preferences from what users ask about ("do they have a garden?" = garden interest)
- **Session-level profile drift** — adjust cluster weights based on which venues user explores most

For v1, the Pinterest board is the sole taste signal. This is fine — it's already a high-quality, curated signal.

## Open Questions

1. **CLIP model selection:** Currently using ViT-B/32 (512d). ViT-L/14 (768d) would give better quality embeddings but requires more compute and re-embedding all venues. Worth benchmarking on wedding imagery specifically. FashionCLIP proves domain fine-tuning helps; "WeddingCLIP" is a future possibility.

2. **Pinterest API rate limits:** Need to verify how many pin images can be fetched per board and how quickly. API v5 paginates at 25 pins per request. May need to cap at ~100 pins per board for practical reasons.

3. **Cold start (small boards):** If a user's Pinterest board has <10 pins, clustering may not work well. Fallback options: use single centroid, or supplement with LLM conversation ("what styles do you like?") to generate synthetic taste vectors from text.

4. **LLM filter translation:** How the LLM conversation maps to SQL filters + vector re-ranking needs its own design. This is a separate research topic (structured output from conversation → query plan).

5. **Evaluation metrics:** Before user engagement data exists, evaluate with: cosine similarity distributions, visual inspection of top-K results, synthetic taste profiles from curated Pinterest boards.

## Extracted Principles

- **Multi-vector over centroid for items**: Store each venue photo as a separate embedding. The storage cost is trivial; the information preservation is significant. Precompute centroids as an optimization for fast first-pass retrieval, not as the primary representation.
- **Cluster user taste, don't average it**: Use k-means on Pinterest pin embeddings with silhouette score to auto-detect 2-5 natural taste dimensions. Store both medoid (for UI/interpretability) and centroid (for querying) per cluster.
- **Max-similarity scoring**: A venue only needs to match ONE dimension of user taste to be relevant. Use weighted max-sim across taste clusters, inspired by ColBERT's MaxSim pattern.
- **Separate embedding spaces for images and text**: CLIP image embeddings (512d) and text embeddings (768d nomic / 1536d OpenAI) live in different spaces. Never concatenate. Combine at score level: `0.7 * visual + 0.3 * text`.
- **Summarize-then-embed for long text**: CLIP text encoder has 77-token limit. Use LLM to extract aesthetic/vibe summary from venue website markdown, then embed with a dedicated text model (nomic-embed-text locally, OpenAI as upgrade path).
- **pgvector scales fine for this problem**: 160K vectors with HNSW handles 10,000 venues easily. At 300 venues, don't even bother with an index. Use CROSS JOIN LATERAL for multi-cluster queries.
- **Two-stage retrieval at scale**: Fast ANN over precomputed venue centroids for broad recall (top-100), then exact re-ranking over individual photos for precision (top-20). Implementable in a single SQL CTE.
- **Pinterest board is high-quality taste signal**: A curated Pinterest board is already a strong, intentional signal of user preference — stronger than implicit behavioral data. Build v1 entirely on this signal; add implicit learning later.

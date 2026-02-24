# Recommendation Engine Principles

## Summary

Principles for building a multi-modal recommendation engine that matches users (represented by curated image collections like Pinterest boards) against items with rich visual and textual content (like wedding venues with photos and descriptions). Covers vector representation, taste modeling, scoring, embedding strategy, conversational refinement, third-party image ingestion, pgvector operations, and cold start handling. Derived from PinnerSage, ColBERT, Stitch Fix, and production systems at Airbnb and Zillow.

## Principles

### 1. Store Items as Multi-Vector, Not Centroid
- **What:** Store each item photo as a separate embedding row. Use per-photo vectors for matching and precompute centroids only as an optimization for fast first-pass retrieval.
- **Why:** Averaging embeddings into a single centroid loses the range of visual content. A venue with both rustic interiors and elegant gardens gets averaged into a meaningless middle. Multi-vector preserves full diversity at trivial storage cost (150K vectors is well within pgvector's comfort zone).
- **When:** Always for the primary representation. Centroids are acceptable as a prefilter for two-stage retrieval at 1,000+ items, or as an MVP shortcut for prototyping.
- **Source:** [multi-modal-venue-recommendation-engine.md](../research/2026-02-23-multi-modal-venue-recommendation-engine.md) (Section 1), PinnerSage, ItemSage (KDD 2022)

### 2. Cluster User Taste, Don't Average It
- **What:** Use k-means on user image embeddings with silhouette score auto-detection (k=2 through k=8) to find 2-5 natural taste dimensions. Store both medoid (for UI interpretability) and centroid (for querying) per cluster. Use cluster size as importance weight.
- **Why:** A user who likes both rustic barns and modern lofts has two distinct preferences. Averaging them yields a centroid matching neither style. PinnerSage was built specifically because "a single embedding is not sufficient for encoding multiple facets."
- **When:** When the user has 16+ images. Below that threshold, use the tiered cold start strategy (Principle 14).
- **Source:** [multi-modal-venue-recommendation-engine.md](../research/2026-02-23-multi-modal-venue-recommendation-engine.md) (Section 2), PinnerSage (KDD 2020)

### 3. Score with Weighted MaxSim Across Taste Clusters
- **What:** For each taste cluster, find its maximum similarity with any item photo. Weight by cluster importance (normalized pin count) and sum. This is the ColBERT MaxSim pattern adapted for recommendations.
- **Why:** An item only needs to match ONE dimension of user taste to be relevant. A user who likes both rustic and modern should see great rustic items AND great modern items, not items mediocre at both. Weighted MaxSim ensures every taste facet votes for its best match within each item.
- **When:** Always use as the primary visual scoring method. Fall back to simple max-sim (unweighted) for cold start users with only 1-2 clusters.
- **Source:** [multi-modal-venue-recommendation-engine.md](../research/2026-02-23-multi-modal-venue-recommendation-engine.md) (Section 3), ColBERT (SIGIR 2020)

### 4. Combine Image and Text Scores via Late Fusion, Not Concatenation
- **What:** Keep image embeddings (CLIP) and text embeddings (nomic/OpenAI) as separate vector spaces. Combine at score level: `final = 0.7 * visual_score + 0.3 * text_score`. Never concatenate vectors from different embedding spaces.
- **Why:** CLIP image embeddings (512d) and text embeddings (768d+) occupy fundamentally different spaces with different dimensions. Concatenation is meaningless. Late fusion lets you tune the balance and transparently debug each signal. Use RRF (Reciprocal Rank Fusion) if score calibration between modalities is difficult.
- **When:** Whenever combining signals from different embedding models. The 70/30 split favors images for aesthetic-dominant domains (fashion, venues, real estate). Adjust weights based on your domain's visual-vs-factual balance.
- **Source:** [multi-modal-venue-recommendation-engine.md](../research/2026-02-23-multi-modal-venue-recommendation-engine.md) (Section 3, 4), Stitch Fix late fusion

### 5. Summarize-Then-Embed for Long Text
- **What:** Use an LLM to generate structured summaries (aesthetic, factual, vibe) from long-form content, then embed the summaries with a dedicated text model. Do NOT embed raw long text or use CLIP's text encoder (77-token hard limit, ~20 effective tokens).
- **Why:** Venue descriptions, product pages, and property listings contain 1K-10K+ words mixing signal (style, amenities) with noise (legal disclaimers, navigation). LLM summarization extracts exactly the signal needed. Chunking is overkill for single-entity descriptions — you want one "personality" embedding, not fragments.
- **When:** For any item text longer than ~200 words. For short text (tags, captions, titles), embed directly. Use structured data (SQL columns) for factual attributes like capacity, price, and location — don't embed those.
- **Source:** [multi-modal-venue-recommendation-engine.md](../research/2026-02-23-multi-modal-venue-recommendation-engine.md) (Section 4), Anthropic Contextual Retrieval

### 6. Use Function Calling Over NL2SQL for Fixed Schemas
- **What:** Define a typed tool schema with all filterable parameters. The LLM extracts structured values from conversation via function calling. The application builds SQL. The LLM never sees or generates SQL.
- **Why:** Full NL2SQL solves a harder problem than you have. With a fixed schema of ~10-20 filterable columns, function calling is simpler, safer (no injection risk), and more testable. Zillow, Airbnb, and every production conversational search system uses NL-to-structured-filters, not NL2SQL.
- **When:** When your search schema is known and bounded. Only consider NL2SQL when users need to query arbitrary tables/joins you can't predict at design time.
- **Source:** [conversational-search-to-sql-vector-reranking.md](../research/2026-02-23-conversational-search-to-sql-vector-reranking.md) (Sections 1-2), Zillow, Airbnb (Feb 2026)

### 7. Pass Full Filter State Per Turn, Not Diffs
- **What:** In multi-turn conversational search, include the complete current filter state in the system prompt. Have the LLM return the complete new filter state via tool call — not just changes.
- **Why:** Diff-based state accumulates errors. The LLM must reason about what was previously set, what the user wants to change, and produce a correct delta. Full state eliminates this: the LLM sees all active filters explicitly, "undo" is just omitting a filter, and there's no history reconstruction. Maintain a filter state stack on the application side for "go back" operations.
- **When:** Always for multi-turn filter refinement. The only cost is slightly larger system prompts, which is negligible.
- **Source:** [conversational-search-to-sql-vector-reranking.md](../research/2026-02-23-conversational-search-to-sql-vector-reranking.md) (Section 2)

### 8. Inject Aesthetic Text Queries as Additional Vector Signals
- **What:** When a user says "more rustic" or "romantic garden vibes," embed the aesthetic description with the text model and add it as a high-weight query vector alongside taste cluster embeddings. Also support cluster weight boosting ("more like my outdoor pins") and "more like this" via venue embedding lookup.
- **Why:** Conversational refinement produces aesthetic intent that doesn't map to SQL filters. This intent must modify the vector search, not the WHERE clause. Three mechanisms cover the full space: text-to-vector injection, cluster weight adjustment, and "more like this" via reference item embedding.
- **When:** Whenever the user expresses aesthetic or stylistic preferences in conversation. Hard constraints (price, capacity, location) become SQL filters; soft preferences (vibe, style, mood) become vector adjustments.
- **Source:** [conversational-search-to-sql-vector-reranking.md](../research/2026-02-23-conversational-search-to-sql-vector-reranking.md) (Section 3)

### 9. CTE Pre-Filter Then Vector Rank; Iterative Scan at Scale
- **What:** At small-medium scale, use a SQL CTE to apply structured WHERE clauses first, then vector-rank only the filtered results. At 1,000+ items, switch to pgvector 0.8's iterative scan (`hnsw.iterative_scan = relaxed_order`) which automatically re-scans the HNSW graph when filtered results are insufficient.
- **Why:** HNSW post-filtering is broken: if only 10% of items pass filters and you request top-40, you get ~4 results. CTE pre-filtering avoids this entirely at small scale. Iterative scan (up to 5.7x faster than pre-0.8 approaches) solves it at large scale without giving up index performance.
- **When:** CTE pre-filter for <1,000 items after filtering. Iterative scan for larger filtered sets. Use `relaxed_order` mode (95-99% quality of strict_order, significantly faster).
- **Source:** [conversational-search-to-sql-vector-reranking.md](../research/2026-02-23-conversational-search-to-sql-vector-reranking.md) (Section 5), pgvector 0.8.0 release

### 10. Skip the pgvector Index Until You Need It
- **What:** Sequential scan handles up to ~10K vectors at <50ms. Add HNSW only at 30K+ vectors. Use `m=16, ef_construction=64` defaults. Use CROSS JOIN LATERAL for multi-cluster batch queries in a single database round trip.
- **Why:** An unnecessary index adds build time, memory overhead, and approximate results. At 300 items (~5K vectors), exact sequential scan is fast and gives 100% recall. The index pays for itself only when scan time exceeds your latency budget.
- **When:** No index for <10K vectors. HNSW at 30K+. IVFFlat only if memory is severely constrained. Always use cosine distance operator (`<=>`) for CLIP embeddings.
- **Source:** [multi-modal-venue-recommendation-engine.md](../research/2026-02-23-multi-modal-venue-recommendation-engine.md) (Section 5), Crunchy Data benchmarks

### 11. Fetch All Pin Metadata First, Then Batch Download Images
- **What:** Paginate through all pins via the API (bookmark-based cursor, page_size up to 250), filter out non-image pins by `creative_type`, then download `originals` images concurrently (8-16 parallel) from the CDN. Pinterest CDN URLs (`i.pinimg.com`) require no authentication and don't expire.
- **Why:** Pinterest's API and CDN are separate concerns. Fetching metadata first lets you filter videos, count images, and estimate processing time before downloading. CDN images are permanent, unauthenticated copies — download immediately, embed, discard URLs.
- **When:** For any Pinterest board import pipeline. Budget ~1-3 minutes per 200-pin board (API fetching + image download + CLIP encoding).
- **Source:** [pinterest-api-v5-integration.md](../research/2026-02-23-pinterest-api-v5-integration.md) (Sections 2-3)

### 12. Build the Full Integration Before Applying for Standard Access
- **What:** Develop and test against Pinterest Trial access (daily rate limits, 24hr test tokens). Apply for Standard access only after building a polished demo showing the complete OAuth flow, board listing, pin fetching, and recommendation output. Expect multiple rejection cycles.
- **Why:** Pinterest's approval process has a well-documented Catch-22: vague rejections, multi-week delays, and the requirement to show a "meaningful integration" — not just a proof of concept. Trial access gives full read capability for development. The demo video must show Pinterest data being used in your app, not just API calls.
- **When:** Start development with Trial access immediately. Apply for Standard only when the demo is compelling and shows end-to-end value.
- **Source:** [pinterest-api-v5-integration.md](../research/2026-02-23-pinterest-api-v5-integration.md) (Section 5)

### 13. Classify Into Style Archetypes as a Free Always-On Signal
- **What:** Define 8-12 domain-specific style archetypes. Pre-compute prototype embeddings using CLIP zero-shot ("a photo of a rustic barn wedding venue"). Classify every user image by cosine similarity against all prototypes. The result is a lightweight style distribution that works with even 1 image.
- **Why:** Archetype classification costs nothing beyond initial setup (just cosine similarity with pre-computed text embeddings), provides interpretable labels ("50% rustic, 30% boho"), enables UI validation ("Is this right?"), and serves as a cold start fallback. It's a dimensionality reduction from 512d to 10 categories — lossy but always available.
- **When:** Always run alongside the full vector pipeline. Use as the primary signal when clustering fails (small boards). Don't replace vector matching with archetypes — layer both.
- **Source:** [cold-start-small-pinterest-boards.md](../research/2026-02-23-cold-start-small-pinterest-boards.md) (Section 2, Strategy D)

### 14. Degrade Gracefully Through Pin Count Tiers
- **What:** Route users to different matching strategies based on data density: 0 pins = popularity + style quiz; 1-4 = individual pin queries + MMR diversity re-ranking; 5-15 = attempt k=2 with inter-cluster distance validation, fall back to individual queries; 16-30 = k=2-3 silhouette-validated; 30+ = full k=2-8 auto-detection.
- **Why:** Clustering algorithms need minimum viable data. K-means on 3 points is meaningless. Silhouette scores are unreliable below 15 points. But sparse users still deserve good recommendations. Individual pin queries with MMR diversity re-ranking preserve all information without forcing nonexistent patterns. Each tier is strictly better than either the tier above or naive fallback.
- **When:** Evaluate at profile creation time and on any profile update. Pin count thresholds (0, 5, 16, 30) should be validated empirically but the tier structure should be designed upfront.
- **Source:** [cold-start-small-pinterest-boards.md](../research/2026-02-23-cold-start-small-pinterest-boards.md) (Section 6)

### 15. Visual Self-Selection Beats Verbal Self-Description
- **What:** When collecting explicit preferences, show images and let users pick — don't ask them to describe their style in words. A grid of 8-10 style exemplar images with "pick 2-3 that appeal to you" takes 10 seconds and immediately produces archetype weights.
- **Why:** Users often don't know the vocabulary for their preferences. "Rustic" means different things to different people. But they know what they like when they see it. Stitch Fix validated this extensively: Style Shuffle's thumbs up/down on images works better than onboarding surveys because it doesn't use words.
- **When:** As a fallback when the primary signal (Pinterest board, browsing history) is too sparse. Also useful as a fast onboarding step before Pinterest data is available.
- **Source:** [cold-start-small-pinterest-boards.md](../research/2026-02-23-cold-start-small-pinterest-boards.md) (Section 3), Stitch Fix Style Shuffle

### 16. The Conversation IS the Progressive Profiling
- **What:** In an LLM-powered recommendation system, each conversational turn refines the taste profile. Explicit filters (budget, location) become SQL WHERE clauses. Soft preferences ("more casual") adjust cluster weights or inject text vector queries. Don't build a separate profiling phase — embed refinement in the natural recommendation flow.
- **Why:** Wedding venue search (and similar high-stakes decisions) involves 2-5 visits, not hundreds of sessions. There's no time for a traditional bandit exploration phase. The LLM conversation simultaneously presents results and collects refinement signal. Pinterest's 2025 Multi-Embedding Retrieval Framework validates that combining implicit (visual) and explicit (stated) interest models outperforms either alone.
- **When:** Always for conversational recommendation systems. The profile is "good enough" when successive scoring rounds produce >80% overlap in the top-10 results, or the user stops correcting.
- **Source:** [cold-start-small-pinterest-boards.md](../research/2026-02-23-cold-start-small-pinterest-boards.md) (Section 5), [conversational-search-to-sql-vector-reranking.md](../research/2026-02-23-conversational-search-to-sql-vector-reranking.md) (Sections 2-3)

### 17. Communicate Uncertainty as Invitation, Not Disclaimer
- **What:** Frame sparse profiles with language that invites action ("Help us learn your style" / "Want even better matches?"), not disclaimers ("We don't have enough data"). Use progressive language cues: "starting point" for low confidence, "personalized picks" for high. Show a "profile strength" bar, not a numeric confidence score.
- **Why:** Users tolerate uncertainty but cannot tolerate being calmly misled by authoritative-looking interfaces. A numeric confidence score ("73% confident") is meaningless to users. An invitation to provide more signal converts uncertainty into engagement.
- **When:** Always when recommendation confidence varies by user. Tier the messaging: 0 pins = explicit ask; 1-4 pins = "starting point, tell us more"; 5-15 pins = "we've identified your taste"; 16+ pins = full confidence language.
- **Source:** [cold-start-small-pinterest-boards.md](../research/2026-02-23-cold-start-small-pinterest-boards.md) (Section 6)

## Revision History
- 2026-02-23: Initial extraction from four research files: multi-modal-venue-recommendation-engine.md, pinterest-api-v5-integration.md, cold-start-small-pinterest-boards.md, conversational-search-to-sql-vector-reranking.md.

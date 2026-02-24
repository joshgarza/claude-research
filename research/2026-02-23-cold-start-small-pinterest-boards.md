---
date: 2026-02-23
topic: Cold start strategies for small Pinterest boards in recommendation engine
status: complete
tags: [cold-start, clustering, recommendation-system, CLIP, embeddings, small-data, progressive-profiling, wedding-venues]
related: [2026-02-23-multi-modal-venue-recommendation-engine.md]
---

# Cold Start Strategies for Small Pinterest Boards (<10 Pins)

## Context

We're building a wedding venue recommendation engine where users connect their Pinterest board, we embed all pin images with CLIP (ViT-B/32, 512d), cluster them into 2-5 taste dimensions using k-means with silhouette score auto-detection, and match against venue photo embeddings using weighted MaxSim scoring.

The problem: when a user's Pinterest board has very few pins (3-8 images), the clustering pipeline breaks down. K-means with k=2 on 3 points is meaningless, silhouette score is unreliable, and the taste profile is too sparse. But we still need to provide good recommendations for these users.

This research covers: minimum viable clustering thresholds, fallback strategies, taste profile augmentation, cold start patterns from production systems, progressive profiling, and graceful degradation design.

## 1. Minimum Viable Clustering

### The 10d Rule and Why It Dooms Small Boards

The most cited sample size guideline for clustering comes from Dolnicar et al. (2014): each cluster should contain at least **10 x d** data points, where d is the number of features/dimensions. For 512-dimensional CLIP embeddings, that implies 5,120 points per cluster -- obviously absurd for our use case.

However, that rule was designed for market segmentation surveys with noisy, low-dimensional data (10-30 features). CLIP embeddings are dense, pre-trained representations where the effective dimensionality is much lower than the raw 512 dimensions. In practice, CLIP image embeddings for a coherent domain (wedding imagery) occupy a much smaller subspace.

A more pragmatic rule from cluster analysis literature: **N = 20-30 per expected subgroup** provides sufficient statistical power when cluster separation is large (Steinley & Brusco, 2011). With well-separated CLIP embedding clusters (e.g., "rustic barns" vs. "modern minimalist" have very different visual features), even smaller samples can produce meaningful groupings.

**Bottom line for our system:**
- **<5 pins**: Clustering is not viable. Any partition is essentially random.
- **5-7 pins**: k=2 might work IF the pins are clearly bimodal (e.g., 3 rustic + 4 modern). Silhouette score is unreliable at this size -- it's too sensitive to individual point placement.
- **8-15 pins**: k=2 is reasonable; k=3 is borderline. Silhouette score starts becoming informative.
- **16-30 pins**: k=2 to k=4 is viable. This is where the designed pipeline starts working properly.
- **30+ pins**: The full auto-detection pipeline (k=2 through k=8, silhouette-scored) works as designed.

**Source:** [Dolnicar et al., 2014 (Journal of Travel Research)](https://journals.sagepub.com/doi/full/10.1177/0047287513496475), [Steinley & Brusco, 2011 - Statistical Power for Cluster Analysis (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9158113/)

### Silhouette Score Breaks Down on Small Samples

Silhouette score has well-documented failure modes with small datasets:

1. **Small clusters have noisy within-cluster distances.** One outlier pin can inflate the average within-cluster distance, yielding a low silhouette score even when the cluster is semantically meaningful.
2. **The 0.5 threshold is meaningless at n<10.** The conventional interpretation (>0.5 = strong structure, 0.25-0.5 = reasonable, <0.25 = weak) was calibrated on larger datasets. With 5 points, random partitions routinely score above 0.5.
3. **Spherical cluster assumption.** Silhouette assumes roughly spherical clusters. In high-dimensional CLIP space, clusters can be elongated or irregularly shaped.

**Alternative metrics at small scale:**
- **Davies-Bouldin Index** -- measures ratio of within-cluster scatter to between-cluster separation. Still noisy at small n but somewhat more stable than silhouette.
- **Calinski-Harabasz Score** -- ratio of between-cluster to within-cluster variance. Also degrades at small n.
- **Manual threshold on inter-cluster distance** -- for k=2, just measure the cosine distance between the two cluster centroids. If it's below a threshold (e.g., cosine similarity > 0.85), the clusters are too similar to be meaningful -- fall back to single centroid.

**Source:** [Silhouette (clustering) -- Wikipedia](https://en.wikipedia.org/wiki/Silhouette_(clustering)), [Nature Biotechnology -- Shortcomings of silhouette](https://www.nature.com/articles/s41587-025-02743-4), [ResearchGate -- Threshold silhouette score for cluster analysis](https://www.researchgate.net/post/Threshold_silhouette_score_for_cluster_analysis)

### Clustering Algorithms That Work Better with Few Points

**Hierarchical Agglomerative Clustering (Ward's method):**
Ward's method has no minimum sample requirement. It builds a full dendrogram from n points and can cut at any level. With 5-8 points, you can inspect the dendrogram and choose a natural cut point. PinnerSage uses Ward's specifically because it doesn't require specifying k upfront. The downside: it always produces clusters (even from random data), so you need a separate validation step.

**HDBSCAN:**
HDBSCAN requires a `min_cluster_size` parameter (minimum points to form a cluster). Setting this to 2-3 with 5-8 points means it can identify small dense groups while labeling outliers as noise. The advantage over k-means: it won't force every point into a cluster, and can detect that "these 5 pins are all in the same cluster" (no meaningful subclusters). Downside: with very few points, the density estimation is unreliable.

**Threshold-Based Community Detection:**
Instead of running a formal clustering algorithm, compute the pairwise cosine similarity matrix for all pins and group any pins with similarity above a threshold (e.g., 0.80-0.90 cosine similarity). This is the simplest approach and makes the most intuitive sense for small boards: if two pins look very similar in CLIP space, group them. No minimum sample size required.

**Recommendation for small boards:** Threshold-based grouping with a fallback to single centroid. If all pins have pairwise cosine similarity >0.80, they're one cluster (single centroid). If there's a clear split (some pairs <0.70, others >0.85), split into two groups.

**Source:** [scikit-learn Clustering Guide](https://scikit-learn.org/stable/modules/clustering.html), [HDBSCAN Documentation](https://hdbscan.readthedocs.io/en/latest/comparing_clustering_algorithms.html), [Tiffena -- Evaluating Threshold and Density-Based Clustering](https://tiffena.me/posts/evaluate-cluster-image-embeddings/)

## 2. Fallback Strategies for Small Boards

### Strategy A: Single Centroid (Mean of All Pins)

**How:** Average all pin embeddings into one "taste vector." Query venues against this single vector.

**When it's actually fine:**
- All pins are stylistically coherent (all rustic barns, all garden weddings)
- The board is clearly focused on one aesthetic
- Signal: high average pairwise cosine similarity across all pins (>0.80)

**When it fails:**
- Pins span multiple aesthetics (3 rustic + 2 modern + 1 boho)
- The centroid lands in a meaningless middle ground
- This is the exact failure mode PinnerSage was built to solve

**Implementation complexity:** Trivial. One `AVG()` in SQL.

**Verdict:** Use as the default fallback for <5 pins. It's better than nothing and, for very small boards, the user likely pinned a coherent set of images.

### Strategy B: Each Pin as Its Own Query Vector (No Clustering)

**How:** Treat each pin as an independent query. For each pin, retrieve the top-N most similar venue photos. Aggregate venue scores across all pin queries.

**Scoring:**
```
venue_score = SUM over pins of max_sim(pin_embedding, venue_photos)
```

Or with diminishing returns (to avoid over-counting venues that match multiple similar pins):
```
venue_score = SUM over pins of max_sim(pin_embedding, venue_photos) / sqrt(pin_count)
```

**When it works well:**
- 3-8 pins where each pin captures a distinct preference dimension
- Naturally handles diversity without clustering
- No clustering algorithm needed at all

**When it's worse than clustering:**
- When multiple pins represent the SAME taste (5 rustic barn photos). Each pin query retrieves similar venues, inflating rustic venue scores.
- Mitigated by diversity re-ranking (see Strategy C).

**Implementation complexity:** Moderate. Need to run N separate ANN queries (or one batched CROSS JOIN LATERAL query) and aggregate.

**Verdict:** This is the strongest default strategy for 3-8 pins. It preserves all information without trying to find patterns that don't exist in tiny samples.

### Strategy C: Individual Pin Queries + MMR Diversity Re-Ranking

**How:** Run Strategy B (each pin as a query), then apply Maximal Marginal Relevance (MMR) re-ranking to the combined results.

MMR iteratively selects venues that are relevant (high similarity to at least one pin) but diverse (dissimilar from already-selected venues):

```
MMR_score = lambda * relevance(venue) - (1 - lambda) * max_sim(venue, already_selected_venues)
```

Where lambda controls the relevance-diversity tradeoff (start with lambda=0.7).

**Why this matters for small boards:**
- If 5 of 8 pins are rustic barns, naive aggregation will surface 20 rustic barn venues
- MMR ensures the results also include venues matching the 3 non-rustic pins
- This implicitly gives minority taste dimensions more representation

**Practical note:** SMMR (Sampled MMR), proposed at SIGIR 2025, adds randomness to the selection process to improve the relevance-diversity tradeoff. For small result sets (20 venues), classical MMR is sufficient.

**Verdict:** Best approach for 5-10 pins. Handles the "most pins are similar" problem elegantly without needing clustering.

**Source:** [Qdrant -- Balancing Relevance and Diversity with MMR](https://qdrant.tech/blog/mmr-diversity-aware-reranking/), [SMMR at SIGIR 2025](https://dl.acm.org/doi/10.1145/3726302.3730250)

### Strategy D: Pre-Defined Style Archetypes

**How:** Define 8-12 wedding style archetypes (see taxonomy below). Pre-compute a prototype embedding for each archetype using CLIP zero-shot classification. Classify each pin into the nearest archetype. The user's taste profile becomes a weighted distribution over archetypes.

**Wedding Style Archetype Taxonomy (based on The Knot, wedding industry sources):**

1. **Classic/Traditional** -- Grand ballrooms, chandeliers, deep reds/golds, formal
2. **Modern/Minimalist** -- Clean lines, monochromatic (white/green/gold), sleek
3. **Rustic** -- Barns, wood, wildflowers, mason jars, natural materials
4. **Bohemian** -- Free-spirited, macrame, dried flowers, earthy tones, outdoor
5. **Romantic** -- Soft hues, delicate lighting, abundant flowers, pastel
6. **Industrial** -- Exposed brick, concrete, Edison bulbs, loft spaces
7. **Garden/Outdoor** -- Greenery, natural light, outdoor ceremony, tents
8. **Vintage** -- Antiques, typewriters, specific era inspiration (20s, 50s, Victorian)
9. **Coastal/Beach** -- Ocean, driftwood, nautical, light/airy
10. **Glamorous/Luxe** -- Crystal, metallic accents, dramatic florals, opulence

**CLIP zero-shot implementation:**
For each archetype, create text embeddings using CLIP's text encoder with prompts like:
- "a photo of a rustic barn wedding venue"
- "a photo of a modern minimalist wedding reception"
- "a photo of a bohemian outdoor wedding with macrame"

Then classify each pin by computing cosine similarity against all archetype text embeddings and assigning to the highest-scoring archetype.

**Archetype-based scoring:**
```
user_archetype_weights = {rustic: 0.5, bohemian: 0.3, garden: 0.2}  # from pin classification
venue_archetype_scores = classify_venue_photos(venue_photos)  # same process for venues
taste_match = dot_product(user_archetype_weights, venue_archetype_scores)
```

**Advantages for small boards:**
- Works with even 1 pin (every pin maps to an archetype)
- Provides interpretable labels ("Your taste is 50% rustic, 30% boho")
- Gracefully handles any board size
- Archetypes are pre-computed once -- no per-user clustering needed
- Enables UI: "We detected these styles in your pins. Is this right?"

**Disadvantages:**
- Lossy: reduces the rich 512d CLIP space to 10 categories
- May not capture subtle or niche aesthetics (e.g., "mid-century modern with a desert palette")
- Archetype boundaries are subjective

**Important insight from research:** A 2024 paper on "CLIP-Guided Clustering with Archetype-Based Similarity" (MDPI Electronics) demonstrates exactly this pattern -- computing similarity scores between images and predefined textual archetypes, then using these scores as low-dimensional semantic vectors for clustering. This validates using archetypes as a dimensionality reduction for CLIP embeddings.

**Verdict:** Use as a supplementary signal alongside vector-based matching. The archetype classification is cheap (just cosine similarity with pre-computed text embeddings) and provides both interpretability and a cold-start fallback. Don't replace the full vector pipeline with archetypes -- use both.

**Source:** [The Knot Wedding Themes](https://www.theknot.com/content/wedding-theme-ideas), [CLIP-Guided Clustering with Archetype-Based Similarity (MDPI)](https://www.mdpi.com/2079-9292/14/23/4571), [Pinecone -- Zero-shot Image Classification with CLIP](https://www.pinecone.io/learn/series/image-search/zero-shot-image-classification-clip/)

## 3. Augmenting Sparse Taste Profiles

### Using Pin Metadata as Supplementary Signal

Pinterest pins often carry metadata: titles, descriptions, board names, link URLs. Even when you only have 5 pin images, the text context can enrich the taste profile.

**Approach:**
1. Extract pin titles/descriptions via Pinterest API v5
2. Concatenate all text into one document
3. Use an LLM (Claude/GPT-4) to generate a style summary: "Based on these pin descriptions, this user appears to prefer [rustic outdoor weddings with natural greenery and string lights]"
4. Embed the summary with nomic-embed-text (or the dedicated text model)
5. Use the text embedding as a supplementary query vector in the matching pipeline

**Limitation:** Many pins have minimal or no text descriptions. Pinterest's API returns title and description fields, but they're frequently empty for saved images.

### Cross-Referencing Other Pinterest Boards

If the user grants broader Pinterest access (not just one board), other boards can reveal style preferences:

- **Home decor board** -- reveals aesthetic preferences (minimalist, rustic, eclectic)
- **Fashion board** -- reveals color palette and formality preferences
- **Travel board** -- reveals location/setting preferences (beach, mountains, urban)

**Approach:** Embed images from all boards, cluster the combined set, then weight clusters based on board relevance (wedding board pins get 3x weight vs. home decor).

**Privacy consideration:** Requesting access to all boards is a larger permission scope. Should be optional and positioned as "Want better recommendations? Connect more boards."

### LLM-Based Style Inference

Use a vision-language model (Claude 3.5 Sonnet, GPT-4V) to analyze the pin images directly and generate a style description.

**Prompt pattern:**
```
You are a wedding style expert. I'm going to show you [N] images from a user's Pinterest wedding board. Based on these images, describe:
1. The dominant wedding aesthetic (e.g., rustic, modern, bohemian)
2. Color palette preferences
3. Indoor vs outdoor preference
4. Formality level (casual to black-tie)
5. Key visual elements they're drawn to (e.g., string lights, greenery, exposed brick)

Be specific and confident. If images suggest multiple styles, list them in order of prominence.
```

**Research support:** A 2024 study on GPT-4V's aesthetic evaluation capabilities demonstrated that GPT-4V can perform Personalized Image Aesthetic Assessment (PIAA) -- understanding individual users' aesthetic tendencies from few-shot examples and predicting their preferences. This directly validates the approach for wedding style inference.

**How to use the LLM output:**
1. Embed the style description with the text embedding model
2. Use it as an additional query vector (with lower weight than image vectors)
3. Also use it for the archetype classification (parse "rustic" -> rustic archetype weight)
4. Display it to the user for validation: "We think you like [rustic outdoor venues with greenery]. Sound right?"

**Cost:** ~$0.01-0.05 per analysis (one VLM call per board). Worth it for the cold-start case.

**Source:** [GPT-4V Aesthetic Evaluation (arXiv)](https://arxiv.org/html/2403.03594v1)

### User Self-Selection as Fallback

When the Pinterest signal is too sparse (<5 pins), ask the user directly:

**UX pattern:** Show a visual grid of 8-10 wedding style exemplar images (one per archetype). Ask the user to select 2-3 that appeal to them. This takes 10 seconds and immediately gives you archetype weights.

**Implementation:** Pre-curate 3-5 exemplar images per archetype. Display as a "What's your vibe?" grid during onboarding. Map selections to archetype weights. Use these weights to bootstrap the recommendation before Pinterest data is available.

**This is exactly what Stitch Fix does.** Their Style Shuffle feature shows image pairs and collects thumbs up/thumbs down. Their finding: "Customers don't always characterize their own style correctly based on onboarding surveys, but Style Shuffle's simple thumbs up/thumbs down paradigm works better because it doesn't use words."

**Key insight:** Visual self-selection (pick images you like) is more reliable than verbal self-description (tell us your style) because users often don't know the vocabulary for their preferences.

**Source:** [Stitch Fix -- Capturing Style Preferences During Sign-Up](https://multithreaded.stitchfix.com/blog/2016/11/30/us-design-capture-style-preferences-during-sign-up/), [Stitch Fix Style Shuffle](https://qz.com/quartzy/1603872/how-stitch-fixs-style-shuffle-learns-your-style)

## 4. Cold Start in Production Recommendation Systems

### Pinterest: "Warmer for Less" (2025)

Pinterest published "Warmer for Less: A Cost-Efficient Strategy for Cold-Start Recommendations at Pinterest" (accepted to The Web Conference 2026), directly addressing how they handle items and users with sparse engagement data.

**Key techniques:**
1. **Residual connections for non-historical features** -- A skip connection allows content-based features (visual embeddings, text) to bypass the interaction-heavy parts of the model. This ensures cold items can still get scored based on their content, not just their (nonexistent) engagement history. Adds only ~5% to model parameters.

2. **Score Regularization (ScoreReg)** -- Uses Maximum Mean Discrepancy (MMD) loss to penalize the prediction gap between cold and warm items. Their analysis found cold-start positive items get predicted 8-14% lower scores than equivalent warm items. This technique closes that gap.

3. **Manifold Mixup** -- Creates synthetic training examples by interpolating between embeddings of cold and warm items. This teaches the model to generalize smoothly between the well-understood (warm) and poorly-understood (cold) regions of embedding space.

**Results:** +9.68% engagement on fresh content, +7.82% unique fresh content with engagement, +0.23% successful sessions for cold-start users.

**Relevance to our system:** We don't have a learned ranking model (we use cosine similarity directly), so the score regularization and manifold mixup aren't directly applicable. But the insight about residual connections is: when the behavioral signal (pin clustering) is weak, lean harder on the content signal (raw CLIP similarity). This maps to our Strategy B (individual pin queries without clustering).

**Source:** [Warmer for Less (arXiv)](https://arxiv.org/abs/2512.17277)

### Stitch Fix: Onboarding Quiz + Style Shuffle

Stitch Fix collects **90 data points** from a new user through an onboarding quiz before their first "Fix" (clothing shipment). This covers size, age, style preferences, budget, lifestyle, and fit preferences.

For ongoing learning, they use **Style Shuffle** -- a Tinder-like interface for clothing images where users swipe/tap to like or dislike items. This collects visual preference data without requiring a purchase.

**Stitch Fix's cold-start pipeline:**
1. **Quiz data** -> initial style profile (text-based features)
2. **Pinterest board** (optional) -> visual embedding of style references
3. **Style Shuffle** -> rapid visual preference collection
4. **Human stylist** -> re-ranks algorithmic suggestions with expert judgment
5. **First Fix feedback** -> strongest signal (what they kept vs. returned)

**Key takeaway:** Stitch Fix treats cold start as a **multi-signal problem**. No single data source is sufficient; they combine quiz (explicit), Pinterest (visual), Style Shuffle (behavioral), and human curation.

**Relevance:** For our system, the analog is: Pinterest board (visual) + conversational LLM interaction (explicit) + style archetype self-selection (explicit-visual).

**Source:** [Stitch Fix -- AI for Style Prediction](https://roundtable.datascience.salon/how-stitch-fix-uses-ai-to-predict-what-style-a-customer-will-love), [Stitch Fix -- Style Shuffle](https://qz.com/quartzy/1603872/how-stitch-fixs-style-shuffle-learns-your-style)

### Popularity-Based Fallbacks

When personalization is impossible (no data at all), every major recommendation system falls back to popularity:

- **Netflix:** "Trending Now" section for new users, personalized after 2-3 viewing sessions
- **Spotify:** Popular playlists + genre-based discovery for new accounts
- **Pinterest:** Most popular/trending pins in the user's interest categories

**For wedding venues:**
- Show "Most Popular Venues in [Region]" as the default
- Rank by a combination of: inquiry count, photo view count, number of reviews, recency
- Layer in basic filters (budget, guest count, location) even without taste data

**Important nuance:** Popularity-based recommendations are not random. They're the *best* recommendation you can make with zero personalization signal. They represent the prior distribution before any user-specific evidence.

**Source:** [TapeReal -- 6 Strategies to Solve Cold Start](https://web.tapereal.com/blog/6-strategies-to-solve-cold-start-problem-in-recommender-systems/), [Things Solver -- The Cold Start Problem](https://thingsolver.com/blog/the-cold-start-problem/)

### Multi-Armed Bandit for Cold Start

**Concept:** Instead of committing to one set of recommendations, treat the first few interactions as an exploration phase. Show a diverse set of venues (sampling from different style clusters) and observe which the user clicks/saves.

**Thompson Sampling** is the standard approach:
1. Maintain a belief distribution for each venue's match quality
2. Sample from each distribution
3. Recommend the venues with the highest samples
4. Update beliefs based on user interaction (click = positive, skip = negative)

**Practical concern:** For a wedding venue app, users may only visit 1-3 times before making a decision. The exploration window is tiny compared to Netflix/Spotify. A bandit approach may not converge before the user leaves.

**Modified approach for low-visit scenarios:** Rather than pure exploration, use a **warm-start bandit** that initializes beliefs from the (sparse) Pinterest signal. This means the first recommendations are already personalized (from pins), and the bandit refines from there. The Pinterest signal provides the prior; user interactions update the posterior.

**Source:** [Multi-Armed Bandit for Cold-Start Users (ACM)](https://dl.acm.org/doi/10.1145/3554819), [Epinet for Content Cold Start (arXiv)](https://arxiv.org/html/2412.04484v1)

## 5. Progressive Profiling

### The LLM Conversation as the Refinement Mechanism

In our system, the user converses with an LLM after seeing initial venue recommendations. This conversation IS the progressive profiling:

**Turn 1:** "Here are your top venue matches based on your Pinterest board."
**Turn 2 (user):** "I like these but I want outdoor only"
**Turn 3 (system):** Apply outdoor filter, re-rank remaining venues
**Turn 4 (user):** "That third one is too fancy. I want more casual."
**Turn 5 (system):** Down-weight glamorous/formal archetype, up-weight casual/rustic

**Each conversational turn refines the taste profile.** The LLM extracts structured preferences from natural language and translates them into filter adjustments and vector re-weighting.

### How to Merge Pinterest Signal with Conversational Preferences

**Layer 1: Static taste profile (from Pinterest)**
- Image embeddings or archetype weights
- Doesn't change during conversation
- Provides the visual baseline

**Layer 2: Explicit filters (from conversation)**
- Hard constraints: budget, guest count, location, indoor/outdoor
- Applied as SQL WHERE clauses
- Override taste profile (a rustic-lover won't see a $50K ballroom if budget is $15K)

**Layer 3: Soft preference adjustments (from conversation)**
- "More casual" -> reduce weight of formal/glamorous archetype
- "I love that garden one" -> boost weight of garden/outdoor cluster
- Applied as multipliers on the taste profile weights

**Merging formula:**
```
final_score = base_similarity(pins, venue) * preference_multiplier(conversation) * popularity_bonus(if sparse profile)
```

**Research support:** Pinterest's 2025 Multi-Embedding Retrieval Framework combines implicit interest models (behavioral, analogous to our Pinterest signal) with explicit interest models (stated, analogous to our conversation). Both contribute retrieval candidates that are merged and re-ranked. The key finding: combining both significantly outperforms either alone, across all user segments.

**Source:** [Pinterest Multi-Embedding Retrieval (arXiv 2025)](https://arxiv.org/html/2506.23060v1), [CRIF -- Conversational Recommendation with Implicit Feedback (ACM)](https://dl.acm.org/doi/10.1145/3477495.3531844)

### When Is the Profile "Good Enough"?

The profile is good enough to stop asking when:
1. **Diversity of results stabilizes** -- successive refinements don't significantly change the top-10 list
2. **User stops correcting** -- they browse without rejecting, indicating satisfaction
3. **Hard constraints are satisfied** -- budget, location, capacity are all specified
4. **At least 2-3 conversational turns** have occurred after initial results

**Quantitative heuristic:** If the overlap between the top-10 results from two successive scoring rounds is >80% (8+ venues in common), the profile is stable enough.

**UX principle:** Don't interrogate. The LLM should OFFER recommendations and let the user naturally refine. "Here are your top picks. Want to narrow by budget, location, or style?" -- not a 20-question quiz.

## 6. Graceful Degradation Thresholds

### Recommended Threshold Table

| Pin Count | Strategy | Cluster Count | Confidence Level |
|-----------|----------|---------------|------------------|
| 0 | Popularity-based + style quiz | N/A | None (no personalization) |
| 1-2 | Single query vector (centroid of 1-2 pins) + archetype classification | 1 | Very Low |
| 3-4 | Individual pin queries + MMR re-ranking + archetype weights | 1 (no clustering) | Low |
| 5-7 | Individual pin queries + MMR re-ranking; attempt k=2 with validation | 1-2 | Low-Medium |
| 8-15 | K-means k=2, validate with inter-cluster distance; fallback to 1 | 1-2 | Medium |
| 16-30 | K-means k=2-3, silhouette-validated | 2-3 | Medium-High |
| 30+ | Full pipeline: k=2-8, silhouette auto-detect | 2-5 | High |

### Decision Logic (Pseudocode)

```
def build_taste_profile(pin_embeddings):
    n = len(pin_embeddings)

    if n == 0:
        return PopularityProfile()

    if n <= 4:
        # No clustering -- each pin is a query vector
        archetype_weights = classify_archetypes(pin_embeddings)
        return IndividualPinProfile(
            pin_vectors=pin_embeddings,
            archetype_weights=archetype_weights,
            confidence="low",
            use_mmr_reranking=True
        )

    if n <= 7:
        # Try k=2, but validate
        centroid = mean(pin_embeddings)
        pairwise_sims = cosine_similarity_matrix(pin_embeddings)
        avg_pairwise_sim = mean(pairwise_sims)

        if avg_pairwise_sim > 0.80:
            # Pins are too similar -- one cluster is fine
            return SingleCentroidProfile(centroid, confidence="medium")

        # Try k=2
        labels = kmeans(pin_embeddings, k=2)
        cluster_centroids = compute_centroids(pin_embeddings, labels)
        inter_cluster_sim = cosine_sim(cluster_centroids[0], cluster_centroids[1])

        if inter_cluster_sim > 0.85:
            # Clusters are too similar -- meaningless split
            return SingleCentroidProfile(centroid, confidence="medium")

        if min(cluster_sizes(labels)) < 2:
            # One cluster has only 1 point -- not a real cluster
            return IndividualPinProfile(pin_embeddings, confidence="low-medium")

        return ClusteredProfile(clusters=2, confidence="low-medium")

    if n <= 15:
        # k=2 with silhouette validation, fallback to single centroid
        best_k, best_score = find_best_k(pin_embeddings, k_range=(2, min(4, n//3)))
        if best_score < 0.15:
            return SingleCentroidProfile(mean(pin_embeddings), confidence="medium")
        return ClusteredProfile(clusters=best_k, confidence="medium")

    # n > 15: full pipeline
    best_k, best_score = find_best_k(pin_embeddings, k_range=(2, min(8, n//4)))
    return ClusteredProfile(clusters=best_k, confidence="high")
```

### Communicating Uncertainty to the User

**Principle from UX research:** "Users can tolerate uncertainty, but cannot tolerate being calmly misled -- especially by interfaces that look authoritative."

**Tier 1 (0 pins / no Pinterest):**
> "We don't have your style preferences yet. Here are the most popular venues in [region]. Connect your Pinterest board or tell us what you're looking for to get personalized matches."

**Tier 2 (1-4 pins):**
> "Based on the few pins we found, you seem drawn to [archetype labels]. These recommendations are a starting point -- tell us more about what you love (or don't) to sharpen our picks."

**Tier 3 (5-15 pins):**
> "We've identified your taste leans toward [top 1-2 archetypes]. Here are your top matches. How are we doing?"

**Tier 4 (16+ pins):**
> "Your style profile shows [archetype breakdown with percentages]. We found [N] great matches."

### Should You Show a Confidence Score?

**No -- not as a number.** Users don't know what "73% confident" means for a taste profile. Instead:

- Use **language cues**: "starting point" vs. "strong matches" vs. "personalized picks"
- Use **visual completeness indicators**: a "profile strength" bar (like LinkedIn) that fills up as more signal is collected
- Use **progressive disclosure**: "Want even better matches? [Add more pins] [Tell us your style] [Take the style quiz]"

**The goal is to convert uncertainty into an action the user can take** (provide more signal), not just display a number.

**Source:** [UX Bulletin -- UX for Degradation](https://www.ux-bulletin.com/ux-for-degradation-graceful-failure-design/), [Springer -- Recommendation Uncertainty](https://link.springer.com/chapter/10.1007/978-3-031-26438-2_22)

## Recommended Architecture: The Tiered Pipeline

Based on all research, here is the recommended architecture for handling boards of any size:

### Always-On Layer: Archetype Classification
- Pre-compute 10 archetype prototype embeddings using CLIP zero-shot
- For every pin, compute cosine similarity against all 10 archetypes
- User's archetype weights = normalized average of per-pin archetype scores
- This works for ANY board size (even 1 pin) and provides interpretability
- Cost: negligible (10 cosine similarity computations per pin)

### Tiered Matching Strategy:

**Tier 0 (0 pins):** Popularity ranking + optional style quiz
- If user takes style quiz: map selections to archetype weights, use archetype-based matching

**Tier 1 (1-4 pins):** Individual Pin Queries
- Each pin is a separate query vector
- Retrieve top-20 venue photos per pin
- Aggregate venues by max-sim score across all pins
- Apply MMR re-ranking (lambda=0.7)
- Supplement with archetype-weighted ranking as tiebreaker

**Tier 2 (5-15 pins):** Validated Clustering or Individual Queries
- Attempt k-means (k=2)
- Validate: inter-cluster distance > threshold (cosine sim < 0.85) AND min cluster size >= 2
- If validation passes: use cluster centroids as query vectors (weighted by cluster size)
- If validation fails: fall back to Tier 1 (individual pin queries)

**Tier 3 (16+ pins):** Full Clustering Pipeline
- K-means with silhouette auto-detection (k=2 to min(8, n//4))
- Store both medoid and centroid per cluster
- Weighted MaxSim scoring (cluster size as importance weight)

### Always-On Enhancement: LLM Style Inference
- For ALL boards (especially <10 pins), optionally run a VLM call to generate a text style description
- Embed the description and use as a supplementary query vector (weight: 0.2)
- Display the inferred style to the user for validation
- Cost: ~$0.01-0.05 per user, run once at profile creation

### Conversation Layer (applies to all tiers):
- Explicit filters from conversation override taste-based ranking
- Soft preferences adjust archetype weights
- Each turn re-scores venues against the updated profile
- Profile stabilizes after 2-3 turns (>80% overlap in top-10)

## Open Questions

1. **Archetype prototype quality:** How well do CLIP text embeddings for "a photo of a rustic barn wedding venue" actually separate from "a photo of a bohemian outdoor wedding"? Need to empirically measure pairwise cosine similarity between archetype prototypes to verify they're distinguishable.

2. **Optimal MMR lambda:** The relevance-diversity tradeoff parameter (lambda=0.7 suggested) needs tuning. Too much diversity and the results feel random; too little and small-board users only see one style.

3. **VLM cost at scale:** At $0.01-0.05 per user for style inference, this is cheap for small boards but adds up at scale. Evaluate whether archetype classification (free, using CLIP) provides sufficient interpretability without the VLM call.

4. **Inter-cluster distance threshold:** The 0.85 cosine similarity threshold for "clusters too similar" is an educated guess. Need empirical validation on real wedding Pinterest boards.

5. **Pinterest API data quality:** How many pins actually have useful titles/descriptions? If most are empty, the text augmentation strategy (Section 3) has limited value.

6. **Style quiz conversion rate:** Will users actually complete a visual style quiz? What percentage of users will take it vs. skip it? This determines how much to invest in the quiz UX.

## Extracted Principles

- **Don't cluster small data -- query it directly.** With <10 data points, treat each point as its own query vector rather than trying to find cluster structure. Use MMR diversity re-ranking to handle the "most points are similar" problem.
- **Archetype classification is a free cold-start signal.** Pre-defined style prototypes (via CLIP zero-shot) work with even 1 image, provide interpretable labels, and cost nothing beyond initial setup. Layer them alongside vector matching, don't use them as a replacement.
- **Visual self-selection beats verbal self-description.** When asking users about their preferences, show images and let them pick -- don't ask them to describe their style in words. Stitch Fix validated this extensively.
- **Communicate uncertainty as an invitation, not a disclaimer.** Frame sparse profiles as "help us know you better" rather than "we don't have enough data." Convert uncertainty into actionable next steps.
- **Tiered degradation prevents both over-engineering and under-serving.** Define explicit pin-count thresholds that route users to appropriate strategies. The thresholds should be validated empirically but the tier structure should be designed upfront.
- **The conversation IS the progressive profiling.** In an LLM-powered recommendation system, each conversational turn refines the taste profile. Don't build a separate "profiling phase" -- embed it in the natural recommendation flow.

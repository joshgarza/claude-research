# Search, Analytics & Product Observability Principles

## Summary

Covers four interconnected product engineering domains: full-text search engine selection, event tracking architecture, A/B testing infrastructure, and business metrics/product observability. The unifying theme: route all four data streams (search events, product events, experiment assignments, infrastructure telemetry) into a single warehouse and use dbt to build coherent business KPIs from them.

## Principles

### Choose Search Engine by Dataset Size and Operational Tolerance

- **What:** Typesense for instant UX search with HA clustering and multi-tenant isolation (<24TB, self-hosted). Meilisearch for simplest single-node instant search (<80TB). Elasticsearch only for log analytics, petabyte-scale corpora, or complex aggregations. Never use Elasticsearch for front-facing user search — it's operationally heavy and over-engineered for that use case.
- **Why:** Typesense and Meilisearch deliver <50ms responses with zero config. Elasticsearch requires weeks of tuning for equivalent results. The operational overhead difference (hours vs weeks to production) is the primary selection criterion for most teams.
- **When:** Any feature requiring full-text search. Default to Typesense when you need self-hosted HA; Meilisearch when you want absolute simplicity and HA via managed cloud.
- **When NOT:** Don't use Typesense or Meilisearch for log analytics, security monitoring, or datasets requiring complex aggregation pipelines. Those are Elasticsearch use cases.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Typesense for Multi-Tenant Search Isolation

- **What:** Use Typesense scoped API keys for multi-tenant search. Generate per-tenant keys that filter by `tenant_id` within a shared collection. For compliance/performance isolation, provision separate Typesense instances per tenant.
- **Why:** Typesense is the only lightweight search engine with native multi-tenant key scoping. Meilisearch and older Elasticsearch versions require application-layer filtering, which is error-prone and security-sensitive.
- **When:** Any SaaS product where tenants must not see each other's search results.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Use Object-Action Naming for Event Taxonomy

- **What:** Name events as `[Noun] [Past-Tense Verb]` (e.g., `"User Signed Up"`, `"Checkout Completed"`, `"Feature Used"`). Name properties in `snake_case` (e.g., `plan_type`, `checkout_total_usd`). Capitalization is significant — enforce via linting.
- **Why:** Inconsistent naming creates duplicate data that's difficult to query and impossible to join across platforms. `"song_played"` and `"Song Played"` are separate events in every major analytics tool. A consistent taxonomy is the prerequisite for reliable funnels and cohort analysis.
- **When:** From day one. A tracking plan (living document) with event/property definitions and ownership should be established before any instrumentation is written.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Hybrid Event Tracking: Server-Side for Financial Events

- **What:** Use client-side tracking for UX events (clicks, page views, interactions) where rich context (UTMs, referrer, browser) is valuable. Use server-side tracking for all financial events, auth events, and backend milestones — these must be 100% reliable and tamper-proof.
- **Why:** Ad blockers and browser privacy restrictions can eliminate 15-40% of client-side events. Financial events tracked client-side can be spoofed. Server-side tracking is authoritative.
- **When:** Every product with payments, subscriptions, or security-sensitive events must have server-side tracking for those events regardless of what client-side tracking exists.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Feature Flags Are Deployment; A/B Tests Are Measurement

- **What:** Treat feature flags (LaunchDarkly, Unleash, Statsig, PostHog) as deployment infrastructure — they control who sees what code. Treat A/B tests as measurement infrastructure — they answer whether a variant improves outcomes. The two are layered: run an A/B test by assigning variants via feature flags, then measure results via analytics.
- **Why:** Conflating them leads to under-powered experiments (flags without measurement) or unsafe releases (tests that can't be rolled back). Separating the concerns makes each more useful: flags become instant rollback mechanisms; tests become rigorous statistical inquiries.
- **When:** Every feature flag powering an experiment needs: (1) consistent variant assignment (stickiness), (2) impression event fired to analytics, (3) defined primary metric and sample size calculated before launch.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Use CUPED + Sequential Testing for Faster Experiments

- **What:** Require CUPED (Controlled-experiment Using Pre-Existing Data) and sequential testing as baseline capabilities when selecting an experimentation platform. CUPED uses pre-experiment user behavior as a covariate to reduce metric variance; sequential testing allows valid interim reads without inflating false positive rates.
- **Why:** CUPED detects 30% smaller effects with the same sample size — equivalent to running experiments 2x faster. Traditional t-tests without sequential testing mean you cannot peek at results mid-experiment without accepting ~26% false positive rates at 5 peeks (vs 5% nominal). These are table-stakes features for any data-driven product team.
- **When:** Select Statsig for best-in-class implementation. Amplitude and Optimizely have CUPED. PostHog and Unleash experiments lack it — if using these, consider implementing CUPED manually via warehouse-layer covariate adjustment in dbt.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Warehouse as Single Source of Truth for Product Intelligence

- **What:** Export all four data streams — search query logs, product analytics events, experiment assignments, infrastructure metrics — to a single warehouse (BigQuery, Snowflake). Use dbt to build unified fact tables: `user_facts`, `revenue_facts`, `funnel_metrics`. Answer cross-domain questions from one place.
- **Why:** Without a unified warehouse, "did our search relevance improvement increase conversion?" requires manual joins across 3-4 separate tools with incompatible schemas. With it, one dbt model answers it. This is the pattern used by Netflix, Airbnb, Stripe, and every data-mature product company.
- **When:** Once you have more than one analytics data source. Even if you only have PostHog today, export events to BigQuery from day one so future joins are possible.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Business Metrics via OTel Custom Instruments

- **What:** Instrument business events (signups, purchases, feature activations) as OpenTelemetry counters and histograms alongside infrastructure metrics. Route to Mimir; visualize in Grafana next to infrastructure golden signals. Same OTel Collector pipeline, same dashboard tool, unified view.
- **Why:** Separating business dashboards from infrastructure dashboards means engineers don't see "our signup rate dropped 40% at the same time our p99 latency spiked" in one view. The correlation is the insight. OTel custom instruments are the cheapest way to add business context to engineering dashboards.
- **When:** Any production application where business outcomes are tied to system reliability. Start with 3-5 business counters (signups, purchases, errors-seen-by-users); expand as needed.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### PostHog as Default for Indie/SMB Product Teams

- **What:** Default to PostHog for product analytics, feature flags, session replay, and A/B testing as a unified stack for teams <100 engineers. Self-host on ClickHouse for full data ownership, or use PostHog Cloud. Switch to Amplitude when you need warehouse-native analytics with MTU pricing or enterprise behavioral analytics.
- **Why:** PostHog eliminates Segment (CDP), Mixpanel/Amplitude (analytics), LaunchDarkly (flags), and FullStory (session replay) from your vendor stack. Each replaced tool means one fewer vendor contract, one fewer integration, one fewer data silo. Cost savings are significant for pre-scale teams.
- **When NOT:** Large enterprises with Salesforce/HubSpot sync requirements, complex multi-touch attribution, or pre-existing Amplitude investments with advanced models — Segment + Amplitude is better there.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

### Compact Event Taxonomy Over Exhaustive Tracking

- **What:** Instrument 5-10 critical user journey moments initially. Expand deliberately as questions arise. Never instrument speculatively. Maximum taxonomy: ~50-100 events for most products.
- **Why:** Sprawling tracking plans (500+ events) become unmaintainable, expensive to store, and impossible to query reliably. Event quality degrades when engineers don't understand what they're tracking. The signal-to-noise ratio in analytics inversely correlates with event count.
- **When:** Greenfield instrumentation or analytics audit. Apply to existing products via an "event archaeology" audit — document what exists, kill what's never queried, keep only what drives decisions.
- **Source:** [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md)

## Revision History
- 2026-02-24: Initial extraction from [research/2026-02-24-search-analytics-product-observability.md](../research/2026-02-24-search-analytics-product-observability.md).

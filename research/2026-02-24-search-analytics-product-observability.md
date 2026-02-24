---
date: 2026-02-24
topic: Search, Analytics & Product Observability
status: complete
tags: [search, analytics, observability, a-b-testing, meilisearch, typesense, elasticsearch, posthog, feature-flags]
---

# Search, Analytics & Product Observability

## Context

Investigated to build a comprehensive reference for the four interconnected product engineering domains: full-text search engine selection (Meilisearch/Typesense vs Elasticsearch), event tracking architecture and product analytics tooling, A/B testing and feature flag infrastructure, and business metrics dashboards. These topics frequently come up together because they all serve the same goal: understanding what users do and iterating on it with evidence.

## Findings

### 1. Full-Text Search: Engine Selection Framework

#### Architecture Comparison

Four major options dominate the self-hostable search space:

**Typesense** (C++, 2015, open-source Apache-2.0)
- Entire index lives in RAM, with RocksDB as the storage layer
- Consistently delivers <50ms response times without tuning
- RAFT-based clustering for HA; Typesense Cloud for managed hosting
- Unique: NeuralSearch (CLIP image search, Whisper voice search, RAG Q&A), multi-tenant scoped API keys, collection swapping for A/B testing
- Privacy-first: does NOT collect any usage analytics in either self-hosted or SaaS mode
- Best for: instant search-as-you-type, datasets that fit in RAM (up to 24TB), privacy-sensitive deployments

**Meilisearch** (Rust, 2018, MIT license)
- Disk storage with memory-mapped files; recommends RAM ≈ dataset size for optimal performance
- v1.12 (2025): 2x faster document insertion, 4x faster incremental updates, 1.5x faster embedding generation
- Hybrid search (semantic + keyword) since v1.3; OpenAI and open-source embedder support
- Single-node only — **no HA clustering** for self-hosted (Meilisearch Cloud handles HA)
- Opt-out telemetry for infrastructure metrics
- Best for: developer-friendly instant search bars, small-to-medium datasets (<80TB), single-node simplicity

**Elasticsearch** (Java, 2010, SSPL)
- Petabyte-scale distributed search and analytics on disk with RAM caching
- Highest operational complexity: cluster management, JVM tuning, thousands of config parameters
- Unmatched for: log analytics, complex aggregations, geospatial queries, time-series analysis
- Part of the ELK/EFK stack; now also part of Elastic AI Platform
- Setup takes days/weeks vs hours for Typesense/Meilisearch
- Best for: enterprise log pipelines, SIEM, billion-document corpora, teams with dedicated search engineers

**Algolia** (proprietary SaaS, 2012)
- RAM-based, 128GB dataset limit, geo-distributed via Distributed Search Network
- Advanced search analytics built-in; 10,000 synonyms at premium tiers
- Cloud-only (no self-hosting option)
- Best for: when you need maximum reliability, SLA, and no operational burden — and have the budget

#### Feature Decision Matrix

| Feature | Typesense | Meilisearch | Elasticsearch | Algolia |
|---------|-----------|-------------|---------------|---------|
| Setup complexity | Very low | Very low | Very high | Zero |
| HA/Clustering | ✅ RAFT | ❌ (cloud only) | ✅ | ✅ |
| Vector search | ✅ NeuralSearch | ✅ (v1.3+) | ✅ | ✅ |
| Multi-tenant keys | ✅ | ❌ | ❌ | ✅ |
| Log analytics | ❌ | ❌ | ✅ | ❌ |
| Self-hosted pricing | Free | Free | Free (SSPL) | N/A |
| Max dataset | RAM-limited | ~80TB | Petabytes | 128GB |
| Privacy | No telemetry | Opt-out | Some telemetry | IP logged |

#### Decision Framework

```
Is your dataset >1TB? → Yes → Elasticsearch (or managed OpenSearch)
                      → No ↓
Do you need log analytics? → Yes → Elasticsearch
                           → No ↓
Do you need HA self-hosted? → Yes → Typesense (RAFT built-in)
                             → No ↓
Do you need multi-tenant isolation? → Yes → Typesense (scoped API keys)
                                    → No ↓
Do you need vector/semantic search? → Yes → Typesense or Meilisearch (≥v1.3)
                                    → No ↓
Default choice: Meilisearch (simpler) or Typesense (faster, more features)
```

#### Multi-Tenant Search Architecture

Typesense supports two patterns for multi-tenancy:
1. **Shared collection**: Store all tenant data in one collection; generate tenant-scoped API keys that filter by `tenant_id`. Single index, ACLs in Typesense. Lower operational overhead.
2. **Isolated clusters**: Each tenant gets a separate Typesense instance. Maximum isolation for compliance/performance, but higher operational cost.

Typesense recommends isolated clusters when tenants have strict compliance requirements or dramatically different data volumes.

Sources: [Typesense comparison page](https://typesense.org/typesense-vs-algolia-vs-elasticsearch-vs-meilisearch/), [Meilisearch comparison docs](https://www.meilisearch.com/docs/learn/resources/comparison_to_alternatives), [Meilisearch vs Elasticsearch](https://www.meilisearch.com/blog/elasticsearch-vs-typesense)

---

### 2. Event Tracking Architecture

#### The Event-Based Standard

The industry has converged on event-based data architecture. Google (GA4) and Adobe (CJA/AEP) have both migrated to event-based models. Every major analytics vendor — Amplitude, Mixpanel, PostHog, Statsig — uses the same underlying pattern: structured events with properties, users, and timestamps.

#### Event Taxonomy Design

**Naming conventions (Amplitude's standard):**
- Events: `[Noun] [Past-Tense Verb]` format — e.g., `"Song Played"`, `"Checkout Completed"`, `"Form Submitted"`
- Properties: `snake_case` — e.g., `song_title`, `checkout_total_usd`, `form_name`
- Capitalization consistency is critical: `"Song Played"` and `"song played"` are different events

**The 3-column tracking plan schema:**
| Event Name | Properties | Trigger |
|------------|-----------|---------|
| `User Signed Up` | `signup_method`, `plan_type`, `referrer` | POST /auth/register success |
| `Feature Used` | `feature_name`, `session_duration_ms` | User opens feature |
| `Purchase Completed` | `product_id`, `amount_usd`, `payment_method` | Stripe webhook received |

**Governance rules:**
- Keep taxonomy compact: 50-100 events max for most products; more creates unmaintainable sprawl
- Assign ownership: product manager owns the tracking plan, engineers implement it
- Treat tracking code like production code: unit tests, CI/CD validation, separate dev/prod environments
- Consolidate similar actions into single events with distinguishing properties (not 5 separate events)

#### Client-Side vs Server-Side Tracking

**Client-side advantages:**
- Rich context: UTM parameters, referrer, browser fingerprint, scroll depth, rage clicks
- Session replay integration

**Client-side limitations:**
- Ad blockers and browser privacy restrictions reduce coverage (can lose 15-40% of events)
- Users can tamper with event data

**Server-side advantages:**
- 100% reliability for mission-critical events (billing, auth, errors)
- No ad blocker interference
- Authoritative data (can't be spoofed)

**Server-side limitations:**
- Less contextual data (no UTM params, no browser metadata without explicit forwarding)

**Best practice:** Hybrid model. Client-side for UX events (clicks, page views, interactions). Server-side for financial events, auth events, backend milestones.

#### Product Analytics Pipeline Architecture

Modern event tracking pipelines follow this topology:

```
Client SDKs (web/mobile)                    Server SDKs
        ↓                                        ↓
[Analytics Ingestion Layer]  ←── (PostHog/Amplitude/Mixpanel ingestion APIs)
        ↓
[Storage: ClickHouse (PostHog) / proprietary (Amplitude/Mixpanel)]
        ↓
[In-product analysis: funnels, retention, cohorts, session replay]
        ↓
[Warehouse Export: BigQuery / Snowflake / Redshift / S3]
        ↓
[dbt transformation models]
        ↓
[Business KPI tables: user_facts, revenue_facts, acquisition_facts]
```

#### Tool Selection: PostHog vs Amplitude vs Mixpanel

**PostHog** (open-source, ClickHouse backend)
- Self-hosted or cloud; ClickHouse + Kafka for ingestion; scales to ~100K events/month self-hosted before recommending cloud
- All-in-one: analytics + session replay + feature flags + experiments + error tracking + LLM analytics + surveys
- Data warehouse: SQL-queryable, warehouse exports (BigQuery, Snowflake, Redshift, S3)
- Identity resolution: simpler than Segment; cross-device requires manual configuration
- Pricing: transparent, per-feature pricing; generous free tier
- Best for: engineering-led product teams, privacy-conscious deployments, "everything in one place"

**Amplitude** (warehouse-native, enterprise)
- MTU-based pricing (Monthly Tracked Users, counted once regardless of event volume)
- Deep behavioral analytics; warehouse-native queries against Snowflake/BigQuery
- AI-powered natural language querying; cohort analysis; behavioral prediction
- Now includes session replay, heatmaps, A/B testing, feature flags
- Best for: enterprise teams, complex funnel analysis, B2B account-level analytics

**Mixpanel** (polished, PM-focused)
- Relaunched experimentation + feature flags in late 2025
- AI-powered querying; point-and-click report builders
- Group analytics for B2B; session replay
- Less engineering overhead than PostHog; more accessible to non-technical PMs
- Best for: product manager-driven orgs that don't want to write SQL

**Segment** (CDP layer, not analytics)
- Customer Data Platform — routes events to 700+ destinations
- Not an analytics tool itself; sits in front of analytics tools
- Best identity resolution across platforms; 700+ integrations
- PostHog can replace Segment for most mid-market teams; Segment is better for very large orgs with many destinations

Sources: [PostHog vs Amplitude](https://posthog.com/blog/posthog-vs-amplitude), [Amplitude taxonomy guide](https://amplitude.com/docs/data/data-planning-playbook), [Amplitude tracking best practices](https://amplitude.com/blog/analytics-tracking-practices), [PostHog pipeline guide](https://bix-tech.com/posthog-in-practice-how-to-build-data-pipelines-and-unlock-user-behavior-analytics/)

---

### 3. A/B Testing Infrastructure

#### Feature Flags vs A/B Tests: The Distinction

These are complementary but serve different purposes:

| | Feature Flags | A/B Tests |
|--|---|--|
| **Purpose** | Deployment control | Behavioral measurement |
| **Goal** | Safe release, rollback | Which variant drives better outcomes |
| **Audience** | Engineering teams | Product + data teams |
| **Output** | Feature is on/off | Statistical significance, lift |
| **Duration** | Ongoing (can be permanent) | Time-bounded experiments |

Feature flags are the mechanism; A/B tests are the measurement layer on top of them.

#### Architecture

**Three-layer clean architecture:**
1. **Core Layer**: Business logic, flag evaluation interfaces, metric definitions
2. **Infrastructure Layer**: Flag storage (Redis/database), evaluation SDK, analytics integration
3. **API Layer**: Flag management endpoints, experiment configuration, results reporting

**Flag evaluation flow:**
```
User request → SDK checks flag config → Hash(userId + flagKey) → Bucket assignment
→ Variant returned → Impression event fired → Analytics receives (userId, flag, variant, timestamp)
```

**Stickiness:** Consistent experience across sessions via `hash(sessionId + flagKey) % 100`. Users always get the same variant — critical for preventing contamination.

#### Stats Engine: What Separates Good from Bad Platforms

**CUPED (Controlled-experiment Using Pre-Existing Data)** — Microsoft Research, 2013:
- Uses historical user behavior (before the test) as a covariate to reduce metric variance
- Result: Detect 30% smaller effects with the same sample size, or reach significance 2x faster
- Adopted by Netflix, Booking.com, BBC, Nubank, Statsig
- CUPAC (2025 extension): Uses ML-predicted covariates instead of raw historical data — further reduces variance

**Sequential testing:**
- Allows "peeking" at results during the test without inflating false positive rates
- Traditional t-tests: can't look at results early — doing so inflates Type I error rate to ~26% at 5 peeks
- Sequential testing: uses valid confidence intervals at any point in time
- Critical for fast-moving product teams that can't wait for fixed-horizon sample sizes

**Multi-arm bandit:**
- Dynamically reallocates traffic to better-performing variants during the test
- Epsilon-greedy or Thompson sampling algorithms
- Tradeoff: less statistical certainty, but better average user experience during the test

#### Tool Landscape

**Statsig** (recommended for most teams)
- Free feature flags at any scale, no usage limits
- Best-in-class stats engine: CUPED, sequential testing, stratified sampling, switchbacks
- Processes 1+ trillion events/day; <1ms post-init evaluation latency; 99.99% uptime
- Combines A/B testing + feature flags + product analytics in one platform
- 2.5 billion unique monthly experiment subjects

**LaunchDarkly** (enterprise governance)
- SaaS-only, usage-based pricing (can become expensive at scale)
- Strongest enterprise governance, audit trails, compliance features
- Experimentation is less sophisticated than Statsig
- Best for: large enterprises where compliance > cost

**Unleash** (open-source self-hosted)
- Open-source, on-prem or cloud deployment options
- Activation strategies + variants for A/B testing; impression data forwarded to external analytics
- Multi-arm bandit support (epsilon-greedy/Thompson sampling)
- Stickiness via sessionId/userId hashing
- Best for: privacy-sensitive deployments, teams that want full data ownership

**PostHog** (integrated with analytics)
- Experiments tab within PostHog; flags automatically linked to events
- Good enough for most product experiments; not as statistically sophisticated as Statsig
- Best if you're already using PostHog for analytics

#### Implementation Pattern

```typescript
// Flag evaluation + impression tracking
const variant = await client.getVariant('checkout-cta-experiment', {
  userId: user.id,
  properties: { plan: user.plan, country: user.country }
});

// Track the impression
analytics.track('Experiment Viewed', {
  experiment_key: 'checkout-cta-experiment',
  variant: variant.name,
  user_id: user.id,
});

// Render based on variant
if (variant.name === 'new-cta') {
  return <PrimaryButton>Start Free Trial</PrimaryButton>;
} else {
  return <PrimaryButton>Get Started</PrimaryButton>;
}
```

Sources: [Unleash A/B testing guide](https://docs.getunleash.io/guides/a-b-testing), [Statsig CUPED explainer](https://www.statsig.com/blog/cuped), [Harness feature flags and A/B testing](https://www.harness.io/blog/a-b-testing-for-feature-flags-what-it-is-and-what-it-shouldnt-be)

---

### 4. Business Metrics Dashboards & Product Observability

#### Two Domains: Infrastructure Observability vs Product Observability

**Infrastructure observability** (already in `principles/devops-infrastructure.md`):
- Four pillars: metrics, logs, traces, profiles
- LGTM stack: Loki + Grafana + Tempo + Mimir
- OTel as unified collection layer

**Product observability** (new territory):
- Links engineering metrics to business outcomes
- Goes beyond "is the service up?" to "are users converting?"
- 65% of orgs say their observability practice positively impacts revenue (Grafana 2025 Survey)

#### LGTM Stack Deep Dive

The Grafana 2025 Observability Survey (N=3,000+) found:
- 71% of organizations use Prometheus and OpenTelemetry
- Average: 8 observability technologies per org, 101 different tools cited
- Top challenge: complexity/overhead (39%), alert noise (38%), cost (37%)
- Observability spend: average 17% of infrastructure costs (target: 5-10% with intelligent sampling)

**Stack components and roles:**
```
OpenTelemetry Collector (central router)
    ↓                   ↓                   ↓
  Loki (logs)     Tempo (traces)      Mimir (metrics)
        ↓               ↓                   ↓
              Grafana (dashboards + correlation)
```

**Key architectural insight:** Tempo auto-generates RED metrics (Rate, Error, Duration) from traces and pushes them to Mimir. This means service health dashboards build themselves from trace data — no manual metric instrumentation required for service-level signals.

**Cross-signal correlation** (Grafana's key differentiator):
- Metric exemplars link to traces (click a spike → see the traces that caused it)
- Trace-to-logs navigation (click a span → see logs from that time window and host)
- Service graphs from Tempo's metrics generator

**Self-hosted production setup:**
- Development/small scale: Docker Compose, local filesystem storage
- Production: Kubernetes + Helm, object storage backends (S3/GCS), microservices mode for independent scaling of read/write paths
- OTel Collector as DaemonSet on each K8s node + separate gateway Collector

#### Golden Signals Dashboard Layout

From the Google SRE book — the four signals that define service health:

```
Row 1: Golden Signals
  [Request Rate (rpm)] [Error Rate (%)] [p99 Latency (ms)] [Saturation (%)]

Row 2: SLO Status
  [Availability SLO: 99.9%] [Latency SLO: <500ms] [Error Budget Remaining: 78%]

Row 3: Dependencies
  [Database p99] [External API Error Rate] [Queue Depth]
```

**OTel custom instruments for business metrics:**
```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('business-metrics');

// Counter for business events
const signupsCounter = meter.createCounter('app.signups', {
  description: 'Number of user signups',
});

// Histogram for business value metrics
const orderValueHistogram = meter.createHistogram('app.order.value', {
  description: 'Order value in USD',
  unit: 'USD',
});

// Usage
signupsCounter.add(1, { plan: 'pro', source: 'organic' });
orderValueHistogram.record(49.99, { product_category: 'saas' });
```

These flow into Mimir and appear in Grafana alongside infrastructure metrics, unifying the technical and business views.

#### Product Observability: Bridging Analytics and Engineering

The modern "warehouse-native" pattern:

```
PostHog Events (raw)
      ↓
BigQuery/Snowflake (warehouse export)
      ↓
dbt models:
  - events_clean (typed, flat)
  - user_facts (lifecycle, segmentation, LTV)
  - revenue_facts (joined with billing data)
  - funnel_metrics (step-by-step conversion)
      ↓
Grafana / Metabase / Hex (business dashboards)
      ↓
Same dashboards as infra observability
```

This architecture enables engineers and PMs to answer questions like "did this deploy break conversion rates?" — because product analytics data lives in the same warehouse as infrastructure telemetry.

**Data observability tools** (monitoring warehouse data quality):
- Monte Carlo: anomaly detection on warehouse tables, lineage tracking
- Metaplane: data quality monitors, alerting on schema changes
- dbt tests: column-level assertions built into the transformation layer

#### Key Numbers from Grafana 2025 Survey

- 47% reduction in incident response times with "actionable observability" (closing loop between telemetry and remediation)
- 32% improvement in developer productivity metrics with same
- 74% cite cost as top priority for tool selection
- 50% investigating SLOs, 51% investigating unified full-stack observability, 47% investigating LLM observability
- Those using "only" or "mostly" commercial licenses doubled from 10% (2024) to 24% (2025)

Sources: [Grafana Observability Survey 2025](https://grafana.com/observability-survey/2025/), [LGTM + OpenTelemetry guide](https://oneuptime.com/blog/post/2026-02-06-lgtm-stack-opentelemetry/view), [OTel metrics concepts](https://opentelemetry.io/docs/concepts/signals/metrics/)

---

### Cross-Cutting: The Unified Data Strategy

The highest-leverage architectural insight across all four domains is the **warehouse as single source of truth**:

1. **Search events** from Typesense/Meilisearch query logs → warehouse → understand what users search for and fail to find
2. **Product analytics events** from PostHog → warehouse → understand behavior
3. **Experiment assignments** from Statsig/Unleash → warehouse → measure experiment outcomes
4. **Infrastructure metrics** from OTel/LGTM → warehouse (optional, via Grafana data sources) → understand system context

dbt sits in the middle, joining all four sources into coherent business KPIs. This makes "did our search relevance improvement increase conversion?" answerable by a data team without needing custom joins across three separate tools.

## Open Questions

1. **Typesense vs Meilisearch maturity for production:** Typesense has built-in HA clustering; Meilisearch requires Meilisearch Cloud for HA. Does the operational simplicity of Meilisearch's single-node mode outweigh the lack of self-hosted HA for most teams?

2. **PostHog self-hosted scale limits:** The "100K events/month" recommendation before moving to cloud seems conservative — is ClickHouse's actual self-hosted ceiling higher with proper hardware? Worth testing at 1M events/month.

3. **CUPED adoption in open-source tools:** Statsig and Amplitude have CUPED built-in. Unleash and PostHog experiments lack it. Is implementing CUPED manually in a warehouse-native way (pre-compute the covariate in dbt, apply correction manually) practical?

4. **LLM observability gap:** 47% of teams are investigating LLM observability (Grafana 2025). This space is rapidly evolving — PostHog has an LLM analytics module, OTel is adding GenAI semantic conventions. Worth dedicated research.

5. **Search-as-a-service vs self-hosted economics:** When does Typesense Cloud or Meilisearch Cloud become cheaper than managing your own instance? Break-even is probably around $200-500/month in engineering time saved.

## Extracted Principles

Principles extracted to: `principles/search-analytics-observability.md` (new file created)

Key principles:
- Search engine selection by dataset size, HA needs, and operational tolerance
- Typesense for instant search with multi-tenant isolation; Meilisearch for simplest single-node; Elasticsearch for log analytics only
- Event taxonomy: Noun+Past-Tense Verb, snake_case properties, tracking plan ownership
- Hybrid client+server tracking; server-side for financial events
- Feature flags are the mechanism; A/B tests are the measurement layer
- CUPED + sequential testing for faster, more sensitive experiments
- Warehouse as single source of truth linking search, analytics, experiments, and infrastructure
- Business metrics via OTel custom instruments alongside infrastructure metrics in same Grafana instance

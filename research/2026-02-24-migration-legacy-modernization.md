---
date: 2026-02-24
topic: Migration & Legacy Modernization
status: complete
tags: [migration, strangler-fig, modernization, data-migration]
---

# Migration & Legacy Modernization

## Context

Investigated because legacy modernization is one of the highest-stakes engineering challenges organizations face — a failed $500M transformation project or a week-long airline outage from a botched migration represents existential risk. This research covers the Strangler Fig pattern (the dominant incremental modernization approach), techniques for running old and new systems in parallel, data migration at scale, and frameworks for tracking feature parity without falling into the "feature parity trap."

---

## Findings

### 1. Big Bang Rewrites vs. Incremental Modernization

The fundamental decision in any legacy modernization is whether to do a "big bang" full rewrite or an incremental migration. The evidence strongly favors incremental for non-trivial systems.

**Big Bang rewrite risks:**
- Multi-year timelines mean requirements are stale by launch
- Hidden dependencies are only discovered at cutover
- No business value delivered during the transition period
- Any single module's slippage can derail the entire go-live
- Famous failures: $500M transformation projects abandoned after 3 years; airline migrations that grounded flights for a week

**When Big Bang might make sense:**
- Very small, simple systems where full rewrite is faster than maintaining two parallel systems
- Systems with no live users during the transition (batch-only, internal tools)
- Clear, well-specified technical systems (rare)

**The incremental alternative:** The Strangler Fig pattern (and related displacement patterns) allow replacing legacy components one piece at a time while keeping the existing system fully operational. The cost is maintaining dual systems during the transition; the benefit is continuous business value delivery and the ability to stop at any point.

*Sources: [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html), [Kai Waehner on Strangler Fig + Kafka](https://www.kai-waehner.de/blog/2025/03/27/replacing-legacy-systems-one-step-at-a-time-with-data-streaming-the-strangler-fig-approach/)*

---

### 2. The Strangler Fig Pattern

Named by Martin Fowler after the strangler fig tree that gradually envelops and replaces its host tree. The pattern wraps a new system around the legacy system, incrementally routing traffic to new components until the legacy can be decommissioned.

**Core implementation steps:**

1. **Identify seams and boundaries** — Use Event Storming and Domain-Driven Design to find natural domain boundaries in the legacy system. A "seam" is a place where you can alter behavior without editing existing code. Pivotal events in an event storm often mark bounded context boundaries.

2. **Define thin slices** — Break the system into independently replaceable pieces. Slices should be small enough to be replaced incrementally but significant enough to deliver business value. Prioritize: high business value + low coupling to start.

3. **Install the proxy/routing layer** — Deploy an API Gateway (AWS API Gateway, Kong, Traefik, or a custom reverse proxy) between clients and the legacy system. Initially routes 100% of traffic to legacy. This layer is the control plane for the entire migration.

4. **Build the Anti-Corruption Layer (ACL)** — When new microservices need to communicate with the legacy system, create adapter facades that translate between legacy domain models and new domain models. Composed of Facade + Adapter + Translator patterns. Prevents legacy concepts from leaking into the new architecture.

5. **Develop and route incrementally** — Implement new functionality as services. Route the relevant URL paths/events to the new service. New features go directly to new services; bug fixes continue in the legacy for stability during transition.

6. **Handle data synchronization** — The hardest part. New services own their own data stores; legacy owns the shared DB. During transition, use event queues to keep both in sync (see section 5 below).

7. **Decommission** — Once all slices are migrated, remove the ACL, redirect remaining traffic, and decommission the legacy.

**AWS architecture pattern:**
```
Initial:         [API GW] → [Monolith (EC2 + RDS)]

During:          [API GW] → /users  → [User Svc (Lambda + DynamoDB)]
                          → /cart   → [Cart Svc (Lambda + ElastiCache)]
                          → /other  → [Monolith (EC2 + RDS)]

Final:           [API GW] → [User Svc] [Cart Svc] [Account Svc] [Static (S3)]
```

**Key pitfalls:**

- **Adapter hell**: Every incremental change requires routing adapters that accumulate. Actively decommission adapters once the slice is fully migrated.
- **Perpetual hybrid**: Teams that lose momentum end up maintaining two systems indefinitely. Set explicit decommission deadlines for each migrated slice.
- **Proxy becomes a bottleneck**: The API Gateway must be production-grade (serverless, Multi-AZ, auto-scaling). A flimsy proxy negates the risk reduction of the pattern.
- **Data consistency nightmares**: Different parts of the system owning different pieces of data during transition. Plan this explicitly before starting migration.
- **Residual technical debt**: Legacy debt transfers to new system unless consciously addressed. Don't just transliterate bad patterns into new code.

*Sources: [Thoughtworks - Strangler Fig Part 1](https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one), [Martin Fowler - Strangler Fig bliki](https://martinfowler.com/bliki/StranglerFigApplication.html), [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html)*

---

### 3. Patterns of Legacy Displacement (Beyond Basic Strangler Fig)

Martin Fowler's team at Thoughtworks documented a richer vocabulary of displacement patterns. Each addresses a specific challenge in modernization:

**Event Interception** — New system intercepts events that the legacy system publishes, processing them in parallel or instead of the legacy. Allows the new system to consume real data without the legacy knowing. The Event Interceptor conforms to the legacy interface.

**Legacy Mimic** — New system presents the same interface as the legacy to upstream callers. Allows upstream systems to continue unmodified while the implementation underneath is replaced. Useful when you can't change all callers.

**Transitional Architecture** — Temporary infrastructure elements (dual-write agents, synchronization adapters) that exist only to enable safe cutover. Plan their retirement date as part of the design.

**Divert the Flow** — Redirect activities (users, processes, data flows) away from legacy one piece at a time. Similar to canary deployment applied at the feature level.

**Critical Aggregator** — When you need to consolidate data from both legacy and modern systems during the transition period, build an aggregation layer that queries both and merges the results.

**Leave-and-Layer** (AWS pattern) — Leave the legacy system completely untouched. Layer new event-driven capabilities on top using an event bus (Amazon EventBridge). New features capture events from the legacy system's outputs and process them independently. Ideal when: you don't have access to legacy code, the legacy is a COTS product, or you need to deliver quickly with minimal risk.

*Sources: [Martin Fowler - Patterns of Legacy Displacement](https://martinfowler.com/articles/patterns-legacy-displacement/), [AWS - Leave-and-Layer Pattern](https://aws.amazon.com/blogs/migration-and-modernization/modernizing-legacy-applications-with-event-driven-architecture-the-leave-and-layer-pattern/)*

---

### 4. Running Old and New Systems in Parallel: Shadow Mode and Dark Launch

Parallel running is the practice of executing both old and new systems against the same requests, comparing outputs before switching the authoritative source.

**The six-stage migration flag pattern** (from LaunchDarkly):

| Stage | Reads From | Writes To | Purpose |
|-------|-----------|-----------|---------|
| `off` | Old | Old | Baseline, no new system involved |
| `dualwrite` | Old | Old + New | Populate new system without risking reads |
| `shadow` | Old (authoritative) | Old + New | Compare outputs, validate correctness |
| `live` | New (authoritative) | Old + New | Switchover, can still fall back |
| `rampdown` | New | New only | Stop writing to old |
| `complete` | New | New | Full cutover, old decommissioned |

**Shadow mode specifically:** The new system receives the same requests as the old, processes them independently, but its outputs are discarded. Only the old system's results are returned to users. This enables:
- Load testing under real production traffic
- Correctness validation (compare old vs. new outputs at scale)
- Discovery of edge cases not covered by test suites
- Performance benchmarking under realistic conditions

**Dark launch**: Deploy new feature to production, route real traffic through it, suppress the output. Users see nothing; you get production-grade validation.

**Canary vs. Shadow:**
- Canary: Routes a percentage of *real users* to the new system (they see results)
- Shadow: Routes *all* traffic to new system but suppresses output (users don't see it)
- Use shadow before canary — validate correctness before exposing to any users

**Feature flags for migration control:** Use granular feature flags to control which users/percentage hit which stage. This enables instant rollback at any stage without a deployment. LaunchDarkly's migration flag pattern is the reference implementation.

*Sources: [LaunchDarkly - Migration Flags Guide](https://launchdarkly.com/docs/guides/flags/migrations), [LaunchDarkly - Database Migration with Feature Flags](https://launchdarkly.com/blog/database-migration-using-launchdarkly/), [Dycora - Shadow Mode Testing](https://www.dycora.com/deployment-and-shadow-mode-testing-validating-a-new-model-on-live-traffic-without-user-impact/)*

---

### 5. Data Migration at Scale

Data migration is typically the most dangerous part of any modernization. Schema mismatches, data quality issues, and volume mean it warrants its own discipline.

#### Change Data Capture (CDC)

CDC continuously captures row-level changes from a source database and streams them to the target. Unlike bulk extract-load, CDC enables near-zero-downtime transitions.

Tools: Debezium (open source, Kafka-native), AWS DMS, Fivetran, Airbyte, Streamkap.

CDC enables the `dualwrite` → `shadow` → `live` pattern by keeping both DBs in sync throughout the transition. Once the new DB is caught up, the cutover window is seconds, not hours.

#### Data Streaming for Legacy Decoupling (Kafka + Flink)

For systems with complex data flows, Apache Kafka + Flink provides a powerful backbone for the strangler fig pattern:
- **Producers** (legacy apps) publish events to Kafka topics — no awareness of consumers
- **Consumers** (modern apps) process events independently — no awareness of source
- **Flink** enables real-time preprocessing and transformation of legacy data formats into modern domain events

Allianz implemented this pattern to migrate 75%+ of applications to cloud while maintaining business continuity. The Core Insurance Service Layer (CISL) used Kafka to decouple applications during multi-year migration.

#### Batched Backfill for Large Datasets

For migrations requiring bulk data movement (millions+ rows):
- Process in batches of 1,000–10,000 rows with `pg_sleep` between batches
- Monitor replication lag; pause if replicas fall behind
- Use `CREATE INDEX CONCURRENTLY` for index creation (never blocking)
- Ghost table pattern for column type changes: new table + triggers + backfill + atomic rename (pt-online-schema-change, gh-ost)

A single `UPDATE` on millions of rows locks the table, overwhelms the transaction log, stalls replicas. Batching keeps the DB responsive throughout.

#### Data Validation Framework

- **Pre-migration audit**: Automated profiling to identify duplicates, nulls, data quality issues, orphaned records
- **Data mapping documentation**: For every source field, document: target field, transformation rules, data type changes
- **Automated reconciliation**: Record count checks, referential integrity checks, field-level value comparison at each stage
- **Tolerance rules**: Account for expected differences (audit timestamps, generated keys, computed fields)
- **Rollback plan**: Complete backup before migration starts. Define specific rollback triggers and approval protocols. Test rollback, not just forward migration.

#### Expand/Contract for Schema Migrations

The database-level application of the parallel systems principle:

1. **Expand**: Add new column/table alongside old. Both old and new application can run.
2. **Dual-write**: New app writes to both old and new schema. Old app writes only to old.
3. **Backfill**: Migrate existing data from old column to new out-of-band.
4. **Migrate reads**: Switch application reads to new schema.
5. **Contract**: Remove old schema once all consumers have switched.

Each stage is independently deployable and backwards-compatible with the previous. pgroll (from Xata) automates this pattern by maintaining two virtual schemas simultaneously via views.

*Sources: [Streamkap - Data Migration Best Practices](https://streamkap.com/resources-and-guides/data-migration-best-practices), [Pete Hodgson - Expand/Contract](https://blog.thepete.net/blog/2023/12/05/expand/contract-making-a-breaking-change-without-a-big-bang/), [Kai Waehner - Strangler Fig + Kafka](https://www.kai-waehner.de/blog/2025/03/27/replacing-legacy-systems-one-step-at-a-time-with-data-streaming-the-strangler-fig-approach/)*

---

### 6. The Feature Parity Trap

"Feature parity" — replicating all existing legacy functionality in the new system — sounds sensible but is usually a costly mistake. Martin Fowler's team at Thoughtworks devotes significant analysis to this.

**Why feature parity fails:**
- Legacy systems accumulate unused features over time. A 2014 Standish Group report found approximately 50% of legacy features are unused.
- Workarounds for past bugs become embedded in business processes. Current workflows reflect technological constraints, not optimal practices.
- Rebuilding these features as-is perpetuates inefficiencies.
- Scope explodes, timelines lengthen, corners get cut, and the business pays for minimal improvement.

**The feature parity trap cycle:**
1. Decide to rewrite with full parity
2. Discover the scope is enormous
3. Cut corners under schedule pressure
4. Deliver a system that replicates legacy bugs and inefficiencies in new technology

**Narrow exceptions where parity applies:**
- Highly optimized power-user interfaces with keyboard shortcuts and specialized workflows where retraining costs are genuinely prohibitive
- Well-specified technical systems where physics/math-based outputs must remain consistent
- Even then: parity applies to *specific components*, not entire applications

**The better approach — outcomes over feature count:**
- Understand actual user needs through research and user shadowing (not interviews)
- Identify business metrics and profitability drivers
- Prioritize based on business outcomes, not feature lists
- Use modernization as an opportunity to eliminate waste and improve workflows
- Track *business metrics* during migration, not feature checkboxes

**Tracking parity during transition (when it's genuinely required):**
- Maintain a feature inventory in a shared board (Linear, Jira, Notion) with explicit status: `legacy-only | migrated | deprecated | not-migrating`
- Shadow mode output comparison provides objective parity measurement for behavioral parity
- Data reconciliation scripts provide parity measurement for data parity
- Business metric comparison (conversion rates, error rates, task completion time) provides parity measurement for outcome parity

*Sources: [Martin Fowler - Feature Parity Pattern](https://martinfowler.com/articles/patterns-legacy-displacement/feature-parity.html), [Thoughtworks - Embracing Strangler Fig Part 2](https://www.thoughtworks.com/en-gb/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-two), [Legacy-Modernization.io - Feature Parity Trap](https://legacy-modernization.io/patterns/legacy-challenges/feature-parity-trap/)*

---

### 7. Seam Identification: Finding the Right Boundaries

The quality of the migration depends heavily on finding the right seams to cut along. Cut in the wrong place and you create artificial dependencies and data consistency nightmares.

**Event Storming for seam identification:**

Event Storming is a collaborative workshop (business + engineering) that maps the entire domain through domain events. It's the most effective technique for uncovering legacy system structure without reading all the code.

Process:
1. Sticky notes for domain events (orange): "Order Placed", "Payment Processed", "Inventory Reserved"
2. Add commands (blue), aggregates (yellow), bounded contexts (pink)
3. Look for: pivotal events (major state changes), terminology shifts, and natural clusters

Bounded context boundaries emerge where:
- The language/terminology on sticky notes changes
- One team "hands off" to another
- A major state change marks the beginning of a new phase

Capital One used Event Storming to decompose their monolith into microservices — identifying bounded contexts in a complex financial system that would have been impossible to map from code reading alone.

**Domain-Driven Design fracture planes:**

A "fracture plane" is a natural seam — a place the system can be split along without creating new dependencies. Good fracture planes:
- Business domain boundaries (separate teams own separate domains)
- Data ownership boundaries (one clear owner of each entity type)
- Change frequency differences (stable vs. frequently changing components)
- Risk/criticality differences (high-stakes components vs. low-stakes)
- Conway's Law alignment (where team boundaries already exist)

**Reverse Conway Maneuver:**

If the target architecture requires different team boundaries than currently exist, intentionally restructure teams to produce the desired architecture (not vice versa). Team Topologies provides the vocabulary: stream-aligned teams, platform teams, enabling teams, complicated-subsystem teams.

*Sources: [Thoughtworks - Event Storming](https://www.thoughtworks.com/insights/podcasts/technology-podcasts/patterns-legacy-displacement-pt1), [Capital One - Event Storming to Microservices](https://medium.com/capital-one-tech/event-storming-decomposing-the-monolith-to-kick-start-your-microservice-architecture-acb8695a6e61), [Ardalis - Conway's Law + DDD + Microservices](https://ardalis.com/conways-law-ddd-and-microservices/)*

---

### 8. Measuring Modernization Progress

The biggest pitfall in tracking: using legacy metrics (utilization, throughput, quarterly margins) to measure a transformation. These metrics capture legacy behavior and create incentives to preserve it.

**Recommended metric categories:**

| Category | Metrics |
|----------|---------|
| **Technical health** | DORA metrics (deploy frequency, lead time, MTTR, change failure rate) on new system vs. old |
| **Migration progress** | % of traffic routed to new system; % of features migrated; % of data in new store |
| **Business outcomes** | Task completion rates, error rates, conversion rates — compared between systems |
| **Cost** | Maintenance cost reduction; infrastructure cost trends |
| **User satisfaction** | Internal + external user surveys; error rates; support ticket volume |
| **Security posture** | Vulnerability count, mean time to patch |

**Feature tracking board:** Maintain a feature inventory (not a feature parity checklist) with states: `legacy-only | in-migration | migrated | deprecated | intentionally-excluded`. Review weekly. The goal is reducing `legacy-only`, not increasing `migrated` as a vanity metric.

**Shadow comparison dashboard:** During shadow mode, log every case where new system output differs from old. Track the diff rate over time. Target: diff rate trends toward zero before switching the authoritative read to the new system.

**ROI tracking:** Research (cited by Kyndryl 2025 State of Mainframe Modernization) shows ROI of 288-362% for modernization projects, but this materializes over years, not quarters. Set expectations appropriately with stakeholders.

*Sources: [Datafloq - Measuring Legacy Modernization Success](https://datafloq.com/read/how-to-measure-the-success-of-your-legacy-system-modernization-project/), [HBR - Legacy Metrics Derailing Transformation](https://hbr.org/2026/02/are-legacy-metrics-derailing-your-transformation/)*

---

### 9. Decision Framework: Choosing Your Approach

```
Is the system small and simple?
    YES → Consider full rewrite with short parallel run
    NO  → Proceed to incremental approach

Do you have code access?
    NO  → Leave-and-Layer (EventBridge/event bus over legacy)
    YES → Strangler Fig

Is the legacy system primarily:
    DB-centric monolith → Expand/Contract + Strangler Fig
    Event-producing system → Event Interception
    COTS/vendor product → Legacy Mimic + ACL
    Complex distributed → Data Streaming (Kafka/Flink) + Strangler Fig

How much data volume?
    < 100K rows → Standard migration script, short cutover window
    100K–10M rows → Batched backfill + CDC
    > 10M rows → CDC + Kafka, possibly months of dual-write
```

---

### 10. Practical Checklist for Migration Projects

**Before starting:**
- [ ] Event Storming workshop to map domain and identify seams
- [ ] Data audit: volume, quality, owner per entity type
- [ ] Rollback plan documented and tested before migration begins
- [ ] Feature inventory created (not parity checklist — include `not-migrating` column)
- [ ] Shadow comparison framework ready before first slice goes to shadow mode

**During migration:**
- [ ] API Gateway / routing layer in place (not ad-hoc)
- [ ] ACL defined for every new service that touches legacy
- [ ] CDC or dual-write active before switching reads
- [ ] Shadow diff rate tracked and trending toward zero before promoting to `live`
- [ ] Decommission deadline set for each migrated slice
- [ ] DORA metrics baseline captured for legacy; compare monthly

**Danger signs to watch for:**
- Features are being migrated but legacy is not being decommissioned (perpetual hybrid)
- Adapters are accumulating (adapter hell)
- Migration is tracking feature count, not business outcomes
- Team morale declining from maintaining two systems (set explicit end date)

---

## Open Questions

1. **AI-assisted migration**: Tools like GitHub Copilot, Cursor, and emerging specialized tools claim to accelerate code migration. How effective are they for complex semantic translations (not just syntax)? What's the failure mode?

2. **Organizational endurance**: What organizational patterns keep migration teams motivated through multi-year projects? How do leading companies structure "migration teams" vs. "product teams" in parallel?

3. **Stateful systems**: The strangler fig pattern is well-documented for stateless HTTP services. How does it apply to systems with complex stateful protocols (mainframes, COBOL VSAM files, AS/400 RPG systems)?

4. **Microservices to modular monolith**: The industry is seeing backlash against microservices complexity. What patterns exist for the *reverse* migration (microservices → modular monolith)? Is Strangler Fig applicable in reverse?

5. **Data contract testing during migration**: How do teams prevent the new system from drifting from the legacy's implicit contracts during multi-year migrations? Consumer-driven contract testing (Pact) is one answer — what else?

---

## Extracted Principles

See `principles/migration-legacy-modernization.md` (new file created from this research).

Key principles distilled:
1. **Never Big Bang for large systems** — incremental always
2. **Install routing layer first** — the proxy is the control plane, not an afterthought
3. **Avoid the feature parity trap** — track outcomes, not feature count
4. **Shadow before canary** — validate correctness before exposing any users
5. **CDC over bulk migration** — near-zero-downtime cutover
6. **Seams before slices** — Event Storming before any code is written
7. **Set decommission deadlines** — prevent perpetual hybrid state
8. **Data consistency is the hardest part** — design data sync strategy before starting

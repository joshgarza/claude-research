# Migration & Legacy Modernization

## Summary

Replacing or modernizing a legacy system is one of the highest-risk engineering undertakings. The core principle is incremental displacement: never attempt a "big bang" full rewrite for non-trivial systems. Use the Strangler Fig pattern (and its variants) to route traffic incrementally to new components while keeping the legacy operational. Data migration is the hardest part — design data synchronization before writing any new code. Avoid the feature parity trap: track business outcomes, not feature counts.

## Principles

### Never Big Bang for Non-Trivial Systems
- **What:** For any system with significant complexity, live users, or regulatory requirements, avoid full rewrites. Use incremental displacement patterns instead.
- **Why:** Big bang rewrites have a multi-year timeline during which requirements go stale, hidden dependencies surface only at cutover, and no business value is delivered. Failed projects in this category have cost organizations hundreds of millions of dollars.
- **When:** Default for all production systems. Big bang is only appropriate for small/simple systems, batch-only systems with no live users, or systems with extremely well-specified requirements and a short (<3 month) timeline.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Install the Routing Layer First
- **What:** Before migrating any functionality, deploy a proxy layer (API Gateway, reverse proxy) between clients and the legacy system. Initially route 100% of traffic to legacy. This layer becomes the control plane for the entire migration.
- **Why:** Without a routing layer, each slice migration requires touching clients. With it, you shift traffic by changing routing config — no client changes required. The proxy also enables shadow mode, canary traffic shaping, and instant rollback.
- **When:** Day one of any Strangler Fig migration. Not optional. Use production-grade proxy infrastructure (serverless, Multi-AZ) — a flimsy proxy negates the risk reduction of the pattern.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Find Seams Before Writing Slices
- **What:** Use Event Storming workshops (business + engineering) to map the legacy domain and identify natural boundaries before deciding what to migrate first. A "seam" is a place where you can alter behavior without modifying existing code.
- **Why:** Migrating across the wrong boundary creates artificial dependencies and data consistency nightmares that haunt the project for years. Good seams follow: business domain boundaries, data ownership boundaries, change frequency differences, team ownership.
- **When:** Before any code is written for the new system. Event Storming is the most effective seam-identification technique for complex legacy systems. DDD bounded contexts provide the vocabulary.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Shadow Before Canary
- **What:** Before routing any real user traffic to the new system (canary), run the new system in shadow mode: route all production requests to both systems, return old system results to users, log and compare new system outputs.
- **Why:** Shadow mode validates correctness under real production traffic (edge cases, load patterns) without any user exposure. Canary exposes users to new system failures before correctness is established.
- **When:** Every slice migration before the `live` stage. Track the shadow diff rate (% of requests where new != old) and target trending toward zero before switching authoritative reads.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Avoid the Feature Parity Trap
- **What:** Do not use "feature parity with legacy" as the migration success criterion. Instead, track business outcomes: user task completion rates, error rates, conversion rates, and user satisfaction.
- **Why:** ~50% of legacy features are unused (Standish Group 2014). Workarounds for old bugs become "requirements." Rebuilding these as-is perpetuates inefficiencies and wastes resources modernizing what nobody needs. Feature parity scope explodes; teams cut corners; the result is a system that replicates legacy bugs in new technology.
- **When:** Set outcome-based success criteria before migration starts. Maintain a feature inventory with explicit `not-migrating` and `deprecated` states alongside `migrated`. The goal is reducing legacy traffic, not counting migrated features.
- **When NOT:** Feature parity is appropriate for narrow cases: highly optimized power-user interfaces where retraining cost is genuinely prohibitive; physics-based technical outputs that must remain consistent.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md), [Martin Fowler - Feature Parity](https://martinfowler.com/articles/patterns-legacy-displacement/feature-parity.html)

### Use CDC for Non-Trivial Data Migrations
- **What:** For migrations involving more than ~100K rows or requiring near-zero downtime, use Change Data Capture (CDC) instead of bulk extract-load. CDC continuously streams row-level changes from source to target, keeping both in sync. Once caught up, cutover window is seconds.
- **Why:** Bulk migrations require long downtime windows and produce data that is stale by the time migration completes. CDC eliminates this by enabling continuous synchronization during the parallel-run phase.
- **When:** Any production data migration with significant volume or SLA requirements. Tools: Debezium (open source, Kafka-native), AWS DMS, Airbyte. For very large datasets (100M+ rows), combine CDC with Kafka/Flink for data transformation during transit.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Design Data Sync Strategy Before Writing Code
- **What:** Data consistency across old and new systems is the hardest part of any migration. Design the data synchronization strategy (dual-write, CDC, event-based sync) before writing any new application code. Validate the strategy on a small slice before committing to it at scale.
- **Why:** Teams that start coding before solving the data sync problem discover the problem at the worst time (mid-migration, under pressure). Different parts of the system owning different pieces of data during transition creates subtle bugs that are expensive to diagnose.
- **When:** Pre-migration design phase. The six-stage migration flag model (off → dualwrite → shadow → live → rampdown → complete) provides a structured framework for the data sync lifecycle.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Set Decommission Deadlines to Prevent Perpetual Hybrid
- **What:** For each migrated slice, set an explicit deadline to decommission the legacy equivalent. Treat decommissioning as a non-optional delivery milestone, not a nice-to-have cleanup task.
- **Why:** The "perpetual hybrid" anti-pattern — where slices are migrated but legacy is never decommissioned — is the most common Strangler Fig failure mode. Teams lose momentum, adapters accumulate ("adapter hell"), and the organization ends up maintaining two full systems indefinitely. The cost of the dual system never goes away.
- **When:** At migration planning time, before a slice enters migration. Typical pattern: slice goes live → 30-day stabilization → decommission legacy equivalent.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Use the Anti-Corruption Layer to Protect New Domain Models
- **What:** When new services need to communicate with the legacy system, create an Anti-Corruption Layer (ACL) — an adapter facade that translates legacy domain concepts to new domain concepts. The ACL is composed of Facade + Adapter + Translator patterns.
- **Why:** Without an ACL, legacy concepts leak into the new architecture, undermining the modernization goal. The new system ends up shaped by legacy constraints rather than the target domain model.
- **When:** Any time a new service depends on a legacy service or database. The ACL is temporary — retire it once all legacy dependencies are eliminated.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md), [Microsoft - Anti-Corruption Layer Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)

### Leave-and-Layer When You Can't Touch the Legacy
- **What:** If the legacy system is a COTS product, a vendor platform, or you lack code access, use the Leave-and-Layer pattern: leave the legacy untouched, layer new event-driven capabilities on top using an event bus (Amazon EventBridge, Kafka). New features capture events from legacy system outputs and process them independently.
- **Why:** Many modernization programs stall because they require touching a system that cannot be modified. Leave-and-Layer eliminates this constraint. It also reduces risk: the legacy system is never modified, so it cannot break.
- **When:** When the legacy system is a black box, a vendor product, or is too fragile to modify. Also effective for delivering new capabilities quickly while a longer-term strangling strategy is prepared.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

### Track DORA Metrics on New System from Day One
- **What:** Establish DORA baseline metrics (deploy frequency, lead time to change, MTTR, change failure rate) for the legacy system at the start of the migration. Track the same metrics for the new system from the first service. Compare monthly.
- **Why:** Legacy metrics (utilization, throughput) measure the wrong thing and create incentives to preserve legacy behavior. DORA metrics measure engineering effectiveness and will demonstrate the compounding value of modernization over time.
- **When:** Pre-migration baseline, then continuous tracking. Don't wait until migration is "done" — measuring incrementally shows progress and maintains stakeholder buy-in.
- **Source:** [research/2026-02-24-migration-legacy-modernization.md](../research/2026-02-24-migration-legacy-modernization.md)

## Revision History
- 2026-02-24: Initial extraction from research/2026-02-24-migration-legacy-modernization.md. Covers: Strangler Fig, parallel systems (shadow/dark launch/canary), data migration at scale (CDC, batched backfill, expand/contract), feature parity trap, seam identification (Event Storming/DDD), anti-corruption layer, leave-and-layer, decommission discipline, and measurement.

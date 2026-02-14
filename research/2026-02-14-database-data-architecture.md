---
date: 2026-02-14
topic: Database and Data Architecture
status: complete
tags: [database, postgresql, schema-design, indexing, connection-pooling, multi-tenant, migrations, edge-database]
related: [2026-02-13-backend-api-practices.md, 2026-02-14-backend-api-practices-update.md]
---

# Database and Data Architecture

## Context

This research fills a critical gap in the principles library: how to choose, design, scale, and operate databases for TypeScript/Node.js projects moving from demo to production. The backend-api-engineering principles already cover Drizzle over Prisma, expand-and-contract migrations, and multi-layer caching — but lack depth on database selection, schema design, indexing, connection management, multi-tenancy, and edge database patterns. This file provides that depth.

## Findings

### 1. Database Selection

**PostgreSQL is the default.** Andy Pavlo's 2025 databases retrospective (Carnegie Mellon) confirms: the hottest database energy is going into PostgreSQL — Databricks paid $1B for Neon, Snowflake paid $250M for CrunchyData, Microsoft launched HorizonDB. PostgreSQL 18 shipped November 2025. The ecosystem (extensions, tooling, managed services) is unmatched.

**When to deviate:**

| Database | When to use | When NOT to use |
|----------|-------------|-----------------|
| **PostgreSQL** | Default for everything. ACID, JSON/JSONB, full-text search, extensions, mature ecosystem. | Never wrong, sometimes overkill for embedded/edge. |
| **SQLite / Turso / libSQL** | Edge deployments, embedded apps, single-server projects, read-heavy global distribution. Turso gives sub-10ms global reads via edge replicas. Litestream enables S3-backed replication for pennies/day. | Multi-writer workloads, complex transactions spanning multiple nodes. |
| **MongoDB** | Genuinely schemaless data (CMS content, IoT events with variable sensor payloads). Not "because schemas are hard." | Anything requiring joins, transactions, or referential integrity — PostgreSQL JSONB covers 90% of "flexible schema" needs. |
| **DynamoDB** | AWS-native serverless, single-digit-ms latency at any scale, single-table design patterns. | Complex queries, ad-hoc analytics, teams without DynamoDB modeling expertise (the learning curve is real). |
| **CockroachDB** | Global distribution with strong consistency, regulatory data sovereignty requirements, PostgreSQL wire compatibility. | Cost-sensitive projects (it's expensive), simple single-region apps. |
| **PlanetScale / Vitess** | MySQL at massive scale, non-blocking schema migrations, database branching. Note: PlanetScale added PostgreSQL support in late 2025. | Cross-shard joins (Vitess limitation), teams standardized on PostgreSQL. |
| **Cloudflare D1** | Cloudflare Workers-native apps, SQLite semantics at the edge with global read replication. | Write-heavy workloads, complex relational modeling. |
| **Neon** | Serverless PostgreSQL with autoscaling, scale-to-zero, database branching, AI/agent workflows. Pricing dropped 80% on storage after Databricks acquisition (Aug 2025). | Workloads needing predictable latency (cold starts add 500ms-seconds). |

**Sources:** [Andy Pavlo 2025 Retrospective](https://www.cs.cmu.edu/~pavlo/blog/2026/01/2025-databases-retrospective.html), [ByteByteGo Database Selection](https://blog.bytebytego.com/p/factors-to-consider-in-database-selection), PostgreSQL docs, Neon docs, Turso docs.

### 2. Schema Design Patterns

#### Normalization Tradeoffs

Start normalized. Denormalize only when you have measured query performance problems. Premature denormalization creates data integrity nightmares that are harder to fix than slow queries.

**The practical rule:** Normalize until queries are slow, then denormalize the specific hot path. Use materialized views as a middle ground — they give you denormalized read performance with normalized source-of-truth data.

#### JSON/JSONB Columns

PostgreSQL JSONB is powerful but has specific tradeoffs:

**Use JSONB when:**
- Data has variable/dynamic attributes (user preferences, feature flags, form builder schemas)
- You need an "extension point" column alongside a solid normalized schema
- The data is read as a whole document, not queried field-by-field frequently

**Avoid JSONB when:**
- You'd query individual fields in WHERE clauses frequently (no column statistics — PostgreSQL uses hardcoded 0.1% selectivity estimate, wrecking query plans)
- Data has a stable, known structure (use proper columns — they're faster and smaller)
- Storage matters — JSONB doesn't deduplicate keys, can use 2x+ the space of normalized columns. One team saved 30% disk space by promoting 45 fields from JSONB to columns.

**TOAST compression:** JSONB documents >2KB get TOAST-compressed and stored out-of-line, adding I/O overhead. Keep hot JSONB columns lean.

**Sources:** [PostgreSQL JSON Types docs](https://www.postgresql.org/docs/current/datatype-json.html), [Heap: When to Avoid JSONB](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema), [EDB: Unnecessary JSON Anti-Patterns](https://www.enterprisedb.com/blog/postgresql-anti-patterns-unnecessary-jsonhstore-dynamic-columns), [AWS: PostgreSQL as a JSON Database](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/).

#### Polymorphic Associations

Three approaches, ordered by recommendation:

1. **Separate tables per type (recommended):** Each entity type gets its own table with proper foreign keys. Database can enforce all constraints. Use when types are known at design time.
2. **Shared table with discriminator column:** Single table with a `type` column and nullable type-specific columns. Simple queries but the database can't enforce that only the right columns are non-NULL for each type. Use for Single Table Inheritance when types share most columns.
3. **Polymorphic foreign keys (`resource_type` + `resource_id`):** Rails-style pattern. No database-level referential integrity. Avoid in new designs — prefer approach #1 or use a join table per target type.

**Source:** [GitLab: Polymorphic Associations](https://docs.gitlab.com/ee/development/database/polymorphic_associations.html), [Bruno Scheufler: Modeling Polymorphic Relations in Postgres](https://brunoscheufler.com/blog/2022-05-22-modeling-polymorphic-relations-in-postgres).

#### Soft Deletes

Add a `deleted_at TIMESTAMPTZ` column. Create a partial index: `CREATE INDEX idx_active ON table (id) WHERE deleted_at IS NULL`. All application queries filter `WHERE deleted_at IS NULL` by default.

**Gotchas:** Unique constraints must include `WHERE deleted_at IS NULL` (partial unique indexes) or you can't re-create a "deleted" record with the same unique key. Foreign keys pointing to soft-deleted rows create orphans — handle in application logic or use triggers.

**Source:** [OneUptime: PostgreSQL Soft Deletes](https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view).

### 3. Indexing Strategy

**Default rule: Don't add indexes speculatively. Add them when you have a slow query.** Indexes speed up reads but slow down writes and consume storage.

#### When to Add Indexes

- Columns in `WHERE` clauses of frequent queries
- Foreign key columns (PostgreSQL doesn't auto-index these — unlike MySQL)
- Columns used in `ORDER BY` / `GROUP BY` on large tables
- Columns used in `JOIN` conditions

#### Index Types

| Type | Use Case | Notes |
|------|----------|-------|
| **B-tree** (default) | Equality, range, sorting, prefix `LIKE` | Default. Right choice 90% of the time. |
| **GIN** | JSONB containment (`@>`), arrays (`&&`, `@>`), full-text search (`to_tsvector`) | 3x faster lookups than GiST. Slow writes (use `fastupdate`). Pending list batches inserts. |
| **GiST** | Spatial data (PostGIS), range types, full-text (when index size matters more than lookup speed) | Lossy — may produce false positives requiring heap recheck. Better for <100k unique values. |
| **BRIN** | Large, naturally-ordered tables (time series, append-only logs) | 99%+ smaller than B-tree. Only works when data is physically correlated with column values. |
| **Hash** | Pure equality lookups (no range) | Rarely better than B-tree in practice. Now WAL-logged (crash-safe) since PG 10. |

#### Composite Indexes

Order matters. Put the most selective column first (the one that filters out the most rows). A composite index on `(tenant_id, created_at)` supports queries filtering by `tenant_id` alone OR by both — but NOT `created_at` alone (leftmost prefix rule).

#### Partial Indexes

Index only the rows that matter: `CREATE INDEX idx_active_users ON users (email) WHERE deleted_at IS NULL`. Dramatically smaller and faster for queries that always filter on the same condition.

#### Covering Indexes (INCLUDE)

Add payload columns to avoid heap access: `CREATE INDEX idx_orders ON orders (user_id) INCLUDE (total, status)`. Enables index-only scans — zero heap fetches. Only useful when the table is relatively static (visibility map must be mostly-all-visible).

**Sources:** [PostgreSQL Index Types docs](https://www.postgresql.org/docs/current/indexes-types.html), [PostgreSQL Index-Only Scans docs](https://www.postgresql.org/docs/current/indexes-index-only-scans.html), [pganalyze: GIN Indexes](https://pganalyze.com/blog/gin-index), [Crunchy Data: Covering Indexes](https://www.crunchydata.com/blog/why-covering-indexes-are-incredibly-helpful), [Crunchy Data: When BRIN Wins](https://www.crunchydata.com/blog/postgres-indexing-when-does-brin-win), [ByteByteGo: Database Indexing Strategies](https://blog.bytebytego.com/p/database-indexing-strategies).

### 4. Connection Pooling

**The core problem:** Each PostgreSQL connection consumes ~10MB of memory. Default `max_connections` is 100. Serverless functions create a new connection per invocation. 200 concurrent Lambda functions = 200 connections = database exhaustion.

#### Solutions by Environment

**Traditional servers (long-running Node.js):**
- Use the `pg` Pool with Drizzle or Prisma's built-in pool
- Size: `num_cpus * 2 + 1` (HikariCP formula, works well for Node.js)
- One pool per application instance

**Serverless (Lambda, Vercel Functions, Edge):**
- **External pooler required.** PgBouncer (transaction mode) or managed poolers (Neon, Supabase, RDS Proxy)
- Set ORM connection limit to 1 per function instance
- Neon's built-in PgBouncer supports up to 10,000 concurrent connections
- Prisma: set `connection_limit=1` in the connection string for serverless
- Drizzle: use `@neondatabase/serverless` driver (HTTP/WebSocket, no TCP needed) or `postgres.js` with pooler endpoint

**PgBouncer modes:**
- **Transaction mode** (recommended): Connection returned to pool after each transaction. No prepared statements via SQL — must use protocol-level prepared statements.
- **Session mode**: Connection held for entire session. Supports all features but doesn't reduce connections much.
- **Statement mode**: Connection returned after each statement. Very restrictive — no multi-statement transactions.

**Vercel Fluid Compute:** Uses `waitUntil` to keep functions alive long enough to close idle connections before suspension, addressing the connection leak problem.

**Sources:** [Neon Connection Pooling docs](https://neon.com/docs/connect/connection-pooling), [Prisma Connection Pool docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool), [Drizzle Neon docs](https://orm.drizzle.team/docs/connect-neon), [Vercel: The Real Serverless Connection Problem](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved).

### 5. Read Replicas and Horizontal Scaling

**ByteByteGo's 7 strategies to scale a database (in order):**
1. Indexing — optimize queries first
2. Materialized views — precompute expensive queries
3. Denormalization — trade write complexity for read speed
4. Vertical scaling — bigger machine (surprisingly effective)
5. Caching — Redis/Upstash layer (covered in backend principles)
6. Read replicas — offload reads to followers
7. Sharding — last resort

#### Read Replicas

Add read replicas when read traffic exceeds what a single instance handles after optimizing indexes, caching, and queries. Common read/write split patterns:

- **Application-level routing:** Drizzle/Prisma can be configured with separate read/write connection strings. Writes go to primary, reads go to replica pool.
- **Proxy-level routing:** PgBouncer or ProxySQL routes based on query type.
- **Replication lag awareness:** Replicas can be milliseconds to seconds behind. Critical reads (immediately after a write) should go to the primary. Implement "read-your-writes" consistency at the application level.

**Caveat:** No monotonic read consistency across replicas by default. A client may see newer data on replica A, then older data on replica B. Pin a session to one replica if this matters.

#### Sharding — Avoid Until Forced

Sharding adds enormous complexity: cross-shard queries, distributed transactions, resharding operations, operational overhead. Most applications never need it.

**When sharding is actually necessary:**
- Single-table exceeds what one machine can store
- Write throughput exceeds single-node capacity after all other optimizations
- Regulatory requirements force data into specific regions

**If forced to shard:** Use Citus (PostgreSQL extension, automatic sharding) or CockroachDB (distributed SQL). Avoid hand-rolled sharding logic.

**Sources:** [ByteByteGo: 7 Strategies to Scale Your Database](https://blog.bytebytego.com/p/ep114-7-must-know-strategies-to-scale), [Crunchy Data: Distributed PostgreSQL Architectures](https://www.crunchydata.com/blog/an-overview-of-distributed-postgresql-architectures), [ByteByteGo: Database Sharding](https://blog.bytebytego.com/p/a-crash-course-in-database-sharding), Kleppmann's DDIA Ch. 5 (Replication) and Ch. 6 (Partitioning).

### 6. Backup and Recovery

#### Strategy Tiers

**Tier 1 — Managed services (Neon, Supabase, RDS):** Automated backups, point-in-time restore (PITR) built in. Neon provides instant branching as a backup/restore mechanism. This is the default for most teams — don't DIY backup infrastructure.

**Tier 2 — Self-managed PostgreSQL:**

- **Base backups:** Full snapshot of data directory. Schedule daily or weekly depending on WAL volume.
- **WAL archiving:** Continuously archive Write-Ahead Log files to durable storage (S3, GCS). Enables PITR to any point between base backups.
- **Tools:** `pg_basebackup` (built-in), pgBackRest (production-grade, parallel backup/restore, encryption), Barman (Crunchy Data).
- **Interval between base backups:** Balance storage cost of archived WAL vs recovery time. More frequent base backups = faster recovery but more storage.

**Tier 3 — SQLite / Turso:**
- Litestream: Continuous WAL streaming to S3. Pennies/day. Point-of-failure recovery.
- Turso: Managed backups included.

#### Disaster Recovery Rules

1. **Test your restores.** Untested backups are not backups. Schedule quarterly restore drills.
2. **Store backups in a different region** than the primary database.
3. **Define RPO (Recovery Point Objective):** How much data loss is acceptable? WAL archiving gives RPO of seconds. Daily backups give RPO of 24 hours.
4. **Define RTO (Recovery Time Objective):** How fast must recovery complete? Influences base backup frequency and tooling choice.

**Sources:** [PostgreSQL Continuous Archiving and PITR docs](https://www.postgresql.org/docs/current/continuous-archiving.html), [EDB: PostgreSQL Backup & Recovery](https://www.enterprisedb.com/blog/postgresql-database-backup-recovery-what-works-wal-pitr), [Litestream](https://litestream.io/), [Tiger Data: Database Backups and Disaster Recovery](https://www.tigerdata.com/blog/database-backups-and-disaster-recovery-in-postgresql-your-questions-answered).

### 7. Multi-Tenant Data Modeling

Three patterns, ordered by complexity and isolation:

#### Shared Tables with Row-Level Security (Recommended Default)

All tenants share the same tables. A `tenant_id` column on every table. PostgreSQL RLS policies enforce isolation at the database level.

**Implementation:**
```sql
-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy based on session variable
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set tenant context per request
SET LOCAL app.tenant_id = 'tenant-uuid-here';
```

**Critical requirements:**
- B-tree index on `tenant_id` on every table — RLS adds implicit WHERE clause
- `tenant_id` should be the first column in composite primary keys and composite indexes
- Foreign keys should include `tenant_id` to prevent cross-tenant data linking
- Always pair UPDATE/DELETE policies with SELECT policies
- Explicit WHERE filters in queries even with RLS — helps PostgreSQL use indexes more effectively

**Supabase pattern:** Uses `auth.uid()` in RLS policies tied to JWT claims. Never expose `service_role` key to client code (bypasses RLS entirely).

#### Schema-Per-Tenant

Each tenant gets their own PostgreSQL schema. Identical table structures, isolated data.

**Pros:** Cleaner logical separation, easier per-tenant backup/restore.
**Cons:** Schema count limits (performance degrades at hundreds of schemas), migration complexity (must apply to every schema), connection pool per schema or schema switching per request.

**When to use:** Regulated industries requiring stronger isolation guarantees, tenants with wildly different data volumes.

#### Database-Per-Tenant

Maximum isolation. Each tenant gets their own database instance.

**When to use:** Enterprise customers demanding complete isolation, compliance requirements mandating separate encryption keys, tenants needing independent scaling. Rare — the operational overhead is significant.

**Sources:** [AWS: Multi-tenant Data Isolation with RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/), [Crunchy Data: RLS for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres), [The Nile: Multi-tenant RLS](https://www.thenile.dev/blog/multi-tenant-rls), [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security), [Permit.io: Postgres RLS Guide](https://www.permit.io/blog/postgres-rls-implementation-guide).

### 8. Data Modeling for Common Patterns

#### User/Auth Tables

Covered by Better Auth library (see backend principles). Key schema considerations:
- Separate `users` (identity) from `accounts` (auth providers) — enables multiple login methods per user
- Store `email` with a unique partial index (`WHERE deleted_at IS NULL` if using soft deletes)
- Passkey credentials in a separate `authenticators` table linked to user

#### Audit Logs

**Trigger-based approach (recommended):**

Create a generic `audit_log` table with JSONB columns for `old_values` and `new_values`. Use PostgreSQL triggers to automatically capture changes on INSERT/UPDATE/DELETE.

**Schema:**
```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now()
);
```

**JSONB for flexibility:** Using JSONB for old/new values means you never need to alter the audit table when source tables change structure.

**Alternatives:** CDC (Change Data Capture) via logical replication for high-throughput systems — offloads audit writes to an external system, avoids write amplification on the source database.

#### Soft Deletes

See schema design section above. Key additions:
- Create a view (e.g., `active_users`) that filters `WHERE deleted_at IS NULL` for convenience
- Consider a separate `archived_*` table for truly old data, moving soft-deleted records there via background job after a retention period
- GDPR: Soft delete is not actual deletion. "Right to erasure" requires hard deletion or anonymization of PII.

#### Temporal Data (Slowly Changing Dimensions)

For tracking data changes over time (e.g., price history, address changes):
- **Type 2 SCD:** Add `valid_from` and `valid_to` TIMESTAMPTZ columns. Current record has `valid_to = NULL`. Range types with exclusion constraints prevent overlaps.
- **PostgreSQL temporal tables extension:** `temporal_tables` extension automates versioning.
- **Append-only event log:** For full history, store events rather than mutating rows. Best for audit-critical domains.

#### Tree Structures

| Approach | Read Performance | Write Performance | Best For |
|----------|-----------------|-------------------|----------|
| **Adjacency List** | Slow for deep trees (recursive CTEs) | Fast (single row update) | Frequently modified trees, shallow hierarchies |
| **Materialized Path** | Fast (string prefix matching) | Medium (update path of all descendants on move) | Breadcrumbs, URL hierarchies, read-mostly trees |
| **Nested Sets** | Fast (single range query for subtree) | Slow (must renumber on insert/move) | Read-heavy, rarely-modified hierarchies (categories) |
| **Closure Table** | Fast (precomputed paths) | Medium (insert/delete multiple rows) | Arbitrary depth queries, ancestor lookups |

**Recommendation:** Start with adjacency list + PostgreSQL recursive CTEs. It's the simplest and handles most cases. Move to materialized path or closure table if recursive CTE performance becomes an issue.

**Sources:** [PostgreSQL Audit Trigger wiki](https://wiki.postgresql.org/wiki/Audit_trigger), [Vlad Mihalcea: PostgreSQL Audit Logging](https://vladmihalcea.com/postgresql-audit-logging-triggers/), [Ackee: Hierarchical Models in PostgreSQL](https://www.ackee.agency/blog/hierarchical-models-in-postgresql), [Pat Shaughnessy: Tree Structure in Postgres](https://patshaughnessy.net/2017/12/11/trying-to-represent-a-tree-structure-using-postgres).

### 9. Migration Strategies Beyond Schema

The expand-and-contract pattern is already in backend principles. This section goes deeper.

#### pgroll: Automated Expand-and-Contract

[pgroll](https://github.com/xataio/pgroll) (by Xata) automates zero-downtime PostgreSQL migrations:

- Creates virtual schemas using views on top of physical tables
- Serves both old and new schema versions simultaneously during migration
- Handles data backfills in the background without blocking writes
- Rollback = cancel the migration (old schema never went away)
- No table locks during schema changes

**How it works:** On migration start, pgroll creates new columns, sets up triggers to sync old-to-new columns, creates view-based virtual schemas exposing both versions. Old application versions use the old view, new versions use the new view. On completion, the old columns are dropped.

#### Data Backfills at Scale

For large tables (millions+ rows), naive `UPDATE ... SET new_col = transform(old_col)` will lock the table and run for hours.

**Pattern: Batched backfill with throttling:**
1. Process in batches of 1,000-10,000 rows using `WHERE id BETWEEN ? AND ?`
2. Add `pg_sleep(0.1)` between batches to avoid overwhelming the database
3. Run during low-traffic periods
4. Use `CONCURRENTLY` for index creation: `CREATE INDEX CONCURRENTLY`
5. Monitor replication lag during backfill — pause if replicas fall behind

**Pattern: Dual-write during migration:**
1. Deploy code that writes to both old and new columns
2. Backfill old data into new column
3. Switch reads to new column
4. Remove writes to old column
5. Drop old column

**Pattern: Ghost table migration (for column type changes):**
1. Create a new table with the desired schema
2. Set up triggers to copy writes from old to new table
3. Backfill existing data
4. Swap table names atomically (`ALTER TABLE ... RENAME`)
5. Drop old table

**Tools:** pgroll (Xata), gh-ost (GitHub, MySQL), pg_repack (PostgreSQL table/index reorganization).

**Sources:** [Xata: pgroll expand-contract](https://xata.io/blog/pgroll-expand-contract), [Xata: Zero-Downtime Schema Migrations](https://xata.io/blog/zero-downtime-schema-migrations-postgresql), [Lob: Running Database Changes with Zero Downtime](https://www.lob.com/blog/meeting-expectations-running-database-changes-with-zero-downtime).

### 10. Edge Databases

The edge database landscape has matured significantly in 2025. Key options:

#### Turso (libSQL)

- Fork of SQLite with client/server protocol and replication
- **Embedded replicas:** Database file replicated to the edge, reads are local (sub-10ms), writes go to primary (20-100ms)
- **Drivers:** HTTP and WebSocket — works in Cloudflare Workers, Vercel Edge, Deno Deploy
- **Best for:** Read-heavy global apps, per-user databases, agent workflows
- **Limitation:** Single-writer. Write throughput is bounded by primary region.

#### Neon

- Serverless PostgreSQL with storage/compute separation
- **Branching:** Instant database copies for dev/preview/testing — copy-on-write, near-zero cost
- **Autoscaling:** Scales compute 0-to-N based on load. Scale-to-zero after 5 minutes idle.
- **Connection pooling:** Built-in PgBouncer (10K connections), plus @neondatabase/serverless driver for HTTP/WebSocket access
- **Post-Databricks (2025):** Storage pricing dropped to $0.35/GB (was $1.75). PostgreSQL 18 support.
- **Best for:** Serverless apps, preview environments, AI agent workflows (branching for rollback)

#### Cloudflare D1

- SQLite semantics, native Workers integration
- **Global read replication** (writes to primary, reads from nearest replica)
- **Best for:** Cloudflare Workers apps, simple data needs, companion to KV and Durable Objects
- **Limitation:** SQLite feature subset, no PostgreSQL compatibility

#### Connection Strategies for Serverless

1. **HTTP/REST:** Neon serverless driver, Turso HTTP driver, D1 bindings — no TCP, no connection pooling needed
2. **WebSocket:** Neon and Turso support WebSocket connections — persistent connection without TCP
3. **Connection pooler + TCP:** PgBouncer/RDS Proxy/Neon pooler for traditional ORMs that need TCP
4. **Recommendation:** Prefer HTTP-based drivers for edge/serverless. Use pooled TCP only when HTTP driver isn't available for your ORM.

**Sources:** [Turso docs](https://turso.tech/), [Neon docs](https://neon.com/docs), [Cloudflare D1 docs](https://developers.cloudflare.com/d1/), [Drizzle Serverless docs](https://orm.drizzle.team/docs/perf-serverless).

## Open Questions

1. **PostgreSQL 18 specifics:** What new features in PG 18 are most impactful for application developers? Need deeper dive.
2. **Drizzle + pgroll integration:** How well do Drizzle Kit migrations compose with pgroll? Is there a workflow that combines both?
3. **Neon branching for agents:** Andy Pavlo noted "agents need branches" — what are the concrete patterns for using database branching in AI agent workflows?
4. **ElectricSQL and local-first:** ElectricSQL offers conflict-free sync between Postgres and clients. Worth a separate research session on local-first data patterns.
5. **Time-series databases:** For heavy time-series workloads, when does TimescaleDB (PostgreSQL extension) become necessary vs. BRIN-indexed tables?

## Extracted Principles

Eleven principles distilled to [principles/database-data-architecture.md](../principles/database-data-architecture.md):

1. PostgreSQL Unless Proven Otherwise
2. Start Normalized, Denormalize the Hot Path
3. JSONB as Extension Point, Not Default
4. Index the Query, Not the Schema
5. External Pooler for Serverless
6. RLS-Based Multi-Tenancy as Default
7. Backfills in Batches, Never in One Shot
8. Use pgroll for Zero-Downtime Migrations
9. Test Your Restores
10. Defer Sharding Until Everything Else Fails
11. HTTP Drivers for Edge, TCP Through Poolers

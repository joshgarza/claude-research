# Database & Data Architecture Principles

## Summary

Opinionated, practical guidance for database selection, schema design, indexing, connection management, multi-tenancy, migrations, and edge deployment in TypeScript/Node.js projects. PostgreSQL is the default database. Start simple and normalized, add complexity only when measured performance demands it. Indexes serve queries, not schemas. Serverless needs external poolers. Multi-tenancy starts with RLS. Sharding is a last resort. Edge databases are production-ready for read-heavy workloads.

## Principles

### PostgreSQL Unless Proven Otherwise
- **What:** Use PostgreSQL as your default database. It handles ACID transactions, JSONB for flexible schemas, full-text search, geospatial (PostGIS), and time-series (BRIN indexes) — all in one engine. Choose alternatives only when PostgreSQL genuinely cannot serve the use case.
- **Why:** PostgreSQL has the strongest ecosystem momentum (Databricks paid $1B for Neon, Snowflake $250M for CrunchyData). Extensions, managed services (Neon, Supabase, RDS, Cloud SQL), and tooling (Drizzle, Prisma) are unmatched. JSONB eliminates 90% of "I need a document database" arguments.
- **When:** Every new project unless you have a specific, measured reason to choose something else.
- **When NOT:** Edge/embedded (use SQLite/Turso/D1). AWS-native serverless at extreme scale with simple access patterns (DynamoDB). Global strong consistency with data sovereignty requirements (CockroachDB).
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Start Normalized, Denormalize the Hot Path
- **What:** Design schemas in third normal form (3NF) by default. Denormalize only specific queries that are measured to be slow after indexing. Use materialized views as an intermediate step before full denormalization.
- **Why:** Premature denormalization creates data integrity problems that are harder to fix than slow queries. Normalization keeps your source of truth clean. Materialized views give denormalized read speed without sacrificing normalized writes.
- **When:** Every schema design. Denormalize only after EXPLAIN ANALYZE shows a query is too slow and indexes alone don't solve it.
- **When NOT:** Truly read-only analytics tables or data warehouses where write integrity is less critical.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### JSONB as Extension Point, Not Default
- **What:** Use JSONB columns for genuinely variable/dynamic data (user preferences, feature flags, plugin config). Use proper typed columns for any data with a stable, known structure. Never store an entire entity as JSONB.
- **Why:** JSONB has no column statistics (PostgreSQL uses a hardcoded 0.1% selectivity estimate), doesn't deduplicate keys (2x+ storage overhead), and documents >2KB get TOAST-compressed adding I/O overhead. Proper columns are faster, smaller, and produce better query plans.
- **When:** Extension points alongside a normalized schema. Variable-attribute data where the set of fields is genuinely unknown at design time.
- **When NOT:** Data with a known structure. Fields frequently used in WHERE clauses. Storage-sensitive workloads.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Index the Query, Not the Schema
- **What:** Don't add indexes speculatively. Add them in response to measured slow queries. Index foreign keys (PostgreSQL doesn't auto-index them). Use composite indexes with the most selective column first (leftmost prefix rule). Use partial indexes for filtered queries and covering indexes (INCLUDE) for index-only scans. Use GIN for JSONB/arrays/full-text, BRIN for time-series/append-only tables.
- **Why:** Every index slows writes and consumes storage. Unused indexes are pure overhead. B-tree is right 90% of the time. GIN gives 3x faster lookups than GiST for text/JSONB but has slower writes. BRIN uses 99%+ less space than B-tree for physically-ordered data.
- **When:** After identifying a slow query via EXPLAIN ANALYZE or pg_stat_statements. Always index foreign keys. Always index `tenant_id` in multi-tenant systems.
- **When NOT:** Don't index columns with very low cardinality (boolean flags). Don't add covering indexes on frequently-updated tables (visibility map won't stay all-visible).
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### External Pooler for Serverless
- **What:** Use an external connection pooler (PgBouncer in transaction mode, Neon's built-in pooler, RDS Proxy) for serverless deployments. Set ORM connection limit to 1 per function instance. For edge runtimes, prefer HTTP-based database drivers (`@neondatabase/serverless`, Turso HTTP) that bypass TCP entirely.
- **Why:** Each PostgreSQL connection consumes ~10MB memory. Serverless creates a new connection per invocation. 200 concurrent functions = database exhaustion. PgBouncer in transaction mode returns connections to the pool after each transaction, multiplexing thousands of clients onto a small connection pool.
- **When:** Any serverless, edge, or high-concurrency deployment.
- **When NOT:** Traditional long-running Node.js servers with a fixed instance count — use the ORM's built-in pool sized to `num_cpus * 2 + 1`.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### RLS-Based Multi-Tenancy as Default
- **What:** Use shared tables with a `tenant_id` column and PostgreSQL Row-Level Security (RLS) policies for multi-tenant applications. Index `tenant_id` on every table. Make `tenant_id` the first column in composite indexes and primary keys. Set tenant context via `SET LOCAL app.tenant_id` per request. Include explicit WHERE filters in queries even with RLS enabled.
- **Why:** RLS enforces tenant isolation at the database level — even bugs in application code can't leak cross-tenant data. Shared tables are operationally simple (one migration, one backup, one connection pool). Explicit WHERE filters help PostgreSQL use indexes more effectively even though RLS would filter the same rows.
- **When:** SaaS applications with standard multi-tenancy needs.
- **When NOT:** Schema-per-tenant for regulated industries needing stronger isolation or tenants with wildly different data volumes. Database-per-tenant for enterprise customers requiring separate encryption keys.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Backfills in Batches, Never in One Shot
- **What:** For large data migrations (millions+ rows), process in batches of 1,000-10,000 rows with throttling (`pg_sleep` between batches). Monitor replication lag and pause if replicas fall behind. Use `CREATE INDEX CONCURRENTLY` for index creation. For column type changes, use the ghost table pattern (new table + triggers + backfill + atomic rename).
- **Why:** A single `UPDATE` on millions of rows locks the table, overwhelms the transaction log, stalls replicas, and can run for hours. Batched backfills keep the database responsive and replication healthy throughout the migration.
- **When:** Any data migration touching more than ~100k rows in production.
- **When NOT:** Small tables or development environments where a single UPDATE completes in seconds.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Use pgroll for Zero-Downtime Migrations
- **What:** Use [pgroll](https://github.com/xataio/pgroll) to automate the expand-and-contract migration pattern. pgroll creates virtual schemas (views) serving both old and new versions simultaneously, handles backfills in the background, and enables instant rollback by canceling the migration.
- **Why:** Manual expand-and-contract requires coordinating column creation, trigger setup, backfill, view management, and cleanup. pgroll automates all of this without table locks. Rollback is trivial because the old schema was never removed.
- **When:** Breaking schema changes in production PostgreSQL (column renames, type changes, NOT NULL additions on existing columns).
- **When NOT:** Additive-only changes (new tables, new nullable columns) that are already safe without special tooling. Evaluate whether your existing Drizzle Kit migrations are sufficient before adding pgroll.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Test Your Restores
- **What:** Schedule quarterly restore drills. Verify backups actually produce a working database. Define RPO (how much data loss is acceptable) and RTO (how fast recovery must complete). Store backups in a different region than the primary database.
- **Why:** Untested backups are not backups. Teams discover backup failures during actual disasters — the worst possible time. WAL archiving gives RPO of seconds; daily snapshots give RPO of 24 hours. The choice affects cost and tooling.
- **When:** Every production database, regardless of managed vs. self-hosted. Managed services handle mechanics but you still need to verify.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Defer Sharding Until Everything Else Fails
- **What:** Scale databases in this order: indexing, materialized views, denormalization, vertical scaling, caching, read replicas, and only then sharding. If forced to shard, use Citus (PostgreSQL extension) or CockroachDB. Never hand-roll sharding logic.
- **Why:** Sharding adds cross-shard query complexity, distributed transaction overhead, resharding operations, and massive operational burden. Most applications never need it. A well-indexed PostgreSQL instance on modern hardware handles more than most teams expect.
- **When:** Single-table exceeds single-machine storage, write throughput exceeds single-node capacity after all other optimizations, or regulatory requirements force regional data partitioning.
- **When NOT:** Read-heavy workloads (use replicas). Slow queries (use indexes/caching). Growing storage (use bigger disk first).
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### HTTP Drivers for Edge, TCP Through Poolers
- **What:** For edge/serverless runtimes, use HTTP-based database drivers (`@neondatabase/serverless`, Turso HTTP driver, D1 bindings) that require no TCP and no connection pooling. For traditional Node.js servers or ORMs that require TCP, route through a connection pooler (PgBouncer, Neon pooler, RDS Proxy).
- **Why:** Edge runtimes (Cloudflare Workers, Vercel Edge) often cannot establish TCP connections. HTTP drivers bypass this entirely. Even where TCP is available, HTTP drivers eliminate cold-start connection overhead in serverless.
- **When:** Any edge or serverless deployment. Cloudflare Workers, Vercel Edge Functions, Deno Deploy.
- **When NOT:** Long-running Node.js servers where TCP connections are persistent and pool management is straightforward.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

### Adjacency List First for Tree Structures
- **What:** Model hierarchical data with adjacency list (parent_id foreign key) and PostgreSQL recursive CTEs. Only move to materialized path or closure table if recursive CTE performance becomes a measured bottleneck. Avoid nested sets for write-heavy trees.
- **Why:** Adjacency list is the simplest model — single row update for moves, no denormalized data to maintain. PostgreSQL recursive CTEs handle most hierarchy queries efficiently. Materialized path and closure table trade write complexity for read speed. Nested sets require renumbering on every insert/move.
- **When:** Default for any hierarchical data (org charts, categories, comment threads, folder structures).
- **When NOT:** Use materialized path for URL/breadcrumb hierarchies where path string is natural. Use closure table when arbitrary ancestor/descendant queries are the primary access pattern.
- **Source:** [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-database-data-architecture.md](../research/2026-02-14-database-data-architecture.md).

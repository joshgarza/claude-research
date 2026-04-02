---
date: 2026-03-02
topic: Custom logging system for solo developer
status: complete
tags: [logging, observability, telemetry, metrics, sqlite, pino, gpu, architecture]
---

# Custom Logging System for a Solo Developer

## Context

Research into what it takes to build a cross-project logging, telemetry, and system metrics system for a solo developer running multiple TypeScript/Node.js projects. The user already has a shared SQLite-based infrastructure pattern (Hopper DB with WAL mode) and wants to understand the full landscape before committing to an architecture.

## 1. Structured Logging Libraries for Node.js/TypeScript

### The Field in 2026

Three libraries dominate, but with very different trajectories:

| Library | Weekly Downloads | Last Release | Status |
|---------|-----------------|--------------|--------|
| **pino** | ~24M/week | v10.3.1 (Feb 2026) | Actively maintained, 4 maintainers |
| **winston** | ~12M/week | Active | Most popular by install count, flexible |
| **bunyan** | Declining | Maintenance slowed | Introduced JSON logging best practices, but superseded |

**Recommendation: Pino.** It is the clear winner for new TypeScript projects in 2026:

- **Performance**: 5x faster than Winston, 3-5x faster than Bunyan. Handles 10K+ logs/second with minimal overhead. Uses async architecture that offloads formatting to worker threads, avoiding event loop blocking.
- **Structured by default**: Outputs JSON natively. No configuration needed for structured logs.
- **OpenTelemetry integration**: First-class support via `@opentelemetry/instrumentation-pino` (auto-injects trace context into log records) and `pino-opentelemetry-transport` (sends logs in OTLP format). This is a significant advantage for future-proofing.
- **Custom transports**: Pino's transport system runs in worker threads. Custom transports are straightforward to write using `pino-abstract-transport`. A SQLite transport would consume log objects via async iterator and batch-insert them.
- **TypeScript support**: Native TS transport support since Node 22.6.0 (type stripping). For production, transpile to JS.

Winston remains viable for projects needing complex routing (e.g., different log levels to different destinations simultaneously), but for a solo developer building from scratch, Pino's speed and simplicity win.

### Creating a Shared Logging Package

The recommended approach for cross-project sharing without publishing to npm:

**npm workspaces** (or pnpm workspaces): Define a `packages/logger` directory with its own `package.json`. Running `npm install` creates symlinks in the root `node_modules`, making the package importable like any npm package. No registry needed.

However, for projects that are NOT in a monorepo (which is the more common solo developer case), the options are:

1. **npm link**: Symlinks a local package globally. Works but is fragile across Node version switches and can cause phantom dependency issues.
2. **file: protocol in package.json**: `"@josh/logger": "file:../shared-logger"`. Simple, but copies rather than links (use `link:` protocol for symlink behavior with pnpm).
3. **Git dependency**: `"@josh/logger": "github:joshgarza/shared-logger"`. Works well for stable packages. Requires a push to update.
4. **Local npm registry (Verdaccio)**: Overkill for solo developer use.

**Practical recommendation**: For separate repos, use `"link:../shared-logger"` with pnpm or a git-based dependency. For a monorepo approach, npm/pnpm workspaces with TypeScript project references.

A minimal shared logger would look like:

```typescript
// packages/logger/src/index.ts
import pino from 'pino';

export function createLogger(options: {
  name: string;
  level?: string;
  transports?: pino.TransportMultiOptions;
}) {
  return pino({
    name: options.name,
    level: options.level ?? 'info',
    transport: options.transports,
    // Standard fields every project gets
    base: {
      pid: process.pid,
      hostname: require('os').hostname(),
    },
  });
}

export type { Logger } from 'pino';
```

## 2. Log Transport and Storage

### SQLite as a Log Store

**Pros:**
- Zero infrastructure. Single file. Already a proven pattern in the user's stack (Hopper DB).
- WAL mode enables concurrent reads and writes. Readers never block writers. One writer at a time, but writes are fast.
- Performance is more than sufficient: with WAL + transaction batching, SQLite can sustain 100K-250K inserts/second. A solo developer's projects will generate orders of magnitude less.
- Queryable with SQL. No need for a separate query language.
- Works with `better-sqlite3` (synchronous, fastest Node.js SQLite library) or via a Pino transport in a worker thread.
- 40M+ rows works fine with proper indexing.

**Cons:**
- Single-writer serialization. If multiple processes write simultaneously, one blocks. WAL mitigates this (the write lock is held briefly), but it is a real constraint.
- No built-in retention/rotation. You must implement TTL cleanup yourself (DELETE WHERE timestamp < X, then VACUUM periodically).
- Database file growth. Unlike JSONL where you can delete old files, SQLite requires VACUUM to reclaim space (or use incremental auto-vacuum).
- No built-in replication or backup streaming. You get file-level backup (copy the .db file, or use `.backup` API).
- Schema changes require migrations.

**Performance specifics:**
- `better-sqlite3` batched inserts in a transaction: thousands of rows in milliseconds.
- WAL mode + `synchronous=NORMAL`: best balance of durability and speed. Writes survive process crashes but not OS crashes (acceptable for logging).
- For maximum insert speed: batch logs in memory (e.g., 100-1000 entries), then insert in a single transaction.

**Schema design for a log table:**

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,  -- ISO 8601
  level INTEGER NOT NULL,   -- pino numeric levels (10-60)
  project TEXT NOT NULL,
  message TEXT,
  data TEXT,                -- JSON blob for structured fields
  trace_id TEXT,            -- optional OTel correlation
  span_id TEXT
);

CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_project_level ON logs(project, level);
```

### JSONL (JSON Lines) File-Based Logging

**Pros:**
- Simplest possible format. One JSON object per line.
- Natural rotation: daily files (`app-2026-03-02.jsonl`), delete old files trivially.
- No schema to maintain. Fields can vary per line.
- Pino outputs JSONL by default (just pipe to a file).
- Easy to grep, stream, and process with standard Unix tools.
- `winston-daily-rotate-file` or `file-stream-rotator` handle rotation.

**Cons:**
- Querying requires reading and parsing files. No indexed queries.
- Correlation across projects requires parsing multiple files.
- No concurrent-write safety without file locking (but one-process-per-file is fine).

**Rotation strategies:**
- Size-based: rotate at 10MB, 50MB, 100MB.
- Time-based: daily rotation is the standard.
- Retention: keep 7-30 days, delete older files.
- `winston-daily-rotate-file`: handles all of this with configurable policies.

### Realistic Log Volumes for a Solo Developer

This was difficult to find precise data on, but from inference and experience:

- A typical Node.js API serving personal/small projects: **1K-50K log entries/day** at INFO level.
- Background services (cron jobs, data pipelines): **100-5K entries/day**.
- System metrics sampled every 30 seconds: **2,880 data points/day per metric**, ~10 metrics = **~29K data points/day**.
- Error logs specifically: **10-100/day** in a well-functioning system.
- **Total across ~5 projects**: Likely **50K-200K entries/day**, or roughly **1.5-6M entries/month**.

At this volume, SQLite handles it trivially. Even JSONL files would be small (a few MB/day). The bottleneck for a solo developer is never volume. It is query-ability and maintenance burden.

### Recommendation

**For a solo developer who already uses SQLite (Hopper DB)**: SQLite is the right choice. The existing pattern (WAL mode, shared DB file) extends naturally to logging. The queryability advantage over JSONL is significant when you want to answer questions like "show me all errors across all projects in the last 24 hours."

However, keep the option open by using Pino's transport system: write a SQLite transport AND output JSONL to files as a backup/debugging fallback. Pino supports multiple transports simultaneously.

## 3. System Metrics Collection

### nvidia-smi for GPU Stats

The cleanest approach for programmatic GPU metrics:

```bash
nvidia-smi --query-gpu=timestamp,index,name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw --format=csv,noheader,nounits
```

This outputs clean CSV that is trivial to parse. For continuous monitoring, add `-l <seconds>` for a polling interval.

**Parsing in TypeScript:**

```typescript
import { execSync } from 'child_process';

interface GpuMetrics {
  timestamp: string;
  index: number;
  name: string;
  temperatureC: number;
  gpuUtilPct: number;
  memUtilPct: number;
  memUsedMB: number;
  memTotalMB: number;
  powerDrawW: number;
}

function getGpuMetrics(): GpuMetrics[] {
  const output = execSync(
    'nvidia-smi --query-gpu=timestamp,index,name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw --format=csv,noheader,nounits',
    { encoding: 'utf-8' }
  );
  return output.trim().split('\n').map(line => {
    const [timestamp, index, name, temp, gpuUtil, memUtil, memUsed, memTotal, power] = line.split(', ');
    return {
      timestamp: timestamp.trim(),
      index: parseInt(index),
      name: name.trim(),
      temperatureC: parseFloat(temp),
      gpuUtilPct: parseFloat(gpuUtil),
      memUtilPct: parseFloat(memUtil),
      memUsedMB: parseFloat(memUsed),
      memTotalMB: parseFloat(memTotal),
      powerDrawW: parseFloat(power),
    };
  });
}
```

**Alternative: XML output** (`nvidia-smi -q -x`) is more comprehensive but heavier to parse. Use the `node-nvidia-smi` npm package if you want the XML approach with automatic JSON conversion.

**Alternative: NVML bindings**. For lower-overhead continuous monitoring, NVIDIA's NVML C library can be bound via N-API. The `nvidia-smi` CLI itself calls NVML under the hood, so direct bindings skip the process spawn overhead. However, for polling every 15-60 seconds, `execSync` is perfectly fine.

### Node.js Process Metrics

Built-in Node.js APIs provide everything needed:

```typescript
// Memory
const mem = process.memoryUsage();
// { rss, heapTotal, heapUsed, external, arrayBuffers }

// CPU
const cpu = process.cpuUsage();
// { user: microseconds, system: microseconds }

// Event loop lag (requires perf_hooks)
import { monitorEventLoopDelay } from 'perf_hooks';
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
// h.min, h.max, h.mean, h.percentile(99) -- in nanoseconds
```

**Key metrics to collect:**
- `process.memoryUsage().heapUsed` / `heapTotal` -- memory pressure
- `process.cpuUsage()` delta over interval -- CPU consumption
- Event loop delay p99 -- responsiveness indicator
- `process.uptime()` -- availability tracking

**For Prometheus-style export**, the `prom-client` library exposes these as default metrics automatically, with histograms and summaries.

### How System Metrics Differ Fundamentally from Application Logs

This is a critical architectural distinction:

| Dimension | Application Logs | System Metrics |
|-----------|-----------------|----------------|
| **Nature** | Discrete events with context | Numeric measurements at intervals |
| **Cardinality** | Unbounded (any message) | Fixed (known metric names) |
| **Storage model** | Append-only, immutable | Time-series, aggregatable |
| **Query pattern** | Search/filter by content | Range queries, aggregation, trend |
| **Volume scaling** | Proportional to traffic/code paths | Fixed (N metrics x sample rate) |
| **Cost** | Grows with activity | Constant regardless of load |
| **Value over time** | Individual events lose value; recent matters most | Aggregated trends gain value over time |

**The practical implication**: Mixing logs and metrics in the same storage is tempting (everything in one SQLite table!) but leads to poor query performance and awkward schemas. Metrics want time-series operations (rate, derivative, moving average). Logs want full-text search and filtering.

**Recommendation for a solo developer**: Store them in the same SQLite database but in **separate tables** with different schemas. A `logs` table (event-oriented, text-heavy) and a `metrics` table (numeric, fixed columns, timestamp-indexed). This gives you a single DB file to manage while respecting the different data models.

```sql
CREATE TABLE metrics (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,      -- 'gpu', 'node-process', 'system'
  project TEXT,              -- null for system-level metrics
  metric TEXT NOT NULL,      -- 'gpu.temperature', 'heap.used', etc.
  value REAL NOT NULL,
  unit TEXT                  -- 'celsius', 'bytes', 'percent', 'ms'
);

CREATE INDEX idx_metrics_source_metric_ts ON metrics(source, metric, timestamp);
```

## 4. The "Build vs. Use" Tradeoff

### Minimum Viable Custom Logging System

The absolute minimum that provides real value:

1. **Shared Pino logger** (~50 lines of TypeScript): Creates a pre-configured Pino instance with project name, standard fields, and log level from env.
2. **SQLite transport** (~100 lines): Pino transport that batches log objects and inserts into SQLite via `better-sqlite3`.
3. **Metrics collector** (~150 lines): Interval-based collector that polls `nvidia-smi` (CSV parse), `process.memoryUsage()`, and `monitorEventLoopDelay()`, then inserts into the metrics table.
4. **Cleanup cron** (~30 lines): Deletes logs/metrics older than N days.

**Total: ~330 lines of TypeScript.** This is a weekend project.

What you get:
- Cross-project error visibility via SQL queries.
- GPU/CPU/memory trending.
- A single SQLite file you can query with any tool (DB Browser, Datasette, custom dashboard).

What you do NOT get (and would need to build if you wanted):
- A dashboard/UI.
- Alerting.
- Log correlation with traces.
- Full-text search (SQLite FTS5 could add this, but it is more work).

### Where Custom Solutions Typically Break Down

Based on real-world experience and the build-vs-buy literature:

1. **Querying and visualization.** Writing SQL is fine for investigation, but you will eventually want a dashboard. Building a dashboard is a whole project. This is where Grafana (free, self-hosted) or Datasette (zero-config SQLite web UI) saves massive time.

2. **Alerting.** "Tell me when errors spike" requires a monitoring loop, threshold logic, and a notification channel. This is deceptively complex to make reliable (alert fatigue, deduplication, muting).

3. **Log rotation and retention.** Easy to write, easy to forget to maintain. You will eventually find your disk full because the cleanup job silently broke 3 months ago.

4. **Schema evolution.** As you add new projects or new metric types, the schema needs to evolve. Without a migration system, this becomes manual toil.

5. **Multi-process write contention.** If two projects try to write to the same SQLite file simultaneously and the workload grows, you will hit WAL contention. This is solvable (write through a single agent process, or accept brief serialization) but requires planning.

6. **"I'll add that later" features.** Context propagation, request tracing, sampling, log levels per-project -- each is small, but they accumulate into a real maintenance burden.

### Typical Maintenance Burden

Industry consensus for custom logging systems:

- **Initial build**: 1-3 days for the core system described above.
- **Ongoing maintenance**: ~10% of an engineer's time if actively used. For a solo developer, this means several hours per month of fixing, tweaking, and extending.
- **The real cost**: Opportunity cost. Every hour maintaining your logging system is an hour not spent on your actual projects.

### Verdict

For a solo developer with TypeScript projects and an existing SQLite pattern, a custom system is viable IF you:
1. Keep scope ruthlessly minimal (Pino + SQLite transport + metrics collector, nothing more).
2. Use existing tools for visualization (Datasette, Grafana) rather than building UI.
3. Accept that it will never be as polished as a hosted solution.
4. Consider it a learning project, not just a utility.

If the goal is purely operational (just need to know when things break), a hosted free tier (Better Stack, Axiom, Grafana Cloud) gets you there faster with less maintenance.

## 5. Architecture Patterns

### Pattern 1: Direct Write (Simplest)

```
[App A] --pino--> [SQLite transport] --write--> [logs.db]
[App B] --pino--> [SQLite transport] --write--> [logs.db]
[Metrics cron] ----collect----------> --write--> [logs.db]
```

Each process writes directly to the same SQLite file.

**Pros:** Zero infrastructure. No additional processes. Works immediately.
**Cons:** Write contention if multiple apps write simultaneously. Each app needs the transport dependency. No buffering if the DB is briefly locked.

**Mitigation:** WAL mode handles brief contention well. Pino's async transports run in worker threads, so app performance is unaffected even if a write blocks momentarily.

**Best for:** Solo developer with 2-5 low-traffic projects on one machine.

### Pattern 2: Log Shipping (Agent-Based)

```
[App A] --pino--> [stdout/JSONL files]
[App B] --pino--> [stdout/JSONL files]
                        |
              [Log Agent (e.g., Alloy, Promtail)]
                        |
              [Central Store (Loki, SQLite, etc.)]
```

Apps write to files or stdout. A separate agent process reads those files and ships them to a central store.

**Pros:** Apps are decoupled from storage. Agent handles batching, retry, and backpressure. Standard pattern used by Loki/ELK stacks.
**Cons:** Extra process to run and monitor. File-based shipping adds latency. More moving parts to break.

**Best for:** When you want to use an existing observability stack (Grafana + Loki) or when apps run on different machines.

### Pattern 3: Central Log Server

```
[App A] --HTTP POST--> [Log Server API] --write--> [logs.db]
[App B] --HTTP POST--> [Log Server API] --write--> [logs.db]
```

A dedicated HTTP service receives logs and handles all storage.

**Pros:** Single writer (no contention). Can add validation, rate limiting, and auth. Clean separation.
**Cons:** Network dependency (logs lost if server is down, unless apps buffer). Another service to deploy and maintain. Latency overhead for HTTP.

**Best for:** Multi-machine setups or when you want strong write serialization.

### Pattern 4: OpenTelemetry Collector as Local Agent

```
[App A] --OTLP--> [OTel Collector] --export--> [SQLite / Loki / stdout]
[App B] --OTLP--> [OTel Collector] --export--> [SQLite / Loki / stdout]
[Metrics] ---------> [OTel Collector]
```

The OpenTelemetry Collector runs locally as an agent, receiving telemetry over OTLP (gRPC on port 4317 or HTTP on port 4318). It processes, batches, and exports to one or more backends.

**Pros:** Vendor-agnostic. Handles logs, metrics, AND traces in one pipeline. Massive ecosystem of receivers and exporters. Built-in batching, retry, and sampling. Can export to multiple destinations simultaneously.
**Cons:** Another process (written in Go, ~50MB binary). Configuration is YAML-based and can be complex. Overkill for 2-5 small projects. The SQLite exporter is not built-in (you would need a custom or file exporter + ingestion).

**How it works:**
- **Receivers**: Accept data (OTLP, Prometheus, syslog, etc.)
- **Processors**: Transform data (batch, filter, sample, add attributes)
- **Exporters**: Send data (OTLP, file, Prometheus, Loki, etc.)

**Best for:** When you want a standards-based pipeline that can grow with you. The "agent" deployment pattern runs one collector per host. If you ever want to send data to a cloud backend later, you just add an exporter.

### Recommended Architecture for This Use Case

**Start with Pattern 1 (Direct Write)**, evolve to Pattern 4 (OTel Collector) only if/when you need it.

Concrete recommendation:

```
Phase 1 (Now):
  - Shared Pino logger package (npm link or workspace)
  - Pino SQLite transport using better-sqlite3
  - Separate logs + metrics tables in a shared DB
  - Metrics collector as a lightweight daemon or cron
  - Datasette for ad-hoc querying

Phase 2 (When you feel pain):
  - Add pino-opentelemetry-transport alongside SQLite transport
  - Run OTel Collector locally
  - Add Grafana + SQLite datasource for dashboards
  - Add basic alerting (Grafana alerts or a simple threshold checker)

Phase 3 (Probably never for a solo developer):
  - Replace SQLite with Loki for logs
  - Add Prometheus/Mimir for metrics
  - Full LGTM stack
```

The key insight: Phase 1 is a weekend project. Phase 2 is a week. Phase 3 is a month+ and ongoing. Most solo developers never need Phase 3.

## Open Questions

1. **Should the logging DB be the same Hopper DB or a separate file?** Argument for same: one file to manage, existing WAL setup. Argument for separate: logging volume could dominate the DB, different backup/retention needs, isolation of concerns.

2. **What visualization tool to pair with SQLite logging?** Datasette (Python, zero-config, great for exploration) vs. Grafana (heavier, but supports dashboards and alerting). Both can query SQLite.

3. **Should GPU metrics collection be a standalone daemon or integrated into each project?** A standalone daemon is cleaner (one process polls nvidia-smi, writes to the metrics table). Integrating into each project means each project collects its own process metrics AND system metrics, which duplicates the GPU collection.

4. **Is the pino-opentelemetry-transport mature enough to use as the primary transport from day one?** Using OTLP format from the start would make future migration to any OTel-compatible backend trivial. But it adds complexity and a dependency on a running collector.

## Extracted Principles

The following principles can be distilled from this research:

1. **Pino is the default Node.js logger in 2026.** 5x faster than Winston, native JSON, OTel integration, 24M downloads/week. Use Winston only for complex multi-destination routing in legacy projects.

2. **Separate logs from metrics in storage, even in the same database.** They have fundamentally different data models, query patterns, and retention needs. Separate tables, not separate databases (for a solo developer).

3. **SQLite is a viable log store for solo/small-scale use.** WAL mode, better-sqlite3, transaction batching, and proper indexing handle 100K+ inserts/second. The constraint is not performance; it is the single-writer model and lack of built-in retention.

4. **nvidia-smi CSV format is the cleanest GPU metrics interface.** `--query-gpu` with `--format=csv,noheader,nounits` gives trivially parseable output. No XML parsing, no NVML bindings needed for polling intervals of 15+ seconds.

5. **Start with direct write, graduate to an agent.** Pattern 1 (each app writes to shared DB) works until you have multi-machine or high-concurrency needs. The migration path to OTel Collector is straightforward via Pino's multi-transport support.

6. **Custom logging systems break down at the UI/alerting layer, not the collection layer.** Building the collector is easy. Building dashboards and alerting is where solo developers lose weeks. Use Datasette or Grafana instead of building UI.

7. **A minimal custom logging system is ~330 lines of TypeScript.** Shared Pino config + SQLite transport + metrics collector + cleanup cron. This is a weekend project with clear boundaries.

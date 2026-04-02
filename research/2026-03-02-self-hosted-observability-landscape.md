---
date: 2026-03-02
topic: Self-hosted logging and observability landscape
status: complete
tags: [observability, logging, metrics, tracing, opentelemetry, self-hosted, devops]
related: [2026-02-13-devops-infrastructure-practices.md, 2026-02-13-backend-api-practices.md]
---

# Self-Hosted Logging & Observability Landscape (2026)

## Context

Evaluating the current landscape of free, self-hosted logging and observability solutions for a solo developer running ~5-10 heterogeneous projects (Node.js/TypeScript apps, Python scripts, system metrics, GPU stats). The goal is to find the right balance between comprehensive observability and operational overhead.

## Findings

### 1. All-in-One Observability Platforms

These platforms handle logs, metrics, and traces in a single deployment.

#### Grafana LGTM Stack (Loki + Grafana + Tempo + Mimir/Prometheus)

The de facto open-source observability stack, composed of separate best-in-class tools unified through Grafana dashboards.

- **Components**: Loki (logs), Prometheus/Mimir (metrics), Tempo (traces), Grafana (UI), Alloy (collector, replaced Promtail), Pyroscope (profiling)
- **Resource requirements**: Each component is individually lightweight in monolithic mode. Loki monolithic: ~256MB-1GB RAM. Prometheus: ~512MB-2GB depending on series count. Tempo: minimal (needs object storage). Grafana: ~256MB. Total for a minimal single-server deployment: ~2-4GB RAM. Grafana provides a [`docker-otel-lgtm`](https://github.com/grafana/docker-otel-lgtm) all-in-one container for dev/testing (Loki + Prometheus + Tempo + Pyroscope + OTel Collector + Grafana in one image), but it is explicitly not production-ready.
- **Setup complexity**: HIGH. 4-6 separate services to configure, each with its own config format. Alloy (the collector) uses a River/HCL-like config language. Learning curve is steep. However, the community has produced many Docker Compose templates.
- **Truly free**: YES. All components are Apache 2.0. No feature gates, no user limits. Grafana Cloud exists as a paid hosted option but the OSS stack is fully featured.
- **Multi-source ingestion**: EXCELLENT. Alloy/OTel Collector supports 120+ integrations. Native Prometheus scraping for metrics. Loki accepts logs from Alloy, Fluentd, Fluent Bit, syslog, HTTP push. Tempo accepts OTLP, Jaeger, Zipkin formats. NVIDIA DCGM Exporter for GPU metrics plugs directly into Prometheus.
- **Community health**: EXCELLENT. Backed by Grafana Labs (profitable company). Loki has 24.7K GitHub stars. Massive ecosystem. Alloy is the most-used OTel Collector distribution after the upstream one per CNCF surveys.
- **Best for**: Teams that want maximum flexibility, already know Prometheus/Grafana, or need to scale individual components independently.
- **Verdict**: Best long-term choice if you are willing to invest in setup. Overkill for a solo developer's initial needs.

#### SigNoz

OpenTelemetry-native, ClickHouse-backed all-in-one platform. The closest open-source equivalent to Datadog.

- **Resource requirements**: Minimum 4GB RAM allocated to Docker. ClickHouse is the heaviest component (4GB RAM request, 2 CPU for production). New [single binary mode](https://signoz.io/blog/launching-signoz-single-binary/) consolidates all services into one process, reducing overhead significantly. Can run on bare metal without Docker or K8s.
- **Setup complexity**: MEDIUM. Docker Compose one-liner gets you started. Single binary simplifies maintenance. However, ClickHouse tuning for production is non-trivial.
- **Truly free**: YES with caveats. The community (self-hosted) edition is fully featured. Enterprise self-hosted adds SSO/SAML, query caching, and support. No daily volume limits on self-hosted.
- **Multi-source ingestion**: EXCELLENT. OpenTelemetry-native, so anything that speaks OTLP works. SDKs for Node.js, Python, Go, Java, .NET. Accepts Prometheus metrics. [Pino integration via pino-opentelemetry-transport](https://github.com/pinojs/pino-opentelemetry-transport).
- **Community health**: GOOD. 20.5K GitHub stars. Active development (single binary launched late 2025). Backed by VC funding. Growing community but smaller than Grafana.
- **Best for**: Developers who want a single UI for logs+metrics+traces without assembling multiple tools. OTel-first teams.
- **Verdict**: Best "just works" all-in-one for a solo developer willing to give it 4GB+ RAM.

#### ClickStack (HyperDX + ClickHouse)

ClickHouse acquired HyperDX in March 2025 and released ClickStack as their open-source observability offering.

- **Resource requirements**: Minimum 4GB RAM, 2 cores for testing. Includes ClickHouse + HyperDX UI + OTel Collector + MongoDB.
- **Setup complexity**: LOW-MEDIUM. Single docker command gets it running. HyperDX v2 beta adds session replay, OTel metrics, alerts, dashboards.
- **Truly free**: YES. MIT + Apache 2.0 licensed. Open source project actively maintained post-acquisition. ClickHouse Cloud is the paid hosting option.
- **Multi-source ingestion**: GOOD. OpenTelemetry-native. OTel Collector included. Session replay is a unique differentiator (captures frontend user sessions alongside backend telemetry).
- **Community health**: GOOD but evolving. HyperDX had 22.3K GitHub stars pre-acquisition. Now backed by ClickHouse (well-funded company). Direction is promising but post-acquisition integration is still maturing.
- **Best for**: Teams that want session replay alongside backend observability. ClickHouse power users.
- **Verdict**: Promising but still in transition post-acquisition. Watch this space in 2026-2027.

#### OpenObserve (O2)

Rust-based, single-binary observability platform claiming 140x lower storage costs than Elasticsearch.

- **Resource requirements**: VERY LOW. Single binary, no external dependencies. Can start with ~2GB RAM. Users report ingesting terabytes on a single node. Written in Rust for efficiency.
- **Setup complexity**: LOW. Single binary or single Docker container. 2-3 minute setup for a POC. SQL + PromQL query support.
- **Truly free**: YES. The open source version is fully featured with logs, metrics, traces, dashboards, alerts, pipelines. No restrictions. AGPL-3.0 licensed.
- **Multi-source ingestion**: GOOD. Native OpenTelemetry support. HTTP/JSON log ingestion API. Supports Prometheus metrics scraping. Fluent Bit, Vector, Fluentd as log shippers.
- **Community health**: GOOD. 14.7K GitHub stars. Active development. Backed by commercial cloud offering. Smaller community than Grafana/SigNoz.
- **Best for**: Resource-constrained environments. Solo developers who want an all-in-one with minimal footprint.
- **Verdict**: Most resource-efficient all-in-one option. Worth serious consideration for single-server deployments.

#### Uptrace

OpenTelemetry-first APM built on ClickHouse + PostgreSQL.

- **Resource requirements**: LOW-MEDIUM. Achieves 10K+ spans/second on a single core. 1KB spans compress to ~40 bytes on disk. Requires ClickHouse + PostgreSQL, so minimum ~3-4GB RAM total.
- **Setup complexity**: MEDIUM. Docker Compose available. Requires both ClickHouse and PostgreSQL as dependencies.
- **Truly free**: YES for self-hosted. No feature limits. The hosted cloud version is paid. Source-available (BSL license).
- **Multi-source ingestion**: EXCELLENT. OTel-native. Strong trace-query expressiveness and cross-signal correlation.
- **Community health**: MODERATE. 3.5K GitHub stars. Smaller community. Primarily maintained by a single developer/small team.
- **Best for**: OpenTelemetry-first teams that want strong tracing with efficient storage.
- **Verdict**: Solid technically but smaller community is a risk factor for long-term maintenance.

### 2. Log Aggregation (Dedicated)

#### Grafana Loki

Log aggregation system designed to be cost-effective and easy to operate.

- **Architecture**: Does NOT index log content, only labels (metadata). Stores compressed log chunks. This is the key design decision: dramatically lower resource usage at the cost of search flexibility.
- **Resource requirements**: LOW. Monolithic mode: ~256MB-1GB RAM. Handles up to ~20GB/day in single binary mode. Minimal CPU usage since it does not build full-text indexes.
- **Setup complexity**: LOW-MEDIUM. Monolithic mode is simple. Config file is straightforward YAML.
- **Search capability**: LIMITED compared to Elasticsearch. Must scope queries by labels first, then grep within chunks. No arbitrary full-text search across all logs. Good enough for "show me logs from service X in the last hour" queries. Not good for "find any log containing 'error XYZ' across everything."
- **Truly free**: YES. Apache 2.0.
- **Best for**: Grafana stack users. Log volumes under 20GB/day. Label-based log browsing rather than full-text search.

#### Elasticsearch/OpenSearch + Kibana

The incumbent full-text log search stack.

- **Resource requirements**: HIGH. Elasticsearch is a JVM application. Minimum 4GB heap (so 8GB+ system RAM). Each shard consumes significant memory. Typical production: 16-32GB RAM per node.
- **Setup complexity**: HIGH. JVM tuning, shard management, index lifecycle management, mapping templates. Significant operational burden.
- **Truly free**: OpenSearch is Apache 2.0 (Amazon fork after Elastic's license change). Elasticsearch itself is now SSPL/Elastic License 2.0 (not OSI-approved open source). OpenSearch is the truly free option.
- **Search capability**: EXCELLENT. Full-text search with inverted indexes. Aggregations, faceting, fuzzy matching. The gold standard for log search.
- **Community health**: OpenSearch has strong Amazon backing. Elasticsearch has Elastic company backing but license is controversial.
- **Best for**: Large-scale log analytics, compliance search requirements, organizations that need full-text search.
- **Verdict**: Massively overkill for a solo developer. The resource cost alone disqualifies it for running alongside other workloads on a single machine.

#### Graylog

Security-focused log management.

- **Resource requirements**: MEDIUM-HIGH. Requires Elasticsearch/OpenSearch + MongoDB as backends. So all the ES overhead plus MongoDB.
- **Setup complexity**: MEDIUM-HIGH. Three-component deployment (Graylog + ES/OpenSearch + MongoDB).
- **Truly free**: COMPLICATED. Graylog Open is SSPL licensed (not OSI-approved). The free tier has a 2GB/day ingest limit. SMB License Program retired December 31, 2025. Enterprise features require paid license.
- **Community health**: DECLINING for open-source users. License tightening trend. Community forums show frustration with commercial direction.
- **Best for**: Security/compliance teams. Not recommended for general-purpose logging in 2026.
- **Verdict**: Avoid for a solo developer. License direction is unfavorable, and resource requirements are high.

#### Vector (Data Pipeline / Log Router)

Not a storage backend, but a high-performance log router/transformer.

- **Architecture**: Single Rust binary. No runtime dependencies. Collect, transform, and route observability data. Think of it as the plumbing between your apps and your storage backends.
- **Resource requirements**: VERY LOW. Rust-native, memory-safe, extremely efficient.
- **Setup complexity**: LOW-MEDIUM. TOML/YAML config. VRL (Vector Remark Language) for transformations. Rich ecosystem of sources and sinks.
- **Key limitation**: Lacks a generic OTLP sink. Can receive OTel data but cannot send to arbitrary OTel-compliant backends without specific sink support.
- **Truly free**: YES. MPL 2.0 license. Owned by Datadog but fully open source.
- **Best for**: As a collection/routing layer in front of any storage backend. Replacing Fluentd/Fluent Bit. Complex log transformation pipelines.
- **Verdict**: Excellent tool but solves a different problem (routing) than storage/search. Pairs well with Loki, ClickHouse, or file sinks.

### 3. Lightweight / Minimal Options

#### Dozzle (Docker Log Viewer)

Real-time Docker container log viewer with zero storage.

- **Resource requirements**: NEGLIGIBLE. 7MB compressed container image. No databases, no config files, no storage.
- **Setup complexity**: TRIVIAL. One `docker run` command. Web UI at port 8080.
- **Features (2025-2026)**: Real-time log streaming, shell access to containers, multiple remote hosts, SQL log analysis (DuckDB in browser via WASM), custom alerts (Slack, Discord, ntfy, webhooks), Docker Swarm support, secure remote agents.
- **Truly free**: YES. Apache 2.0.
- **Key limitation**: Does not persist logs. Pure viewer of Docker's existing log output. Cannot search historical logs. Cannot handle non-Docker sources.
- **Best for**: Quick debugging of Docker containers. Complementary to a real logging solution.
- **Verdict**: Essential tool for any Docker-based setup. Use it alongside, not instead of, a proper logging solution.

#### Seq (Structured Log Server)

Purpose-built structured log server with powerful search and visualization.

- **Resource requirements**: LOW-MEDIUM. Single process. Reasonable RAM usage.
- **Setup complexity**: LOW. Docker or native install. Web UI. Excellent developer experience.
- **Truly free**: PARTIALLY. Free "Individual" license for single user. As of 2025.1, the free tier has a 50GB storage limit. Full license is $660/year.
- **Features**: Structured JSON log search, SQL-like queries, dashboards, alerts. OpenTelemetry trace ingestion (since 2024.1). Excellent correlation of structured data.
- **Key limitation**: Primarily .NET-ecosystem oriented (Serilog integration is first-class). Node.js/Python support exists but is not the primary focus. Closed source.
- **Community health**: Active development (Datalust). 2025.1 preview released. Small but loyal community.
- **Best for**: .NET developers. Solo developers who want excellent structured log search with minimal setup.
- **Verdict**: Good option if you can live with 50GB limit and single-user restriction. Closed source is a downside.

#### Logward (Lightweight Syslog Server)

New open-source log management for small environments.

- **Resource requirements**: LOW. Built on TimescaleDB + Fastify. Lower RAM than Java-based stacks. 5 Docker containers via compose.
- **Setup complexity**: LOW. 5-minute Docker Compose setup. ARM64 / Raspberry Pi compatible.
- **Features**: Syslog ingestion, Sigma rules for detection, built-in alerting (email, webhook), web UI. Accepts logs from Fluent Bit, Vector, Filebeat, rsyslog, or direct API.
- **Truly free**: YES. Open source.
- **Key limitation**: ALPHA stage as of late 2025. Limited feature set. Very new project.
- **Community health**: NASCENT. Just emerging. Active development but too early to assess long-term viability.
- **Best for**: Home lab syslog collection. Experimenting with lightweight log management.
- **Verdict**: Interesting but too immature for production reliance. Watch for maturation.

#### Structured Logging to Files/SQLite

The simplest possible approach: log structured JSON to files or SQLite.

- **Setup**: Zero infrastructure. Pino (Node.js) outputs structured JSON to stdout by default. Redirect to files. Optionally write a simple transport to SQLite.
- **Resource requirements**: ZERO additional. Just your application process.
- **Search**: `jq` for JSON files. SQL queries for SQLite. No fancy UI.
- **Retention**: Simple log rotation (logrotate) or SQLite with TTL-based deletion.
- **Best for**: The starting point. If you cannot articulate why you need more, you probably do not need more.
- **Verdict**: Underrated. Pino JSON files + `jq` + simple SQLite for aggregation handles 80% of a solo developer's debugging needs. Add a real platform when you have a real problem.

### 4. OpenTelemetry as Universal Instrumentation Standard

#### Current Maturity (2025-2026)

OpenTelemetry has reached a critical maturity threshold:

- **JavaScript/Node.js SDK 2.0** released March 2025. Traces and metrics are **STABLE**. Logs are still in development but functional.
- **Minimum Node.js**: 18.19.0+ or 20.6.0+. Minimum TypeScript: 5.0.4. Compilation target: ES2022.
- **Auto-instrumentation**: Supports Express, Fastify, NestJS, Prisma, TypeORM, and many more popular Node.js libraries automatically.
- **Pino integration**: [`pino-opentelemetry-transport`](https://github.com/pinojs/pino-opentelemetry-transport) sends Pino logs as OTLP. [`@opentelemetry/instrumentation-pino`](https://www.npmjs.com/package/@opentelemetry/instrumentation-pino) injects trace context (trace_id, span_id) into Pino log records for correlation.
- **Python**: Auto-instrumentation for Flask, Django, FastAPI, SQLAlchemy, requests. Zero-code instrumentation via `opentelemetry-instrument` wrapper. Traces and metrics stable. Logs: auto-instrumentation disabled by default, OTel SDK attaches OTLP handler to Python's standard logging.
- **API stability promise**: Your instrumentation code using `@opentelemetry/api` remains the same even across SDK major versions.

#### Collector Landscape

Three main options for routing telemetry data:

| Collector | Best For | Config Language | Key Strength | Key Weakness |
|-----------|----------|-----------------|--------------|--------------|
| **OTel Collector** (upstream) | Vendor-neutral, maximum flexibility | YAML | Widest receiver/exporter support | More verbose config |
| **Grafana Alloy** | Grafana stack users | River (HCL-like) | Native Prometheus/Loki integration, live pipeline UI | Ecosystem lock-in concerns |
| **Vector** | Complex transformations, non-OTel sources | TOML/YAML + VRL | Fastest (Rust), best transform language | No generic OTLP sink |

**Recommendation**: Use the upstream OTel Collector unless you are committed to the Grafana stack (then Alloy) or need complex transformations (then Vector).

#### GPU Metrics

NVIDIA DCGM Exporter exposes GPU metrics in Prometheus format on port 9400. Pre-built Grafana dashboard available (ID: 12239). Works with any Prometheus-compatible metrics backend. Docker: `docker run --gpus all -p 9400:9400 nvcr.io/nvidia/k8s/dcgm-exporter`.

### 5. Architecture: All-in-One vs. Separate Concerns

#### The 2025-2026 Consensus

The industry has moved away from the "three pillars" (logs, metrics, traces) as separate concerns and toward **correlated observability**. The real value is not in collecting each signal independently, but in being able to jump from a metric anomaly to related traces to relevant logs in seconds.

Key insight from the research: **the mental model of "separate concerns" is correct at the instrumentation layer but wrong at the consumption layer**:

1. **Instrument separately**: Use Pino for structured logs, OTel SDK for traces, Prometheus client for metrics. Each has different semantics and different collection patterns.
2. **Correlate at collection**: Inject trace_id/span_id into log records. Use exemplars to link metrics to traces. Use the OTel Collector to route all signals.
3. **View together**: A single UI (Grafana, SigNoz, etc.) that lets you pivot between signals is dramatically more useful than separate tools.

#### What NOT to Do

- Do not try to make everything a log. Metrics are not logs. Traces are not logs.
- Do not start with a full observability platform if you do not have a service that requires it.
- Do not run Elasticsearch for 5 Node.js projects. That is like buying a semi-truck to commute to work.

### 6. Minimal Viable Self-Hosted Logging for a Solo Developer

#### Recommended Tier System

**Tier 0: Start Here (Zero Infrastructure)**
- Pino for Node.js (JSON structured output, 5x faster than Winston)
- Python `structlog` or standard `logging` with JSON formatter
- Log to stdout, let Docker/systemd capture
- Dozzle for real-time Docker log viewing (7MB, zero config)
- `jq` for ad-hoc log searching
- Cost: $0, 0 additional RAM

**Tier 1: Centralized Logs (When You Need History)**
- Add Grafana Loki (monolithic mode, ~512MB RAM) + Grafana (~256MB RAM)
- Alloy or Fluent Bit as log shipper
- Label-based log browsing across all services
- Prometheus node_exporter + DCGM exporter for system/GPU metrics if needed
- Cost: ~1GB RAM total

**Tier 2: Full Observability (When You Need Tracing)**
- Option A: SigNoz single binary (~4GB RAM) -- simplest all-in-one
- Option B: OpenObserve single binary (~2GB RAM) -- most resource-efficient
- Option C: Full Grafana LGTM stack (~3-4GB RAM) -- most flexible/extensible
- Add OpenTelemetry instrumentation to apps (pino-opentelemetry-transport, OTel SDK)
- Correlated logs, metrics, traces in one UI
- Cost: 2-4GB RAM

**Tier 3: Production-Grade (When You Run Real Services)**
- Grafana LGTM with proper retention policies
- OTel Collector with sampling/filtering pipelines
- Alerting (Grafana Alerting or SigNoz alerts)
- Object storage backend for Loki/Tempo (S3/MinIO)
- Cost: 4-8GB RAM + storage

#### The Honest Recommendation for Your Setup

For ~5-10 projects on a single machine:

1. **Right now**: Pino (Node.js) + structlog (Python) + Dozzle. This is free, takes 5 minutes, and covers 80% of debugging needs.

2. **When you find yourself SSH-ing into machines to grep logs**: Add Loki + Grafana. Monolithic Loki is trivially lightweight.

3. **When you need to understand request flows across services**: Add OpenTelemetry tracing + either SigNoz or Tempo. SigNoz is easier (one deployment); Tempo is more flexible (composable with existing Grafana).

4. **When you need metrics dashboards**: Add Prometheus (if not already). This is the one component that's almost always worth having from day one if you care about system metrics.

Do not start at Tier 2 or 3. Observability infrastructure that you do not actively use is just wasted RAM and maintenance burden.

### Comparison Matrix

| Platform | Min RAM | Setup Time | Truly Free | OTel Native | Multi-Source | Community | Best For |
|----------|---------|------------|-----------|-------------|--------------|-----------|----------|
| **Grafana LGTM** | ~3-4GB | Hours | Yes (Apache 2.0) | Yes (via Alloy) | Excellent | Excellent | Maximum flexibility |
| **SigNoz** | ~4GB | 30 min | Yes (community) | Yes (native) | Excellent | Good | Best all-in-one UX |
| **ClickStack** | ~4GB | 15 min | Yes (MIT/Apache) | Yes (native) | Good | Good (evolving) | Session replay + backend |
| **OpenObserve** | ~2GB | 5 min | Yes (AGPL) | Yes | Good | Good | Lowest resource all-in-one |
| **Uptrace** | ~3-4GB | 30 min | Yes (BSL) | Yes (native) | Excellent | Moderate | OTel-first tracing focus |
| **Loki + Grafana** | ~1GB | 30 min | Yes (Apache 2.0) | Via collector | Good | Excellent | Lightweight log aggregation |
| **Elasticsearch** | ~8-16GB | Hours | OpenSearch only | Via collector | Excellent | Good | Full-text search at scale |
| **Graylog** | ~8GB+ | Hours | No (2GB limit) | Via collector | Good | Declining | Security/compliance (avoid) |
| **Dozzle** | ~10MB | 2 min | Yes (Apache 2.0) | No | Docker only | Good | Real-time Docker logs |
| **Seq** | ~512MB | 15 min | Partial (50GB cap) | Since 2024.1 | .NET-focused | Small | Structured log search |
| **Logward** | ~512MB | 5 min | Yes | No | Syslog + API | Nascent | Home lab syslog (alpha) |
| **Files + jq** | 0 | 0 | Yes | No | Manual | N/A | Starting point |

## Open Questions

1. **OpenObserve production reliability**: Claims are impressive but fewer production case studies than Grafana/SigNoz. Needs real-world validation for sustained multi-month operation.
2. **ClickStack post-acquisition direction**: Will ClickHouse maintain the open-source commitment or gradually gate features? The MIT/Apache licensing is promising.
3. **OTel Logs stability for JS**: Still marked "in development" in the JS SDK. When will it reach stable status?
4. **SQLite as a log sink**: No established tooling for a Pino->SQLite transport with a simple query UI. Could be a useful micro-project (Pino transport that writes to SQLite + a simple web UI for querying).
5. **Sampling strategies**: For a solo developer, how aggressive should trace sampling be? Head-based sampling at the collector level is the standard approach, but what ratio is appropriate for low-traffic services?

## Extracted Principles

Principles extracted to `principles/self-hosted-observability.md`.

## Sources

### All-in-One Platforms
- [SigNoz GitHub](https://github.com/SigNoz/signoz)
- [SigNoz Single Binary](https://signoz.io/blog/launching-signoz-single-binary/)
- [SigNoz Resource Planning](https://signoz.io/docs/setup/capacity-planning/community/resources-planning/)
- [ClickHouse acquires HyperDX](https://clickhouse.com/blog/clickhouse-acquires-hyperdx-the-future-of-open-source-observability)
- [ClickStack observability](https://clickhouse.com/use-cases/observability)
- [OpenObserve GitHub](https://github.com/openobserve/openobserve)
- [Uptrace GitHub](https://github.com/uptrace/uptrace)
- [Grafana docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- [Self-hosted Grafana LGTM deep dive](https://blog.tarazevits.io/a-deep-dive-into-my-self-hosted-grafana-lgtm-stack/)

### Log Aggregation
- [Loki deployment modes](https://grafana.com/docs/loki/latest/get-started/deployment-modes/)
- [Loki vs Elasticsearch](https://signoz.io/blog/loki-vs-elasticsearch/)
- [Graylog free/open](https://graylog.org/products/source-available/)
- [Graylog SMB license retiring](https://community.graylog.org/t/smb-license-program-retiring-dec-31-2025-updated/36402)

### Lightweight Options
- [Dozzle](https://dozzle.dev/)
- [Dozzle GitHub](https://github.com/amir20/dozzle)
- [Seq](https://datalust.co/)
- [Logward GitHub](https://github.com/logward-dev/logward)

### OpenTelemetry
- [OTel JS SDK 2.0 announcement](https://opentelemetry.io/blog/2025/otel-js-sdk-2-0/)
- [OTel JS documentation](https://opentelemetry.io/docs/languages/js/)
- [OTel Python zero-code instrumentation](https://opentelemetry.io/docs/zero-code/python/)
- [pino-opentelemetry-transport](https://github.com/pinojs/pino-opentelemetry-transport)
- [@opentelemetry/instrumentation-pino](https://www.npmjs.com/package/@opentelemetry/instrumentation-pino)

### Collectors and Pipelines
- [Grafana Alloy GitHub](https://github.com/grafana/alloy)
- [OTel Collector vs Grafana Alloy comparison](https://fusion-reactor.com/blog/opentelemetry-collector-vs-grafana-alloy-which-should-you-choose/)
- [Vector.dev](https://vector.dev/)

### GPU Monitoring
- [NVIDIA DCGM Exporter](https://github.com/NVIDIA/dcgm-exporter)
- [DCGM Exporter Grafana Dashboard](https://grafana.com/grafana/dashboards/12239-nvidia-dcgm-exporter-dashboard/)

### Node.js Logging
- [Pino vs Winston comparison](https://betterstack.com/community/comparisons/pino-vs-winston/)
- [Top Node.js logging frameworks 2025](https://www.dash0.com/faq/the-top-5-best-node-js-and-javascript-logging-frameworks-in-2025-a-complete-guide)

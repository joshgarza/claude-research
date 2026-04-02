# Self-Hosted Observability

## Summary

Principles for choosing and operating self-hosted logging, metrics, and tracing infrastructure. Biased toward solo developers and small teams running heterogeneous projects on constrained hardware. The core insight: start with structured logging to stdout and add infrastructure only when you have a real problem to solve.

## Principles

### Start at Tier 0 and Earn Your Way Up
- **What:** Begin with Pino (Node.js) / structlog (Python) logging to stdout + Dozzle for Docker log viewing. Add centralized logging (Loki) only when you find yourself SSH-ing into machines to grep logs. Add tracing only when you need to understand cross-service request flows.
- **Why:** Observability infrastructure you do not actively use is wasted RAM and maintenance burden. Every component you deploy is a component you must update, debug, and keep running.
- **When:** Always. The exception is if you are deploying a multi-service system from day one with known observability requirements.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### Instrument Separately, Correlate at Collection, View Together
- **What:** Use purpose-built tools for each signal type (Pino for logs, OTel SDK for traces, Prometheus client for metrics). Inject trace_id/span_id into log records. Route all signals through the OTel Collector. View in a unified UI.
- **Why:** Each signal type has different semantics and collection patterns. Trying to make everything a log (or everything a metric) leads to poor data quality. But viewing them separately loses the correlation that makes observability valuable.
- **When:** When you adopt tracing (Tier 2+). At Tier 0-1, just structured logging is sufficient.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### Pino Over Winston for Node.js
- **What:** Use Pino as the default Node.js logging library. It outputs structured JSON by default, is 5x faster than Winston, and has first-class OpenTelemetry integration via pino-opentelemetry-transport.
- **Why:** Performance matters for logging because it is on the hot path of every request. Structured JSON output makes logs machine-parseable for any downstream system. The OTel transport means you can upgrade from file-based to centralized logging without changing application code.
- **When:** All new Node.js projects. Migration from Winston is worth doing if you are adding centralized logging.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### Loki for Lightweight Log Aggregation, Not Elasticsearch
- **What:** For a solo developer's log aggregation needs, Grafana Loki in monolithic mode (~512MB RAM, up to 20GB/day) is the right choice. Do not deploy Elasticsearch/OpenSearch unless you have a specific full-text search requirement.
- **Why:** Loki does not index log content, only labels. This makes it dramatically lighter than Elasticsearch (which requires 8-16GB RAM minimum). The trade-off, limited ad-hoc full-text search, rarely matters for debugging individual services.
- **When:** When you need centralized log browsing across multiple services (Tier 1). Switch to Elasticsearch only if you have compliance/audit requirements for arbitrary full-text search across large volumes.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### OpenTelemetry is Production-Ready for Node.js/TypeScript
- **What:** OTel JS SDK 2.0 (March 2025) has stable traces and metrics. Auto-instrumentation covers Express, Fastify, NestJS, Prisma, and more. Minimum Node.js 18.19+, TypeScript 5.0.4+.
- **Why:** OTel is the CNCF standard. Instrumenting with OTel means your telemetry data works with any backend (Grafana, SigNoz, Datadog, etc.) without code changes. The ecosystem has reached the tipping point where not using OTel means vendor lock-in.
- **When:** When adding tracing to any Node.js service. For logs, OTel JS logs are still in development, so use Pino with the OTel transport bridge instead of native OTel logs.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### Use the Upstream OTel Collector Unless You Have a Reason Not To
- **What:** Default to the standard OpenTelemetry Collector for routing telemetry. Use Grafana Alloy only if committed to the Grafana ecosystem. Use Vector only if you need complex log transformations (VRL is superior for that).
- **Why:** The upstream collector is vendor-neutral. Alloy's River config language and ecosystem tie you to Grafana. Vector lacks a generic OTLP sink, limiting its use as an OTel pipeline.
- **When:** When choosing a telemetry collection/routing layer.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### SigNoz or OpenObserve for All-in-One, Not Grafana LGTM
- **What:** If you want a single-deployment all-in-one observability platform, choose SigNoz (4GB RAM, best UX) or OpenObserve (2GB RAM, most efficient). Do not assemble the full Grafana LGTM stack unless you need component-level flexibility.
- **Why:** The Grafana LGTM stack is 4-6 separate services with different config formats. For a solo developer, the operational overhead of maintaining Loki + Prometheus + Tempo + Grafana + Alloy separately is not justified when SigNoz or OpenObserve provide the same capabilities in a single binary.
- **When:** When you are ready for Tier 2 observability (logs + metrics + traces). If you are at Tier 1 (just logs), Loki + Grafana alone is simpler than either.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### Dozzle is Non-Negotiable for Docker Environments
- **What:** Always run Dozzle alongside Docker workloads. It is a 7MB container with zero config that provides real-time log viewing, container shell access, and SQL-based log analysis.
- **Why:** It solves the most common debugging workflow ("what is this container doing right now?") with zero cost. The SQL analysis via in-browser DuckDB/WASM is remarkably powerful for zero-infrastructure tooling.
- **When:** Any Docker-based deployment. It complements, never replaces, a proper logging solution.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### Avoid Graylog and Elasticsearch for Small-Scale Self-Hosting
- **What:** Graylog's free tier has a 2GB/day limit, SSPL licensing, declining open-source investment, and requires Elasticsearch + MongoDB. Elasticsearch requires 8-16GB+ RAM minimum. Neither is appropriate for solo developers.
- **Why:** The resource cost and operational complexity are disproportionate to the value for small-scale use. Better alternatives exist at every price point.
- **When:** Always, unless you have specific security/compliance requirements that mandate Graylog's SIEM features or Elasticsearch's full-text search at scale.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

### NVIDIA DCGM Exporter for GPU Metrics
- **What:** Use the NVIDIA DCGM Exporter container to expose GPU metrics in Prometheus format. Pre-built Grafana dashboard (ID 12239) available. Docker: `docker run --gpus all -p 9400:9400 nvcr.io/nvidia/k8s/dcgm-exporter`.
- **Why:** This is the official, well-maintained path for GPU telemetry. It integrates directly with any Prometheus-compatible metrics backend.
- **When:** When running GPU workloads (ML training, inference) that you want to monitor.
- **Source:** research/2026-03-02-self-hosted-observability-landscape.md

## Revision History
- 2026-03-02: Initial extraction from research/2026-03-02-self-hosted-observability-landscape.md.

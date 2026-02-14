# Error Handling & Resilience Principles

## Summary
Patterns for keeping TypeScript/Node.js applications running reliably in production. Covers error taxonomy, type-safe error handling, structured API errors, circuit breakers, retries, timeouts, bulkheads, graceful degradation, dead letter queues, health checks, React error boundaries, and alerting. Synthesized from Martin Fowler, Google SRE, Netflix TechBlog, AWS Builders' Library, Stripe docs, and Node.js official docs.

## Principles

### Crash on Programmer Errors, Handle Operational Errors
- **What:** Distinguish operational errors (expected failures: network timeout, invalid input, disk full) from programmer errors (bugs: TypeError, null dereference, assertion failure). Handle operational errors with recovery logic. Crash immediately on programmer errors — don't try to recover from bugs.
- **Why:** Recovering from a bug leaves the process in an undefined state. Crashing and restarting via a process manager (PM2, K8s) is safer than continuing with corrupted state.
- **When:** Always. This is the Node.js error handling foundation (from Joyent's original guidance, still canonical).
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### neverthrow for Type-Safe Errors
- **What:** Use `neverthrow` for Result types (`Ok<T>` / `Err<E>`) in business logic. Reserve Effect-TS for critical services needing structured concurrency, resource safety, and dependency injection. Use plain try/catch only at system boundaries.
- **Why:** TypeScript's throw/catch is untyped — you can't know what errors a function throws at compile time. `neverthrow` makes error paths explicit and exhaustive without the learning curve of Effect-TS.
- **When:** Business logic, service layers, anywhere error handling matters. Effect-TS for payment processing, critical workflows.
- **When NOT:** Simple scripts, prototype code, or teams unfamiliar with functional patterns (for Effect-TS).
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Stripe-Model Structured Error Responses
- **What:** Every API error returns: `type` (category), `code` (machine-readable string), `message` (human-readable), `param` (which field), `doc_url` (documentation link). Use HTTP status codes correctly. Errors are a product — design them.
- **Why:** Stripe's error format is the industry gold standard. Machine-readable errors enable programmatic handling. Human-readable messages enable debugging. Documentation links reduce support burden.
- **When:** Every API. Define error codes as an enum. Never change a code's meaning — add new codes, don't rename or remove.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Circuit Breakers on Every External Dependency
- **What:** Wrap every external service call (APIs, databases, other microservices) in a circuit breaker. Use cockatiel for TypeScript — it covers retry, circuit breaker, timeout, bulkhead, and fallback in one composable library.
- **Why:** Without circuit breakers, a slow/failing dependency causes cascading failures (thread exhaustion, timeout propagation). The circuit breaker fails fast, giving the downstream time to recover.
- **When:** Every call to an external service. Configure: 5 consecutive failures to trip, 30s reset timeout, 3 half-open probes.
- **When NOT:** In-process function calls, local filesystem reads.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Full Jitter Exponential Backoff with Retry Budgets
- **What:** Retry with `sleep = random(0, min(cap, base * 2^attempt))` (AWS full jitter). Base 100ms, cap 10-30s, max 3-5 retries. Implement retry budgets: max 10% retry traffic per client, retry only at the layer immediately above the failure.
- **Why:** Without jitter, retries synchronize and create thundering herds. Without budgets, layered retries amplify (3 layers x 3 retries = 27 attempts). Google SRE: retry amplification is the #1 cause of cascading failures.
- **When:** All retryable operations. Only retry if the operation is idempotent (use Idempotency-Key for POST).
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Explicit Timeouts on Every External Call
- **What:** Set connection timeout (500ms-2s), request timeout (2-30s), and aggregate SLA timeout per user-facing request. Inner timeouts shorter than outer. Propagate deadlines across services via headers (gRPC pattern: `X-Request-Deadline`).
- **Why:** Without timeouts, a slow downstream exhausts connection pools and cascades failures. Default timeouts are often infinite. Deadline propagation prevents wasted work on already-expired requests.
- **When:** Every external call. No exceptions. Never rely on library defaults.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Bulkhead-Isolate Independent Dependencies
- **What:** Separate connection/semaphore pools per external dependency. Use cockatiel's BulkheadPolicy to limit concurrent calls. If dependency A's pool is exhausted, dependency B continues working.
- **Why:** Shared resource pools mean one failing dependency can starve all others. Netflix's Hystrix used per-dependency thread pool isolation — the pattern is proven at scale.
- **When:** Services with multiple external dependencies. Critical when one dependency is less reliable than others.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Design Four Degradation Levels
- **What:** Plan four states: (1) full functionality, (2) degraded but functional (non-critical features off), (3) read-only mode (stale cached data), (4) static fallback. Use feature flags as kill switches for runtime degradation without deploys.
- **Why:** Partial availability is better than total outage. Netflix sheds non-critical traffic before touching core playback. Feature flags (Unleash, Flagsmith) enable instant degradation.
- **When:** Any production service. Define degradation levels before you need them — during an incident is too late.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Never Silently Discard Failed Messages
- **What:** Every queue (BullMQ, Kafka) must have dead letter queue handling. Set max retries with exponential backoff. Monitor DLQ depth. Implement replay tooling for reprocessing after fixes. Alert on DLQ threshold.
- **Why:** Silent message loss is invisible data loss. A spike in DLQ depth signals a systematic problem. Replay capability means bugs in message processing are recoverable.
- **When:** Every queue consumer. BullMQ: `removeOnFail: false`. Kafka: dedicated `<topic>.dlq` topic with original metadata in headers.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Liveness Checks Process Health, Readiness Checks Dependencies
- **What:** Liveness probe: "is the process alive?" — simple, lightweight, never check external dependencies (failure restarts the container). Readiness probe: "can this serve traffic?" — check database, cache, critical dependencies (failure removes from load balancer). Startup probe: disable liveness/readiness during slow starts.
- **Why:** Checking dependencies in liveness probes causes restart loops when a database is temporarily down. Readiness probes gracefully remove unhealthy instances from traffic.
- **When:** Every Kubernetes deployment. Set timeouts on dependency health checks — a hanging DB check shouldn't hang the readiness probe.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Granular React Error Boundaries with Retry
- **What:** Wrap individual features in `<ErrorBoundary>`, not the entire app. Use `react-error-boundary` with `fallbackRender` for retry UI. Report errors to Sentry via `onError`. Error boundaries don't catch event handlers or async code — use try/catch there.
- **Why:** A global error boundary means one broken widget takes down the whole page. Granular boundaries contain failures to the affected feature.
- **When:** Every React application with multiple independent features. Add `onError` → Sentry from day one.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

### Tiered Alerting to Prevent Alert Fatigue
- **What:** P1 (page immediately): 5xx rate >5%, critical service down. P2 (Slack): new error type, error rate >1%. P3 (daily digest): warnings, trends. Use percentage-based thresholds, not absolute counts. Route alerts by code ownership. Audit alert rules quarterly.
- **Why:** Alert fatigue causes real incidents to be missed. Dynamic thresholds adapt to traffic changes. Ownership routing ensures the right team responds.
- **When:** Every production service with monitoring. Start with Sentry for error reporting, graduate to custom dashboards.
- **Source:** [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-error-handling-resilience.md](../research/2026-02-14-error-handling-resilience.md).

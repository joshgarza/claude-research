---
date: 2026-02-14
topic: Error Handling and Resilience Patterns
status: complete
tags: [error-handling, resilience, circuit-breaker, retry, graceful-degradation, chaos-engineering, health-checks]
related: [2026-02-13-backend-api-practices.md, 2026-02-14-backend-api-practices-update.md]
---

# Error Handling and Resilience Patterns

## Context

This research fills a critical gap in our production-readiness knowledge. The backend principles file already covers Effect-TS and idempotency at a high level, but doesn't go deep on the full spectrum of resilience patterns needed to take a TypeScript/Node.js application from demo to production. This research covers error taxonomy, result types, structured error responses, circuit breakers, retry strategies, timeouts, bulkheads, graceful degradation, dead letter queues, health checks, chaos engineering, React error boundaries, global error handling, and error reporting. The focus is on practical patterns for TypeScript/Node.js stacks, with source material drawn from Tier 1 sources (Martin Fowler, Google SRE, Netflix TechBlog, Node.js docs, Michael Nygard's "Release It!") and Tier 2 sources (Stripe docs, AWS Builders' Library, Effect-TS docs, Sentry docs, cockatiel/opossum docs).

## Findings

### 1. Error Handling Taxonomy

Node.js distinguishes two fundamental error categories (from Joyent/Node.js best practices, Yoni Goldberg's Node Best Practices):

**Operational errors** — runtime problems in correctly-written code. Expected failures the program must handle:
- Network timeouts, connection refused
- Invalid user input
- Database constraint violations
- Out of memory
- File not found
- Rate limiting / 429 responses

**Programmer errors** — bugs in the code. Unexpected, should not be "handled" in the traditional sense:
- Reading property of `undefined`
- Passing wrong argument types
- Off-by-one errors
- Logic errors

**The critical distinction:** Operational errors should be caught, handled, and recovered from. Programmer errors should crash the process and restart (via PM2, systemd, container orchestrator). Attempting to "handle" a programmer error leaves the process in an undefined state.

**Recoverable vs. fatal within operational errors:**
- Recoverable: Retry the operation (transient network failure), return error to user (invalid input), use fallback (cache miss)
- Fatal operational: Out of memory, disk full, corrupted state — crash and restart

Source: [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices), [Node.js process docs](https://nodejs.org/api/process.html), [Honeybadger Node.js error guide](https://www.honeybadger.io/blog/errors-nodejs/)

### 2. Result Types in TypeScript

TypeScript's native `throw`/`catch` is unsafe — thrown values are untyped (`unknown`), errors aren't visible in function signatures, and there's no compiler enforcement for handling errors. Three libraries address this:

#### neverthrow (recommended starting point)
- ~900K weekly npm downloads, 5.8K GitHub stars
- Simple `Result<T, E>` type: `Ok<T>` or `Err<E>`
- Instance methods: `result.map()`, `result.mapErr()`, `result.andThen()`
- `ResultAsync<T, E>` for async operations
- `safeTry` for cleaner chaining (generator-based, avoids callback nesting)
- Minimal API surface, easy adoption — can introduce into existing codebases incrementally
- **Use when:** You want type-safe errors without changing your programming paradigm

#### Effect-TS (comprehensive, for critical services)
- `Effect<A, E, R>` — success type, error type, AND dependency type (requirements)
- Functions on values (not instance methods): `Either.map(result, ...)`, pipe-style
- Better tree-shaking than instance methods
- Typed errors + structured concurrency (fibers) + resource safety (scopes) + dependency injection
- `Deferred` for coordinating async operations, `Semaphore` for concurrency limiting
- Effect Cluster for distributed durable workflows
- **Use when:** Building critical services where reliability, concurrency control, and dependency injection matter. Teams comfortable with functional patterns.
- **Don't use when:** Existing codebases (migration is non-trivial), simple CRUD apps, teams unfamiliar with FP

#### ts-results
- ~106K weekly npm downloads, 1.3K GitHub stars
- Similar API to neverthrow but less ecosystem/community
- Not recommended over neverthrow given download/community gap

**Practical adoption path:** Start with `neverthrow` for type-safe errors in existing code. Evaluate Effect-TS for new critical services. Don't use both in the same codebase — pick one approach per service.

Source: [Effect vs neverthrow docs](https://effect.website/docs/additional-resources/effect-vs-neverthrow/), [neverthrow GitHub](https://github.com/supermacro/neverthrow), [Harbor: Why We Don't Use Effect-TS](https://runharbor.com/blog/2025-11-24-why-we-dont-use-effect-ts), [npm-compare](https://npm-compare.com/fp-ts,neverthrow,ts-results,ts-toolbelt)

### 3. Structured Error Responses

Stripe's error system is the gold standard for API error design:

**Error response structure:**
```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "param": "card_number",
    "doc_url": "https://docs.stripe.com/error-codes#card-declined"
  }
}
```

**Key components:**
- `type` — broad error category (machine-readable): `api_error`, `card_error`, `invalid_request_error`, `authentication_error`, `rate_limit_error`, `idempotency_error`, `permission_error`
- `code` — specific error code (machine-readable): `card_declined`, `expired_card`, `invalid_number`
- `message` — human-readable description
- `param` — which parameter caused the error (for validation errors)
- `doc_url` — link to documentation for this specific error code

**Error hierarchy for TypeScript APIs:**

```typescript
// Base error class
class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// Specific error types
class ValidationError extends AppError { /* 400 */ }
class AuthenticationError extends AppError { /* 401 */ }
class AuthorizationError extends AppError { /* 403 */ }
class NotFoundError extends AppError { /* 404 */ }
class ConflictError extends AppError { /* 409 */ }
class RateLimitError extends AppError { /* 429 */ }
class InternalError extends AppError { /* 500 */ }
```

**Rules for error codes:**
- Use SCREAMING_SNAKE_CASE for machine-readable codes
- Never expose internal implementation details (stack traces, SQL errors) in responses
- Include request ID / trace ID in every error response for debugging
- Error codes are a public API — treat them as versioned, don't rename or remove

Source: [Stripe API errors](https://docs.stripe.com/api/errors), [Stripe error handling docs](https://docs.stripe.com/error-handling), [Stripe error codes](https://docs.stripe.com/error-codes)

### 4. Circuit Breaker Pattern

Coined for software by Michael Nygard in "Release It!" (2007), popularized by Martin Fowler's article.

**Three states:**
1. **Closed** (normal): Requests flow through. Failures are counted.
2. **Open** (tripped): Requests fail immediately without calling the downstream service. A timeout starts.
3. **Half-Open** (testing): After timeout, one probe request is allowed through. If it succeeds, circuit closes. If it fails, circuit opens again.

**Configuration parameters:**
- `failureThreshold` — number of failures before tripping (e.g., 5 failures)
- `failureRateThreshold` — percentage of failures in a rolling window (e.g., 50% over 10 seconds)
- `resetTimeout` — how long to stay open before trying half-open (e.g., 30 seconds)
- `halfOpenMaxAttempts` — requests to allow in half-open state (e.g., 3)
- `rollingWindowSize` — time window for counting failures (e.g., 10 seconds)

**TypeScript libraries:**

| Library | Focus | Key Differentiator |
|---------|-------|--------------------|
| **cockatiel** | Full resilience toolkit | Policy composition (wrap retry + circuit breaker + timeout + bulkhead + fallback). Inspired by .NET Polly. 3.2.1, zero vulns. |
| **opossum** | Circuit breaker specialist | Best docs for circuit breaker specifically. Browser + Node.js. Red Hat/Nodeshift maintained. |
| **polly-js** | Lightweight retry/circuit | Subset of functionality. Less maintained. |

**Cockatiel is the recommended choice** for TypeScript — it covers retry, circuit breaker, timeout, bulkhead, and fallback in a single composable library with a consistent interface. Policy composition via `wrap()`:

```typescript
import { CircuitBreakerPolicy, retry, handleAll, wrap, ExponentialBackoff } from 'cockatiel';

const retryPolicy = retry(handleAll, { maxAttempts: 3, backoff: new ExponentialBackoff() });
const circuitBreaker = new CircuitBreakerPolicy({
  halfOpenAfter: 30_000,
  breaker: new ConsecutiveBreaker(5)
});
const combined = wrap(retryPolicy, circuitBreaker);

await combined.execute(() => callExternalService());
```

**When to use circuit breakers:**
- Every call to an external service (third-party APIs, databases, other microservices)
- Queue consumers calling downstream services
- Any I/O operation that can fail and cause cascading failures

**When NOT to use:**
- In-process function calls
- Calls to local resources (local filesystem reads are better handled with simple retry)

Source: [Martin Fowler Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html), [Netflix Hystrix](https://netflixtechblog.com/introducing-hystrix-for-resilience-engineering-13531c1ab362), [Netflix fault tolerance](https://netflixtechblog.com/fault-tolerance-in-a-high-volume-distributed-system-91ab4faae74a), [cockatiel GitHub](https://github.com/connor4312/cockatiel), [opossum GitHub](https://github.com/nodeshift/opossum)

### 5. Retry Strategies

#### Exponential Backoff with Jitter

From AWS Architecture Blog and Builders' Library — the definitive reference on retry strategies:

**Base formula:** `sleep = min(cap, base * 2^attempt)`

**Three jitter strategies:**
1. **Full Jitter** (recommended): `sleep = random(0, min(cap, base * 2^attempt))` — spreads retries most evenly
2. **Equal Jitter**: `sleep = min(cap, base * 2^attempt) / 2 + random(0, min(cap, base * 2^attempt) / 2)` — guaranteed minimum wait
3. **Decorrelated Jitter**: `sleep = min(cap, random(base, sleep_prev * 3))` — each retry based on previous sleep

AWS recommends **Full Jitter** as the default — it has the best characteristics for spreading load and is simplest to implement.

**Typical configuration:**
- Base: 100ms
- Cap: 10-30 seconds
- Max retries: 3-5
- Jitter: Full jitter (always)

#### Retry Budgets (Google SRE)

Individual retry limits are insufficient. Google SRE uses **retry budgets** at multiple levels:

1. **Per-request budget**: Max 3 attempts total. If failed 3 times, bubble up the error.
2. **Per-client budget**: Track ratio of retry traffic. Only retry if retry ratio stays below 10% of total traffic.
3. **Server-wide budget**: E.g., max 60 retries/minute across all requests in a process.

**Retry amplification danger:** In layered systems, retries multiply. If Layer A retries 3x, Layer B retries 3x, Layer C retries 3x, a single request can generate 27 (3^3) attempts at the bottom layer. Google's rule: **retry only at the layer immediately above the failing layer**. Use "overloaded; don't retry" errors (HTTP 503 with `Retry-After` header) to signal upstream.

#### Idempotency Requirements for Safe Retries

Retries are only safe if the operation is idempotent. For POST endpoints:
- Use `Idempotency-Key` header (Stripe pattern, covered in backend principles)
- ACID check-and-execute: Check if idempotency key exists, execute only if not
- Store result for 24 hours, return same response on retry
- Never cache 5xx responses

Source: [AWS Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/), [AWS Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), [Google SRE Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/), [Google SRE Handling Overload](https://sre.google/sre-book/handling-overload/), [Marc Brooker: Jitter](https://brooker.co.za/blog/2015/03/21/backoff.html)

### 6. Timeouts and Deadlines

#### Timeout Hierarchy

Every external call needs a timeout. Without timeouts, a slow downstream service causes thread/connection pool exhaustion, leading to cascading failure.

**Timeout layers:**
1. **Connection timeout**: How long to wait for TCP connection establishment (500ms-2s)
2. **Request/response timeout**: How long to wait for the full response (2-30s depending on operation)
3. **Aggregate/SLA timeout**: Total time budget for a user-facing request across all service calls (e.g., 5s for API, 30s for batch)

**Rules:**
- Always set explicit timeouts. Never rely on defaults (often 0/infinite).
- Inner timeouts must be shorter than outer timeouts.
- Include buffer: if downstream has 5s SLA, set your timeout to 5.5s, not 5s.

#### Deadline Propagation (gRPC Pattern)

Unlike timeouts (duration from now), deadlines are absolute points in time. gRPC propagates deadlines across service boundaries via `grpc-timeout` header:

- Service A sets 5-second deadline and calls Service B
- Service B receives the actual deadline time. When it calls Service C, it passes the remaining deadline.
- No service operates with more time than the original caller intended.
- This prevents wasted work: if the caller's deadline has already passed, downstream services abort immediately.

**For REST/HTTP:** Propagate deadlines manually via custom header (e.g., `X-Request-Deadline`). Each service subtracts elapsed time before passing downstream.

Source: [gRPC Deadlines guide](https://grpc.io/docs/guides/deadlines/), [gRPC and Deadlines blog](https://grpc.io/blog/deadlines/), [Google SRE Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)

### 7. Bulkhead Pattern

Named after ship bulkheads that contain flooding. Isolates resources so that one failing dependency doesn't exhaust resources shared by others.

**Implementation approaches:**
1. **Thread/connection pool isolation**: Separate pools per dependency. If dependency A's pool is exhausted, dependency B's pool is unaffected.
2. **Semaphore isolation**: Limit concurrent calls to a dependency via a semaphore counter. Lighter than thread pools.
3. **Process isolation**: Separate processes/containers per dependency (heaviest, most isolated).

**Cockatiel bulkhead:**
```typescript
import { BulkheadPolicy } from 'cockatiel';

const bulkhead = new BulkheadPolicy(10, 20);
// 10 concurrent executions max, 20 additional in queue
// Exceeding queue throws BulkheadRejectedError
```

**Netflix's approach:** Hystrix used thread pool isolation per dependency. Semaphore isolation for high-throughput, low-latency calls (where thread overhead is too high). Thread pool isolation for calls that can tolerate slightly higher latency.

**When to use:**
- Multiple external dependencies where one's failure shouldn't bring down others
- Shared resources (connection pools, thread pools) that could be monopolized
- Services with mixed criticality workloads

Source: [Netflix Hystrix](https://netflixtechblog.com/introducing-hystrix-for-resilience-engineering-13531c1ab362), [cockatiel GitHub](https://github.com/connor4312/cockatiel), Michael Nygard "Release It!" (2nd edition)

### 8. Graceful Degradation

#### Degradation Levels

Design systems with multiple degradation states, progressively shedding capability:

1. **Full functionality** — everything works, optimal experience
2. **Degraded but functional** — non-critical features disabled, core features intact
3. **Minimal / read-only mode** — writes disabled, cached/stale data served
4. **Static fallback** — static HTML/content, no dynamic features

#### Feature Flags as Kill Switches

Feature flags enable runtime degradation without deploys:
- **Kill switches**: Immediately disable a feature that's causing problems
- **Progressive rollouts**: Limit blast radius by shifting only a portion of traffic
- **Dependency bypass flags**: Skip a non-critical dependency and use a fallback

Libraries: LaunchDarkly (commercial), Unleash (open-source), Flagsmith (open-source)

#### Netflix Prioritized Load Shedding

Netflix implements prioritized load shedding at the service level (2024-2025):
- Requests are classified by priority (e.g., live playback > DVR traffic > pre-fetch > telemetry)
- During overload, lower-priority requests are shed first
- Server-guided backoff for device retries during stress
- Traffic rebalancing across cloud regions

#### Fallback Strategies

1. **Cache fallback**: Return stale cached data when the source is unavailable
2. **Default value fallback**: Return a sensible default instead of an error
3. **Degraded computation**: Use a simpler/faster algorithm when the sophisticated one times out
4. **Static content fallback**: Serve pre-rendered static version of dynamic content
5. **Feature removal**: Disable the feature entirely and hide UI elements

**Context-Aware Graceful Degradation (CAGD)** — a 2025 pattern where microservices dynamically adjust degradation based on system context (load, error rates, dependency health). Systems with CAGD showed 34% faster recovery from failures.

Source: [Netflix prioritized load shedding](https://netflixtechblog.com/enhancing-netflix-reliability-with-service-level-prioritized-load-shedding-e735e6ce8f7d), [Netflix reliable load shedding](https://netflixtechblog.com/keeping-netflix-reliable-using-prioritized-load-shedding-6cc827b02f94), [Unleash graceful degradation](https://www.getunleash.io/blog/graceful-degradation-featureops-resilience)

### 9. Dead Letter Queues

#### BullMQ Pattern

BullMQ (Redis-backed) for Node.js queue processing:

**Job failure flow:**
1. Job is picked up by a worker
2. Processor function throws an exception
3. Worker catches it, moves job to `failed` set
4. If `attempts` configured, job is retried with backoff
5. After all attempts exhausted, job moves to `failed` permanently
6. A separate "dead letter" processor can pick up failed jobs for analysis

**Poison message handling:**
- Set `attempts` (max retries) and `backoff` strategy per job
- Monitor failed jobs count — spike indicates systematic problem vs. single bad message
- Implement a DLQ consumer that logs failed jobs to persistent storage for analysis
- Alert on DLQ depth exceeding threshold
- Never silently discard failed messages

**Configuration:**
```typescript
const queue = new Queue('my-queue');

await queue.add('task', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: 1000, // keep last 1000 completed
  removeOnFail: false, // keep all failed for DLQ analysis
});
```

#### Kafka DLQ Pattern

For Kafka, use a dedicated dead letter topic:
- Consumer attempts processing, on failure publishes to `<topic>.dlq`
- Include original topic, partition, offset, error details in DLQ message headers
- Monitor DLQ topic lag — non-zero means unprocessed failures
- Implement replay tooling: ability to re-process DLQ messages after fixing the bug

**DLQ Monitoring checklist:**
- Alert on DLQ message count exceeding threshold
- Dashboard showing DLQ depth over time
- Error categorization in DLQ messages (transient vs. permanent failure)
- Automated replay for transient failures after configurable delay
- Manual replay tooling for permanent failures after code fix

Source: [BullMQ docs](https://docs.bullmq.io/guide/retrying-failing-jobs), [BullMQ GitHub](https://github.com/taskforcesh/bullmq)

### 10. Health Checks

#### Kubernetes Probe Types

Three probe types with distinct purposes (from Kubernetes docs):

**Liveness probe** — "Is the process alive?"
- Detects deadlocks, hung processes
- On failure: container is restarted
- Should be simple and lightweight — just check if the process can respond
- **Never** check external dependencies in liveness probes
- Must have `successThreshold: 1` (Kubernetes enforces this)

**Readiness probe** — "Can this instance serve traffic?"
- Checks if the application and its dependencies are ready
- On failure: container is removed from service load balancers (not restarted)
- **Should** check critical dependencies (database, cache, etc.)
- Can have higher `successThreshold` (e.g., 3) for stability before re-adding to pool

**Startup probe** — "Has the app finished starting?"
- For applications with slow/variable startup times
- While running, liveness and readiness probes are disabled
- Prevents liveness probe from killing a slow-starting container
- Set `failureThreshold * periodSeconds` > max startup time

#### Configuration Best Practices

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
  # Allows up to 5 minutes for startup (30 * 10s)
```

#### Dependency Health Aggregation

The `/readyz` endpoint should aggregate health of critical dependencies:

```typescript
app.get('/readyz', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    externalApi: await checkExternalApi(),
  };

  const healthy = Object.values(checks).every(c => c.status === 'ok');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
  });
});
```

**Gotcha:** Set timeouts on dependency health checks. A hanging database check should not make the readiness probe hang.

Source: [Kubernetes probe docs](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/), [Kubernetes probe concepts](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)

### 11. Chaos Engineering

#### Principles

From the Chaos Engineering community and Netflix's pioneering work:

1. **Build a hypothesis around steady state** — define what "normal" looks like (latency, error rate, throughput)
2. **Vary real-world events** — simulate failures that actually happen (network partitions, disk full, dependency down, CPU spike)
3. **Run experiments in production** — staging environments don't reveal production-only failure modes
4. **Automate experiments to run continuously** — chaos should be routine, not a one-time exercise
5. **Minimize blast radius** — start small, expand gradually

#### Tools

| Tool | Type | Best For |
|------|------|----------|
| **Gremlin** | Commercial SaaS | Enterprise teams, managed experiments, VMs + containers + cloud |
| **LitmusChaos** | Open source (CNCF Sandbox) | Kubernetes-native chaos with CRDs, extensive fault library |
| **Chaos Mesh** | Open source (CNCF) | Kubernetes-focused, GUI dashboard |
| **AWS Fault Injection Service** | AWS-native | AWS infrastructure chaos |

#### Game Days

Structured team events for proactive resilience testing:

1. **Define scope**: Which service, which failure mode
2. **Set abort conditions**: When to stop if impact exceeds expectations
3. **Involve cross-functional teams**: Dev, Ops, SRE, Security
4. **Execute experiment**: Inject failure, observe
5. **Document findings**: What broke, what held, what was surprising
6. **Remediate**: Fix discovered weaknesses

**When to start chaos engineering:**
- After you have observability (you need to see what's happening)
- After you have basic resilience patterns (circuit breakers, retries, timeouts)
- After you have health checks and automated recovery
- Start with game days (manual, controlled), then graduate to automated chaos
- Not before: if you can't observe failures, you can't learn from them

Source: [Netflix automated failure testing](https://netflixtechblog.com/automated-failure-testing-86c1b8bc841f), [Netflix making API more resilient](https://netflixtechblog.com/making-the-netflix-api-more-resilient-a8ec62159c2d), [Gremlin](https://www.gremlin.com/product/chaos-engineering), [awesome-chaos-engineering](https://github.com/dastergon/awesome-chaos-engineering)

### 12. Error Boundaries in React

#### React Error Boundary Patterns

Error boundaries catch JavaScript errors in their child component tree and display fallback UI:

**Key library:** `react-error-boundary` (maintained by Brian Vaughn, former React team)

**Granular boundaries (not global):** Don't wrap the entire app in one boundary. Wrap individual features:
```tsx
<ErrorBoundary fallback={<SidebarError />}>
  <Sidebar />
</ErrorBoundary>

<ErrorBoundary fallback={<DashboardError />}>
  <Dashboard />
</ErrorBoundary>
```

**Retry pattern with `fallbackRender`:**
```tsx
<ErrorBoundary
  fallbackRender={({ error, resetErrorBoundary }) => (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )}
  onReset={() => {
    // Reset any state that caused the error
  }}
  onError={(error, info) => {
    // Report to Sentry
    Sentry.captureException(error, { extra: info });
  }}
>
  <MyComponent />
</ErrorBoundary>
```

**React 19 improvements:**
- Better error reporting (no duplicate console logs)
- Smoother boundary behavior
- Integration with Suspense for data fetching errors
- `use()` hook + ErrorBoundary for fetch error handling

**Limitations:** Error boundaries do NOT catch:
- Event handler errors (use try/catch)
- Async code outside React lifecycle (use global error handlers)
- Server-side rendering errors (use server-level error handling)

Source: [react-error-boundary GitHub](https://github.com/bvaughn/react-error-boundary), [OneUpTime React error boundaries 2026](https://oneuptime.com/blog/post/2026-01-15-react-error-boundaries/view), [freeCodeCamp Modern React Data Fetching](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained/)

### 13. Global Error Handling in Node.js

#### Process-Level Error Events

**`uncaughtException`** — synchronous errors not caught by any try/catch:
```typescript
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception -- shutting down');
  // Attempt graceful shutdown, then exit
  gracefulShutdown().finally(() => process.exit(1));
});
```

**`unhandledRejection`** — promise rejections without a `.catch()`:
```typescript
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason }, 'Unhandled rejection -- shutting down');
  // Since Node.js 15, unhandled rejections terminate the process by default
  gracefulShutdown().finally(() => process.exit(1));
});
```

**Since Node.js 15+:** Unhandled promise rejections terminate the process by default (no more warnings-only). This is the correct behavior.

#### Graceful Shutdown Pattern

```typescript
async function gracefulShutdown() {
  // 1. Stop accepting new requests
  server.close();

  // 2. Finish in-flight requests (with timeout)
  await Promise.race([
    waitForInFlightRequests(),
    setTimeout(10_000), // 10s max
  ]);

  // 3. Close database connections
  await db.close();

  // 4. Close queue connections
  await queue.close();

  // 5. Flush telemetry/logs
  await telemetry.flush();
}

// Also handle SIGTERM (container orchestrator sending shutdown signal)
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

**Rules:**
- Never try to resume after `uncaughtException` — the process is in an undefined state
- Log the error, attempt graceful shutdown, exit with non-zero code
- Use a process manager (PM2, systemd, K8s) to restart
- Set a hard timeout on graceful shutdown (10-30s) — don't hang forever

Source: [Node.js process docs](https://nodejs.org/api/process.html), [Heroku: Let It Crash](https://www.heroku.com/blog/best-practices-nodejs-errors/), [Galaxy Blog graceful shutdown](https://blog.galaxycloud.app/a-practical-guide-to-graceful-shutdown-in-node-js-applications/)

### 14. Error Reporting and Alerting

#### Sentry Integration Patterns

**Server-side (Node.js/Express/Fastify):**
- Install `@sentry/node` and initialize with DSN before any other imports
- Use middleware for automatic Express/Fastify error capture
- Manually capture with `Sentry.captureException(error)` for caught errors
- Add context: `Sentry.setUser()`, `Sentry.setTag()`, `Sentry.setExtra()`
- Include trace IDs for correlation with OpenTelemetry

**Client-side (React):**
- Install `@sentry/react`
- Use `Sentry.ErrorBoundary` or integrate with `react-error-boundary` via `onError`
- Source maps for readable stack traces — upload during build

#### Error Grouping

Sentry groups similar errors using **fingerprints**:
- Default: groups by stack trace similarity
- Custom fingerprints for better grouping: `Sentry.setFingerprint(['database-timeout', serviceName])`
- Stack trace rules for ignoring noise (third-party libraries, minified code)

**Audit regularly:** Use Sentry Discover to find projects creating disproportionate issues relative to error volume. Customize fingerprinting to reduce noise.

#### Alert Fatigue Prevention

From Sentry's best practices:

1. **Filter non-critical issues**: Add `if` conditions — e.g., only alert on "high priority" issues
2. **Dynamic thresholds**: Use percentage-based alerts (e.g., error rate > 1%) instead of absolute counts that need constant adjustment
3. **Ownership routing**: Use code ownership rules to route alerts to responsible teams
4. **Alert audit cycle**: Review alert rules quarterly for redundancy and noise
5. **Tiered alerting**:
   - P1 (page immediately): 5xx error rate > 5%, critical service down
   - P2 (Slack notification): New error type in production, error rate > 1%
   - P3 (daily digest): New warnings, non-critical error trends
6. **Complement fixed with dynamic thresholds**: Fixed thresholds catch known failure modes; dynamic thresholds catch anomalies from traffic changes

Source: [Sentry alerts best practices](https://docs.sentry.io/product/alerts/best-practices/), [Sentry alerts workshop](https://sentry.io/resources/alerts-workshop-best-practices/), [Sentry automate-group-alert part 1](https://blog.sentry.io/automate-group-and-get-alerted-a-best-practices-guide-to-monitoring-your/), [Sentry automate-group-alert part 2](https://blog.sentry.io/automate-group-and-get-alerted-a-best-practices-guide-part-2/)

## Open Questions

1. **Effect-TS adoption curve**: How long does it take a team to become productive with Effect-TS? The Harbor blog post ("Why We Don't Use Effect-TS") suggests the learning curve is steep enough to offset productivity gains for many teams. Need more data points on adoption timelines.

2. **Cockatiel maintenance status**: Last release was 3.2.1 (2024). Is it actively maintained, or should we watch for a successor? The .NET Polly ecosystem is much more active.

3. **Chaos engineering in serverless**: Most chaos engineering tools (Gremlin, LitmusChaos) are oriented toward containers/VMs. What does chaos engineering look like for serverless functions (Lambda, Cloudflare Workers)?

4. **AI-agent retry behavior**: As AI agents become first-class API consumers (per our backend principles), do standard retry/circuit breaker patterns need adaptation? Agent traffic is bursty and retry-heavy — may need agent-specific retry budgets.

5. **Error budget integration with feature flags**: Automatic feature flag toggling when error budgets are exhausted — does any tooling support this natively, or is it always custom?

## Extracted Principles

The following principles were distilled from this research:

1. **Crash on programmer errors, handle operational errors** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
2. **Use neverthrow for type-safe errors, Effect-TS for critical services** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
3. **Stripe-model structured error responses on every API** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
4. **Circuit breakers on every external dependency** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
5. **Full jitter exponential backoff with retry budgets** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
6. **Explicit timeouts on every external call, propagate deadlines** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
7. **Bulkhead-isolate independent dependencies** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
8. **Design four degradation levels with feature flag kill switches** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
9. **Never silently discard failed messages — DLQ everything** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
10. **Liveness checks process health, readiness checks dependency health** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
11. **Granular React error boundaries with retry UI** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)
12. **Tiered alerting to prevent alert fatigue** — [principles/error-handling-resilience.md](../principles/error-handling-resilience.md)

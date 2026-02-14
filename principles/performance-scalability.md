# Performance & Scalability Principles

## Summary
Performance and scalability guidance for Node.js/TypeScript applications. Covers profiling workflow, event loop optimization, V8 memory tuning, caching strategy (HTTP + CDN), horizontal/vertical scaling decisions, load balancing, database query optimization, connection pooling, rate limiting as a scalability tool, and load testing. Focus on measurement-driven optimization and Node.js-specific patterns.

## Principles

### Profile Before You Optimize
- **What:** Use Clinic.js Doctor for triage, Clinic Flame or 0x for CPU profiling, and Chrome DevTools heap snapshots for memory analysis. Never optimize based on intuition -- always measure first.
- **Why:** Intuitive guesses about bottlenecks are wrong more often than right. A 5-minute profiling session with Clinic Doctor can save days of optimizing the wrong code path. Wide bars in flame graphs (CPU time) and growing objects in heap comparisons (memory leaks) are the two signals that matter.
- **When:** Before any performance optimization work. After deploying significant features. When latency or resource usage increases unexpectedly. Don't profile in production with `--inspect` (it halts the event loop) -- use `--cpu-prof` or sampling profilers for production.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Never Block the Event Loop
- **What:** Keep all event loop tasks under 10ms. Offload CPU-intensive work (image processing, crypto, compression, large JSON) to worker threads via Piscina. Use async APIs exclusively in request handlers. Validate regex patterns for ReDoS vulnerability. Partition large array operations with `setImmediate`.
- **Why:** A single blocked event loop tick blocks ALL concurrent requests. Node.js's strength is concurrent I/O handling -- a 100ms CPU task during a request makes every other pending request wait 100ms. This is the single most impactful performance property of Node.js.
- **When:** Every request handler, every middleware, every background task running on the main thread. Worker threads add overhead -- don't use them for I/O-bound work (database queries, HTTP calls, file reads). Async I/O is more efficient for these.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Cache Immutably, Invalidate Surgically
- **What:** Use content-hashed filenames for static assets with `Cache-Control: public, max-age=31536000, immutable`. For dynamic content, use `stale-while-revalidate` to serve stale while refreshing in the background. Use Cache-Tags (Cloudflare) or on-demand ISR (Vercel) for targeted cache invalidation -- never routine "Purge Everything."
- **Why:** Immutable caching eliminates all revalidation traffic for versioned assets. `stale-while-revalidate` hides revalidation latency from users. Targeted invalidation (Cache-Tags) lets you purge exactly what changed without collateral damage. "Purge Everything" causes thundering herd on your origin.
- **When:** Every web application. Static assets on first deploy. API responses and HTML as traffic grows. Personalized/authenticated responses should use `Cache-Control: private` and application-level caching (Redis), not CDN caching.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Scale Up Then Out (Hybrid Scaling)
- **What:** Vertically scale Node.js instances to their optimal price/performance point (typically 4-8 vCPU machines running N-1 processes via cluster/PM2), then horizontally add more instances behind a load balancer. Store all session state externally (Redis) so any instance can serve any request.
- **Why:** Node.js is single-threaded per process, so you need multiple processes regardless. Vertical scaling is simpler operationally. But single instances are single points of failure. The hybrid approach gives you both efficiency and resilience. Externalizing session state is a prerequisite for horizontal scaling.
- **When:** From day one, plan for stateless processes with external state. Scale vertically until the next VM tier's cost/performance ratio degrades, then add instances. Stateful workloads (databases) should scale vertically first, with horizontal scaling (read replicas, sharding) deferred as long as possible.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Measure Latency at p99, Not Average
- **What:** Use k6 for load testing. Set thresholds on p95 and p99 latency, not averages. Target: p95 < 500ms, p99 < 1000ms for API endpoints. Run `--summary-trend-stats="med,p(95),p(99),p(99.9)"`. Monitor these percentiles in production with OpenTelemetry histograms.
- **Why:** Average latency hides tail latency. If your average is 50ms but p99 is 5 seconds, 1% of users (potentially thousands per day) have a terrible experience. The p99 is what your most affected users experience. SLOs should be percentile-based.
- **When:** Every load test, every performance SLO, every monitoring dashboard. Throughput-focused workloads (batch processing, data pipelines) may prioritize total completion time instead.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### EXPLAIN ANALYZE Every Slow Query
- **What:** Use `EXPLAIN (ANALYZE, BUFFERS)` to read query plans. Enable `pg_stat_statements` to find highest-total-time queries. Set `log_min_duration_statement = 200` for slow query logging. Enable `auto_explain` for automatic plan capture. Check estimated vs actual row counts -- large divergence means stale statistics (run `ANALYZE`).
- **Why:** Most database performance problems are query problems, not database problems. A missing index can make a query 1000x slower. `pg_stat_statements` surfaces the queries consuming the most total database time -- often not the slowest individual query, but one called millions of times at moderate latency.
- **When:** After deploying new features with new queries. When database CPU or latency increases. Proactively as part of quarterly performance reviews. Don't over-index -- every index slows writes and uses storage.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Rate Limit Proactively, Not Reactively
- **What:** Implement tiered rate limiting (per-IP, per-API-key, per-user, per-endpoint) before you need it. Use sliding window counters for fairness or token bucket for burst tolerance. Redis-backed for multi-instance deployments (`@upstash/ratelimit` for edge/serverless). Return `Retry-After` headers on 429 responses.
- **Why:** Rate limiting is a scalability tool, not just a security feature. A webhook storm, a viral event, or a misbehaving client can overwhelm your backend before you have time to react. Proactive limits provide automatic backpressure. The first time you need rate limiting shouldn't be during an incident.
- **When:** Every API, from launch. Set generous initial limits that only constrain abuse, then tighten based on observed traffic patterns. Don't rate limit internal service-to-service calls unless you have a specific backpressure need -- use circuit breakers instead.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Use L7 Load Balancing with Deep Health Checks
- **What:** Use L7 (application-layer) load balancing with weighted round robin or least-connections algorithms. Implement deep health check endpoints (`/healthz`) that verify database, cache, and critical dependency connectivity. Avoid sticky sessions -- externalize session state instead.
- **Why:** L4 health checks only verify TCP -- a backend can be TCP-reachable but application-broken. L7 health checks with dependency verification catch degraded backends that L4 misses. Weighted round robin (Google SRE's recommendation) incorporates real backend utilization signals, dramatically reducing load skew compared to simple round robin. Sticky sessions break fault tolerance and prevent even load distribution.
- **When:** Any multi-instance deployment. Deep health checks from the first horizontally-scaled service. L4 is appropriate as the first layer for raw TCP traffic, DDoS mitigation, or non-HTTP protocols -- use L7 behind L4.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Tune V8 Memory for Your Workload
- **What:** Set `--max-old-space-size` to 75% of container memory limit. Increase `--max-semi-space-size` to 64-128MB for high-throughput HTTP servers with many short-lived objects. Set `UV_THREADPOOL_SIZE` to CPU core count for I/O-heavy workloads. Monitor heap usage and GC frequency with `--trace-gc` or `PerformanceObserver`.
- **Why:** Default V8 settings are conservative. High-throughput servers create millions of short-lived objects that get "prematurely promoted" to Old Space, triggering expensive Mark-Sweep collections. A larger semi-space gives Scavenge more room to reclaim short-lived garbage before promotion. In containers, V8 may not auto-detect memory limits correctly.
- **When:** Production Node.js deployments, especially in containers (Docker/K8s). After profiling shows frequent GC pauses. Don't increase heap to "fix" a memory leak -- find and fix the leak.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Detect Memory Leaks with Three-Snapshot Comparison
- **What:** Monitor `process.memoryUsage().heapUsed` over time. For suspected leaks: take baseline heap snapshot, execute suspect operations, snapshot again, execute more, third snapshot. Compare snapshots 2 and 3 in Chrome DevTools "Comparison" view. Look at "Size Delta" for growing object categories. Common Node.js leak patterns: uncleared event listeners, closures capturing large objects, global caches without LRU eviction, uncleared timers.
- **Why:** Memory leaks in Node.js cause gradual degradation, eventually OOM crashes. The three-snapshot technique isolates objects being allocated but not garbage-collected. Heap snapshots are the definitive tool -- `process.memoryUsage()` tells you there is a problem, heap snapshots tell you what the problem is.
- **When:** When heap usage trends upward under steady load. As part of pre-production load testing. When OOM kills occur in production. Don't take heap snapshots in production unless absolutely necessary -- they pause the process and can be very large.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Configure Undici Connection Pools for External Services
- **What:** Configure Undici's global dispatcher with explicit connection limits, keep-alive settings, and per-origin pooling for external HTTP service calls. Set `connections` per origin based on expected concurrency. For Redis, use a single connection with command pipelining for most workloads; add pool only for blocking operations or Pub/Sub. Use `generic-pool` for any non-HTTP persistent connections.
- **Why:** Default connection settings work for low traffic but cause connection exhaustion or excessive connection churn under load. Undici (Node.js's built-in HTTP client) manages pools per origin but defaults may not match your traffic patterns. Redis doesn't need a pool in Node.js thanks to command pipelining -- adding a pool where one isn't needed adds overhead.
- **When:** Any service making concurrent HTTP calls to external APIs. Any service with >100 req/s to a single upstream origin. Don't pool Redis connections unless you have blocking operations.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

### Stale-While-Revalidate Is Your Default Cache Pattern
- **What:** For any content that can tolerate seconds-to-minutes of staleness, use `Cache-Control: public, s-maxage=N, stale-while-revalidate=M`. This serves cached content instantly while revalidating in the background. Combine with ETag for bandwidth-efficient revalidation. Use `stale-if-error=N` as a resilience fallback (serve stale if origin is down).
- **Why:** `stale-while-revalidate` eliminates the latency penalty of cache misses for all but the first request. Users never see revalidation delay. `stale-if-error` turns your CDN/cache into a resilience layer -- if your origin goes down, cached content keeps serving. This pattern is the single highest-impact caching improvement for most web applications.
- **When:** API responses, HTML pages, any content with a known staleness tolerance. Start with conservative values (e.g., `s-maxage=10, stale-while-revalidate=60`) and increase based on observed cache hit rates. Not for real-time data, authenticated/personalized responses, or content where staleness has compliance implications.
- **Source:** [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-performance-scalability.md](../research/2026-02-14-performance-scalability.md).

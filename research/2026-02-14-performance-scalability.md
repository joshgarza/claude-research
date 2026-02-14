---
date: 2026-02-14
topic: Performance and Scalability
status: complete
tags: [performance, scalability, profiling, caching, load-balancing, node-js, v8, memory, cdn, k6]
related: [2026-02-14-backend-api-practices-update.md, 2026-02-14-database-data-architecture.md]
---

# Performance and Scalability

## Context

Performance and scalability were identified as gaps in the principles knowledge bank. This research covers backend profiling, connection pooling patterns, CDN strategy, horizontal vs vertical scaling decisions, load balancing, database query optimization, rate limiting as a scalability tool, caching strategy, Node.js event loop optimization, V8 memory management, and load testing with k6.

Key sources: Node.js official docs, Google SRE Book, Clinic.js, web.dev, Cloudflare docs, Vercel docs, PostgreSQL docs, k6/Grafana docs, Brendan Gregg (flame graphs), NearForm (Node.js performance).

## Findings

### 1. Backend Profiling and Bottleneck Identification

**Node.js built-in profiling (`--inspect`):**
The `--inspect` flag enables the V8 inspector agent, allowing connection to Chrome DevTools for CPU and memory profiling. Start with `node --inspect app.js` (or `--inspect-brk` to pause at first line), then open `chrome://inspect` in Chrome. The Performance panel records CPU and network activity timelines. The Bottom-Up tab shows aggregated time on individual activities; the Call Tree tab identifies which activities cause the most work. **Critical production caveat:** The V8 Inspector halts the event loop during DevTools actions -- never use it in production. For production, use sampling profilers or the `--cpu-prof` flag which writes a `.cpuprofile` file without halting the process.
([Node.js Profiling Guide](https://nodejs.org/en/learn/getting-started/profiling), [Chrome DevTools Node.js Performance](https://developer.chrome.com/docs/devtools/performance/nodejs))

**0x flame graphs:**
[0x](https://github.com/davidmarkclements/0x) generates interactive flame graphs with a single command (`npx 0x app.js`). Reading flame graphs: the x-axis represents time spent (width = CPU time consumed), y-axis represents call depth. Wide bars at any level indicate CPU-heavy functions. Look for wide blocks without children -- these represent "self time" where actual computation happens. The most saturated orange bars are likely CPU-hot functions. 0x has a production-server mode that minimizes overhead.
([Node.js Flame Graphs docs](https://nodejs.org/en/learn/diagnostics/flame-graphs), [Brendan Gregg's Flame Graphs](https://www.brendangregg.com/flamegraphs.html))

**Clinic.js suite:**
[Clinic.js](https://clinicjs.org/) from NearForm provides three complementary tools:
- **Clinic Doctor**: High-level health check. Runs the app under load, collects metrics (CPU, event loop delay, GC, I/O), generates an HTML report with specific recommendations. Use `clinic doctor --autocannon -- node app.js` for automated benchmarking.
- **Clinic Flame**: Interactive flame graphs (built on 0x). Pinpoints CPU-consuming functions visually.
- **Clinic Bubbleprof**: Unique async-flow visualization. Creates bubble diagrams sized proportionally to aggregate delay in async operations. Best for diagnosing I/O bottlenecks and async queuing issues that flame graphs miss.

Start with Doctor for triage, then use Flame (CPU issues) or Bubbleprof (async/I/O issues) for deep diagnosis.
([Clinic.js GitHub](https://github.com/clinicjs/node-clinic), [NearForm intro](https://www.nearform.com/blog/introducing-node-clinic-a-performance-toolkit-for-node-js-developers/))

**Profiling workflow:**
1. Doctor for initial triage (event loop? GC? I/O? CPU?)
2. Flame if CPU-bound, Bubbleprof if I/O-bound
3. `--inspect` + Chrome DevTools for memory analysis (heap snapshots)
4. 0x for quick flame graph generation without the full Clinic suite

### 2. Non-Database Connection Pooling

**HTTP client connections (Undici):**
Node.js's built-in `fetch` (since v18) uses [Undici](https://github.com/nodejs/undici) under the hood. Undici manages connection pools automatically -- it creates a Pool per origin (scheme + host + port), reuses connections via HTTP keep-alive, and supports pipelining. Configure via the global dispatcher:

```typescript
import { Agent, setGlobalDispatcher } from 'undici';
const agent = new Agent({
  keepAliveTimeout: 10_000,    // ms to keep idle connections
  keepAliveMaxTimeout: 30_000, // max keep-alive
  connections: 128,            // max connections per origin
  pipelining: 1,               // HTTP pipelining depth
});
setGlobalDispatcher(agent);
```

For high-throughput external API calls, increase `connections` per origin. For latency-sensitive workloads, keep `pipelining: 1` (some servers handle it poorly). Undici 7.0 native fetch is ~30% faster than axios/node-fetch.
([Undici architecture blog](https://blog.platformatic.dev/http-fundamentals-understanding-undici-and-its-working-mechanism), [Undici GitHub discussions](https://github.com/nodejs/undici/discussions/2382))

**Redis connections:**
Node.js is single-threaded, so a single Redis connection can handle many concurrent commands via command pipelining. Connection pooling for Redis in Node.js is generally unnecessary for typical workloads. However, pools are valuable for:
- **Blocking operations** (BRPOP, XREAD with BLOCK) that tie up a connection
- **Pub/Sub** connections (dedicated subscription connections vs. command connections)
- **High-throughput** scenarios where a single connection's bandwidth becomes the bottleneck

Use `redis-connection-pool` or `generic-pool` with `ioredis` when you need explicit pool management. For most apps, a single ioredis instance with command pipelining is sufficient.
([Redis connection pools docs](https://redis.io/docs/latest/develop/clients/pools-and-muxing/), [Redis blog](https://redis.io/blog/connection-pools-for-serverless-functions-and-backend-services/))

**External service connections:**
For gRPC clients, use `grpc-js` with built-in channel pooling. For WebSocket clients, maintain a single persistent connection per upstream service with automatic reconnection (use `ws` library with a wrapper). For any TCP-based protocol, use `generic-pool` to manage connection lifecycle (create, validate, destroy, idle timeout).

### 3. CDN Strategy and Cache Invalidation

**Caching tiers: Static vs. Dynamic:**
- **Immutable/versioned assets** (JS bundles, CSS, images with content hashes in filenames): `Cache-Control: public, max-age=31536000, immutable`. Cache forever at every layer (browser, CDN, proxy). Invalidation happens naturally via new filenames.
- **Semi-dynamic content** (HTML pages, API responses that change infrequently): Use `stale-while-revalidate`. Example: `Cache-Control: public, max-age=60, stale-while-revalidate=3600` -- serve cached for 60s, then serve stale for up to 1hr while revalidating in the background.
- **Dynamic/personalized content**: `Cache-Control: private, no-cache` or `no-store`. Do not cache at CDN. Cache at application layer (Redis) if needed.
([web.dev stale-while-revalidate](https://web.dev/articles/stale-while-revalidate), [web.dev HTTP Cache](https://web.dev/articles/http-cache))

**Cloudflare:**
- **Purge by Cache-Tag** is the precision tool. Tag responses with `Cache-Tag: blog, post-123, author-jane` headers. Purge all content tagged `post-123` via API without affecting other cached content. Tags propagate globally in seconds. Maximum tag length: 1024 characters.
- **Purge by URL prefix** for broader invalidation (e.g., purge `/api/v2/*`).
- **Purge Everything** as nuclear option -- use sparingly.
- As of April 2025, all purge methods (cache-tags, hostname, prefix) are available on all Cloudflare plans.
- Cloudflare's instant purge completes globally in under 150ms.
([Cloudflare purge docs](https://developers.cloudflare.com/cache/how-to/purge-cache/), [Cloudflare instant purge blog](https://blog.cloudflare.com/instant-purge/), [Cloudflare cache-tag purge](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/))

**Vercel Edge / ISR:**
Vercel's ISR (Incremental Static Regeneration) implements stale-while-revalidate at the edge. Pages are statically generated, cached at edge, and a serverless function triggers after a configurable revalidation interval to refresh the cache. Two revalidation strategies:
- **Time-based**: Set `revalidate: 60` (seconds). After expiry, next request gets stale content while background regeneration occurs.
- **On-demand**: Call `revalidateTag('tag')` or `revalidatePath('/path')` from API routes, webhooks, or CMS hooks. Best for content-driven sites where updates are event-driven.
Combine both: on-demand for known events, time-based as a safety net.
([Vercel ISR docs](https://vercel.com/docs/incremental-static-regeneration), [Vercel ISR blog](https://vercel.com/blog/isr-a-flexible-way-to-cache-dynamic-content))

**CloudFront:**
AWS CloudFront offers programmatic invalidation via API/SDK but charges per invalidation path (first 1,000/month free, $0.005 per path after). Uses origin shields to reduce origin load. Better integration with AWS origins (S3, ALB) -- data transfer from AWS origins to CloudFront is free. Invalidation propagation: typically 60-300 seconds (slower than Cloudflare's <150ms).

**Strategy recommendation:** Use content-hash filenames for all static assets (Vite/webpack do this by default). For API responses and HTML, use `Cache-Control` with `stale-while-revalidate` plus Cache-Tag-based targeted purge. Never rely on "Purge Everything" as a routine operation.

### 4. Horizontal vs. Vertical Scaling Decision Points

**When to scale vertically (up):**
- Application is CPU or memory-bound on a single process
- Stateful workloads (databases, in-memory caches) where data partitioning adds complexity
- Early-stage products where simplicity matters more than redundancy
- The next VM size tier is available and cost-effective
- When single-threaded bottleneck exists (Node.js is single-threaded per process)

**When to scale horizontally (out):**
- You need high availability (single instance = single point of failure)
- Workload is stateless and embarrassingly parallel
- You've hit the ceiling of available VM sizes
- Traffic is spiky and autoscaling can save costs during troughs
- Team/org boundaries align with independent services

**Cost tradeoffs:**
- Vertical: cheaper initially, simpler operationally, but exponential cost curve at the top end (2x CPU rarely costs 2x price -- it's often 3-4x)
- Horizontal: higher initial architectural investment (load balancing, session management, deployment orchestration), but linear cost scaling and better resilience
- **Hybrid approach (recommended):** Vertically scale individual instances to their optimal price/performance point (often 4-8 vCPU for Node.js apps), then horizontally scale by adding more instances at that sweet spot
([CockroachDB scaling comparison](https://www.cockroachlabs.com/blog/vertical-scaling-vs-horizontal-scaling/), [DigitalOcean scaling guide](https://www.digitalocean.com/resources/articles/horizontal-scaling-vs-vertical-scaling), [Google SRE capacity planning](https://sre.google/workbook/managing-load/))

**Node.js-specific consideration:** A single Node.js process uses one CPU core. Vertical scaling beyond 1 core requires `cluster` module or process manager (PM2). For most Node.js apps, the natural scaling unit is N processes per machine (where N = CPU cores), then add machines. This is effectively hybrid scaling from the start.

### 5. Load Balancing Strategies

**L4 vs L7:**
- **L4 (Transport layer):** Routes based on IP + port + protocol. No payload inspection. Latency: 10-100 microseconds. Throughput: 10-40 Gbps per server. Best for: initial traffic distribution, TCP passthrough, DDoS protection.
- **L7 (Application layer):** Parses HTTP headers, URLs, cookies. Content-aware routing. Latency: adds 0.5-3ms per request. Best for: path-based routing, header-based routing, A/B testing, canary deploys, WebSocket upgrade handling.
- **Modern best practice:** L4 at the front (speed + DDoS) with L7 behind it (intelligent routing). Most cloud load balancers (ALB, Cloudflare LB) are L7 by default.
([A10 Networks L4 vs L7](https://www.a10networks.com/glossary/how-do-layer-4-and-layer-7-load-balancing-differ/), [System Overflow L4 vs L7](https://www.systemoverflow.com/learn/load-balancing/l4-vs-l7/l4-vs-l7-load-balancing-key-trade-offs-and-when-to-choose-each))

**Sticky sessions:**
- L7 can use cookie-based stickiness (most predictable)
- L4 is limited to source-IP hashing (breaks behind NAT/proxies)
- **Best practice: avoid sticky sessions.** Store session data in Redis or database so any server can handle any request. Sticky sessions reduce fault tolerance and prevent even load distribution.
- Only use sticky sessions for WebSocket connections or specific stateful protocols where external session stores aren't feasible.

**Health checks:**
- L4 health checks only verify TCP connection success -- a backend can be "up" at TCP level but broken at application level.
- L7 health checks send synthetic HTTP requests and validate response codes/bodies. Far more reliable but slightly more overhead.
- **Deep health checks:** Hit an endpoint that verifies database connectivity, cache availability, and critical dependency health. Return degraded status codes to enable gradual traffic drain.

**Load balancing algorithms (per Google SRE):**
- **Round Robin:** Simple but ignores backend capacity differences. In large deployments, most-loaded backend uses ~2x CPU of least-loaded.
- **Least Connections:** Better than round robin but doesn't account for request cost variance.
- **Weighted Round Robin (Google's recommendation):** Backends report utilization, query rate, and error rate in health check responses. Clients weight traffic proportionally. Dramatically reduces load spread between most/least loaded backends.
([Google SRE Ch. 20](https://sre.google/sre-book/load-balancing-datacenter/), [Google SRE Handling Overload](https://sre.google/sre-book/handling-overload/))

### 6. Database Query Optimization

**EXPLAIN ANALYZE workflow:**
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;
```
Key metrics to read in the output:
- **Seq Scan vs Index Scan vs Bitmap Index Scan:** Seq Scan reads the entire table. Index Scan uses a B-tree index. Bitmap Index Scan is a hybrid (too many rows for index scan, too few for seq scan). If you see a Seq Scan on a large table where you expected an index, either the index is missing or the planner estimates the query will return too many rows for an index to help.
- **Cost:** Two numbers: startup cost and total cost. Units are arbitrary (anchored to 1.0 = one sequential page read). Compare relative costs between plan nodes.
- **Rows:** Estimated vs actual row counts. Large divergence means stale statistics -- run `ANALYZE table_name`.
- **Buffers:** `shared hit` = cache hits, `shared read` = disk reads. High read count = cold cache or working set exceeds `shared_buffers`.
([PostgreSQL EXPLAIN docs](https://www.postgresql.org/docs/current/using-explain.html), [Thoughtbot guide](https://thoughtbot.com/blog/reading-an-explain-analyze-query-plan), [EDB performance tuning](https://www.enterprisedb.com/blog/postgresql-query-optimization-performance-tuning-with-explain-analyze))

**N+1 detection:**
Enable PostgreSQL query logging (`log_min_duration_statement = 0` temporarily) and look for sequences of identical queries differing only by parameter. In ORMs:
- **Drizzle:** Use `.with()` for eager loading or write explicit JOINs. Drizzle's SQL-centric approach makes N+1s more visible.
- **Prisma:** Use `include` for eager loading. Enable `event: 'query'` logging.
- **Application-level:** Use DataLoader pattern (batching) for GraphQL resolvers.
([PostgreSQL auto_explain](https://www.postgresql.org/docs/current/auto-explain.html), [pganalyze](https://pganalyze.com/))

**Slow query logging:**
- `log_min_duration_statement = 200` (log queries taking >200ms)
- `auto_explain` extension: automatically logs execution plans for slow queries without manual EXPLAIN
- `pg_stat_statements` extension: aggregates execution statistics across all queries -- find the queries consuming the most total time (not just the slowest individual execution)
([PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/current/auto-explain.html), [Identifying slow queries](https://dohost.us/index.php/2025/11/24/identifying-slow-queries-in-postgresql-with-pg_stat_statements-and-logging/))

### 7. Rate Limiting as a Scalability Tool

Beyond security, rate limiting protects backends from traffic spikes (legitimate or accidental):

**Algorithms and their scalability tradeoffs:**
- **Fixed Window:** Simplest. Resets counter each period. Problem: double-burst at window boundaries (client sends burst at end of window 1, another burst at start of window 2).
- **Sliding Window Counter:** Hybrid approach. Weights previous window's count based on current position. Smooths bursts. Low memory (two counters per key).
- **Token Bucket:** Models rate as tokens refilling at constant rate. Naturally handles burst traffic up to bucket capacity. Best for API rate limiting where occasional bursts are acceptable.
- **Leaky Bucket:** Smooths output rate regardless of input burstiness. Best for protecting downstream services that can't handle bursts.

**Implementation for Node.js at scale:**
- Single instance: In-memory sliding window (fast, no external dependency)
- Multi-instance: Redis-backed (use Redis `MULTI`/`EXEC` or Lua scripts for atomicity). Libraries: `rate-limiter-flexible`, `@upstash/ratelimit` (for serverless/edge)
- **Tiered rate limiting:** Different limits per tier (anonymous < free < paid < enterprise). Apply limits at multiple levels: per-IP, per-API-key, per-user, per-endpoint, global.
- **Use rate limiting proactively:** Set limits before you need them. A sudden viral event or webhook storm shouldn't be the first time you discover your API has no limits.
([Rate limiting at scale - Gravitee](https://www.gravitee.io/blog/rate-limiting-apis-scale-patterns-strategies), [Kong rate limiting design](https://konghq.com/blog/engineering/how-to-design-a-scalable-rate-limiting-algorithm), [API7 rate limiting guide](https://api7.ai/blog/rate-limiting-guide-algorithms-best-practices))

### 8. Caching Strategy (Beyond Backend Principles)

**HTTP Cache-Control headers -- the full picture:**

| Header | Use Case | Example |
|--------|----------|---------|
| `max-age=N` | Fresh for N seconds | `max-age=3600` (1 hour) |
| `s-maxage=N` | Fresh at CDN/proxy for N seconds (overrides max-age for shared caches) | `s-maxage=86400` |
| `stale-while-revalidate=N` | Serve stale for N seconds while revalidating in background | `stale-while-revalidate=3600` |
| `stale-if-error=N` | Serve stale for N seconds if origin returns 5xx | `stale-if-error=86400` |
| `immutable` | Never revalidate (for content-hashed URLs) | Used with `max-age=31536000` |
| `no-cache` | Must revalidate with origin before using cached copy | ETag/Last-Modified still work |
| `no-store` | Never cache anywhere | For sensitive data |
| `private` | Only browser cache, not CDN/proxy | For user-specific responses |
| `public` | Any cache can store | Required for CDN caching of authed content |

**ETag revalidation flow:**
1. Server includes `ETag: "abc123"` in response
2. Browser stores response and ETag
3. On subsequent request, browser sends `If-None-Match: "abc123"`
4. If resource unchanged, server returns `304 Not Modified` (no body, saves bandwidth)
5. If changed, server returns `200` with new body and new ETag
([MDN Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control), [web.dev HTTP Cache](https://web.dev/articles/http-cache), [Simon Hearne caching best practices](https://simonhearne.com/2022/caching-header-best-practices/))

**Recommended caching strategy by asset type:**
- **Versioned static assets** (JS/CSS bundles, images with hashes): `Cache-Control: public, max-age=31536000, immutable`
- **HTML pages**: `Cache-Control: public, max-age=0, must-revalidate` + ETag (always revalidate, but conditional GET saves bandwidth)
- **API responses (public)**: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (CDN caches 60s, serves stale up to 5min while revalidating)
- **API responses (user-specific)**: `Cache-Control: private, max-age=0` or use application-level caching (Redis)
- **Fonts**: `Cache-Control: public, max-age=31536000, immutable` (fonts rarely change)

**Edge caching patterns:**
- **Vary header:** `Vary: Accept-Encoding, Accept-Language` -- tells CDN to cache separate versions per header value. Be careful: `Vary: Cookie` effectively disables CDN caching for authenticated users.
- **Surrogate keys / Cache-Tags:** Tag cached responses for targeted invalidation. Cloudflare uses `Cache-Tag` header, CloudFront uses Lambda@Edge for similar functionality.

### 9. Node.js Event Loop Optimization

**The core rule from the [official Node.js guide](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop):** Don't block the event loop. Any JavaScript that takes too long returns control too late for other clients.

**Known event loop blockers:**
- **Vulnerable regular expressions:** Backtracking regex (ReDoS). A regex with nested quantifiers like `/(a+)+$/` can take exponential time on crafted input. Use `re2` library for untrusted input, or validate input length before regex.
- **JSON.stringify/JSON.parse on large objects:** O(n) complexity. For objects >1MB, consider streaming JSON parsers (`stream-json`) or offloading to worker threads.
- **Synchronous APIs:** `fs.readFileSync`, `crypto.pbkdf2Sync`, `child_process.execSync`. Never use sync APIs in request handlers. Use async equivalents.
- **Large array/object operations:** Sorting, mapping, or filtering arrays with millions of elements. Partition into chunks processed across multiple event loop ticks using `setImmediate`.

**Worker threads for CPU-intensive work:**
Use worker threads when work is CPU-bound (image processing, encryption, data compression, complex calculations). Do NOT use for I/O-bound work (database queries, HTTP requests, file reads) -- async I/O is more efficient.

**Thread pool management with Piscina:**
[Piscina](https://github.com/piscinajs/piscina) is the recommended worker thread pool library:
```typescript
import Piscina from 'piscina';
const pool = new Piscina({
  filename: './worker.js',
  minThreads: 2,
  maxThreads: Math.max(os.cpus().length - 1, 1), // leave 1 core for event loop
  idleTimeout: 30_000,
});
const result = await pool.run({ data: input });
```

Key configuration: set `maxThreads` to CPU cores minus 1 (reserve one core for the main event loop thread). Monitor `pool.runTime` for task duration and event loop delay via `monitorEventLoopDelay()` to detect when workers aren't offloading enough.
([Piscina GitHub](https://github.com/piscinajs/piscina), [NearForm Piscina guide](https://nearform.com/insights/learning-to-swim-with-piscina-the-node-js-worker-pool/), [Node.js Worker Threads guide](https://nodesource.com/blog/worker-threads-nodejs-multithreading-in-javascript))

**UV_THREADPOOL_SIZE:**
Node.js has a default libuv thread pool of 4 threads for certain async operations (DNS lookups, `fs` operations, `crypto`, `zlib`). If your app makes many concurrent DNS lookups or file operations, increase with `UV_THREADPOOL_SIZE=16`. Max recommended: number of CPU cores.

### 10. Memory Management

**V8 memory architecture:**
- **New Space (Young Generation):** 1-8MB. Fast Scavenge GC. Short-lived objects allocated here.
- **Old Space (Old Generation):** Controlled by `--max-old-space-size` (default ~1.5GB on 64-bit). Slow Mark-Sweep-Compact GC. Objects surviving multiple scavenges are promoted here.
- **Premature promotion problem:** Short-lived objects that happen to survive scavenges get promoted to Old Space, causing more frequent Mark-Sweep collections. Fix: increase `--max-semi-space-size` (default 16MB) to give scavenger more room to identify short-lived garbage before promotion.

**Memory leak detection workflow:**
1. **Monitoring:** Track `process.memoryUsage().heapUsed` over time. Steadily increasing = likely leak.
2. **Heap snapshots:** Take two snapshots separated by time/load. Use Chrome DevTools "Comparison" view. Look at "Size Delta" column to find growing objects.
3. **Three-snapshot technique:** Snapshot 1 (baseline), execute suspected leaky operations, Snapshot 2, execute more, Snapshot 3. Compare 2 vs 3 -- objects allocated between 2 and 3 that weren't collected are candidates.
4. **GC tracing:** Use `node --trace-gc app.js` or `PerformanceObserver` with `entryTypes: ['gc']` to monitor GC frequency and duration. Frequent Old Space collections indicate a problem.
([Node.js Memory diagnostics](https://nodejs.org/en/learn/diagnostics/memory), [Node.js Heap Snapshots](https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot), [Node.js GC tracing](https://nodejs.org/en/learn/diagnostics/memory/using-gc-traces))

**GC tuning flags:**
- `--max-old-space-size=N` (MB): Set based on container memory limit. Rule of thumb: 75% of container memory (leave room for native memory, stack, buffers).
- `--max-semi-space-size=N` (MB): Increase for workloads with many short-lived objects (e.g., HTTP servers creating many request/response objects). Try 64 or 128 for high-throughput servers.
- `--expose-gc` + `global.gc()`: Force GC in testing/profiling (never in production).

**Common leak patterns in Node.js:**
- Event listener accumulation (not removing listeners on cleanup)
- Closures capturing large objects
- Global caches without eviction (use LRU with size limits)
- Uncleared timers/intervals
- Retained references in module-level scope

**Production recommendation:** Use process monitoring (PM2, Kubernetes liveness/readiness probes) to restart processes if memory exceeds thresholds. This is a safety net, not a solution -- find and fix the leak.
([Platformatic V8 GC optimization](https://blog.platformatic.dev/optimizing-nodejs-performance-v8-memory-management-and-gc-tuning), [NearForm semi-space tuning](https://nearform.com/digital-community/optimising-node-js-applications-the-impact-of-max-semi-space-size-on-garbage-collection-efficiency/), [Red Hat Node.js containers](https://developers.redhat.com/articles/2025/10/10/nodejs-20-memory-management-containers))

### 11. Load Testing with k6

[k6](https://grafana.com/docs/k6/latest/) is the recommended load testing tool for Node.js backends. Write tests in JavaScript, define thresholds:

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // ramp up
    { duration: '5m', target: 100 },  // sustain
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],        // <1% error rate
    http_req_duration: ['p(95)<500'],      // 95th percentile under 500ms
    'http_req_duration{type:api}': ['p(99)<1000'], // 99th under 1s for API
  },
};
```

Always test p95 and p99, not averages. Averages hide tail latency that affects real users. Run `--summary-trend-stats="med,p(95),p(99),p(99.9)"` for detailed percentile output.
([k6 performance testing](https://grafana.com/docs/k6/latest/examples/get-started-with-k6/test-for-performance/))

## Open Questions

1. **Bun performance characteristics:** How does Bun's runtime compare to Node.js for production workloads? Different GC, different event loop.
2. **Edge compute scaling:** How do edge runtimes (Cloudflare Workers, Vercel Edge) change the scaling model? No connection pooling, cold starts, different memory limits.
3. **AI workload profiling:** How to profile Node.js services that orchestrate LLM calls? Latency is dominated by external API calls, not CPU.

## Extracted Principles

12 principles extracted to [principles/performance-scalability.md](../principles/performance-scalability.md):

1. Profile Before You Optimize
2. Never Block the Event Loop
3. Cache Immutably, Invalidate Surgically
4. Scale Up Then Out (Hybrid Scaling)
5. Measure Latency at p99, Not Average
6. EXPLAIN ANALYZE Every Slow Query
7. Rate Limit Proactively, Not Reactively
8. Use L7 Load Balancing with Deep Health Checks
9. Tune V8 Memory for Your Workload
10. Detect Memory Leaks with Three-Snapshot Comparison
11. Configure Undici Connection Pools for External Services
12. Stale-While-Revalidate Is Your Default Cache Pattern

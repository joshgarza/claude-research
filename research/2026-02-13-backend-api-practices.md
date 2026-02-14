---
date: 2026-02-13
topic: Backend & API Engineering Best Practices 2026
status: superseded
tags: [backend, api, typescript, node, frameworks, database, orm, authentication, security, testing, caching, observability, deployment, architecture]
related: [2026-02-13-frontend-engineering-practices.md, 2026-02-14-backend-api-practices-update.md]
superseded_by: 2026-02-14-backend-api-practices-update.md
---

# Backend & API Engineering Best Practices 2026

## Context
Engineering-focused survey of backend/API development in 2026 — frameworks, API design paradigms, databases, auth, security, testing, deployment, observability, and architecture patterns. TypeScript-ecosystem-weighted but not exclusive.

---

## 1. TypeScript Backend Frameworks

### The Landscape

| Framework | Architecture | Runtime | Best For | Performance |
|---|---|---|---|---|
| **Hono** | Minimal, middleware-based | Node, Deno, Bun, Workers, Lambda | Edge/serverless, multi-runtime | ~62k ops/sec |
| **Fastify** | Plugin-based, schema-driven | Node | Single-service APIs, schema validation | ~16k ops/sec |
| **Elysia** | End-to-end type-safe (Eden) | Bun only | Bun-native apps, maximum type safety | ~71k ops/sec |
| **Express** | Minimal, middleware-based | Node | Legacy, rapid prototyping | Slowest |
| **NestJS** | Angular-inspired modules/decorators | Node | Enterprise, large teams | Moderate |
| **Encore.ts** | Infrastructure-aware, distributed | Node | Microservices with built-in observability | N/A (different paradigm) |
| **AdonisJS** | Full-stack MVC, batteries-included | Node | Rails-like full-featured backend | Moderate |

### Decision Heuristic

- **New API, deploying to edge/serverless?** → Hono. Runs everywhere, tiny bundle, Web Standards-based.
- **New API, Node.js, need validation/serialization?** → Fastify. Mature ecosystem, JSON Schema validation, easy Express migration via `@fastify/express`.
- **All-in on Bun?** → Elysia. Best type safety (Eden), highest raw performance. But Bun runtime lock-in.
- **Large enterprise team?** → NestJS. Structured modules, DI, decorators. Steep learning curve but enforces consistency.
- **Existing Express app?** → Stay on Express or migrate incrementally to Fastify. Don't rewrite.
- **Microservices with infra automation?** → Encore.ts. Built-in tracing, service discovery, infrastructure provisioning.

### Express Is Legacy

Express is not recommended for new projects in 2026. It lacks built-in validation, type safety, and modern performance optimizations. If you're on Express, migrate route-by-route to Fastify using `@fastify/express`.

### Hono Deep Dive

Hono deserves special attention as the most portable framework:
- Built on Web Standards (`Request`/`Response`) — code is naturally portable across runtimes.
- Middleware system similar to Express but with full TypeScript support.
- Built-in middleware for CORS, JWT, rate limiting, caching, etc.
- First-class Cloudflare Workers, Deno Deploy, Bun, Vercel Edge, AWS Lambda support.
- Tiny bundle — ideal for edge where cold start matters.

Sources: [Encore: Best TypeScript Backend Frameworks 2026](https://encore.dev/articles/best-typescript-backend-frameworks), [Adyog: Hono & Elysia vs Express & Fastify](https://blog.adyog.com/how-hono-and-elysia-are-challenging-express-and-fastify/), [Hono docs](https://hono.dev/docs/)

---

## 2. API Design Paradigms

### When to Use What

| Paradigm | Best For | Trade-off |
|---|---|---|
| **REST** | Public APIs, broad platform compatibility, simple CRUD | Over/under-fetching, no type safety built-in |
| **tRPC** | Full-stack TypeScript monorepos, internal APIs | 35-40% faster dev than REST. TypeScript-only, not for third-party consumers |
| **GraphQL** | Complex data requirements, multiple clients, flexible queries | Complexity overhead, N+1 risk, security surface |
| **gRPC** | High-performance microservices, polyglot backends | Binary protocol, not browser-native, tooling overhead |

### The 2026 Mix-and-Match Pattern

Use multiple paradigms in a single system:
- **tRPC** for internal full-stack TypeScript communication (30% faster time-to-market).
- **REST** for your public API (widest compatibility).
- **GraphQL** for mobile clients that need flexible queries.
- **gRPC** for performance-critical service-to-service communication.

### tRPC: The TypeScript Default

For TypeScript monorepos, tRPC is the de facto standard for internal APIs:
- End-to-end type safety with zero code generation.
- Zod validation at runtime, TypeScript at compile time.
- Procedures are just functions — no schema files, no OpenAPI specs.
- ~35-40% faster feature development vs REST.
- **Limitation:** Not for third-party API consumers. Use REST/GraphQL for public APIs.

### REST Best Practices (When You Use It)

- **Consistent resource naming** — nouns, not verbs. `/users/{id}/orders`, not `/getUserOrders`.
- **Proper HTTP methods** — GET reads, POST creates, PUT replaces, PATCH updates, DELETE deletes.
- **Status codes** — use them correctly. 201 Created, 204 No Content, 404 Not Found, 409 Conflict, 422 Unprocessable Entity.
- **Pagination** — cursor-based over offset-based for large datasets.
- **Versioning** — URL path (`/v2/users`) is the most common and clearest. Header-based versioning is cleaner but harder to test.
- **HATEOAS** — still mostly theoretical. Skip unless you have a specific need.

### API Versioning Strategy

The Stripe model: **evolution by default, explicit versions for breaking changes.**
- Make non-breaking changes (additive fields, new endpoints) without versioning.
- Issue a new version only for breaking changes.
- Deprecation timeline: 6-month announcement → 12 months active migration support → 18-24 months to removal.
- Automated contract tests catch unintended breaking changes in CI.

Sources: [WunderGraph: API paradigm comparison](https://wundergraph.com/blog/graphql-vs-federation-vs-trpc-vs-rest-vs-grpc-vs-asyncapi-vs-webhooks), [Directus: REST vs GraphQL vs tRPC](https://directus.io/blog/rest-graphql-tprc), [Speakeasy: API versioning](https://www.speakeasy.com/api-design/versioning)

---

## 3. Database & ORM

### Prisma vs Drizzle: The Two Contenders

| | Prisma | Drizzle |
|---|---|---|
| **Philosophy** | Schema-first, maximum abstraction | Code-first, SQL-centric |
| **Schema definition** | `.prisma` file (custom DSL) | TypeScript files |
| **Type generation** | Requires `prisma generate` step | Inferred directly from TS schema — no generation |
| **Complex joins** | N+1 risk with nested includes | Single optimized SQL statements (up to 14x lower latency) |
| **Bundle size** | Larger (Rust-based query engine) | Minimal, zero external dependencies |
| **Serverless/edge** | Heavier cold starts | Designed for serverless — smaller bundles, faster cold starts |
| **Migration** | `prisma migrate` (auto-generates SQL) | `drizzle-kit` (generates SQL migrations) |
| **Ecosystem** | More mature, larger community | Growing rapidly, better for advanced SQL |
| **Database support** | PostgreSQL, MySQL, SQLite, MongoDB, CockroachDB | PostgreSQL, MySQL, SQLite, Turso, Neon, Supabase |

**Decision:** Prisma if you want maximum abstraction and a mature ecosystem. Drizzle if you want SQL control, smaller bundles, and faster serverless cold starts. **For new projects in 2026, Drizzle is the momentum pick** — especially for edge/serverless deployments.

### Database Selection

- **PostgreSQL** remains the default relational database. Mature, feature-rich, excellent extension ecosystem (pgvector for AI embeddings, PostGIS for geo, pg_cron for scheduling).
- **SQLite** (via Turso/libSQL) is viable for edge — distributed SQLite with replication. Good for read-heavy, low-write apps at the edge.
- **Redis/Upstash** for caching and real-time data (see Caching section).
- **Purpose-built databases** — use the right tool. Don't force PostgreSQL to be a document store or a time-series database.

### Zero-Downtime Migrations

The **Expand and Contract** pattern is the standard:
1. **Expand:** Add the new column/table alongside the old one. Both versions of the app work.
2. **Migrate:** Backfill data from old to new schema.
3. **Contract:** Remove the old column/table after all app instances use the new schema.

Tools: `prisma migrate`, `drizzle-kit`, or standalone tools like `gh-ost` (GitHub's online schema change tool for MySQL), `pt-online-schema-change` (Percona, MySQL).

**Principle:** Never run a destructive migration in a single step. Always make it reversible and backward-compatible.

Sources: [MakerKit: Drizzle vs Prisma 2026](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma), [Better Stack: Drizzle vs Prisma](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/), [Xata: Zero-downtime migrations](https://xata.io/blog/zero-downtime-schema-migrations-postgresql)

---

## 4. Authentication & Authorization

### The 2026 Auth Stack

| Layer | Recommendation | Notes |
|---|---|---|
| **Protocol** | OIDC (OpenID Connect) | Built on OAuth 2.0, adds identity verification. Use for all new apps. |
| **Credential type** | Passkeys (WebAuthn) | Passwordless by default. Phishing-resistant. Ready for production. |
| **Fallback** | Email magic links or OAuth social login | For users who don't set up passkeys. |
| **Session management** | Server-side sessions (HttpOnly cookies) | NOT JWTs in localStorage. |
| **Token strategy** | Short-lived access tokens (~1hr) + refresh tokens | Rotate refresh tokens on use. |
| **Library** | Better Auth | The momentum pick for TypeScript. Framework-agnostic, type-safe, built-in MFA/org management. |
| **Alternative** | Auth.js (NextAuth) | Still strong for Next.js-specific projects. |
| **Hosted alternative** | Clerk, Auth0, WorkOS | When you don't want to manage auth infrastructure. |

### JWT: Use Correctly or Don't Use

JWTs are **not for browser sessions**. The debate is settled:
- JWT in `localStorage` → XSS vulnerability.
- JWT in `HttpOnly` cookie → "Session cookies with extra steps" — no advantage over server-side sessions.
- JWTs are for **service-to-service auth** and **OAuth token exchange** — their intended purpose.

For browser sessions: **server-side sessions with HttpOnly, Secure, SameSite cookies.**

### Better Auth

The rising standard for TypeScript auth in 2026:
- Framework-agnostic (React, Vue, Svelte, Next.js, Nuxt, Hono, etc.).
- Type-safe client and server — types inferred from your schema.
- Built-in: MFA, organization management, social OAuth, passkeys, email verification.
- Auto-generates database schema from your config.
- Recommended by Next.js, Nuxt, Astro docs.

### Authorization Patterns

- **RBAC (Role-Based Access Control)** — standard for most apps. Users have roles, roles have permissions.
- **ABAC (Attribute-Based Access Control)** — for complex policies (e.g., "users can edit documents they own in their department"). Consider when RBAC becomes unwieldy.
- **Row-Level Security (RLS)** — PostgreSQL-native. Enforce access at the database level, not just application level. Use with Supabase or direct Postgres.
- **OWASP #1 vulnerability: Broken Object Level Authorization (BOLA)** — always verify the requesting user owns/has access to the resource. Never trust client-provided IDs alone.

Sources: [Better Auth](https://www.better-auth.com/), [Better Stack: Better Auth vs NextAuth vs Auth0](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/), [LogRocket: JWT best practices](https://blog.logrocket.com/jwt-authentication-best-practices/)

---

## 5. API Security

### The Non-Negotiables

1. **Input validation at every boundary.** Use Zod or a schema validator on all incoming data. Treat everything from the client as untrusted.
2. **Rate limiting.** Token bucket or sliding window algorithm. Protect against DoS and brute force. Apply per-user, per-IP, and per-endpoint.
3. **Authentication on every endpoint.** No endpoint should be accidentally unauthenticated. Whitelist public routes explicitly.
4. **Authorization checks on every resource access.** Verify ownership/permission. BOLA is the #1 API vulnerability.
5. **HTTPS everywhere.** No exceptions.
6. **CORS properly configured.** Whitelist specific origins — never `*` in production.
7. **Security headers.** `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, CSP.
8. **Dependency auditing.** Run `npm audit` / `pnpm audit` in CI. The "Shai-Hulud" npm supply chain attack (2025) compromised thousands of packages.

### OWASP API Security Top 10 (2023)

| # | Vulnerability | Prevention |
|---|---|---|
| 1 | Broken Object Level Authorization | Always verify resource ownership server-side |
| 2 | Broken Authentication | Strong auth, MFA, rate-limited login |
| 3 | Broken Object Property Level Authorization | Validate which fields users can read/write |
| 4 | Unrestricted Resource Consumption | Rate limiting, pagination limits, query complexity limits |
| 5 | Broken Function Level Authorization | Role-based endpoint access, deny by default |
| 6 | Unrestricted Access to Sensitive Business Flows | Bot detection, CAPTCHA, business-logic rate limiting |
| 7 | Server Side Request Forgery (SSRF) | Validate/whitelist URLs, disable unnecessary protocols |
| 8 | Security Misconfiguration | Secure defaults, remove debug endpoints, review CORS |
| 9 | Improper Inventory Management | API cataloging, decommission old versions |
| 10 | Unsafe Consumption of APIs | Validate responses from third-party APIs too |

### Zod as the Security Layer

Zod serves double duty — type safety AND security:
```typescript
const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin']),  // Whitelist, not blacklist
});
```
Every tRPC procedure, every API handler, every form submission should have a Zod schema. It validates at runtime and provides types at compile time.

Sources: [Levo: REST API Security 2026](https://www.levo.ai/resources/blogs/rest-api-security-best-practices), [OWASP API Security](https://owasp.org/www-project-api-security/), [dasroot: Secure API Design](https://dasroot.net/posts/2026/02/secure-api-design-principles-oauth-input-validation-rate-limiting/)

---

## 6. Error Handling

### The Result Type Pattern

TypeScript's `throw`/`catch` is fundamentally unsafe — TypeScript doesn't require you to handle thrown errors, and `catch` types as `unknown`. The Result type pattern (from Rust/Go) makes errors part of the type system:

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

**Libraries:** `neverthrow` or `ts-error-handling` for ergonomic Result types in TypeScript.

**When to use:**
- Internal business logic where callers must handle errors explicitly.
- Domain operations that have expected failure modes (validation, not-found, permission denied).

**When to still throw:**
- Truly unexpected errors (out of memory, network failures).
- Framework boundaries that expect exceptions (Express/Fastify error handlers).

### Structured Error Responses

API errors should be structured and typed:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [{ "field": "email", "issue": "required" }]
  }
}
```

- Use consistent error codes, not just HTTP status codes.
- Include machine-readable codes (for programmatic handling) AND human-readable messages.
- Never leak stack traces or internal details to clients in production.

Sources: [typescript.tv: Result Types](https://typescript.tv/best-practices/error-handling-with-result-types/), [LogRocket: Exhaustive type checking](https://blog.logrocket.com/improve-error-handling-typescript-exhaustive-type-checking/)

---

## 7. Testing

### The Backend Testing Pyramid

| Layer | % | Tool | What to Test |
|---|---|---|---|
| **Unit** | ~70% | Vitest | Pure functions, business logic, validators, transformers |
| **Integration** | ~20% | Vitest + Supertest (or framework test client) | API routes, middleware chains, database queries |
| **Contract** | ~5% | Pact or OpenAPI-based | API contracts between services |
| **E2E** | ~5% | Playwright or API client scripts | 3-5 critical flows through the full stack |

### Contract Testing

Critical for microservices and any API consumed by other teams:
- **Consumer-driven contracts (Pact):** The consumer defines expected request/response. Provider verifies against it.
- **OpenAPI-based contracts:** Generate types from OpenAPI spec, validate implementations against it.
- **tRPC eliminates the need** for contract testing between frontend and backend in TypeScript monorepos — the compiler IS the contract.

### Integration Testing Best Practices

- **Test against a real database** (use Testcontainers or Docker Compose for PostgreSQL in CI). In-memory fakes miss real SQL behavior.
- **Use `respx` for HTTP mocking** in Python (per project rules). Use `msw` (Mock Service Worker) for HTTP mocking in TypeScript.
- **Seed test data per test** — don't share mutable state between tests. Use database transactions that roll back after each test.
- **Test the API contract, not implementation** — assert on response shape and status codes, not internal function calls.

Sources: [Nucamp: Testing 2026](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies), [Speakeasy: API Testing](https://www.speakeasy.com/api-design/testing), [Pactflow: Contract Testing](https://pactflow.io/blog/what-is-contract-testing/)

---

## 8. Caching

### Multi-Layer Caching Architecture

| Layer | Tool | Latency | Scope |
|---|---|---|---|
| **L1: In-memory** | `node-cache`, `lru-cache`, or framework-built-in | Sub-microsecond | Per-instance |
| **L2: Distributed** | Redis or Upstash Redis | ~1-5ms | Cross-instance |
| **L3: CDN/Edge** | Cloudflare, Vercel Edge Config | ~10-50ms | Global |

**Flow:** Check L1 → miss → check L2 → miss → fetch from database → populate L2 → populate L1.

### Cache Invalidation Patterns

| Pattern | How | When |
|---|---|---|
| **TTL (Time-To-Live)** | Key expires after N seconds | Default for most data. Simple, predictable. |
| **Write-through** | Update cache on every write | When data freshness is critical. |
| **Cache-aside (lazy loading)** | Populate cache on read miss | Most common pattern. Good default. |
| **Pub/sub invalidation** | Broadcast invalidation events | Multi-instance deployments. Cuts stale reads by >95% vs TTL-only. |
| **Tag-based invalidation** | Invalidate all keys with a tag | When multiple cache entries depend on one entity change. |

### Cache Stampede Prevention

When a popular cache key expires and hundreds of requests hit the database simultaneously:
- **Lock-based:** First request acquires a lock, others wait for the cache to be populated.
- **Stale-while-revalidate:** Serve stale data while refreshing in the background.

### Upstash for Edge/Serverless

Upstash Redis is purpose-built for edge:
- HTTP-based access (no TCP connection pooling headaches in serverless).
- Global replication.
- Pay-per-request pricing.
- Eliminates cold start issues with traditional Redis.

Sources: [OneUpTime: Multi-layer caching](https://oneuptime.com/blog/post/2026-01-25-multi-layer-caching-redis-nodejs/view), [TheLinuxCode: Redis Cache 2026](https://thelinuxcode.com/redis-cache-in-2026-fast-paths-fresh-data-and-a-modern-dx/), [Upstash: Drizzle integration](https://upstash.com/blog/drizzle-integration)

---

## 9. Observability

### OpenTelemetry: The Standard

OpenTelemetry (OTel) is the vendor-neutral standard for observability in 2026. 89% of production users consider OTel compliance critical.

**The three pillars:**

| Pillar | What | Tool |
|---|---|---|
| **Traces** | Request flow across services | OTel SDK → Jaeger, Honeycomb, Datadog |
| **Metrics** | Counters, gauges, histograms | OTel SDK → Prometheus, Grafana |
| **Logs** | Structured event records | OTel SDK → Loki, Elasticsearch, Axiom |

### Key Practices

- **Instrument from day one.** Retrofit observability is painful. Add OTel SDK alongside your first API route.
- **Structured logging.** JSON logs with consistent fields (`requestId`, `userId`, `duration`, `status`). Never `console.log("error happened")`.
- **Distributed context propagation.** Trace IDs flow through your entire request path, connecting logs, metrics, and traces into a unified view.
- **Correlate everything.** Every log line should include the trace ID. Every metric should be tagged with service name and environment.

### Practical Setup (TypeScript)

1. Install `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`.
2. Auto-instrumentation covers HTTP, database drivers, framework middleware.
3. Export to your backend of choice (Jaeger for self-hosted, Honeycomb/Axiom for managed).
4. Add custom spans for business-critical operations.

### Don't Confuse Monitoring with Observability

- **Monitoring** = "is it up? is it fast?"
- **Observability** = "why is this specific request slow for this specific user?"

Observability requires the ability to ask arbitrary questions of your system without deploying new code.

Sources: [OpenTelemetry](https://opentelemetry.io), [The New Stack: OpenTelemetry in 2026](https://thenewstack.io/can-opentelemetry-save-observability-in-2026/), [Better Stack: OTel tools](https://betterstack.com/community/comparisons/opentelemetry-tools/)

---

## 10. Deployment & Infrastructure

### The Deployment Spectrum

| Model | When | Tools | Trade-offs |
|---|---|---|---|
| **Edge functions** | Stateless, low-latency, global | Cloudflare Workers, Vercel Edge, Deno Deploy | Strict limits (memory, execution time, no TCP) |
| **Serverless functions** | Variable load, per-request pricing | AWS Lambda, Vercel Functions, Netlify Functions | Cold starts, 15-min timeout limits |
| **Serverless containers** | Long-running + auto-scaling | AWS Fargate, Google Cloud Run, Fly.io | More setup than functions, but more flexible |
| **Containers** | Full control, stateful workloads | Docker + Kubernetes/ECS | Operational overhead, but maximum control |
| **VPS/VM** | Simple, predictable workloads | Railway, Render, DigitalOcean, EC2 | Simplest mental model, manual scaling |

### The 2026 Default Path

For most TypeScript backend projects:
1. **Start with serverless/edge** (Vercel, Cloudflare Workers, or Fly.io).
2. **Graduate to containers** (Cloud Run, Fly.io) when you hit serverless limits.
3. **Kubernetes only** when org scale demands it (multiple teams, complex orchestration).

### Edge Considerations

Cloudflare Workers use V8 Isolates (not containers), eliminating OS boot — lowest cold start latency. But strict limits:
- 128MB memory.
- 30s CPU time (paid plan).
- No native TCP (use HTTP-based services like Upstash, Neon, Turso for database access).

### 50%+ of container deployments will use serverless management (Fargate/Cloud Run) by 2026 — up from <25% in 2024.

Sources: [Cloudflare: Serverless vs Containers](https://www.cloudflare.com/learning/serverless/serverless-vs-containers/), [FieldGuideToAI: Deployment Patterns](https://fieldguidetoai.com/guides/deployment-patterns), [Zibtek: Backend 2026](https://www.zibtek.com/blog/backend-development-in-2026-engineering-for-scale-performance-and-reliability/)

---

## 11. Event-Driven Architecture & Queues

### When to Use Queues

- **Background jobs** — email sending, image processing, report generation.
- **Decoupling services** — producer doesn't need to know about consumers.
- **Rate smoothing** — absorb traffic spikes without overwhelming downstream services.
- **Reliable delivery** — guaranteed processing even if consumers are temporarily down.

### Tool Selection

| Tool | Best For | Complexity |
|---|---|---|
| **BullMQ** (Redis-backed) | Background jobs, scheduled tasks, moderate scale | Low — just needs Redis |
| **Redis Streams** | Event streaming within a Redis-based stack | Low-medium |
| **Kafka** | High-throughput event streaming, event sourcing, data pipelines | High — operational overhead |
| **RabbitMQ** | Complex routing, priority queues, polyglot consumers | Medium |
| **AWS SQS/SNS** | Managed queue/pub-sub on AWS | Low (managed) |

**Decision heuristic:** Start with **BullMQ** for most TypeScript backends. It handles background jobs, scheduled tasks, retries, and moderate-scale messaging with just a Redis dependency. Graduate to **Kafka** only when you need high-throughput event streaming or durable event logs.

### Dead Letter Queues (DLQ)

Every queue should have a DLQ:
- Messages that fail processing after N retries go to the DLQ.
- Monitor DLQ depth as an alert signal.
- Build tooling to inspect, replay, or discard DLQ messages.

### Event Sourcing

Store events (what happened) rather than current state (what is). Replay events to rebuild state. Powerful for audit trails and temporal queries, but adds significant complexity. **Don't adopt unless you specifically need audit history or temporal queries.**

Sources: [OneUpTime: Kafka + BullMQ consumers](https://oneuptime.com/blog/post/2026-01-21-kafka-bullmq-consumers-nodejs/view), [BullMQ docs](https://docs.bullmq.io), [HK InfoSoft: Kafka vs RabbitMQ vs BullMQ](https://www.hkinfosoft.com/when-services-need-to-talk-choosing-between-kafka-rabbitmq-and-bullmq/)

---

## 12. Architecture Patterns

### Start Monolith, Extract Services

The 2026 consensus is clear: **start with a well-structured monolith.** Extract microservices only when team or scaling boundaries demand it.

- **Modular monolith** — feature modules with clear boundaries (think Feature-Sliced Design for the backend). Modules communicate through defined interfaces, not direct database access.
- **Extract when:** A module needs to scale independently, a separate team owns it, or it needs a different tech stack.
- **Don't extract when:** You have <5 engineers, or modules don't have clear independent scaling needs.

### Backend for Frontend (BFF)

Create purpose-built backend services per frontend type:
- **Web BFF** — aggregates detailed data for desktop.
- **Mobile BFF** — optimizes payloads for mobile bandwidth.
- **Each BFF** is a thin orchestration layer, not business logic. Business logic stays in shared services.

### API-First Design

Design the API contract before writing implementation:
1. Define OpenAPI spec (for REST) or tRPC procedures (for TypeScript).
2. Generate types and mock servers from the spec.
3. Frontend and backend develop in parallel against the contract.
4. Contract tests verify implementation matches spec.

### Read/Write Separation (CQRS-lite)

Separate read and write paths without full CQRS complexity:
- **Write path:** Validates, persists, publishes events.
- **Read path:** Optimized queries, possibly denormalized, cacheable.
- Use database read replicas for read scaling.
- Full CQRS (separate read/write models) only if you have genuinely different read and write patterns.

Sources: [Zibtek: Backend 2026](https://www.zibtek.com/blog/backend-development-in-2026-engineering-for-scale-performance-and-reliability/), [Catchpoint: API Architecture Patterns](https://www.catchpoint.com/api-monitoring-tools/api-architecture), [Microservices.io: BFF pattern](https://microservices.io/patterns/apigateway.html)

---

## Open Questions

- **Hono vs Fastify** — will Hono's multi-runtime advantage make Fastify obsolete, or does Fastify's maturity keep it relevant for Node-only shops?
- **Drizzle maturity** — is Drizzle's ecosystem and documentation mature enough for enterprise adoption, or is Prisma still safer for large teams?
- **Better Auth longevity** — it's the momentum pick, but is it stable enough to bet on for production systems vs. established services like Clerk/Auth0?
- **Edge database access** — when will we get fast, reliable relational database access at the edge without HTTP proxies (Neon, Turso)?
- **Result types in TypeScript** — will `neverthrow`-style patterns become mainstream, or does the ecosystem stay with throw/catch?

## Extracted Principles

1. **Hono for edge, Fastify for Node.** Don't use Express for new projects.
2. **tRPC for internal, REST for external.** Mix API paradigms per use case.
3. **Drizzle for new projects.** SQL-centric, type-safe, serverless-optimized. Prisma if you need the abstraction.
4. **Passkeys + server-side sessions.** Not JWTs in localStorage. Better Auth for the library.
5. **Zod at every boundary.** Input validation is security. Same schemas for client and server.
6. **Start monolith, extract services.** Modular monolith with clear boundaries. Microservices when team/scale demands it.
7. **OpenTelemetry from day one.** Structured logging + distributed tracing. Don't retrofit.
8. **BullMQ for queues, Kafka when you need streams.** Don't over-engineer message infrastructure.
9. **Multi-layer caching.** In-memory (L1) → Redis/Upstash (L2) → CDN (L3). Cache-aside as default pattern.
10. **Expand-and-contract migrations.** Never destructive in a single step. Always backward-compatible.

→ Principles filed to `principles/backend-api-engineering.md`

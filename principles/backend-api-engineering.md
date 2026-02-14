# Backend & API Engineering Principles (2026)

## Summary
Opinionated, practical engineering guidance for building backend systems and APIs in 2026. TypeScript-ecosystem-weighted. Covers frameworks, API design, databases, auth, security, testing, caching, observability, and deployment.

## Principles

### Hono for Edge, Fastify for Node
- **What:** Use Hono for edge/serverless/multi-runtime deployments. Use Fastify for Node.js-specific APIs. Don't use Express for new projects.
- **Why:** Hono runs on every JS runtime (Workers, Deno, Bun, Lambda, Node), has a tiny bundle, and is Web Standards-based. Fastify is the mature Node.js choice with schema-driven validation. Express lacks type safety, validation, and modern performance.
- **When:** Every new backend project. Migrate existing Express apps incrementally to Fastify.
- **When NOT:** NestJS for large enterprise teams needing enforced structure. Elysia if all-in on Bun.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### tRPC for Internal, REST for External
- **What:** Use tRPC for full-stack TypeScript internal APIs. Use REST for public/third-party APIs. GraphQL for mobile clients. gRPC for service-to-service performance.
- **Why:** tRPC gives 35-40% faster development with zero code generation and end-to-end type safety. REST has the widest compatibility. Mix paradigms per use case.
- **When:** Any TypeScript monorepo (tRPC). Public APIs (REST). Multiple client types with complex data needs (GraphQL).
- **When NOT:** tRPC is not for third-party API consumers.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### Drizzle for New Projects
- **What:** Use Drizzle ORM for new TypeScript backend projects. Types inferred from TypeScript schema — no generation step. SQL-centric, minimal bundle.
- **Why:** Up to 14x lower latency on complex joins. Zero external dependencies. Designed for serverless/edge (fast cold starts). Growing rapidly.
- **When:** New projects, especially edge/serverless deployments.
- **When NOT:** Prisma if you want maximum abstraction, a more mature ecosystem, or your team prefers schema-first workflow.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### Passkeys + Server-Side Sessions
- **What:** Use passkeys (WebAuthn) as the default auth credential. Server-side sessions with HttpOnly/Secure/SameSite cookies for session management. Short-lived access tokens + refresh tokens.
- **Why:** Passkeys are phishing-resistant and passwordless. JWTs in localStorage are XSS-vulnerable. JWTs in HttpOnly cookies are "sessions with extra steps." Better Auth is the momentum library.
- **When:** Every user-facing application.
- **When NOT:** Service-to-service auth (use JWTs there — their intended purpose).
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### Zod at Every Boundary
- **What:** Validate all incoming data with Zod schemas. Use the same schemas for tRPC procedures, API handlers, and form submissions. Whitelist fields — never blacklist.
- **Why:** Zod provides runtime validation AND compile-time types from a single source. Input validation is your primary security layer against injection, BOLA, and malformed data.
- **When:** Every API endpoint, every form handler, every external data source.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### Start Monolith, Extract Services
- **What:** Begin with a well-structured modular monolith. Feature modules with clear boundaries and defined interfaces. Extract to microservices only when team or scaling boundaries demand it.
- **Why:** Microservices add network latency, operational complexity, and deployment overhead. Most teams don't need them. A modular monolith gives you clean boundaries with monolith simplicity.
- **When:** Default approach for teams <5 engineers, or when modules don't have independent scaling needs.
- **When NOT:** When separate teams own separate domains, or modules need independent scaling or different tech stacks.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### OpenTelemetry from Day One
- **What:** Instrument with OpenTelemetry SDK from the first API route. Structured JSON logging with consistent fields. Distributed tracing across all services. Correlate logs, metrics, and traces via trace IDs.
- **Why:** Retrofitting observability is painful and expensive. OTel is the vendor-neutral standard (89% of production users consider it critical). Observability lets you answer "why is this specific request slow" without deploying new code.
- **When:** Every backend service.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### BullMQ for Queues, Kafka for Streams
- **What:** Use BullMQ (Redis-backed) for background jobs, scheduled tasks, and moderate-scale messaging. Graduate to Kafka only for high-throughput event streaming or durable event logs.
- **Why:** BullMQ has minimal operational overhead (just Redis). Kafka adds significant complexity. Don't over-engineer message infrastructure.
- **When:** BullMQ: background jobs, email sending, image processing, webhook delivery. Kafka: event sourcing, data pipelines, multi-consumer streaming.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### Multi-Layer Caching
- **What:** L1 in-memory (per-instance) → L2 Redis/Upstash (distributed) → L3 CDN/Edge (global). Cache-aside as the default pattern. Pub/sub invalidation for multi-instance freshness.
- **Why:** Multi-layer caching gives sub-microsecond local hits while maintaining cross-instance consistency. Upstash for edge/serverless (HTTP-based, no connection pooling).
- **When:** Any service with repeated reads.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

### Expand-and-Contract Migrations
- **What:** Database migrations in three phases: expand (add new alongside old), migrate (backfill data), contract (remove old). Never destructive in a single step.
- **Why:** Zero-downtime deployments require both old and new app versions to work during migration. Single-step destructive changes cause outages.
- **When:** Every production database migration. No exceptions.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md)

## Revision History
- 2026-02-13: Initial extraction from [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md).

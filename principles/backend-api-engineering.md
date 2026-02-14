# Backend & API Engineering Principles (2026)

## Summary
Opinionated, practical engineering guidance for building backend systems and APIs in 2026. TypeScript-ecosystem-weighted. Covers frameworks, API design, databases, auth, security, testing, caching, observability, deployment, AI-agent readiness, and idempotency.

## Principles

### Hono for Edge, Fastify for Node
- **What:** Use Hono for edge/serverless/multi-runtime deployments. Use Fastify for Node.js-specific APIs. Don't use Express for new projects. Hono RPC provides built-in type safety — evaluate before adding tRPC.
- **Why:** Hono runs on every JS runtime (Workers, Deno, Bun, Lambda, Node), has a tiny bundle, and is Web Standards-based. Fastify is the mature Node.js choice with schema-driven validation. Express lacks type safety, validation, and modern performance.
- **When:** Every new backend project. Migrate existing Express apps incrementally to Fastify.
- **When NOT:** NestJS for large enterprise teams needing enforced structure. Elysia if all-in on Bun.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md), [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### tRPC for Internal, REST for External
- **What:** Use tRPC v11 for full-stack TypeScript internal APIs. Use REST for public/third-party APIs. GraphQL for mobile clients. gRPC for service-to-service performance.
- **Why:** tRPC v11 adds FormData/binary support, SSE subscriptions, and streaming — fewer reasons to fall back to REST internally. 35-40% faster development with zero code generation and end-to-end type safety.
- **When:** Any TypeScript monorepo (tRPC). Public APIs (REST). Multiple client types with complex data needs (GraphQL).
- **When NOT:** tRPC is not for third-party API consumers. If already on Hono, evaluate Hono RPC first — it may be sufficient.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md), [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### Design APIs for Agent Consumption
- **What:** Build APIs that AI agents can discover, understand, and invoke reliably. Single well-typed input schemas, deterministic execution, rich machine-readable errors, self-describing endpoints (OpenAPI/MCP), cursor-based pagination.
- **Why:** AI agents are now first-class API consumers alongside humans and frontend code. MCP (Model Context Protocol) is supported by Anthropic, OpenAI, Google, and Microsoft. Agent traffic is bursty, retry-heavy, and multi-step.
- **When:** Any API that will be consumed by AI agents, automation, or exposed via MCP. Increasingly, this means every API.
- **When NOT:** Purely internal APIs in a tRPC monorepo where agents aren't in the loop.
- **Source:** [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### Idempotency on Every Mutating Endpoint
- **What:** Use `Idempotency-Key` headers on POST endpoints. ACID check-and-execute. Store results for 24hrs. Don't cache 500s. Return exact same response on retry.
- **Why:** Agents retry aggressively. Networks are unreliable. Double-charges, duplicate creates, and repeated side effects are unacceptable. GET/PUT/DELETE are naturally idempotent; POST needs explicit handling.
- **When:** Every mutating endpoint, especially payments, webhook receivers, agent-facing APIs, and queue consumers.
- **Source:** [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### Drizzle for New Projects
- **What:** Use Drizzle ORM for new TypeScript backend projects. Types inferred from TypeScript schema — no generation step. SQL-centric, minimal bundle. Now with MSSQL support and consolidated validator packages.
- **Why:** Up to 14x lower latency on complex joins. Zero external dependencies. Designed for serverless/edge (fast cold starts). 25k+ GitHub stars, production-ready v1.0 beta.
- **When:** New projects, especially edge/serverless deployments.
- **When NOT:** Prisma if you want maximum abstraction, a more mature ecosystem, or your team prefers schema-first workflow.
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md), [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### Passkeys + Server-Side Sessions
- **What:** Use passkeys (WebAuthn) as the default auth credential. Server-side sessions with HttpOnly/Secure/SameSite cookies for session management. Short-lived access tokens + refresh tokens. Better Auth is the momentum library.
- **Why:** Passkeys are phishing-resistant and passwordless. Now a compliance requirement — multiple 2026 regulatory deadlines (UAE Mar, India Apr, Philippines Jun, EU end of year). What was a 6-month migration is now 2-3 sprints.
- **When:** Every user-facing application. Non-optional for apps serving regulated markets.
- **When NOT:** Service-to-service auth (use JWTs there — their intended purpose).
- **Source:** [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md), [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

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
- **What:** Instrument with OpenTelemetry SDK from the first API route. Structured JSON logging with consistent fields. Distributed tracing across all services. Correlate logs, metrics, and traces via trace IDs. New: GenAI semantic conventions for tracing agent/LLM calls.
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

### Node.js Native TypeScript for Development
- **What:** Use `node file.ts` for development and scripts (v23.6+). Type stripping handles erasable syntax natively. Still compile for production (tree-shaking, enums, source maps). Drop `ts-node` — use `tsx` when you need runtime syntax.
- **Why:** Eliminates the dev-time build step for most TypeScript. Native fetch (Undici 7.0) is 30% faster — drop `axios`/`node-fetch`. Permission Model (`--permission`) adds security for untrusted code.
- **When:** Development, scripts, CI tasks. Production builds still go through a compiler.
- **Source:** [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### Effect-TS for Critical Services
- **What:** Use Effect-TS for services where reliability, error handling, and concurrency are critical. Typed errors, structured concurrency (fibers), resource safety (scopes), dependency injection — all in one coherent system. Effect Cluster for distributed durable workflows.
- **Why:** TypeScript's throw/catch is unsafe. `neverthrow` gives you Result types. Effect gives you Result types + structured concurrency + resource safety + DI. It's the maximal approach to TypeScript reliability.
- **When:** New services with critical reliability requirements. Teams comfortable with functional patterns.
- **When NOT:** Existing codebases (migration is non-trivial). Simple CRUD apps. Teams unfamiliar with functional programming. Use `neverthrow` for just Result types.
- **Source:** [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

### Govern MCP Like APIs
- **What:** Treat MCP server deployments with the same governance as API deployments. Centralized auth, rate limiting, audit logging. No "Shadow MCP" — unsanctioned MCP servers are the new shadow IT.
- **Why:** MCP servers expose tool capabilities to AI agents. Ungoverned MCP servers are attack vectors — repositories hosting MCP servers are prime targets in 2026.
- **When:** Any organization deploying MCP servers or exposing tools to AI agents.
- **Source:** [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md)

## Revision History
- 2026-02-13: Initial extraction from [research/2026-02-13-backend-api-practices.md](../research/2026-02-13-backend-api-practices.md).
- 2026-02-14: Major update — added agent-ready APIs, idempotency, Hono RPC, tRPC v11, Effect-TS, Node.js native TS, MCP governance, passkey compliance. Updated existing principles with new context. Source: [research/2026-02-14-backend-api-practices-update.md](../research/2026-02-14-backend-api-practices-update.md).

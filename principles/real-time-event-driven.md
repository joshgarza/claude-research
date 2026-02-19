# Real-time & Event-Driven Architecture Principles

## Summary
Decision frameworks for real-time transport selection (SSE vs WebSocket vs polling), event-driven patterns (event sourcing, CQRS, pub/sub), reliable messaging (outbox pattern), and UI consistency under eventual consistency. Oriented toward TypeScript/Node.js stacks.

## Principles

### SSE is the Default for Server-to-Client Push
- **What:** Use Server-Sent Events (SSE) as the default for any server-to-client real-time push. Reserve WebSockets for cases that require genuine bidirectional communication. ~80% of real-time use cases are unidirectional (notifications, feeds, LLM streaming, dashboards, live analytics).
- **Why:** SSE is plain HTTP — it works through every proxy, CDN, firewall, and edge runtime without special configuration. HTTP/2 multiplexing eliminates the old "6 connections per domain" limitation. SSE auto-reconnects natively. tRPC v11's `httpSubscriptionLink` provides typed SSE subscriptions without a WebSocket server. WebSocket adds connection-state complexity (heartbeat, reconnection logic, scaling with sticky sessions or adapter) that SSE avoids.
- **When:** Server → client only: notifications, live feeds, LLM token streaming, real-time dashboards, progress events, CQRS read model updates. NGINX requires `proxy_buffering off`; Caddy requires `flush_interval -1`.
- **When NOT:** Bidirectional interaction (chat, multiplayer gaming, collaborative editing), ultra-low latency (<50ms) with high bidirectional frequency.
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

### Scale WebSocket with Pub/Sub Adapters, Not Sticky Sessions
- **What:** When scaling WebSocket servers horizontally, use a shared pub/sub adapter (Redis, NATS) rather than sticky load balancing. Every WebSocket server instance subscribes to the broker; messages published by any instance fan out to all connected clients regardless of which instance holds their connection.
- **Why:** Sticky sessions route clients to the same server permanently — they break on server failure and prevent true horizontal scaling. The pub/sub adapter approach makes every server instance stateless with respect to connection routing. Message arrives at any server → published to broker → all instances deliver to their local connected clients.
- **When:** Any WebSocket deployment with more than one server instance. Practical limit per Node.js process: 10,000–30,000 concurrent connections. Add instances + Redis adapter rather than vertically scaling a single server.
- **When NOT:** Single-instance deployments (development, low-traffic). Managed WebSocket services (Ably, Pusher) handle this infrastructure for you.
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

### Event Sourcing is a Specialized Tool — Don't Apply by Default
- **What:** Apply event sourcing only to bounded contexts where audit trail fidelity, temporal queries, or event-driven inter-service communication are genuine requirements. Use standard CRUD + history tables for everything else. Hybrid architectures (event-sourced core + CRUD periphery) are valid and common.
- **Why:** Event sourcing imposes significant scaffold overhead (commands, handlers, validators, events, aggregates, projections, materializers). Production realities: projection maintenance scales with event volume, schema evolution requires upcasters, materialization lag causes 404s on newly created aggregates, and most UIs are form-based not task-based — creating frontend impedance. The "free audit log" becomes noisy and expensive to filter.
- **When:** Financial transactions, healthcare records, compliance domains, AI agent traces, long-running workflows, inter-service event contracts. Specifically: when you need to answer "what was the state on date X?" or replay events to rebuild derived state.
- **When NOT:** User profiles, product catalogs, configuration, session management, any domain where a history table (`updated_at`, `updated_by`, `previous_value`) meets the audit requirement. If "why event sourcing?" yields only vague answers about "flexibility" — don't use it.
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

### Use CQRS Level 1 First — Escalate to Level 2 Under Load
- **What:** Start with Level 1 CQRS (separate command and query logic, single database). Escalate to Level 2 (separate read and write databases with materialized views) only when read/write scaling requirements genuinely diverge. Level 1 captures most of the clarity benefits with minimal added complexity.
- **Why:** Level 2 CQRS introduces eventual consistency between stores, synchronization logic, projection update pipelines, and operational overhead of two database deployments. Most applications that benefit from CQRS don't need separate stores — they need separate models. Commands encode business intent (`BookHotelRoom`, not `SET status = reserved`). Queries return flat DTOs, not domain objects.
- **When:** Level 1: any app with complex write-side domain logic and simple display needs. Level 2: read:write ratio >10:1, read and write scaling requirements diverge, or integrating with event sourcing (event store = write model, projections = read model).
- **When NOT:** Simple CRUD domains, small teams unfamiliar with the pattern, apps where a single ORM model is sufficient.
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

### Use the Outbox Pattern for Atomic DB Update + Event Publish
- **What:** When a state change must both update the database and publish an event to a broker, write the event to an `outbox` table in the same database transaction. A separate relay process (polling publisher or CDC via Debezium) reads confirmed outbox rows and publishes them to the broker. All event consumers must be idempotent — the relay delivers at-least-once.
- **Why:** You cannot atomically update a relational database and publish to a message broker without 2PC (which most stacks don't support and is fragile). The outbox pattern achieves atomicity via a single database transaction: either both the business change and the outbox record commit, or neither does.
- **When:** Any event-driven system where database updates trigger downstream events. Payment processing, order workflows, any CQRS Level 2 write model, transactional microservice boundaries.
- **When NOT:** Pure in-process event emission (EventEmitter) within a monolith. Append-only event stores used with event sourcing (the event write IS the state change — no dual-write problem).
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

### Optimistic Updates with Smart Invalidation for UI Consistency
- **What:** Default to optimistic updates for user-facing mutations. Use TanStack Query's `onMutate`/`onSettled` cycle: cancel conflicting queries, snapshot current cache, apply optimistic change, roll back on error. In `onSettled`, gate invalidation with `queryClient.isMutating()` to prevent over-invalidation when concurrent mutations are in-flight.
- **Why:** Eventual consistency means reads may lag writes. Waiting for server confirmation creates perceptibly slow UIs. Optimistic updates provide instant feedback while server round-trips complete. The `isMutating` guard prevents the race where mutation A's `onSettled` invalidation triggers a refetch that overwrites mutation B's optimistic state.
- **When:** All standard CRUD mutations. Escalate to real-time server push (SSE/WebSocket invalidation) when multiple users share state. Use blocking UI (disabled controls + spinner) only for irreversible, high-stakes operations (payments, legal agreements).
- **When NOT:** Financial transactions where the response value (transaction ID, final amount) cannot be predicted client-side. Concurrent collaborative editing with conflict potential — use versioning + conflict detection or CRDTs.
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

### Match Message Broker to Durability and Throughput Requirements
- **What:** Choose message brokers based on three axes: durability requirement (ephemeral vs durable), throughput target, and operational cost budget. Redis Pub/Sub for ephemeral notifications (fire-and-forget, sub-ms). NATS JetStream for durable low-latency service mesh messaging. Kafka for high-throughput event streaming, analytics pipelines, and multi-consumer replay.
- **Why:** Redis Pub/Sub drops messages when no subscriber is connected — unsuitable for reliability. NATS has microsecond latency and minimal ops overhead, making it ideal for synchronous microservice communication patterns. Kafka's throughput (millions/sec), log compaction, and consumer group replay are unmatched but carry significant operational cost.
- **When:** Redis: cache invalidation broadcast, ephemeral presence signals, already-in-stack lightweight pub/sub. NATS: service mesh, request-reply RPC, IoT telemetry. Kafka: event sourcing pipelines, audit logs, analytics, multi-team event sharing. BullMQ: background job processing (not pub/sub).
- **When NOT:** Kafka for simple notification fan-out (operational overkill). Redis Pub/Sub for anything that must survive subscriber downtime. NATS without JetStream for anything requiring durable replay.
- **Source:** [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md)

## Revision History
- 2026-02-19: Initial extraction from [research/2026-02-19-real-time-event-driven-architecture.md](../research/2026-02-19-real-time-event-driven-architecture.md).

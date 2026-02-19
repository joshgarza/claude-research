---
date: 2026-02-19
topic: Real-time & Event-Driven Architecture
status: complete
tags: [websockets, sse, event-sourcing, cqrs, pub-sub]
---

# Real-time & Event-Driven Architecture

## Context

Investigated to establish a decision framework for real-time transport selection (WebSocket vs SSE vs polling) and to document event-driven architecture patterns (event sourcing, CQRS, pub/sub) with concrete guidance on when each is appropriate. The previous backend research touched on BullMQ/Kafka and SSE briefly (for LLM streaming) but did not cover the broader real-time decision space or event-driven patterns in depth.

## Findings

### 1. Transport Decision Framework: WebSocket vs SSE vs Polling

The choice of real-time transport hinges on a four-question decision tree:

1. **Is bidirectional communication required?** If yes, WebSocket. If no, SSE is almost always the better choice over WebSocket.
2. **Can you tolerate hours of latency?** If yes, simple polling + state diffing (see integration-patterns.md).
3. **Are you in a restrictive enterprise/firewall environment?** If yes, SSE wins over WebSocket (SSE is just HTTP).
4. **Do you need ultra-low latency (<50ms) or P2P?** WebRTC or WebTransport (experimental, not production-ready).

**~80% of real-time use cases are server-to-client only** (notifications, feeds, LLM streaming, dashboards, analytics). For these, SSE is the correct default. WebSocket is for the remaining ~20% requiring genuine bidirectional interaction (chat, multiplayer, collaborative editing).

#### Server-Sent Events (SSE)

SSE uses a single persistent HTTP connection over which the server pushes newline-delimited `data:` frames. The browser's native `EventSource` API handles reconnection automatically with `Last-Event-ID`.

**Advantages:**
- Pure HTTP — works through every proxy, firewall, and CDN without special configuration
- HTTP/2 multiplexing eliminates the old "6 connections per domain" limitation (the primary historical objection to SSE)
- Natural fit for edge/serverless deployments (Cloudflare Workers, Vercel Edge Functions) — no WebSocket server needed
- Automatic reconnection built into the protocol
- tRPC v11 ships `httpSubscriptionLink` for SSE subscriptions — no WebSocket server required for typed subscriptions
- OpenAI/Anthropic use SSE for LLM streaming, which has mainstreamed the protocol in 2025

**Limitations:**
- Client-to-server communication still requires separate HTTP requests (not a limitation for most use cases)
- Native `EventSource` cannot send custom headers or use POST — use the `sse.js` polyfill if needed
- Mobile OS backgrounds kill connections — fall back to push notifications for mobile

**Infrastructure configuration for SSE:**
- NGINX: `proxy_buffering off`, `X-Accel-Buffering: no`, `proxy_read_timeout 24h`
- Caddy: `flush_interval -1`, disable compression for `text/event-stream`
- Apache: disable `mod_deflate` for SSE endpoints

**SSE implementation (Node.js/Express):**
```typescript
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (id: string, data: unknown) => {
    res.write(`id: ${id}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to your event source
  const unsubscribe = eventBus.subscribe((event) => {
    sendEvent(event.id, event.payload);
  });

  req.on('close', () => unsubscribe());
});
```

Source: [RxDB real-time comparison](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html), [SSE comeback 2025](https://portalzine.de/sses-glorious-comeback-why-2025-is-the-year-of-server-sent-events/)

#### WebSockets

Full-duplex connection over a single long-lived TCP connection. After the HTTP upgrade handshake, frames have only 2 bytes of overhead. Best for:
- Chat applications
- Multiplayer games
- Collaborative document editing (with CRDTs)
- Real-time trading dashboards requiring sub-100ms updates in both directions

**Scaling WebSockets** is the primary complexity: each connection is stateful and server-pinned by default. Two approaches:

**Sticky sessions (simpler, fragile):** Load balancer routes a client to the same server for the lifetime of the connection. Works but breaks on server failure — client must reconnect and re-establish state.

**Pub/sub adapter (recommended for production):** Each WebSocket server instance subscribes to a shared message broker (Redis, NATS). Messages are published to the broker, which fans out to all instances. Any instance can serve any client — no affinity required.

```typescript
// Socket.IO + Redis adapter (horizontal scaling)
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://redis:6379' });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

Connection limits per Node.js process: typically 10,000–30,000 concurrent connections (depends on OS file descriptor limits, `ulimit -n`). Scale horizontally with the pub/sub adapter. Source: [WebSocket at Scale guide](https://websocket.org/guides/websockets-at-scale/)

#### Polling

Simple polling (every N seconds) and long polling (server holds request open until data is available) are legacy approaches except in specific contexts:

- **Short polling:** Acceptable when updates are infrequent (>30s interval) and implementation simplicity outweighs latency. The "state diffing" pattern (poll + diff against local state) is excellent for low-frequency integrations.
- **Long polling:** The fallback of last resort for environments that block both WebSocket and SSE. Avoid for new systems.

#### WebTransport / WebRTC

- **WebTransport** (HTTP/3 QUIC): Experimental. Not supported in Safari as of early 2026. No stable Node.js implementation. Monitor but do not use in production.
- **WebRTC**: For P2P audio/video and ultra-low latency P2P data. Not for server-client communication — requires a signaling server and is inappropriate for standard API use cases.

#### Decision Matrix

| Requirement | Recommendation |
|---|---|
| Server-to-client push, HTTP-friendly | **SSE** |
| Bidirectional, interactive | **WebSocket** |
| Hours latency OK, simple | **Polling + state diff** |
| LLM streaming | **SSE** |
| Collaborative editing | **WebSocket + CRDT** |
| IoT / constrained devices | **MQTT** |
| Real-time analytics dashboard | **SSE** |
| Multiplayer game | **WebSocket** |
| Enterprise/proxy-heavy env | **SSE** (falls back naturally) |

---

### 2. Event Sourcing

Event sourcing persists domain state as an append-only sequence of events rather than storing current state. To read current state, replay all events for an aggregate from the beginning (or from the last snapshot).

**Core mechanics:**
1. Commands arrive and are validated by an aggregate
2. Aggregate emits events (past-tense domain facts: `OrderPlaced`, `PaymentProcessed`)
3. Events are persisted atomically to the event store
4. State is rebuilt by replaying events (`apply` handlers fold events into state)
5. Events are published to subscribers for downstream projections, notifications, and inter-service communication

```typescript
// TypeScript event sourcing aggregate pattern
type OrderEvent =
  | { type: 'OrderPlaced'; customerId: string; total: number }
  | { type: 'OrderCancelled'; reason: string };

interface OrderState {
  status: 'pending' | 'placed' | 'cancelled';
  customerId?: string;
  total?: number;
}

function evolve(state: OrderState, event: OrderEvent): OrderState {
  switch (event.type) {
    case 'OrderPlaced':
      return { ...state, status: 'placed', customerId: event.customerId, total: event.total };
    case 'OrderCancelled':
      return { ...state, status: 'cancelled' };
  }
}

// Rehydrate aggregate
const currentState = events.reduce(evolve, { status: 'pending' });
```

**Snapshots:** For aggregates with thousands of events, store periodic state snapshots to avoid replaying the full history. Load the latest snapshot + only subsequent events.

#### When Event Sourcing Is Worth It

Apply event sourcing selectively — only to bounded contexts where the benefits are genuinely needed:

- **Audit trails with replay:** Financial transactions, healthcare records, compliance domains — where "what happened, when, and why" must be forensically reproducible
- **Temporal queries:** "What was the state of this order on date X?"
- **Event-driven microservice integration:** Events become the inter-service communication contract
- **Undo/redo and workflow resumption:** AI agent traces, long-running workflows

#### When NOT to Use Event Sourcing

This is the most important section. Event sourcing is dramatically oversold. Per the production experience at [Blogomatano](https://chriskiehl.com/article/event-sourcing-is-hard) and [Event-Driven.io](https://event-driven.io/en/type_script_node_js_event_sourcing/):

- **Simple CRUD domains:** User profiles, product catalogs, configuration management — none of these need event sourcing
- **Small teams without experience:** The scaffolding burden (commands, command handlers, validators, events, aggregates, projections, materializers) is substantial
- **Domains without a clear audit/replay requirement:** If your answer to "why event sourcing?" invokes vague benefits like "flexibility" or "auditability" you could implement with a history table — use history tables
- **Short-lived entities:** High-churn data where event replay becomes expensive without careful snapshot management
- **When CQRS without event sourcing suffices:** Separate read/write models provide most of the scaling benefits without the event replay complexity

**Real production pains:**
- Projection maintenance overhead: every new projection touches the entire event stream
- "Free audit log" becomes expensive — transient state changes create noise requiring filtering
- Schema evolution: changing an event type after production events exist requires upcasting/migration logic
- UI impedance: most UIs are form-based, not task-based — CQRS + event sourcing demands task-based UI design
- Materialization lag: newly created aggregates return 404 while projections catch up

Source: [Event Sourcing is Hard (Blogomatano)](https://chriskiehl.com/article/event-sourcing-is-hard), [microservices.io Event Sourcing](https://microservices.io/patterns/data/event-sourcing.html)

---

### 3. CQRS (Command Query Responsibility Segregation)

CQRS separates the write model (commands that mutate state) from the read model (queries that return data). This is independent of event sourcing — you can use CQRS without event sourcing.

**Two levels of CQRS:**

**Level 1 — Same database, separate models:** Write model includes domain logic and validation. Read model returns flat DTOs optimized for the UI. Single data store. This is often sufficient and adds minimal complexity.

**Level 2 — Separate databases:** Write store (relational, normalized, transactional) + read store (document DB, denormalized, optimized for queries). The write model publishes events when state changes; the read model consumes them to update materialized views. This introduces eventual consistency between stores.

**Command design principle:** Commands should represent business intent, not data operations. Not `SET reservation_status = 'reserved'` but `BookHotelRoom`. This guides the write model toward domain-meaningful operations.

**When CQRS makes sense:**
- Read:write ratio is very high (>10:1 reads) — optimize query path independently
- Read and write scalability requirements diverge (read replicas, read-optimized schemas)
- Complex domain logic on the write side + simple display needs on the read side
- Collaborative environments where multiple users modify shared data — commands are granular enough to reduce conflicts
- Systems integrating with event sourcing (they compose naturally: event store = write model, materialized views = read model)

**When CQRS is overkill:**
- Simple CRUD apps
- Small domains with no scalability pressure
- Teams without experience with the pattern — the indirection adds cognitive overhead before it adds value

**Eventual consistency in CQRS:** When using separate stores, reads lag writes. The UI must handle this:
- After a successful command, show the user's own change immediately via optimistic update
- Don't assume the read model reflects the just-committed write instantly
- Consider a short TTL read-your-own-writes cache: after a command, return the write model's current state directly for the issuing user's next request

Source: [CQRS Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

---

### 4. Pub/Sub Design

Pub/sub decouples publishers from subscribers via a message broker. Publishers write to topics/channels; subscribers consume from them without knowing who published.

#### Technology Selection

| Technology | Throughput | Latency | Durability | Ops Cost | Best For |
|---|---|---|---|---|---|
| **Redis Pub/Sub** | Moderate | Sub-ms | None (fire & forget) | Low | Ephemeral notifications, cache invalidation, session broadcast |
| **Redis Streams** | Moderate | Sub-ms | Consumer groups, ACK | Low | Ordered, persistent queues with Redis already in stack |
| **NATS** | Very high | Microseconds | Optional (JetStream) | Very low | Service mesh, microservice RPC + pub/sub, IoT |
| **Kafka** | Millions/s | Tens of ms | Durable (configurable) | High | Event sourcing pipelines, analytics, multi-consumer streams, log compaction |
| **BullMQ** | Moderate | ms | Redis-backed | Low | Background jobs, scheduled tasks (not pure pub/sub) |

**Redis Pub/Sub critical caveat:** Messages published when no subscriber is connected are **permanently lost**. Use Redis Streams or a proper message broker if durability matters.

**Kafka vs NATS vs Redis — decision heuristic:**
- Already running Redis for caching → use Redis Streams for lightweight pub/sub needs
- Service-to-service communication, request-reply, low latency → NATS (JetStream for persistence)
- Event sourcing, analytics pipelines, audit log, multi-consumer fan-out with replay → Kafka
- Background jobs with retry/delay/priority → BullMQ (not pub/sub, but often conflated)

Source: [NATS vs Redis vs Kafka comparison](https://www.index.dev/skill-vs-skill/nats-vs-redis-vs-kafka), [Ably pub/sub guide](https://ably.com/topic/pub-sub), [Redis pub/sub vs Kafka - AWS](https://aws.amazon.com/compare/the-difference-between-kafka-and-redis/)

#### Fan-Out + Per-Consumer Queue Pattern

For reliable fan-out, don't rely on pub/sub alone:

1. Pub/sub layer handles fan-out to N services (each gets a copy of the event)
2. Each service has its own durable queue for processing
3. The queue provides: backpressure, retry, independent scaling, dead-letter handling

This is the pattern Redis/Kafka recommends for high-reliability fan-out: pub/sub for distribution, queues for processing.

#### The Transactional Outbox Pattern

The fundamental problem in event-driven systems: how do you atomically update your database AND publish an event? You can't enlist a relational DB and a message broker in a single transaction (no 2PC).

**The outbox pattern:**
1. In the same DB transaction that modifies business data, write the event to an `outbox` table
2. A separate message relay process polls the outbox (or uses CDC via Debezium/Postgres logical replication) and publishes confirmed events to the broker
3. Mark outbox messages as published after successful delivery

```sql
-- Business transaction (atomic)
BEGIN;
  UPDATE orders SET status = 'placed' WHERE id = $1;
  INSERT INTO outbox (aggregate_id, event_type, payload, created_at)
    VALUES ($1, 'OrderPlaced', $2, NOW());
COMMIT;

-- Message relay (separate process, at-least-once)
SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 100;
-- publish to broker...
UPDATE outbox SET published_at = NOW() WHERE id = ANY($ids);
```

**Consumers must be idempotent** — the relay publishes at-least-once. Use `event_id` deduplication keys.

Source: [Transactional Outbox - microservices.io](https://microservices.io/patterns/data/transactional-outbox.html), [Confluent outbox course](https://developer.confluent.io/courses/microservices/the-transactional-outbox-pattern/)

---

### 5. Eventual Consistency in the UI

When using CQRS with separate stores, event-driven architectures, or distributed systems, the UI must handle the gap between write confirmation and read availability.

#### Four Strategies (in order of increasing complexity)

**1. Optimistic Updates (default for most CRUD)**

Assume success, update the UI immediately, roll back on error. This is the right default for most user interactions.

```typescript
// TanStack Query optimistic pattern
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos', newTodo.id] });
    const previousTodo = queryClient.getQueryData(['todos', newTodo.id]);
    queryClient.setQueryData(['todos', newTodo.id], newTodo); // optimistic
    return { previousTodo };
  },
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todos', newTodo.id], context?.previousTodo); // rollback
  },
  onSettled: () => {
    // Only invalidate if no other mutations are pending for this data
    if (queryClient.isMutating({ mutationKey: ['todos'] }) === 1) {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    }
  },
});
```

**Concurrent mutation safety:** Cancel queries in `onMutate`. Use `isMutating()` check in `onSettled` to prevent over-invalidation when multiple mutations are in-flight. Source: [TkDodo concurrent optimistic updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)

React 19's built-in `useOptimistic` hook is an alternative for server action-based flows, but has known incompatibility with `useSyncExternalStore` (used by React Query). Prefer TanStack Query's own mechanism in React Query codebases.

**2. Real-Time Server Push (WebSocket/SSE invalidation)**

After a mutation, the server pushes an invalidation event to all clients. Each client invalidates its cache. Useful for collaborative features where multiple users share state.

```typescript
// SSE-based cache invalidation
useEffect(() => {
  const es = new EventSource('/api/events');
  es.addEventListener('todo:updated', (e) => {
    const { id } = JSON.parse(e.data);
    queryClient.invalidateQueries({ queryKey: ['todos', id] });
  });
  return () => es.close();
}, [queryClient]);
```

**3. Block UI Until Confirmed**

For high-stakes, irreversible operations (payments, irreversible deletions, legal agreements): disable the triggering control, show a loading state, update only after server confirmation. Trades responsiveness for consistency guarantees. Not appropriate for routine CRUD.

**4. Versioning + Conflict Detection**

Each entity carries a version number. Before committing a mutation, compare the entity's version against the server's. On mismatch, resolve conflict (last-write-wins, merge, or user prompt). Used in collaborative editing (Notion, Google Docs) and CRDTs.

```typescript
async function saveWithVersionCheck(update: EntityUpdate) {
  const current = await fetch(`/api/entities/${update.id}`).then(r => r.json());
  if (current.version !== update.expectedVersion) {
    return resolveConflict(update, current); // merge or prompt
  }
  return fetch(`/api/entities/${update.id}`, { method: 'PUT', body: JSON.stringify(update) });
}
```

Source: [LogRocket — solving eventual consistency in frontend](https://blog.logrocket.com/solving-eventual-consistency-frontend/)

#### Read-Your-Own-Writes

In CQRS with async projection lag, a user who just submitted a command may not see their change in the next read query (the projection hasn't caught up). Solutions:

- Return the updated aggregate state directly from the command handler response and use it to seed the client cache
- Add a short-lived per-user "pending writes" cache at the API layer that overrides stale read model data for 1-2 seconds after a command

---

### 6. Event-Driven Architecture: Anti-Patterns and Guardrails

**Don't source all events:** Apply event sourcing only to the bounded contexts with genuine audit/replay requirements. Use standard CRUD for the rest. Hybrid architectures (some event-sourced, some CRUD) are valid and common.

**Don't share event schemas across services:** Events published between services should be versioned API contracts, not raw domain events. Use an anti-corruption layer. Source: [Event Sourcing is Hard](https://chriskiehl.com/article/event-sourcing-is-hard)

**Event schema evolution:** Prefer additive changes (new optional fields). For breaking changes, use upcasters (version-specific converters applied during replay). Pin event schemas at a version and never mutate published events.

**The Saga pattern for distributed transactions:** When a business process spans multiple services (order placement → payment → inventory reservation), use a Saga. Either choreography (each service publishes events that trigger the next) or orchestration (a saga orchestrator sends commands to each service). Compensating transactions handle rollback.

**Avoid direct aggregate-to-aggregate event subscriptions:** Inter-aggregate communication through events creates coupling at the event schema level. Prefer having read models (projections) that join multiple aggregates' data for queries.

---

### Technology Stack Summary (TypeScript Ecosystem)

| Layer | Recommended |
|---|---|
| Real-time push (unidirectional) | SSE via `better-sse` or tRPC `httpSubscriptionLink` |
| Real-time push (bidirectional) | Socket.IO + Redis adapter, or Ably (managed) |
| Pub/sub (in-process) | Node.js `EventEmitter` or `mitt` |
| Pub/sub (cross-service, ephemeral) | Redis Pub/Sub |
| Pub/sub (cross-service, durable) | BullMQ (jobs) or NATS JetStream |
| Event streaming (high volume) | Apache Kafka or Redpanda |
| Event store | EventStoreDB, or PostgreSQL with append-only events table |
| Outbox relay | Debezium (CDC) or custom polling publisher |
| Optimistic updates | TanStack Query (`onMutate`/`onSettled`) |

## Open Questions

- **tRPC v11 SSE vs WebSocket subscriptions:** tRPC recommends SSE for subscriptions, but what are the limits for high-frequency real-time data (e.g., live trading at 50+ events/sec per subscription)?
- **Vercel/Cloudflare Workers + WebSockets:** Edge runtimes are adding WebSocket support (Cloudflare Durable Objects). What are the practical limits vs managed services like Ably/Pusher for production WebSocket at scale?
- **CRDT libraries for TypeScript:** Yjs and Automerge are the main options. When does collaborative editing complexity justify moving from optimistic-update-with-conflict-detection to a proper CRDT?
- **Kafka vs Redpanda in 2026:** Redpanda (Kafka-compatible, Rust-based, no ZooKeeper) is maturing. Is it production-ready enough to be the default over Kafka for new TypeScript projects?
- **EventSourcingDB:** A newer purpose-built event store (TypeScript/Go SDKs). How does it compare to EventStoreDB for TypeScript projects?

## Extracted Principles

Principles extracted to a new file: `principles/real-time-event-driven.md`

Key principles:
- SSE is the correct default for server-to-client push (not WebSocket)
- Scale WebSocket with pub/sub adapters, not sticky sessions
- Event sourcing is a specialized pattern — do not apply by default
- CQRS Level 1 (same DB, separate models) is usually sufficient; escalate to Level 2 only under load
- Outbox pattern is mandatory when atomically updating DB + publishing events
- Optimistic updates + TanStack Query isMutating guard is the standard UI consistency pattern
- Kafka for streaming, NATS for service mesh, Redis for ephemeral/cache-adjacent

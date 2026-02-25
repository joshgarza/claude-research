---
date: 2026-02-25
topic: Queue for agent orchestration
status: complete
tags: [agents, queue, concurrency, backpressure, bullmq, temporal, inngest, trigger-dev, rate-limiting]
related: [2026-02-23-ai-agent-ticket-orchestration.md, 2026-02-24-overstory.md, 2026-02-24-claude-code-headless-permissions-guardrails.md, 2026-02-19-real-time-event-driven-architecture.md]
---

# Queue for Agent Orchestration

## Context

In a high-volume agent system, it's possible to spawn more agents than the CPU can manage. The immediate trigger for this research is the `automation/queue.json` runner in this project — a simple sequential processor that launches Claude Code headless sessions one at a time. As demand grows (more queued research topics, more concurrent repos, more automated workflows), sequential execution becomes a bottleneck but unbounded parallel execution causes a different problem: CPU exhaustion, API rate limit violations (HTTP 429), and cascading failures.

The goal is a queue architecture for tasks that span across repos and domains, providing:
1. **Concurrency limits** — never spawn more agents than the system can handle
2. **Backpressure** — slow down producers when workers are saturated
3. **Durability** — survive crashes without losing in-progress tasks
4. **Observability** — know what's running, what's waiting, and what failed
5. **Priority** — high-priority tasks skip the queue ahead of low-priority ones

## Findings

### 1. Why Unbounded Agent Spawning Fails

The core failure mode is straightforward: if you do `Promise.all(tasks.map(spawn))` on 20 tasks, you create 20 concurrent processes. Each Claude Code session:
- Forks a subprocess (CPU overhead on spawn)
- Loads the model context (~200K tokens in memory)
- Makes concurrent API calls to Anthropic
- Reads/writes files (I/O contention)

Anthropic's API enforces hard rate limits across three dimensions ([Anthropic Rate Limits](https://platform.claude.com/docs/en/api/rate-limits)):

| Tier | Requests/min | Tokens/min | Daily Tokens |
|------|-------------|-----------|--------------|
| Free | 5 | 40,000 | 300,000 |
| Build | 50 | 100,000 | 5,000,000 |
| Scale | 1,000 | 2,000,000 | 100,000,000 |

"A single multi-agent workflow with 5 agents can exhaust Free tier limits in 60 seconds" ([Claude Code Plugins: Multi-Agent Rate Limits](https://claudecodeplugins.io/playbooks/01-multi-agent-rate-limits/)). Beyond API limits, the OS-level cost of forking multiple node.js processes and running multiple LLM inference loops simultaneously competes for the same CPU cores.

The canonical anti-pattern is `Promise.all()` without a concurrency limit. The canonical fix is a bounded worker pool — never running more than N concurrent agents regardless of queue depth.

### 2. The Three Queue Abstraction Levels

There are three levels of queue abstraction to choose from, each adding complexity but also adding capability:

#### Level 1: Simple Job Queue (BullMQ)
BullMQ is a Redis-backed job queue for Node.js with built-in concurrency, retries, priorities, and delayed jobs. The core model:

```typescript
import { Queue, Worker } from 'bullmq';

const agentQueue = new Queue('agent-tasks', { connection: redisConnection });

// Producer: add tasks
await agentQueue.add('research', { topic, description, outputFile }, {
  priority: task.priority,
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 }
});

// Worker: process with concurrency limit
const worker = new Worker('agent-tasks', async (job) => {
  return await spawnClaudeCodeAgent(job.data);
}, {
  connection: redisConnection,
  concurrency: 2 // never more than 2 concurrent agents
});
```

Key BullMQ production patterns ([BullMQ: Parallelism and Concurrency](https://docs.bullmq.io/guide/parallelism-and-concurrency)):
- **CPU-intensive jobs**: concurrency = 1-2 (one per core). Claude agents are CPU-intensive.
- **I/O-intensive jobs**: concurrency = 50-300 (exploit event loop idle time)
- **Multiple workers**: run separate worker processes across machines; BullMQ's Redis store is the shared coordination point
- **Graceful shutdown**: listen for `SIGTERM`, drain queue with `worker.close()`

BullMQ Pro adds group-based job assignment with max concurrency per group — useful for per-repo isolation (never more than 1 agent per repo simultaneously).

The graduation path: BullMQ → Kafka ([principles/backend-api-engineering.md](../principles/backend-api-engineering.md)). Start with BullMQ, add Kafka only when multiple teams need to share the event stream or you need event replay.

#### Level 2: Durable Execution Platform (Temporal / Trigger.dev / Inngest)

Traditional queues (BullMQ, SQS, RabbitMQ) are "send message → worker processes → done." If the worker crashes mid-task, the message may be lost or redelivered from the start. Durable execution platforms persist *intermediate state* — a workflow can crash and resume exactly where it left off.

**Temporal** ([Temporal: Durable Agents](https://temporal.io/blog/building-durable-agents-with-temporal-and-ai-sdk-by-vercel)):
- Activities = individual units of work (single API call, file write)
- Workflows = orchestration logic (deterministic, replay-safe)
- Worker auto-tuning via `targetCpuUsage` and `targetMemoryUsage` — automatically backs off slot allocation when CPU is high ([Resource-Based Auto-Tuning](https://temporal.io/blog/resource-based-auto-tuning-for-workers))
- Task Slots represent concurrent capacity; the system throttles new slot allocation via `rampThrottleMs`
- Horizontal scale: run more worker pods; all workers poll the same Task Queue; Temporal handles load balancing

```typescript
// Temporal: wrap an LLM call as a durable Activity
const { runAgent } = proxyActivities<Activities>({
  startToCloseTimeout: '24 hours', // supports long-running agents
  retry: { maximumAttempts: 3, initialInterval: '30s', backoffCoefficient: 2 }
});

export async function agentWorkflow(task: AgentTask): Promise<void> {
  await runAgent(task); // if server crashes mid-run, Temporal resumes here
}
```

**Trigger.dev** ([Trigger.dev Deep Dive](https://vadim.blog/trigger-dev-deep-dive)):
- Developer-first, designed for TypeScript/Next.js
- No timeouts (unlike Lambda/Vercel which cap at 15 minutes)
- Concurrency per task queue: `concurrencyLimit: 2` prevents overloading a downstream API
- `batchTriggerAndWait` for fan-out: parent spawns N child tasks, waits for all, bounded by queue's concurrency limit
- Checkpointing: tasks suspend during waits > ~5 seconds, eliminating idle compute charges
- MCP server: AI assistant can write tasks, deploy, trigger, and debug without leaving the editor

```typescript
export const agentTask = task({
  id: 'claude-agent',
  queue: { concurrencyLimit: 2 }, // max 2 concurrent agents of this type
  retry: { maxAttempts: 3, minTimeoutInMs: 5000, factor: 2 },
  run: async (payload: AgentPayload) => {
    await step.run('execute-agent', async () => {
      return spawnClaudeCodeAgent(payload);
    });
  }
});
```

**Inngest** ([Inngest: Queues Blog](https://www.inngest.com/blog/queues-are-no-longer-the-right-abstraction)):
- Event-driven: functions trigger on events, not direct job submission
- Serverless-first (works on Lambda, Cloudflare Workers, or servers)
- Built-in flow control: concurrency limits, rate limits, priorities as first-class primitives
- "Queues aren't the right abstraction" — their argument: raw queues require building retry, state, rate-limiting, and chaining infrastructure on top. Durable execution bakes this in.
- Strong observability: live tracing of every workflow, per-step AI token counts, bulk replay after bug fixes

**Comparison table** (synthesized from [Akka.io: Inngest vs Temporal](https://akka.io/blog/inngest-vs-temporal), [Temporal docs](https://temporal.io)):

| | BullMQ | Temporal | Trigger.dev | Inngest |
|--|--------|---------|-------------|---------|
| **Self-hosted** | Yes (Redis) | Yes (cluster) | Yes or cloud | Yes or cloud |
| **Durable state** | No (restart from scratch) | Yes (Event History) | Yes (Checkpoints) | Yes (Steps) |
| **TS DX** | Good | Complex | Excellent | Excellent |
| **CPU awareness** | Manual | Auto-tuning | Manual | Manual |
| **AI/LLM native** | No | Via AI SDK | Yes | Yes |
| **Ops overhead** | Low (Redis) | High (cluster) | Low (managed) | Low (managed) |
| **Best for** | Simple jobs, monorepos | Complex long-running | Full-stack TS apps | Event-reactive apps |

#### Level 3: Cloud-Native Message Brokers (Kafka, NATS, SQS)

For cross-domain, cross-team agent coordination, a message broker provides the decoupling layer. Per [principles/real-time-event-driven.md](../principles/real-time-event-driven.md):
- **Redis Pub/Sub**: ephemeral, drops messages when no subscriber. Not for durability.
- **NATS JetStream**: durable, low-latency, minimal ops. Good for internal service mesh.
- **Kafka**: high-throughput, multi-consumer replay, log compaction. Good when multiple teams consume the same event stream. Operational overkill for a single team.
- **BullMQ**: background job processing (not pub/sub). The right choice for agent task dispatch.

For the specific use case of Claude Code agent orchestration across repos, BullMQ + Redis is the right starting point. Kafka is only warranted if multiple independent services need to react to the same agent events.

### 3. Backpressure and Rate Limiting Patterns

Backpressure is the mechanism by which consumers signal producers to slow down. Without it, producers overwhelm consumers, causing queue bloat and eventually OOM or cascading failures.

**Three primary throttling strategies for Claude agents** ([Multi-Agent Rate Limits Playbook](https://claudecodeplugins.io/playbooks/01-multi-agent-rate-limits/)):

#### Token Bucket (Recommended)
Maintains a bucket of capacity that refills at a configurable rate. Allows burst requests up to capacity; smooth throttling for sustained operations.

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }
    // Wait until a token is available
    const waitMs = (1 / this.refillRate) * 1000;
    await sleep(waitMs);
    return this.acquire();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

#### Adaptive Concurrency Control
Dynamically adjusts parallel slots based on success/failure signals. Starts conservative, increases on success, halves on rate limit.

```typescript
class AdaptiveController {
  private slots = 2; // start conservative

  onSuccess() {
    this.slots = Math.min(this.slots + 1, MAX_SLOTS);
  }

  onRateLimit() {
    this.slots = Math.max(1, Math.floor(this.slots / 2));
  }
}
```

#### Circuit Breaker
Opens circuit after N consecutive failures; halts requests for a cooldown period before retry. Prevents cascading failures across agent fleets.

```typescript
// cockatiel library (per principles/error-handling-resilience.md)
const agentPolicy = wrap(
  handleType(RateLimitError).retry().exponential({ maxAttempts: 5, initialDelay: 1000 }),
  circuitBreaker(consecutiveBreaker(5), { halfOpenAfter: 60_000 })
);
```

**Real-time rate limit tracking** — Anthropic returns limit state in response headers:
- `anthropic-ratelimit-requests-remaining`
- `anthropic-ratelimit-tokens-remaining`
- `anthropic-ratelimit-requests-reset` (timestamp)

Throttle proactively when remaining < 10% of capacity. This is more reliable than reacting to 429s.

**Performance comparison** ([Multi-Agent Rate Limits Playbook](https://claudecodeplugins.io/playbooks/01-multi-agent-rate-limits/)):

| Strategy | 100 Requests | Success Rate | Duration |
|----------|-------------|--------------|----------|
| Token Bucket | ✅ | 100% | 70 seconds |
| Adaptive | ✅ | 100% | 65 seconds |
| Sequential | ✅ | 100% | 120 seconds |
| Unthrottled | ❌ | ~40% | 45 seconds |

**Production cost impact**: Proper rate limiting prevents ~40% waste from retry failures.

### 4. Bounded Worker Pool (Core Pattern)

The fundamental pattern for CPU overload prevention is a bounded worker pool. Never spawn more agents than a fixed maximum, regardless of queue depth.

Semaphore-based approach:

```typescript
class AgentPool {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      // Block until a slot opens
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.queue.shift()?.(); // unblock next waiter
    }
  }
}

// Usage: never more than 2 concurrent Claude agents
const pool = new AgentPool(2);
const results = await Promise.all(
  tasks.map(task => pool.run(() => spawnClaudeCodeAgent(task)))
);
```

This is equivalent to BullMQ's `concurrency` setting — just without the Redis persistence layer. For simple use cases (single process, ephemeral tasks), the in-process semaphore is sufficient. For multi-process or cross-machine coordination, BullMQ is required.

**CPU-appropriate concurrency settings** ([BullMQ: Parallelism](https://docs.bullmq.io/guide/parallelism-and-concurrency)):
- Claude Code agent processes: CPU-intensive. Set concurrency = 1–2 (not 100+).
- Research tasks (web search, file reads): I/O-heavy within an agent, but the agent process itself is CPU-bound due to LLM inference.
- Rule of thumb: `concurrency = num_cpu_cores` for agent spawning. Check `os.cpus().length` at runtime.

### 5. Load Shedding and Bounded Queues

Queues don't fix overload — they defer it ([AWS: Avoiding Queue Backlogs](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/), [Erlang Overload Handling](https://ferd.ca/handling-overload.html)). An unbounded queue fills with stale work until OOM. Bounded queues provide fail-fast behavior.

Strategies for when the queue is full:
1. **Reject with feedback** — return error to producer, let producer retry later
2. **Drop oldest** — discard stale items to admit fresh ones (only valid when freshness matters)
3. **Priority eviction** — drop lowest-priority items when capacity is reached
4. **Timeout-based expiration** — tasks older than N minutes are dropped (stale research requests aren't worth running)

For the `queue.json` runner specifically, a simple bounded queue with priority eviction is appropriate. Tasks with `priority: 1` should never be dropped; `priority: 5` tasks can be shed under load.

### 6. Anthropic's Message Batches API

For non-interactive agent tasks (research, analysis, code review that doesn't need real-time output), Anthropic's **Message Batches API** ([Anthropic Batch Processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)) is a fundamentally different approach:

- Submit up to 10,000 messages in a single batch
- 50% cost reduction vs. real-time API
- Processes within 24 hours (most batches < 1 hour)
- Optimal batch size: 5,000 messages
- Separate rate limits from standard API

Temporal + Batch API integration ([Steve Kinney: Temporal + Batch API](https://stevekinney.com/writing/anthropic-batch-api-with-temporal)):
```typescript
export async function batchResearchWorkflow(tasks: ResearchTask[]): Promise<void> {
  const batchId = await createBatch(tasks); // activity

  // Durable polling loop — survives crashes, no manual state tracking
  while (true) {
    const status = await checkBatchStatus(batchId); // activity
    if (status === 'succeeded') break;
    await sleep('10 seconds');
  }

  const results = await getBatchResults(batchId); // activity
  await saveResults(results);
}
```

Activities configured with 24-hour timeout + 5 retry attempts. Temporal's durable execution means the polling loop is crash-safe — no need to persist batch IDs externally.

**Trade-offs of batch vs. streaming:**
- Batch: cheaper, higher throughput, but no real-time feedback, 24hr SLA
- Real-time: streaming progress, interactive, but 2x cost, rate-limited by RPM

For the current `queue.json` runner (automated research, overnight jobs), batch processing is ideal for high-volume scenarios.

### 7. Cross-Repo and Cross-Domain Coordination

The specific challenge in this project: agents span multiple repositories and domains (research, task-runner, individual projects). This requires coordination beyond a single-process queue.

**Key patterns:**

**Shared Redis Queue (Recommended for start)**
All worker processes connect to the same Redis instance. BullMQ coordinates work assignment — each worker polls for unclaimed jobs. Adding a new repo = adding a new worker process that connects to the same queue. Workers are stateless; the queue is the source of truth.

**Domain-Partitioned Queues**
Use separate BullMQ queues per domain (one per repo or project type). Workers specialize: a "research worker" only processes research tasks; a "code worker" only processes coding tasks. Rate limits and concurrency can be tuned per domain.

```typescript
const researchQueue = new Queue('research-tasks', { connection });
const codeQueue = new Queue('code-tasks', { connection });

// Research worker: low concurrency (CPU-bound)
new Worker('research-tasks', processResearch, { concurrency: 1 });

// Code worker: slightly higher (includes I/O waits for git, npm, etc.)
new Worker('code-tasks', processCode, { concurrency: 2 });
```

**File Ownership Enforcement**
Per [principles/agent-task-orchestration.md](../principles/agent-task-orchestration.md): "Each agent/teammate should control a distinct set of files." When designing the queue, include file scope in the job payload. The dispatcher checks for file lock conflicts before assigning tasks.

**Git Worktree Isolation**
Per the same principles: "Give each agent its own git worktree." Worktrees share the object store but have independent working trees — zero-copy isolation. The queue worker allocates a worktree before spawning the agent, releases it on completion.

### 8. Observability for Queued Agent Systems

A queue without observability is a black box. Required visibility:

1. **Queue depth**: how many tasks are waiting
2. **Active tasks**: what's currently running, with agent ID and start time
3. **Worker utilization**: what % of capacity is in use
4. **Failure rate**: what % of tasks are failing and why
5. **Rate limit incidents**: how often is the Claude API returning 429

BullMQ provides a Bull Dashboard (web UI). Trigger.dev and Inngest have first-class dashboards with per-step AI tracing (token counts, prompts, responses).

For the current `queue.json` runner, the minimum viable observability is:
- Append-only log of task start/end/error events
- Current status in `queue.json` (already implemented: `status: "running" | "completed" | "failed"`)
- Alert on > N consecutive failures

Temporal's Temporal Web UI provides this and more (workflow history, retry state, search by any attribute).

### 9. Recommended Architecture for This Project

Given the current state (sequential `queue.json` runner, single machine, growing backlog):

**Phase 1: In-Process Bounded Pool (immediate fix, zero dependencies)**
Modify the queue runner to use a concurrency = 2 semaphore. Add token bucket for Anthropic API calls. Zero new infrastructure.

```typescript
const pool = new AgentPool(2); // never more than 2 concurrent Claude processes
const bucket = new TokenBucket(10, 0.5); // 10 burst, 1 request/2s sustained

for (const task of pendingTasks) {
  await bucket.acquire();
  pool.run(() => spawnAgent(task)); // don't await — let pool manage concurrency
}
```

**Phase 2: BullMQ + Redis (when tasks span sessions or need retries)**
Replace the `queue.json` file with a BullMQ queue backed by Redis. Worker runs as a long-lived process. Supports:
- Task persistence across crashes
- Priority queuing
- Automatic retries with exponential backoff
- Multiple workers (one per project/repo type)
- Bull Dashboard for visibility

**Phase 3: Trigger.dev or Temporal (when cross-domain workflows need durable state)**
Upgrade to a durable execution platform if:
- Tasks span > 15 minutes (serverless timeout limits)
- Tasks require multi-step workflows with intermediate state
- Multiple machines/repos need coordinated work distribution
- You need Anthropic Batch API integration with crash-safe polling

**Phase 4: Anthropic Batch API (for non-interactive overnight work)**
Route low-priority research tasks through the Batch API for 50% cost reduction. High-priority or interactive tasks continue through real-time API with rate limiting.

### 10. Decision Framework

| Scenario | Recommendation |
|---------|---------------|
| Single machine, <5 concurrent agents | In-process semaphore + token bucket |
| Single machine, need persistence across crashes | BullMQ + local Redis |
| Multi-machine, same repo | BullMQ + shared Redis cluster |
| Cross-repo, cross-domain | BullMQ with domain-partitioned queues |
| Long-running multi-step workflows | Temporal or Trigger.dev |
| Non-interactive batch research | Anthropic Batch API + Temporal polling |
| 50+ agents, self-organizing | Shared task board (Claude Code TaskList or Beads) |

## Open Questions

1. **What's the actual CPU/memory footprint of a single Claude Code headless session?** Measuring this would let us set concurrency limits based on available resources rather than guessing.

2. **Does Anthropic's Batch API support streaming partial results?** If not, the 24hr SLA limits real-time feedback.

3. **Can BullMQ + Redis be replaced with SQLite for single-machine use?** Redis adds operational overhead. A SQLite-backed queue with WAL mode might suffice for single-machine coordination (Beads uses this model).

4. **How do we handle task prioritization across domains?** Should cross-repo tasks share a single priority queue, or should each repo have its own queue with inter-queue priority?

5. **What is the right granularity for worktree allocation?** One worktree per task? Per agent session? Per repo?

## Extracted Principles

Principles added to `principles/agent-task-orchestration.md`:
- Bounded Worker Pool Over Unbounded Spawning
- Token Bucket as Default Rate Limit Strategy
- BullMQ → Temporal Graduation Path
- Match Queue Level to Task Requirements

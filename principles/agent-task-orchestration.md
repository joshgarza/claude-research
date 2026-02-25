# Agent Task Orchestration

## Summary

Principles for coordinating AI agents through shared task systems — from flat TODO files to structured ticket boards, multi-agent swarms, and event-driven pipelines. Covers task decomposition, coordination topologies, tool selection, and proven anti-patterns. Synthesized from Claude Code Agent Teams docs, Beads (Yegge), CrewAI, LangGraph, Conductor, Cyrus, CCPM, Addy Osmani, Mike Mason, Anthropic's 2026 Agentic Coding Report, and Deloitte's multi-agent research.

## Principles

### Shared Task Board Over Central Assignment
- **What:** Use a shared task queue where agents self-select unblocked, unowned work — rather than a central coordinator assigning every task. Let load balancing emerge from the agents' own claim behavior.
- **Why:** Scales linearly (adding agents requires zero coordinator changes). Eliminates the coordinator as a bottleneck. Proven in Claude Code Teams (`TaskList` polling + claim), Beads (`bd ready` + `bd update --claim`), and claude-flow's self-organizing workers.
- **When:** When tasks are relatively independent and agents are interchangeable. For highly interdependent tasks requiring rich coordination, add a leader layer on top but keep the shared board as the source of truth.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Claude Code Teams, Beads, claude-flow, Addy Osmani)

### Structured Memory Over Flat TODO Files
- **What:** Replace flat TODO.md/PLAN.md files with a queryable task store that supports dependencies, atomic claims, and selective context loading. Beads (SQLite + JSONL + Git) is the current best-of-breed.
- **Why:** Flat files consume full context when loaded, have no structured dependencies (agents must infer relationships), and lack atomicity for multi-agent claim/update. Beads' `bd ready` returns only actionable tasks. Compaction summarizes old issues to preserve context window budget.
- **When:** Any project complex enough to need dependency tracking or where multiple agents work concurrently. For single-agent, simple projects, CLAUDE.md + inline TODOs remain sufficient.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Beads, CCPM, Better Stack guide)

### Contract-First Decomposition
- **What:** Every sub-task must have a precise, objectively verifiable acceptance criteria. If a task's output is too subjective or complex to verify, recursively decompose it further until verification is tractable.
- **Why:** Agents will confidently declare broken work "done." Without verifiable contracts, you discover failures at integration time instead of task completion time. Tests, type checks, and build commands are the standard verification methods.
- **When:** Every task decomposition. The rule is simple: if you can't write a verification step, the task is too coarse.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (arxiv:2602.11865, CrewAI guardrails, Mike Mason "waterfall in 15 minutes")

### 3-5 Agents, 5-6 Tasks Per Agent
- **What:** Start multi-agent orchestration with 3-5 teammates and assign 5-6 tasks per teammate. This balances parallel throughput against coordination overhead and token cost.
- **Why:** Each agent consumes a full context window (~200K tokens). Beyond 5 agents, coordination overhead dominates. Too few tasks per agent underutilizes the context; too many causes context degradation. These numbers come from converging practitioner reports.
- **When:** Any multi-agent workflow. Adjust down for complex, interdependent tasks. Adjust up for simple, independent tasks. Monitor actual token consumption and completion quality.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Addy Osmani, Claude Code Teams docs, Anthropic's 2026 report)

### File Ownership Per Agent
- **What:** Each agent/teammate should control a distinct set of files. Avoid having multiple agents editing the same file concurrently.
- **Why:** Git worktree isolation handles branch-level conflicts, but file-level concurrent edits cause semantic conflicts that worktrees can't prevent. Explicit file ownership is the simplest and most effective guard.
- **When:** Always in multi-agent workflows. Include file scope in the task definition. The task decomposition step should consider file boundaries as a primary decomposition axis.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Addy Osmani, CCPM, Conductor patterns)

### Plan-Before-Code for Multi-Agent Coherence
- **What:** Enforce an explicit planning phase before any agent begins coding. The leader produces a structured plan with decomposed tasks, dependencies, and file assignments. Human reviews and approves. Then execution begins.
- **Why:** Without a plan gate, agents diverge architecturally — each makes locally reasonable but globally incompatible decisions. Mike Mason calls this "waterfall in 15 minutes" — the planning overhead is trivial relative to the coherence gains.
- **When:** Any multi-agent workflow. Also valuable for single-agent complex tasks. Skip only for trivial, single-file changes.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Mike Mason, Claude Code plan approval pattern, CCPM brainstorm→plan pipeline)

### Event-Driven Ticket-to-Agent Pipelines
- **What:** Use webhooks from ticket systems (Linear, GitHub Issues, Jira) to automatically trigger agent sessions when issues reach a specific state (assigned to agent, labeled, transitioned to "In Progress").
- **Why:** Removes the human bottleneck of manually launching agent sessions. Enables true async workflows — create issues in the morning, review PRs in the afternoon. Already production-proven in Copilot Coding Agent, Codex + Linear, and Cyrus.
- **When:** When you have a stable ticket workflow and well-defined issue templates. Requires: webhook filtering (not every event triggers an agent), echo detection (prevent self-triggering loops), and human review gates on the output.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (GitHub Copilot Agent, OpenAI Codex + Linear, Cyrus, Port.io)

### Adaptive Granularity in Decomposition
- **What:** Vary task decomposition depth based on complexity: coarse-grained for simple/independent work, fine-grained for complex/interdependent tasks. Target 3-5 sub-goals per level. Explicitly choosing granularity per task (rather than one-size-fits-all) improves accuracy and reduces inefficiency.
- **Why:** Research (arxiv:2410.22457v1) shows explicit mention of decomposition strategy significantly improves task accuracy. Over-decomposition creates coordination overhead that exceeds the benefit. Under-decomposition creates tasks too large for agents to handle reliably.
- **When:** Every decomposition decision. Ask: "Can an agent complete this in one focused session with clear verification?" If yes, it's the right granularity. If no, decompose further.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Amazon Science, Oreate AI, arxiv research)

### Git Worktrees as Agent Isolation
- **What:** Give each agent its own git worktree. This provides filesystem-level isolation without the overhead of full repository clones. Worktrees share the git object store but have independent working trees.
- **Why:** Prevents agents from interfering with each other's work-in-progress. Enables true parallel development. Every serious multi-agent tool uses this: Conductor, Cyrus, CCPM, Claude Code Teams, ccswarm.
- **When:** Always in multi-agent workflows. Even for single-agent workflows, worktrees enable running analysis in one worktree while implementation happens in another (the Boris Cherny pattern from principles/ai-tool-adoption.md).
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Conductor, Cyrus, CCPM, Boris Cherny)

### Downstream Pipeline Before Upstream Speed
- **What:** Before scaling up agent throughput (more agents, faster task completion), ensure your review, testing, and deployment pipeline can absorb the output. The bottleneck is almost never "agents can't produce code fast enough."
- **Why:** The AI Productivity Paradox (Faros AI, 10K+ devs): 98% more PRs created but 91% longer review times. Google DORA 2025: increased AI adoption correlates with 9% bug rate increase and 154% PR size growth. Agent output that can't be reviewed and merged is waste.
- **When:** Before any multi-agent scaling decision. Invest in: automated test suites, pre-commit quality gates (complexity, duplication, linting), structured PR templates, and reviewer tooling.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (Faros AI, Google DORA 2025, Mike Mason)

### Select Task System by Project Phase
- **What:** Match the task management tool to the project's current needs rather than over-engineering upfront.
  - Solo agent, simple: CLAUDE.md + inline TODOs
  - Solo agent, complex: Beads (structured dependencies)
  - Multi-agent, same session: Claude Code native TaskList
  - Multi-agent, persistent: Beads or GitHub Issues + CCPM
  - Team visibility needed: Linear + Cyrus, or GitHub Issues + Copilot Agent
  - Event-driven automation: Linear webhooks + Cyrus, or GitHub Actions + Copilot
- **Why:** Each layer adds complexity and cost. Claude Code TaskList is zero-config but ephemeral. GitHub Issues is persistent but slow for rapid agent iteration. Linear is rich but paid. Beads hits a sweet spot for agent-native persistent tracking.
- **When:** At project start and whenever the coordination needs change. Migrate up (flat → structured → external) as complexity warrants.
- **Source:** research/2026-02-23-ai-agent-ticket-orchestration.md (comparative analysis across all tools)

### Mechanical Enforcement Over Prompt Enforcement
- **What:** Use `PreToolUse` hooks to enforce agent role constraints (e.g., blocking file writes for read-only agents), not instructions in prompts. Hooks are deterministic; prompts are probabilistic.
- **Why:** A Scout agent instructed in its prompt not to write files will occasionally write files anyway — especially when it hallucinates task scope. A `PreToolUse` hook that returns an error on `Write` or `Edit` tool calls is absolute. Overstory demonstrates this: Scouts and Reviewers are mechanically blocked from file modifications regardless of what their task context says.
- **When:** Any multi-agent system where role separation matters. Apply broadly: block dangerous git operations for non-Merger agents, block file writes for research agents, block network access for sandboxed workers. If you care about a constraint, enforce it mechanically.
- **Source:** research/2026-02-24-overstory.md (Overstory PreToolUse hooks design)

### Two-Layer Agent Instructions (HOW + WHAT)
- **What:** Separate agent instructions into a reusable base definition (the HOW: workflow, constraints, capabilities) and a per-task overlay (the WHAT: task ID, file scope, spec path, branch). Generate the overlay at spawn time from the task spec.
- **Why:** Reusing base definitions across all instances of a given agent type reduces instruction drift and makes updates centralized. The overlay keeps each agent's assignment concrete and injected rather than inferred. Overstory implements this cleanly: `agents/builder.md` defines how a builder works; `overstory sling` generates the per-task `CLAUDE.md` overlay with the specific assignment.
- **When:** Any system with multiple instances of the same agent type. Also useful for single-agent systems where you want separation between "how this agent works" (stable) and "what it's doing right now" (task-specific).
- **Source:** research/2026-02-24-overstory.md (Overstory two-layer instruction system)

### WAL Mode Is Mandatory for Concurrent SQLite
- **What:** Any system where multiple processes access shared SQLite databases must enable WAL mode and set a busy timeout.
- **Why:** Default SQLite journal mode causes write lock contention — concurrent agents pile up on lock attempts, causing failures or indefinite blocking. WAL mode enables concurrent readers and one writer, dramatically reducing contention. Overstory specifies this as a hard convention: `db.exec("PRAGMA journal_mode=WAL"); db.exec("PRAGMA busy_timeout=5000");`.
- **When:** Any multi-agent system using SQLite for coordination (mail, task queue, merge queue, metrics). Also applies to any server-side SQLite use (Turso, Bun built-in, better-sqlite3) where multiple connections might write concurrently.
- **Source:** research/2026-02-24-overstory.md (Overstory SQLite conventions), research/2026-02-14-database-data-architecture.md (SQLite/Turso edge patterns)

### Bounded Worker Pool Over Unbounded Spawning
- **What:** Never use `Promise.all(tasks.map(spawn))` for agent tasks. Always use a semaphore, BullMQ `concurrency` setting, or equivalent to cap the number of concurrently running agents. For Claude Code agents (CPU-intensive), cap at `num_cpu_cores` (typically 1–2 on a dev machine, 4–8 in CI). For I/O-heavy tasks within agents, this still applies — the agent process itself is CPU-bound due to LLM inference.
- **Why:** Each Claude Code agent forks a subprocess, loads 200K+ tokens of context, and makes concurrent API calls. Unbounded spawning causes CPU saturation, memory exhaustion, and cascading API rate limit failures (HTTP 429). The OS cannot schedule more concurrent work than cores; excess agents context-switch, wasting cycles.
- **When:** Always. There is no safe scenario for unbounded concurrent agent spawning. The minimum viable implementation is an in-process semaphore (10 lines of code). Graduate to BullMQ when tasks need persistence across crashes.
- **Source:** research/2026-02-25-queue-for-agent-orchestration.md (BullMQ docs, ferd.ca overload handling, multi-agent rate limits playbook)

### Token Bucket as Default API Rate Limit Strategy
- **What:** Use a token bucket algorithm as the primary throttle for Anthropic API calls in multi-agent systems. Seed the bucket with burst capacity (e.g., 10 requests), refill at a sustained rate (e.g., 0.5 req/sec for Build tier). Track `anthropic-ratelimit-requests-remaining` and `anthropic-ratelimit-tokens-remaining` headers; throttle proactively when remaining < 10%. Add exponential backoff with jitter for 429 responses.
- **Why:** Token bucket allows bursts without over-applying rate limits, while providing smooth sustained throttling. Alternatives: sequential execution (safe but 2x slower) and adaptive concurrency (self-optimizing but complex to implement correctly). Proper rate limiting prevents ~40% API cost waste from failed retries.
- **When:** Any system making concurrent Anthropic API calls. The three strategies by scale: token bucket (10–50 agents), adaptive concurrency (50+ agents), sequential with 1.2s delays (trivial scripts). Circuit breaker (cockatiel library) as the fallback after 5 consecutive 429s — halt all requests for 60 seconds.
- **Source:** research/2026-02-25-queue-for-agent-orchestration.md (claudecodeplugins.io multi-agent rate limits playbook)

### BullMQ → Temporal Graduation Path for Agent Queues
- **What:** Use a three-phase graduation path for agent task queues: (1) in-process semaphore for single-process, ephemeral tasks; (2) BullMQ + Redis for persistent, multi-process, or multi-machine coordination; (3) Temporal or Trigger.dev for long-running, multi-step workflows that require crash-safe state. Skip levels only when requirements clearly demand it.
- **Why:** Each level adds operational complexity and infrastructure requirements. BullMQ needs Redis but no cluster. Temporal needs a cluster but provides Event History (crash-safe intermediate state). Inngest/Trigger.dev are managed alternatives to Temporal with better TypeScript DX but add external service dependencies. For Anthropic Batch API integration, Temporal's durable polling loop (24hr activity timeout + 5 retries) eliminates the need to manually persist batch IDs.
- **When:** Start at Level 1 (semaphore) for any new system. Move to Level 2 (BullMQ) when tasks need to persist across process restarts or multiple workers. Move to Level 3 (Temporal/Trigger.dev) when tasks run > 15 minutes, require multi-step coordination, or span multiple domains/repos with complex dependencies.
- **Source:** research/2026-02-25-queue-for-agent-orchestration.md (BullMQ docs, Temporal AI SDK blog, Trigger.dev deep dive, Inngest blog)

### Domain-Partitioned Queues for Cross-Repo Agent Systems
- **What:** When agents operate across multiple repositories or domains, use separate queues per domain (e.g., `research-tasks`, `code-tasks`, `review-tasks`). Each queue has its own concurrency limit, retry policy, and worker pool. Workers specialize by domain. A shared Redis instance coordinates all queues with zero inter-queue dependency.
- **Why:** Unified queues create priority inversion: a burst of low-priority research tasks can delay high-priority code tasks. Domain-partitioned queues allow independent rate limiting (research may call Anthropic at 0.5 req/sec; code tasks may call GitHub at 10 req/sec). They also enforce file ownership naturally — a research worker never touches code files.
- **When:** Any system where agents span more than one project type or have meaningfully different resource profiles. Also required when different domains have different SLAs (interactive code tasks should not queue-starve behind batch research tasks).
- **Source:** research/2026-02-25-queue-for-agent-orchestration.md

### Harness Selection Determines Augmentation Effectiveness
- **What:** The agent scaffolding/harness architecture determines whether context augmentation (Skills, context files, tool definitions) is utilized at all. The SkillsBench paper (arXiv:2602.12670) found Claude Code consistently uses provided Skills (+13.9pp to +23.3pp), while Codex CLI frequently ignores them despite acknowledging they exist. Same model, same Skills, different harness = different results.
- **Why:** Different harnesses incorporate context into agent decision-making differently. The harness controls which parts of context the model attends to, how tool calls are structured, and whether Skills are referenced during planning. These are architectural decisions that compound.
- **When:** When evaluating or selecting augmentation strategies (Skills, CLAUDE.md context, tool definitions), always test across the specific harness you'll deploy on. A strategy that works in one harness may be silently ignored in another.
- **Source:** research/2026-02-25-agent-harnesses.md (SkillsBench benchmark, arXiv:2602.12670)

### Fewer General-Purpose Tools Over Many Specialized Tools
- **What:** Prefer 2-5 general-purpose tools (bash, file read/write, search) over 10-50 specialized tools. Vercel reduced from 15 specialized tools to 2 general-purpose ones — accuracy improved from 80% to 100%, token usage dropped 37%, execution time improved 3.5x.
- **Why:** More tools fragment context and increase decision complexity. The model must choose from a larger action space, and each unused tool description still occupies context space. Atomic tools like bash subsume specialized tools without the fragmentation cost.
- **When:** Always. Start with the smallest possible tool set (bash + file access covers most agentic tasks). Add specialized tools only when atomic tools demonstrably can't handle a use case. Never add tools "in case they're useful."
- **Source:** research/2026-02-25-agent-harnesses.md (Vercel case study, Manus context engineering blog, Lance Martin / Hugo Bowne-Anderson)

### Externalize Session State for Long-Running Agents
- **What:** Agents working across multiple sessions must write their progress to external artifacts (TODO.md, progress files, git commits) that allow cold-start rehydration. Never rely on in-context memory alone for tasks that span sessions. Anthropic's pattern: an Initializer Agent creates a 200+ feature spec with all items marked "failing"; a Coder Agent reads, completes the next step, and updates before exiting.
- **Why:** The core challenge of long-running agents is that each new session starts with no memory of what came before. "The most reliable agents are those that leave behind clear, externally legible artifacts." Agents observed sustaining 30+ hours of operation (Claude Agent SDK) do so via automatic context compaction + external progress state — neither alone is sufficient.
- **When:** Any agent task expected to take more than one context window of work. The minimum viable implementation: a `claude-progress.txt` file updated at session end. For complex tasks: a structured TODO with completion status per feature/step.
- **Source:** research/2026-02-25-agent-harnesses.md (Anthropic Claude Agent SDK docs, Anthropic engineering blog on effective harnesses)

### Harness Must Evolve With Model Capabilities
- **What:** Periodically audit and remove scaffolding from your harness that models no longer need. Capabilities requiring complex pipelines in 2024 (multi-step reasoning decomposition, explicit chain-of-thought structures, rigid tool-call sequences) may be handled natively by a single 2026 prompt. Manus rebuilt their harness five times in six months, each time removing user-facing complexity.
- **Why:** Over-engineered harnesses add latency, tokens, and failure surface for problems that no longer exist. Worse, explicit structural scaffolding can constrain models that would otherwise perform better with more autonomy. The harness should shrink as models grow.
- **When:** After any significant model upgrade. Run A/B tests comparing the current harness structure against a simplified version. If the simpler version performs equally or better, ship the simplification.
- **Source:** research/2026-02-25-agent-harnesses.md (Manus context engineering, LangChain harness taxonomy, Philschmid agent harness 2026)

## Revision History
- 2026-02-23: Initial extraction from AI agent ticket orchestration research session. 11 principles from 15+ sources.
- 2026-02-24: Added 3 principles from Overstory deep-dive: mechanical enforcement, two-layer instructions, WAL mode. (11→14 principles)
- 2026-02-25: Added 4 principles from queue/concurrency research: bounded worker pool, token bucket, graduation path, domain-partitioned queues. (14→18 principles)
- 2026-02-25: Added 4 principles from agent harnesses research: harness determines augmentation effectiveness, fewer general-purpose tools, externalize session state, harness must evolve with models. (18→22 principles)

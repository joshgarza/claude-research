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

## Revision History
- 2026-02-23: Initial extraction from AI agent ticket orchestration research session. 11 principles from 15+ sources.

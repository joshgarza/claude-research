---
date: 2026-02-23
topic: AI agent orchestration via ticket/task systems
status: complete
tags: [agents, orchestration, task-management, multi-agent, tickets, swarms, event-driven]
related: [2026-02-14-ai-llm-integration-practices.md, 2026-02-15-ai-coding-team-training.md]
---

# AI Agent Orchestration via Ticket/Task Systems

## Context

Investigation into how AI agents coordinate work through shared task boards, ticket systems, and structured workflows. Covers the spectrum from flat TODO files to enterprise ticket systems (Linear, GitHub Issues, Jira), purpose-built agent task systems (Claude Code Teams, Beads, CrewAI), and event-driven patterns where ticket state changes trigger agent actions. The goal is to map the landscape of proven patterns for agent-driven task workflows.

## Findings

### 1. Agent Swarm Patterns

The field has converged on three fundamental coordination topologies:

#### a) Hierarchical (Leader-Worker)
A leader/orchestrator agent decomposes work, assigns tasks to specialized workers, and synthesizes results. Workers report back to the leader but do not communicate with each other directly.

**Where it works:** Well-defined tasks where the leader can decompose upfront. Most production systems use this.

**Examples:**
- **Cursor's FastRender project** (Jan 2026): Planners explore codebase and create tasks, Workers execute without mutual coordination, Judges evaluate whether to continue. Achieved 1M+ LOC across 1,000 files.
- **CrewAI's hierarchical process**: A manager agent distributes tasks based on agent roles and tool availability.
- **Open SWE (LangChain)**: Manager orchestrates entry/routing, Planner researches and proposes, Programmer executes, Reviewer validates and opens PR.

#### b) Shared Task Board (Swarm)
All agents share a task queue and self-select work. No central coordinator assigns tasks — agents claim unblocked, unowned items. Load balancing is emergent.

**Where it works:** When tasks are relatively independent and agents are interchangeable. Scales well because adding workers requires zero coordinator changes.

**Examples:**
- **Claude Code Agent Teams**: Each teammate polls `TaskList`, finds unowned pending tasks, and claims one. Tasks auto-unblock when dependencies complete.
- **claude-flow (ruvnet)**: Workers self-organize around a shared task queue with no central assignment. Uses SQLite persistence and LRU cache for memory.
- **Beads (Steve Yegge)**: `bd ready` surfaces tasks with no blocking dependencies. Agents atomically claim work with `bd update <id> --claim`.

#### c) Mesh / Direct Communication
Agents communicate directly with each other, passing findings and coordinating without routing through a central leader. Enables richer collaboration but harder to manage.

**Where it works:** Complex cross-cutting tasks where agents need to share intermediate findings.

**Examples:**
- **Claude Code Teams with SendMessage**: Teammates exchange findings directly via typed messages (text, shutdown requests, plan approvals). Not funneled through the lead.
- **LangGraph scatter-gather**: Tasks distributed to multiple agents, results consolidated downstream through shared graph state.

#### d) Emerging Pattern: Progressive Autonomy Spectrum
Most practical systems combine patterns. Deloitte's framework: humans in-the-loop (full control) → on-the-loop (oversight with agent execution) → out-of-the-loop (full autonomy). The level shifts based on task complexity and risk tolerance.

**Key data point:** Organizations using multi-agent architectures report 45% faster problem resolution and 60% more accurate outcomes vs. single-agent systems (Deloitte 2026).

### 2. Claude Code Teams / TaskList System

Claude Code's native Agent Teams (shipped with Opus 4.6) is the most mature integrated agent-task coordination system available.

#### Architecture
- **Seven coordination primitives**: TeamCreate, TaskCreate, TaskUpdate, TaskList, Task (spawn teammate), SendMessage, TeamDelete
- **Storage**: JSON files in `~/.claude/teams/{name}/` and `~/.claude/tasks/{team}/`
- **Task states**: pending → in_progress → completed (plus deleted)
- **Dependencies**: `blockedBy` / `blocks` relationships with automatic unblocking
- **Spawn backends**: tmux (visible panes), iTerm2 (split panes), in-process (hidden, fastest) — auto-detected

#### Communication Model
- **SendMessage types**: message (DM), broadcast (all), shutdown_request/response, plan_approval_response
- **Inbox system**: JSON files per agent for async messaging
- **Idle detection**: Teammates auto-idle after each turn with notification to lead

#### Practical Patterns
- **Parallel Specialists**: 3-5 reviewers examine different domains simultaneously (security, performance, accessibility)
- **Pipeline**: Sequential tasks with dependencies auto-unblocking
- **Swarm**: Independent workers race to claim tasks, natural load balancing
- **Research + Implementation**: Research phase feeds into implementation
- **Plan Approval Gate**: Architects submit plans requiring leader approval before proceeding

#### Best Practices (from Addy Osmani, community consensus)
- **3-5 teammates optimal**. Beyond this, coordination overhead exceeds parallel gains.
- **5-6 tasks per teammate** optimizes productivity
- **File ownership prevents conflicts**. Each teammate controls distinct files.
- **Each teammate = full context window (~200K tokens)**. A 3-person team costs ~800K tokens total.
- **Spec quality determines output quality**. "The better your specs, the better the agent output."

#### Integration with External Tools
- Claude Code Teams is a self-contained system — no native Linear/GitHub integration
- **Cyrus** (github.com/ceedaragents/cyrus) bridges the gap: monitors Linear/GitHub issues assigned to it, creates git worktrees, launches Claude Code sessions, streams activity back to Linear
- **Conductor** (conductor.build): macOS app that orchestrates multiple Claude Code instances with tight Linear/GitHub integration, injects issue context, manages worktrees automatically
- **CCPM** (github.com/automazeio/ccpm): Uses GitHub Issues as the task board, Claude Code agents as workers, git worktrees for parallel execution. Spec-driven workflow: PRD → Epic → Decompose → Execute → Track.

### 3. Alternatives to TODO.md

The landscape from simplest to most complex:

#### a) Flat Files (TODO.md, PLAN.md)
**Still common.** Most Claude Code users start here. Works for single-agent sessions.

**Weaknesses:**
- Consumes context window space when loaded
- No structured dependency tracking (agents must infer dependencies)
- No atomicity for multi-agent claim/update
- State management friction (read-parse-rewrite entire file)

#### b) Beads (Steve Yegge) — SQLite + JSONL + Git
**The purpose-built replacement for TODO files in AI agent workflows.** Most promising new entrant.

**Architecture:**
- SQLite database (`beads.db`) for efficient queries
- JSONL export (`issues.jsonl`) for git-friendly version control
- Background daemon syncs SQLite ↔ JSONL
- Hash-based IDs (e.g., `bd-a1b2`) prevent merge conflicts

**Key features:**
- Four dependency types: blocks, related, parent-child, discovered-from
- `bd ready` — returns only tasks with no open blockers
- `bd update <id> --claim` — atomic claim for multi-agent
- Hierarchical nesting: `bd-a3f8.1.1` (epic → task → subtask)
- Compaction: LLM summarizes old closed issues to reduce context
- Stealth mode: local-only tracking without commits
- MCP integration available
- Rust port exists for performance (github.com/Dicklesworthstone/beads_rust)

**Design philosophy:** "Structured memory as a solution to agent context degradation." Agents query `bd ready` instead of loading entire project plans.

#### c) GitHub Issues as Task Board
Several projects use GitHub Issues directly as the agent task board.

- **CCPM**: PRDs → Epics → Issues → Agent execution. Full traceability from spec to deployed feature.
- **GitHub Copilot Coding Agent**: Assign an issue to Copilot, it boots a VM, clones the repo, analyzes with RAG, pushes to a draft PR, updates description as it works. GA as of 2026.
- **Open SWE**: Add `open-swe` label to GitHub issue → agent picks it up, plans, codes, reviews, opens PR. Now deprecated but architecture was influential.

**Strengths:** Built-in collaboration, PR linking, CI integration, no new tools.
**Weaknesses:** API rate limits, slow for rapid agent iteration, heavy for ephemeral subtasks.

#### d) Linear as Agent Task Board
Linear's structured workflow (states, labels, assignees, cycles) maps naturally to agent orchestration.

- **OpenAI Codex + Linear**: Assign issue to @Codex, it uses full issue context, auto-selects repo, works in cloud, posts updates back to Linear, produces PR link.
- **Cursor + Linear**: Assign to @cursor, cloud agent spins up, creates PR automatically.
- **Cyrus**: Watches Linear issues assigned to it, creates worktrees, runs coding sessions, streams activity back.
- **n8n workflows**: Linear webhook → Claude processing → result back to Linear.

**Strengths:** Rich state machines, great UX, team visibility, API-first.
**Weaknesses:** External dependency, paid tool, latency for agent-speed iteration.

#### e) Claude Code Native TaskList
JSON files in `~/.claude/tasks/`. Ephemeral, session-scoped, team-oriented.

**Strengths:** Zero setup, integrated with agent messaging, dependency tracking, auto-unblock.
**Weaknesses:** No persistence between sessions (unless you read/write the files), no external visibility, no integration with CI/CD.

#### f) SQLite-Based Custom Systems
- **sqlite-agent** (github.com/sqliteai/sqlite-agent): SQLite extension for autonomous agents with MCP tool access
- **claude-flow**: SQLite persistence + LRU cache + 8 memory types for agent state
- **Custom queue.json**: Many teams roll their own JSON/SQLite queues (see automation/queue.json in this repo)

### 4. Ticket Decomposition Patterns

Best practices for how agents should break down work:

#### Granularity Rules
- **3-5 sub-goals per level is optimal** (research from Oreate AI, Amazon Science). Too many indicates overly grand objectives. Too few means insufficient decomposition.
- **5-6 tasks per teammate** when running multi-agent (Osmani).
- **Adaptive granularity**: Coarse-grained for simple/independent work, fine-grained for complex/interdependent tasks. Explicitly varying strategy by complexity improves accuracy and reduces inefficiency (arxiv:2410.22457v1).

#### Task Structure Best Practices
Each task/ticket should include:
1. **Clear objective** — What outcome is expected
2. **Acceptance criteria** — What must be true when done (tests passing, behavior verified)
3. **File scope** — Which files this task touches (prevents multi-agent conflicts)
4. **Dependencies** — What blocks this and what this blocks
5. **Context/input** — What information the agent needs (output from prior tasks, relevant code locations)
6. **Verification method** — How to confirm completion (run tests, type check, build)

#### Contract-First Decomposition
From arxiv:2602.11865 (Intelligent AI Delegation): "If a sub-task's output is too subjective, costly, or complex to verify, recursively decompose it further." Verification must be precise — if you can't objectively verify the output, the task is too coarse.

#### Dependency Representation
- **DAG (Directed Acyclic Graph)** is the standard — tasks as nodes, dependencies as directed edges
- **Four dependency types** (from Beads): blocks, related, parent-child, discovered-from
- **Independent tasks run in parallel; dependent tasks auto-unblock** when prerequisites complete
- **Claude Code TaskList**: `blockedBy` and `blocks` arrays per task, system auto-manages state transitions

#### The "Waterfall in 15 Minutes" Pattern
From Mike Mason's analysis: enforce an explicit planning phase before any coding. The agent produces a structured plan with decomposed tasks, human reviews and approves, then execution begins. Prevents premature implementation and maintains architectural coherence across multiple agents.

#### CrewAI Task Model (Reference Implementation)
```yaml
research_task:
  description: "Conduct research on {topic}"
  expected_output: "Bullet list summary with sources"
  agent: researcher
  context: [prior_analysis_task]  # dependency
  tools: [web_search, file_reader]
  guardrails:
    - validate_sources  # function-based
    - "Ensure output includes at least 3 cited sources"  # LLM-based
  async_execution: false
  output_pydantic: ResearchOutput  # structured output
```

### 5. Event-Driven Agent Workflows

The pattern where ticket state changes trigger agent actions automatically.

#### Architecture Pattern: Ticket → Webhook → Agent → PR → Review

```
Linear/GitHub Issue Created
  ↓ (webhook)
Orchestrator Service (n8n, custom, GitHub Actions)
  ↓ (filters: label, assignee, state change)
Agent Spawned (Claude Code, Codex, Copilot)
  ↓ (git worktree isolation)
Agent Works (plan → code → test → review)
  ↓ (commits, PR creation)
Updates Posted Back to Ticket
  ↓ (status: done, PR linked)
Human Review & Merge
```

#### Production Implementations

**GitHub Copilot Coding Agent (GA 2026):**
- Trigger: Assign issue to "Copilot"
- Process: Boots VM → clones repo → RAG analysis → implements → draft PR
- Feedback: Regular commits to draft PR, description updates
- UI: New "Agents" tab at repository level for centralized monitoring

**OpenAI Codex + Linear:**
- Trigger: Assign issue to @Codex or mention @Codex in comment
- Process: Cloud task created → full issue context used → auto-selects repo
- Feedback: Progress updates posted to Linear issue
- Output: Link to completed task with code changes, one-click PR creation

**Cyrus (github.com/ceedaragents/cyrus):**
- Trigger: Linear or GitHub issue assigned to Cyrus
- Process: Creates git worktree per issue → launches Claude Code/Cursor/Codex session
- Feedback: Streams activity updates back to Linear with interactive elements (dropdowns, approval prompts)
- Deployment: Self-hosted (npm + tmux/pm2/systemd) or cloud-hosted

**Port.io Jira → Copilot Pipeline:**
- Trigger: Jira issue transitions To Do → In Progress with "copilot" label
- Process: AI enriches context from software catalog → creates GitHub Issue → dispatches to Copilot
- Feedback: Jira comment with GitHub link, PR auto-linked back via ticket key detection
- Error handling: If context extraction fails, notification posted explaining skip

**CCPM (github.com/automazeio/ccpm):**
- Trigger: `/pm:issue-start` command or `/pm:next` for auto-prioritization
- Process: Specialized agent spawned in git worktree, context injected from PRD/epic
- Feedback: GitHub issue comments showing progress
- Pipeline: Brainstorm → Document → Plan → Execute → Track

#### Webhook Filtering Best Practices
- **Filter events tightly** — not every ticket change should trigger an agent
- **Common triggers**: issue created with specific label, issue assigned to agent user, state transition (e.g., "To Do" → "In Progress")
- **Avoid**: triggering on every comment (causes loops), triggering on agent's own updates (echo detection needed)
- **Route through governed controls**: authentication, validation, audit logging between webhook and agent invocation

### 6. Open Source Frameworks

#### Purpose-Built Agent-Task Orchestration

| Framework | Language | Task Model | Key Feature | GitHub Stars (approx) |
|-----------|----------|-----------|-------------|----------------------|
| **Beads** (steveyegge/beads) | Go/TypeScript | SQLite + JSONL + Git | Agent memory with dependency graph | 2K+ |
| **claude-flow** (ruvnet/claude-flow) | TypeScript | SQLite + LRU cache | Self-learning routing, MCP protocol | 3K+ |
| **CCPM** (automazeio/ccpm) | TypeScript | GitHub Issues | PRD-to-PR pipeline with parallel agents | 500+ |
| **Cyrus** (ceedaragents/cyrus) | TypeScript | Linear/GitHub Issues | Bridges ticket systems to coding agents | 1K+ |
| **ccswarm** (nwiizo/ccswarm) | Shell/Python | Custom | Git worktree isolation + specialized agents | 200+ |
| **code-conductor** (ryanmac/code-conductor) | TypeScript | GitHub-native | Parallel Claude Code sub-agents, no conflicts | 800+ |
| **Open SWE** (langchain-ai/open-swe) | Python | LangGraph | GitHub issue → plan → code → review → PR | 2K+ (deprecated) |

#### General Multi-Agent Frameworks

| Framework | Language | Task Model | Architecture |
|-----------|----------|-----------|-------------|
| **CrewAI** (crewAIInc/crewAI) | Python | YAML tasks with context deps | Role-based crews, sequential/hierarchical/async |
| **LangGraph** (langchain-ai/langgraph) | Python | DAG-based graph | State machines, scatter-gather, conditional routing |
| **AutoGen** (microsoft/autogen) | Python | Conversation-based | Multi-agent chat with tool use |
| **SWE-agent** (SWE-agent/SWE-agent) | Python | GitHub issues | Princeton/Stanford, NeurIPS 2024 |

#### Desktop Orchestrators

| Tool | Platform | Integration | Key Feature |
|------|----------|-------------|-------------|
| **Conductor** (conductor.build) | macOS | Linear, GitHub, Claude Code, Codex | Git worktree management, issue context injection |
| **Claude Code by Agents** (baryhuang/claude-code-by-agents) | Cross-platform | @mentions | Multi-agent coordination via mentions |

### 7. Comparative Analysis: Task System Selection

| Need | Recommended Approach |
|------|---------------------|
| Single agent, simple project | CLAUDE.md + flat TODO |
| Single agent, complex project | Beads (structured memory, dependencies) |
| Multi-agent, same session | Claude Code Teams (native TaskList) |
| Multi-agent, persistent across sessions | Beads or GitHub Issues + CCPM |
| Team visibility needed | Linear + Cyrus, or GitHub Issues + Copilot Agent |
| Event-driven automation | Linear webhooks + Cyrus, or GitHub Actions + Copilot |
| Maximum flexibility | LangGraph (custom DAG) |
| Fastest setup | Claude Code Teams (zero config) |

### 8. Key Cautions and Anti-Patterns

1. **Activity ≠ Value** (Osmani). Rapid code production without verification creates false productivity signals. Google's 2025 DORA Report: increased AI adoption correlates with 9% bug rate increases and 154% PR size growth.

2. **Scale doesn't guarantee quality** (Mason). One practitioner described Yegge's Gas Town setup as "riding a wild stallion" — an agent autonomously merged PRs despite failing integration tests, taking down a production database.

3. **Context windows are the real limit**, not task management. Each teammate in Claude Code Teams consumes a full ~200K token context window. A 5-agent team costs ~1M tokens. Cost and quality both scale with context management, not just task decomposition.

4. **Downstream bottlenecks eat upstream gains**. The "AI Productivity Paradox" from Faros AI (10K+ devs): 98% more PRs created, but 91% longer review times. Agent-driven task completion means nothing if review/testing/deployment can't absorb the throughput.

5. **Echo detection is critical for webhook-driven flows**. Without it, agents process their own updates as new events, creating infinite loops. Use scoped TTL caches or agent-authored-by filters.

## Open Questions

1. **Persistence gap in Claude Code Teams**: Tasks exist only for the session. How to bridge to persistent project management without duplicating state in both Claude TaskList and Linear/GitHub?

2. **Optimal decomposition depth**: Research suggests 3-5 subtasks per level, but is there data on how deep the hierarchy should go for agent workflows? One level? Two? More?

3. **Cross-agent memory**: Beads solves per-agent memory across sessions, but how do multiple agents share learned context (not just task state) across a project?

4. **Evaluation of agent-produced PRs at scale**: With Copilot/Codex/Claude all producing PRs from tickets, what review tooling catches agent-specific failure modes (regeneration over reuse, subtle behavior drift, test superficiality)?

5. **Cost-benefit threshold**: At what team size / project complexity does multi-agent orchestration justify its token cost vs. sequential single-agent work?

## Extracted Principles

Principles extracted to `principles/agent-task-orchestration.md`:
- Shared task board over central assignment
- Beads-style structured memory over flat TODO files
- Contract-first decomposition (verify before delegating)
- Event-driven ticket-to-agent pipelines
- File ownership per agent prevents conflicts
- 3-5 agents, 5-6 tasks per agent as starting point
- Plan-before-code discipline for multi-agent coherence

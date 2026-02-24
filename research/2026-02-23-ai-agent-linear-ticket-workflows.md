---
date: 2026-02-23
topic: AI coding agents + Linear ticket management workflows
status: complete
tags: [linear, mcp, ai-agents, claude-code, cursor, copilot, devin, multi-agent, workflow-automation]
---

# AI Coding Agents + Linear Ticket Management Workflows

## Context
Research into how developers are integrating AI coding agents (Claude Code, Cursor, Copilot, Devin, Codegen, Warp) with Linear for ticket management workflows. Focus on existing tools, integration patterns, multi-agent orchestration, and practical lessons learned.

## Findings

### 1. Linear's Agent Platform (First-Party)

Linear has evolved from an issue tracker into an **agent orchestration platform**. They ship a dedicated Agent API (currently Developer Preview) that treats AI agents as first-class citizens.

**Agent API Architecture:**
- OAuth2 app registration with `actor=app` mode
- Scopes: `app:assignable`, `app:mentionable`, plus granular data access
- **AgentSession lifecycle**: `pending` -> `active` -> `awaitingInput` -> `complete` / `error`
- Webhook-driven: `AgentSessionEvent` fires on mention, assignment, or user prompt
- Must emit a `thought` activity within 10 seconds of session creation or get marked unresponsive
- Five activity types: `thought`, `elicitation`, `action`, `response`, `error`
- Session plans: task checklists with `pending`/`inProgress`/`completed`/`canceled` steps

**Linear MCP Server (Official):**
- Remote MCP server at `mcp.linear.app/mcp`
- OAuth with dynamic client registration (no manual API keys)
- Claude Code setup: `npx -y mcp-remote https://mcp.linear.app/mcp` then `/mcp` for auth flow
- Tools: find, create, update issues/projects/comments; support for initiatives, milestones, updates
- Still in active development; known issues with token expiration

**Agent Marketplace:**
Linear now has an agent integrations directory with 15+ agents:
- **Codex** (OpenAI) — delegate issues directly
- **Cursor** — transform issues into PRs via cloud agents
- **GitHub Copilot** — convert issues to code
- **Devin** — scope issues, draft PRs
- **Factory** — assign backlog to Droids
- **Sentry Agent** — resolve issues using Seer
- **Cyrus** — Claude Code-powered agent
- **Codegen** — AI coding with multi-agent spawning
- **Oz by Warp** — cloud agent orchestration
- **ChatPRD** — requirements writing and product feedback
- **Reflag** — feature flag management
- Plus: Charlie, Pixelesq, Ranger, Stilla, Panaptico, Tembo, Solo, Replicas

Sources: [Linear Agent Docs](https://linear.app/developers/agents), [Agent Interaction SDK](https://linear.app/developers/agent-interaction), [Linear MCP Docs](https://linear.app/docs/mcp), [Linear Agent Integrations](https://linear.app/integrations/agents)

---

### 2. Specific Tool Integrations

#### GitHub Copilot Coding Agent + Linear (Official, Public Preview since Oct 2025)
The most polished integration currently available:
- Install "GitHub Copilot coding agent for Linear" from GitHub Marketplace
- Assign a Linear issue to Copilot -> it spins up an ephemeral dev environment via GitHub Actions
- Explores code, makes changes, runs tests/linters autonomously
- Streams progress updates back to Linear activity timeline
- Creates a draft PR when done, requests review
- Follows existing review/approval rules
- Requires org owner (GitHub) + workspace admin (Linear) permissions

Source: [GitHub Docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/integrate-coding-agent-with-linear), [GitHub Changelog](https://github.blog/changelog/2025-10-28-github-copilot-for-linear-available-in-public-preview/)

#### Devin + Linear (Official)
Most mature agent-to-Linear integration:
- Assign Devin to an issue, mention @devin in a comment, or apply "devin" label
- Bulk assign: `Cmd+A` multi-select + add Devin label
- Configure webhooks to auto-trigger Devin on new issues
- Devin learns from past tickets/PRs and auto-generates "Linear Knowledge"
- Configurable triggers: by ticket status (Todo, Backlog), by team, or all new tickets
- Comments on tickets with analysis, provides link to start PR

Source: [Devin Linear Docs](https://docs.devin.ai/integrations/linear), [Linear Integration Page](https://linear.app/integrations/devin)

#### Cursor + Linear
- Cursor v1.5 delivered Linear integration
- Launch Background Agents directly from Linear issue tickets
- "Implement the feature described in Linear issue #234" -> fetches issue, builds
- MCP setup available for deeper integration
- Can start agents from Linear, Slack, GitHub

Source: [Cursor Product](https://cursor.com/product)

#### Warp (Oz) + Linear
- Tag @Oz on a Linear issue or comment
- Cloud agent clones repo, works on task
- Live session sharing: join and steer the agent in real-time via browser
- Creates PR on your behalf, posts summary + PR link back to Linear
- Requires Build/Max/Business plan + 20 credits

Source: [Warp Linear Docs](https://docs.warp.dev/agent-platform/cloud-agents/integrations/linear)

#### Codegen + Linear
- Tag @codegen in a Linear issue -> it plans work and ships a PR
- Auto-updates issue status and links GitHub PRs to Linear issues
- **Multi-agent spawning**: with "linear self-assign" enabled, an agent can create sub-issues, assign itself, and spawn child agents for each sub-issue
- Posts progress comments, generates follow-up issues

Source: [Codegen Linear Integration](https://docs.codegen.com/integrations/linear), [Codegen Blog](https://codegen.com/blog/codegen-linear-integration/)

---

### 3. Community MCP Servers & Tools

#### Official Linear MCP Server
- URL: `https://mcp.linear.app/mcp`
- Remote MCP with OAuth (no API keys)
- Works with Claude Desktop, Claude Code, Cursor

#### jerhadf/linear-mcp-server (Community, Popular)
- GitHub: [jerhadf/linear-mcp-server](https://github.com/jerhadf/linear-mcp-server)
- Tools: `linear_create_issue`, `linear_update_issue`, `linear_search_issues`, `linear_add_comment`
- Install via Smithery: `npx @smithery/cli install linear-mcp-server --client claude`
- Uses Linear API key (simpler than OAuth, but less secure)

#### tacticlaunch/mcp-linear (Community)
- GitHub: [tacticlaunch/mcp-linear](https://github.com/tacticlaunch/mcp-linear)
- Retrieve, create, update issues, projects, and teams via natural language

#### bobmatnyc/mcp-ticketer (Universal)
- GitHub: [bobmatnyc/mcp-ticketer](https://github.com/bobmatnyc/mcp-ticketer)
- Universal ticket management: Linear, GitHub Issues, Jira, Asana
- Unified model: Epic, Task, Comment types
- Intelligent token pagination (20K token cap prevents context overflow)
- Smart caching, async operations, full-text search
- Supports Claude Code, Claude Desktop, Gemini, Codex

#### wrsmith108/linear-claude-skill
- GitHub: [wrsmith108/linear-claude-skill](https://github.com/wrsmith108/linear-claude-skill)
- Claude Code skill for managing Linear issues, projects, teams
- MCP tools + SDK automation + GraphQL API patterns

---

### 4. Dedicated Agent Orchestration Platforms

#### Cyrus (Claude Code -> Linear Agent)
- GitHub: [ceedaragents/cyrus](https://github.com/ceedaragents/cyrus)
- Website: [atcyrus.com](https://www.atcyrus.com/)
- Monitors Linear issues assigned to it
- Creates isolated Git worktrees per issue
- Runs Claude Code (or Cursor, Codex, Gemini) sessions
- Streams activity updates back to Linear (including dropdowns, approvals)
- Three deployment options: managed cloud, self-hosted (`npm install -g cyrus-ai`), community self-hosted
- BYOK (bring your own API keys)

#### claude-code-connect (Boss Agent Pattern)
- GitHub: [evgenygurin/claude-code-connect](https://github.com/evgenygurin/claude-code-connect)
- "Boss Agent" (Claude Code) coordinates, delegates to Codegen worker agents
- Boss Agent analyzes, classifies (feature/bug/refactor), builds prompts, delegates
- Codegen agent implements, tests, documents, creates PRs
- Boss Agent monitors via webhooks, updates Linear, notifies Slack
- Persistent memory via Mem0
- Multi-platform reporting: Linear comments, GitHub updates, Slack notifications

#### CCPM (Claude Code Project Management)
- GitHub: [automazeio/ccpm](https://github.com/automazeio/ccpm)
- Uses **GitHub Issues** (not Linear) as source of truth
- Full workflow: Brainstorm -> PRD -> Epic -> Tasks -> Parallel Execution
- Multiple Claude Code instances work simultaneously via worktrees
- Custom slash commands: `/pm:prd-new`, `/pm:epic-decompose`, `/pm:issue-start`, `/pm:next`
- Parallel execution: one issue decomposes into concurrent work streams
- Claimed results: 89% reduction in context-switching losses, up to 3x faster delivery
- Human-AI handoffs: either party can start, other can finish

Source: [CCPM GitHub](https://github.com/automazeio/ccpm), [Blog Post](https://aroussi.com/post/ccpm-claude-code-project-management)

#### agenttools/worktree
- GitHub: [agenttools/worktree](https://github.com/agenttools/worktree)
- CLI for managing Git worktrees with GitHub issues and Claude Code
- `worktree open 123` creates worktree for an issue
- `-w` flag spawns multiple Claude instances
- `--watcher` flag adds overseer worker
- tmux session management

---

### 5. GitHub Actions + Linear Sync Patterns

#### Linear's Built-in GitHub Integration
- Syncs GitHub issues <-> Linear issues bidirectionally
- Auto-updates status: In Progress when PR drafted, Done when PR merged
- Links PRs/commits to Linear issues
- Comments, assignee, status synced both directions

#### Custom GitHub Actions for Linear
- **rijkvanzanten/gh-action-linear**: Basic GitHub -> Linear sync
- **Custom workflow gist** ([gschechter](https://gist.github.com/gschechter/3f982ea86e0312a7e0c0d04efeabce20)): Updates Linear issue status based on commit messages and branch merges across dev/UAT/prod environments
- **NomicFoundation/github-linear-bridge**: Bridges GitHub and Linear for teams that use both

#### Claude Code GitHub Action (anthropics/claude-code-action)
- @claude mention in any PR or issue triggers Claude
- Can analyze code, create PRs, implement features, fix bugs
- Follows project standards via CLAUDE.md
- Can be combined with Linear sync for full loop: Linear issue -> GitHub issue -> Claude implements -> PR -> Linear auto-updates

#### Port.io Orchestration
- Generic workflow platform connecting ticket systems to coding agents
- Supports Linear, Jira, GitHub Issues as sources
- Enriches tickets with catalog context before delegating to agents
- Two patterns: single workflow or separate agent + automation triggers
- Can use Copilot, Claude Code, or Devin as the executing agent

Source: [Port.io Guide](https://docs.port.io/guides/all/automatically-resolve-tickets-with-coding-agents/)

---

### 6. Multi-Agent Patterns

#### Pattern A: Coordinator + Workers (Boss/Worker)
The most common pattern. One agent manages, others implement.

**Example (claude-code-connect):**
1. Boss Agent watches Linear for new assignments
2. Classifies issue (feature/bug/refactor)
3. Builds context-rich prompt
4. Delegates to Codegen worker agent
5. Worker implements + creates PR
6. Boss monitors progress via webhooks
7. Boss updates Linear status + notifies Slack

**Example (Codegen multi-agent):**
1. Parent agent assigned Linear issue
2. Creates sub-issues for decomposed work
3. Self-assigns sub-issues (with "linear self-assign" enabled)
4. Child agents spawn per sub-issue
5. Each child works independently, creates PRs
6. Parent agent tracks completion

#### Pattern B: Spec-Driven Pipeline
Linear ticket is the trigger, but a structured pipeline enforces quality.

**Example (Mark Torres's Linear Ticket Execution Orchestrator):**
1. Linear ticket triggers 14-step workflow
2. Hard gates: Plan Approved -> Spec Compliance -> Report Linked
3. Each step produces durable artifacts (spec.md, plan.md, tickets/*.md)
4. Adherence blocks (JSON) track progress at each step
5. TDD-first: tests before implementation
6. Agent cannot proceed without explicit sign-off at gates

Source: [markptorres.com](https://markptorres.com/ai_workflows/2025-11-17-linear-ticket-execution-orchestrator)

#### Pattern C: PRD -> Epic -> Parallel Workers
End-to-end project management through AI agents.

**Example (CCPM):**
1. Human writes initial feature description
2. Agent creates PRD via guided brainstorm
3. PRD decomposes into epic with architectural decisions
4. Epic splits into concrete tasks with parallelization flags
5. Tasks sync to GitHub Issues
6. Multiple Claude Code instances work parallel tasks in worktrees
7. Each agent has isolated context (prevents context window exhaustion)

#### Pattern D: Label/Assignment Trigger
Simplest pattern. Assign or label -> agent picks up.

**Examples:**
- Devin: apply "devin" label -> auto-triggers on new issues
- Copilot: assign to Copilot -> ephemeral env spins up
- Warp: @Oz mention -> cloud agent starts
- Cyrus: assign to Cyrus -> worktree + Claude Code session

---

### 7. Best Practices & Lessons Learned

#### What Works Well

1. **Spec-first is highest-leverage.** Planning and specification quality directly determines agent output quality. More time on specs = better results. This is the consistent #1 finding across all sources.

2. **Hard gates prevent agent drift.** Unsupervised agents drift — they code before plans are approved, forget context, submit hard-to-review PRs. Enforce checkpoints: plan approval, spec compliance, test evidence.

3. **Isolated contexts via worktrees.** Each agent in its own worktree prevents conflicts and keeps context windows clean. Claude Code has native `--worktree` / `-w` flag support.

4. **GitHub Issues / Linear as source of truth.** Not local files, not chat history. External ticket trackers provide audit trails, team visibility, and survive context window resets.

5. **Artifact-driven workflows.** Agents should produce durable artifacts (spec.md, plan.md, test reports) not just code. Decisions and outcomes live next to the work = institutional memory.

6. **Small, focused tasks.** Break work into atomic tickets. One function, one bug, one feature per ticket. LLMs perform best with focused scope.

7. **TDD-first for agent work.** Write tests before implementation. Prevents regressions and forces behavior specification upfront.

8. **Progressive trust model.** Start with agent analysis/scoping (Devin's default), graduate to agent implementation, then to autonomous PR creation. Don't go full autonomy immediately.

#### What Doesn't Work

1. **Large monolithic tickets.** Asking an agent to "implement the entire auth system" produces poor results. Decompose first.

2. **MCP server overload.** "Went overboard with 15 MCP servers thinking more = better. Ended up using only 4 daily." Start with the official Linear MCP + GitHub MCP.

3. **Vibe coding for production.** Each iteration loses context. Agent assumptions compound. Resulting code works but doesn't align with project patterns. Use reference code and CLAUDE.md constraints.

4. **No human review gates.** Agents will submit PRs that technically pass tests but have architectural issues, security problems, or don't match team conventions.

5. **Stale context.** Linear MCP tokens expire. Agent sessions time out. Webhook connections drop. Build resilience for reconnection and state recovery.

6. **Treating agents as replacements.** The most successful teams view agents as amplifying engineers, not replacing them. Architecture, product decisions, creative problem-solving stay human.

#### Common Pitfalls

- **Token expiration on Linear MCP:** OAuth tokens need refresh handling; the official MCP server has known issues here.
- **Context window exhaustion:** Parallel agent architecture (CCPM style) solves this by keeping each agent's context focused.
- **Webhook reliability:** 10-second timeout on Linear AgentSession means your webhook handler must be fast. Use async processing.
- **Label/assignment loops:** Agent creates sub-issues, assigns itself, spawns more agents -> cost spiral. Set depth limits.
- **Test quality:** LLMs can generate trivial test cases that pass but don't validate real behavior. Human review of test quality matters.

---

### 8. Architecture Recommendations

**For a Solo Developer (simplest):**
1. Linear MCP Server (official) connected to Claude Code
2. Write tickets in Linear with clear acceptance criteria
3. Claude Code reads ticket, implements in worktree, creates PR
4. Linear auto-updates status via GitHub integration

**For a Small Team (3-5 devs):**
1. Cyrus or Copilot coding agent connected to Linear
2. Assign tickets to agent via label/assignment
3. Agent works in isolated environment, streams progress
4. Human reviews PR, Linear auto-closes on merge
5. Use Linear's built-in GitHub sync for status

**For Multi-Agent Workflows:**
1. CCPM pattern: PRD -> Epic -> Parallel Claude Code instances
2. Or claude-code-connect pattern: Boss Agent + Worker Agents
3. GitHub Issues or Linear as coordination layer
4. Each agent in its own worktree
5. Hard gates between phases (plan approval, spec compliance)
6. Durable artifacts at each stage

## Open Questions

1. **Linear Agent API stability.** Currently Developer Preview — how much will change before GA? Is it safe to build against now?
2. **Cost modeling.** Multi-agent workflows (especially Codegen's sub-issue spawning) can get expensive quickly. No one has published good cost-per-ticket analysis.
3. **Agent quality comparison.** No rigorous benchmarks comparing Copilot vs Devin vs Codegen vs Claude Code on real Linear tickets. Mostly anecdotal.
4. **Human-agent handoff UX.** When an agent gets stuck, how does the handoff back to a human work smoothly? Most tools just leave a comment and stop.
5. **Cross-agent coordination.** Codegen's multi-agent spawning is the most interesting pattern but relies on their proprietary platform. How to replicate with open tools?

## Extracted Principles

Key principles that could be extracted to a principles file:

1. **Spec-first for agent work** — invest in ticket quality (acceptance criteria, context, constraints) before assigning to any agent.
2. **Hard gates, not autonomy** — enforce plan approval, spec compliance, and test evidence checkpoints.
3. **Worktree isolation** — one agent, one worktree, one focused context window.
4. **Ticket tracker as coordination layer** — Linear/GitHub Issues, not chat or local files, is the source of truth for agent work.
5. **Progressive trust** — start with agent analysis, graduate to implementation, then autonomous PRs.
6. **Artifact-driven** — agents produce specs, plans, test reports alongside code.
7. **Atomic tickets** — small, focused scope per agent assignment.

# Agent Orchestration: Router Agents and Multi-Interface Architecture

## Summary

Principles for building personal router agents that serve as a conversational interface to multiple services. Covers gateway MCP design, context management, session lifecycle, cost control, and multi-interface patterns. Synthesized from hermes architecture design (2026-03-03) and llmemory/Atlas codebase analysis.

## Principles

### Gateway MCP Over Per-Service MCP
- **What:** For up to ~10 services, use a single gateway MCP server that wraps all services, not one MCP server per service. Adding a service = adding tools to the gateway.
- **Why:** Per-service MCP multiplies configuration (N servers to register in Claude Code settings, N stdio transports to manage). A gateway is simpler to run (one process, one registration), easier to evolve, and keeps tool namespacing visible in one place. The 10-service threshold is conservative; in practice, tool count (~30 per server is the practical Claude Code limit) is the real constraint.
- **When:** Personal infrastructure and small-team systems with fewer than 10 services. Revisit if services need independent versioning, team ownership, or if tool counts exceed 30.
- **Source:** research/2026-03-03-hermes-architecture.md

### Capability Layer Separate From Interface Layer
- **What:** Build the gateway MCP server as the canonical capability layer. CLI and dashboard are thin interfaces that attach to it. Adding an interface does not change the MCP layer.
- **Why:** Without this separation, capability logic leaks into each interface (dashboard has its own memory logic, CLI has its own). Changes must be made in N places. The MCP server is the single source of truth for what the agent can do.
- **When:** Any agent system with more than one interface. Even if the dashboard is the only interface today, assume CLI access (`claude --agent`) is free and use both from the start.
- **Source:** research/2026-03-03-hermes-architecture.md

### Headless Claude Code for Cost Control
- **What:** Use `claude -p --agent <name>` (headless Claude Code) for personal assistant backends rather than the Anthropic SDK. The HTTP backend spawns a subprocess, streams output via SSE, and manages conversation history server-side.
- **Why:** Headless Claude Code uses the existing Claude Code subscription rather than API pay-per-token pricing. For moderate personal assistant usage (~50 turns/day), this is substantially cheaper. The `--output-format stream-json --verbose` flag provides structured event streaming compatible with SSE.
- **When:** Personal infrastructure projects where the developer has an active Claude Code subscription. Not suitable for production services, multi-user systems, or workloads that exceed subscription limits (where API pricing with predictable costs is preferable).
- **Source:** research/2026-03-03-hermes-architecture.md, dashboard/backend/src/services/researchService.ts (pattern reference)

### Tiered Context Loading
- **What:** Load agent context in three tiers: (1) always-on identity and hard constraints, (2) session-start briefing injected before the first user message, (3) on-demand retrieval via tool calls during the session.
- **Why:** Loading everything always wastes context budget on irrelevant detail. Loading nothing forces the agent to search for everything (slow, tool call overhead). The three-tier structure puts orientation context (who I am, recent state) in Tier 2 where it's pre-computed and bounded, while long-tail knowledge stays in Tier 3 where it's retrieved only when needed.
- **When:** Any agent with persistent memory and session continuity requirements. The tier boundaries shift by use case — Tier 2 budget of 500 tokens is right for a personal assistant; a research agent might expand Tier 2 to include relevant prior findings.
- **Source:** research/2026-03-03-hermes-architecture.md, principles/agent-context-augmentation.md (three-tier architecture)

### Session Briefing as Bounded Pre-Computed Digest
- **What:** Implement a dedicated `GET /session/briefing` endpoint on the memory service. It returns a compact digest — pending work, active threads, recent events (last 24h), high-activation nodes — bounded to under 500 tokens. This is injected as Tier 2 context at session start.
- **Why:** On-demand computation at session start adds latency and costs tokens. Pre-computing and caching the briefing (max-age ~5 minutes, invalidated on new events) makes it fast and cheap. The token budget forces prioritization — the briefing is a curated summary, not a dump.
- **When:** Any memory-backed agent system. The 500-token budget is a starting point; calibrate based on how much context the agent actually uses from the briefing.
- **Source:** research/2026-03-03-hermes-architecture.md

### Wrap-Up Protocol for Memory Persistence
- **What:** At session end (explicit user command or inactivity timeout), switch the agent to synthesis mode: scan the conversation for decisions, new context, and action items, then write a session summary to the memory service. For Atlas: call `atlas_log_event` with type `session_summary`; the Archivist consolidates it into the knowledge graph.
- **Why:** Without a wrap-up step, each session is isolated — the next session briefing has no record of what happened. The Archivist's LLM-powered consolidation handles deduplication (writing "decided to use Postgres for the API" doesn't create a duplicate node if a similar node exists). The pattern comes directly from llmemory's WRAP-UP / SUMMARIZATION mode.
- **When:** Any agent with cross-session continuity requirements. The wrap-up can be triggered explicitly by the user ("wrap up this session") or automatically by the backend after N seconds of inactivity.
- **Source:** research/2026-03-03-hermes-architecture.md, llmemory/src/server/services/systemPrompt.ts (WRAP-UP mode)

### Tool Call Cap Per Turn
- **What:** Set a maximum of 5 tool calls per agent turn. After 5 calls, the agent must respond to the user before making more tool calls.
- **Why:** Without a cap, agents can enter runaway tool-use loops — especially when a search returns no results and the agent keeps refining queries. The cap forces a "respond with what I have" behavior that is more useful than silent extended searching. For a personal assistant, 5 tool calls per turn is generous; most requests need 1-3.
- **When:** Any agent using multiple tools. The cap is a behavioral instruction in the agent file; for hard enforcement, a `PostToolUse` hook that counts calls and injects a stop message is more reliable. Start with the instruction; add the hook if loops become a real problem.
- **Source:** research/2026-03-03-hermes-architecture.md

### Health-Aware Routing
- **What:** Implement a `health_check` tool that pings all registered services and returns their status (online/offline, response time, last-seen). Surface unhealthy services in tool descriptions so the agent degrades gracefully.
- **Why:** If Atlas is down and the agent doesn't know it, it will silently call `atlas_search` and get a connection error, then retry, then produce a confusing response. Health-aware routing lets the agent proactively tell the user "Atlas is offline, I can't search memory right now" and suggest alternatives.
- **When:** Any gateway that proxies to external services. Run health check at session start and cache results. Re-run if a tool call fails unexpectedly.
- **Source:** research/2026-03-03-hermes-architecture.md

### Approval Gates for Destructive Operations
- **What:** For irreversible tool calls (delete ticket, bulk writes, send messages), pause execution and emit an approval request event to the client before executing. The client shows a confirmation modal; user approves or rejects; execution continues or aborts.
- **Why:** Agents occasionally misinterpret scope — a request to "clean up old tickets" might delete more than intended. The approval gate is a last-resort human checkpoint for operations that can't be undone. llmemory's implementation uses a promise that pauses the tool executor until resolved via HTTP endpoint.
- **When:** Any tool with real-world consequences that can't be easily reversed. Use sparingly — gates on read operations or minor writes add friction without value. The pattern: `ToolApprovalConfig { required: boolean | (input) => boolean, createRequest: (input) => { summary, details } }`.
- **Source:** research/2026-03-03-hermes-architecture.md, llmemory/src/server/services/toolApproval.ts

### Digital Chief of Staff as a Persistent Memory Node
- **What:** Create a persistent node in the memory service representing the agent's behavioral identity: communication style, user preferences about how the agent should behave, learned patterns from interactions. This is distinct from the "Me" node (facts about the user) — it's behavioral guidance for the agent.
- **Why:** The pattern from llmemory: a "Digital Chief of Staff Personality" concept captures how to work effectively with this user, not just facts about them. Stored in Atlas as a high-activation node, it surfaces in the session briefing and shapes how the agent responds. It should evolve when the user pushes back on agent behavior.
- **When:** Any long-running personal assistant with persistent memory. Create the node at initial setup with seed values (communication style, key preferences). Let the agent update it as behavioral preferences become clear.
- **Source:** research/2026-03-03-hermes-architecture.md, llmemory/src/server/services/systemPrompt.ts (MEMORY_TOOLS_GUIDANCE)

## Revision History
- 2026-03-03: Initial extraction from hermes architecture design session. 10 principles.

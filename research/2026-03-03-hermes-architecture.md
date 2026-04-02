---
date: 2026-03-03
topic: hermes router agent architecture
status: complete
tags: [hermes, mcp, router-agent, atlas, claude-code, headless, multi-interface]
related: [2026-03-02-custom-logging-system.md]
---

# Hermes: Router Agent Architecture

## Context

Josh's personal infrastructure has grown to a collection of independently accessible services: Atlas (knowledge graph, port 3001), Hopper DB (thought capture, SQLite), Task Runner (Linear CLI), Logger, and the Dashboard. Each must be accessed separately. The goal of hermes is a conversational agent that serves as the primary interface to all of these — interpreting natural language and dispatching to the right service(s), with Atlas as persistent memory across sessions.

This session produced architecture decisions, reference patterns, project structure, and Linear tickets for implementation. No code was written.

---

## Findings

### Why a Router Agent Now

The pattern becomes worth building when:
1. You have 3+ services you'd rather talk to than command directly
2. Cross-service queries emerge (e.g., "what did I decide about X and are there any related tickets?")
3. Context continuity matters (the agent should know what happened in previous sessions)

The Hopper → Atlas pipeline already handles raw thought capture and structured memory. The gap is the conversational interface that can orchestrate across services and remember context.

---

### Atlas vs llmemory: Memory Models

Two memory systems have been explored in this stack. Key differences:

| Dimension | llmemory | Atlas |
|---|---|---|
| Write mechanism | LLM calls `create_concept` / `update_concept` during conversation | Collectors write `POST /events`; Archivist consolidates asynchronously |
| Direct write | Yes, immediate | Yes via `POST /nodes` (bypass Archivist) |
| Read mechanism | `search_concepts` → `retrieve_concept` (UUIDs) | `GET /search?q=`, `GET /nodes/:id`, `GET /search/related/:id` |
| Version history | Not built-in | Full version history on every node update |
| Activation model | No | Yes — access bumps score, time decays it |
| HTTP API | No (internal to server) | Yes (port 3001, all operations) |
| Edge model | `link_concepts` (undirected) | Typed edges (related_to, supports, contradicts, etc.), weighted |
| Personality nodes | "Digital Chief of Staff Personality" concept | Same pattern, stored as a node |

**For hermes:** use Atlas for all persistent memory. The HTTP API is what makes Atlas composable. The event log → archivist pattern is better than direct node writes for session summaries (async consolidation, LLM-powered deduplication). Direct `POST /nodes` for things that need to appear immediately.

**llmemory patterns to adopt:**
- "Digital Chief of Staff Personality" concept — replicate as an Atlas node with agent behavioral traits
- Wrap-up mode — systematic extraction at session end, write to Atlas via `atlas_log_event`
- Promise-based approval gates for destructive operations
- Memory cards in UI (inline indicators when Atlas captures something)

---

### Architecture

```
CLI: claude --agent hermes ────────────────────┐
  (multi-turn, zero custom CLI code)           |
                                               ├──MCP (stdio)──► Gateway MCP Server
Dashboard Frontend (llmemory-style UI)         |                       |
         |                                     |          ┌────────────┼────────────┐
    [HTTP + SSE]                               |          |            |            |
         |                                     |        Atlas        Hopper    Task Runner
Router Backend (Hono, port 3003)               |       :3001          SQLite      CLI
  spawns claude -p --agent hermes ─────────────┘        Logger      (future services)
  manages conversation history                          :3004
  streams output via SSE
```

**Key decisions:**

1. **Gateway MCP, not per-service MCP.** A single MCP server wraps all services. Adding a service = adding tools. No service needs its own MCP server. This stays true until the tool count exceeds ~30 (practical limit: 10-15 tools is cleaner).

2. **CLI is Claude Code, not a custom binary.** `~/.claude/agents/hermes.md` configures Claude Code as the router. Multi-turn, memory via Atlas, tool access via gateway MCP. Zero custom CLI code. Phase 1 is immediately usable after writing the agent file and registering the MCP server.

3. **MCP server spawned per-session by Claude Code.** The gateway MCP is stateless (pure HTTP proxy to services). Claude Code spawns it as a subprocess when starting a headless session. No need for a persistent daemon. Simpler deployment, no port management.

4. **Headless Claude Code for cost control.** `claude -p` uses the existing Claude Code subscription, not the Anthropic API. For a personal assistant with moderate usage, this is significantly cheaper than API pricing. The dashboard backend spawns `claude -p --agent hermes` and streams output via SSE.

5. **Capability layer separate from interface layer.** The gateway MCP server is the brain. The CLI (`claude --agent hermes`) and dashboard are thin interfaces that attach to the same MCP server and agent identity. Adding a new interface doesn't change the MCP layer.

---

### Service Registry Design

At this scale (<10 services), the registry is static config. Tools *are* the registry — adding a service means adding tool definitions. No dynamic discovery needed.

```typescript
interface ServiceConfig {
  name: string;
  baseUrl: string;
  healthEndpoint: string;
}

const SERVICES: Record<string, ServiceConfig> = {
  atlas: {
    name: 'Atlas',
    baseUrl: 'http://localhost:3001',
    healthEndpoint: '/health',
  },
  hopper: {
    name: 'Hopper',
    baseUrl: 'http://localhost:3002',
    healthEndpoint: '/health',
  },
  logger: {
    name: 'Logger',
    baseUrl: 'http://localhost:3004',
    healthEndpoint: '/health',
  },
};
```

Health check tool surfaces service availability in tool responses so the agent can degrade gracefully (e.g., "Atlas is down, can't search memory right now").

---

### Context Management

**Tiered loading** (adapted from agent-context-augmentation principles):

| Tier | Loaded | Content | Token budget |
|---|---|---|---|
| 1 | Always | Agent identity, user name, key prefs from Atlas "hermes" node | ~200 |
| 2 | Session start | Session briefing from `GET /session/briefing` on Atlas | <500 |
| 3 | On demand | `atlas_search`, `atlas_read_node` as needed | Unlimited |

**Session briefing** (`GET /atlas:3001/session/briefing`, Phase 3):
- Compact digest: pending work items, active threads, recent events (last 24h), high-activation nodes (activation > 2.0)
- Pre-computed and cached, not generated per-request
- Injected by the HTTP backend before spawning headless Claude, or loaded as Tier 2 context by the CLI agent

**Context rot mitigation:**
- Sliding window: HTTP backend caps conversation at 20 messages, summarizes older turns before next spawn
- Tool call cap per turn: 5 tools max (prevent runaway loops)
- Wrap-up protocol: agent writes session summary to Atlas at session end

**Wrap-up protocol** (from llmemory's WRAP-UP mode, adapted for Atlas):

At session end (explicit or on timeout), the agent switches to synthesis mode:
1. Scan conversation for key decisions, new context, action items
2. Call `atlas_log_event` with a session summary node (type: `session_summary`, tags: `["session"]`)
3. The Archivist consolidates it into the knowledge graph via FTS + LLM matching
4. High-activation nodes from the session will be surfaced in the next session briefing

The Archivist's consolidation pipeline (FTS title matching as primary, LLM semantic matching when API key is available) handles deduplication — writing "decided to use Postgres for the API" doesn't create a duplicate node if Atlas already has "API database decision."

---

### Tool Schemas

**Atlas tools** (Phase 1):

```typescript
const ATLAS_TOOLS = [
  {
    name: 'atlas_search',
    description: 'Full-text search across Atlas knowledge graph. Use when looking up past decisions, context, or anything previously discussed.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query' },
        type: { type: 'string', description: 'Filter by node type', enum: ['observation', 'decision', 'insight', 'concept', 'project', 'person'] },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['q'],
    },
  },
  {
    name: 'atlas_read_node',
    description: 'Read full content of an Atlas node by ID. Bumps activation. Always search first to get IDs.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Atlas node ID' } },
      required: ['id'],
    },
  },
  {
    name: 'atlas_recent',
    description: 'Get recently accessed nodes from Atlas. Useful for session continuity.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 10)' },
        type: { type: 'string', description: 'Filter by node type' },
      },
    },
  },
  {
    name: 'atlas_related',
    description: 'Find nodes related to a given node via graph edges.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Source node ID' } },
      required: ['id'],
    },
  },
  {
    name: 'atlas_log_event',
    description: 'Write an event to Atlas. The Archivist consolidates it into the knowledge graph. Use to save session summaries, decisions, or new context.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        type: {
          type: 'string',
          enum: ['observation', 'decision', 'insight', 'session_summary'],
          default: 'observation',
        },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'content'],
    },
  },
];
```

**Hopper tools** (Phase 1):

```typescript
const HOPPER_TOOLS = [
  {
    name: 'hopper_capture',
    description: 'Capture a quick thought or idea to Hopper. Use when the user wants to save something unstructured for later processing.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['content'],
    },
  },
  {
    name: 'hopper_query',
    description: 'Search recent thoughts in Hopper by text or tag.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
    },
  },
];
```

**Session types for HTTP backend:**

```typescript
interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  messages: ChatMessage[];
  atlasEventIds: string[];  // events written during this session
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: { name: string; input: unknown; result: unknown }[];
}
```

---

### Headless Claude Code SSE Pattern

From `dashboard/backend/src/services/researchService.ts`:

```typescript
// Adapted pattern for hermes HTTP backend
function spawnHeadlessSession(messages: ChatMessage[], res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    // Build full conversation prompt from history
    const systemBlock = `...hermes system context...`;
    const conversationLines = messages.map(m =>
      m.role === 'user' ? `Human: ${m.content}` : `Assistant: ${m.content}`
    );
    const prompt = `${systemBlock}\n\n${conversationLines.join('\n\n')}`;

    // Spawn headless Claude Code with hermes agent + gateway MCP
    const child = spawn('claude', [
      '-p', prompt,
      '--agent', 'hermes',
      '--output-format', 'stream-json',
      '--verbose',
    ], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

    // Stream JSON events → SSE to dashboard
    child.stdout.on('data', (chunk) => {
      // parse stream-json, extract assistant text, write SSE
      // same pattern as researchService.ts
    });

    res.on('close', () => { if (!child.killed) child.kill(); });
  });
}
```

Key note: conversation history is maintained server-side. Each request rebuilds the full prompt from stored messages. The MCP server is registered in Claude Code settings and gets spawned by Claude Code per-session.

---

### Approval Gates (from llmemory)

For destructive operations (delete a ticket, bulk Atlas writes), adapt llmemory's promise-based pattern:

```typescript
// llmemory/src/server/services/toolApproval.ts pattern
// Tool execution pauses, emits approval_request SSE event to dashboard
// Dashboard shows confirmation modal
// User approves/rejects, POST /tool-approval/:id
// Promise resolves, tool continues or aborts
```

In Phase 7, this applies to:
- `task_runner_delete_ticket` — irreversible
- Bulk `atlas_log_event` calls — should confirm before writing N nodes

---

### Module/Tool Registration Pattern (from llmemory)

The llmemory `ModuleDefinition` pattern — where each module declares its tools, system prompt guidance, and routes — simplifies directly for MCP:

```typescript
// llmemory: ModuleDefinition has tools[], systemPromptGuidance, createRouter, initialize
// Hermes MCP equivalent:
interface ServiceModule {
  name: string;
  tools: MCPTool[];
  systemPromptNote?: string;  // injected into agent file guidance
  healthCheck: () => Promise<boolean>;
}
```

Tool registration is a flat `Map<toolName, handler>`. The MCP server calls `server.tool(name, schema, handler)` for each registered tool. No topological sorting needed (services have no inter-dependencies at the tool level).

---

### Dashboard UI Direction

**Anti-pattern:** Adapting ResearchChat (`dashboard/frontend/src/modules/ResearchChat/ChatView.tsx`). That UI is file-focused, single-turn, no memory awareness, no service status.

**Target:** llmemory-style UI, built fresh. Key components:

- **Memory cards** — when `atlas_log_event` succeeds, insert an inline card in the message stream showing what was saved (title, node type, tags). Same pattern as llmemory's concept creation indicators.
- **Context panel** — collapsible right panel, shows pinned Atlas nodes. Updated when agent calls `atlas_read_node` (node appears pinned). Useful for seeing what the agent "has in mind."
- **Session sidebar** — list of past sessions, resume on click. Session titles auto-generated from first user message.
- **Service status** — small indicator row showing which services are online. Populated from `health_check` tool response at session start.

---

### Project Structure

```
hermes/                          # New standalone project (bare repo + worktrees)
  src/
    mcp/
      server.ts                  # MCP server entry (stdio transport, @modelcontextprotocol/sdk)
      tools/
        atlas.ts                 # atlas_search, atlas_read_node, atlas_recent, atlas_related, atlas_log_event
        hopper.ts                # hopper_capture, hopper_query
        taskRunner.ts            # Phase 2: add_ticket, list_tickets, standup (CLI subprocess)
        logger.ts                # Phase 2: query_logs, query_metrics
        health.ts                # Phase 2: health_check
      config.ts                  # Service configs (baseUrls, health endpoints)
    http/
      server.ts                  # Hono server (port 3003)
      routes/
        chat.ts                  # POST /chat, GET /chat/stream/:sessionId
        sessions.ts              # GET /sessions, POST /sessions/:id/resume
      services/
        headless.ts              # Spawns claude -p, manages conversation history
        sessions.ts              # Session storage (Hopper DB via svc_hermes_ prefix)
    shared/
      types.ts                   # Session, ChatMessage, ServiceConfig, HealthStatus
  ~/.claude/agents/hermes.md     # Custom agent file (router identity, behavioral guidance)
  package.json
  tsconfig.json
```

**Hopper DB integration for session storage:**
Sessions stored in Hopper DB under `svc_hermes_sessions` table (per the shared infrastructure convention — svc_<service>_ prefix, FK to thoughts.id optional). WAL mode already enabled.

---

### Reuse Points

| Component | Source | Reuse |
|---|---|---|
| SSE streaming | `dashboard/backend/src/services/researchService.ts:212-300` | Direct adaptation — spawn pattern, stream-json parsing, client disconnect handling |
| Approval gate | `llmemory/src/server/services/toolApproval.ts` | Copy the promise-based pattern; adapt SSE event names |
| Hono server setup | `atlas/main/src/api/server.ts` | Reference for Hono + node-server config |
| Hopper DB connection | `dashboard/backend/src/services/hopperDb.ts` | Direct reuse pattern |
| Module registration | `llmemory/src/server/modules/registry.ts` | Simplified version for MCP (no dependency sorting, no router factories) |
| System prompt composition | `llmemory/src/server/services/systemPrompt.ts` | Digital Chief of Staff personality text |

---

### Phase Breakdown

**Phase 1: Gateway MCP + CLI** (hermes project)
- Gateway MCP server with Atlas + Hopper tools
- Custom agent file `~/.claude/agents/hermes.md`
- MCP registered in Claude Code settings
- Immediately usable: `claude --agent hermes` (multi-turn, no dashboard needed)

**Phase 2: Service Expansion** (hermes project)
- Task Runner tools (CLI subprocess pattern)
- Logger tools
- Health check tool

**Phase 3: Atlas Session Briefing** (atlas project)
- `GET /session/briefing` endpoint
- Digital Chief of Staff personality node
- Bounded digest (<500 tokens)

**Phase 4: Router HTTP Backend** (hermes project)
- Hono server, port 3003
- Headless claude spawner + SSE
- Session management (Hopper DB)

**Phase 5: Dashboard Chat UI** (hermes project)
- Fresh ChatModule (not adapted from ResearchChat)
- Memory cards, context panel, session sidebar, service status

**Phase 6: Atlas Vector Search** (atlas project)
- sqlite-vec integration
- Semantic search endpoint + MCP tool
- Archivist updated with semantic matching

**Phase 7: Session Lifecycle** (hermes project)
- Tiered context injection (Tier 1 + Tier 2 briefing)
- Wrap-up protocol
- Sliding window (cap 20 messages)
- Tool call cap (5/turn)
- Approval gates for destructive ops

---

## Open Questions

- **Conversation continuation in headless mode:** `claude -p` is single-turn; history must be rebuilt per request. Worth investigating if a `--conversation-id` flag exists or if the stream-json format supports continuation. If not, the server-side history rebuild is the right approach (matches researchService.ts pattern).
- **MCP server process lifecycle:** Spawned per-session by Claude Code (stateless, correct for now). If any tool needs connection pooling or caching (e.g., a warm Hopper DB connection), revisit running MCP as a persistent daemon with a network transport.
- **Session briefing freshness:** Pre-computing and caching the briefing is fast but risks stale data. Consider a max-age of 5 minutes with invalidation on new Atlas events.
- **Tool call cap enforcement:** The 5-tool cap is a behavioral instruction in the agent file. For hard enforcement, a `PostToolUse` hook that counts tool calls per turn and injects a stop message would be more reliable. Evaluate when loops become a real problem.

## Extracted Principles

- `principles/agent-orchestration.md` (new): Gateway MCP, tiered context, session briefing, wrap-up, tool call caps, health-aware routing, multi-interface separation, headless cost control.

---
date: 2026-02-25
topic: Agent harnesses
status: complete
tags: [ai-agents, agent-harness, orchestration, context-management, tool-execution, claude-agent-sdk]
related: [2026-02-23-ai-agent-ticket-orchestration.md, 2026-02-24-arxiv-2602-12670.md, 2026-02-24-claude-code-headless-permissions-guardrails.md]
---

# Agent Harnesses

## Context

Investigated as part of ongoing research into agent orchestration and infrastructure. The SkillsBench paper (arXiv:2602.12670) evaluated agent performance across three "commercial agent harnesses" — Claude Code, Gemini CLI, and Codex CLI — and found that the harness significantly mediates whether Skills are even utilized. This raised the question: what exactly is a harness, how does it differ from frameworks and runtimes, and how do you build or select one?

2025 proved agents can work. 2026 is about making agents work *reliably*. Multiple practitioners and companies have converged on the term "agent harness" to describe the infrastructure layer that makes this reliability possible.

## Findings

### What Is an Agent Harness?

An agent harness is the software infrastructure surrounding a foundation model that manages everything *except* the model itself. Common definitions from multiple sources:

- **Parallel.ai**: "The complete architectural system surrounding an LLM that manages the lifecycle of context: from intent capture through specification, compilation, execution, verification, and persistence."
- **Salesforce**: "The operational software layer that manages an AI's tools, memory, and safety to ensure reliable, autonomous task execution."
- **DEV.to (Pappas)**: "The infrastructure layer surrounding a foundation model that manages context, tools, error recovery, state, and external memory."
- **Anthropic (via vtrivedy)**: "An external set of functionality to enhance a model's runtime execution, including conversation & context management, a tool invocation layer, permissions, session & file-system state, loop control & error handling, and basic observability/telemetry."

**The best analogy:** The model is the engine; the harness is the car. A great engine without steering, brakes, and fuel management goes nowhere useful.

**Operating system analogy (Philschmid):**
- Model = CPU (processing power)
- Context Window = RAM (limited working memory)
- Agent Harness = Operating System (context curation, boot sequences, standard drivers)
- Agent = Application (user-specific logic)

### Framework vs. Runtime vs. Harness (LangChain's Taxonomy)

The industry has converged on a three-tier hierarchy (source: [LangChain blog](https://blog.langchain.com/agent-frameworks-runtimes-and-harnesses-oh-my/)):

| Layer | What it provides | Examples |
|---|---|---|
| **Framework** | Abstractions and building blocks (agent loop, tool interface, prompts) | LangChain, Vercel AI SDK, CrewAI, OpenAI Agents SDK, Google ADK, LlamaIndex |
| **Runtime** | Durable execution, state persistence, human-in-the-loop, streaming | LangGraph, Temporal, Inngest |
| **Harness** | Batteries-included, opinionated defaults, pre-built tools, lifecycle hooks | Claude Agent SDK, LangChain DeepAgents, coding CLIs (Claude Code, Codex CLI, Gemini CLI) |

The key distinctions:
- **Frameworks** provide building blocks but require you to assemble them.
- **Runtimes** handle how execution happens over time (persistence, crash recovery, durable state).
- **Harnesses** wrap both layers with opinionated defaults — prompt presets, built-in tools, tool-call handling, context compaction, sub-agent management. You focus on *what* the agent does; the harness handles *how* it runs.

**Important nuance:** These distinctions are not always clean. LangGraph is both a runtime and a framework. Claude Agent SDK is both a harness and a framework. The term "harness" is emerging (not fully standardized), but the core concept — higher-level, batteries-included infrastructure — is well-defined.

### Core Components of a Harness

Drawing from Salesforce, Parallel.ai, and Anthropic's Claude Agent SDK documentation, a mature harness provides these subsystems:

#### 1. Context Management
The harness controls what enters the model's context window at each step. This is increasingly recognized as the core function.

**Key techniques:**
- **Compaction/summarization**: As conversation approaches context limit, summarize older turns. Claude Agent SDK does this automatically with server-side compaction (agents have sustained 30+ hour operation with Sonnet 4.5).
- **Retrieval/injection**: RAG-style retrieval injects only relevant context for each step.
- **State offloading**: Full tool outputs saved to external storage; only summaries in-context.

**Context engineering's 3 principles (Lance Martin / Hugo Bowne-Anderson):**
1. **Reduce** — Compact older tool calls into summaries; compress trajectory histories at thresholds.
2. **Offload** — Move full tool results to external storage; reduce action space (2 general tools > 100 specialized tools).
3. **Isolate** — Sub-agents handle token-heavy subtasks in isolated contexts, returning concise results.

#### 2. Tool Orchestration
The harness intercepts tool-call commands from model output, executes them externally, and feeds results back. Without a harness, developers implement this loop manually.

**Harness vs. Client SDK comparison (Claude Agent SDK docs):**
```python
# Client SDK: You implement the tool loop manually
response = client.messages.create(...)
while response.stop_reason == "tool_use":
    result = your_tool_executor(response.tool_use)
    response = client.messages.create(tool_result=result, ...)

# Agent SDK (harness): Claude handles tools autonomously
async for message in query(prompt="Fix the bug in auth.py"):
    print(message)
```

**Key tool design insight (Vercel case study):** Reducing from 15 specialized tools to 2 general-purpose ones (bash + file access) improved accuracy from 80% to 100% while reducing token usage 37% and execution time 3.5x. More tools fragment context; fewer atomic tools concentrate capability.

#### 3. Error Recovery
The harness handles failed tool calls, reasoning dead-ends, and retry strategies — without requiring manual exception handling in agent logic.

- Structured retry policies with backoff
- Dead-end detection (agent looping on the same failed approach)
- State restoration after failures
- Budget enforcement to prevent runaway loops

#### 4. State Management and Session Continuity
Long-running agents must work across multiple discrete sessions. Each session starts with no memory of what came before.

**Anthropic's two-agent pattern for long-running tasks:**
- **Initializer Agent**: Short-lived; runs once at the start. Sets up environment, analyzes the problem, creates a detailed plan with 200+ specific requirements. Writes to `TODO.md` or `claude-progress.txt`. Marks all features as "failing."
- **Coder Agent**: Long-running; invoked repeatedly. Reads `TODO.md`, completes the next incremental step, updates progress, then exits.

This pattern enables true multi-session continuity: the agent "rehydrates" its state from external artifacts at each session start.

**Session API (Claude Agent SDK):**
```typescript
// Capture session ID
for await (const message of query({ prompt: "Read the auth module" })) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume with full context
for await (const message of query({
  prompt: "Now find all callers of it",
  options: { resume: sessionId }
})) { ... }
```

#### 5. Human-in-the-Loop Controls
The harness pauses execution at critical decisions and routes approval requests to humans.

- Tool-level permission modes (read-only vs. full-access vs. interactive approval)
- Cost ceilings and duration limits
- Blocked output patterns and tool allowlists
- High-stakes action gates (before writes, deploys, or external communications)

#### 6. Lifecycle Hooks
Programmable injection points at key events in the agent's execution.

Claude Agent SDK hook events: `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`.

Example (audit logging on file changes):
```typescript
const logFileChange: HookCallback = async (input) => {
  const filePath = input.tool_input?.file_path ?? "unknown";
  await appendFile("./audit.log", `${new Date().toISOString()}: modified ${filePath}\n`);
  return {};
};
```

Hooks can also enforce constraints: a `PreToolUse` hook returning an error blocks tool execution mechanically — no LLM instructions needed. (See Overstory's hook-based role enforcement in principles/agent-task-orchestration.md.)

#### 7. Subagent Coordination
The harness manages specialized sub-agents that handle subtasks in isolated contexts.

```typescript
// Claude Agent SDK subagent definition
const agents = {
  "code-reviewer": {
    description: "Expert code reviewer for quality and security reviews.",
    prompt: "Analyze code quality and suggest improvements.",
    tools: ["Read", "Glob", "Grep"]
  }
}
```

Sub-agents operate in isolated context windows; results flow back to the orchestrating agent as concise summaries.

#### 8. Observability and Telemetry
Harnesses generate structured execution traces — failures, retries, context exhaustion events, tool usage patterns, cost per task. This data closes the feedback loop that static benchmarks cannot.

Key insight: Models score 90%+ on coding benchmarks but 24% on real professional tasks (APEX-Agents benchmark, Mercor, January 2026). The failure mode isn't reasoning — it's orchestration problems. Harness observability makes these visible.

### The Claude Agent SDK as Reference Harness

Anthropic's Claude Agent SDK (formerly Claude Code SDK) is now the canonical production harness example. It provides:

| Capability | Implementation |
|---|---|
| Built-in tools | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion |
| Context compaction | Automatic server-side summarization as context approaches limit |
| Hooks system | PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd |
| Permissions | `allowed_tools`, `permission_mode` (default/acceptEdits/bypassPermissions) |
| Sessions | Capture + resume via `session_id` |
| Subagents | `AgentDefinition` with isolated tool sets |
| MCP integration | Connect to any MCP server (databases, browsers, APIs) |
| Skills | `.claude/skills/SKILL.md` — procedural knowledge packages |

The SDK explicitly exposes what Claude Code does internally, making it a harness for building other harnesses.

### Harness Behavior Mediates Tool/Skill Utilization

The SkillsBench paper (arXiv:2602.12670) tested the same models across three harnesses — Claude Code, Gemini CLI, Codex CLI — and found:

- **Claude Code**: Highest Skills utilization rate; consistent improvements (+13.9pp to +23.3pp across all Claude models)
- **Gemini CLI**: Highest raw performance; solid improvements (+13.6pp to +17.4pp)
- **Codex CLI**: Frequently ignores provided Skills despite acknowledging them; implements solutions independently

**This is a critical finding**: The same model with the same Skills package performs differently depending on which harness is running it. Harness architecture isn't just infrastructure — it determines whether augmentation strategies (Skills, context files, tool definitions) are effective at all. When evaluating agent augmentation, always test across harnesses.

### The "Harness as a Service" (HaaS) Pattern

The industry is moving from LLM API (chat-style) to Harness API (customizable runtime). The shift:

| Era | Primitive | What you build |
|---|---|---|
| 2023 | LLM API | Everything — tools, loops, memory, state |
| 2024 | Agent frameworks | Agent logic on top of framework abstractions |
| 2025 | Agent runtimes | Durable execution with frameworks beneath |
| 2026 | Agent harnesses | Domain-specific agent logic; harness handles everything else |

Companies are productizing their harnesses. Manus (acquired by Meta for ~$2B in December 2025) rebuilt its agent harness architecture five times in six months — same models, five different harnesses, each rewrite improving reliability and task completion. The harness was the moat, not the model.

The Claude Agent SDK embodies HaaS: developers use `query()` as an application primitive, customizing via system prompts, tool selection, hooks, and sub-agent definitions — without building context management, tool loops, or error recovery from scratch.

### Production Patterns and Anti-Patterns

**Patterns that consistently work:**

1. **Fewer, general-purpose tools**: 2 tools (bash + files) > 15 specialized tools. Reduces context fragmentation.
2. **Filesystem as memory**: External progress files (`TODO.md`, `claude-progress.txt`) for session continuity.
3. **Aggressive context compaction**: Summarize early and often; don't let context fill up before compacting.
4. **Initializer + Coder separation**: Separate the planning/setup agent from the execution agent.
5. **Mechanical enforcement**: Hooks for constraints, not prompt instructions.

**Anti-patterns:**

1. **Over-tooling**: Providing 50+ specialized tools doesn't increase capability — it increases context noise and decision complexity.
2. **Relying on prompt instructions for safety**: "Act as a safe agent" is probabilistic. Hooks are deterministic.
3. **No session continuity strategy**: Agents that don't externalize progress state are limited to single-context tasks.
4. **Static harness for evolving models**: Model capabilities change with each release. What required complex pipelines in 2024 may be handled by a single prompt in 2026. Harnesses need to shrink as models grow.

### Enterprise Context: Agent Governance

At enterprise scale (12+ agents, per industry data), the harness becomes a governance layer rather than just an execution layer.

CNCF's Four Pillars of agent governance (DEV.to / htekdev):
1. **Golden Paths**: Pre-approved configurations teams inherit
2. **Guardrails**: Hard policy enforcement (cost ceilings, duration limits, blocked output patterns, tool allowlists)
3. **Safety Nets**: Automated recovery (retries, fallbacks)
4. **Manual Review**: Human approval gates for high-stakes decisions

The situation mirrors microservice sprawl leading to service meshes: agent sprawl necessitates harnesses. 73% of enterprises have deployed AI agents, but only 27% connect them to their infrastructure stack — "shadow agents" accumulating technical debt.

## Open Questions

1. **Harness lifecycle vs. model capability**: As models become more capable (reasoning, longer context, better tool use), the optimal harness structure changes. How do you build a harness that's deliberately designed to simplify as model capabilities improve?

2. **Harness standardization**: Will there be a standard harness interface (like Kubernetes for containers), or will harnesses remain fragmented by provider (Anthropic Agent SDK, LangGraph, OpenAI Agents SDK)?

3. **Skills + Harness interaction**: The SkillsBench finding that Codex CLI ignores Skills while Claude Code uses them suggests harness architecture fundamentally determines augmentation effectiveness. What architectural properties of Claude Code cause better Skills utilization?

4. **Observability standards**: OTel exists for infrastructure. What's the equivalent standard for agent execution traces? Is there an emerging schema for harness telemetry?

5. **Harness security**: As harnesses mediate all tool calls, they're a high-value attack target. The "Rules File Backdoor" attack (prompt injection via AGENTS.md) targets the harness layer. How should harnesses implement prompt injection defenses?

## Extracted Principles

Principles distilled from this research and added to `principles/agent-task-orchestration.md`:

- **Harness Selection Determines Augmentation Effectiveness** — Harness architecture mediates whether context augmentation (Skills, context files, tool definitions) is utilized at all. Test augmentation strategies across harnesses before concluding they work or don't.
- **Fewer General-Purpose Tools Over Many Specialized Tools** — Reducing tool surface area concentrates capability, reduces context noise, and consistently improves accuracy (Vercel: 80%→100% accuracy, 37% fewer tokens, 3.5x faster with 15→2 tools).
- **Externalize Session State for Long-Running Agents** — Agents working across multiple sessions must leave behind clear, externally legible artifacts (TODO.md, progress files) that allow cold-start rehydration. In-context memory alone fails for multi-session tasks.
- **Harness Must Evolve With Models** — Harnesses built for 2024 models may over-engineer solutions for 2026 models. Periodically audit and remove structural scaffolding that models no longer need.

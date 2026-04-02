# Perplexity Orchestration

## Summary

Principles for using Perplexity as part of a larger research or agent system. The core pattern is to choose the Perplexity surface by orchestration boundary, tighten retrieval before increasing reasoning depth, and preserve source provenance outside the final answer text.

## Principles

### Choose the Surface by Orchestration Boundary
- **What:** Use Search API when your system owns planning and synthesis, Sonar when you need a grounded answer with citations, Agent API or deep-research when Perplexity should own multi-step research orchestration, Spaces for human workspaces, and MCP when another agent should call Perplexity as a tool.
- **Why:** Each surface trades control for convenience. Using the wrong one either duplicates work you should own or hides evidence you need to inspect.
- **When:** At the start of every Perplexity integration. Revisit when the latency budget, audit requirements, or human workflow changes.
- **Source:** [research/2026-03-14-look-into-perplexity-orchestration.md](../research/2026-03-14-look-into-perplexity-orchestration.md)

### Constrain Retrieval Before Escalating Reasoning Depth
- **What:** Tighten query scope with domain, date, academic, location, and page-token controls before moving from fast-search to pro-search or deep-research.
- **Why:** Search quality and cost are often more sensitive to retrieval scope than to reasoning depth. High-effort presets add latency and consume scarcer throughput.
- **When:** Before enabling deeper presets or wider context settings. If a result is weak, inspect retrieval scope first.
- **Source:** [research/2026-03-14-look-into-perplexity-orchestration.md](../research/2026-03-14-look-into-perplexity-orchestration.md)

### Treat Deep Research as Async Workflow, Not Chat Turn
- **What:** Run deep-research style jobs as background tasks with explicit job state, polling or callbacks, and persisted artifacts.
- **Why:** Deep research is optimized for multiple search rounds and long synthesis, not low-latency chat. Forcing it into an interactive turn hurts UX and throughput.
- **When:** Any workflow that produces reports, comparative research, or other long-form outputs. Keep interactive turns on Sonar or lighter search surfaces.
- **Source:** [research/2026-03-14-look-into-perplexity-orchestration.md](../research/2026-03-14-look-into-perplexity-orchestration.md)

### Persist Provenance as First-Class Output
- **What:** Store `search_results`, citations, normalized inputs, and cost/latency metadata alongside the final answer.
- **Why:** Text-only answers are lossy. Production workflows need provenance for caching, evaluation, debugging, auditing, and human review.
- **When:** Any non-trivial Perplexity integration, especially research pipelines, compliance-sensitive systems, and agent routers that may retry or compare providers.
- **Source:** [research/2026-03-14-look-into-perplexity-orchestration.md](../research/2026-03-14-look-into-perplexity-orchestration.md)

## Revision History
- 2026-03-14: Initial extraction from [research/2026-03-14-look-into-perplexity-orchestration.md](../research/2026-03-14-look-into-perplexity-orchestration.md).

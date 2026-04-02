---
date: 2026-03-14
topic: Look into perplexity orchestration
status: complete
tags: []
---

# Look into perplexity orchestration

## Context
This was investigated because the task description was exactly "Look into perplexity orchestration". The repo already had adjacent material, but not a dedicated session on Perplexity itself: `research/2026-02-23-conversational-search-to-sql-vector-reranking.md` summarized Perplexity as a multi-stage conversational search system, and `principles/agent-task-orchestration.md` plus `principles/agent-orchestration.md` already covered general orchestration patterns. The principles DB had no match for "Look into perplexity", and the prior-research DB query failed with a malformed JSON error, so I verified existing repo content manually before starting fresh web research.

The useful scope here is not "how Perplexity works in the abstract", but "how to use Perplexity's current product and API surfaces as orchestration building blocks in a larger research or agent system".

## Findings

### 1. "Perplexity orchestration" is now a stack of layers, not one feature
Perplexity's current platform is split into multiple orchestration layers, each with a different control boundary. The official guides now distinguish at least five relevant surfaces:

1. `Search API`, raw ranked web results, when your app owns planning, reranking, and synthesis ([Search Guide](https://docs.perplexity.ai/guides/search-guide), [Introducing the Search API](https://www.perplexity.ai/api-platform/resources/introducing-the-search-api)).
2. `Sonar API`, grounded answers with citations, when Perplexity should own retrieval plus answer synthesis for an interactive turn ([Sonar API](https://docs.perplexity.ai/guides/sonar-api)).
3. `Agent API` / Responses API presets, when Perplexity should orchestrate multi-step search and tool use, potentially across Perplexity and third-party reasoning models ([Agentic Search](https://docs.perplexity.ai/guides/agentic-search), [Presets](https://docs.perplexity.ai/guides/presets)).
4. Product-level `Research Mode`, when a human wants Perplexity's own long-form research workflow rather than a programmable API call ([Research Mode](https://www.perplexity.ai/hub/getting-started/using-pplx-api-research-mode)).
5. `Spaces` and the official `MCP server`, when you need a persistent workspace for humans or a tool surface for another agent harness ([Spaces](https://www.perplexity.ai/help-center/en/articles/10354919-spaces), [MCP Server](https://docs.perplexity.ai/guides/mcp-server)).

This layering matches the way Perplexity's underlying system is described in architecture writeups: query understanding and classification, web retrieval, reranking, synthesis, and conversation-state handling are distinct stages, not one monolithic model call ([How Perplexity Built an AI Google](https://blog.bytebytego.com/p/how-perplexity-built-an-ai-google), [Behind Perplexity's Architecture](https://www.frugaltesting.com/blog/behind-perplexitys-architecture-how-ai-search-handles-real-time-web-data)). The practical implication is important: "use Perplexity" is too vague to be a design decision. You have to choose which part of the stack you want Perplexity to own.

### 2. The right abstraction boundary is the main decision
The most useful decision framework is: pick the surface based on who owns orchestration.

| Surface | What Perplexity owns | What you own | Best fit | Main trade-off |
|---|---|---|---|---|
| Search API | Web retrieval and ranking | Query planning, dedupe, synthesis, evals | Custom agent pipelines, compliance workflows, secondary reranking | Maximum control, maximum engineering work |
| Sonar API | Retrieval + grounded answer generation | App state, routing, UI, post-processing | Interactive question answering with citations | Easy to ship, less raw control |
| Pro Search via Sonar | Multiple search rounds and deeper synthesis | Streaming UX and surrounding workflow | Harder interactive queries | Better quality, more latency, streaming-only |
| Agent API / presets | Search planning, multi-step execution, tool orchestration, optional third-party reasoning | Job control, artifact storage, async orchestration | Research pipelines and deeper agent tasks | Highest abstraction, lowest transparency |
| Research Mode | Full end-user research workflow | None, beyond human prompt framing | Human exploratory work | Convenient, but not programmable enough for system design |
| Spaces / MCP | Workspace state or external tool surface | Lifecycle, permissions, downstream system behavior | Human teams or external agent harnesses | Useful adjunct, not a replacement for your own state model |

Perplexity's own docs are explicit about this boundary. The Search guide says to use Search API when you need "raw, relevant web search results rather than grounded responses", and the Sonar guide says to use Sonar when you want a lightweight, affordable, web-grounded answer service ([Search Guide](https://docs.perplexity.ai/guides/search-guide), [Sonar API](https://docs.perplexity.ai/guides/sonar-api)). The newer Responses/Agent API goes one level higher again: the Presets page defines `fast-search`, `pro-search`, `deep-research`, and `advanced-research` as ready-made orchestration profiles with increasing search passes and reasoning depth ([Presets](https://docs.perplexity.ai/guides/presets)).

Recommendation: if you cannot explain why you need raw search results, start at Sonar. If you cannot explain why you need Perplexity to own multi-step planning, do not jump straight to Agent API or deep research. This follows the same "start simple, earn complexity" pattern already established elsewhere in this repo.

### 3. Current best practice is to separate interactive lookup, grounded answer, and deep research
Perplexity's current product and API surface strongly suggest a three-lane architecture:

#### Lane A: Retrieval lane
Use `Search API` when your system needs raw evidence objects, not prose. This is the right lane for:
- custom reranking
- domain-specific extractors
- audit-heavy pipelines
- cacheable search stages
- feeding a second model or evaluator

The Search guide recommends writing specific queries, increasing result breadth only when needed, and using async patterns for large batches ([Search Guide](https://docs.perplexity.ai/guides/search-guide)). The official search resources also emphasize that the search layer now stands alone as a first-class product, which is a signal that Perplexity expects advanced users to build their own orchestration above it ([Introducing the Search API](https://www.perplexity.ai/api-platform/resources/introducing-the-search-api)).

#### Lane B: Grounded answer lane
Use `Sonar` or `Sonar Pro` when the user wants an answer now and citations matter more than raw retrieval control. Sonar is the shortest path from question to grounded response. `Pro Search` adds deeper search orchestration, but the guide explicitly notes that Pro Search responses are streaming-only, which matters for UI and backend design ([Pro Search](https://docs.perplexity.ai/guides/pro-search)).

This lane is the default for chat products, support experiences, and internal assistants. It is not the right lane when you need deterministic evidence handling, because the answer format is already a synthesis product.

#### Lane C: Research lane
Use `deep-research` or `advanced-research` when you want Perplexity to behave more like an autonomous research subsystem. The Presets page now describes these modes as multiple rounds of search, query rewriting, cross-source reasoning, and deep synthesis, with `advanced-research` adding third-party reasoning models via Search-augmented Reasoning ([Presets](https://docs.perplexity.ai/guides/presets), [Agentic Search](https://docs.perplexity.ai/guides/agentic-search)).

This lane should be treated as a background job, not a chat turn. The official rate-limits guide shows that deeper research models have materially lower throughput ceilings than simpler search surfaces, and the changelog added asynchronous support for Sonar Deep Research, which is exactly what you would expect for long-running research workloads ([Rate Limits and Usage Tiers](https://docs.perplexity.ai/guides/rate-limits-and-tiers), [Changelog](https://docs.perplexity.ai/changelog)).

### 4. Retrieval constraints matter more than "turning up the model"
The strongest recurring theme across Perplexity docs is that retrieval controls are often the highest-leverage tuning surface.

Useful controls include:
- specific queries instead of vague prompts ([Search Guide](https://docs.perplexity.ai/guides/search-guide))
- `search_domain_filter` when the trusted corpus is known ([Search Guide](https://docs.perplexity.ai/guides/search-guide))
- date filters when freshness matters ([Search Mode Guide](https://docs.perplexity.ai/guides/search-mode-guide))
- `search_mode=academic` when evidence quality matters more than general-web breadth ([Search Mode Guide](https://docs.perplexity.ai/guides/search-mode-guide))
- geographic controls such as `country` when the answer should reflect local reality ([Search Mode Guide](https://docs.perplexity.ai/guides/search-mode-guide))
- `max_tokens_per_page` and bounded context size when you need cost and latency discipline ([Search Guide](https://docs.perplexity.ai/guides/search-guide), [Changelog](https://docs.perplexity.ai/changelog))

The changelog is especially useful here. Perplexity changed the default `search_context_size` to `low` in January 2026, which is a strong platform-level signal that smaller retrieval windows are often the right default unless proven otherwise ([Changelog](https://docs.perplexity.ai/changelog)). The search-mode docs also note that the search classifier can be disabled when every query is guaranteed to be web-searchable, but this is not presented as a cost or performance optimization, only as a determinism/control choice ([Search Mode Guide](https://docs.perplexity.ai/guides/search-mode-guide)).

Recommendation: tune retrieval first, then escalate from `fast-search` to `pro-search` to `deep-research`. If you invert that order, you pay more for a badly scoped search problem.

### 5. Product features are useful, but they are not your orchestration state model
`Spaces` and `Research Mode` are useful, but they solve different problems than API orchestration.

Perplexity's help-center doc describes Spaces as collaborative workspaces with custom AI instructions plus comprehensive web and file search. That makes Spaces a good human-in-the-loop memory layer, especially when a team wants shared instructions and attached documents ([Spaces](https://www.perplexity.ai/help-center/en/articles/10354919-spaces)). But Spaces are not a substitute for explicit application state such as task queues, artifact stores, cache keys, or evaluation traces.

Likewise, Research Mode is clearly optimized for end-user exploration. Perplexity says it performs dozens of searches, reads hundreds of sources, reasons about the material, and then writes a report. The same page also says users cannot manually choose which model powers Research Mode because the system combines models internally ([Research Mode](https://www.perplexity.ai/hub/getting-started/using-pplx-api-research-mode)). That is excellent for human convenience and poor for engineering control.

Recommendation:
- Use Research Mode for manual exploration and source discovery.
- Use Spaces when humans need a shared workspace with instructions and files.
- Use APIs for anything that needs routing logic, durability, monitoring, retries, or evaluation.

### 6. The official MCP server is a real integration surface now
The official MCP server is an important change because it turns Perplexity into a tool provider for other agents rather than only a standalone product or direct API dependency. The MCP guide lists tools such as `perplexity_search`, `perplexity_ask`, `perplexity_reason`, and `perplexity_research`, which mirror the layered model above ([MCP Server](https://docs.perplexity.ai/guides/mcp-server)).

This is useful when:
- Claude Code, Codex, or another harness should call Perplexity as a specialist tool
- you want tool-level guardrails outside the Perplexity product UI
- you want a router agent to decide when to spend a Perplexity call versus another provider call

It is less useful when your application already owns direct API orchestration and does not need MCP as an abstraction layer. In that case, MCP can add indirection without adding value.

### 7. Recommended orchestration pattern
For most production systems, the safest pattern is a thin router in front of Perplexity, not blind delegation.

#### Recommended flow
1. Classify the task: raw evidence lookup, grounded answer, or deep report.
2. Route to `Search API`, `Sonar`, or `Agent API` accordingly.
3. Persist artifacts, especially raw `search_results`, citations, normalized query/filter inputs, latency, and cost metadata.
4. Run your own evaluator or verifier on a sample of outputs.
5. Cache at the retrieval layer when possible.
6. Escalate to deeper presets only when the earlier lane fails quality checks.

#### Illustrative routing pseudo-code
```ts
type SearchIntent = "raw-evidence" | "grounded-answer" | "deep-report";

function choosePerplexitySurface(input: {
  intent: SearchIntent;
  latencyBudgetMs: number;
  needsCustomRanking: boolean;
}) {
  if (input.intent === "raw-evidence" || input.needsCustomRanking) {
    return { surface: "search-api", async: false };
  }

  if (input.intent === "grounded-answer" && input.latencyBudgetMs <= 10000) {
    return { surface: "sonar", mode: "standard-or-pro", async: false };
  }

  return { surface: "agent-api", preset: "deep-research", async: true };
}
```

#### Artifact model worth persisting
```ts
type PerplexityArtifact = {
  taskId: string;
  surface: "search-api" | "sonar" | "agent-api";
  normalizedQuery: string;
  filters: Record<string, unknown>;
  searchResults: unknown[];
  citations: string[];
  answerText: string;
  cost?: unknown;
  latencyMs: number;
};
```

This artifact-first design matters because Perplexity's changelog now calls out the `search_results` field and more detailed cost information. That is a clear signal that platform observability is becoming part of the intended integration model, not an afterthought ([Changelog](https://docs.perplexity.ai/changelog)).

### 8. Concrete recommendations

#### For agentic coding or research harnesses
- Treat Perplexity as a specialist research subsystem, not your whole orchestration framework.
- Prefer the official MCP server when another agent should invoke Perplexity as a tool.
- Keep your own job IDs, retries, caching, and evaluation traces outside Perplexity.

#### For product search or answer experiences
- Start with Sonar for grounded Q&A.
- Introduce Search API only when you need custom ranking, secondary extraction, or explicit source auditing.
- Keep Pro Search or deeper presets behind a quality gate, not as the default for every request.

#### For background research pipelines
- Use async patterns for deep research jobs.
- Persist source artifacts, not just the report text.
- Record which preset, filters, and search mode were used so you can compare quality later.

#### For evidence-sensitive domains
- Use domain filters and academic/date filters aggressively.
- Do not accept text-only summaries as your source of truth.
- Store the provenance graph (`search_results`, citations, URLs, timestamps) for downstream review.

### 9. Emerging trends worth watching
Several recent changes point to where Perplexity is going:

- Platform unbundling: retrieval-only, grounded-answer, and deep-research surfaces are now explicit products, which makes composition easier ([Search Guide](https://docs.perplexity.ai/guides/search-guide), [Sonar API](https://docs.perplexity.ai/guides/sonar-api), [Presets](https://docs.perplexity.ai/guides/presets)).
- Research as background workflow: async deep research support suggests Perplexity expects longer-running orchestration outside interactive chat ([Changelog](https://docs.perplexity.ai/changelog)).
- Better observability: detailed cost info and `search_results` indicate a move toward more inspectable system integration ([Changelog](https://docs.perplexity.ai/changelog)).
- Search specialization: academic and other search modes imply verticalized retrieval rather than one generic web mode ([Search Mode Guide](https://docs.perplexity.ai/guides/search-mode-guide)).
- Tool ecosystem expansion: the official MCP server makes Perplexity easier to plug into multi-agent harnesses without custom wrappers ([MCP Server](https://docs.perplexity.ai/guides/mcp-server)).

Overall recommendation: design around the boundary, not the brand. Perplexity is strongest when you use the specific layer that matches your control needs, and weakest when you expect one interface to serve retrieval, interactive Q&A, long-form research, and system state management all at once.

## Open Questions
- How stable are quality differences between `pro-search`, `deep-research`, and `advanced-research` across concrete enterprise tasks such as SEC analysis, scientific literature review, and software-architecture research?
- How much determinism can be recovered by combining Search API with an external verifier, compared with delegating to Sonar or Agent API directly?
- How deeply do Spaces index attached files, and what are the practical size, freshness, and retrieval-quality limits for team-scale workspaces?
- What evaluation harness gives the best signal for Perplexity-specific regressions, retrieval recall tests, citation faithfulness tests, or end-to-end task completion?

## Extracted Principles
- Created [../principles/perplexity-orchestration.md](../principles/perplexity-orchestration.md).
- Principle: choose the Perplexity surface by orchestration boundary.
- Principle: constrain retrieval before escalating reasoning depth.
- Principle: treat deep research as an async workflow, not a chat turn.
- Principle: persist provenance as a first-class artifact.

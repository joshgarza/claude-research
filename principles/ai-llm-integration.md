# AI/LLM Integration

## Summary

Principles for integrating LLMs into production applications. Covers architecture selection, SDK usage, context management, tool design, evaluation, cost optimization, safety, and observability. Synthesized from Anthropic's engineering guides, Vercel AI SDK patterns, LangChain ecosystem, and industry practice as of early 2026.

## Principles

### Start Simple, Earn Complexity
- **What:** Progress through direct API calls → SDK helpers → workflows → agents. Each layer of abstraction must demonstrate measurable improvement before adoption.
- **Why:** The most successful production implementations use simple, composable patterns. Complex frameworks add overhead, debugging difficulty, and vendor lock-in without guaranteed quality improvement.
- **When:** Always start here. Only add orchestration (LangGraph, multi-agent) when you've proven simple approaches insufficient through evaluation.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Anthropic "Building Effective Agents," LangChain survey)

### Schema-First Development
- **What:** Define Zod (TypeScript) or Pydantic (Python) schemas before writing prompts. Derive types, validation, structured output, and tool parameters from the same schema source.
- **Why:** Eliminates parsing errors (95% reduction with `generateObject` vs JSON extraction). Single source of truth for the entire data flow. Strict mode is now the production default; JSON Mode is legacy.
- **When:** Every LLM integration that produces structured data. Start with flat schemas, add nesting incrementally — deeply nested schemas cause hard-to-debug validation errors.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Vercel AI SDK 6, Vellum structured output guide)

### Context Engineering Over Prompt Engineering
- **What:** For multi-turn agents, manage the full context state — system prompts, tools, MCP, message history, external data, memory — not just individual prompt text. Find the smallest set of high-signal tokens that maximize desired outcomes.
- **Why:** As agents run over hours/days, the prompt is a small fraction of what determines behavior. Context compaction, structured note-taking, sub-agent delegation, and just-in-time retrieval all matter more than prompt wordsmithing.
- **When:** Any agent or multi-turn system. For single-shot generation, traditional prompt engineering is sufficient.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Anthropic "Effective Context Engineering," September 2025)

### The Dumb Zone: Manage Context Proactively
- **What:** LLM reasoning quality degrades significantly around 40% of context window utilization. Treat this threshold as a hard ceiling — compact context before reaching it, not after quality has degraded.
- **Why:** Context is the only lever in a stateless LLM system. Once in the dumb zone, even good prompts produce lower-quality, incoherent output. Reactive correction loops (telling the agent it made a mistake) make things worse by adding more tokens.
- **When:** Any long-running agent session, especially coding agents working in complex codebases. Common causes of premature degradation: unfiltered JSON/log dumps, repetitive correction loops, irrelevant file reads, verbose chat history.
- **Source:** research/2026-03-07-look-into-this-video-on-ai-engineering-https-youtu-be-rmvdxxnubig-si-j5g-dqftekbqpmhf.md (Dex Horthy, HumanLayer, AI Engineer 2025)

### RPI Workflow for Complex Codebases
- **What:** Structure AI-assisted development in brownfield codebases as three sequential phases: Research (understand, don't implement; produce compressed markdown summary), Plan (detailed spec with file names, line numbers, test criteria; human-reviewed), Implement (execute mechanically with fresh context window, compact progress back into plan).
- **Why:** Naive "chat and correct" patterns create rework cycles and technical debt in complex codebases (Stanford 100K developer study). RPI prevents agents from implementing before they understand, and enables human review at the highest-leverage point (the plan) rather than after thousands of lines are written. Proven: 300K-line Rust codebase bugs fixed in ~1 hour, 35K lines shipped in 7 hours.
- **When:** Scale application by task complexity: direct conversation for simple bugs/UI tweaks; light plan for small features; research + plan for cross-repository changes; full RPI + subagents for deep refactors. Not every task needs full RPI.
- **Source:** research/2026-03-07-look-into-this-video-on-ai-engineering-https-youtu-be-rmvdxxnubig-si-j5g-dqftekbqpmhf.md (Dex Horthy, HumanLayer)

### Intentional Compaction: Compress Before Context Exhausts
- **What:** Before context approaches capacity, pause and consolidate accumulated knowledge into a structured artifact (goals, completed steps, key findings, current obstacles, next steps). Seed the next session from this document, not raw history. Use git commits as natural compaction boundaries.
- **Why:** Context window limits are a manageable soft constraint, not a hard ceiling, if compaction is proactive. Multi-day problems can be solved without quality degradation when each session starts from a high-quality compressed state. Reactive compaction (after quality degrades) is too late.
- **When:** Any agent session expected to exceed a single context window. Use subagents for scoped search/discovery tasks to prevent the main agent's context from being consumed by file exploration.
- **Source:** research/2026-03-07-look-into-this-video-on-ai-engineering-https-youtu-be-rmvdxxnubig-si-j5g-dqftekbqpmhf.md (Dex Horthy, HumanLayer)

### Review at the Plan, Not the Code
- **What:** Concentrate human review effort on research documents and implementation plans, not on generated code. A bad plan produces hundreds of bad lines; a bad line of code is localized. Reviewing a 200-line plan is higher-leverage than reviewing a 2,000-line PR.
- **Why:** As AI authorship of code increases, traditional line-by-line code review scales poorly. Research and plan artifacts are also essential for team mental alignment — they keep engineers architecturally coherent even when they did not write the implementation. Treating specs as primary artifacts shifts the SDLC to match AI-first development.
- **When:** Any team where AI generates a significant share of implementation code. Requires changing PR review culture: focus on architectural correctness of the plan, not syntactic correctness of the code.
- **Source:** research/2026-03-07-look-into-this-video-on-ai-engineering-https-youtu-be-rmvdxxnubig-si-j5g-dqftekbqpmhf.md (Dex Horthy, HumanLayer; Blake Smith's mental alignment framework)

### Design Tools as Agent UX
- **What:** Agent tools are not API wrappers. Combine frequently-chained operations into single calls. Descriptions are prompts — iterate them based on eval results. Return high-signal data, implement pagination/truncation, make errors actionable.
- **Why:** Agents perceive different affordances than humans. A well-designed tool interface provides guardrails while giving flexibility. Poor tool design is the #1 cause of agent failure in production.
- **When:** Any tool/function exposed to an LLM agent. Apply the "confused new hire" test: if a new team member couldn't use the tool correctly from its description alone, the agent won't either.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Anthropic "Writing Tools for Agents")

### Evaluate Everything, Continuously
- **What:** Implement three tiers of evaluation: (1) unit-level prompt evals with LLM-as-judge, (2) component-level RAG/tool evals, (3) end-to-end agent task completion. Run regression tests on every prompt/tool change before deployment. Integrate into CI/CD with failure thresholds.
- **Why:** Quality is the #1 production barrier (32% cite it). Only 52% of teams have adopted evals. Under-investment in evaluation is the most common failure mode for LLM applications.
- **When:** From day one. Start with simple assertions, graduate to LLM-as-judge. Use Braintrust for experiment-driven teams, LangSmith for LangChain teams, DeepEval for pytest-style integration.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Braintrust, LangChain survey, DeepEval)

### Cache at Multiple Layers
- **What:** Implement semantic caching (vector similarity for similar requests, 100% savings on hit), provider prefix caching (50-90% savings on long prompts), and application-level response caching. Combined savings: 60-80%.
- **Why:** LLM inference is expensive and often repetitive. Semantic cache hit rates of 60-85% are common in support/FAQ/docs workloads. Prefix caching is essentially free (Anthropic/OpenAI provide it automatically).
- **When:** Any production system with recurring query patterns. Semantic caching needs a vector store; prefix caching works automatically with supported providers. Set similarity threshold ~0.8 for semantic cache.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Anthropic prefix caching, RouteLLM, GPTCache)

### Stream by Default
- **What:** Use SSE (Server-Sent Events) for all user-facing LLM responses. Show tokens as they arrive. Reserve non-streaming for structured data generation and background processing.
- **Why:** Streaming is now the UX baseline. Non-streaming feels broken to users. SSE is lightweight, works over standard HTTP, and Vercel AI SDK abstracts provider differences.
- **When:** All user-facing text generation. Don't stream when: generating JSON objects that need complete validation, running batch background jobs, or performing summarization where partial results aren't useful.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Vercel AI SDK, SSE patterns)

### Layer Guardrails by Cost
- **What:** Apply fast deterministic checks first (format validation, length limits), medium-cost classifiers next (injection detection, topic boundaries), expensive LLM-based checks last (faithfulness, hallucination). Target <200ms total overhead for interactive systems.
- **Why:** Not all safety checks are equal in cost or latency. Layering lets you catch 90% of issues cheaply and only invoke expensive checks when needed. Above 200ms added latency, users notice.
- **When:** Any user-facing LLM application. Use LLM Guard (open-source) for broad coverage, or build custom with Zod validation + regex + classifier pipeline.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (Datadog, LLM Guard, Openlayer)

### Route Across Models
- **What:** Use multiple models in production. Route by intent/complexity: small models for simple tasks, frontier models for hard ones. Use RouteLLM or custom classifiers. Maintain a unified provider interface (Vercel AI SDK, LiteLLM).
- **Why:** 37% of enterprises use 5+ models. Single-model strategies waste money on simple queries and underperform on complex ones. RouteLLM achieves 85% cost reduction at 95% quality retention.
- **When:** Once cost or latency becomes a concern. Start with one model, add routing based on measured quality/cost data. Track per-model metrics continuously.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (RouteLLM ICLR 2025, LangChain survey)

### Observe and Close the Loop
- **What:** Instrument every LLM call with traces, latency, token usage, cost, and quality scores. Automatically evaluate sampled production traffic with LLM-as-judge. Use observability data to feed back into evaluation and prompt improvement.
- **Why:** 89% of teams with production agents have observability. Without it, you're blind to regressions, cost spikes, and quality degradation. The observability → evaluation → improvement loop is what separates production-grade systems from prototypes.
- **When:** From first deployment. Start with Langfuse (open-source) or Helicone. Add Braintrust or LangSmith for integrated evaluation. Use OpenTelemetry for vendor-neutral tracing.
- **Source:** research/2026-02-14-ai-llm-integration-practices.md (LangChain survey, Braintrust, Langfuse)

## Revision History
- 2026-02-14: Initial extraction from AI/LLM integration research session.
- 2026-03-07: Added 4 new principles (Dumb Zone, RPI Workflow, Intentional Compaction, Review at the Plan) from Dex Horthy / HumanLayer "No Vibes Allowed" AI Engineer 2025 talk.

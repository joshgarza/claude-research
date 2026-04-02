---
date: 2026-03-14
type: daily-digest
period: 2026-03-13 to 2026-03-14
files: 8
---

# Daily Research Digest — 2026-03-14

## Summary
Recent research concentrated on a consistent theme: good systems come from choosing the right control boundary, keeping context or scope tight, and externalizing state instead of relying on implicit behavior. The topics ranged from AI engineering workflows and local agent harnesses to crawler APIs, architecture patterns, knowledge-base automation, and a highly practical local donation decision, but most converged on the same operational advice: start narrow, make boundaries explicit, and only add autonomy when verification and control are in place.

## Topics

### AI Engineering Workflow for Complex Codebases
The Dex Horthy talk held up under scrutiny, but as a workflow argument rather than a prompting trick. The durable lesson is to separate research, plan, and implementation so the model works from compressed, high-signal artifacts instead of bloated chat history. Human review is most valuable at the research and plan stages, before a large diff exists, and long-running work needs external artifacts such as plans, progress files, and verification steps rather than ever-growing conversation context.

The most defensible claims are about context hygiene, review placement, and verification. Exact heuristics such as a specific token threshold are not universal, but the direction is well supported: quality degrades before hard context limits, brownfield productivity is workflow-dependent, and subagents are most useful when they isolate exploratory token spend rather than act as magical specialists.
- **Key takeaway:** Treat AI engineering as artifact design and context control, not prompt cleverness.
- **Source:** [2026-03-13-ai-engineering-video.md]

### Open Source Agentic Harnesses for Local Development
The local harness landscape has split into terminal-first, IDE-first, sandbox-first, and cross-surface tools, and the real choice is about interface, isolation, permissions, and verification, not model branding. Aider is strong for terminal pair programming and automatic test closure, OpenCode is stronger for repo-local rules and permissioned harness behavior, Cline and Roo suit IDE-centric users who can manage trust carefully, OpenHands fits delegated work in a real sandbox, and Continue stands out when repo-defined checks matter as much as interactive use.

Across tools, the strongest shared pattern is to put workflow artifacts in the repo, keep context lean, and automate verification. As autonomy rises, isolation must rise with it. MCP support is now common enough that it no longer differentiates tools by itself.
- **Key takeaway:** Pick a harness by human control loop and isolation model, then insist on repo-local workflow artifacts and automatic verification.
- **Source:** [2026-03-13-agentic-harnesses-local-development.md]

### Cloudflare `/crawl` for Site Crawling
Cloudflare’s new `/crawl` endpoint is best understood as a bounded managed crawl job, not a full crawler platform. It starts from a URL, discovers pages via links and/or sitemaps, respects `robots.txt`, supports async polling and pagination, and returns extracted content records. It is a good fit for “crawl this site or section now and give me artifacts,” but not for owning a long-lived crawl frontier, cross-domain orchestration, or stealth scraping.

The operational advice is clear: always set explicit bounds such as `limit`, `depth`, `source`, and path filters; default to `render: false`; use incremental controls like `modifiedSince`; and persist results quickly because Cloudflare is the execution layer, not the durable store. `/scrape` remains the better primitive when URLs are already known.
- **Key takeaway:** Use `/crawl` as an async, bounded crawl primitive with explicit limits and external persistence, not as your crawler control plane.
- **Source:** [2026-03-14-cloudflare-crawl-api.md]

### ETERM Legacy Retirement and Migration
“Eyterm” appears to map to the TravelSky ETERM ecosystem, and the central fact is that legacy black-screen ETERM was retired on December 25, 2025 and replaced by `共翔天易`. That makes ETERM a legacy migration and continuity problem, not a new-adoption target. The interesting operational story is how TravelSky handled the transition through service portals, identity workflows, training, support tooling, and phased deprecation rather than a single UI swap.

The key migration lesson is that legacy terminal replacement is mostly about preserving expert workflows, support paths, and operator readiness. Official TravelSky surfaces should be the default path, while third-party tools now look more like compatibility shims than strategic targets.
- **Key takeaway:** Treat ETERM-related work as legacy workflow migration, with identity, training, and support readiness taking priority over UI replacement.
- **Source:** [2026-03-14-eyterm-eterm.md]

### Hexagonal Architecture
Hexagonal architecture is still best understood in Cockburn’s original sense: explicit inside/outside separation, with the core speaking application language through ports and adapters translating at the edges. The pattern is strongest when business rules matter, multiple entry points or integrations exist, infrastructure is likely to change, or modernization requires clean seams. It is weak when the system is just thin CRUD over one data store.

Current best practice is to keep the core framework-free, define ports in domain language rather than technology language, separate primary and secondary adapters, wire dependencies in a composition root, and test the core first. The main failure modes are fake abstraction, over-porting, and boundary erosion, which increasingly should be prevented with automated boundary checks rather than code review alone.
- **Key takeaway:** Use hexagonal architecture when you need durable domain boundaries and multiple edges, but keep ports few, domain-shaped, and automatically enforced.
- **Source:** [2026-03-14-hexagonal-architecture.md]

### Perplexity as an Orchestration Layer
Perplexity now exposes several distinct control boundaries: raw Search API, grounded-answer Sonar, deeper Pro Search, Agent API presets, Research Mode, Spaces, and an official MCP server. The main design decision is which layer Perplexity should own. If you need raw evidence and custom orchestration, use Search API. If you need grounded answers with citations, start with Sonar. If you need long-form research, treat deep research as an async background workflow rather than a chat turn.

The practical recommendation is to route tasks by intent, persist provenance such as search results and citations, constrain retrieval before increasing reasoning depth, and keep external job control, caching, retries, and evaluation outside Perplexity. Spaces and Research Mode are useful adjuncts, not substitutes for system state.
- **Key takeaway:** Choose the Perplexity surface by orchestration boundary, and tune retrieval before paying for deeper reasoning.
- **Source:** [2026-03-14-perplexity-orchestration.md]

### Donating a Non-Functional Motorcycle in the Bay Area
The motorcycle donation research resolved into a practical checklist rather than a broad market survey. For a non-running bike on Treasure Island, the real gates are clear title, towability, completeness, and pickup access. The strongest first options are Habitat for Humanity Greater San Francisco Bay Area, Immigration Institute of the Bay Area, and KALW, with Habitat East Bay/Silicon Valley and BACS as strong backups depending on cause preference and condition fit.

The most important practical advice is to confirm Moto Guild release logistics, disclose the bike’s true condition up front, and file California’s Notice of Transfer and Release of Liability within five days after pickup. Tax expectations should stay modest because most of these programs are resale pipelines, so convenience and cause fit matter more than maximizing a deduction.
- **Key takeaway:** For a non-running motorcycle donation, solve title and pickup logistics first, then choose the charity by mission fit and processor acceptance rules.
- **Source:** [2026-03-14-donate-nonfunctional-motorcycle.md]

### Obsidian CLI and AI-Driven Workflows
Obsidian now has a real first-party desktop CLI, but it is only one automation surface among several: the `obsidian` desktop CLI, the `ob` headless client, URI schemes, the Local REST API plugin, MCP wrappers, and filesystem-native markdown tools. The right question is not whether to use “Obsidian CLI” generically, but which interface matches the trust and automation boundary of the workflow.

For AI-heavy, terminal-first, markdown-centric workflows, the research recommends a layered approach: keep Obsidian as the human interface, start agents with narrow read-heavy tools, add a single append-oriented write path, and delay broad mutation or command execution. MCP wrappers and markdown-native tools likely provide the best long-term fit because they are easier to permission and keep portable.
- **Key takeaway:** Use the narrowest Obsidian interface that matches the task, starting read-only and preserving markdown portability.
- **Source:** [2026-03-14-obsidian-cli-ai-workflows.md]

## Cross-Cutting Themes
A strong boundary-first mindset showed up everywhere: AI workflows, harnesses, Perplexity, Cloudflare crawling, Obsidian automation, and hexagonal architecture all performed best when the system clearly defined what the tool owns versus what the surrounding application or human owns.

Externalized artifacts were another repeated pattern. Plans, repo-local rules, progress files, persisted crawl outputs, provenance records, and markdown knowledge stores all beat implicit state trapped in chat history, UI memory, or vendor-managed systems.

Several topics also reinforced the same safety rule: increase autonomy only alongside tighter constraints. That appeared as permissioning and sandboxing for agent harnesses, explicit crawl bounds for Cloudflare, narrower tool surfaces for Obsidian, retrieval constraints for Perplexity, and composition-root plus boundary enforcement in hexagonal systems.

## Key Takeaways
1. Review and control should move earlier in the workflow, at research, planning, routing, and boundary definition, rather than after large opaque outputs exist.
2. Start with the simplest surface that solves the problem: Sonar before deep research, `/scrape` before `/crawl`, a narrow Obsidian write path before full vault control, and lighter harnesses before fully delegated execution.
3. Managed systems are most reliable when treated as bounded execution layers with your own persistence, observability, and verification wrapped around them.
4. Explicit permissions, isolation, and artifact-backed workflows matter more in practice than nominal model capability.
5. Good architecture still comes down to keeping core logic free of edge details and preventing boundary drift automatically.
6. Migration work is usually socio-technical, not just technical. The ETERM case showed that identity, training, support, and operator continuity matter as much as software replacement.
7. For the motorcycle donation case, logistics and documentation dominate the decision more than finding a charity willing to take “any vehicle.”

## Open Questions
- What lightweight eval suite best predicts whether plan-first AI workflows actually reduce brownfield rework?
- Which local harnesses will prove most durable over the next year in terms of governance, replayability, and maintenance velocity?
- How stable will Cloudflare `/crawl` pricing, limits, and schema remain after beta?
- Which boundary-enforcement tools will become the most effective long-term option for TypeScript-heavy hexagonal codebases?
- How much determinism and auditability can be recovered by pairing Perplexity Search API with external verification compared with delegating deeper orchestration to Perplexity itself?
- For AI note workflows, will the winning interface settle on first-party CLI/headless tooling or on narrower MCP wrappers over markdown and local APIs?
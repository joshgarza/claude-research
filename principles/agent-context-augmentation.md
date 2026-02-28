# Agent Context Augmentation

## Summary

Evidence-based principles for writing and managing context files (CLAUDE.md, AGENTS.md, Skills, .cursorrules) that augment LLM coding agents. Synthesized from 25+ academic papers, 6 industry engineering blogs, and practitioner consensus as of February 2026. The central finding across all sources: focused, human-authored context helps; everything else hurts.

## Principles

### The 150-Line Rule
- **What:** Keep always-present context files (CLAUDE.md, AGENTS.md) under ~150 lines / ~200 discrete instructions.
- **Why:** Frontier models exhibit threshold decay around 150 instructions — maintaining near-perfect compliance, then cliff-dropping. Smaller models degrade earlier via linear or exponential decay. Beyond this threshold, models shift from modification errors to outright instruction omission. Even at 500 instructions, the best models achieve only 68% accuracy.
- **When:** All persistent context files loaded at session start. Does not apply to on-demand context loaded per-task (Skills, RAG chunks). If you need more than 150 lines, split into hierarchical/nested files with progressive disclosure.
- **Source:** arXiv:2507.11538 (instruction capacity study), practitioner consensus (HumanLayer blog), Vercel 8KB compression result.

### Never Auto-Generate Context Files
- **What:** Do not use `claude init`, `codex init`, or similar auto-generation to create context files. Human-author them or don't have them.
- **Why:** LLM-generated context is counterproductive in every study: -0.5% to -2% task success (Evaluating AGENTS.md), -1.3pp average (SkillsBench self-generated Skills), underperforms baseline (SWE Context Bench free selection). Two failure mechanisms: (a) models produce vague, generic guidance rather than precise procedural knowledge, and (b) models cannot identify their own knowledge gaps — they generate confident content in areas where they lack expertise.
- **When:** Always. No exceptions found across any study or practitioner report. RL-evolved skills (SkillRL) are acceptable — but that's fundamentally different from one-shot self-generation.
- **Source:** arXiv:2602.11988, arXiv:2602.12670, arXiv:2602.08316, HN practitioner consensus.

### Context Files Bridge Information Gaps (Only)
- **What:** Context augmentation helps when it provides information the model genuinely lacks — novel APIs, domain-specific procedures, tribal knowledge not inferable from code. It hurts when it duplicates information available elsewhere.
- **Why:** In well-documented repos, context files are redundant noise that increases reasoning cost without improving outcomes. When existing docs were removed, LLM-generated context helped (+2.7%), confirming the files were duplicating available information. The correlation is stark: Healthcare Skills +51.9pp (weak training data) vs Software Engineering Skills +4.5pp (strong training data). Vercel's AGENTS.md achieved +47pp — but specifically for Next.js 16 APIs absent from training data.
- **When:** Before writing any context entry, ask: "Can the model figure this out from the code and existing docs?" If yes, don't add it. Best content: architectural decisions, intentional patterns, non-obvious conventions — information that can't be discovered by reading code.
- **Source:** arXiv:2602.11988 (documentation removal ablation), arXiv:2602.12670 (domain gap correlation), Vercel blog.

### Passive Context for Universal Rules, Skills for Domain Expertise
- **What:** Use always-present context (CLAUDE.md/AGENTS.md) for project-wide constraints. Use on-demand Skills for domain-specific procedural knowledge.
- **Why:** Passive context eliminates the decision point of whether to load information — Vercel showed 100% with always-present docs vs 53% with on-demand Skills (agents didn't invoke Skills 56% of the time). But passive context must stay small to avoid context rot. Domain expertise is too large and task-specific for always-present loading. These are complementary tiers, not competing approaches.
- **When:** Tier 1 (passive): required tooling, hard constraints, conventions that apply to every task. Tier 2 (Skills): specialized domain procedures, API-specific guidance, workflow-specific knowledge. Never mix — keep tiers architecturally separate.
- **Source:** Vercel blog, arXiv:2602.12670, arXiv:2601.04748 (skill scaling limits).

### 2-3 Focused Modules, Never Comprehensive
- **What:** When augmenting agents with on-demand context (Skills, RAG chunks, documentation), use 2-3 focused, detailed modules. Never provide comprehensive documentation or 4+ modules simultaneously.
- **Why:** SkillsBench: 2-3 modules +18.6pp, 4+ modules +5.9pp, comprehensive -2.9pp. Semantic confusability increases with library size — adding one semantically similar skill causes 7-30% accuracy drop. Selection accuracy exhibits a phase transition at ~50-100 skills, then collapses. 204-word oracle summaries outperform 24,765-word full traces.
- **When:** Selecting Skills, RAG chunks, or context modules for a specific task. Also applies to tool selection — Spotify deliberately restricts agent tools because "more tools create more dimensions of unpredictability."
- **Source:** arXiv:2602.12670, arXiv:2601.04748, arXiv:2602.08316, Spotify engineering blog.

### Treat Context Files as Configuration Code
- **What:** Version control context files, require code review for changes, audit for staleness, and track "context debt" — technical debt from unmaintainable agent instructions.
- **Why:** 67% of context files undergo multiple commits (they're living artifacts). Median readability score is 16.6 Flesch (comparable to legal documents). Non-functional requirements (security 14.5%, performance 14.5%, UI/UX 8.7%) are systematically underrepresented while testing (75%) and implementation (70%) are overrepresented. Stale or contradictory instructions compound — progressive instruction addition creates contradictions that degrade performance by 19%.
- **When:** Any project using CLAUDE.md, AGENTS.md, or similar. Assign context file ownership. Review changes in PRs. Periodically audit for staleness and remove instructions that no longer apply.
- **Source:** arXiv:2511.12884 (Agent READMEs, 2,303 files analyzed), arXiv:2601.03269 (instruction gap).

### Enforce Hard Constraints via Tooling, Not Instructions
- **What:** Use linters, pre-commit hooks, CI checks, and type systems to enforce deterministic rules. Reserve agent instructions for heuristic guidance that can't be automated.
- **Why:** Agents struggle with negative instructions ("don't do X"), drop instructions as density increases, and drift from constraints over extended interactions (42% task success drop after ~73 interactions). Per-check compliance may be 80%, but per-instance compliance requiring all checks to pass drops to 9-28%. Linters are cheaper, faster, and 100% reliable.
- **When:** Whenever a constraint can be expressed as an automated check. Code style, formatting, import ordering, type safety — all belong in tooling. Reserve instructions for judgment calls: architectural preferences, naming conventions in ambiguous cases, when to split files.
- **Source:** arXiv:2601.04170 (agent drift), arXiv:2601.10343 (OctoBench ISR-CSR gap), HN practitioner consensus.

### Prefer Simple Context Compression Over LLM Summarization
- **What:** For long-running agent sessions, use observation masking (replacing older tool outputs with placeholders) over LLM-based summarization. When summarization is necessary, use structured formats with explicit sections.
- **Why:** JetBrains research: masking matches or beats summarization solve rates while cutting costs 52%. Summarization consumes 7%+ of total costs and obscures stopping signals (agents run 13-15% longer trajectories). Exception: Factory.ai's structured summarization (explicit sections for intent, modifications, decisions, next steps) scored higher than both Anthropic and OpenAI default summarizers. Simple > clever, but structured > naive.
- **When:** Long-running agent sessions approaching context limits. Use masking as primary strategy; structured summarization as supplement for critical context that must survive compression.
- **Source:** arXiv:2508.21433 (JetBrains), Factory.ai evaluation, Manus engineering blog.

### Add Instructions Reactively, Not Proactively
- **What:** Add context file entries only after an agent makes a mistake, then verify the instruction actually prevents the mistake. Never preemptively specify rules.
- **Why:** Preemptive instructions are the primary cause of over-specification — agents dutifully follow unnecessary requirements, increasing reasoning cost and reducing success rates. The iterative "fail → add rule → retest" loop produces minimal, battle-tested instructions. First-person framing ("I will check for...") may outperform directives ("You must...") — possibly because models treat it as internal reasoning.
- **When:** Always. Resist the urge to front-load context files with everything the agent might need. Start empty. Add entries one at a time after observed failures. Remove entries that don't measurably help.
- **Source:** arXiv:2602.11988 (over-specification finding), HN practitioner consensus, Cursor best practices, HumanLayer blog.

### Context Position Matters
- **What:** Place the most critical instructions at the beginning or end of context — never buried in the middle. For multi-turn sessions, use recitation patterns (rewriting key objectives into recent context) to combat positional degradation.
- **Why:** "Lost in the Middle" (arXiv:2307.03172) established the U-shaped attention pattern — information at the start and end of context is reliably processed; middle content is often lost. Context Rot research shows degradation grows with input length even for frontier models, and early context receives disproportionate attention. Manus uses todo.md recitation to push objectives into recent attention windows (~50 tool calls per task).
- **When:** Structuring any context file or multi-turn agent session. Place hard constraints first. In long sessions, periodically resurface critical objectives. Consider that after multiple turns, original context file instructions shift toward the "lost middle" zone.
- **Source:** arXiv:2307.03172 (Lost in the Middle), Chroma Research (Context Rot), Manus engineering blog.

## Three-Tier Context Architecture

The evidence converges on a three-tier architecture for agent augmentation:

| Tier | Mechanism | Content | Size Constraint | Authorship |
|------|-----------|---------|-----------------|------------|
| **1. Always-present** | CLAUDE.md / AGENTS.md | Hard constraints, required tooling, project conventions not inferable from code | <150 lines | Human only |
| **2. On-demand** | Skills / progressive disclosure | Domain-specific procedures, API guidance, specialized workflows | 2-3 modules per task | Human-curated or RL-evolved |
| **3. Dynamic runtime** | RAG / tool-based retrieval | Code search, documentation lookup, file exploration | Agent-initiated | Automated retrieval |

Key interaction rules:
- Tier 1 should never duplicate what's in Tier 3 (the model can find it)
- Tier 2 should not exceed 2-3 modules active simultaneously
- When Tier 1 conflicts with Tier 2, behavior is unpredictable (avoid conflicts)
- Use hierarchical routing when Tier 2 libraries exceed ~50 skills

### Index + On-Demand Loading for Memory Trees
- **What:** Use a concise index file (MEMORY.md, projectbrief.md, or equivalent) as the sole always-loaded file in a memory tree. Keep it under 200 lines. Store detailed notes in topic-specific satellite files that Claude loads on demand.
- **Why:** Claude Code's auto-memory enforces this: only the first 200 lines of MEMORY.md load automatically; topic files (debugging.md, api-conventions.md) load when Claude needs them. This prevents context bloat from irrelevant detail while keeping orientation fast. The Cline Memory Bank, SpillwaveSolutions project-memory, and Claude Cognitive all independently converge on this index-first pattern.
- **When:** Any multi-session project where accumulated knowledge exceeds ~150 lines. Split topic domains into separate files. Use the index to summarize what lives where. Never flatten everything into a single growing file.
- **Source:** research/2026-02-28-investigate-the-folder-tree-memory-system-approach... (official Claude Code docs, Cline Memory Bank, SpillwaveSolutions/project-memory)

### Separate Personal vs Team Memory
- **What:** Use Claude's auto-memory (`~/.claude/projects/<project>/memory/`) for Claude's own notes — personal, not version-controlled. Use `.claude/rules/*.md` for team-shared conventions — version-controlled, human-authored. Never conflate the two.
- **Why:** Auto-memory is Claude-written and personal: it captures what Claude discovers, not what the team agreed on. Rules files are human-written and team-shared: they encode conventions, not Claude's inferences. Mixing them produces stale team instructions (Claude's old notes) or lost personal insights (overwritten by git pulls).
- **When:** Always. As a project grows, the distinction matters more: auto-memory evolves per-developer, rules files evolve per-team.
- **Source:** research/2026-02-28-investigate-the-folder-tree-memory-system-approach... (official Claude Code docs, community practice)

### Never Shadow Built-in Commands with Custom Skills
- **What:** Do not create a custom skill named `memory` (or any built-in command name). The skill would shadow the built-in `/memory` command, losing access to the file selector and auto-memory toggle. Use distinct names: `/memory-update`, `/mem-tree`, `/project-memory`.
- **Why:** Claude Code resolves user-invocable skills before built-in commands when the names conflict. The built-in `/memory` command provides the file selector UI and auto-memory toggle — functionality that cannot be replicated in a custom skill. Losing access to it breaks memory management for the session.
- **When:** When authoring any custom skill. Always check the built-in command list before choosing a skill name.
- **Source:** research/2026-02-28-investigate-the-folder-tree-memory-system-approach... (Claude Code skills docs, community reports)

## Revision History
- 2026-02-24: Initial extraction from agent context augmentation landscape research. 10 principles from 25+ papers and 6 industry sources.
- 2026-02-28: Added 3 principles from folder-tree memory system research: index+on-demand loading, personal vs team memory separation, built-in command shadowing risk. Sources: official Claude Code docs, Cline Memory Bank, SpillwaveSolutions/project-memory, Claude Cognitive.

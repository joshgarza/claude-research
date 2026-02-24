---
date: 2026-02-24
topic: Agent context augmentation research landscape
status: complete
tags: [agent-context, CLAUDE.md, AGENTS.md, skills, prompting, coding-agents, benchmarks, context-engineering]
related: [2026-02-24-arxiv-2602-11988.md, 2026-02-24-arxiv-2602-12670.md]
---

# Agent Context Augmentation: Research Landscape

## Context

Deep dive into the broader research landscape around how structured context files, instructions, and skills affect LLM coding agent performance. This survey was prompted by two anchor papers that converged on a counterintuitive finding: less is more for agent context, and LLM-generated context/skills are counterproductive. This document maps the full body of evidence supporting, extending, or contradicting that finding across academic research, industry practice, and community discussion.

## Anchor Papers

### Paper 1: "Evaluating AGENTS.md" (arXiv:2602.11988)

**Authors:** Gloaguen, Mundler, Muller, Raychev, Vechev (ETH Zurich / DeepCode AI). Feb 2026.

**Core finding:** LLM-generated context files decrease coding agent success rates by 0.5-2% while increasing inference costs 20%+. Developer-written files offer only modest ~4% gains. Root cause: over-specification -- agents dutifully follow unnecessary instructions, making tasks harder. When other documentation was removed, LLM-generated context files actually helped (+2.7%), confirming they are redundant in well-documented repos. Recommendation: minimal, constraint-focused context files only.

- [Paper](https://arxiv.org/abs/2602.11988) | [Full analysis](2026-02-24-arxiv-2602-11988.md)

### Paper 2: "SkillsBench" (arXiv:2602.12670)

**Authors:** Li, Chen, Liu et al. (40 authors). Feb 2026.

**Core finding:** Curated human-authored Skills boost performance +16.2pp average across 84 tasks and 11 domains. Self-generated Skills are useless (-1.3pp). 2-3 focused Skills is the optimal sweet spot; comprehensive documentation is actively harmful (-2.9pp). Skills help most where models have the largest procedural knowledge gap (Healthcare +51.9pp vs Software Engineering +4.5pp).

- [Paper](https://arxiv.org/abs/2602.12670) | [Full analysis](2026-02-24-arxiv-2602-12670.md)

**Key convergence:** Both papers independently find that (1) less is more, (2) LLM-generated context/skills fail, and (3) focused human-authored augmentation is the only approach that reliably helps.

---

## Related Research

### A. Context Files: Structure, Adoption, and Impact

#### "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents" (arXiv:2601.20404)

**Authors:** Lulla et al. Jan 2026.

**Methodology:** 10 repositories, 124 pull requests, OpenAI Codex agent. Paired within-task comparison with and without AGENTS.md.

**Findings:** AGENTS.md files are associated with 28.64% lower median runtime and 16.58% reduced output token consumption while maintaining comparable task completion. This partially contradicts the Evaluating AGENTS.md paper -- but the key difference is this study measures *efficiency* (speed, token usage) rather than *correctness* (task success rate). Context files may help agents work faster by providing navigation shortcuts, even if they don't improve final outcomes.

- [Paper](https://arxiv.org/abs/2601.20404)

#### "Agent READMEs: An Empirical Study of Context Files for Agentic Coding" (arXiv:2511.12884)

**Authors:** Study of 2,303 context files from 1,925 repositories. Nov 2025.

**Findings:**
- Claude Code files have median Flesch Reading Ease of 16.6 -- "very difficult," comparable to academic/legal text
- 67% of Claude Code files undergo multiple commits, indicating active maintenance ("living configuration artifacts")
- Strong functional bias: Testing (75%), Implementation (70%), Architecture (68%), Build (62%) heavily represented. Security (14.5%), Performance (14.5%), UI/UX (8.7%) severely underrepresented
- Introduces concept of **"context debt"** -- technical debt stemming from unmaintainable agent instructions
- Recommends treating context files as configuration code requiring code review

- [Paper](https://arxiv.org/abs/2511.12884)

#### "Decoding the Configuration of AI Coding Agents: Insights from Claude Code Projects" (arXiv:2511.09268)

**Nov 2025.** Analyzes CLAUDE.md files across real projects to understand configuration patterns. Complements the Agent READMEs study with Claude-specific insights.

- [Paper](https://arxiv.org/abs/2511.09268)

### B. Instruction Following and Degradation

#### "How Many Instructions Can LLMs Follow at Once?" (arXiv:2507.11538)

**Evaluated 10-500 instructions across frontier models. Jul 2025.**

**Key findings:**
- Three distinct degradation patterns: **threshold decay** (reasoning models maintain ~100% until ~150 instructions then cliff), **linear decay** (steady decline), **exponential decay** (small models collapse early)
- Best models achieve only 68% accuracy at 500 instructions
- At 150-200 instructions, primacy effects peak -- then converge toward uniform failure
- Models shift from modification errors to **omission errors** (complete instruction dropping) as density increases
- Reasoning models incur dramatic latency: o3 goes from 26s at 10 instructions to 220s at 250

**Implication for context files:** The ~150-200 instruction threshold aligns with practitioner recommendations to keep CLAUDE.md/AGENTS.md under 150-200 lines. Beyond this, even frontier models begin dropping instructions entirely.

- [Paper](https://arxiv.org/abs/2507.11538)

#### "The Instruction Gap: LLMs Get Lost in Following Instructions" (arXiv:2601.03269)

**Jan 2026.** Evaluates 13 LLMs on instruction compliance in enterprise RAG scenarios. Finds significant variance in compliance rates across model families. Performance drops 19% as more requirements are specified. Progressive instruction addition introduces contradictions that compound degradation.

- [Paper](https://arxiv.org/abs/2601.03269)

#### "OctoBench: Benchmarking Scaffold-Aware Instruction Following" (arXiv:2601.10343)

**Authors:** MiniMax. Jan 2026. 34 environments, 217 tasks, 7,098 checklist items across Claude Code, Kilo, and Droid scaffolds.

**Key finding: The ISR-CSR gap.** Per-check success rate (CSR) is 79-86%, but per-instance success rate (ISR, requiring ALL checks to pass) drops to 9-28%. Models follow most individual instructions but fail to maintain heterogeneous persistent constraints simultaneously. Performance varies dramatically across scaffolds -- agents lack cross-scaffold robustness. Feedback-driven correction improves ISR by up to 16.79%.

- [Paper](https://arxiv.org/abs/2601.10343)

#### "Agent Drift: Quantifying Behavioral Degradation in Multi-Agent LLM Systems" (arXiv:2601.04170)

**Jan 2026.** Introduces the Agent Stability Index (ASI), a 12-dimension composite metric for measuring behavioral drift.

**Key findings:**
- Task success drops 42% (87.3% to 50.6%) when systems become unstable
- Median drift onset: 73 interactions (range 52-114)
- Three root causes: context window pollution, distributional shift, autoregressive reinforcement (agent outputs become future inputs, compounding biases)
- **Mitigation:** Adaptive Behavioral Anchoring (baseline exemplars weighted by drift metrics) achieves 70.4% drift reduction. Combined strategies reach 81.5%.
- Two-level hierarchies (router + specialists) outperform flat or deep architectures
- External long-term memory boosts stability 21% over conversation-history-only

- [Paper](https://arxiv.org/abs/2601.04170)

### C. Context Window and Performance Degradation

#### "Context Rot" (Chroma Research, 2025)

**Empirical study of how increasing input tokens degrades LLM performance.**

**Key findings:**
- Performance grows increasingly unreliable as input length grows, even for frontier models
- **Counterintuitive:** Shuffled haystacks consistently outperform logically coherent ones across all 18 models tested -- suggesting attention mechanisms respond unexpectedly to structural patterns
- Significant performance gaps between focused inputs (~300 tokens) and full inputs (~113k tokens) persist even with thinking modes
- Claude models show lowest hallucination rates but pronounced gaps between focused and full contexts
- Position bias: early context receives disproportionate attention; critical information near sequence start improves reliability

**Implication:** Context files that appear at the start of agent context may benefit from position bias, but their content dilutes attention available for actual task-relevant code and instructions.

- [Source](https://research.trychroma.com/context-rot)

#### "Lost in the Middle: How Language Models Use Long Contexts" (arXiv:2307.03172)

**The foundational paper on U-shaped attention patterns.** Information at the beginning and end of context windows is reliably processed; middle content is often lost. This directly affects where context file contents land in multi-turn agent interactions -- after initial turns, context file instructions shift toward the "lost middle" zone.

- [Paper](https://arxiv.org/abs/2307.03172)

#### "LOCA-bench: Benchmarking Language Agents Under Controllable and Extreme Context Growth" (arXiv:2602.07962)

**Feb 2026.** Benchmark that can extend agent context to arbitrary lengths while keeping task semantics fixed. Enables controlled measurement of context rot's impact on agentic tasks specifically.

- [Paper](https://arxiv.org/abs/2602.07962)

### D. Context Retrieval and Utilization in Coding Agents

#### "ContextBench: A Benchmark for Context Retrieval in Coding Agents" (arXiv:2602.05892)

**Feb 2026. 1,136 tasks across 66 repositories, 8 languages, 522K lines of annotated gold context.**

**Key findings:**
- **Sophisticated scaffolding does not improve context retrieval.** The minimal mini-SWE-agent outperforms more complex agents (SWE-agent, OpenHands, Agentless, Prometheus) on file-level F1. Echoes "The Bitter Lesson" of AI research.
- **Exploration-utilization gap:** Agents frequently retrieve gold-relevant code but fail to incorporate it into final reasoning. Consolidation, not retrieval, is the bottleneck.
- Claude Sonnet 4.5 balances retrieval rounds with context granularity optimally (highest efficiency at 0.658 but also highest redundancy at 0.708)
- GPT-5 uses fewest rounds (5.87) with largest contexts per step; Devstral 2 uses most rounds (22.16) with smallest contexts
- Cost per instance: $0.38-$0.91 depending on strategy
- All agents show significant context loss between retrieval and patch generation

- [Paper](https://arxiv.org/abs/2602.05892)

#### "SWE Context Bench" (arXiv:2602.08316)

**Feb 2026.** Evaluates whether agents can reuse experience from related tasks.

**Key findings:**
- Oracle summaries (204.5 words average) outperform full trajectories (24,765 words) -- 34.34% vs baseline 26.26% resolution rate
- **Concise summaries beat raw execution traces** -- directly parallels the SkillsBench finding that focused > comprehensive
- Free (unguided) experience reuse matches baseline; free summary reuse *underperforms* it -- incorrectly selected summaries are actively misleading
- The 12pp gap between oracle and free selection demonstrates that retrieval accuracy is critical

- [Paper](https://arxiv.org/abs/2602.08316)

#### "Retrieval-Augmented Code Generation: A Survey" (arXiv:2510.04905)

**Oct 2025.** Comprehensive survey of RAG approaches for code generation, including vector-based, graph-based, and hybrid retrieval. Graph-based retrieval excels at cross-file reasoning. The diversity in retrieval strategies directly influences generated code quality.

- [Paper](https://arxiv.org/abs/2510.04905)

### E. Skills Architecture and Scaling

#### "Agent Skills for Large Language Models: Architecture, Acquisition, Security, and the Path Forward" (arXiv:2602.12430)

**Authors:** Xu, Yan. Feb 2026. Comprehensive survey of the agent skills ecosystem.

**Key contributions:**
- Documents the SKILL.md specification's three-level progressive disclosure: L1 metadata (dozens of tokens, always loaded), L2 procedural instructions (on demand), L3 technical appendices
- Skills answer "what to do"; MCP answers "how to connect" -- complementary layers
- Six skill acquisition pathways: human-authored, RL (SAGE), autonomous discovery (SEAgent), structured bases (CUA-Skill), compositional synthesis, skill compilation
- **Security crisis:** 26.1% of community-contributed skills contain vulnerabilities; 5.2% exhibit high-severity patterns suggesting malicious intent; 157 confirmed malicious skills identified
- Proposes four-tier trust governance framework (G1-G4 gates mapping provenance to deployment permissions)

- [Paper](https://arxiv.org/abs/2602.12430)

#### "When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail" (arXiv:2601.04748)

**Jan 2026.** Tests compiling multi-agent systems into single-agent skill libraries.

**Key findings:**
- Skills reduce tokens 54% and latency 50% vs multi-agent systems while preserving accuracy (within -2% to +4%)
- **Critical scaling limit:** Selection accuracy exhibits phase transition at ~50-100 skills (depending on model), then collapses super-linearly to ~20% at 200 skills
- **Semantic confusability drives errors, not library size alone** -- adding one semantically similar competitor causes 7-30% accuracy drop
- Hierarchical routing (two-stage selection) recovers +37-40% accuracy at scale by keeping each selection stage under the threshold
- Aligns with SkillsBench's 2-3 Skills sweet spot finding

- [Paper](https://arxiv.org/abs/2601.04748)

#### "SkillRL: Evolving Agents via Recursive Skill-Augmented Reinforcement Learning" (arXiv:2602.08234)

**Feb 2026.** Automatic skill discovery through experience-based distillation. Successful trajectories become demonstrations; failures become concise lessons. Hierarchical SkillBank with general and task-specific heuristics. Outperforms baselines by 15.3% on ALFWorld, WebShop, and search tasks. Shows that *evolved* skills can work -- but this is RL-based distillation, not simple LLM self-generation.

- [Paper](https://arxiv.org/abs/2602.08234)

### F. Context Management Strategies

#### "The Complexity Trap: Simple Observation Masking Is as Efficient as LLM Summarization" (JetBrains Research, Dec 2025)

**Compared three strategies: raw (unmanaged), observation masking, and LLM summarization for coding agents.**

**Key findings:**
- Both masking and summarization reduce costs 50%+ vs unmanaged context
- Observation masking matches or beats LLM summarization in solve rates while being cheaper
- With Qwen3-Coder 480B: masking achieved 52% cost reduction while improving solve rates by 2.6%
- Agents using summarization ran 13-15% longer trajectories -- summaries may obscure stopping signals
- Summary generation consumed >7% of total costs
- **"Simplicity often takes the prize for total efficiency and reliability"**

- [JetBrains Research Blog](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) | [Paper](https://arxiv.org/abs/2508.21433)

#### "Everything is Context: Agentic File System Abstraction for Context Engineering" (arXiv:2512.05470)

**Dec 2025.** Proposes treating all context as a file system (inspired by Unix "everything is a file"). Context Constructor, Loader, and Evaluator pipeline that assembles, delivers, and validates context under token constraints. Provides governance and traceability for context engineering.

- [Paper](https://arxiv.org/abs/2512.05470)

#### "Evaluating Context Compression for AI Agents" (Factory.ai/Tessl)

**Factory's production evaluation across 36,000+ messages from debugging, code review, and feature implementation.**

**Key findings:**
- Factory's structured summarization (explicit sections for session intent, file modifications, decisions, next steps) scored 3.70 vs 3.44 (Anthropic) and 3.35 (OpenAI) for context retention
- Critical metric reframing: **tokens per task, not tokens per request** -- aggressive compression saves tokens but loses details that cause expensive rework
- Factory compresses on-the-fly, keeping recent messages and summarizing the rest

- [Factory Blog](https://factory.ai/news/compressing-context) | [Evaluation Framework](https://factory.ai/news/evaluating-compression)

---

## Industry Practices

### Anthropic: Context Engineering for AI Agents

Anthropic's Sep 2025 engineering blog post established the intellectual framework that much subsequent work builds on.

**Core principles:**
- Context engineering = "finding the smallest possible set of high-signal tokens that maximize the likelihood of desired outcome"
- **The Altitude Principle:** System prompts should occupy a "Goldilocks zone" -- specific enough to guide behavior, flexible enough to provide heuristics rather than brittle if-else logic
- Few-shot examples are "pictures worth a thousand words" -- curate diverse canonical examples over exhaustive edge cases
- Just-in-time context retrieval: agents maintain lightweight identifiers and load data dynamically, mirroring human cognition
- Sub-agent architectures: specialized sub-agents return condensed summaries (1,000-2,000 tokens) to the main agent

**Long-running agent harnesses (separate blog post):**
- Two-part architecture: initializer agent (sets up environment, creates progress file, commits baseline) + coding agent (reads progress, picks one feature, implements, commits)
- JSON feature lists prevent model modification while maintaining scope clarity
- **Incremental progress enforcement**: one feature at a time, never multiple simultaneous implementations
- `claude-progress.txt` + git history = structured handoff between sessions

- [Context Engineering Blog](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | [Harnesses Blog](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

### OpenAI: Harness Engineering with Codex

**Jan 2026 blog post documenting OpenAI's internal "harness engineering" methodology.**

- 3 engineers + Codex agents produced ~1M lines of production code in 5 months via ~1,500 merged PRs
- Engineers shift from writing code to designing environments, specifying intent, and reviewing agent output
- Initial scaffold (repo structure, CI, formatting, framework) generated by Codex CLI, including the initial AGENTS.md itself
- Represents the most aggressive agent-first development methodology documented publicly

- [OpenAI Blog](https://openai.com/index/harness-engineering/)

### Spotify: Honk Background Coding Agent (Nov 2025)

**Production deployment generating 650+ monthly merged PRs.**

**Evolution:** Goose/Aider (failed to scale) -> custom agentic loop (10 turns, 3 retries, struggled with multi-file) -> Claude Code (top performer, handles complex cascading changes)

**Six prompt design principles:**
1. Tailor to agent type (Claude Code prefers end-state descriptions over step-by-step)
2. State preconditions explicitly (when NOT to act)
3. Include concrete code examples
4. Define verifiable goals via tests
5. Single changes per prompt
6. Solicit agent feedback post-session

**Deliberate tool restriction:** Only verify, git, and allowlisted bash. No code search, no documentation tools. "More tools create more dimensions of unpredictability." Static elaborate prompts over dynamic tool-based approaches.

- [Part 1: Overview](https://engineering.atspotify.com/2025/11/spotifys-background-coding-agent-part-1) | [Part 2: Context Engineering](https://engineering.atspotify.com/2025/11/context-engineering-background-coding-agents-part-2) | [Part 3: Feedback Loops](https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3)

### Vercel: AGENTS.md vs Skills Evaluation

**Jan 2026 internal evaluation targeting Next.js 16 APIs absent from model training data.**

**Results:**
- Baseline (no docs): 53%
- Skills (default): 53% (+0pp) -- skills not invoked 56% of the time
- Skills (with explicit instructions): 79% (+26pp)
- AGENTS.md compressed docs index: **100%** (+47pp)

**Key insight:** Passive, always-available context beats on-demand skill retrieval. The 40KB docs index was compressed to 8KB (80% reduction) using pipe-delimited format while maintaining 100% pass rate.

**Recommendations:** For general framework knowledge, passive context outperforms retrieval. Reserve skills for "vertical, action-specific workflows."

**Important caveat from HN discussion:** Sample sizes were small (29-33 test cases), no statistical error margins provided, and the approach doesn't scale for codebases too large to fit documentation in context.

- [Vercel Blog](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) | [HN Discussion](https://news.ycombinator.com/item?id=46809708)

### Manus: Production Context Engineering Lessons

**Jul 2025. Practical lessons from building a production AI agent.**

**Strategies:**
- **KV-cache hit rate is "the single most important metric"** -- cached tokens cost $0.30/MTok vs $3/MTok uncached (10x difference with Claude Sonnet)
- Average input-to-output token ratio: 100:1 -- making cache efficiency critical
- **Tool masking over removal:** Mask token logits during decoding rather than removing tools (preserves KV-cache validity)
- **File system as external memory:** Unlimited, persistent, directly operable by agent
- **Todo.md recitation:** Agent constantly rewrites todo file, pushing objectives into recent attention window to combat goal drift. Average task: ~50 tool calls.
- **Error preservation:** Keep failed actions in context -- "erasing failure removes evidence" the model needs
- **Variation prevents brittleness:** Controlled variation in action serialization templates prevents pattern mimicry

- [Manus Blog](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)

### Cursor: Rules System

**Cursor Rules are persistent context included at the start of model context.**

**Best practices from docs and practitioners:**
- Add rules only when agents make the same mistake repeatedly -- reactive, not proactive
- Good rules are "focused, actionable, and scoped"
- Architecture: an inner agent decides which rules to include/exclude from the code-generating model -- not all rules reach the model every time
- First-person framing ("I will check for...") outperforms second-person directives ("You must...") in practitioner testing

- [Cursor Docs](https://cursor.com/docs/context/rules) | [Cursor Agent Best Practices](https://cursor.com/blog/agent-best-practices)

### Windsurf: Rules and AGENTS.md

Windsurf supports both its own rules system and AGENTS.md as a cross-tool standard. Rules function as persistent context with an emphasis on keeping rules "simple, concise, and specific." The recommended pattern of requiring the AI to explicitly state rules in output improves transparency and compliance.

- [Windsurf AGENTS.md Docs](https://docs.windsurf.com/windsurf/cascade/agents-md)

---

## Community Discussion

### HN Thread: "Evaluating AGENTS.md" (Feb 2026)

**Key practitioner insights from [the discussion](https://news.ycombinator.com/item?id=47034087):**

- **"4% improvement is massive!"** -- Some practitioners view even modest gains from a simple markdown file as a strong signal, given the minimal effort required.
- **Best content: tribal knowledge that can't be inferred from code** -- architectural decisions, intentional design patterns, non-obvious conventions. "The best stuff to put in AGENTS.md is information that *can't* be discovered by reading code."
- **Iterative learning process:** Add instructions only after agents fail, then retest to verify improvement. Never preemptively over-specify.
- **Nested/hierarchical files:** Use folder-specific AGENTS.md files for progressive disclosure and context efficiency. Feature-specific files under 15 lines.
- **Agents struggle with negative instructions** ("don't do X"). Hard constraints via linters/hooks/CI are more reliable.
- **Auto-generated context is universally seen as ineffective** by practitioners, confirming the paper's finding.
- **Methodological concerns:** Python-only evaluation, small sample (130 tests), emphasis on LLM-heavy recent repos rather than mature codebases with deep institutional knowledge.

### HN Thread: "Vercel AGENTS.md vs Skills" (Jan 2026)

**Key insights from [the discussion](https://news.ycombinator.com/item?id=46809708):**

- The real variable is not AGENTS.md vs Skills but **whether decision-making is required**. Passive context (always available) vs active retrieval (requires a decision to load) is the fundamental distinction.
- First-person instructions outperform second-person -- models may treat "I will..." as internal reasoning rather than external commands
- Critics noted this is "model-whispering to specific versions" -- prompt engineering fragility that may break with model updates
- Consensus: the finding validates a principle (passive > active context) rather than discovering something novel

### Blog: "You Don't Need a CLAUDE.md" (DEV Community)

**Core argument:** Keep CLAUDE.md minimal (~30 lines) as a workflow entry point, not a knowledge repository. Organize docs in a `docs/` folder structure. Agent discovers relevant files via directory listing, reads only task-specific documentation.

**Key recommendation:** Meta-prompting (refine requirements through conversation before implementation) and iterative discarding (restart with improved prompts rather than accumulating fixes).

- [Blog Post](https://dev.to/byme8/you-dont-need-a-claudemd-jgf)

### Blog: "Writing a Good CLAUDE.md" (HumanLayer)

**Practical recommendations:**
- Frontier LLMs can follow ~150-200 instructions with reasonable consistency
- Never put code style guidelines in CLAUDE.md -- let linters handle deterministic formatting
- Use progressive disclosure: tell agent how to find information, not all the information
- Point to real files showing best patterns; call out legacy files to avoid

- [Blog Post](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

### Blog: "A Guide to Claude Code 2.0" (sankalp)

**Practitioner experience emphasizing:**
- CLAUDE.md should be a living document, evolved session by session
- Skills for specific workflows; CLAUDE.md for universal context
- The shift from "prompting" to "context architecture" as the core engineering skill

- [Blog Post](https://sankalp.bearblog.dev/my-experience-with-claude-code-20-and-how-to-get-better-at-using-coding-agents/)

---

## Synthesis

### Where Findings Converge

**1. Less is more -- the signal is overwhelming.**

Every major study and practitioner report converges on this: focused, minimal context outperforms comprehensive documentation.

| Source | Finding |
|--------|---------|
| Evaluating AGENTS.md | Minimal human-written files (+4%) vs LLM-generated (-2%) |
| SkillsBench | 2-3 Skills (+18.6pp) vs 4+ Skills (+5.9pp) vs Comprehensive (-2.9pp) |
| Vercel | 8KB compressed index (100%) vs 40KB full docs (same result) |
| SWE Context Bench | 204-word summaries beat 24,765-word full trajectories |
| Instruction Capacity | Models cliff at ~150 instructions; degrade before that |
| JetBrains | Simple masking beats LLM summarization |
| Spotify | Single changes per prompt; restricted tool sets |
| Manus | "Smallest set of high-signal tokens" |
| Factory.ai | Tokens per task > tokens per request |

**2. LLM-generated context consistently fails.**

| Source | Finding |
|--------|---------|
| Evaluating AGENTS.md | LLM-generated files: -0.5% to -2% success rate |
| SkillsBench | Self-generated Skills: -1.3pp average |
| Practitioner consensus (HN) | "Auto-generated context is universally ineffective" |
| SWE Context Bench | Free (model-selected) summaries underperform baseline |

The failure has two mechanisms: (a) models generate vague, generic guidance rather than precise procedural knowledge, and (b) models cannot identify what they don't know (they generate confident but unhelpful content about areas where they lack expertise).

**3. Context file value depends on information gap.**

| Scenario | Value |
|----------|-------|
| Well-documented repo + context file | Negative (redundant noise) |
| Undocumented repo + context file | Positive (+2.7% in AGENTS.md study) |
| Domain with strong training data (SE, math) + Skills | Minimal (+4.5pp) |
| Domain with weak training data (Healthcare) + Skills | Massive (+51.9pp) |
| Novel APIs absent from training data + AGENTS.md | Critical (+47pp Vercel study) |

The pattern: context augmentation helps exactly when it provides information the model genuinely lacks. For well-covered domains, it is mostly noise.

**4. Passive context beats active retrieval (for now).**

Vercel's finding that always-present context (100%) outperforms on-demand skills (53%) aligns with a broader pattern: eliminating decision points improves reliability. When agents must decide whether to load context, they often don't. This favors AGENTS.md/CLAUDE.md (always loaded) over skills (optionally invoked) -- but only when the context is small enough to not cause rot. The tension between "always available" and "minimal" is the core design challenge.

**5. The harness matters as much as the model.**

| Source | Finding |
|--------|---------|
| SkillsBench | Codex CLI ignores Skills; Claude Code uses them consistently |
| ContextBench | Minimal scaffolding outperforms sophisticated architectures on retrieval |
| OctoBench | Performance varies dramatically across Claude Code, Kilo, Droid scaffolds |
| Agent Drift | Two-level hierarchies outperform flat or deep architectures |
| Anthropic | Sub-agent architectures with condensed summaries preserve context |

### Where Findings Conflict

**1. Do AGENTS.md files help or hurt?**

The Lulla et al. study (arXiv:2601.20404) shows 28% runtime reduction with AGENTS.md, while the Gloaguen et al. study (arXiv:2602.11988) shows -2% success rate. Resolution: context files improve *efficiency* (agents navigate faster) but not *correctness* (agents don't solve harder problems). Both can be true simultaneously.

**2. Passive context vs Skills at scale.**

Vercel favors passive context; SkillsBench favors focused Skills. Resolution: these test different scenarios. Passive context works for small, universal knowledge (framework APIs). Skills work for domain-specific procedural knowledge that would bloat passive context. The approaches are complementary, not competing -- use passive for universal rules, Skills for domain expertise.

**3. Comprehensive documentation: harmful or helpful?**

SkillsBench shows comprehensive Skills are harmful (-2.9pp). The Vercel study shows comprehensive docs (compressed) achieve 100%. Resolution: Vercel's "comprehensive" docs were aggressively compressed to 8KB and structurally optimized. SkillsBench's "comprehensive" Skills were verbose procedural documents. Compression and format matter enormously -- "comprehensive" at different compression levels produces opposite results.

### The Emerging Framework

The evidence points toward a three-tier context architecture:

1. **Tier 1: Always-present minimal context** (CLAUDE.md / AGENTS.md)
   - Hard constraints, required tooling, project-specific conventions that can't be inferred
   - Under 150 lines / ~200 instructions maximum
   - Human-authored only; never auto-generated
   - Treat as configuration code with version control and review

2. **Tier 2: On-demand procedural knowledge** (Skills / progressive disclosure)
   - Domain-specific how-to guidance for specialized tasks
   - 2-3 focused modules per task maximum
   - Human-curated; RL-evolved acceptable; self-generated harmful
   - Hierarchical routing for large skill libraries (>50 skills)

3. **Tier 3: Dynamic runtime context** (RAG / tool-based retrieval)
   - Code search, documentation lookup, file exploration
   - Agent-initiated based on task needs
   - Minimize tool count to reduce decision complexity
   - Prefer simple observation masking over LLM summarization for compression

---

## Open Questions

1. **Non-Python languages.** Nearly all evaluation is Python-centric. Do less-represented languages (Rust, Go, Haskell) benefit more from context files due to training data gaps?

2. **Optimal compression formats.** Vercel compressed 40KB to 8KB with pipe-delimited format at no quality loss. What are the Pareto-optimal compression strategies for different content types?

3. **Context file lifespan.** Agent READMEs study shows 67% of files undergo multiple commits. How quickly do context files become stale? What is the "half-life" of useful context?

4. **Task-specific context selection.** Both anchor papers test static, universal context. Would a system that selects context based on the specific task type outperform static files?

5. **Interaction between context tiers.** What happens when always-present context (Tier 1) conflicts with on-demand Skills (Tier 2)? OctoBench shows models have heterogeneous conflict resolution strategies.

6. **Cross-model portability.** Cursor's finding that first-person framing works better suggests model-specific prompt engineering. How portable are context file optimizations across model updates and providers?

7. **Security of the Skills ecosystem.** 26.1% vulnerability rate in community skills is alarming. How do we build trustworthy skill ecosystems at scale?

8. **Measuring context debt.** The Agent READMEs study introduces "context debt" but provides no metric for it. How do we quantify and manage the accumulation of stale/harmful instructions?

9. **Causal isolation.** SkillsBench's biggest methodological gap: is the +16.2pp improvement from procedural structure specifically, or simply from having more domain-relevant tokens? Length-matched non-procedural baselines are needed.

10. **Long-horizon context strategies.** Manus's todo.md recitation and Factory's structured summarization show promise, but there are no controlled studies comparing these approaches head-to-head.

---

## Extracted Principles

### 1. The 150-Line Rule
- **What:** Keep always-present context files (CLAUDE.md, AGENTS.md) under 150 lines / ~200 discrete instructions.
- **Why:** Frontier models exhibit threshold decay around 150 instructions; smaller models degrade earlier. Every instruction beyond this threshold has diminishing or negative returns.
- **When:** All persistent context files loaded at session start. Does not apply to on-demand context loaded per-task.
- **Source:** arXiv:2507.11538 (instruction capacity), practitioner consensus, Vercel 8KB compression result.

### 2. Never Auto-Generate Context Files
- **What:** Do not use `claude init`, `codex init`, or similar auto-generation commands to create context files. Human-author them or don't have them.
- **Why:** LLM-generated context is consistently counterproductive across every study (-0.5% to -2% success, -1.3pp Skills, universally panned by practitioners). Models generate confident but vague guidance, especially in domains where they lack expertise.
- **When:** Always. No exceptions found in any study or practice report.
- **Source:** arXiv:2602.11988, arXiv:2602.12670, HN practitioner consensus, SWE Context Bench.

### 3. Context Files Bridge Information Gaps
- **What:** Context augmentation helps when it provides information the model genuinely lacks -- novel APIs, domain-specific procedures, tribal knowledge not inferable from code. It hurts when it duplicates information available elsewhere.
- **Why:** In well-documented repos, context files are redundant noise that increases reasoning cost without improving outcomes. In undocumented repos or novel domains, they fill genuine gaps.
- **When:** Before writing any context file, ask: "Can the model figure this out from the code and existing docs?" If yes, don't add it.
- **Source:** arXiv:2602.11988 (documentation removal ablation), arXiv:2602.12670 (domain gap correlation), Vercel (novel API effectiveness).

### 4. Passive Context for Universal Rules, Skills for Domain Expertise
- **What:** Use always-present context (AGENTS.md) for project-wide constraints that apply to every task. Use on-demand Skills for domain-specific procedural knowledge.
- **Why:** Passive context eliminates the decision point of whether to load information (Vercel: 100% vs 53%). But passive context must be small to avoid context rot. Domain expertise is too large and too task-specific for always-present loading.
- **When:** Tier 1 (passive) for: required tooling, hard constraints, project conventions. Tier 2 (Skills) for: specialized domain procedures, API-specific guidance. Never mix -- keep tiers separate.
- **Source:** Vercel blog, arXiv:2602.12670, arXiv:2601.04748 (skill scaling limits).

### 5. 2-3 Focused Modules, Never Comprehensive
- **What:** When augmenting agents with procedural knowledge, use 2-3 focused, detailed modules. Never provide comprehensive documentation or 4+ modules simultaneously.
- **Why:** 2-3 modules: +18.6pp. 4+ modules: +5.9pp. Comprehensive: -2.9pp. Semantic confusability increases with library size; cognitive overload begins at ~50-100 options.
- **When:** When selecting Skills, RAG chunks, or context modules for a specific task. Also applies to tool selection -- minimize tool count per task.
- **Source:** arXiv:2602.12670, arXiv:2601.04748, Anthropic context engineering guide.

### 6. Treat Context Files as Configuration Code
- **What:** Version control context files, require code review, audit for staleness, track "context debt."
- **Why:** 67% of context files undergo multiple commits. Readability scores comparable to legal documents. Non-functional requirements (security, performance) are systematically underrepresented. Stale instructions create technical debt with compounding costs.
- **When:** Any project using CLAUDE.md, AGENTS.md, or similar. Assign context file ownership like code ownership.
- **Source:** arXiv:2511.12884 (Agent READMEs study).

### 7. Enforce Hard Constraints via Tooling, Not Instructions
- **What:** Use linters, pre-commit hooks, CI checks, and type systems to enforce deterministic rules. Reserve agent instructions for heuristic guidance.
- **Why:** Agents struggle with negative instructions, drop instructions as density increases, and drift from constraints over extended interactions. Linters are cheaper, faster, and 100% reliable.
- **When:** Whenever a constraint can be expressed as an automated check. Instruction-based enforcement is a last resort.
- **Source:** HN practitioner consensus, arXiv:2601.04170 (agent drift), HumanLayer blog.

### 8. Prefer Simple Context Compression Over LLM Summarization
- **What:** When managing growing agent context, prefer observation masking (replacing older observations with placeholders) over LLM-based summarization.
- **Why:** JetBrains research shows masking matches or beats summarization while being 52% cheaper. Summarization obscures stopping signals, consumes 7%+ of costs, and limits cache reuse. Exception: structured summarization (Factory.ai) with explicit category sections outperforms naive approaches.
- **When:** Long-running agent sessions approaching context limits. Use masking as primary strategy, structured summarization as supplement.
- **Source:** JetBrains research (arXiv:2508.21433), Factory.ai evaluation, Manus practices.

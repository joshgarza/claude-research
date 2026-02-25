---
date: 2026-02-25
topic: Opinion piece on LLMs in production
status: complete
tags: [llm, production, ai-coding, software-engineering, spec-driven-development, code-quality]
related: [2026-02-14-ai-llm-integration-practices.md, 2026-02-15-ai-coding-team-training.md, 2026-02-24-research-this-site.md]
---

# Opinion Piece on LLMs in Production

## Context

Prompted by Esco Obong's LinkedIn/Medium article "Writing High Quality Production Code with LLMs is a Solved Problem" (Feb 2026), which claims a senior Airbnb engineer writes 99% of production code at scale using LLMs. The piece generates strong reactions because of its confident framing ("solved problem") — which contrasts with a growing body of empirical evidence suggesting the situation is far more nuanced. This research synthesizes Obong's argument with conflicting evidence: a METR RCT showing 19% net slowdown, Veracode data showing 45% of AI-generated code contains security vulnerabilities, and the emerging "comprehension debt" problem.

This is both a review of Obong's argument and a broader synthesis of where the field actually stands as of early 2026.

---

## Findings

### 1. Obong's Core Argument: "It's an Engineering Problem, Not an AI Problem"

Esco Obong (Senior Engineer, Airbnb; prev. Uber, NYTimes; 13 years experience) published his piece in February 2026 claiming that writing high-quality production code with LLMs is "a solved problem" — not because AI is magic, but because the right methodology makes it tractable.

His framework has two pillars:

**A. Treat LLMs as cognitive power tools, not magic wands.** "Magic wand mentality" — prompting "build X" and expecting a finished system — is the failure mode. Power tool mentality means: bring your own expertise, control the process, use the tool for leverage within a disciplined workflow.

**B. Spec-Driven Development (SDD) as the unifying methodology.**

The SDD workflow:
1. Have "The Conversation" — explain the problem in detail, propose approaches without coding, surface tradeoffs.
2. Convert to a spec — documented, reviewable, agreed upon.
3. Break the spec into atomic tasks with clear done criteria.
4. Execute one task at a time, human in the loop throughout.

Obong identifies five specific failure modes and their fixes:

| Problem | Root Cause | Solution |
|---|---|---|
| Constant refactors | Skipping upfront design | "The Conversation" before any code |
| Lack of codebase context | Model doesn't know your system | "Ramp-up" documents, CLAUDE.md, library summaries |
| Poor instruction following | Wrong model or degraded context | Use frontier models (Opus 4.6, GPT-5.3), compact at 20% remaining context |
| Doom loops (stuck bug fixing) | Fixing before diagnosing | Investigate-without-coding first, propose approaches, then approve |
| Complexity limits | Tasks too large for context window | Decompose into atomic components, isolated interfaces |

Key quote: *"Writing code is always the last step."*

**Convergence with industry consensus:** Obong's SDD matches patterns found across multiple independent sources — Addy Osmani's "My LLM Coding Workflow for 2026," the Thoughtworks spec-driven development guide, AWS Kiro's three-file spec structure (requirements.md, design.md, tasks.md), and research in this project (principles/ai-tool-adoption.md: "Spec First, Prompt Second").

---

### 2. Where Obong Is Right: The Evidence Base

**Model capability inflection point (Feb 2025).** Obong explicitly says his skepticism was "absolutely right 12 months ago" and credits Claude Sonnet 3.7 (February 2025) as the inflection. This aligns with broader practitioner consensus: something shifted in early 2025. The models became capable enough that disciplined workflows could compensate for their weaknesses.

**Spec-first is universally validated.** Every serious practitioner independently converges on this. Osmani's workflow guide, Boris Cherny (Claude Code team), the Faros AI enterprise study (10K+ devs), and Thoughtworks all identify front-loaded specification as the highest-leverage intervention.

**Context management is a system design problem.** Obong's treatment of context windows as an engineering constraint — not a limitation to work around but a variable to manage with `/compact` and handoff documents — is correct. This is exactly the "Context Engineering Over Prompt Engineering" principle from principles/ai-llm-integration.md.

**Doom loops are real and solvable.** The "investigate before touching code" pattern is well-documented. The DEV Community article on "The Prompt Doom Loop" confirms this failure mode: repeated failed fix attempts worsen as instruction history grows and context degrades.

**Cognitive leverage, not just speed.** Obong's most original observation: LLMs aren't primarily a speed multiplier — they're a cognitive fatigue reducer. Fewer mental context switches means deeper thinking, more iteration on approach, better decision quality. This reframes the value proposition in a way that the METR productivity study (which measured task completion time) might systematically miss.

---

### 3. Where the "Solved Problem" Framing Overstates

**The METR RCT contradicts the headline claim.** In July 2025, METR published a rigorous randomized controlled trial: 16 experienced developers, 246 real-world tasks, primarily Cursor Pro with Claude 3.5/3.7 Sonnet. Result: AI-assisted developers took **19% longer** than unassisted developers. Most strikingly: the developers themselves *believed* they were 20% faster. ([METR study, July 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/))

This isn't a fringe result. It's a peer-reviewed study with clean methodology. The one developer who outperformed had 50+ hours of Cursor experience — suggesting the "solved problem" may have a very steep prerequisite expertise requirement.

Reconciling METR with Obong: possible explanations include (1) tool specialization — Obong uses Claude Code CLI intensively vs. Cursor, (2) domain fit — Airbnb's large microservice codebase may benefit from AI better than the METR study's varied open-source contexts, (3) SDD expertise — Obong's workflow is very specialized and required months of refinement.

**45% of AI-generated code contains security vulnerabilities.** Veracode's 2025 GenAI Code Security Report analyzed 100+ LLMs across 80 security-sensitive coding tasks. Cross-site scripting and log injection failures occurred in 86-88% of cases. Java failure rate: 72%. ([Veracode 2025 GenAI Code Security Report](https://www.veracode.com/resources/analyst-reports/2025-genai-code-security-report/))

Obong does not address security specifically. His framework focuses on functional correctness and code structure. A workflow that produces clean, well-structured code that still has XSS vulnerabilities is not "production ready" by any serious enterprise standard. Security is a significant gap in the SDD framework as described.

**Comprehension debt is not addressed.** A 2025 phenomenon gaining attention: "comprehension debt" — codebases generated faster than developers can understand them. When developers own code they don't fully understand:
- Debugging time increases disproportionately
- Code review becomes security theater
- On-call incidents become more severe and slower to resolve
- Knowledge doesn't transfer when engineers leave

Codemanship's blog documented that "80% of code written by early adopters in late 2025" was AI-generated, and that modification/maintenance time was increasing. ([Comprehension Debt: The Ticking Time Bomb of LLM-Generated Code](https://codemanship.wordpress.com/2025/09/30/comprehension-debt-the-ticking-time-bomb-of-llm-generated-code/))

Obong's accountability principle ("you can't outsource expertise") gestures at this, but the SDD framework doesn't operationalize a solution. Reviewing AI output is not the same as deeply understanding it.

**The vibe coding hangover is real.** Context Studios' analysis documented: 45% of AI-generated code with security issues, 2.25x more business logic bugs, 1.97x more missing error handling, 2.27x more null reference risks ([Context Studios, 2026](https://www.contextstudios.ai/blog/the-vibe-coding-hangover-why-developers-are-returning-to-engineering-rigor)). These numbers are from CodeRabbit's analysis of 10 million pull requests. Obong's "not vibe coding, it's engineering" distinction is correct — but the production evidence for code *quality* remaining high under AI-assisted development requires much more rigorous measurement than individual practitioner accounts.

**The AI Productivity Paradox at team scale.** Faros AI's study of 10K+ developers found the "AI Productivity Paradox": individual coding speed increases (21% more tasks, 98% more PRs) but PR review times increase 91%. The net delivery pipeline impact was neutral or negative for teams that didn't address the review bottleneck. Obong writes about his own productivity; he doesn't address what happens when a team of 10-50 engineers all apply this workflow simultaneously and their code review pipeline explodes.

---

### 4. The Emerging Consensus: Where the Field Is Settling

Despite the "solved problem" vs. "not so fast" debate, a practical consensus is forming:

**The right mental model: AI as productivity multiplier, not autonomous developer.**

Simon Willison's distinction became influential: *"If an LLM wrote every line but you reviewed, tested, and understood everything, that's using an LLM as a typing assistant"* — and that's fine and valuable. Vibe coding (approve without review) is not. ([Context Studios synthesis](https://www.contextstudios.ai/blog/the-vibe-coding-hangover-why-developers-are-returning-to-engineering-rigor))

**The context-awareness framework for when AI code is appropriate:**

- Throwaway prototypes and internal tools → aggressive AI use is fine, vibe coding acceptable
- Scaffolding, boilerplate, and well-understood patterns → AI with light review
- Core business logic → AI with mandatory human specification and thorough review
- Security-critical code (auth, payments, encryption) → AI as a starting point only, expert human audit required
- Regulated domains (healthcare, finance, compliance) → additional validation gates regardless of AI involvement

**Model selection became the dominant variable in 2026.** The Bored Hacking blog argues convincingly: "The biggest variable between AI slop and production-grade code isn't your prompting technique — it's the model you pick and the feedback loops you build around it." ([Bored Hacking, 2026](https://boredhacking.com/coding-with-llms-2026/)) Cheap models cost more in engineering time to correct than they save in tokens.

**Feedback loops are now more important than prompting skill.** The bottleneck shifted from "can I get the model to do what I want?" to "how fast can I verify it didn't break anything?" This means:
- Comprehensive test suites are the #1 force multiplier for AI coding
- SAST/linter integration that feeds errors back to the model is table stakes
- CI/CD that runs on every AI-generated commit, not just merges to main

**Addy Osmani's synthesis (Google Chrome Engineering Lead)** represents the mature practitioner position:
- Treat AI as "over-confident and prone to mistakes" — never as autonomous
- "Never commit code you can't explain" — hard rule, no exceptions
- Use code review loops: spawn a second AI session to critique output from the first
- Commit early and often as save points; rollback is your friend
- Bolster quality gates going into 2026: more tests, monitoring, AI-on-AI review
([Osmani, addyosmani.com](https://addyosmani.com/blog/ai-coding-workflow/))

**The senior-junior asymmetry is a significant unresolved problem.** Obong's claim holds for experienced engineers who can evaluate AI output critically. For junior developers — who lack the mental models to spot incorrect solutions, miss security issues, and build fragile systems — the calculus is different. The METR RCT hints at this: the fastest AI user had 50+ hours of specialized tool experience. The slowest users had less experience. AI amplifies existing skill levels, which means it may simultaneously make senior engineers dramatically more productive while making junior engineers more dangerous.

---

### 5. The Critical Blindspot: Organizational and Systemic Effects

Obong's piece is an individual practitioner's account. The most underexplored dimension is what happens at organizational scale:

**Shared agentic workflows are largely missing.** The Bored Hacking analysis notes: "Most companies lack shared agentic workflows, creating isolated productivity gains rather than enterprise-wide velocity improvements." Individual SDD practitioners don't compound; they remain isolated. Building team-level AI practices requires additional infrastructure (shared CLAUDE.md files, standardized review processes, collective quality gates) that no current tool provides out-of-the-box.

**Review process must co-evolve.** The AI Productivity Paradox (Faros AI) shows 98% more PRs without proportional review capacity is a recipe for bottleneck. "AI-first teams" in 2026 are investing as heavily in AI-assisted code review (AI-on-AI review loops, automated PR analysis, AI-enhanced static analysis) as in AI generation.

**Knowledge transfer and onboarding degrade.** When codebases fill with AI-generated code that no human deeply understands, onboarding new engineers becomes harder, not easier. The "comprehension debt" concept points to a future problem that current AI productivity metrics don't measure: what does a codebase look like in 3 years if 80% of it was generated by AI under SDD-style workflows, and the engineers who oversaw its generation have turned over?

---

### 6. Verdict: The Honest Assessment

**Obong is right that methodology is the lever.** The "magic wand vs. power tool" framing is the correct mental model. His SDD workflow is coherent, well-specified, and convergent with independent practitioner consensus. For an experienced engineer who invests the time to master it, writing most production code with LLM assistance is achievable in 2026.

**Obong overstates the "solved" claim in three ways:**
1. "Solved" implies it works for most developers in most contexts — the METR RCT, the junior-senior gap, and the lack of shared organizational practices all argue otherwise.
2. "Solved" implies security is covered — it isn't. 45% vulnerability rate requires systematic SAST, which SDD doesn't address.
3. "Solved" implies the full engineering lifecycle — SDD addresses generation and immediate review, but not comprehension debt, knowledge transfer, and long-term maintenance.

**The accurate framing:** *High-quality production code with LLMs is achievable for disciplined senior engineers using spec-first workflows with robust automated quality gates, in 2026. It is not yet a solved problem at team or organizational scale, and security requires additional systematic tooling beyond the SDD framework.*

---

## Open Questions

1. **Does SDD work below a certain experience threshold?** The METR RCT suggests a high skill ceiling. Is there a minimum experience level (years, domain knowledge, prior codebase familiarity) below which SDD produces negative value?

2. **What does the long-term maintenance curve look like?** Do AI-assisted codebases accumulate more or less technical debt over 2-3 year horizons? No longitudinal study exists yet.

3. **Can comprehension debt be operationalized as a metric?** Could tools measure the ratio of "owned" vs. "reviewed but not deeply understood" code? This would require new developer tooling.

4. **What's the team-level version of SDD?** How do you standardize SDD practices across a team of 20, ensure shared CLAUDE.md files evolve effectively, and prevent divergent individual workflows?

5. **How does model improvement change the equation?** Obong credits Claude Sonnet 3.7 as the inflection point. Opus 4.6 and GPT-5.3 are now the baseline. Do successive model generations make the "experienced engineer required" constraint weaker? Or does the complexity ceiling simply move up?

6. **Security-first SDD:** Can the SDD framework be extended with security-specific steps (threat modeling, SAST gate, security review spec criteria) that systematically address the 45% vulnerability rate?

---

## Extracted Principles

The following principles were updated in `principles/ai-tool-adoption.md`:

- **SDD as Methodology, Not Workflow Hack** — The SDD pattern (Conversation → Spec → Atomic Tasks → Sequential Execution) is the well-validated methodology for LLM production code, not a trick. Source: Obong, Osmani, Thoughtworks, AWS Kiro — independent convergence.
- **Context Windows Are an Engineering Constraint** — Compact at ~20% remaining context, use handoff documents for long sessions, decompose tasks to fit within a single context window. Treat as a resource to manage, not a bug to work around.
- **Security Is a Gap in SDD** — No spec-driven development framework yet systematically addresses the 45% AI-generated code vulnerability rate. SAST integration and security-specific review steps must be added explicitly.
- **Comprehension Debt Is the Long-Term Risk** — Velocity metrics don't capture comprehension debt. Teams must enforce "never commit code you can't explain" as a hard rule, not a soft principle.
- **Organizational Scale Requires Shared Infrastructure** — Individual SDD productivity does not compound into team productivity automatically. Shared context files, standardized review processes, and AI-on-AI review loops are required investments.

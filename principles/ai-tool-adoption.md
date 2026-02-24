# AI Coding Tool Adoption

## Summary

Principles for training developers and teams on AI coding tools (Claude Code, Cursor, Copilot, etc.). Covers individual workflow patterns, team training programs, enterprise rollout, metrics, and the junior/senior skill asymmetry. Synthesized from practitioner accounts (Boris Cherny/Claude Code team, @wjonesy), enterprise telemetry (Faros AI, 10K+ devs), and thought leadership (Addy Osmani, Pragmatic Engineer) as of early 2026.

## Principles

### Spec First, Prompt Second
- **What:** Write detailed specifications — acceptance criteria, edge cases, architecture decisions — before engaging the AI. This is the single highest-leverage intervention for AI-assisted development quality.
- **Why:** Every successful practitioner and enterprise guide independently converges on this. Better specs → better AI output. Vague prompts → vague code. Osmani calls skipping specs the #1 anti-pattern.
- **When:** Every task beyond trivial one-liners. For complex tasks, use plan mode and invest energy there before implementation. Have a second AI review the plan as a staff engineer.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Osmani, Boris Cherny, wjonesy, Faros AI — all independent)

### Train Behavior, Not Features
- **What:** Focus training on changing developer habits and mental models, not tool features. The bottleneck is human, not technical. Teach: scope ambition, critical evaluation, spec writing, outcome thinking.
- **Why:** wjonesy's 6 tactics for 30+ devs contain zero tool-specific advice. All behavioral. Enterprise data shows only 15% naturally adopt new tools — the rest need structured behavioral change programs.
- **When:** Any team rollout. Start with mindset (what's possible, what can go wrong) before mechanics (features, shortcuts, configuration).
- **Source:** research/2026-02-15-ai-coding-team-training.md (wjonesy, Faros AI, GitLab)

### Start Big to Shift Mental Models
- **What:** Ban small asks during the first week of training. Force developers to attempt full features and module-level refactors. Small asks reinforce the AI-as-autocomplete mental model.
- **Why:** Developers who start small rarely graduate to big. Developers who start big immediately understand AI as a collaborator, not a fancy tab-complete. They calibrate expectations correctly from day one.
- **When:** Week one of any training program. After the mindset shift, developers naturally find their own balance of big and small tasks.
- **Source:** research/2026-02-15-ai-coding-team-training.md (wjonesy)

### Test as the Quality Gate
- **What:** Comprehensive test suites are the single biggest differentiator between production-grade AI-assisted development and "vibe coding." Tests enable confident delegation; without them, AI cheerfully declares broken code done.
- **Why:** AI-assisted teams ship 10x more security findings and dramatically more architectural flaws. Tests are the automated check that catches what humans miss at speed. TDD with AI is more valuable than TDD without AI.
- **When:** Every AI-assisted task touching production code. Write tests before or alongside AI-generated code. Use test failures as feedback for the AI to iterate.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Osmani "agentic engineering," Faros AI security data)

### Pair Prompting for Evaluation Skills
- **What:** Pair developers — one prompts, one critiques the output. Rotates naturally. Teaches critical evaluation of AI output instead of passive acceptance.
- **Why:** Solo AI usage creates acceptance bias. Developers accept output they wouldn't accept from a colleague. The critic role forces evaluation. Maps to pair programming patterns developers already know. Especially valuable for juniors learning to evaluate code quality.
- **When:** Training programs, onboarding new AI tool users, high-stakes features. Can evolve into async review once the evaluation habit is established.
- **Source:** research/2026-02-15-ai-coding-team-training.md (wjonesy)

### Parallelize with Git Worktrees
- **What:** Run 3-5 Claude sessions simultaneously, each in its own git worktree. This is the single biggest productivity unlock according to the Claude Code team. Use shell aliases to hop between worktrees.
- **Why:** AI sessions involve waiting. Parallelizing turns wait time into work time on other tasks. Dedicated worktrees prevent merge conflicts and context pollution between sessions.
- **When:** Any workflow involving multiple independent tasks. Keep one "analysis" worktree for read-only operations (logs, queries). Scale back if context-switching cost exceeds parallel benefits.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Boris Cherny, Claude Code team)

### Invest in Self-Evolving Project Rules
- **What:** Maintain a CLAUDE.md (or equivalent rules file). After every AI correction, add: "Update your CLAUDE.md so you don't make that mistake again." Ruthlessly edit over time until the AI's mistake rate measurably drops.
- **Why:** Creates a learning loop where the AI gets better at your specific codebase over time. Encodes team conventions, architectural decisions, and known pitfalls. Claude is good at writing rules for itself.
- **When:** Every project. Start simple, grow organically. Commit to git so the whole team benefits. Point rules at per-project notes directories for persistent context.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Boris Cherny, Claude Code team)

### Address the Full Pipeline, Not Just Coding
- **What:** Training and adoption programs must address review, testing, deployment, and security — not just the coding step. Coding is only ~40% of software engineering.
- **Why:** The AI Productivity Paradox: individual coding speed gains (21% more tasks, 98% more PRs) are negated by 91% longer PR reviews. Downstream processes become the bottleneck. Teams that only train on prompting see unchanged delivery timelines.
- **When:** Enterprise rollouts. Budget equal or greater effort for review process improvements, security tooling, and CI/CD automation as for the AI tool itself.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Faros AI 10K+ dev study, Stack Overflow)

### Account for the Senior-Junior Asymmetry
- **What:** AI amplifies existing skill levels. Seniors get faster (AI accelerates known patterns). Juniors get more dangerous (accept incorrect solutions, miss security issues, build fragile systems). Training must differ by experience level.
- **Why:** The knowledge paradox is well-documented across multiple sources. Juniors using AI before building fundamentals risk skill atrophy. The "two steps back" cycle — fixing one bug creates new ones — hits juniors hardest because they lack mental models.
- **When:** Always. Juniors need fundamentals (systems design, security, testing) alongside AI training. Use pair prompting for juniors. Don't assume AI reduces the need for fundamentals — the opposite is true.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Osmani, Pragmatic Engineer, Coder.com, Stack Overflow)

### Measure Outcomes, Not Activity
- **What:** Track features completed, lead time reduction (target 20-50%), deployment frequency, time from idea to working thing. Do NOT track lines of code, prompts per day, or AI suggestion acceptance rates.
- **Why:** Activity metrics incentivize AI slop. Outcome metrics incentivize value delivery. Self-reported "time saved" is unreliable. Enterprise guides unanimously warn against vanity metrics.
- **When:** From pilot onwards. Expect 3-6 months for full productivity benefits regardless of tool. Use DORA metrics as baseline.
- **Source:** research/2026-02-15-ai-coding-team-training.md (wjonesy, Faros AI, GitLab, DX)

### Build Reusable Skills and Automation
- **What:** Turn recurring workflows into skills/slash commands committed to git. If you do something more than once a day, automate it. Examples: `/techdebt`, context sync commands, analytics agents, code review checklists.
- **Why:** Moves team knowledge from individual habit to shared infrastructure. New team members inherit best practices automatically. The differentiation is moving from tooling to workflow design.
- **When:** After the team has 4-8 weeks of experience and recurring patterns are visible. Don't over-automate before understanding actual workflows.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Boris Cherny, aidd framework, wjonesy)

### Use Crawl-Walk-Run Rollout
- **What:** Phase adoption: pilot (20-25 devs, weeks 1-6) → learn (A/B tests, surveys, weeks 7-18) → run (scale with measured criteria, week 19+). Include champions, skeptics, and representative developers in the pilot.
- **Why:** Organizations jumping straight to "run" fail despite clear business outcomes. Only 15% naturally embrace new tools. Structured enablement, champions programs (20% of pilot as advocates), and A/B testing are required for lasting adoption.
- **When:** Enterprise rollouts. Smaller teams can compress timelines but should still follow the sequence. Select champions who are respected by peers, not just enthusiasts.
- **Source:** research/2026-02-15-ai-coding-team-training.md (Faros AI Launch-Learn-Run, GitLab, Coder.com)

### Code Health is a Prerequisite, Not an Output
- **What:** Verify that target code achieves a high Code Health score (CodeScene threshold: 9.5+) _before_ deploying AI agents to modify it. Refactor unhealthy code first, then use agents.
- **Why:** Peer-reviewed research (Borg & Tornhill, FORGE 2026, arxiv:2601.02200) shows AI coding assistants increase defect risk by 30%+ when applied to unhealthy code. Agents amplify existing problems — poor-quality code confuses AI the same way it confuses humans. Initial velocity gains are "fully cancelled out after two months" due to accumulated complexity.
- **When:** Always. Before assigning an agent to a module or file, check code quality signals first. The loveholidays case study demonstrates this works at organizational scale: 0→50% agent-assisted code in 5 months while maintaining quality — but only after adding guardrails.
- **Source:** research/2026-02-24-research-this-site.md (CodeScene, arxiv:2601.02200)

### Three-Tier Quality Gates for Agent Output
- **What:** Enforce code quality at three sequential points: (1) continuous feedback during generation, (2) pre-commit checks on staged files, (3) PR pre-flight analysis comparing branches against baseline. No single gate is sufficient.
- **Why:** Defense-in-depth — each gate catches different failure modes. Continuous catches problems early before they compound. Pre-commit enforces standards at the developer loop. PR pre-flight catches systemic regressions. The speed of agent output makes any manual verification process a bottleneck — all three gates must be automated.
- **When:** Any team using AI agents for code generation. Implement before scaling up agent usage. The CodeScene MCP server provides Code Health analysis as AI-accessible tools to enable the continuous feedback tier.
- **Source:** research/2026-02-24-research-this-site.md (CodeScene inner developer loop, MCP server)

### Objective Metrics Over Vague Workflow Instructions
- **What:** When encoding quality gates in AGENTS.md/CLAUDE.md, use objective, measurable criteria (Code Health ≥ 9.5, coverage ≥ 80%) rather than vague instructions ("write maintainable code," "ensure good test coverage"). Measurable workflow gates are the exception to the minimal-context-file rule.
- **Why:** LLMs interpret vague instructions inconsistently. "Write maintainable code" means nothing operationally. "Trigger refactoring loop if Code Health drops below 9.0" is unambiguous and produces consistent behavior. The reconciliation with the minimal-context-file research: vague conventions are harmful, but specific measurable workflow gates produce quantifiable quality improvement.
- **When:** Any AGENTS.md that includes quality guidance. Replace all vague quality adjectives with specific thresholds. If you can't measure it, don't encode it — encode the tool + measurement approach instead.
- **Source:** research/2026-02-24-research-this-site.md (CodeScene AGENTS.md pattern)

### Human Tests, Agent Code — Never the Reverse
- **What:** AI agents should generate implementation code, not tests. Human-written tests provide the essential double-bookkeeping that validates agent output. Use automated coverage enforcement (e.g., 99% threshold) to prevent agents from deleting tests instead of fixing the underlying failures.
- **Why:** AI can generate both buggy code and a test that passes the buggy code — defeating the entire purpose of testing. CodeScene research specifically identifies "negating logic, removing keywords, inverting conditions" as AI error patterns that only human-written tests reliably catch. Agents also have a documented tendency to delete failing tests as a shortcut.
- **When:** Always. Coverage gates enforce compliance mechanically — if tests are deleted, coverage drops and the gate fails. This converts a probabilistic instruction ("don't delete tests") into a deterministic constraint.
- **Source:** research/2026-02-24-research-this-site.md (CodeScene guardrails research, principle: human tests as protection layer)

## Revision History
- 2026-02-15: Initial extraction from AI coding team training research session. 12 principles from 8+ sources.
- 2026-02-24: Added 4 principles from CodeScene agentic AI patterns research: code health prerequisite, three-tier quality gates, objective metrics in AGENTS.md, human tests over AI tests. (12→16 principles)

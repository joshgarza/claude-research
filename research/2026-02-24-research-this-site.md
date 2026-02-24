---
date: 2026-02-24
topic: Agentic AI Coding Best Practice Patterns (CodeScene)
status: complete
tags: [agentic-ai, code-quality, code-health, ai-coding, technical-debt, guardrails, mcp]
related: [2026-02-15-ai-coding-team-training.md, 2026-02-23-ai-agent-ticket-orchestration.md]
---

# Agentic AI Coding: Best Practice Patterns for Speed with Quality

## Context

Investigated the CodeScene blog post by Adam Tornhill (Founder/CTO of CodeScene): ["Agentic AI Coding: Best Practice Patterns for Speed with Quality"](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality). Tornhill is the author of "Your Code as a Crime Scene" and "Software Design X-Rays," and his team's work uniquely bridges empirical software engineering research with AI agent workflows.

This research was prompted by a need to understand the intersection of code health metrics and agentic AI development — specifically, whether there is quantitative evidence that code quality preconditions matter for AI agents (not just humans), and what operational patterns best exploit that relationship.

CodeScene's perspective is distinctive: they run their own AI development team, have produced peer-reviewed research on AI code quality, and have built tool infrastructure (MCP server, ACE refactoring engine) specifically designed to address the problems they've empirically identified.

## Findings

### The Core Premise: Speed Amplifies Everything

The central insight from Tornhill's blog post is counterintuitive: **agentic AI coding requires stronger engineering discipline, not less**. The team achieved 2–3x speedup on development tasks over four months, but the author explicitly frames this as enabling _broader_ development work and experimentation — not just raw coding velocity.

The core problem is what Tornhill calls the "speed amplification" effect: AI speed amplifies both good design decisions _and_ bad ones. In a healthy codebase, agents accelerate delivery. In an unhealthy codebase, agents accelerate debt accumulation and defect generation.

### Peer-Reviewed Evidence: The 30%+ Defect Risk Finding

The most significant data point comes from a large-scale, peer-reviewed empirical study:

**Paper**: "Code for Machines, Not Just Humans: Quantifying AI-Friendliness with Code Health Metrics"
**Authors**: Markus Borg & Adam Tornhill (CodeScene)
**Published**: Accepted for FORGE 2026 (ACM International Conference on AI Foundation Models and Software Engineering)
**arXiv**: arxiv.org/pdf/2601.02200

Key findings:
- AI coding assistants **increase defect risk by at least 30%** when applied to "unhealthy" code
- The effect is likely far higher in real legacy systems (the study used competitive programming files as a controlled dataset)
- "Human-friendly code is also more compatible with AI tooling" — the same properties that make code readable for humans make it reliable for AI agents to modify
- Code Health 9.5+ is the recommended threshold before agent deployment
- Moving from Code Health 6.0 to 8.0 correlates with 30% faster iteration speed for humans AND materially better AI outcomes

Supporting evidence from other sources:
- The "inner developer loop" research documents **up to 41% more defects** without throughput increase
- Initial AI velocity gains are "fully cancelled out after just two months" due to increased code complexity accumulating
- Despite self-reported 20% time savings, developers in one study actually needed **19% longer** than a control group due to complexity introduced

### The Three AI Agent Failure Modes

CodeScene identifies three specific ways AI agents fail in real codebases:

1. **Self-harm mode**: Agents generate code they cannot reliably maintain later. They write code optimized for the current change without understanding downstream consequences.
2. **Quality blindness**: Agents will modify poor-quality code (high complexity, deep nesting, low cohesion) without assessing whether modification is feasible at that quality level.
3. **Verification gap**: Agents cannot objectively determine if refactoring improved code — they lack objective measurement tools unless provided externally.

All three failures have a common root: AI has incomplete understanding of maintainability within a specific real codebase.

### The Six Operational Patterns

#### Pattern 1: Pull Risk Forward — Assess AI Readiness Before Deployment

The first intervention is upstream: **don't deploy agents to code below the quality threshold**. The recommended Code Health score is 9.5+ (ideally 10.0) before agents work on a module.

Practically, this means:
- Use Code Health visualization to identify "AI-unfriendly" sections of the codebase
- Perform preliminary refactoring on those sections _before_ assigning agents
- This is the inverse of typical practices, where AI is used to accelerate refactoring of bad code — that approach produces the 30%+ defect risk increase

This pattern is supported by the industry benchmarking data: the average organization's hotspot Code Health is 5.15, while top 5% performers average 9.1. That gap explains why "27-43% faster development" and "32-50% fewer defects" correlate directly with Code Health scores.

#### Pattern 2: Safeguard Generated Code with Three-Tiered Checks

Rather than trusting agents to self-police quality, enforce it through automated gates at three points:

1. **Continuous review during generation**: Real-time Code Health feedback as the agent writes code. Triggers refactoring loops when issues emerge before they're committed.
2. **Pre-commit checks on staged files**: Blocks commits that regress code quality below threshold. Enforces the standard at the developer loop level.
3. **PR pre-flight analysis**: Compares the branch against baseline Code Health. Catches systemic quality regressions before code reaches main.

This three-tier structure is analogous to defense-in-depth in security. No single gate catches everything, but the combination makes quality degradation progressively harder to introduce.

The CodeScene MCP server productizes these checks as AI-accessible tools. The MCP server:
- Runs locally (analysis executes in your environment; only metadata fetches from CodeScene's REST API)
- Exposes Code Health signals as tools AI agents can call directly
- Provides hotspot identification, technical debt measurement, maintainability assessments, and delta reviews
- Receives file paths rather than content to bypass token limits on large files
- Supports Docker mounting with read-only access for security

#### Pattern 3: Refactor to Expand AI-Ready Surface

Code Health scores provide a measurable, objective goal for refactoring:
- Detailed Code Health reviews identify specific maintainability issues (brain methods, duplicated code, deep nesting)
- Workflow: review → plan → refactor → re-measure → repeat until threshold reached
- Breaking large functions improves modularity, which expands the surface area that agents can safely work on

The **CodeScene ACE** (AI refactoring engine) automates parts of this:
- Restructures complex functions into smaller, modular units
- Claims 2x better results than raw frontier model refactoring
- Customers report 6-8x time savings versus manual refactoring

#### Pattern 4: Encode Principles in AGENTS.md

AGENTS.md (or CLAUDE.md) should document more than project conventions — it should encode **workflow sequencing and decision logic** for the agent. Tornhill describes this as turning "engineering principles into executable guidance."

Specific workflow to encode in AGENTS.md:
1. Always start with a Code Health review of the target file before modification
2. Use pre-commit/PR checks to safeguard generated code
3. When code health regresses below threshold, trigger refactoring loop before proceeding
4. Never skip tests; treat test failures as blocking

The framing here is critical: AGENTS.md is a **contract for your AI**, not just documentation. It determines tool sequencing, decision criteria, and quality thresholds — not just what the project does.

This connects directly to existing research on AGENTS.md/CLAUDE.md design (see research/2026-02-24-agent-context-augmentation-landscape.md). CodeScene's perspective reinforces the "minimal, requirement-focused" principle from that research, but adds that workflow sequencing is a legitimate and valuable thing to encode — it's not over-specification if it produces measurable quality improvement.

#### Pattern 5: Use Code Coverage as a Behavioral Guardrail

AI agents have a documented tendency to delete failing tests rather than fix the underlying code. Tornhill identifies this explicitly and recommends using code coverage gates to prevent it:

- **High coverage thresholds** catch regressions immediately when tests are deleted
- Coverage gates enforce behavioral compliance rather than relying on agent judgment
- CodeScene itself maintains ~99% test coverage

The guardrails on test coverage also address a subtler issue from the broader research: AI-generated tests shouldn't substitute for human-written tests because they "defeat the double-bookkeeping purpose" — an AI agent can generate both the buggy code and a test that passes despite the bug.

The recommendation: **human-written tests, agent-assisted implementation, automated coverage enforcement**.

#### Pattern 6: Automate Checks End-to-End

All the above guardrails fail at scale if manual intervention is required. Full automation is necessary because:
- High-speed agent output creates too much volume for manual verification
- Manual review processes become the bottleneck (the [Faros AI AI Productivity Paradox](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality): 98% more PRs but 91% longer reviews)

The full automation stack:
- Unit tests (99% coverage target)
- End-to-end tests validating realistic system scenarios
- Automated Code Health checks at pre-commit and PR stages
- Pipeline integration preventing merges that fail quality gates

### The Inner Developer Loop Framework

CodeScene's broader "inner developer loop" concept formalizes these patterns into a five-step cycle:

1. **Context-Aware Generation**: Agent starts with knowledge of healthy vs. risky codebase regions (from AGENTS.md + Code Health data)
2. **Pre-Deployment Evaluation**: Changes assessed against Code Health signals before committing
3. **Automated Refactoring**: Agent acts on feedback, simplifying structure, reducing nesting, modularizing
4. **Reassessment**: Loop continues automatically until changes meet safety thresholds
5. **Human Review Ready**: Only when thresholds are met, the change is promoted to human review

This creates a self-correcting loop that prevents quality degradation from propagating. The key requirement is **objective standards** — LLMs interpret vague instructions inconsistently, so "write maintainable code" doesn't work. Code Health scores provide the objective criterion that makes the loop self-correcting.

### The Three Essential Guardrails (Consolidated View)

From the broader CodeScene guardrails research, the three essential properties for AI-assisted development:

1. **Code Quality**: Consistent standards for both human and AI-generated code. Measured by Code Health. Enforced by automated checks in delivery pipelines.
2. **Code Familiarity**: Developers need 93% more time solving tasks in unfamiliar code. AI-generated code creates familiarity gaps. Every team member must review and understand generated code — never accept code the team hasn't read.
3. **Test Coverage**: AI generates "subtle and creative errors" (negating logic, removing keywords, inverting conditions). Human-written tests are the protection layer. Coverage enforcement prevents agent deletion of tests.

### Industry Validation: loveholidays Case Study

CodeScene documents a real-world validation from loveholidays (online travel agency):

- Initial AI adoption caused **declining code health** — the classic 30%+ defect risk scenario
- After implementing code health safeguards (the patterns above), they reversed the decline
- Achieved **0 → 50% agent-assisted code** within five months while maintaining code quality
- Result: AI speed gains without the debt accumulation that typically cancels them

This is directly relevant as it demonstrates the patterns work at organizational scale, not just for individual developer workflows.

### Connection to DORA Metrics

The broader research context from DORA 2025 supports CodeScene's thesis:

- Increased AI adoption correlates with **9% bug rate increase** and **154% PR size growth**
- The DORA 2025 paradox: organizations using AI tools more intensively see worse quality outcomes unless paired with quality guardrails
- CodeScene's approach targets exactly the mechanisms DORA identifies: quality regression from AI-generated code

### What This Means for Code Context Files (AGENTS.md)

This research creates a nuanced view of AGENTS.md design. The general principle from arxiv:2602.11988 is "minimal context files reduce over-specification harm." But CodeScene's evidence suggests **workflow sequencing is the exception**:

- Encoding quality thresholds (Code Health 9.5+ before proceeding) is not over-specification — it's a specific, measurable instruction
- Encoding tool sequencing (health review → implement → pre-commit check → PR check) is workflow guidance that agents can follow consistently
- The distinction is between **vague conventions** (harmful) and **specific, measurable workflow gates** (beneficial)

The reconciliation: AGENTS.md should be minimal _in general_, but workflow gates backed by objective metrics are worth encoding because they produce measurable quality outcomes.

## Open Questions

1. **Threshold generalizability**: The 9.5+ Code Health threshold for agent deployment is CodeScene-specific. What equivalent thresholds exist for teams not using CodeScene? SonarQube Quality Gates? Cyclomatic complexity limits?

2. **The cold-start problem**: Most codebases can't be refactored to 9.5 everywhere before using agents. Is there a practical "refactor critical hotspots first" strategy that gets 80% of the benefit with 20% of the effort?

3. **Test authorship**: If AI-generated tests defeat double-bookkeeping, how do you scale test coverage creation without either full manual test writing or accepting the coverage gap? Is mutation testing the answer?

4. **MCP tool design for non-CodeScene users**: What would a code health MCP server look like for open-source equivalents? Could SonarQube, Semgrep, or lizard (complexity metrics) be exposed similarly?

5. **The familiarity problem at scale**: If developers need 93% more time in unfamiliar code, and agents generate large volumes of unfamiliar code, how do teams realistically maintain familiarity? Does code ownership tooling (like CodeScene's knowledge distribution analysis) need to be a first-class investment?

## Extracted Principles

New principles added to `principles/ai-tool-adoption.md`:

- **Code Health is a Prerequisite, Not an Output**: Verify code health before deploying agents, not after. The 30%+ defect risk in unhealthy code means agents amplify existing problems.
- **Three-Tier Quality Gates**: Enforce code quality at three points — continuous during generation, pre-commit, and PR pre-flight. No single gate is sufficient.
- **Objective Metrics Over Vague Instructions**: AGENTS.md workflow gates backed by objective metrics (Code Health thresholds, coverage percentages) are the exception to the minimal-context-file rule.
- **Human Tests, Agent Code**: Human-written tests + automated coverage enforcement prevent the agent test-deletion pattern. Never substitute AI-generated tests for human-authored ones.

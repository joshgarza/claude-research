---
date: 2026-02-24
topic: Team & Process Practices
status: complete
tags: [code-review, adrs, tech-debt, on-call, documentation]
---

# Team & Process Practices

## Context

Engineering excellence is not just about individual technical skills — it is equally about shared practices that keep teams aligned, codebases healthy, and systems reliable over time. This research covers five interconnected process pillars: code review standards, Architecture Decision Records (ADRs), technical debt tracking, on-call from the developer's perspective, and documentation standards. These are the "operational system" of an engineering team, analogous to how CI/CD is the operational system for deployments. Weak practices here compound quietly for months before they become visible crises.

---

## Findings

### 1. Code Review Standards

#### The Core Standard

Google's [Code Review Standard](https://google.github.io/eng-practices/review/reviewer/standard.html) establishes the best first principle: *"A reviewer should approve a CL once it is in a state where it definitely improves the overall code health of the codebase, even if the CL isn't perfect."* This single rule transforms code review from a perfection gate into a forward-motion mechanism. The goal is continuous improvement, not correctness theater.

Corollary: reviewers bear ownership responsibility for the code they approve. "Approving for the sake of unblocking" is a debt accumulation mechanism.

#### PR Size and Turnaround Time Benchmarks

The data from [Graphite](https://graphite.com/guides/tracking-improving-code-review-turnaround) and [LinearB](https://linearb.io/blog/dora-metrics) is clear:

- **PR size target**: 200–400 lines. Above 400 lines, defect discovery rates drop significantly.
- **First review target**: < 4 hours from PR creation to first comment.
- **Review completion target**: < 24 hours from submission to approval or merge.
- **Rot threshold**: After 3 days without merge, PRs begin to rot — authors context-switch, merge conflicts accumulate, reviewers disengage.

Research shows that reducing pickup and review time alone can improve code velocity by up to 63% ([LinearB](https://linearb.io/blog/dora-metrics)).

#### Code Review Metrics

Measuring the review process ([Qodo](https://www.qodo.ai/blog/code-review-best-practices/), [DX](https://getdx.com/blog/code-review-checklist/)):

| Metric | Definition | Target |
|---|---|---|
| Inspection rate | LOC reviewed per hour | 150–500 LOC/hr |
| Defect discovery rate | Defects found per review hour | Track trend, not absolute |
| Defect density | Defects per KLOC | Track trend |
| Review turnaround time | Submission → approval | < 24 hours |
| PR size | Lines changed per PR | 200–400 LOC |

Track these with tools like Swarmia, LinearB, or Graphite. Treat rising turnaround time as a team health signal, not an individual performance signal.

#### What Humans Should Focus On (vs. Automation)

[Microsoft's Engineering Fundamentals Playbook](https://microsoft.github.io/code-with-engineering-playbook/code-reviews/process-guidance/reviewer-guidance/) is explicit: automated tools handle linting and style. Human reviewers should focus on:

- **Business logic correctness** — does the code do what the ticket says?
- **Architectural fit** — does this change fit future system evolution? Does it introduce new patterns inconsistently?
- **Edge cases and error handling** — not covered by linters
- **Security and PII** — reviewers are the last human gate before production
- **Test quality** — not just coverage existence, but whether tests validate actual behavior

#### Culture and Feedback Language

High-performing code review cultures share two traits ([Qodo](https://www.qodo.ai/blog/code-review-best-practices/), [Microsoft](https://microsoft.github.io/code-with-engineering-playbook/code-reviews/process-guidance/reviewer-guidance/)):

1. **Psychological safety** — team members can raise concerns without fear of judgment
2. **Question over statement** — "What was the reasoning here?" over "This is wrong"

Specific language patterns:
- Use `Nit:` prefix for non-blocking style suggestions
- Reference "this line" or "we" instead of "you"
- Explain *why* a change is needed, not just *that* it's needed
- When disagreement is unresolved, have a direct conversation, then document the outcome in the PR

#### Author Responsibilities

Code review quality starts before the PR is opened:
- Write a clear PR description with context and testing steps
- Link to the relevant ticket/issue
- Self-review before requesting others
- Keep PRs scoped to a single logical change
- Flag areas of uncertainty explicitly for reviewers

Use GitHub/GitLab PR templates to enforce this at scale.

#### Automation Integration

Automate everything that doesn't require human judgment:
- Linting, formatting, type checking in CI
- Security scanning (Semgrep, CodeQL) as mandatory checks
- Test coverage thresholds as soft/hard gates
- PR size warnings for PRs over 400 LOC
- Require review from CODEOWNERS for sensitive files

This frees reviewers to focus on architecture and logic, which is where human judgment is irreplaceable.

---

### 2. Architecture Decision Records (ADRs)

#### Core Purpose

An ADR documents a single architectural decision with its context, rationale, and consequences. The value is not the current decision — it's why it was made and what tradeoffs were accepted. This prevents "why do we use X?" rehashing and accelerates onboarding.

From [adr.github.io](https://adr.github.io/): "An Architectural Decision (AD) is a justified design choice that addresses a functional or non-functional requirement that is architecturally significant."

**Architecturally significant** means: would changing this decision require significant rework? Examples:
- Choice of primary database
- Authentication strategy
- API paradigm (REST vs tRPC vs GraphQL)
- Monorepo vs multi-repo
- Deployment target (Vercel vs Cloud Run vs K8s)
- State management approach

Not every technical decision warrants an ADR. Routine implementation choices don't. The signal is whether the decision has meaningful, long-lasting consequences or has cross-cutting impact.

#### Templates

Three widely-used templates ([ADR GitHub org](https://adr.github.io/adr-templates/)):

**Nygard (minimal)** — Use for simple decisions:
```markdown
# Title

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-NNN]

## Context
The problem we're solving and constraints we're working within.

## Decision
What we decided to do.

## Consequences
What becomes easier or harder as a result.
```

**MADR (Markdown ADR)** — Use for complex decisions with multiple options:
```markdown
# Title

## Status
Accepted

## Context and Problem Statement
[Description of the problem and why it matters]

## Decision Drivers
- [Driver 1]
- [Driver 2]

## Considered Options
- Option A
- Option B
- Option C

## Decision Outcome
Chosen option: [Option X]

### Positive Consequences
- [Consequence 1]

### Negative Consequences
- [Tradeoff accepted]

## Pros and Cons of the Options
### Option A
- Good, because [reason]
- Bad, because [reason]
```

**Y-Statement** — Use for quick capture:
> "In the context of [use case], facing [concern], we decided for [option] to achieve [quality], accepting [downside]."

[AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/) recommends MADR for cloud projects where tradeoff visibility matters.

#### Storage and Tooling

- Store ADRs in `docs/decisions/` or `adr/` in the repo, co-located with the code they govern
- Use sequential numbering (`0001-use-postgresql.md`)
- Commit ADRs in the same PR as the implementation when possible
- Mark superseded ADRs with a link to the replacement instead of deleting them

Tooling options:
- `adr-tools` CLI (Bash) for scaffolding
- `log4brains` for generating an ADR log site from Markdown
- GitHub wiki as fallback if not in-repo

#### Process and Governance

The [ADR GitHub org](https://adr.github.io/) recommends:
- ADR proposals open for comment for 48–72h before acceptance
- "Readout" review style: participants read independently then leave written comments (better than synchronous decision debates)
- Not every ADR needs unanimous agreement — document dissents as consequences

One ADR per decision. If you're documenting two decisions, write two ADRs.

---

### 3. Technical Debt Tracking

#### Fowler's Debt Quadrant

Martin Fowler's [Technical Debt Quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html) is the essential mental model:

|  | **Reckless** | **Prudent** |
|---|---|---|
| **Deliberate** | "We don't have time for design" | "We must ship now and deal with it later" |
| **Inadvertent** | "What's layering?" | "Now we know how we should have done it" |

The critical insight: **only Prudent/Deliberate debt is real strategic debt**. The other three quadrants are bugs, incompetence, or learning — and should be categorized accordingly. Treating inadvertent reckless debt as "strategic shortcuts" is rationalization.

#### Measurement

Tooling for measuring technical debt ([CodeAnt AI](https://www.codeant.ai/blogs/tools-measure-technical-debt), [Ones](https://ones.com/blog/tools-technical-debt-tracking/)):

**SonarQube** (industry standard):
- Static analysis: bugs, vulnerabilities, code smells
- Technical Debt Ratio (TDR) = remediation effort / total dev effort
- Healthy benchmark: **TDR < 5%**; many orgs operate at 10%+
- "Clean as You Code" — focuses enforcement on *new* code, not legacy
- Quality gates: block merges if new code exceeds debt threshold

**CodeScene** (behavioral analysis):
- Analyzes how teams *interact* with code, not just code structure
- Code Health metric based on 25+ factors validated against engineering outcomes
- Hotspot analysis: files where developers spend most time × highest complexity = highest risk
- 6x more accurate than SonarQube at predicting defect probability ([CodeScene](https://codescene.com/use-cases/sonarqube-vs-codescene))
- Identifies "actively rotting" code (high churn + high complexity)

**Recommendation**: Use SonarQube for enforcement (quality gates in CI), CodeScene for strategy (where to invest refactoring effort).

#### Time Allocation

From Shopify's "25% Rule" ([Graphite](https://graphite.com/guides/managing-technical-debt-strategies)):
- **10%** of each week: small debt items during regular work (opportunistic)
- **5%** of each week: larger debt projects on a monthly/quarterly cadence
- **Dedicated sprints**: major refactors warrant full-sprint allocation

The alternative — hoping debt gets addressed organically — consistently fails.

**Debt budgeting strategies**:
- Allocate 20% of sprint capacity to tech debt by default
- Use the "boy scout rule" in code reviews: leave code slightly better than you found it
- Flag debt items as `tech-debt` in your issue tracker immediately when identified (not "someday")

#### Backlog and Prioritization

The Technical Debt Priority Matrix (Impact vs. Effort):
1. **High impact / Low effort** — address immediately (quick wins)
2. **High impact / High effort** — schedule and fund properly
3. **Low impact / Low effort** — batch into regular maintenance
4. **Low impact / High effort** — consider deleting vs. refactoring

Track debt in Jira/Linear/GitHub Issues with a `tech-debt` label. Include:
- Where: file/module/service affected
- What: concrete description of the debt
- Why it matters: user-facing or developer-experience impact
- Estimated effort: T-shirt size
- Link to ADR if the debt was deliberately taken on

Communicate debt status to stakeholders in business terms: "this component has degraded to where adding new features takes 3x longer" lands better than TDR numbers.

---

### 4. On-Call from the Dev Side

#### The Core Contract

From [Google SRE Workbook](https://sre.google/workbook/on-call/): "Being on-call means being available during a set period of time, and being ready to respond to production incidents during that time with appropriate urgency."

The critical metric: **maximum 2 incidents per 12-hour shift**. If your team consistently exceeds this, halt feature development and focus exclusively on reliability improvements. This isn't SRE dogma — it's burnout prevention.

65–83% of DevOps professionals experience burnout, with on-call duties as a primary factor ([Alert Sleep via Medium](https://medium.com/@alertsleep/how-to-run-effective-on-call-rotations-without-burning-out-your-devops-team-c2b40db98311)).

#### Rotation Structure

Best practices from [Resend's Engineering Handbook](https://resend.com/handbook/engineering/how-we-handle-on-call-rotations) and [Google SRE](https://sre.google/workbook/on-call/):

- **Weekly rotation** with primary + backup engineer designated
- **Monday morning handover**: outgoing engineer briefs successor on ongoing issues, critical incidents, and runbook gaps discovered
- **Shared calendar** visible to the whole team, updated proactively
- **Swap policy**: engineers can swap rotations if communicated in writing and calendar updated

For team size:
- Minimum ~6 engineers to avoid on-call fatigue (each person on-call 1–2 weeks per quarter)
- For smaller teams: consider tighter but shorter rotations (3 days on, not 7)
- Service-specific rotations (each team owns their service) over monolithic "all-systems" on-call

#### During On-Call Shifts

Datadog's approach: **on-call engineers do only on-call work** during their shift ([Medium](https://medium.com/@alertsleep/how-to-run-effective-on-call-rotations-without-burning-out-your-devops-team-c2b40db98311)). Attempting feature development while on-call creates context-switch overhead and degrades both incident response and feature quality.

Positive use of quiet on-call time:
- Improve logging and metrics for unclear alerts
- Update runbooks where gaps were discovered
- Write new alerts for issues that were caught by logs but not instrumented
- This creates a positive feedback loop: better observability → quieter future shifts

#### Recovery After Incidents

- Provide full next day off if paged between 11 PM–7 AM
- 2–3 recovery days after particularly difficult on-call weeks
- These policies need to be written down and enforced by managers — "we'll be flexible" evaporates under delivery pressure

#### Runbook Standards

From [Google SRE Workbook](https://sre.google/workbook/on-call/) and [Parity](https://www.tryparity.com/blog/how-to-build-an-effective-runbook-for-on-call):

A good runbook entry includes:
1. **Alert name and severity** — what triggered it
2. **User impact** — what is the user experiencing?
3. **Immediate mitigation** — step-by-step (specific commands, not vague directions)
4. **Escalation path** — who to call if the runbook doesn't resolve it
5. **Context** — architecture diagram/link, relevant service dependencies
6. **Post-resolution steps** — what to verify, what to log

Rules:
- **Runbooks are owned by the team that owns the service** — SREs do not own runbooks for product services
- Update runbooks when corresponding alerts fire — fresh operational knowledge is most accurate immediately after an incident
- Runbooks should be testable: a new engineer should be able to follow them without asking questions
- Link runbooks from alert dashboards (PagerDuty, Grafana alerts, etc.)

#### On-Call Metrics

Track ([Resend](https://resend.com/handbook/engineering/how-we-handle-on-call-rotations)):
- **MTTD** (Mean Time to Detect): how quickly do alerts fire after a problem starts?
- **MTTA** (Mean Time to Acknowledge): how quickly does an engineer respond?
- **MTTR** (Mean Time to Recover): how quickly is the issue resolved?

Use 21-day trailing averages for trend analysis ([Google SRE](https://sre.google/workbook/on-call/)). Link every page to a bug in your tracker. This enables analysis of which components consume the most on-call resources and drives prioritization of reliability engineering.

#### Blameless Postmortems

From [Google SRE](https://sre.google/sre-book/postmortem-culture/) and [The Pragmatic Engineer](https://blog.pragmaticengineer.com/postmortem-best-practices/):

Core principle: incidents result from complex interactions between systems, processes, and communication — not from individual negligence. "Why did X do that?" is the wrong question. "What conditions made it sensible for someone to do what they did?" is the right question.

Postmortem template:
```
## Incident Postmortem: [Title]
**Date**:
**Severity**:
**Duration**:
**Author**: [On-call engineer at time of incident]

## Timeline
[Chronological events from detection to resolution]

## Root Cause
[System/process conditions that led to the incident]

## Contributing Factors
[Other factors that amplified or delayed response]

## What Went Well
[Monitoring that worked, quick escalation, etc.]

## Action Items
| Item | Owner | Due |
|------|-------|-----|
| ... | ... | ... |

## Lessons Learned
```

Key practices:
- Begin with context-setting, not blame allocation
- Ask "what" and "how" questions, not "why" questions (which invite defensiveness)
- Wait 36–48h after the incident before the formal postmortem review (decompression time)
- Publish postmortems to a shared repository — cross-team learning multiplies value
- Track action item completion — an unread postmortem with no follow-through is theater

---

### 5. Documentation Standards

#### The Diátaxis Framework

[Diátaxis](https://diataxis.fr/) (created by Daniele Procida) is the most practical framework for organizing engineering documentation. It defines four distinct documentation types, each serving a different user need:

| Type | Oriented toward | Answers | Form |
|---|---|---|---|
| **Tutorial** | Learning | "How do I get started?" | Step-by-step guide with a specific outcome |
| **How-To Guide** | Problem-solving | "How do I accomplish X?" | Task-focused, assumes background knowledge |
| **Reference** | Information retrieval | "What is the spec for X?" | Structured, precise, factual |
| **Explanation** | Understanding | "Why does X work this way?" | Conceptual, contextual, big-picture |

The framework's power is in identification: when documentation fails, it's often because it's trying to do multiple things at once (tutorial + reference + explanation in one doc). Diátaxis gives a decision tree for "where does this content belong?"

#### Docs-as-Code

Treat documentation like code ([Swimm](https://swimm.io/learn/code-documentation/internal-documentation-in-software-engineering-tips-for-success), [DX](https://getdx.com/blog/developer-documentation/)):
- Store docs in Git alongside code (not in a separate wiki)
- Review documentation changes in PRs like code
- Use Markdown for portability and diffability
- Automate checks: dead link detection, outdated API reference validation, broken doc builds

The practical implementation:
- `docs/` directory in the repo for service-level documentation
- ADRs in `docs/decisions/`
- Runbooks in `docs/runbooks/`
- Onboarding guides in `docs/onboarding/`
- Architecture overviews in `docs/architecture/`

#### What Needs to Be Documented

Minimum viable documentation for a service:
1. **README** — what the service does, how to run it locally, how to deploy
2. **Architecture overview** — key components, data flow, external dependencies
3. **ADRs** — why key design decisions were made
4. **Runbooks** — how to operate the service in production
5. **API documentation** — auto-generated from OpenAPI/tRPC schema where possible

Do NOT document things better expressed in code (e.g., what a function does if the code is already clear). Documentation should capture *why* and *how*, not *what* (which is code).

#### Integration into Development Workflow

Documentation must be part of the development process, not an afterthought ([Atlassian](https://www.atlassian.com/work-management/knowledge-sharing/documentation/standards)):

- Add documentation requirements to PR templates:
  - "Does this change require a runbook update?"
  - "Does this change require an ADR?"
  - "Does this change deprecate any documented behavior?"
- Include documentation in the Definition of Done
- For API changes: auto-generate changelog entries with breaking change detection (see [api-versioning-evolution.md](../principles/api-versioning-evolution.md))

#### Measuring Documentation Health

From [DX](https://getdx.com/blog/developer-documentation/):
- **Time to first contribution** for new engineers (tracks onboarding doc quality)
- **Support ticket volume** for common questions (tracks gap analysis)
- **Documentation coverage** for public APIs (auto-measurable)
- **Last-updated dates** for runbooks (staleness signal)

Documentation quality degrades silently. Set calendar reminders to review critical runbooks quarterly. Link doc reviews to on-call handover: "Did you find any runbook gaps this week?"

---

### Integration: How These Practices Reinforce Each Other

These five practices form a feedback system:

- **Code review** catches debt before it's created and propagates norms
- **ADRs** document why the architecture looks the way it does, making code review context-aware
- **Technical debt tracking** makes code review comments actionable ("this is tracked as TD-42")
- **On-call** surfaces where technical debt and missing documentation hurt most acutely
- **Documentation** makes on-call runnable by humans who weren't on the incident that created the alert
- **Postmortems** feed back into ADRs ("we made the wrong call; here's ADR-017 superseding ADR-003") and into tech debt backlog

Teams that implement all five with lightweight rigor consistently outperform teams that excel at only one or two ([Google SRE Book](https://sre.google/sre-book/postmortem-culture/), [DORA Research](https://dora.dev/guides/dora-metrics-four-keys/)).

---

## Open Questions

1. **AI-assisted code review**: Tools like Qodo AI, GitHub Copilot PR review, and CodeRabbit are claiming 40–60% defect catch rates. What's the right division of labor between AI pre-screening and human review? Does AI pre-review reduce human review quality (anchoring effect)?

2. **Living ADRs**: Most ADR guides treat ADRs as immutable historical records. But superseded ADRs create stale search results. Is there a pattern for "living ADRs" that get updated, with change history visible in git?

3. **Technical debt in AI-generated code**: With 30–50% of code now AI-assisted, does the "deliberate/inadvertent" quadrant need updating? Is AI-generated debt a new category?

4. **Cross-team documentation ownership**: For platform/infrastructure owned by platform teams but used by product teams, who owns the runbooks? Product teams often lack operational context; platform teams lack service-specific context.

5. **Documentation discoverability**: Even well-maintained doc libraries suffer from discoverability. Is semantic search over internal docs (using embeddings) now a viable solution at small team scales?

---

## Extracted Principles

Principles distilled to: **`principles/team-process-practices.md`** (new file)

Key principles extracted:
- Code review is a code health mechanism, not a correctness gate
- PR size < 400 LOC and turnaround < 24h are the highest-leverage review metrics
- Automate everything automatable so humans focus on architecture and logic
- ADRs serve Architectural Knowledge Management — one ADR per significant decision, stored in git with code
- Only Prudent/Deliberate debt is real strategic debt; the rest is bugs or learning
- Use SonarQube for enforcement (CI gates), CodeScene for strategy (hotspot investment)
- On-call max 2 incidents/12h shift; silence is for improving observability, not features
- Runbooks are owned by the service team; update them immediately after incidents
- Blameless postmortems: ask "what conditions led here?" not "who did this?"
- Diátaxis framework (Tutorial/How-to/Reference/Explanation) as default structure
- Docs-as-Code: documentation in git, reviewed in PRs, automation-checked

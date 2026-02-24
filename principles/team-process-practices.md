# Team & Process Practices

## Summary

Engineering excellence requires shared operational practices across five pillars: code review, architectural decision records, technical debt management, on-call operations, and documentation. These practices form a feedback system — weakness in any one amplifies problems in the others. Teams that implement all five with lightweight rigor consistently outperform teams that excel at only one or two.

## Principles

### Code Review Is a Code Health Mechanism, Not a Correctness Gate
- **What:** Approve a PR when it definitively improves the overall health of the codebase, even if it isn't perfect. Never block for perfection.
- **Why:** Perfection-gating slows teams without proportional quality gains. The reviewer's goal is forward motion without regression.
- **When:** Apply to every code review. The corollary is that reviewers share ownership of code they approve.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Google eng-practices

### PR Size and Turnaround Are the Highest-Leverage Review Metrics
- **What:** Target < 400 LOC per PR and < 24h turnaround. First review response should be < 4h. After 3 days without merge, PRs rot.
- **Why:** Reducing pickup and review time can improve code velocity by up to 63%. Large PRs cause cognitive overload and missed defects.
- **When:** Set these as team norms enforced by tooling (LinearB, Swarmia, Graphite). Use PR size warnings for > 400 LOC in CI.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); LinearB, Graphite research

### Automate Style; Humans Review Architecture and Logic
- **What:** Run linting, formatting, type checks, and security scanning in CI. Human reviewers focus on business logic correctness, architectural fit, edge cases, security, and test quality.
- **Why:** Automated tools handle style reliably at zero marginal cost. Human review bandwidth is scarce and should be spent on things that require judgment.
- **When:** Every codebase with CI/CD. Add Semgrep/CodeQL for security-sensitive files; require CODEOWNERS review for critical paths.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Microsoft Engineering Fundamentals Playbook

### Use Nit-Prefixed, Question-Framed Feedback to Build Psychological Safety
- **What:** Prefix minor suggestions with `Nit:`. Frame feedback as questions ("What was the reasoning here?") rather than directives. Explain *why* a change is needed, ideally with an example. Use "we" and "this line" instead of "you."
- **Why:** Psychological safety is the primary predictor of code review quality. Accusatory language causes defensive responses that degrade review thoroughness.
- **When:** All review comments. Resolve persistent disagreements via conversation, then document the outcome in the PR.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Microsoft, Qodo

### Write ADRs for Architecturally Significant Decisions Only
- **What:** Document a single decision per ADR when the choice has meaningful, long-lasting consequences or cross-cutting impact. Do not document routine implementation choices.
- **Why:** ADRs serve Architectural Knowledge Management — capturing why, not what. Overuse produces noise; underuse produces archaeology problems.
- **When:** New database choice, auth strategy, API paradigm, deployment target, state management approach, monorepo vs multi-repo. Signal: "would changing this require significant rework?"
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); adr.github.io, AWS Architecture Blog

### Store ADRs in Git, Co-Located with the Code
- **What:** Keep ADRs in `docs/decisions/` or `adr/` in the repo, using sequential numbering (`0001-use-postgresql.md`). Never delete superseded ADRs — mark them with a link to the replacement.
- **Why:** ADRs in wikis and Confluence become orphaned. Git-stored ADRs are versioned, searchable, and tied to the code history they describe.
- **When:** All projects. Commit the ADR in the same PR as the implementation when possible. Use Nygard template for simple decisions, MADR for complex multi-option decisions.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); adr.github.io

### Only Prudent/Deliberate Debt Is Real Strategic Debt
- **What:** Fowler's quadrant has four types: Reckless/Deliberate ("no time for design"), Prudent/Deliberate ("ship now, fix later"), Reckless/Inadvertent ("didn't know better"), Prudent/Inadvertent ("we learned the right approach after building it"). Only the Prudent/Deliberate quadrant represents legitimate strategic trade-offs.
- **Why:** Treating reckless or inadvertent debt as "strategic shortcuts" is rationalization. Correctly categorizing debt drives better remediation decisions.
- **When:** When triaging debt backlog items. Use the quadrant to determine priority: reckless debt is a quality bug, inadvertent debt is a learning opportunity, deliberate debt requires explicit repayment scheduling.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); martinfowler.com

### SonarQube for Enforcement, CodeScene for Strategy
- **What:** Use SonarQube (TDR < 5% quality gate, "Clean as You Code") in CI to block regressions. Use CodeScene's behavioral analysis (hotspot detection, Code Health) to identify where to invest refactoring effort.
- **Why:** Static analysis (SonarQube) enforces rules uniformly but can't identify which debt matters most. Behavioral analysis (CodeScene) identifies high-churn + high-complexity hotspots that are 6x more likely to produce defects.
- **When:** Mature engineering teams. At minimum, run SonarQube in CI. Add CodeScene when the team needs to prioritize refactoring investment.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); CodeScene, Sonarsource

### Allocate Explicit Time for Debt Remediation (Don't Rely on Organic)
- **What:** Reserve ~20% of sprint capacity for tech debt by default. Shopify's model: 10% weekly for small opportunistic fixes + 5% weekly for larger monthly/quarterly projects.
- **Why:** Technical debt addressed organically (when convenient) is never addressed. Explicit allocation signals that quality is a first-class concern.
- **When:** At sprint planning. Track debt in `tech-debt` labeled issues with owner, location, impact, and T-shirt effort. Communicate status to stakeholders in business terms (velocity impact), not TDR numbers.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Graphite, Atlassian

### Max 2 Incidents per 12-Hour On-Call Shift
- **What:** Google SRE's standard is a maximum of 2 incidents per 12-hour shift. If your team consistently exceeds this, halt feature development and focus exclusively on reliability improvements.
- **Why:** Exceeding this threshold prevents proper follow-up on incidents, creates compounding context debt, and is the primary driver of on-call burnout (65–83% of DevOps professionals experience burnout).
- **When:** Track weekly. Use 21-day trailing averages. Treat consistent exceedance as a product/engineering priority, not an operations problem.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Google SRE Workbook

### Quiet On-Call Time Is for Improving Observability, Not Features
- **What:** During quiet on-call shifts, improve logging, add missing metrics, update runbooks for unclear alerts, write new alerts for issues caught manually. Do not use quiet time for feature development.
- **Why:** This creates a positive feedback loop: better observability → quieter future shifts → less burnout. Engineers doing feature work during on-call produce lower-quality work in both contexts.
- **When:** During on-call shifts. Datadog, Google, and Resend all enforce this pattern. On-call engineers should be doing only on-call work.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Google SRE, Resend Handbook

### Runbooks Are Owned by the Service Team; Update Immediately After Incidents
- **What:** The team that owns a service owns its runbooks. Runbook entries must include: alert name, user impact, step-by-step mitigation (specific commands), escalation path, architecture context, and post-resolution verification steps. Update runbooks when corresponding alerts fire.
- **Why:** Stale runbooks are worse than no runbooks — they create false confidence. Fresh operational knowledge is most accurate immediately after an incident.
- **When:** Every time an alert fires that required judgment or research. Monday handover includes runbook gap review. New engineer should be able to follow any runbook without asking questions.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Google SRE Workbook, Parity

### Blameless Postmortems: Ask "What Conditions" Not "Who Did This"
- **What:** Postmortems focus on system/process conditions, not individuals. Ask "How did it make sense for someone to do what they did?" instead of "Why did X do that?" Wait 36–48h before formal review. Publish to a shared repository. Track action item completion.
- **Why:** Most incidents result from complex interactions between tools, processes, and communication breakdowns. Individual blame prevents systemic learning and creates psychological unsafety that hides future incidents.
- **When:** All incidents above a defined severity threshold. Document timeline, root cause, contributing factors, what went well, action items, and lessons learned. Senior management participates to model blamelessness.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Google SRE, Pragmatic Engineer

### Use Diátaxis to Structure All Engineering Documentation
- **What:** Diátaxis defines four documentation types: Tutorials (learning-oriented, step-by-step), How-To Guides (problem-solving, task-focused), Reference (information retrieval, precise and factual), Explanation (understanding, conceptual). Every documentation piece belongs to exactly one type.
- **Why:** Documentation fails most often because it mixes types — tutorial + reference + explanation in one doc. Diátaxis gives a decision tree for where content belongs and what it should and shouldn't include.
- **When:** When creating or auditing documentation. Diátaxis is a guide, not a rigid structure — use it to identify gaps and misclassified content.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); diataxis.fr

### Docs-as-Code: Store Documentation in Git, Review in PRs
- **What:** Store service documentation in `docs/` within the repo. Review doc changes in PRs like code. Use Markdown for portability. Add documentation requirements to PR templates and Definition of Done. Automate dead link detection and outdated API reference checks.
- **Why:** Docs in Confluence/wikis rot and become orphaned. Git-stored docs are versioned, reviewable, and discoverable. Treating docs as code signals they're a first-class deliverable.
- **When:** All services. Minimum structure: README, architecture overview, ADRs, runbooks, API docs (auto-generated from schema where possible). Review critical runbooks quarterly.
- **Source:** [research/2026-02-24-team-process-practices.md](../research/2026-02-24-team-process-practices.md); Swimm, DX, Atlassian

### Five Whys: "Human Error" Is Never a Root Cause
- **What:** Never accept "an operator/engineer forgot to do X" as the terminal answer in a Five Whys chain. That describes what happened, not why the system allowed it. The next question must be: "Why didn't the process catch this before it reached that person?" Robust systems assume humans make mistakes and build in safeguards.
- **Why:** Stopping at human error produces countermeasures like "be more careful" — which fail. Systemic countermeasures (null-safety linting, required checklists, automated verification) actually prevent recurrence.
- **When:** Every incident postmortem and retrospective root cause analysis. Apply until you reach a systemic gap you can close with a concrete process or tooling change.
- **Source:** [research/2026-02-24-five-whys.md](../research/2026-02-24-five-whys.md); FlowFuse, MindTools

### Stop at Countermeasures, Not Symptoms — The Countermeasure Test
- **What:** You've found the root cause when you can state: "If we implement change X, this specific failure mode cannot recur." If you cannot name that change, dig deeper. The distinction between a "solution" (fixes the symptom) and a "countermeasure" (closes the systemic gap) is critical.
- **Why:** Symptom-fixing generates recurring incidents. Countermeasures eliminate failure modes. Teams that confuse the two spend cycles re-investigating the same problems.
- **When:** After any Five Whys analysis, before closing the investigation. Enforce as a quality gate on postmortem action items.
- **Source:** [research/2026-02-24-five-whys.md](../research/2026-02-24-five-whys.md); MindTools, FlowFuse

### Use Fishbone + Five Whys for Complex Failures
- **What:** For incidents with multiple plausible cause categories, start with a Fishbone (Ishikawa) diagram to map all possible branches across categories (e.g., code, process, tooling, communication). Then apply Five Whys independently to the 2–3 highest-probability branches. Compare results to identify the most actionable leverage points.
- **Why:** Five Whys alone follows a single causal chain, which misses complex system failures where multiple factors cooperate. The Fishbone step prevents premature convergence on one thread.
- **When:** Major incidents, novel failure modes, and any situation where there are clearly multiple contributing cause categories. Skip for simple, clearly linear failures.
- **Source:** [research/2026-02-24-five-whys.md](../research/2026-02-24-five-whys.md); Visual Paradigm, Salesforce Engineering

### Complex Incidents Need "How" Not Just "Why"
- **What:** For distributed system failures, replace "Why did this happen?" with "How did this system fail?" The word "why" implies a single cause and invites blame; "how" opens investigation to the full network of jointly cooperating factors (per Dr. Richard Cook: each factor is necessary but insufficient alone). Build a cause map showing relationships, then identify leverage points.
- **Why:** Complex systems never fail for a single reason. Forcing a Five Whys linear chain on a complex incident produces an arbitrarily selected "root cause" that reflects the investigator's bias (WYLFIWYF: What You Look For Is What You Find), not the full failure mode.
- **When:** P0/P1 incidents in distributed systems, any incident where "human error" appears to be the proximate cause, and postmortems where multiple teams or systems were involved.
- **Source:** [research/2026-02-24-five-whys.md](../research/2026-02-24-five-whys.md); Salesforce Engineering (Robert Blumen), Dr. Richard Cook

## Revision History
- 2026-02-24: Initial extraction from research/2026-02-24-team-process-practices.md.
- 2026-02-24: Added 4 Five Whys principles from research/2026-02-24-five-whys.md.

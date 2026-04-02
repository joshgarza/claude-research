---
date: 2026-04-01
topic: look into codex code review. can likely be used to replace a huge surface area of task-runner
status: complete
tags: []
---

# look into codex code review. can likely be used to replace a huge surface area of task-runner

## Context
This was investigated to answer the prompt: "look into codex code review. can likely be used to replace a huge surface area of task-runner".

Existing local context already covered Codex at the repo and harness level, especially `research/2026-04-01-claude-code-vs-codex-repo-audit.md`, `principles/agent-task-orchestration.md`, and `principles/ai-tool-adoption.md`. That prior work established that Codex already has first-class support for worktrees, cloud tasks, GitHub, Linear, skills, AGENTS.md, and structured automation. This session narrows the question to code review specifically, then asks which parts of `task-runner` are still real product logic versus historical glue that Codex now natively owns.

The DB principles query returned no relevant prior principle, and the DB research query failed with a malformed JSON error in `automation/query-db.ts`, so I used the readable backups in `sessions.md`, the existing research files, the current `task-runner` source tree, and fresh web research. Local `task-runner` evidence came primarily from `/home/josh/coding/claude/task-runner/main/README.md`, `/home/josh/coding/claude/task-runner/main/src/runner/review.ts`, `/home/josh/coding/claude/task-runner/main/src/runner/run-issue.ts`, `/home/josh/coding/claude/task-runner/main/src/agents/spawn.ts`, and `/home/josh/coding/claude/task-runner/main/src/agents/review-prompt.ts`.

## Findings

### Codex already ships three distinct review surfaces

The first important clarification is that "Codex code review" is not one feature. As of 2026-04-01, Codex exposes review through at least three different operating modes:

1. Native GitHub review, human-facing. In GitHub, a user can comment `@codex review` and Codex posts a standard GitHub review. Repositories can also enable automatic reviews so every PR is reviewed without an explicit comment. Review behavior is guided by `AGENTS.md`, specifically any `Review guidelines` section, and Codex applies the closest `AGENTS.md` to each changed file. One important limitation is explicit in the docs: GitHub-native Codex reviews only flag P0 and P1 issues unless you redefine severity expectations in `AGENTS.md`. That makes native GitHub review strong for bug-catching and security regression scanning, but weaker as a drop-in replacement for a custom "approve / needs fixes / structured verdict" gate. (Sources: [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github), [Review pull requests faster](https://developers.openai.com/codex/use-cases/github-code-reviews))

2. Local interactive review, human-in-the-loop. The Codex app has a dedicated review pane that shows repo diffs, supports inline comments, and can display `/review` findings inline. The review pane is not limited to Codex changes, it shows the Git state of the repo, including user edits and other uncommitted changes. It also supports stage, unstage, and revert operations at diff, file, and hunk level. This matters because a meaningful portion of `task-runner`'s review value is not the verdict itself, it is the "inspect, comment, refine, keep only the good parts" workflow. Codex now ships that workflow directly. (Source: [Codex app Review](https://developers.openai.com/codex/app/review))

3. Headless and machine-facing review. `codex exec` is explicitly positioned for CI, pre-merge checks, and scheduled jobs. It supports JSONL event streaming with `--json` and structured final output with `--output-schema`, which is exactly the missing primitive most hand-rolled agent runners used to build themselves. OpenAI's GitHub Action is a thin wrapper around this, with first-class inputs for `prompt` or `prompt-file`, sandbox selection, saved output files, and safety strategy. In other words, if the requirement is "run Codex in automation and capture a typed verdict", Codex now natively supports that shape. (Sources: [Non-interactive mode](https://developers.openai.com/codex/noninteractive), [Codex GitHub Action](https://developers.openai.com/codex/github-action))

The practical implication is simple: a lot of what looked like "task-runner review logic" is now just choosing which Codex surface fits the workflow.

### Codex has also absorbed a lot of the orchestration context around review

The second clarification is that review does not live alone. It sits inside a larger workflow: issue intake, repo selection, isolated execution, review, iteration, and handoff. Codex now ships a surprising amount of that surrounding surface too.

- GitHub integration already supports review requests and automatic review posting from inside PRs. It can also do more than review. If a PR comment mentions `@codex` with something other than `review`, Codex starts a cloud task using the PR as context, for example `@codex fix the CI failures`. That means the old distinction between "review bot" and "follow-up fix bot" is starting to collapse into one product surface. (Source: [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github))

- Linear integration already supports issue-driven delegation. Assign an issue to Codex or mention `@Codex` in a thread, and Codex creates a cloud task, posts progress updates, chooses an environment, and returns a result summary with a link to the finished task. That overlaps directly with `task-runner`'s `run` and `drain` mental model, at least at the "ticket causes agent work" layer. (Source: [Use Codex in Linear](https://developers.openai.com/codex/integrations/linear))

- Worktrees are now first-class in the Codex app. Background automations can run on dedicated worktrees so they do not collide with foreground work, and interactive threads can be handed off between Local and Worktree. That overlaps with a core part of `task-runner`'s isolation story. (Source: [Worktrees](https://developers.openai.com/codex/app/worktrees))

- Automations are now first-class. Codex can schedule recurring background tasks, optionally on dedicated worktrees, and OpenAI explicitly recommends combining automations with skills for more complex jobs. This is not only relevant to proactive review, it also overlaps with pieces of `task-runner` like cron-style maintenance, recurring scanning, or periodic standup and triage behaviors. The main caveat is that app automations require the Codex app to be running and the project to exist locally on disk. That is not the same thing as a headless always-on server process. (Source: [Automations](https://developers.openai.com/codex/app/automations))

This means the realistic question is no longer "can Codex do review?" It can. The real question is "which parts of our surrounding workflow are now native, and which parts remain custom state-machine logic?"

### Current `task-runner` review behavior is more custom-stateful than Codex's native review

The current `task-runner` review path is not merely "ask a model to review a PR". It contains specific workflow semantics:

- `task-runner review <pr-url>` finds project config by repo match, constructs a review prompt, asks a reviewer agent to inspect the diff, run tests and lint, then emit a strict JSON verdict with `approved`, `summary`, issue list, and pass or fail booleans for tests, lint, and TypeScript. Local evidence: `/home/josh/coding/claude/task-runner/main/src/runner/review.ts`, `/home/josh/coding/claude/task-runner/main/src/agents/review-prompt.ts`.

- The full pipeline in `run-issue.ts` does more: it fetches a Linear issue, validates state and blockers, creates a worktree, runs a worker agent, validates output, pushes a branch, opens a PR, runs review, then either labels the PR and transitions the issue to "In Review" or creates a child Linear issue containing review feedback. Local evidence: `/home/josh/coding/claude/task-runner/main/src/runner/run-issue.ts`.

- The Codex SDK wrapper in `spawn.ts` still carries compatibility logic for legacy agent caps, sandbox selection, network access policy, timeout handling, and output schema delivery. A recent retro already showed how easy it is to get this wrong: PR #40 initially disabled network globally and broke review because reviewers need GitHub network access. Local evidence: `/home/josh/coding/claude/task-runner/main/src/agents/spawn.ts`, `/home/josh/coding/claude/task-runner/main/retros/2026-03-12-pr-40-codex-review-network.md`.

In other words, `task-runner`'s review path currently mixes together three concerns:

1. Codex invocation
2. Review policy
3. Workflow side effects in GitHub and Linear

Codex can now replace most of the first two concerns natively. The third concern is where `task-runner` still differentiates.

### The biggest replaceable surface is not "review intelligence", it is review plumbing

This is the main conclusion of the session.

If the goal is "use Codex to find bugs before human review", then `task-runner` has a lot of replaceable plumbing:

- The standalone `review` command is likely replaceable by GitHub-native Codex review for human-facing PR feedback, or by `codex exec` / `openai/codex-action` for CI-driven feedback. The current custom prompt builder and JSON parsing layer are not strategic if the main outcome is comments on a PR or a human-readable review report. (Sources: [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github), [Codex GitHub Action](https://developers.openai.com/codex/github-action), local `task-runner` review files)

- The custom `REVIEW_VERDICT_SCHEMA` and "parse model output as JSON" logic are replaceable when the machine-readable requirement remains. `codex exec --output-schema` already exists for exactly this use case, and `--json` emits a complete event stream. The task-runner wrapper can become a thin consumer of Codex's native structured output instead of its own SDK-level parser. (Source: [Non-interactive mode](https://developers.openai.com/codex/noninteractive))

- The dedicated review prompt file is partially replaceable by `AGENTS.md`. OpenAI now explicitly recommends putting engineering conventions, PR expectations, constraints, verification rules, and review guidance in `AGENTS.md`, and GitHub-native review consumes it directly. For repo-wide review policy, `AGENTS.md` is the native configuration layer. Prompt files should remain only for one-off CI tasks or machine consumers. (Sources: [Best practices](https://developers.openai.com/codex/learn/best-practices), [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github), [How OpenAI uses Codex](https://openai.com/business/guides-and-resources/how-openai-uses-codex/))

- The local worktree and background-task ergonomics are no longer unique. Codex app worktrees and automations overlap with a lot of the "run something safely in parallel without disturbing my checkout" value proposition. (Sources: [Worktrees](https://developers.openai.com/codex/app/worktrees), [Automations](https://developers.openai.com/codex/app/automations))

What still looks custom and valuable is the cross-system workflow glue:

- exact Linear state transitions
- exact label semantics like `agent-ready`, `needs-approval`, and `ready-for-human-review`
- child issue creation when review fails
- custom retry and rollback behavior
- custom project-to-repo mapping
- deterministic concurrency, locking, and cleanup semantics

Codex does not appear to natively own those repo-specific business rules. Its Linear integration delegates and reports progress, but the docs do not describe a native equivalent of "on failed review, create a specific follow-up issue with these labels and return the parent issue to this state." That is the strongest boundary where a thin custom runner still makes sense. (Sources: [Use Codex in Linear](https://developers.openai.com/codex/integrations/linear), local `task-runner` pipeline code)

### Best-practice pattern: split human-facing review from machine-facing review

The cleanest design that emerges from both the official docs and the local codebase is a two-lane model:

- Human-facing review lane: use GitHub-native Codex reviews and local review pane workflows. This is where inline comments, fast feedback, and iterative review belong.
- Machine-facing automation lane: use `codex exec` or `openai/codex-action` with JSON Schema outputs when an external system needs a stable verdict to decide what to do next.

Trying to force one surface to do both jobs creates unnecessary code. Native GitHub review is excellent at producing inline feedback in the place humans already look, but it is not ideal if downstream logic needs a structured `approved: boolean`. `codex exec --output-schema` is excellent for machine consumption, but if humans are already in GitHub, it is silly to build a custom comment bridge unless you truly need custom side effects. (Sources: [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github), [Non-interactive mode](https://developers.openai.com/codex/noninteractive), [Codex GitHub Action](https://developers.openai.com/codex/github-action))

This suggests a concrete refactor direction for `task-runner`: move review policy into `AGENTS.md`, move review execution onto Codex-native surfaces, and keep only the state-machine code that turns review results into Linear and GitHub mutations.

### Recommended migration path for shrinking `task-runner`

The strongest path is phased, not a rewrite.

#### Recommendation 1: delete the standalone custom review path first

`task-runner review <pr-url>` is the easiest surface to retire. It duplicates behavior that Codex now ships directly in GitHub and can also be recreated with a very small `codex exec` or GitHub Action wrapper. Removing that path would eliminate:

- custom prompt construction
- custom JSON parsing
- custom repo detection by PR URL
- reviewer-specific spawn configuration in one codepath

It would not affect the main issue runner yet, which lowers migration risk.

#### Recommendation 2: if machine-readable verdicts still matter, swap the internals before changing workflow semantics

If the current pipeline genuinely needs typed review output, keep the outer workflow but replace the inner mechanism:

```bash
codex exec \
  --json \
  --output-schema ./schemas/review-verdict.json \
  -o ./artifacts/review-verdict.json \
  "Review this PR for correctness, tests, security, and scope."
```

That keeps the deterministic child-ticket and label logic while deleting the ad hoc prompt-and-parse plumbing. The JSONL stream also gives better auditability than today's single `finalResponse` wrapper because it exposes command executions, file changes, and tool calls as events. (Source: [Non-interactive mode](https://developers.openai.com/codex/noninteractive))

#### Recommendation 3: move review rules into `AGENTS.md`, not TypeScript

The current review criteria in `review-prompt.ts` belong mostly in repo-local agent guidance:

```markdown
## Review guidelines

- Treat auth, data loss, and migration breakage as P1.
- Run `npm test` and `npm run lint` before approving.
- Flag scope creep and missing ticket coverage.
- Keep fixes minimal unless the prompt explicitly authorizes a refactor.
```

That is closer to how Codex is designed to be configured across GitHub, app, CLI, and automations. Keep TypeScript logic only for things that mutate external state or require deterministic control flow. (Sources: [Best practices](https://developers.openai.com/codex/learn/best-practices), [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github))

#### Recommendation 4: do not delete the Linear state machine until native Codex delegation proves it can mirror your exact policy

Codex in Linear is promising, but the official docs describe assignment, comments, progress updates, environment selection, and result links. They do not describe the richer repo-specific policy `task-runner` currently enforces: blocker checks, approval labels, rollback rules, project mapping, retry budgets, or automatic creation of fix tickets from structured review findings. That means the likely long-term architecture is not "no custom code", it is "a much thinner custom controller". (Source: [Use Codex in Linear](https://developers.openai.com/codex/integrations/linear))

### Decision framework

Use this decision framework when deciding whether a `task-runner` surface should stay custom:

- If the output is for humans reading a PR, prefer GitHub-native Codex review.
- If the output must drive automation, prefer `codex exec` or `openai/codex-action` with JSON Schema.
- If the rule is repo-wide guidance, put it in `AGENTS.md`.
- If the workflow is recurring local background work, prefer Codex automations and worktrees.
- If the logic mutates external systems in a repo-specific way, keep a thin custom orchestration layer.

That is the clean boundary. Codex should own agent work, review, and repo-local guidance. A smaller custom runner should own only the parts that are genuinely about your team's state machine.

### Emerging trend

The broader trend is clear: agent harnesses are productizing what custom runners used to hand-build. OpenAI now ships native GitHub review, PR-comment task delegation, Linear issue delegation, structured automation via `codex exec`, CI wrappers via `openai/codex-action`, first-class worktrees, local review panes, skills, and AGENTS-driven repo policy. The center of gravity is moving away from "write a bespoke orchestration binary" and toward "compose native surfaces, then keep a very thin controller for custom side effects". The official messaging reinforces this. OpenAI's business guide recommends issue-shaped prompts, durable `AGENTS.md`, queueing work as backlog, and gradually improving the environment instead of hardcoding more local glue. (Sources: [How OpenAI uses Codex](https://openai.com/business/guides-and-resources/how-openai-uses-codex/), [Best practices](https://developers.openai.com/codex/learn/best-practices), [Codex product page](https://openai.com/codex/))

My bottom line: yes, Codex code review can likely replace a large surface area of `task-runner`, but mostly by deleting review plumbing and moving to native surfaces, not by magically eliminating the repo-specific workflow controller. The removable part is large. The irreducible part is the custom state machine around Linear, GitHub labels, retries, and follow-up issue creation.

## Open Questions
- Can GitHub-native Codex reviews be consumed through a stable API or webhook stream, or are they intentionally human-facing only?
- How far can Codex in Linear be pushed before a custom controller is still needed for state transitions, blocker logic, and child issue creation?
- If `task-runner` keeps a thin orchestration layer, is `codex exec` sufficient, or is the SDK still needed for long-lived sessions and finer runtime control?
- How accurate is GitHub-native review for this repo's preferred severity model, given the default P0 and P1 focus?
- Would a repo-local `AGENTS.md` review policy plus GitHub automatic reviews remove enough manual reviewer load to justify deleting the current custom review command immediately?

## Extracted Principles
- Added a new principles file: [principles/codex-review-orchestration.md](../principles/codex-review-orchestration.md)

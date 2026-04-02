# Codex Review And Orchestration

## Summary

Principles for choosing between Codex's native review surfaces and custom orchestration. Covers when to use GitHub-native review, when to use `codex exec` or the GitHub Action for machine-readable automation, where review policy should live, and which workflow logic should remain in a thin custom controller.

## Principles

### Native Review Surface Before Custom Review Runner
- **What:** Use Codex's native GitHub review surface first for normal human-facing PR review, before building or keeping a custom review runner.
- **Why:** Codex already supports `@codex review`, automatic repository reviews, and repo-local review guidance through `AGENTS.md`. Keeping a custom runner for the same human-facing outcome mostly recreates product plumbing that Codex now owns.
- **When:** Use this for inline PR feedback and default pre-human-review scanning. Do not use it as the only path when downstream systems require a typed verdict or custom side effects.
- **Source:** [research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md](../research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md)

### Human Review Uses GitHub, Machine Review Uses Schema
- **What:** Split review into two lanes: GitHub-native review for humans, `codex exec` or `openai/codex-action` with `--output-schema` for machines.
- **Why:** Human review wants inline comments in the PR. Automation wants a stable JSON contract and event stream. Forcing one surface to do both creates unnecessary glue code and brittle parsing.
- **When:** Use GitHub-native review when the result is read by humans in the PR. Use `codex exec --json --output-schema` or the GitHub Action when the result drives CI, issue creation, labels, or other deterministic automation.
- **Source:** [research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md](../research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md)

### Review Policy Belongs In `AGENTS.md`
- **What:** Put repo-wide review expectations in `AGENTS.md`, not in code-level prompt builders.
- **Why:** Codex consumes `AGENTS.md` across GitHub, app, CLI, and automations. That makes review policy durable, versioned, and shared across surfaces. Prompt code should shrink to one-off context or machine-consumption details.
- **When:** Always for stable rules like severity expectations, commands to run, scope constraints, and do-not rules. Keep custom prompt-building only when a consumer needs task-specific context or a typed schema.
- **Source:** [research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md](../research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md)

### Keep Custom Code Only For Cross-System Side Effects
- **What:** Retain a custom orchestration layer only for repo-specific state transitions and side effects that Codex does not natively own.
- **Why:** The hard part is not asking Codex to review code. The hard part is reliably mutating Linear and GitHub according to team-specific policy, such as blocker checks, rollback rules, child issue creation, labels, and retry semantics. That is workflow logic, not review logic.
- **When:** Keep custom code when you need deterministic state changes across systems. Delete it when it only exists to invoke Codex, parse prose, or restate review policy.
- **Source:** [research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md](../research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md)

## Revision History
- 2026-04-01: Initial extraction from [research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md](../research/2026-04-01-look-into-codex-code-review-can-likely-be-used-to-replace-a-huge-surface-area-of-task-runner.md).

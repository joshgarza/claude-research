# Self-Improving Research Project

A process-oriented research repository where Claude agents conduct research sessions, accumulate findings, distill principles, and iteratively improve their own workflows. Everything starts and ends with this file.

## Linear
- Team: `JOS`
- Project: `claude-research`

## CLI

All commands via:
```bash
node --experimental-strip-types /home/josh/coding/claude/task-runner/main/src/cli.ts <command>
```

```bash
<cli> add-ticket "Title" --team JOS --project claude-research [--description "Details"]
<cli> run JOS-42
<cli> review <pr-url>
<cli> standup --project claude-research
```

## File Structure

```
research/          # Individual research files (exploratory, can be messy)
principles/        # Distilled actionable knowledge extracted from research
exports/           # Staged insights ready for cross-project use
sessions.md        # Chronological log of all research sessions
CLAUDE.md          # This file — the single entry point for every session
```

### Naming Conventions

- **Research files**: `research/YYYY-MM-DD-short-topic.md` (e.g., `research/2026-02-11-prompt-chaining.md`)
- **Principle files**: `principles/topic-name.md` (e.g., `principles/prompting-strategies.md`)
- **Export files**: `exports/target-description.md` (e.g., `exports/global-claude-md.md`)

## Session Protocol

### Starting a Session

1. **Read this file** (`CLAUDE.md`) in full.
2. **Check `sessions.md`** to understand what's been explored recently.
3. **Search `principles/` first.** Principles are the primary knowledge base — distilled, opinionated, and tested. If relevant principles exist, use them as the starting point.
4. **Fall back to `research/` only if needed.** If principles don't exist for the topic, or if you need supplementary detail (dates, sources, open questions) that principles don't capture, search raw research files.
5. **Start from scratch if neither exists.** If no principles or research cover the topic, begin fresh web research.
6. **Begin research.** Follow the research file format below.

### Ending a Session

1. **Write or update the research file** in `research/` following the format below.
2. **Extract principles.** If research produced actionable, reusable insights:
   - Add to an existing file in `principles/` if the topic is already covered.
   - Create a new principles file if the topic is novel.
   - Principles must be concise, opinionated, and tested — not speculative.
3. **Update `sessions.md`** with a one-line entry for this session.
4. **Evaluate process improvements.** Ask: did anything about the session workflow feel wrong, slow, or unclear? If yes:
   - Propose a specific change to this `CLAUDE.md`.
   - Note the change in `sessions.md` with a `[process]` tag.
5. **Stage exports** if any insights are ready for cross-project use (see Export Protocol below).

## Research File Format

Files in `research/` use a hybrid format: light YAML frontmatter for searchability, freeform markdown body for flexibility.

```markdown
---
date: YYYY-MM-DD
topic: short descriptive title
status: draft | complete | superseded
tags: [tag1, tag2, tag3]
related: [YYYY-MM-DD-other-file.md]  # optional
---

# Topic Title

## Context
Why this was investigated. What prompted the research.

## Findings
The core content. Freeform — use whatever structure fits the topic.

## Open Questions
What remains unclear or worth further investigation.

## Extracted Principles
Brief list of any principles distilled from this research (with links to principle files).
```

**Status values:**
- `draft` — Work in progress, may be incomplete.
- `complete` — Research is done, findings are solid.
- `superseded` — Replaced by newer research. Add a note linking to the replacement.

## Principles Format

Files in `principles/` are the refined output of research. They are concise, actionable, and evolve over time.

```markdown
# Principle Topic

## Summary
One-paragraph overview of this principle area.

## Principles

### Principle Name
- **What:** Clear statement of the principle.
- **Why:** Brief rationale.
- **When:** When to apply (and when NOT to).
- **Source:** Link to research file(s) that support this.

### Another Principle
...

## Revision History
- YYYY-MM-DD: Initial extraction from [research file].
- YYYY-MM-DD: Updated based on [newer research file].
```

## Self-Improvement Rules

This `CLAUDE.md` is a living document. It should get better over time. But changes must be bounded and traceable.

### What qualifies as a process improvement
- Workflow steps that are unclear, redundant, or missing.
- File format changes that improve searchability or reduce friction.
- Naming convention updates based on practical experience.
- New sections needed to address recurring situations.

### What does NOT belong here
- Research findings (those go in `research/` and `principles/`).
- Project-specific configuration or tool setup.
- Temporary notes or session-specific context.

### How to modify this file
1. Make the change directly in `CLAUDE.md`.
2. Log the change in `sessions.md` with a `[process]` tag and brief description.
3. Keep changes minimal and focused. One improvement per session unless multiple are clearly needed.

## Export Protocol

When research produces insights applicable beyond this project:

1. **Identify the target.** Where should this insight live? Common targets:
   - `~/.claude/CLAUDE.md` — Global agent instructions.
   - Other cross-project config files as patterns emerge.
2. **Stage the export.** Write a proposal file in `exports/` with:
   - The proposed change (exact text to add/modify).
   - Rationale (link to supporting research/principles).
   - Confidence level (high/medium/low) — how well-tested is this insight?
3. **Do not auto-apply.** Exports are proposals for the user to review and apply manually. This prevents untested changes from propagating across projects.
4. **Mark as applied.** Once the user applies an export, note it in the export file with a date.

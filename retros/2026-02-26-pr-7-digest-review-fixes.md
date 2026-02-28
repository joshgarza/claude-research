# PR Review Retro: PR #7 -- JOS-88: Fix review feedback: JOS-85

**Date**: 2026-02-26 | **Branch**: task-runner/jos-88 | **Findings**: 2 bug, 2 suggestion

## What Was Found

The cron wrapper for the daily digest (`cron-digest.sh`) referenced a log directory in its crontab comment that was never guaranteed to exist at first run, meaning cron output would silently fail to log. Separately, the digest generator (`digest.ts`) made a secondary API call to extract a short label for the filename, but if that call failed the entire digest was lost even though the content was already generated. Two non-blocking suggestions noted overly broad env var exporting and an inclusive date boundary.

## Root Cause

**Bug 1: Missing log directory**

- *Technical*: The crontab redirects output to `automation/logs/cron-digest.log`, but nothing creates `automation/logs/` before the redirect runs. The directory happens to exist because `worker.ts` created it on earlier runs, but this is an implicit dependency, not an explicit guarantee.
- *Origin*: The cron-digest script was modeled after `cron-worker.sh`, which has the same implicit dependency on the logs directory already existing (created by worker.ts during its first run). Neither script takes responsibility for its own log directory. The pattern "assume the directory exists because something else creates it" was copied forward without question.
- *Systemic*: There is no convention in this project for cron scripts to ensure their own preconditions. Each script assumes prior state instead of declaring it.

**Bug 2: Non-essential API call killing essential output**

- *Technical*: `extractLabel()` called the Haiku API to generate a short filename label. If this threw (network error, rate limit), the exception propagated up through `generateDigest()`, which meant `writeFileSync` for the digest content never executed.
- *Origin*: `extractLabel` was added to `generateDigest` as a sequential step rather than an isolated optional enhancement. The function's contract ("generate and return a digest") was silently expanded to include "also name the file", coupling a nice-to-have with the critical path.
- *Systemic*: No separation between essential work (generate digest, write file) and optional enrichment (label extraction). This is a "decoration on the critical path" anti-pattern.

## Fixes Applied

- **`cron-digest.sh` line 19-20**: Added `mkdir -p` to create the log directory before executing the digest script. This makes the script self-contained rather than depending on worker.ts having run first.
- **`digest.ts` lines 145-153**: Wrapped `extractLabel` in try/catch with a fallback label of `"digest"`. The digest content is now always written regardless of whether label extraction succeeds.

## Deferred

- **`set -a` env export breadth** (suggestion): `set -a && source ~/.env && set +a` exports every variable in `~/.env`, not just `ANTHROPIC_API_KEY`. This pattern also appears in `task-runner/main/scripts/cron-drain.sh` and `cron-standup.sh`. Changing to targeted `export` would be safer but requires auditing which vars each script actually needs. Non-blocking now since `~/.env` currently contains only API keys. **Revisit trigger**: if `~/.env` grows to include variables that conflict with node/nvm behavior.
- **Date boundary `>=` vs `>`** (suggestion): The `>=` comparison in `getRecentResearchFiles` includes both yesterday's and today's files when `--days 1`. At the 8am cron time this is probably fine (today's files are unlikely to exist yet). **Revisit trigger**: if digests start including same-day files unexpectedly.
- **`cron-worker.sh` hardcoded node version** (discovered): The existing worker cron script still uses `PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"` instead of sourcing nvm. The new `cron-digest.sh` correctly uses `source $NVM_DIR/nvm.sh`, but the older script was never updated. **Revisit trigger**: next node version upgrade.
- **`acquireLock()` still uses raw console.\*** (discovered, **fixed in this retro**): The prior retro (PR #5) noted this was "[Applied in this retro]" but the fix was never committed. Lines 40 and 43 of `worker.ts` still used `console.error` and `console.log` instead of the structured `log()` function. Fixed now: both calls replaced with `log("WARN", ...)` and `log("INFO", ...)`.

## Lessons Encoded

1. **Pattern: cron scripts must be self-contained.** Both bugs trace to implicit dependencies: the log directory assumed to exist, the label API call assumed to succeed. Cron scripts run in isolation with minimal state. Every precondition must be explicitly established within the script itself or within the called program.

2. **Anti-pattern: decoration on the critical path.** When an optional enhancement (label extraction) is placed inline in a critical function (digest generation) without isolation, its failure mode inherits the critical function's failure mode. Optional work should always be wrapped in try/catch with a fallback, or extracted into a separate post-processing step.

3. **Prior retro fix was not committed (now fixed).** The PR #5 retro claimed `acquireLock()` logging was fixed "[Applied in this retro]" but the fix never made it to the repository. Applied the fix in this retro session (replaced `console.error`/`console.log` with `log()` in `acquireLock()`). Retro-claimed fixes need the same verification as any other code change: check the commit, not the retro note.

## Hotspots

- **`automation/worker.ts`**: Appeared in PR #5 retro (permission regex, logging inconsistency) and now again via the uncompleted `acquireLock()` fix. This is the second retro referencing this file. The prior retro predicted it would be a recurring hotspot due to concentrating multiple concerns in a single file.
- **`automation/` (directory-level)**: Both retros (PR #5 and PR #7) involve `automation/` files. Zero test coverage was noted in PR #5 and remains the case. The test gap is now a confirmed structural issue, not a theoretical one.

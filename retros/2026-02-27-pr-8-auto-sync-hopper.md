# PR Review Retro: PR #8 -- Auto-sync processed research-topic thoughts from hopper into queue

**Date**: 2026-02-27 | **Branch**: feat/auto-sync-hopper-research | **Findings**: 1 bug, 1 suggestion

## What Was Found

The new `syncHopperResearchItems` function had a race condition: the `NOT IN` subquery that identifies unsynced thoughts is not atomic with the subsequent INSERT loop, so overlapping workers could insert duplicate rows for the same `thought_id`. The `svc_research_queue_items` table lacked a UNIQUE constraint on `thought_id` to catch this at the DB level. Separately, `db.prepare()` was called inside the insertion loop, creating a new prepared statement per iteration instead of reusing one.

## Root Cause

**Bug: Missing UNIQUE constraint / non-atomic check-then-insert**

- *Technical*: `syncHopperResearchItems` selected thoughts not yet in the queue, then inserted them one by one. Between the SELECT and each INSERT, another worker could perform the same SELECT and see the same "missing" thoughts, producing duplicates.
- *Why no constraint*: The `svc_research_queue_items` table was created with a plain FK (`thought_id INTEGER NOT NULL REFERENCES thoughts(id)`) but no UNIQUE index. The table definition implicitly assumed single-writer access because the original design had only one code path inserting into it (`insertQueueItem`, which creates a new thought and immediately inserts, so duplicates were structurally impossible).
- *Systemic*: When a new code path (`syncHopperResearchItems`) was added that selects existing thoughts and inserts them into the service table, the single-writer assumption was violated. The schema did not encode the business invariant (one queue item per thought) as a constraint, relying instead on application-level prevention.

**Suggestion: prepare-in-loop**

- *Technical*: `db.prepare()` inside a for-loop creates and compiles a new SQLite prepared statement per iteration instead of reusing a single compiled statement.
- *Why*: The pattern is a convenience shorthand that works but is wasteful. No lint rule or project convention flags it.

## Fixes Applied

- **UNIQUE index on thought_id** (fix agent, already on branch): Added `CREATE UNIQUE INDEX IF NOT EXISTS idx_svc_research_thought_id ON svc_research_queue_items(thought_id)` in `initSchema`. The DB now enforces the one-queue-item-per-thought invariant regardless of application-level logic.
- **INSERT OR IGNORE** (fix agent, already on branch): Changed the sync insert to `INSERT OR IGNORE` so that if the UNIQUE constraint fires (race or re-run), the insert silently skips instead of throwing.
- **Hoisted prepare in syncHopperResearchItems** (fix agent, already on branch): Moved `db.prepare()` above the loop so a single compiled statement is reused across iterations.
- **Hoisted prepare in insertQueueItem** (this retro, commit 790dfb5): The same prepare-in-loop pattern existed in `insertQueueItem` for the tag insertion loop (3 prepared statements per iteration via `ensureTag` + inline `thought_tags` insert). Refactored `ensureTag` to accept pre-prepared statements and hoisted all three prepares above the loop.

## Deferred

- **Dashboard has the same prepare-in-loop pattern**: `dashboard/backend/src/services/weeklyReviewService.ts` (lines 287-298) and `dashboard/backend/src/services/researchService.ts` (lines 190-196) both call `db.prepare()` inside for-loops. Created Linear ticket JOS-149 for cleanup.
- **`automation/migrate.ts` has prepare-in-loop** (lines 74-85): The migration script uses prepare-in-loop for tag insertion. Since this is a one-shot migration script (not a hot path), fixing it provides no runtime benefit. **Revisit trigger**: if the migration script is repurposed or used as a template for new code.
- **Zero test coverage for `automation/`**: Noted in PR #5 retro, re-confirmed in PR #7 retro, still the case. A simple test for `syncHopperResearchItems` calling it twice on the same data would have caught the duplicate-insert race. **Revisit trigger**: any new function added to `automation/db.ts` should come with at least a basic test. This is the third retro noting this gap.

## Lessons Encoded

1. **Code fix (applied)**: Hoisted all prepare calls outside loops in `insertQueueItem` and refactored `ensureTag` to accept pre-prepared statements. This eliminates the pattern from both active code paths in `db.ts`.
2. **Architectural lesson**: When a service table has a logical 1:1 relationship with a parent table row (one queue item per thought), encode that as a UNIQUE constraint in the schema, not as application-level deduplication. Application logic changes; schema constraints persist. The `NOT IN` subquery plus `INSERT OR IGNORE` is defense-in-depth, not primary protection.
3. **Pattern to watch**: Any new `svc_*` table that references `thoughts.id` should have a UNIQUE index on `thought_id` if the business rule is one service row per thought. The `svc_weekly_review_deferred` table intentionally allows multiple rows per thought (different plans), so this is not a blanket rule, but it should be the conscious default.

## Hotspots

- **`automation/db.ts`**: First retro appearance. Now contains the most complex query logic in the project (sync, queue management, principles CRUD). As new service tables or sync paths are added, this file will likely appear again. The prepare-in-loop pattern was present in two functions; one was caught by review, the other was found during this retro.
- **`automation/worker.ts`**: Third consecutive retro (PR #5, PR #7, PR #8) where this file is touched or relevant. PR #8 added the `syncHopperResearchItems` call site in worker.ts. The file continues to accumulate concerns (process orchestration, sync, recovery, error detection, logging).
- **`automation/` (directory)**: Zero test coverage noted in all three retros. This is now a confirmed systemic gap, not a theoretical one.

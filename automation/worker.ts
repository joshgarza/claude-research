// Main worker for automated research pipeline.
// Picks the highest-priority queued item, runs Claude Code headless, validates output.

import { writeFileSync, appendFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execSync, spawnSync } from "node:child_process";
import type { AllowedToolsConfig } from "./types.ts";
import {
  openDb,
  getNextQueueItem,
  getRunningQueueItems,
  updateQueueItem,
  markThoughtProcessed,
  recoverStuckItems,
  syncHopperResearchItems,
} from "./db.ts";
import { readFileSync } from "node:fs";
import { buildPrompt, getExpectedOutputFile } from "./prompt.ts";
import { validate } from "./validate.ts";
import type { QueueItem } from "./types.ts";
import { DatabaseSync } from "node:sqlite";

const AUTOMATION_DIR = import.meta.dirname;
const PROJECT_ROOT = resolve(AUTOMATION_DIR, "..");
const ALLOWED_TOOLS_PATH = resolve(AUTOMATION_DIR, "allowed-tools.json");
const LOCK_PATH = resolve(AUTOMATION_DIR, "logs", "worker.lock");
const LOGS_DIR = resolve(AUTOMATION_DIR, "logs");
const WORKER_LOG = resolve(LOGS_DIR, "worker.log");
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const LOCK_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (worker loops through entire queue)

// --- Logging ---

type LogLevel = "INFO" | "WARN" | "ERROR" | "OK";

function log(level: LogLevel, itemId: string | null, message: string): void {
  const ts = new Date().toISOString();
  const prefix = itemId ? `[${itemId}]` : "[worker]";
  const line = `${ts} ${level.padEnd(5)} ${prefix} ${message}`;
  console.log(line);
  appendFileSync(WORKER_LOG, line + "\n");
}

// --- Lock management ---

function acquireLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    const lockContent = readFileSync(LOCK_PATH, "utf-8");
    const lockTime = parseInt(lockContent, 10);
    if (Date.now() - lockTime < LOCK_TTL_MS) {
      log("WARN", null, "Worker already running (lock held). Skipping.");
      return false;
    }
    log("INFO", null, "Stale lock found, removing.");
    unlinkSync(LOCK_PATH);
  }
  writeFileSync(LOCK_PATH, Date.now().toString());
  return true;
}

function releaseLock(): void {
  if (existsSync(LOCK_PATH)) {
    unlinkSync(LOCK_PATH);
  }
}

// --- Tool whitelist ---

function loadAllowedTools(): string[] {
  const config: AllowedToolsConfig = JSON.parse(
    readFileSync(ALLOWED_TOOLS_PATH, "utf-8")
  );
  return config.tools;
}

// --- Main ---

function processItem(item: QueueItem, db: DatabaseSync): void {
  const svcId = item.svcId!;
  log(
    "INFO",
    item.id,
    `Picked "${item.topic}" (priority ${item.priority}, attempt ${item.attempts + 1}/${item.maxAttempts})`
  );

  // Mark as running
  const newAttempts = item.attempts + 1;
  const startedAt = new Date().toISOString();
  updateQueueItem(db, svcId, {
    status: "running",
    attempts: newAttempts,
    startedAt,
  });

  const prompt = buildPrompt(item);
  const allowedTools = loadAllowedTools();
  const expectedOutput = getExpectedOutputFile(item);
  const logFile = resolve(LOGS_DIR, `${item.id}-attempt${newAttempts}.json`);

  const startTime = Date.now();

  const claudeArgs = [
    "-p",
    "--model",
    item.model,
    "--output-format",
    "json",
    "--allowedTools",
    ...allowedTools,
  ];

  let claudeOutput: string;
  let claudeStderr: string = "";
  let success = false;

  try {
    const result = spawnSync("claude", claudeArgs, {
      cwd: PROJECT_ROOT,
      input: prompt,
      timeout: TIMEOUT_MS,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (result.error) {
      throw result.error;
    }

    claudeOutput = result.stdout || "";
    claudeStderr = result.stderr || "";

    if (result.status !== 0) {
      log("ERROR", item.id, `Claude exited with code ${result.status}`);
      if (claudeStderr)
        log("ERROR", item.id, `stderr: ${claudeStderr.slice(0, 500)}`);
    }
    success = result.status === 0;
  } catch (err: any) {
    claudeOutput = err.message || "Unknown error";
    log(
      "ERROR",
      item.id,
      `Claude invocation failed: ${err.message?.slice(0, 500)}`
    );
  }

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  // Check for permission-related issues in stderr only (not claudeOutput, which contains
  // research content that may legitimately discuss permissions/auth topics)
  const permissionPatterns =
    /tool.*not allowed|permission denied|unauthorized.*tool|disallowed.*tool/i;
  const outputHasPermissionIssue = permissionPatterns.test(claudeStderr);
  if (outputHasPermissionIssue) {
    log(
      "WARN",
      item.id,
      "Possible permission issue detected in Claude output — check detailed log"
    );
  }

  // Save raw output to logs
  writeFileSync(
    logFile,
    JSON.stringify(
      {
        item,
        prompt: prompt.slice(0, 500) + "...",
        output: claudeOutput.slice(0, 50000),
        stderr: claudeStderr.slice(0, 5000),
        durationMs,
        success,
        permissionIssue: outputHasPermissionIssue,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  log(
    "INFO",
    item.id,
    `Claude finished in ${durationSec}s (exit=${success ? "ok" : "fail"}). Validating...`
  );

  // Validate output
  const validation = validate(item, expectedOutput);

  if (validation.valid) {
    const completedAt = new Date().toISOString();
    updateQueueItem(db, svcId, {
      status: "completed",
      completedAt,
      outputFile: expectedOutput,
    });
    // Extract thought_id from item.id ("t-{thought_id}")
    const thoughtId = parseInt(item.id.replace("t-", ""), 10);
    if (!isNaN(thoughtId)) {
      markThoughtProcessed(db, thoughtId);
    }
    log("OK", item.id, `Validation passed in ${durationSec}s`);

    if (validation.warnings.length > 0) {
      log("WARN", item.id, `Warnings: ${validation.warnings.join("; ")}`);
    }

    // Git push (worker does this, not Claude)
    try {
      execSync("git push", {
        cwd: PROJECT_ROOT,
        timeout: 30_000,
        encoding: "utf-8",
      });
      log("OK", item.id, "Pushed to remote");
    } catch (pushErr: any) {
      log(
        "ERROR",
        item.id,
        `Git push failed (commit is local): ${pushErr.message?.slice(0, 200)}`
      );
    }
  } else {
    log("ERROR", item.id, `Validation failed: ${validation.errors.join("; ")}`);

    if (newAttempts >= item.maxAttempts) {
      updateQueueItem(db, svcId, {
        status: "failed",
        error: validation.errors.join("; "),
      });
      log(
        "ERROR",
        item.id,
        `Max attempts (${item.maxAttempts}) reached, marking as failed`
      );
    } else {
      updateQueueItem(db, svcId, { status: "queued" });
      log(
        "WARN",
        item.id,
        `Re-queued for retry (attempt ${newAttempts}/${item.maxAttempts})`
      );
    }
  }

  // Safety: ensure CLAUDE.md wasn't modified
  try {
    execSync("git checkout -- CLAUDE.md", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
  } catch {
    // Fine if it wasn't modified
  }

  log("INFO", item.id, `Done — status: ${item.status}`);
}

async function main(): Promise<void> {
  log("INFO", null, "Worker starting");

  if (!acquireLock()) {
    log("WARN", null, "Lock held by another worker, skipping");
    process.exit(0);
  }

  const db = openDb();

  try {
    const synced = syncHopperResearchItems(db);
    if (synced > 0) {
      log("INFO", null, `Synced ${synced} new research-topic thought(s) from hopper`);
    }

    const recovered = recoverStuckItems(db);
    if (recovered > 0) {
      log("INFO", null, `Recovered ${recovered} stuck item(s)`);
    }

    let processed = 0;
    let item: QueueItem | null;

    while ((item = getNextQueueItem(db)) !== null) {
      processItem(item, db);
      processed++;
    }

    if (processed === 0) {
      log("INFO", null, "No queued items, nothing to do");
    } else {
      log("INFO", null, `Run complete — processed ${processed} item(s)`);
    }
  } finally {
    releaseLock();
  }
}

main().catch((err) => {
  log("ERROR", null, `Worker crashed: ${err.message || err}`);

  try {
    const db = openDb();
    recoverStuckItems(db);
  } catch {
    // DB may be unavailable — nothing we can do
  }

  releaseLock();
  process.exit(1);
});

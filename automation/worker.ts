// Main worker for automated research pipeline.
// Picks the highest-priority queued item, runs Claude Code headless, validates output.

import { readFileSync, writeFileSync, appendFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execSync, spawnSync } from "node:child_process";
import type { Queue, QueueItem, AllowedToolsConfig } from "./types.ts";
import { buildPrompt, getExpectedOutputFile } from "./prompt.ts";
import { validate } from "./validate.ts";

const AUTOMATION_DIR = import.meta.dirname;
const PROJECT_ROOT = resolve(AUTOMATION_DIR, "..");
const QUEUE_PATH = resolve(AUTOMATION_DIR, "queue.json");
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
      console.error("Worker already running (lock held). Skipping.");
      return false;
    }
    console.log("Stale lock found, removing.");
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

// --- Queue management ---

function readQueue(): Queue {
  return JSON.parse(readFileSync(QUEUE_PATH, "utf-8"));
}

function writeQueue(queue: Queue): void {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n");
}

function pickNextItem(queue: Queue): QueueItem | null {
  const candidates = queue.items
    .filter((i) => i.status === "queued")
    .sort((a, b) => a.priority - b.priority);
  return candidates[0] ?? null;
}

function recoverStuckItems(queue: Queue): number {
  let recovered = 0;
  for (const item of queue.items) {
    if (item.status !== "running") continue;

    if (item.attempts >= item.maxAttempts) {
      item.status = "failed";
      item.error = "Worker crashed or timed out";
      log("WARN", item.id, `Recovered stuck item — max attempts reached, marking as failed`);
    } else {
      item.status = "queued";
      log("WARN", item.id, `Recovered stuck item — re-queued (attempt ${item.attempts}/${item.maxAttempts})`);
    }
    recovered++;
  }
  if (recovered > 0) {
    writeQueue(queue);
  }
  return recovered;
}

// --- Tool whitelist ---

function loadAllowedTools(): string[] {
  const config: AllowedToolsConfig = JSON.parse(
    readFileSync(ALLOWED_TOOLS_PATH, "utf-8")
  );
  return config.tools;
}

// --- Main ---

function processItem(item: QueueItem, queue: Queue): void {
  log("INFO", item.id, `Picked "${item.topic}" (priority ${item.priority}, attempt ${item.attempts + 1}/${item.maxAttempts})`);

  // Mark as running
  item.status = "running";
  item.attempts += 1;
  item.started = new Date().toISOString();
  writeQueue(queue);

  const prompt = buildPrompt(item);
  const allowedTools = loadAllowedTools();
  const expectedOutput = getExpectedOutputFile(item);
  const logFile = resolve(LOGS_DIR, `${item.id}-attempt${item.attempts}.json`);

  const startTime = Date.now();

  // Build claude command args (prompt piped via stdin)
  const claudeArgs = [
    "-p",
    "--model", item.model,
    "--output-format", "json",
    "--allowedTools", ...allowedTools,
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
      if (claudeStderr) log("ERROR", item.id, `stderr: ${claudeStderr.slice(0, 500)}`);
    }
    success = result.status === 0;
  } catch (err: any) {
    claudeOutput = err.message || "Unknown error";
    log("ERROR", item.id, `Claude invocation failed: ${err.message?.slice(0, 500)}`);
  }

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  // Check for permission-related issues in output
  const permissionPatterns = /permission|not allowed|denied|unauthorized|disallowed/i;
  const outputHasPermissionIssue = permissionPatterns.test(claudeOutput) || permissionPatterns.test(claudeStderr);
  if (outputHasPermissionIssue) {
    log("WARN", item.id, "Possible permission issue detected in Claude output — check detailed log");
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

  log("INFO", item.id, `Claude finished in ${durationSec}s (exit=${success ? "ok" : "fail"}). Validating...`);

  // Validate output
  const validation = validate(item, expectedOutput);

  if (validation.valid) {
    item.status = "completed";
    item.completed = new Date().toISOString();
    item.outputFile = expectedOutput;
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
      log("ERROR", item.id, `Git push failed (commit is local): ${pushErr.message?.slice(0, 200)}`);
    }
  } else {
    log("ERROR", item.id, `Validation failed: ${validation.errors.join("; ")}`);

    if (item.attempts >= item.maxAttempts) {
      item.status = "failed";
      item.error = validation.errors.join("; ");
      log("ERROR", item.id, `Max attempts (${item.maxAttempts}) reached, marking as failed`);
    } else {
      item.status = "queued"; // Re-queue for retry
      log("WARN", item.id, `Re-queued for retry (attempt ${item.attempts}/${item.maxAttempts})`);
    }
  }

  writeQueue(queue);

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

  try {
    const queue = readQueue();
    recoverStuckItems(queue);

    let processed = 0;
    let item: QueueItem | null;

    while ((item = pickNextItem(queue)) !== null) {
      processItem(item, queue);
      processed++;

      // Re-read queue in case it was modified externally (e.g. new items enqueued)
      const freshQueue = readQueue();
      queue.items = freshQueue.items;
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

  // Reset any item stuck as "running" so it can be retried
  try {
    const queue = readQueue();
    recoverStuckItems(queue);
  } catch {
    // Queue file may be corrupted — nothing we can do
  }

  releaseLock();
  process.exit(1);
});

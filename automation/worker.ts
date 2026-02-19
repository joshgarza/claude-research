// Main worker for automated research pipeline.
// Picks the highest-priority queued item, runs Claude Code headless, validates output.

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
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
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

// --- Tool whitelist ---

function loadAllowedTools(): string[] {
  const config: AllowedToolsConfig = JSON.parse(
    readFileSync(ALLOWED_TOOLS_PATH, "utf-8")
  );
  return config.tools;
}

// --- Main ---

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Worker starting...`);

  if (!acquireLock()) {
    process.exit(0);
  }

  try {
    const queue = readQueue();
    const item = pickNextItem(queue);

    if (!item) {
      console.log("No queued items. Nothing to do.");
      return;
    }

    console.log(`Processing: "${item.topic}" (${item.id}, priority ${item.priority})`);

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
      "--settings", resolve(AUTOMATION_DIR, "settings.automation.json"),
      "--permission-mode", "bypassPermissions",
    ];

    let claudeOutput: string;
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
      if (result.status !== 0) {
        console.error("Claude exited with code", result.status);
        if (result.stderr) console.error("stderr:", result.stderr.slice(0, 500));
      }
      success = result.status === 0;
    } catch (err: any) {
      claudeOutput = err.message || "Unknown error";
      console.error("Claude invocation failed:", err.message?.slice(0, 500));
    }

    const durationMs = Date.now() - startTime;

    // Save raw output to logs
    writeFileSync(
      logFile,
      JSON.stringify(
        {
          item,
          prompt: prompt.slice(0, 500) + "...",
          output: claudeOutput.slice(0, 50000),
          durationMs,
          success,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    console.log(`Claude finished in ${(durationMs / 1000).toFixed(1)}s. Validating...`);

    // Validate output
    const validation = validate(item, expectedOutput);

    if (validation.valid) {
      item.status = "completed";
      item.completed = new Date().toISOString();
      item.outputFile = expectedOutput;
      console.log("Validation PASSED.");

      if (validation.warnings.length > 0) {
        console.log("Warnings:", validation.warnings.join("; "));
      }

      // Git push (worker does this, not Claude)
      try {
        execSync("git push", {
          cwd: PROJECT_ROOT,
          timeout: 30_000,
          encoding: "utf-8",
        });
        console.log("Pushed to remote.");
      } catch (pushErr: any) {
        console.error("Git push failed (commit is local):", pushErr.message?.slice(0, 200));
      }
    } else {
      console.error("Validation FAILED:", validation.errors.join("; "));

      if (item.attempts >= item.maxAttempts) {
        item.status = "failed";
        item.error = validation.errors.join("; ");
        console.error(`Max attempts (${item.maxAttempts}) reached. Marking as failed.`);
      } else {
        item.status = "queued"; // Re-queue for retry
        console.log(`Will retry (attempt ${item.attempts}/${item.maxAttempts}).`);
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

    console.log(`[${new Date().toISOString()}] Worker finished. Status: ${item.status}`);
  } finally {
    releaseLock();
  }
}

main().catch((err) => {
  console.error("Worker crashed:", err);
  releaseLock();
  process.exit(1);
});

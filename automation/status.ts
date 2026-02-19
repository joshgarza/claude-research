// CLI helper to view research queue status.
// Usage: node --experimental-strip-types automation/status.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Queue, QueueItem } from "./types.ts";

const QUEUE_PATH = resolve(import.meta.dirname, "queue.json");
const LOCK_PATH = resolve(import.meta.dirname, "logs", "worker.lock");

function statusEmoji(status: QueueItem["status"]): string {
  switch (status) {
    case "queued": return " ";
    case "running": return ">";
    case "completed": return "x";
    case "failed": return "!";
    case "review": return "?";
  }
}

function main(): void {
  const queue: Queue = JSON.parse(readFileSync(QUEUE_PATH, "utf-8"));

  const counts = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    review: 0,
  };

  for (const item of queue.items) {
    counts[item.status]++;
  }

  // Summary line
  const parts = [];
  if (counts.queued > 0) parts.push(`${counts.queued} queued`);
  if (counts.running > 0) parts.push(`${counts.running} running`);
  if (counts.completed > 0) parts.push(`${counts.completed} completed`);
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  if (counts.review > 0) parts.push(`${counts.review} review`);
  console.log(parts.join(", ") || "Queue is empty");

  // Lock status
  if (existsSync(LOCK_PATH)) {
    const lockTime = parseInt(readFileSync(LOCK_PATH, "utf-8"), 10);
    const ago = Math.round((Date.now() - lockTime) / 1000 / 60);
    console.log(`Worker lock held (${ago}m ago)`);
  }

  // Last completed
  const lastCompleted = queue.items
    .filter((i) => i.status === "completed" && i.completed)
    .sort((a, b) => (b.completed! > a.completed! ? 1 : -1))[0];
  if (lastCompleted) {
    console.log(`Last completed: "${lastCompleted.topic}" (${lastCompleted.completed})`);
  }

  // Detailed list
  console.log("");
  console.log("ID                  P  Status     Topic");
  console.log("─".repeat(70));

  const sorted = [...queue.items].sort((a, b) => {
    // Running first, then queued by priority, then completed/failed
    const statusOrder = { running: 0, queued: 1, review: 2, failed: 3, completed: 4 };
    const diff = statusOrder[a.status] - statusOrder[b.status];
    if (diff !== 0) return diff;
    return a.priority - b.priority;
  });

  for (const item of sorted) {
    const status = `[${statusEmoji(item.status)}]`.padEnd(10);
    const id = item.id.padEnd(20);
    const priority = String(item.priority).padEnd(3);
    const attempts = item.attempts > 0 ? ` (${item.attempts}/${item.maxAttempts})` : "";
    console.log(`${id}${priority}${status}${item.topic}${attempts}`);
  }
}

main();

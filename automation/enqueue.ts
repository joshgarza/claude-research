// CLI helper to add topics to the research queue.
// Usage: node --experimental-strip-types automation/enqueue.ts "Topic" "Description" --tags tag1,tag2

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Queue, QueueItem } from "./types.ts";

const QUEUE_PATH = resolve(import.meta.dirname, "queue.json");

function generateId(): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `q-${date}-${seq}`;
}

function parseArgs(args: string[]) {
  const positional: string[] = [];
  let tags: string[] = [];
  let priority = 5;
  let model: QueueItem["model"] = "sonnet";
  let maxAttempts = 2;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tags" && args[i + 1]) {
      tags = args[++i].split(",").map((t) => t.trim());
    } else if (arg === "--priority" && args[i + 1]) {
      priority = parseInt(args[++i], 10);
    } else if (arg === "--model" && args[i + 1]) {
      model = args[++i] as QueueItem["model"];
    } else if (arg === "--max-attempts" && args[i + 1]) {
      maxAttempts = parseInt(args[++i], 10);
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  return { positional, tags, priority, model, maxAttempts };
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help") {
    console.log(`Usage: enqueue <topic> [description] [options]

Arguments:
  topic          Research topic (required)
  description    Detailed description (optional)

Options:
  --tags t1,t2   Comma-separated tags
  --priority N   Priority (1=highest, default=5)
  --model M      Model to use (sonnet|opus|haiku, default=sonnet)
  --max-attempts Max retry attempts (default=2)

Examples:
  enqueue "Real-time Architecture" "WebSocket vs SSE vs polling..." --tags websockets,sse
  enqueue "GraphQL Best Practices" --priority 2 --tags graphql,api`);
    process.exit(0);
  }

  const { positional, tags, priority, model, maxAttempts } = parseArgs(args);
  const topic = positional[0];
  const description = positional[1] || topic;

  if (!topic) {
    console.error("Error: topic is required");
    process.exit(1);
  }

  const queue: Queue = JSON.parse(readFileSync(QUEUE_PATH, "utf-8"));

  const item: QueueItem = {
    id: generateId(),
    topic,
    description,
    tags,
    priority,
    status: "queued",
    added: new Date().toISOString(),
    attempts: 0,
    maxAttempts,
    model,
  };

  queue.items.push(item);
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n");

  console.log(`Added to queue: "${topic}" (${item.id})`);
  console.log(`  Priority: ${priority} | Tags: ${tags.join(", ") || "(none)"} | Model: ${model}`);

  const queuedCount = queue.items.filter((i) => i.status === "queued").length;
  console.log(`  Queue depth: ${queuedCount} items`);
}

main();

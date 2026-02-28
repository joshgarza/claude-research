// One-time migration: seeds the Hopper DB from queue.json and principles/*.md.
// Safe to run multiple times — skips items that are already present.
//
// Usage: node --experimental-strip-types automation/migrate.ts [--dry-run]

import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  openDb,
  insertPrinciple,
  getAllPrinciples,
} from "./db.ts";
import type { Queue, QueueItem } from "./types.ts";

const AUTOMATION_DIR = import.meta.dirname;
const PROJECT_ROOT = resolve(AUTOMATION_DIR, "..");
const QUEUE_PATH = resolve(AUTOMATION_DIR, "queue.json");
const PRINCIPLES_DIR = resolve(PROJECT_ROOT, "principles");

const isDryRun = process.argv.includes("--dry-run");

function log(msg: string): void {
  console.log(msg);
}

// --- Queue migration ---

function migrateQueueItem(db: DatabaseSync, item: QueueItem): void {
  // Check if already migrated by looking for a thought with this legacy_id in context
  const existing = db
    .prepare(
      `SELECT id FROM thoughts
       WHERE category = 'research-topic'
         AND JSON_EXTRACT(context, '$.legacy_id') = ?`
    )
    .get(item.id) as { id: number } | undefined;

  if (existing) {
    log(`  skip (already migrated): ${item.id} "${item.topic}"`);
    return;
  }

  const context = JSON.stringify({
    topic: item.topic,
    legacy_id: item.id,
    tags: item.tags,
    output_file: item.outputFile ?? null,
  });

  const thoughtStatus = item.status === "completed" ? "processed" : "pending";
  const createdAt = item.added;

  if (isDryRun) {
    log(`  [dry-run] would insert thought: "${item.topic}" (${item.status})`);
    return;
  }

  const thoughtResult = db
    .prepare(
      `INSERT INTO thoughts (raw_input, category, status, context, created_at, processed_at)
       VALUES (?, 'research-topic', ?, ?, ?, ?)`
    )
    .run(
      item.description,
      thoughtStatus,
      context,
      createdAt,
      item.completed ?? null
    );
  const thoughtId = thoughtResult.lastInsertRowid as number;

  // Insert tags
  for (const tagName of item.tags) {
    let tag = db
      .prepare("SELECT id FROM tags WHERE name = ?")
      .get(tagName) as { id: number } | undefined;
    if (!tag) {
      const r = db.prepare("INSERT INTO tags (name) VALUES (?)").run(tagName);
      tag = { id: r.lastInsertRowid as number };
    }
    db.prepare(
      "INSERT OR IGNORE INTO thought_tags (thought_id, tag_id) VALUES (?, ?)"
    ).run(thoughtId, tag.id);
  }

  // Map queue.json status to svc status
  const svcStatus = item.status === "review" ? "completed" : item.status;

  db.prepare(
    `INSERT INTO svc_research_queue_items
       (thought_id, status, priority, model, max_attempts, attempts,
        output_file, started_at, completed_at, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    thoughtId,
    svcStatus,
    item.priority,
    item.model,
    item.maxAttempts,
    item.attempts,
    item.outputFile ?? null,
    item.started ?? null,
    item.completed ?? null,
    item.error ?? null
  );

  log(`  migrated: ${item.id} "${item.topic}" (${item.status})`);
}

function migrateQueue(db: DatabaseSync): void {
  log("\n=== Migrating queue.json ===");
  const queue: Queue = JSON.parse(readFileSync(QUEUE_PATH, "utf-8"));
  log(`Found ${queue.items.length} items`);

  for (const item of queue.items) {
    migrateQueueItem(db, item);
  }
}

// --- Principles migration ---

function migratePrinciple(
  db: DatabaseSync,
  filename: string,
  existing: Set<string>
): void {
  if (existing.has(filename)) {
    log(`  skip (already migrated): ${filename}`);
    return;
  }

  const fullPath = resolve(PRINCIPLES_DIR, filename);
  const content = readFileSync(fullPath, "utf-8");

  // Extract topic from first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  const topic = h1Match ? h1Match[1].trim() : basename(filename, ".md");

  if (isDryRun) {
    log(`  [dry-run] would insert principle: ${filename} "${topic}"`);
    return;
  }

  insertPrinciple(db, filename, topic, content);
  log(`  migrated: ${filename} "${topic}"`);
}

function migratePrinciples(db: DatabaseSync): void {
  log("\n=== Migrating principles/ ===");

  const existing = new Set(
    getAllPrinciples(db).map((p) => p.filename)
  );

  const files = readdirSync(PRINCIPLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  log(`Found ${files.length} principle files (${existing.size} already in DB)`);

  for (const filename of files) {
    migratePrinciple(db, filename, existing);
  }
}

// --- Main ---

function main(): void {
  if (isDryRun) {
    log("Dry run mode — no changes will be written.");
  }

  const db = openDb();
  migrateQueue(db);
  migratePrinciples(db);

  if (!isDryRun) {
    // Summary
    const queueCount = (
      db
        .prepare("SELECT COUNT(*) AS n FROM svc_research_queue_items")
        .get() as { n: number }
    ).n;
    const principleCount = (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM thoughts WHERE category = 'principle'"
        )
        .get() as { n: number }
    ).n;

    log(`\n=== Done ===`);
    log(`  svc_research_queue_items: ${queueCount} rows`);
    log(`  principle thoughts: ${principleCount} rows`);
  }
}

main();

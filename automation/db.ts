// DB access layer for the research queue.
// Uses node:sqlite (stable since Node 23.4, available in Node 24).

import { DatabaseSync } from "node:sqlite";
import type { QueueItem } from "./types.ts";

const DB_PATH =
  process.env.HOPPER_DB ??
  "/home/josh/coding/claude/hopper-shared/data/hopper.db";

export function openDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode=WAL");
  initSchema(db);
  return db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS svc_research_queue_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thought_id INTEGER NOT NULL REFERENCES thoughts(id),
      status TEXT NOT NULL DEFAULT 'queued',
      priority INTEGER NOT NULL DEFAULT 5,
      model TEXT NOT NULL DEFAULT 'sonnet',
      max_attempts INTEGER NOT NULL DEFAULT 2,
      attempts INTEGER NOT NULL DEFAULT 0,
      output_file TEXT,
      started_at TEXT,
      completed_at TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_svc_research_thought_id ON svc_research_queue_items(thought_id)`
  );
}

// --- Internal helpers ---

function parseCtx(context: unknown): Record<string, unknown> {
  if (!context || typeof context !== "string") return {};
  try {
    return JSON.parse(context) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseTags(ctx: Record<string, unknown>): string[] {
  const tags = ctx.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string");
}

type SvcRow = Record<string, unknown>;

const SELECT_SVC = `
  SELECT
    svc.id AS svc_id,
    svc.thought_id,
    t.raw_input,
    t.context,
    t.created_at AS thought_created_at,
    svc.status,
    svc.priority,
    svc.model,
    svc.max_attempts,
    svc.attempts,
    svc.output_file,
    svc.started_at,
    svc.completed_at,
    svc.error
  FROM svc_research_queue_items svc
  JOIN thoughts t ON t.id = svc.thought_id
`;

function rowToItem(row: SvcRow): QueueItem {
  const ctx = parseCtx(row.context);
  return {
    id: `t-${row.thought_id}`,
    svcId: row.svc_id as number,
    topic: (ctx.topic as string) ?? (row.raw_input as string),
    description: row.raw_input as string,
    tags: parseTags(ctx),
    priority: row.priority as number,
    status: row.status as QueueItem["status"],
    added: row.thought_created_at as string,
    started: (row.started_at as string) ?? undefined,
    completed: (row.completed_at as string) ?? undefined,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    model: row.model as QueueItem["model"],
    outputFile: (row.output_file as string) ?? undefined,
    error: (row.error as string) ?? undefined,
  };
}

// --- Queue reads ---

export function getNextQueueItem(db: DatabaseSync): QueueItem | null {
  const row = db
    .prepare(
      `${SELECT_SVC} WHERE svc.status = 'queued' ORDER BY svc.priority ASC, svc.created_at ASC LIMIT 1`
    )
    .get() as SvcRow | undefined;
  return row ? rowToItem(row) : null;
}

export function getAllQueueItems(db: DatabaseSync): QueueItem[] {
  const rows = db.prepare(SELECT_SVC).all() as SvcRow[];
  return rows.map(rowToItem);
}

export function getRunningQueueItems(db: DatabaseSync): QueueItem[] {
  const rows = db
    .prepare(`${SELECT_SVC} WHERE svc.status = 'running'`)
    .all() as SvcRow[];
  return rows.map(rowToItem);
}

// --- Queue writes ---

export function updateQueueItem(
  db: DatabaseSync,
  svcId: number,
  updates: Partial<{
    status: string;
    attempts: number;
    startedAt: string | null;
    completedAt: string | null;
    outputFile: string | null;
    error: string | null;
  }>
): void {
  const params: Record<string, unknown> = { $id: svcId };
  const setClauses: string[] = [];

  if (updates.status !== undefined) {
    setClauses.push("status = $status");
    params["$status"] = updates.status;
  }
  if (updates.attempts !== undefined) {
    setClauses.push("attempts = $attempts");
    params["$attempts"] = updates.attempts;
  }
  if (updates.startedAt !== undefined) {
    setClauses.push("started_at = $startedAt");
    params["$startedAt"] = updates.startedAt;
  }
  if (updates.completedAt !== undefined) {
    setClauses.push("completed_at = $completedAt");
    params["$completedAt"] = updates.completedAt;
  }
  if (updates.outputFile !== undefined) {
    setClauses.push("output_file = $outputFile");
    params["$outputFile"] = updates.outputFile;
  }
  if (updates.error !== undefined) {
    setClauses.push("error = $error");
    params["$error"] = updates.error;
  }

  if (setClauses.length === 0) return;
  db.prepare(
    `UPDATE svc_research_queue_items SET ${setClauses.join(", ")} WHERE id = $id`
  ).run(params);
}

export function markThoughtProcessed(
  db: DatabaseSync,
  thoughtId: number
): void {
  db.prepare(
    "UPDATE thoughts SET status = 'processed', processed_at = datetime('now') WHERE id = ?"
  ).run(thoughtId);
}

function ensureTag(
  selectTag: ReturnType<DatabaseSync["prepare"]>,
  insertTag: ReturnType<DatabaseSync["prepare"]>,
  name: string
): number {
  const existing = selectTag.get(name) as { id: number } | undefined;
  if (existing) return existing.id;
  const result = insertTag.run(name);
  return result.lastInsertRowid as number;
}

export function insertQueueItem(
  db: DatabaseSync,
  item: {
    topic: string;
    description: string;
    tags: string[];
    priority: number;
    model: string;
    maxAttempts: number;
  }
): QueueItem {
  const context = JSON.stringify({ topic: item.topic, tags: item.tags });

  const thoughtResult = db
    .prepare(
      `INSERT INTO thoughts (raw_input, category, status, context, created_at)
       VALUES (?, 'research-topic', 'pending', ?, datetime('now'))`
    )
    .run(item.description, context);
  const thoughtId = thoughtResult.lastInsertRowid as number;

  const selectTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const insertTag = db.prepare("INSERT INTO tags (name) VALUES (?)");
  const insertThoughtTag = db.prepare(
    "INSERT OR IGNORE INTO thought_tags (thought_id, tag_id) VALUES (?, ?)"
  );
  for (const tagName of item.tags) {
    const tagId = ensureTag(selectTag, insertTag, tagName);
    insertThoughtTag.run(thoughtId, tagId);
  }

  const svcResult = db
    .prepare(
      `INSERT INTO svc_research_queue_items (thought_id, status, priority, model, max_attempts, attempts)
       VALUES (?, 'queued', ?, ?, ?, 0)`
    )
    .run(thoughtId, item.priority, item.model, item.maxAttempts);
  const svcId = svcResult.lastInsertRowid as number;

  return rowToItem(
    db
      .prepare(`${SELECT_SVC} WHERE svc.id = ?`)
      .get(svcId) as SvcRow
  );
}

export function syncHopperResearchItems(db: DatabaseSync): number {
  const rows = db
    .prepare(
      `SELECT id, raw_input, context FROM thoughts
       WHERE category = 'research-topic'
         AND status = 'processed'
         AND id NOT IN (SELECT thought_id FROM svc_research_queue_items)`
    )
    .all() as { id: number; raw_input: string; context: string | null }[];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO svc_research_queue_items (thought_id, status, priority, model, max_attempts, attempts)
     VALUES (?, 'queued', 5, 'sonnet', 2, 0)`
  );
  for (const row of rows) {
    insert.run(row.id);
  }

  return rows.length;
}

export function recoverStuckItems(db: DatabaseSync): number {
  const running = getRunningQueueItems(db);
  let recovered = 0;

  for (const item of running) {
    const svcId = item.svcId!;
    if (item.attempts >= item.maxAttempts) {
      updateQueueItem(db, svcId, {
        status: "failed",
        error: "Worker crashed or timed out",
      });
    } else {
      updateQueueItem(db, svcId, { status: "queued" });
    }
    recovered++;
  }

  return recovered;
}

// --- Principles ---

export interface PrincipleRecord {
  id: number;
  filename: string;
  topic: string;
  content: string;
  createdAt: string;
}

type PrincipleRow = Record<string, unknown>;

function rowToPrinciple(row: PrincipleRow): PrincipleRecord {
  const ctx = parseCtx(row.context);
  return {
    id: row.id as number,
    filename: (ctx.filename as string) ?? "",
    topic: (ctx.topic as string) ?? "",
    content: row.raw_input as string,
    createdAt: row.created_at as string,
  };
}

export function getAllPrinciples(db: DatabaseSync): PrincipleRecord[] {
  const rows = db
    .prepare(
      `SELECT id, raw_input, context, created_at FROM thoughts
       WHERE category = 'principle' ORDER BY created_at ASC`
    )
    .all() as PrincipleRow[];
  return rows.map(rowToPrinciple);
}

export function searchPrinciples(
  db: DatabaseSync,
  query: string
): PrincipleRecord[] {
  const q = `%${query.toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT id, raw_input, context, created_at FROM thoughts
       WHERE category = 'principle'
         AND (LOWER(raw_input) LIKE ? OR LOWER(context) LIKE ?)
       ORDER BY created_at ASC`
    )
    .all(q, q) as PrincipleRow[];
  return rows.map(rowToPrinciple);
}

export function insertPrinciple(
  db: DatabaseSync,
  filename: string,
  topic: string,
  content: string
): number {
  const context = JSON.stringify({ filename, topic });
  const result = db
    .prepare(
      `INSERT INTO thoughts (raw_input, category, status, context, created_at)
       VALUES (?, 'principle', 'processed', ?, datetime('now'))`
    )
    .run(content, context);
  return result.lastInsertRowid as number;
}

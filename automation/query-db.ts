// Query helper for the research agent.
// Lets the agent search principles and research history from the Hopper DB.
//
// Usage:
//   node --experimental-strip-types automation/query-db.ts principles
//   node --experimental-strip-types automation/query-db.ts principles <search terms>
//   node --experimental-strip-types automation/query-db.ts research
//   node --experimental-strip-types automation/query-db.ts research <search terms>

import { openDb, getAllPrinciples, searchPrinciples } from "./db.ts";
import { DatabaseSync } from "node:sqlite";

type ResearchRow = Record<string, unknown>;

function getRecentResearch(db: DatabaseSync, limit = 30): ResearchRow[] {
  return db
    .prepare(
      `SELECT
         t.id,
         JSON_EXTRACT(t.context, '$.topic') AS topic,
         JSON_EXTRACT(t.context, '$.legacy_id') AS legacy_id,
         JSON_EXTRACT(t.context, '$.output_file') AS output_file,
         svc.status,
         svc.completed_at,
         t.created_at
       FROM thoughts t
       JOIN svc_research_queue_items svc ON svc.thought_id = t.id
       WHERE t.category = 'research-topic'
       ORDER BY svc.completed_at DESC NULLS LAST, t.created_at DESC
       LIMIT ?`
    )
    .all(limit) as ResearchRow[];
}

function searchResearch(db: DatabaseSync, query: string): ResearchRow[] {
  const q = `%${query.toLowerCase()}%`;
  return db
    .prepare(
      `SELECT
         t.id,
         JSON_EXTRACT(t.context, '$.topic') AS topic,
         JSON_EXTRACT(t.context, '$.legacy_id') AS legacy_id,
         JSON_EXTRACT(t.context, '$.output_file') AS output_file,
         svc.status,
         svc.completed_at,
         t.raw_input AS description,
         t.created_at
       FROM thoughts t
       JOIN svc_research_queue_items svc ON svc.thought_id = t.id
       WHERE t.category = 'research-topic'
         AND (LOWER(JSON_EXTRACT(t.context, '$.topic')) LIKE ?
              OR LOWER(t.raw_input) LIKE ?)
       ORDER BY svc.completed_at DESC NULLS LAST`
    )
    .all(q, q) as ResearchRow[];
}

function cmdPrinciples(db: DatabaseSync, searchTerms: string[]): void {
  if (searchTerms.length === 0) {
    const all = getAllPrinciples(db);
    if (all.length === 0) {
      console.log("No principles in DB yet.");
      return;
    }
    console.log(`${all.length} principle files:\n`);
    for (const p of all) {
      console.log(`  ${p.filename.padEnd(50)} ${p.topic}`);
    }
    console.log(
      "\nTo get full content: query-db.ts principles <search terms>"
    );
    return;
  }

  const query = searchTerms.join(" ");
  const results = searchPrinciples(db, query);

  if (results.length === 0) {
    console.log(`No principles matching "${query}".`);
    return;
  }

  console.log(`${results.length} principle(s) matching "${query}":\n`);
  for (const p of results) {
    console.log(`${"=".repeat(60)}`);
    console.log(`FILE: ${p.filename}  TOPIC: ${p.topic}`);
    console.log(`${"=".repeat(60)}`);
    console.log(p.content);
    console.log();
  }
}

function cmdResearch(db: DatabaseSync, searchTerms: string[]): void {
  if (searchTerms.length === 0) {
    const rows = getRecentResearch(db);
    if (rows.length === 0) {
      console.log("No research items in DB yet.");
      return;
    }
    console.log(`${rows.length} most recent research items:\n`);
    for (const r of rows) {
      const status = String(r.status ?? "").padEnd(10);
      const date = String(r.completed_at ?? r.created_at ?? "").slice(0, 10);
      const topic = String(r.topic ?? "(unknown)");
      const file = r.output_file ? `  -> ${r.output_file}` : "";
      console.log(`  [${status}] ${date}  ${topic}${file}`);
    }
    return;
  }

  const query = searchTerms.join(" ");
  const rows = searchResearch(db, query);

  if (rows.length === 0) {
    console.log(`No research matching "${query}".`);
    return;
  }

  console.log(`${rows.length} research item(s) matching "${query}":\n`);
  for (const r of rows) {
    const status = String(r.status ?? "");
    const date = String(r.completed_at ?? r.created_at ?? "").slice(0, 10);
    console.log(`Topic:       ${r.topic ?? "(unknown)"}`);
    console.log(`Status:      ${status}  Date: ${date}`);
    if (r.description) console.log(`Description: ${r.description}`);
    if (r.output_file)
      console.log(`Output file: ${r.output_file}  (use Read tool to view)`);
    console.log();
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  if (!command || command === "--help") {
    console.log(`Research DB query tool

Commands:
  principles                  List all principle files
  principles <search terms>   Show full content of matching principles
  research                    List recent research items
  research <search terms>     Find research by topic or description

Examples:
  query-db.ts principles
  query-db.ts principles caching api
  query-db.ts research websockets
  query-db.ts research agent orchestration`);
    process.exit(0);
  }

  const db = openDb();

  switch (command) {
    case "principles":
      cmdPrinciples(db, rest);
      break;
    case "research":
      cmdResearch(db, rest);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run with --help for usage.");
      process.exit(1);
  }
}

main();

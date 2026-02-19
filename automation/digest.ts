// Generates a weekly digest of recent research findings.
// Uses the Anthropic API directly (not Claude Code) — simple text in, text out.
//
// Usage: node --experimental-strip-types automation/digest.ts [--days 7]

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const RESEARCH_DIR = resolve(PROJECT_ROOT, "research");
const DIGESTS_DIR = resolve(RESEARCH_DIR, "digests");
const DEFAULT_DAYS = 7;

function parseArgs(): { days: number } {
  const args = process.argv.slice(2);
  let days = DEFAULT_DAYS;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[++i], 10);
    }
  }
  return { days };
}

interface ResearchFile {
  path: string;
  filename: string;
  date: string;
  topic: string;
  tags: string[];
  content: string;
}

function getRecentResearchFiles(days: number): ResearchFile[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const files = readdirSync(RESEARCH_DIR)
    .filter((f) => f.endsWith(".md") && /^\d{4}-\d{2}-\d{2}/.test(f))
    .filter((f) => {
      const dateStr = f.slice(0, 10);
      return dateStr >= cutoffStr;
    })
    .sort();

  return files.map((filename) => {
    const fullPath = join(RESEARCH_DIR, filename);
    const content = readFileSync(fullPath, "utf-8");

    // Parse frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let topic = filename;
    let tags: string[] = [];
    let date = filename.slice(0, 10);

    if (fmMatch) {
      const fm = fmMatch[1];
      const topicMatch = fm.match(/topic:\s*(.+)/);
      if (topicMatch) topic = topicMatch[1].trim();

      const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/);
      if (tagsMatch) {
        tags = tagsMatch[1].split(",").map((t) => t.trim());
      }

      const dateMatch = fm.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) date = dateMatch[1];

      // Skip superseded files
      if (fm.includes("status: superseded")) return null;
    }

    return { path: fullPath, filename, date, topic, tags, content };
  }).filter((f): f is ResearchFile => f !== null);
}

async function generateDigest(files: ResearchFile[]): Promise<string> {
  const client = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  const filesSummary = files
    .map((f) => `### ${f.topic} (${f.date})\nTags: ${f.tags.join(", ")}\n\n${f.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a research digest generator. You synthesize multiple research files into a concise, actionable weekly digest. Your output is markdown.`;

  const userPrompt = `Generate a weekly research digest from the following ${files.length} research files completed in the last week.

Output format:
\`\`\`
---
date: ${today}
type: weekly-digest
period: ${files[0]?.date || today} to ${files[files.length - 1]?.date || today}
files: ${files.length}
---

# Research Digest — Week of ${today}

## Summary
A 2-3 sentence overview of what was covered this week.

## Topics

### [Topic Name]
1-2 paragraph summary of key findings. Focus on actionable insights and decisions it informs.
- **Key takeaway:** One sentence.
- **Source:** [filename]

(repeat for each topic)

## Cross-Cutting Themes
Patterns, connections, or tensions that span multiple topics.

## Key Takeaways
Numbered list of the 5-7 most important insights across all research.

## Open Questions
Questions that emerged and remain unanswered.
\`\`\`

Here are the research files:

${filesSummary}`;

  // Use streaming with finalMessage to avoid timeout on large context
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

async function main(): Promise<void> {
  const { days } = parseArgs();
  const today = new Date().toISOString().split("T")[0];

  console.log(`Generating digest for last ${days} days...`);

  const files = getRecentResearchFiles(days);

  if (files.length === 0) {
    console.log("No recent research files found. Nothing to digest.");
    return;
  }

  console.log(`Found ${files.length} research files:`);
  for (const f of files) {
    console.log(`  - ${f.topic} (${f.date})`);
  }

  const digest = await generateDigest(files);
  const outputFile = join(DIGESTS_DIR, `${today}-weekly.md`);

  writeFileSync(outputFile, digest);
  console.log(`\nDigest written to: ${outputFile}`);
  console.log(`Length: ${digest.length} chars`);
}

main().catch((err) => {
  console.error("Digest generation failed:", err.message);
  process.exit(1);
});

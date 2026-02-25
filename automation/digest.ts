// Generates a daily digest of previous day's research findings.
// Uses the Anthropic API directly (not Claude Code) — simple text in, text out.
//
// Usage: node --experimental-strip-types automation/digest.ts [--days 1]

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const RESEARCH_DIR = resolve(PROJECT_ROOT, "research");
const DIGESTS_DIR = resolve(PROJECT_ROOT, "digests");
const DEFAULT_DAYS = 1;

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

interface DigestResult {
  digest: string;
  shortLabel: string;
}

async function generateDigest(files: ResearchFile[]): Promise<DigestResult> {
  const client = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  const filesSummary = files
    .map((f) => `### ${f.topic} (${f.date})\nTags: ${f.tags.join(", ")}\n\n${f.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a research digest generator. You synthesize multiple research files into a concise, actionable daily digest. Your output is markdown.

IMPORTANT: Your response must start with a single line containing ONLY a one-or-two word label describing the overall theme of today's research (e.g., "agent-orchestration", "security-tooling", "frontend-updates"). Use lowercase with hyphens, no spaces. This label will be used in the filename.

After the label line, output the full digest markdown.`;

  const userPrompt = `Generate a daily research digest from the following ${files.length} research files completed recently.

First line: a one-or-two word filename label (lowercase, hyphens, no spaces) capturing the dominant theme.

Then the digest in this format:
\`\`\`
---
date: ${today}
type: daily-digest
period: ${files[0]?.date || today} to ${files[files.length - 1]?.date || today}
files: ${files.length}
---

# Daily Research Digest — ${today}

## Summary
A 2-3 sentence overview of what was covered.

## Topics

### [Topic Name]
1-2 paragraph summary of key findings. Focus on actionable insights.
- **Key takeaway:** One sentence.
- **Source:** [filename]

(repeat for each topic)

## Cross-Cutting Themes
Patterns or connections that span multiple topics.

## Key Takeaways
Numbered list of the most important insights.

## Open Questions
Questions that emerged and remain unanswered.
\`\`\`

Here are the research files:

${filesSummary}`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const textBlock = response.content.find((b) => b.type === "text");
  const fullText = textBlock?.text ?? "";

  // Extract the short label from the first line
  const lines = fullText.split("\n");
  const shortLabel = lines[0].trim().replace(/[^a-z0-9-]/g, "").slice(0, 30) || "digest";
  const digest = lines.slice(1).join("\n").trim();

  return { digest, shortLabel };
}

async function main(): Promise<void> {
  const { days } = parseArgs();
  const today = new Date().toISOString().split("T")[0];

  console.log(`Generating daily digest for last ${days} day(s)...`);

  const files = getRecentResearchFiles(days);

  if (files.length === 0) {
    console.log("No recent research files found. Nothing to digest.");
    return;
  }

  console.log(`Found ${files.length} research files:`);
  for (const f of files) {
    console.log(`  - ${f.topic} (${f.date})`);
  }

  if (!existsSync(DIGESTS_DIR)) {
    mkdirSync(DIGESTS_DIR, { recursive: true });
  }

  const { digest, shortLabel } = await generateDigest(files);
  const outputFile = join(DIGESTS_DIR, `${today}_${shortLabel}.md`);

  writeFileSync(outputFile, digest);
  console.log(`\nDigest written to: ${outputFile}`);
  console.log(`Length: ${digest.length} chars`);
}

main().catch((err) => {
  console.error("Digest generation failed:", err.message);
  process.exit(1);
});

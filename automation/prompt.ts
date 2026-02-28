// Builds the research prompt for Claude -p headless invocation.
// Reproduces the manual CLAUDE.md session protocol as a single prompt.

import type { QueueItem } from "./types.ts";

const TODAY = new Date().toISOString().split("T")[0];

export function buildPrompt(item: QueueItem): string {
  const slug = item.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const outputFile = `research/${TODAY}-${slug}.md`;

  return `You are conducting an automated research session. Follow the protocol exactly.

## Your Task

Research topic: "${item.topic}"
Description: ${item.description}
Tags: ${item.tags.join(", ")}
Output file: ${outputFile}
Today's date: ${TODAY}

## Session Protocol

### Step 1: Orient
1. Read \`CLAUDE.md\` to understand the project structure and conventions.
2. Read \`sessions.md\` to see what's been explored recently.
3. Search for existing principles related to this topic:
   \`node --experimental-strip-types automation/query-db.ts principles ${item.tags.slice(0, 3).join(" ") || item.topic.split(" ").slice(0, 3).join(" ")}\`
4. Search for prior research on this topic:
   \`node --experimental-strip-types automation/query-db.ts research ${item.topic.split(" ").slice(0, 3).join(" ")}\`
5. Note what already exists so you don't duplicate it.

### Step 2: Research
1. Conduct thorough web research on the topic using WebSearch and WebFetch.
2. Use high-quality, authoritative sources (official docs, recognized experts, reputable engineering blogs).
3. Aim for at least 5 distinct sources — more is better.
4. Cover: current best practices, trade-offs, decision frameworks, concrete examples, and emerging trends.

### Step 3: Write Research File
Write the research file to \`${outputFile}\` with this exact format:

\`\`\`markdown
---
date: ${TODAY}
topic: ${item.topic}
status: complete
tags: [${item.tags.join(", ")}]
---

# ${item.topic}

## Context
Why this was investigated. Reference the description: "${item.description}"

## Findings
The core content. Use subsections. Be thorough and detailed (aim for 5000+ chars of substantive content).
Include specific recommendations, code examples where helpful, and source attributions.

## Open Questions
What remains unclear or worth further investigation.

## Extracted Principles
Brief list of any principles distilled from this research (with links to principle files if created/updated).
\`\`\`

### Step 4: Extract Principles
If the research produced actionable, reusable insights:
- Check if a relevant principles file already exists in \`principles/\`. If so, add new principles to it.
- If the topic is novel, create a new principles file following the format in CLAUDE.md.
- Principles must be concise, opinionated, and tested — not speculative.
- Use the principles format from CLAUDE.md (What/Why/When/Source structure).

### Step 5: Update Sessions Log
Append a single line to \`sessions.md\` in this format:
\`${TODAY} | [automated] ${item.topic} | ${outputFile} | <brief summary of key findings>\`

### Step 6: Git Commit
1. Run \`git add\` for all files you created or modified (research file, principles, sessions.md).
2. Run \`git commit -m "[automated] Research: ${item.topic}"\`.
Do NOT run git push — the automation worker handles that.

## Rules
- Do NOT modify CLAUDE.md or any files in automation/.
- Do NOT propose process improvements (skip step 4 of the ending protocol).
- Do NOT stage exports.
- Do NOT run git push.
- Be thorough but focused. Stay on topic.
- Cite your sources inline in the findings.`;
}

export function getExpectedOutputFile(item: QueueItem): string {
  const slug = item.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `research/${TODAY}-${slug}.md`;
}

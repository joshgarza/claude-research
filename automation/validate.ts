// Post-run output validation for automated research sessions.
// Checks that Claude produced a well-formed research file.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { QueueItem, ValidationResult } from "./types.ts";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

export function validate(
  item: QueueItem,
  expectedOutputFile: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fullPath = resolve(PROJECT_ROOT, expectedOutputFile);

  // 1. File exists
  if (!existsSync(fullPath)) {
    errors.push(`Output file not found: ${expectedOutputFile}`);
    return { valid: false, errors, warnings };
  }

  const content = readFileSync(fullPath, "utf-8");

  // 2. Minimum length (5K chars of substantive content)
  if (content.length < 5000) {
    errors.push(
      `Content too short: ${content.length} chars (minimum 5000). Research may be incomplete.`
    );
  } else if (content.length < 8000) {
    warnings.push(
      `Content is short: ${content.length} chars. Typical research files are 10K+.`
    );
  }

  // 3. YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    errors.push("Missing YAML frontmatter (---...---)");
  } else {
    const fm = frontmatterMatch[1];

    if (!fm.includes("date:")) {
      errors.push("Frontmatter missing 'date' field");
    }
    if (!fm.includes("topic:")) {
      errors.push("Frontmatter missing 'topic' field");
    }
    if (!fm.includes("status:")) {
      errors.push("Frontmatter missing 'status' field");
    }
    if (!fm.includes("tags:")) {
      errors.push("Frontmatter missing 'tags' field");
    }

    // Check topic roughly matches queue item
    const topicMatch = fm.match(/topic:\s*(.+)/);
    if (topicMatch) {
      const fileTopic = topicMatch[1].trim().toLowerCase();
      const queueTopic = item.topic.toLowerCase();
      // Check that at least one significant word from the queue topic appears
      const words = queueTopic
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const matchCount = words.filter((w) => fileTopic.includes(w)).length;
      if (matchCount === 0) {
        errors.push(
          `Topic mismatch: file says "${topicMatch[1].trim()}", queue says "${item.topic}"`
        );
      }
    }
  }

  // 4. Required sections
  const requiredSections = [
    "## Context",
    "## Findings",
    "## Open Questions",
    "## Extracted Principles",
  ];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  // 5. Source URLs (at least 3 inline URLs suggesting real sources)
  const urlMatches = content.match(/https?:\/\/[^\s)>\]]+/g) || [];
  // Deduplicate
  const uniqueUrls = new Set(urlMatches);
  if (uniqueUrls.size < 3) {
    warnings.push(
      `Only ${uniqueUrls.size} source URLs found (target: 3+). Research may lack citations.`
    );
  }

  // 6. Check sessions.md was updated
  const sessionsPath = resolve(PROJECT_ROOT, "sessions.md");
  if (existsSync(sessionsPath)) {
    const sessions = readFileSync(sessionsPath, "utf-8");
    if (!sessions.includes("[automated]") || !sessions.includes(item.topic)) {
      warnings.push(
        "sessions.md may not have been updated with this research entry"
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    outputFile: expectedOutputFile,
  };
}

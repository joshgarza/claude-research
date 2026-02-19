#!/usr/bin/env bash
# PreToolUse hook for automated research runs.
# Blocks writes outside allowed paths: research/, principles/, sessions.md
# Exit 0 = allow, Exit 2 = block with message

set -euo pipefail

TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
INPUT="${CLAUDE_TOOL_INPUT:-}"

# Only intercept Write and Edit tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

# Extract file_path from JSON input
FILE_PATH=$(echo "$INPUT" | node --experimental-strip-types -e "
  let data = '';
  process.stdin.on('data', chunk => data += chunk);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(data).file_path || ''); }
    catch { console.log(''); }
  });
")

if [[ -z "$FILE_PATH" ]]; then
  echo "BLOCKED: Could not determine file path from tool input"
  exit 2
fi

# Resolve to path relative to the research project root
PROJECT_ROOT="/home/josh/coding/claude/research"
REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# Allow: research/* (but not research/automation/*)
if [[ "$REL_PATH" =~ ^research/ && ! "$REL_PATH" =~ ^research/automation/ ]]; then
  exit 0
fi

# Allow: principles/*
if [[ "$REL_PATH" =~ ^principles/ ]]; then
  exit 0
fi

# Allow: sessions.md
if [[ "$REL_PATH" == "sessions.md" ]]; then
  exit 0
fi

# Block everything else
echo "BLOCKED: Automated runs cannot write to '$REL_PATH'. Allowed paths: research/*, principles/*, sessions.md"
exit 2

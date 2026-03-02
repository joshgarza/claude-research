# Claude Code Headless Mode

## Summary

Claude Code's headless/print mode (`claude -p`) supports nearly all features of interactive mode. The gap is narrower than most assume: CLAUDE.md, settings, hooks, MCP, auto-memory, and model-invoked skills all load and execute the same way. The primary difference is that user-invoked slash commands (`/skill-name`, `/compact`, etc.) are interactive-only. Headless mode also gains several exclusive flags (`--max-turns`, `--output-format`, `--json-schema`) for automation-specific use cases.

## Principles

### CLAUDE.md Loads Fully in Headless Mode
- **What:** CLAUDE.md files are loaded at session start in both interactive and headless mode. The full hierarchy applies: managed policy > user (`~/.claude/CLAUDE.md`) > project > local.
- **Why:** The docs state both memory systems "are loaded at the start of every conversation" without exception. SFEIR Institute tutorial confirms: "Claude Code automatically loads the CLAUDE.md file from the current directory, even in headless mode."
- **When:** Applies to all `-p` invocations unless `CLAUDE_CODE_SIMPLE=1` is set.
- **Note:** CLAUDE.md files from `--add-dir` directories are NOT loaded by default. Set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` to include them.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

### Settings.json Works Identically in Headless Mode
- **What:** All settings (permissions, hooks config, sandbox, MCP, model, `claudeMdExcludes`) apply equally in headless. Only visual/UI settings (spinners, themes, syntax highlighting) have no effect headlessly.
- **Why:** Settings are loaded at process startup before mode detection. Settings can be overridden per invocation with `--settings ./path.json` or `--setting-sources user,project`.
- **When:** Every `-p` invocation respects the full settings hierarchy.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

### Shell-Command Hooks Fire in Headless Mode
- **What:** All three hook types (command/prompt/agent) fire at their lifecycle events during `-p` sessions. PreToolUse deny rules, TaskCompleted gates, and Stop hooks all execute normally.
- **Why:** Hooks are part of the agent loop, not the interactive terminal layer.
- **When:** Use hooks in headless for safety enforcement (PreToolUse deny), quality gates (TaskCompleted test runner), and stop verification (Stop hook checks).
- **Exception:** In-process JS/TypeScript hook functions (available in the SDK packages) are NOT available via the CLI. Shell command hooks are the only headless option. GitHub issue #7535 requesting `--hooks-script` was closed NOT_PLANNED.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

### MCP Servers Work the Same in Headless Mode
- **What:** MCP tools are available in headless sessions. `--mcp-config` and `--strict-mcp-config` flags both work with `-p`. Permission rules for MCP tools (`mcp__server__tool`) are enforced.
- **Why:** MCP connection is established at session startup, before mode detection.
- **When:** Use `--allowedTools "mcp__<server>__*"` in headless to auto-approve MCP tool calls without prompting.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

### Model-Invoked Skills Work in Headless; User-Invoked Do Not
- **What:** Skills where Claude autonomously decides to load them (based on description matching) work in headless mode. Skills invoked with `/skill-name` slash syntax do NOT work in `-p` mode.
- **Why:** Skill descriptions are loaded into the system context at session start for both modes. The model can invoke the Skill tool programmatically. But the slash command parser is an interactive-layer feature.
- **When:** To replicate user-invoked skill behavior in headless, either describe the task in natural language, or inject skill content via `--append-system-prompt "$(cat ~/.claude/skills/commit/SKILL.md)"`.
- **Source:** [research/2026-03-02-headless-feature-parity.md], [official headless docs]

### `--disable-slash-commands` Disables Both User and Model Invocations
- **What:** The `--disable-slash-commands` flag disables ALL skill invocations for a session, including model-invoked automatic loading.
- **Why:** Use this when you want deterministic, skills-free headless execution without risking unexpected skill activation.
- **When:** Minimal automation pipelines where skill activation would be surprising or disruptive.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

### `CLAUDE_CODE_SIMPLE=1` for Truly Minimal Headless Execution
- **What:** Setting `CLAUDE_CODE_SIMPLE=1` disables MCP tools, attachments, hooks, CLAUDE.md loading, and skills in one shot.
- **Why:** Provides a clean, predictable execution environment where Claude responds purely to the prompt without any project configuration influence. Introduced in Claude Code v2.1.50.
- **When:** Use when you want Claude as a plain prompt executor with zero project configuration loading. NOT the default headless behavior.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

### Headless-Only Flags Provide Automation-Specific Controls
- **What:** Several flags are only meaningful in `-p` mode: `--max-turns`, `--max-budget-usd`, `--no-session-persistence`, `--fallback-model`, `--output-format json/stream-json`, `--json-schema`, `--include-partial-messages`, `--system-prompt-file`, `--append-system-prompt-file`.
- **Why:** These address headless-specific needs: cost control, structured output parsing, session management in ephemeral environments.
- **When:** Always set `--max-turns` and `--max-budget-usd` in production headless automation as emergency brakes.
- **Source:** [research/2026-03-02-headless-feature-parity.md]

## Revision History
- 2026-03-02: Initial extraction from research/2026-03-02-headless-feature-parity.md.

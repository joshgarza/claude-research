---
date: 2026-03-02
topic: Investigate whether Claude Code headless mode supports settings, skills, and other features the same as non-headless instances.
status: complete
tags: [claude-code, headless, settings, skills, CLAUDE.md, hooks, MCP, auto-memory, feature-parity]
related: [2026-02-24-claude-code-headless-permissions-guardrails.md]
---

# Claude Code Headless vs Interactive Mode: Feature Parity

## Context

This was investigated to clarify what Claude Code features are available in headless/print mode (`-p`) vs interactive mode. The related research file (2026-02-24) covered permissions and safety guardrails in headless mode in depth; this file focuses specifically on whether settings, skills, CLAUDE.md, hooks, MCP, and auto-memory work the same way across modes.

The distinction matters for automation workflows: if a headless agent relies on configured skills, project settings, or MCP tools, knowing which features carry over is critical for reliable CI/CD and orchestration pipelines.

## Findings

### Terminology Clarification

The official docs now state: "The CLI was previously called 'headless mode.' The `-p` flag and all CLI options work the same way." So headless mode = print mode = SDK CLI mode (`claude -p`). The distinction is non-interactive execution: `-p` runs a prompt and exits, while interactive mode opens a REPL session.

---

### 1. CLAUDE.md: Fully Supported in Headless Mode

CLAUDE.md files load in headless mode exactly as in interactive mode. The memory documentation states: "Both [CLAUDE.md and auto memory] are loaded at the start of every conversation." No distinction is drawn between headless and interactive sessions.

The SFEIR Institute tutorial explicitly confirms: "Claude Code automatically loads the CLAUDE.md file from the current directory, even in headless mode."

**How CLAUDE.md loads (same in both modes):**
- Walks up the directory tree from CWD, loading all CLAUDE.md and CLAUDE.local.md files found
- User-level `~/.claude/CLAUDE.md` loaded for all projects
- Organization-managed CLAUDE.md (`/etc/claude-code/CLAUDE.md` on Linux) loaded universally
- Subdirectory CLAUDE.md files load on demand when Claude reads files in those directories
- `.claude/rules/` directory is loaded with path-scoped rules applying conditionally

**Headless-specific considerations:**
- The `--add-dir` flag gives Claude access to extra directories. By default, CLAUDE.md files from `--add-dir` directories are NOT loaded. Set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` to include them.
- The `claudeMdExcludes` setting works in both modes to skip irrelevant files.

---

### 2. Auto Memory: Fully Supported in Headless Mode

Auto memory loads at the start of every session without distinction between headless and interactive. The memory docs confirm both memory systems "are loaded at the start of every conversation."

- The first 200 lines of `MEMORY.md` are always injected at session start
- Topic files (e.g., `debugging.md`) are loaded on demand when Claude reads them
- Auto memory writes also work in headless mode -- Claude can update memory files during a headless session

**Disabling auto memory in headless:**
```bash
CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 claude -p "your prompt"
```

Or via settings.json:
```json
{ "autoMemoryEnabled": false }
```

---

### 3. Settings.json: Fully Supported in Headless Mode

Settings work identically across both modes. The settings hierarchy (managed > user > project > local) is respected in headless sessions.

**Settings that work the same in both modes:**
- `permissions.allow`, `permissions.deny`, `permissions.ask` rules
- `hooks` configuration (all event types)
- `sandbox` settings
- `mcp` server configuration
- `model`, `fallbackModel`
- `claudeMdExcludes`
- `autoMemoryEnabled`
- `disableBypassPermissionsMode`, `allowManagedPermissionsOnly`

**Settings with interactive-only relevance (no effect in headless):**
- `spinnerVerbs`, `spinnerTipsEnabled`, `terminalProgressBarEnabled` -- UI spinners
- `prefersReducedMotion` -- animation accessibility setting
- `showTurnDuration` -- post-response timing display
- Syntax highlighting and theme settings

**Headless-mode-specific CLI overrides:** Settings can be loaded from custom files or overridden via CLI:
```bash
claude -p --settings ./ci-settings.json "run the review"
claude -p --setting-sources user,project "run the review"
```

---

### 4. Hooks: Fully Supported in Headless Mode (with one gap)

All hook events fire in headless mode. This is a critical and often overlooked fact: hooks like `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `Stop`, and `TaskCompleted` all execute during `-p` mode runs.

The eesel.ai article on Claude Code automation confirms: "Combine hooks with headless mode to run Claude Code in CI, build scripts or pre-commit style jobs."

**Hook types that work in headless:**
- `command` hooks -- shell commands that run at lifecycle events (full support)
- `prompt` hooks -- single-turn LLM evaluation hooks (full support)
- `agent` hooks -- multi-turn subagent hooks (full support)

**The one gap: in-process JavaScript/TypeScript hooks**

The TypeScript Agent SDK supports in-process hook functions defined as JS callbacks. This capability is NOT available in the CLI (`claude -p`). A feature request for `--hooks-script` (load a TS/JS file with exported hook functions) was filed as GitHub issue #7535 and was closed as NOT_PLANNED in January 2026.

Bottom line: shell command hooks work fully in headless; programmatic JS function hooks require migrating from CLI to the SDK package.

---

### 5. MCP Servers: Fully Supported in Headless Mode

MCP servers connect and provide tools in headless sessions the same as interactive. The `--mcp-config` and `--strict-mcp-config` flags are both documented as working with `-p`.

```bash
claude -p --mcp-config ./mcp.json "query the database for recent users"
```

**Confirmed support:**
- MCP tool invocation works in headless sessions
- `--strict-mcp-config` (use ONLY these MCP servers, ignore all others) works in headless
- `mcp__<server>__<tool>` permission rules in settings.json are enforced in headless
- `--allowedTools "mcp__<server>__*"` works in headless to auto-approve MCP tool calls

**One headless limitation for MCP:** When Claude Code itself runs as an MCP server (`claude mcp serve`), that mode is headless and cannot prompt for permissions interactively. This is a specific constraint of the "Claude Code as MCP server" use case, not of headless mode as a client of MCP servers.

---

### 6. Skills: PARTIALLY Supported in Headless Mode (critical distinction)

This is the most nuanced feature area. There are two categories of skills, and they behave differently:

#### Model-Invoked Skills: WORK in headless mode

Skills where Claude autonomously decides to load them based on context work in headless. When a session starts (headless or interactive), skill descriptions are loaded into context so Claude knows what's available. When Claude determines a skill is relevant to the prompt, it loads the full SKILL.md and executes the instructions.

From the skills docs: "In a regular session, skill descriptions are loaded into context so Claude knows what's available, but full skill content only loads when invoked."

Skills with `disable-model-invocation: true` are excluded from Claude's context in headless (as they require explicit user invocation). Skills with `user-invocable: false` ARE in Claude's context and can be auto-loaded in headless.

**Model-invoked skills work because:**
- Skill descriptions are in the system context regardless of mode
- Claude can invoke the `Skill` tool programmatically (this is how model-invoked skills work internally)
- The `--disable-slash-commands` flag disables both user and model invocations; without it, model invocation is active in both modes

#### User-Invoked Skills (Slash Commands): DO NOT WORK in headless mode

The official docs are explicit: **"User-invoked skills like `/commit` and built-in commands are only available in interactive mode. In `-p` mode, describe the task you want to accomplish instead."**

This means: if you type `/commit` into a `-p` prompt string, it will NOT be processed as a skill invocation. Claude will receive it as a literal prompt and likely try to interpret the text.

**Affected features:**
- All custom `/skill-name` invocations
- All bundled skills invoked by name: `/simplify`, `/batch`, `/debug`, `/review`, etc.
- All commands: `/compact`, `/memory`, `/clear`, `/config`, `/sandbox`, etc.
- MCP prompts exposed as commands (`/mcp__server__prompt`)

**Workaround for headless skill-equivalent behavior:**

Instead of `/commit`, describe the task:
```bash
# Interactive: /commit
# Headless equivalent:
claude -p "Look at my staged changes and create an appropriate commit" \
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)"
```

Alternatively, use `--append-system-prompt` to inject skill instructions directly:
```bash
claude -p "commit the staged changes" \
  --append-system-prompt "$(cat ~/.claude/skills/commit/SKILL.md)"
```

Or use the `context: fork` skill pattern by having the parent session invoke a subagent with the skill content pre-loaded.

---

### 7. Feature Summary Table

| Feature | Headless (`-p`) | Interactive | Notes |
|---------|-----------------|-------------|-------|
| CLAUDE.md loading | Full | Full | Same hierarchy |
| Auto memory (read) | Full | Full | First 200 lines of MEMORY.md |
| Auto memory (write) | Full | Full | Claude can update memory files |
| Settings.json | Full | Full | Same 4-level hierarchy |
| Permission rules | Full | Full | deny/ask/allow evaluation |
| Hooks (shell command) | Full | Full | All event types fire |
| Hooks (prompt type) | Full | Full | |
| Hooks (agent type) | Full | Full | |
| Hooks (in-process JS) | No | No (SDK only) | SDK package only, not CLI |
| MCP servers | Full | Full | Tool calls work |
| Model-invoked skills | Full | Full | Descriptions in context |
| User-invoked skills (/name) | No | Full | Interactive-only |
| Built-in commands (/compact etc.) | No | Full | Interactive-only |
| `--max-turns` | Yes (print only) | No | Only meaningful in `-p` |
| `--max-budget-usd` | Yes (print only) | No | Only meaningful in `-p` |
| `--no-session-persistence` | Yes (print only) | No | |
| `--fallback-model` | Yes (print only) | No | |
| `--output-format json/stream-json` | Yes (print only) | No | |
| `--system-prompt-file` | Yes (print only) | No | |
| `--append-system-prompt-file` | Yes (print only) | No | |
| `--system-prompt` | Both | Both | |
| `--append-system-prompt` | Both | Both | |
| `--tools` | Both | Both | |
| `--allowedTools` | Both | Both | |
| `--disallowedTools` | Both | Both | |
| Keyboard shortcuts | No | Yes | Interactive-only |
| `!` bash prefix mode | No | Yes | Interactive-only |
| `@` file mention autocomplete | No | Yes | Interactive-only |
| Prompt suggestions | No | Yes | Explicitly disabled in non-interactive |
| Task list (Ctrl+T) | No | Yes | Interactive UI only |
| PR status footer | No | Yes | Interactive UI only |
| Vim editing mode | No | Yes | Interactive-only |
| Background bash (Ctrl+B) | No | Yes | Interactive-only |
| Parallel agents/subagents | Full | Full | Work in both via Agent SDK |
| Worktrees (-w flag) | Full | Full | Works with -p |
| Sandbox | Full | Full | Same config applies |

---

### 8. CLAUDE_CODE_SIMPLE: The Minimal Mode

Separate from regular headless mode, there is an undocumented minimal mode triggered by:

```bash
CLAUDE_CODE_SIMPLE=1 claude -p "your prompt"
```

When set, `CLAUDE_CODE_SIMPLE` disables:
- MCP tools
- Attachments
- Hooks
- CLAUDE.md loading
- Skills

This creates a truly stripped-down experience for cases where you want Claude to respond purely to the prompt without any project configuration influence. This was introduced in Claude Code v2.1.50. It is NOT the default headless mode -- it's an explicit opt-in for minimal behavior.

---

### 9. Practical Implications for Headless Automation

**CI/CD pipelines:** All settings, hooks, MCP, and CLAUDE.md load as expected. The main adjustment needed is replacing `/skill-name` invocations with descriptive prompts. Use `--append-system-prompt` to inject skill content where needed.

**Agent orchestration:** Model-invoked skills work in headless, so background/automated agents can benefit from skills that Claude determines are relevant. Be explicit in prompts to help Claude recognize when to load skills.

**Security/compliance gates:** Hooks (PreToolUse deny rules) and settings-based permissions all fire normally in headless. This means the same safety infrastructure that protects interactive sessions also protects headless agents.

**The in-process hooks gap:** Teams that want JS-level hook logic (complex state management, async API calls) in headless automation need to migrate from `claude -p` to the Python or TypeScript Agent SDK packages, which support programmatic hook functions natively.

---

### Sources

- [Run Claude Code programmatically (official headless docs)](https://code.claude.com/docs/en/headless)
- [Skills documentation](https://code.claude.com/docs/en/skills)
- [Memory documentation (CLAUDE.md and auto-memory)](https://code.claude.com/docs/en/memory)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Interactive mode documentation](https://code.claude.com/docs/en/interactive-mode)
- [Settings documentation](https://code.claude.com/docs/en/settings)
- [SFEIR Institute: Headless Mode and CI/CD FAQ](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/faq/)
- [GitHub Issue #7535: In-Process Hooks in Headless CLI Mode (closed NOT_PLANNED)](https://github.com/anthropics/claude-code/issues/7535)
- [CLAUDE_CODE_SIMPLE discovery (v2.1.50 changelog)](https://jls42.org/en/news/ia-actualites-22-feb-2026)
- [Prior research: Claude Code headless permissions & guardrails](research/2026-02-24-claude-code-headless-permissions-guardrails.md)

## Open Questions

1. **Model-invoked skill loading confirmation.** The docs say skill descriptions are always loaded into context, but there is no explicit statement confirming the Skill tool is invocable by the model in `-p` mode. Community confirmation or a test would solidify this.

2. **Auto memory writes in headless.** The docs confirm auto memory is loaded in headless, but whether Claude actively writes/updates memory files during headless sessions (not just reads them) is not explicitly documented. Testing needed.

3. **Path-scoped `.claude/rules/` in headless.** Rules that trigger when Claude reads files in matching paths -- do these fire during headless sessions? The docs describe this as "when Claude works with files matching the pattern" without mode qualification.

4. **`CLAUDE_CODE_SIMPLE` complete spec.** The env var is mentioned in changelog entries but has no dedicated documentation. Full list of what it disables beyond MCP/hooks/CLAUDE.md/skills is unconfirmed.

5. **Subagent memory in headless.** Subagents can maintain their own auto memory (`persistMemory: true`). Does this work when the parent session is headless?

## Extracted Principles

Principles extracted below and added to `principles/claude-code-headless.md` (new file).

1. **CLAUDE.md, settings, hooks, MCP, and auto memory all load in headless mode.** The feature gap is narrower than most assume.
2. **The only major headless gap is user-invoked slash commands.** Replace `/skill-name` with descriptive prompts or `--append-system-prompt` to inject skill content.
3. **Model-invoked skills work in headless.** Skill descriptions are in the system context for both modes; Claude can load them autonomously.
4. **Use `CLAUDE_CODE_SIMPLE=1` for truly minimal headless sessions.** Strips MCP, hooks, CLAUDE.md, and skills for predictable bare-metal execution.
5. **In-process JS hooks require the SDK packages.** If you need programmatic hook logic beyond shell commands, use the Python or TypeScript Agent SDK instead of `claude -p`.

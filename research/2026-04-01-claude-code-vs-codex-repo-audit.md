---
date: 2026-04-01
topic: claude code vs codex repo audit
status: complete
tags: [claude-code, codex, repo-audit, agentic-cli, mcp, tools]
related: [2026-03-13-research-into-open-source-agentic-harnesses-for-local-development.md, 2026-03-02-headless-feature-parity.md]
---

# Claude Code vs Codex Repo Audit

## Context
The goal was to build a comprehensive understanding of `~/coding/claude-code`, then compare it against upstream `openai/codex`. The report also needed to identify Claude features that look worth porting into Codex, plus lower-priority quirky additions that could be fun rather than essential.

## Findings

### Snapshot And Method
- Claude Code source inspected locally at commit `0cf2fa2` on 2026-04-01.
- Codex inspected against upstream `openai/codex` `main` at commit `1b711a5` on 2026-04-01.
- Primary Claude evidence came from `main.tsx`, `setup.ts`, `commands.ts`, `tools.ts`, `tasks.ts`, `entrypoints/mcp.ts`, `utils/hooks.ts`, `utils/worktree.ts`, `remote/RemoteSessionManager.ts`, `services/autoDream/autoDream.ts`, `services/SessionMemory/sessionMemory.ts`, `services/teamMemorySync/index.ts`, `services/mcp/config.ts`, `tools/AgentTool/builtInAgents.ts`, `buddy/companion.ts`, and directory scans.
- Primary Codex evidence came from `README.md`, `docs/install.md`, `docs/config.md`, `docs/contributing.md`, `codex-rs/Cargo.toml`, `codex-rs/README.md`, `codex-rs/tools/src/lib.rs`, and selected crate manifests and source files.
- Treat the leaked Claude README as secondary evidence only. Use code paths as the source of truth whenever the README makes a claim.
- Confidence note: the Claude snapshot is a leak artifact, so missing tests or internal docs in this tree should not be treated as proof that they do not exist in Anthropic's real repo.

### Executive Summary
- `claude-code` is a product-heavy TypeScript terminal application. A small number of very large entry files orchestrate a wide set of built-in commands, tools, memory systems, remote modes, and agent workflows.
- `openai/codex` is a platform-heavy Rust workspace. It is less monolithic, more modular, and more obviously organized around reusable layers such as TUI, exec, tools, hooks, sandboxing, policy, state, connectors, and app-server infrastructure.
- The biggest difference is not simply "Claude has more features." Claude exposes more workflow and product opinion directly in the agent loop. Codex exposes more infrastructure and policy as reusable subsystems.
- Codex already has more visible surface area than a first glance suggests. The tree shows first-class support for desktop app launching, realtime, voice, remote flows, hooks, connectors, skills, app server, and SQLite state. It is not a thin shell around `exec`.
- The most valuable Claude features for Codex to steal are the ones that improve isolation and memory quality: worktree orchestration, session memory, background consolidation, and repo-scoped shared memory.

### Claude Code Repo Map

#### Runtime shape
- `main.tsx` is the center of gravity at 4,683 lines. It front-loads keychain, MDM, telemetry, bootstrap data, remote settings, model capabilities, skill and plugin change detection, and session setup.
- `setup.ts` is a second major orchestrator at 477 lines. It initializes cwd state, hook snapshots, file change watching, worktree and tmux sessions, UDS messaging, teammate snapshots, session memory, plugin hook hot reload, and background watchers.
- The codebase looks like a single large application with many optional paths rather than a cleanly split workspace.

#### Commands and user surfaces
- The repo exposes 86 command directories under `commands/`, plus standalone command files referenced from `commands.ts`.
- Visible user-facing areas include review, plan, tasks, memory, MCP, plugins, IDE, desktop, mobile, voice, Chrome integration, theme, stickers, passes, release notes, sandbox toggles, session sharing, and remote env management.
- `commands.ts` also has an explicit `INTERNAL_ONLY_COMMANDS` list. Some commands are only added for `USER_TYPE === 'ant'` or behind compile-time flags.
- Important flags in the registry include `KAIROS`, `PROACTIVE`, `VOICE_MODE`, `BRIDGE_MODE`, `ULTRAPLAN`, `WORKFLOW_SCRIPTS`, `FORK_SUBAGENT`, `BUDDY`, `CCR_REMOTE_SETUP`, and `UDS_INBOX`.

#### Tool model
- The repo has 42 tool directories under `tools/`.
- Core built-in tools include `BashTool`, file read/edit/write, glob/grep, notebook edit, web fetch/search, ask-user-question, skills, plan mode enter/exit, task CRUD, task stop/output, todo write, worktree enter/exit, LSP, MCP resource list/read, and tool search.
- Gated or specialized tools include cron scheduling, remote trigger, monitor, REPL, workflow tool, terminal capture, web browser, send user file, push notification, subscribe PR, team create/delete, peers listing, and snipping/history tools.
- `assembleToolPool()` merges built-in tools with MCP tools and filters them through deny rules before the model sees them. That is a strong sign that tool visibility and permissioning are first-class runtime concerns.

#### Agent, task, and isolation model
- `tasks.ts` defines explicit task types for `LocalShellTask`, `LocalAgentTask`, `RemoteAgentTask`, and `DreamTask`, with optional workflow and monitor tasks behind flags.
- `tools/AgentTool/builtInAgents.ts` shows built-in agent roles for general-purpose, explore, plan, statusline setup, guide, and verification, plus coordinator-mode workers.
- `utils/worktree.ts` is a full worktree orchestration layer. It validates slugs, creates `.claude/worktrees/<slug>`, generates tmux session names, symlinks selected directories to reduce disk bloat, and integrates with worktree hooks.
- `remote/RemoteSessionManager.ts` shows a real remote session control plane using WebSocket plus HTTP, with permission request forwarding and viewer-only mode.

#### Memory and persistence
- `services/SessionMemory/sessionMemory.ts` maintains a markdown session-memory file in the background using a forked subagent.
- `services/autoDream/autoDream.ts` runs post-session background memory consolidation with a three-gate scheduler: time, session count, and lock.
- `services/teamMemorySync/index.ts` syncs repo-scoped team memory between local files and a server API, with checksum-based delta upload and secret scanning.
- The repo therefore has three distinct memory layers:
  - Current-session summarization
  - Background durable memory consolidation
  - Shared team memory at repo scope

#### Extensibility and integration
- `services/mcp/config.ts` merges MCP server config across managed, global, project, and plugin-provided sources, with deduplication and CCR proxy URL handling.
- `entrypoints/mcp.ts` exposes Claude Code itself as an MCP server, although the file still has TODOs around re-exposing MCP tools and validating input types.
- Skills are loaded from user skill directories, bundled skills, plugin skills, and built-in plugin skills.
- Plugin support is architecturally present, but `plugins/bundled/index.ts` is still empty scaffold code for built-in plugins. This suggests the plugin system exists before the product strategy around bundled plugins is finished.

#### Product polish and special modes
- The command surface suggests a lot of product packaging beyond "terminal agent": desktop upsell, mobile, voice, stickers, themes, passes, statusline, and Chrome integration.
- Undercover mode is real code, not just README prose. `utils/undercover.ts`, `setup.ts`, and the commit commands show a public-repo safe mode for Anthropic employees.
- `buddy/companion.ts` implements a deterministic companion system with rarity weights, seeded PRNG, shiny odds, and stat rolls. It is not just a mock feature flag placeholder.

#### Visible rough edges
- `entrypoints/mcp.ts` still has TODOs for re-exposing MCP tools and validating inputs with Zod.
- `utils/hooks.ts` still has TODOs for prompt stop hooks and agent stop hooks outside REPL.
- `utils/plugins/marketplaceManager.ts` has a TODO for npm package support.
- `plugins/bundled/index.ts` is pure scaffold with zero built-in plugins registered.
- Conventional test files are not visible in the leaked tree. That could mean missing tests in the artifact rather than in the real repo, so treat it as a leak limitation, not a hard conclusion about Anthropic's engineering quality.

### Codex Repo Map

#### Runtime shape
- The maintained Codex CLI lives in `codex-rs/`, a Rust workspace with 82 visible workspace members in `Cargo.toml`.
- The npm package `@openai/codex` is just a launcher that picks the correct platform binary and hands execution to the native CLI.
- The repo is organized into explicit subsystems rather than giant central files: `cli`, `tui`, `exec`, `core`, `tools`, `hooks`, `skills`, `core-skills`, `sandboxing`, `shell-escalation`, `execpolicy`, `state`, `connectors`, `plugin`, `app-server`, `cloud-tasks`, `codex-api`, and multiple utility crates.

#### Public surfaces
- `README.md` and `codex-rs/README.md` show three main product surfaces:
  - Terminal CLI and fullscreen TUI
  - `codex exec` for headless and non-interactive runs
  - `codex app` for desktop app launching
- The docs also show `codex mcp` and `codex mcp-server`, so Codex acts as both MCP client and MCP server.

#### Tool model
- `codex-rs/tools/src/lib.rs` exports a rich internal tool library:
  - Agent tools: spawn, resume, send message/input, wait, close, list
  - Local execution tools: exec command, shell command, write stdin, request permissions
  - Editing tools: apply patch
  - MCP tools: generic MCP call plus list/read resource tools
  - Input and UX tools: request user input, view image, JS REPL
  - Discovery tools: tool search and tool suggest
  - Utility tools: list dir, code mode, wait
- The important contrast with Claude is not lack of tools. It is that Codex's tools are more infrastructure-shaped and less full of product-specific workflow verbs.

#### Safety, policy, and config
- `docs/config.md` documents a `~/.codex/config.toml` configuration model, MCP approvals, connector insertion, notification hooks, SQLite state location, custom CA bundles, and plan-mode defaults.
- `codex-core/README.md` and crate manifests show a dedicated safety stack:
  - `sandboxing` for filesystem and network policy
  - `shell-escalation` for command elevation mechanics
  - `execpolicy` for prefix-based Starlark policy rules
- This is a cleaner separation of safety concerns than Claude Code's TypeScript app, where many approval and permission details are intertwined with the application runtime.

#### State, hooks, skills, connectors
- Codex has dedicated crates for `state`, `hooks`, `skills`, `core-skills`, `connectors`, and `plugin`.
- `connectors/src/lib.rs` shows a connector directory client with caching, workspace connector support, and connector metadata normalization.
- `plugin/src/lib.rs` is focused on plugin identity and telemetry metadata, which suggests a cleaner low-level plugin boundary than Claude's still-emerging bundled-plugin layer.
- `state/Cargo.toml` shows a first-class SQLite-backed state layer, not just ad hoc local files.

#### Remote, realtime, and desktop
- The tree shows visible support for remote and realtime flows: `app-server-client/src/remote.rs`, `core/src/realtime_*`, `exec-server/src/remote_*`, `codex-api/src/endpoint/realtime_websocket`, and `tui/src/chatwidget/realtime.rs`.
- The tree also shows `tui/src/voice.rs` and `cli/src/desktop_app`, so Codex already overlaps with some Claude-only product surfaces.
- This is important because it means the real gap is not "Codex needs productization at all." The gap is in which productized workflows it chooses to expose.

#### Testing and maturity markers
- The workspace tree exposes hundreds of visible test files and test paths. A quick filename and path count returned 671 test-like entries under `codex-rs`.
- `docs/contributing.md` describes an invitation-only external PR model and a disciplined local validation workflow (`just fmt`, `just fix`, crate-specific tests, `just test`).
- The overall impression is a repo optimized for maintainable native infrastructure rather than a single fast-moving app surface.

### Claude Code vs Codex: The Actual Diff

| Axis | Claude Code | Codex | Practical takeaway |
| --- | --- | --- | --- |
| Overall architecture | Large TypeScript app with a few huge orchestration files | Large Rust workspace with many focused crates | Claude optimizes for fast product layering, Codex for modular platform boundaries |
| Command surface | Very large and product-heavy | More restrained public command vocabulary | Claude exposes more built-in workflows directly |
| Tool surface | Many workflow-specific tools plus product-specific gated tools | Strong infra tool library with agent, exec, patch, MCP, discovery, approvals | Codex has a solid core, Claude has more opinionated workflow verbs |
| Memory | Session memory, auto-dream, extract memories, team memory sync | SQLite state, memory trace, but no visible first-class equivalents for dream, session memory, or team memory | Claude is much more ambitious about long-lived memory |
| Multi-agent isolation | Built-in agents, coordinator mode, worktree orchestration, tmux integration | Agent tools and cloud/app-server infrastructure, but no visible first-class git worktree or tmux layer | Claude is stronger on local parallel work ergonomics |
| Safety model | Strong but mixed into app runtime, hooks, Bash tool prompts, undercover mode | Strongly modularized into sandbox, shell escalation, execpolicy, state/config crates | Codex has cleaner safety architecture |
| Extensibility | Skills, plugins, MCP, plugin-provided MCP servers | Skills, hooks, plugins, connectors, MCP client and server | Rough parity at the category level, different maturity emphasis |
| Testing visibility | Very low in leaked snapshot | High and explicit | Codex is easier to audit for engineering rigor from public source alone |
| Product packaging | Desktop, mobile, voice, Chrome, stickers, passes, buddy, assistant modes | Desktop app, voice, realtime, connectors, notifications | Claude pushes further into experimental product territory |

### Missing In Codex That Looks Worth Porting

#### 1. First-class worktree sessions
- Claude has an opinionated local isolation story: git worktree creation, naming, tmux session support, and task-aware session state.
- Codex already has multi-agent tools. Adding a first-class worktree layer would reduce collision risk when multiple agents touch one repo.
- Best fit: start with worktree creation and resume semantics. Tmux integration can stay optional.

#### 2. Session memory plus background consolidation
- Claude treats memory as a product, not just a log. Session memory and auto-dream both exist as explicit background systems.
- Codex has state and memory-trace primitives, but no visible first-class equivalent for "summarize this session into durable working memory."
- Best fit: start with a narrow session-memory file or SQLite table, then add a low-frequency consolidation pass only if it proves useful.

#### 3. Repo-scoped shared team memory
- Claude's `teamMemorySync` is unusually concrete and practical: checksum-based sync, repo scoping, secret scanning, delta upload.
- Codex already has state, app-server, and connectors. A shared repo memory layer would fit collaborative Codex usage well.
- Risk: it becomes noisy unless ownership, retention, and conflict rules stay narrow.

#### 4. Deep remote planning as a first-class workflow
- Claude's visible `ULTRAPLAN` flow is more opinionated than Codex's public surface. It is a named, browser-backed, approval-based deep planning lane.
- Codex already has cloud tasks and remote infrastructure, so this is not a new capability class. It would be a new user-facing workflow product.
- Best fit: a remote planning command with explicit result review and import, not a hidden background mode.

#### 5. Public-repo safe mode for enterprise and internal users
- Undercover mode is a real, coherent feature: when users work in public repos, commit and PR text is constrained to avoid leaking internal language.
- This is probably not a consumer priority, but it is a strong enterprise feature for organizations mixing private and public work.
- Best fit: make it policy-driven and opt-in at org or admin level.

### Quirky Claude Additions That Could Be Fun In Codex
- `Buddy`: a deterministic terminal companion with rarity, seeded rolls, and shiny odds. Not important, but it is real code rather than vapor.
- `stickers` and richer cosmetic commands: low-stakes delight features that can make the CLI feel less sterile.
- `Brief` mode for persistent assistant contexts: useful if Codex leans harder into always-on or ambient assistance.
- Undercover badge and callout UI: not "fun" in the toy sense, but it is a nice example of making special operating modes visibly legible to the user.

### Things Codex Should Probably Not Copy Blindly
- Claude's product sprawl is impressive, but it also creates a harder-to-audit surface with many compile-time flags and internal-only branches.
- Codex's current strength is boundary clarity. It should steal Claude's best workflow ideas without importing the same level of flag-driven surface complexity.
- The highest-value ports are the ones that improve agent reliability, isolation, or memory quality, not the ones that merely make the command list longer.

### Appendix: Flagged Or Internal Claude Features Worth Separating
- `KAIROS` and `PROACTIVE`: assistant-like persistent mode with extra tools such as sleep, send-user-file, push notifications, and PR subscription hooks.
- `ULTRAPLAN`: remote planning path with CCR session state and a teleport sentinel in `utils/ultraplan/ccrSession.ts`.
- `UNDERCOVER`: public-repo safe mode for Anthropic employees, wired into prompts, UI, and commit and PR flows.
- `BUDDY`: gated companion system behind the `BUDDY` feature flag.
- `INTERNAL_ONLY_COMMANDS`: a large bucket of commands that are not meant for external builds, including some of the most revealing workflow surfaces.

## Open Questions
- How much of Claude Code's missing visible test surface is due to the leak artifact rather than the real internal repo layout?
- Which Codex crates already implement partial equivalents of Claude's memory and workflow systems beneath names that are less obvious from top-level manifests?
- Whether Codex's cloud-tasks and app-server direction is meant to absorb deep planning and collaboration features without exposing them as named product modes.

## Extracted Principles
- None. This session produced repo-specific comparison notes, not stable reusable principles yet.

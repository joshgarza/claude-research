---
date: 2026-04-01
topic: claude code vs codex feature parity deep dive
status: complete
tags: [claude-code, codex, feature-parity, modalities, workflow, memory]
related: [2026-04-01-claude-code-vs-codex-repo-audit.md]
---

# Claude Code vs Codex Feature Parity Deep Dive

## Context
This is a second-pass note after the broader repo audit in `research/2026-04-01-claude-code-vs-codex-repo-audit.md`. The first note was strong on architecture and repo shape, but it missed at least one important product-level gap: Claude Code's first-class PDF handling. That omission was enough to justify a deeper feature-level sweep.

The goal of this pass was to compare `~/coding/claude-code` and upstream `openai/codex` by behavior buckets rather than by directory tree alone. The buckets used here are:

- input modalities and attachment handling
- file and document editing behavior
- workflow, coordination, and isolation
- memory and persistence layers
- extensibility surfaces
- remote, realtime, and product surfaces
- safety, approvals, and execution policy

## Findings

### Snapshot And Method
- Claude Code was inspected locally at commit `0cf2fa2`.
- Codex was inspected from public upstream `openai/codex` at commit `1b711a5`.
- This pass used three delegated code-reading passes plus direct verification:
  - Claude modality and attachment systems
  - Claude workflow, memory, and coordination systems
  - Codex public tool, modality, and platform surfaces
- Important caveat: Codex findings here are limited to the visible public repo. "No visible first-class support" means exactly that. It does not prove private or external support does not exist.

### Correction To The Prior Audit
- The previous audit underweighted modality-specific behavior and over-weighted architecture shape.
- The missing PDF section was not a judgment call. It was a miss.
- The corrected conclusion is that PDF support is not a side detail. It is one of the clearest confirmed Claude-vs-Codex product differences visible in source.

### Executive Summary
- Claude Code leads in document-centric ingestion and workflow productization.
- Codex leads in publicly visible agent tooling, sandboxing, approval policy, hooks, plugins, and connectors.
- The clearest confirmed Codex gaps in public source are first-class PDF handling, notebook handling, and Claude-style pasted-content attachment workflows.
- Claude also has a materially richer visible memory stack: session memory, extracted memories, background consolidation, and repo-scoped team memory sync.
- Codex is not "missing everything." Public source shows strong image support, realtime audio, remote app-server transport, desktop surfacing, cloud-task plumbing, multi-agent tools, and explicit execution policy machinery. The real story is uneven specialization, not simple feature count.

### 1. Input Modalities And Attachments

#### Claude Code
- `tools/FileReadTool/FileReadTool.ts` is a multimodal reader, not just a text file tool. Its schema and output union cover text, images, PDFs, notebooks, multipart responses, and `file_unchanged` stubs. The tool prompt explicitly advertises "read files, images, PDFs, notebooks".
- PDF support is first-class and split into two user-visible behaviors:
  - full-document send, where the tool injects an `application/pdf` document block
  - page extraction, where the tool renders selected pages and injects them as images
- PDF reads support a dedicated `pages` grammar such as `"5"`, `"1-10"`, and `"3-"`, implemented in `utils/pdfUtils.ts`.
- PDF behavior is model-aware. `isPDFSupported()` disables full-document PDF reads on Haiku 3 and falls back to page extraction.
- PDF behavior is thresholded, not naive. The visible thresholds in `constants/apiLimits.ts` include:
  - 10 pages for at-mention inline vs `pdf_reference`
  - 20 pages max per paged read
  - 20 MB raw size for full-document send
  - 3 MB threshold for preferring extraction
  - 100 MB max for extraction
- Large `@file` PDF mentions do not inline. `utils/attachments.ts` converts them into `pdf_reference` attachments, and `utils/messages.ts` injects a strong system reminder telling the model to use `Read` with `pages`.
- `utils/pdf.ts` does more than decode bytes. It validates the `%PDF-` header to avoid poisoning session history with invalid PDFs, uses `pdfinfo` for page counts, and uses `pdftoppm` for page extraction.
- Notebook support is also first-class. `utils/notebook.ts` parses `.ipynb` notebooks into cells with `cell_id`, `cell_type`, execution counts, rich outputs, and embedded image outputs.
- `tools/NotebookEditTool/NotebookEditTool.ts` provides notebook-specific editing with `replace`, `insert`, and `delete` cell modes, and requires read-before-edit semantics.
- Prompt input is modality-aware well before the model call:
  - pasted images become `[Image #N]` placeholders in `components/PromptInput/PromptInput.tsx`
  - large pasted text becomes truncated placeholder refs in `components/PromptInput/inputPaste.ts` and `utils/promptEditor.ts`
  - session-scoped pasted images are persisted on disk with stable paths in `utils/imageStore.ts`
  - queued commands can carry mixed text and images, not just plain strings, through `utils/attachments.ts`
- Clipboard and screenshot handling is unusually hardened:
  - `utils/imagePaste.ts` supports macOS, Linux, and Windows clipboard paths
  - BMP clipboard images are converted to PNG
  - dragged/pasted image-path heuristics are separate from raw clipboard-image heuristics
  - `FileReadTool` normalizes the thin-space variant used in some macOS screenshot filenames
- MCP artifact persistence is modality-aware even outside the main read path. `utils/mcpOutputStorage.ts` preserves MIME-derived extensions including `.pdf`, office docs, audio, and video for later reuse.

#### Codex
- Public Codex has first-class image input, not first-class document input, in the visible repo.
- `codex-rs/protocol/src/user_input.rs` defines typed `UserInput` variants for:
  - `Text`
  - `Image`
  - `LocalImage`
  - `Skill`
  - `Mention`
- `codex-rs/tools/src/view_image.rs` defines `view_image` as a local-image-only tool. Its schema accepts a local filesystem path and optional `detail=original`.
- `codex-rs/core/src/tools/handlers/view_image.rs` converts the result into `input_image` content items, gates on model image support, and rejects unsupported `detail` values.
- Public tests for `view_image` are extensive and confirm image attachment behavior, original-resolution mode, invalid-image rejection, and missing-file errors.
- I found no visible first-class PDF or notebook path in the public tree:
  - recursive tree search over `codex-rs` returned no `pdf`, `ipynb`, `jupyter`, or `notebook` matches
  - `UserInput` has no `Document`, `LocalDocument`, `Pdf`, or notebook variant
- Codex does have a richer placeholder model than plain text alone. `user_input.rs` includes `TextElement` byte-range spans for rich markers inside the text buffer. That means Claude's placeholder UX is not conceptually foreign to Codex, but the visible public repo does not show Claude-level PDF/notebook attachment flows built on top of it.

#### Verdict
- Claude clearly leads on modality breadth and document UX.
- The PDF gap is confirmed, not inferred.
- Notebook handling is also a likely real gap in public Codex.
- Codex's visible public strength here is image handling, not general document ingestion.

### 2. File And Document Editing

#### Claude Code
- Generic code editing is covered by file read/edit/write tools, but the more interesting point is that Claude has document-specific editing behavior on top of generic editing.
- `NotebookEditTool` gives Claude a first-class notebook mutation path instead of forcing notebook edits through raw JSON.
- Notebook edit semantics are notebook-native:
  - edit by `cell_id`
  - choose `replace`, `insert`, or `delete`
  - require `cell_type` for insert
  - preserve notebook structure and language metadata
- Notebook editing also enforces read-before-edit behavior to reduce silent corruption.

#### Codex
- Codex publicly exposes very strong generic code-editing surfaces:
  - `apply_patch`
  - shell and exec tools
  - JS REPL
  - multi-agent tooling around edits
- `codex-rs/tools/src/lib.rs` publicly exports `create_apply_patch_freeform_tool`, `create_apply_patch_json_tool`, and the usual exec/write-stdin stack.
- I did not find a notebook-specific read or edit tool in the public tree.

#### Verdict
- Codex is strong on generic code editing.
- Claude leads specifically on notebook-aware editing and document-native edit semantics.

### 3. Workflow, Coordination, And Isolation

#### Claude Code
- Claude has a real built-in agent model. `tools/AgentTool/builtInAgents.ts` exposes a general-purpose agent, statusline setup agent, and optional explore, plan, and verification agents.
- The coordinator contract is explicit. `tools/AgentTool/prompt.ts` tells the parent agent that child results arrive later as separate user-role notifications and that it must not invent answers while waiting.
- Claude has a visible swarm/team model, not just isolated subtasks:
  - teammate modes include `auto`, `tmux`, and `in-process`
  - tmux/iTerm2 pane-backed teammates are real product surfaces
  - team identity and pane state live in app state
- Background work is first-class. `tasks/` includes local shell, local agent, remote agent, and dream tasks, and `/tasks` is the user-facing command surface.
- Planning is a distinct operational mode:
  - `/plan`
  - `EnterPlanMode`
  - `ExitPlanModeV2`
  - approval-aware enter/exit behavior
- Claude's worktree model is unusually productized:
  - `EnterWorktree` only triggers on explicit user intent
  - worktrees live under `.claude/worktrees/<slug>`
  - `utils/worktree.ts` validates slugs, reuses named worktrees, supports sparse checkout, and symlinks selected directories
  - `ExitWorktree` can `keep` or `remove` and refuses destructive cleanup without explicit acceptance
- tmux integration is not incidental:
  - `--tmux` is wired into CLI startup
  - a dedicated tmux socket isolates Claude-driven tmux actions from the user's existing tmux session
  - clipboard propagation, attach/detach handling, SSH reconnect behavior, and DEL filtering are all visible in source
- Session restore is deep:
  - `--continue`
  - `--resume`
  - `--fork-session`
  - `--resume-session-at`
  - `--rewind-files`
- Resume logic is repo-aware and worktree-aware rather than just loading the last transcript.
- Remote agent tasks are restorable. `RemoteAgentTask.tsx` includes registration and restore paths rather than treating remote work as throwaway runtime state.
- Claude also has a more advanced remote planning path in `/ultraplan`, where a CCR session can either collect remote approval or "teleport" execution back to the terminal.

#### Codex
- Codex publicly exposes a larger explicit multi-agent tool API than Claude's visible built-in tool list:
  - `assign_task`
  - `spawn_agent`
  - `resume_agent`
  - `send_input`
  - `send_message`
  - `wait_agent`
  - `close_agent`
  - `list_agents`
  - agent-job helpers like `spawn_agents_on_csv`
- Codex also exposes plan-related behavior in public tooling and CLI surfaces:
  - `update_plan`
  - `resume`
  - `fork`
  - interactive and non-interactive modes in the CLI
- Public Codex looks less opinionated about repo-isolation workflows. I did not find an equally first-class worktree entry/exit system or tmux-orchestrated teammate model in the visible public repo.

#### Verdict
- Codex leads on public agent-tool breadth.
- Claude leads on workflow productization around worktrees, tmux teammates, plan gating, and resume-aware task restoration.
- These are different kinds of maturity, not the same feature with one winner.

### 4. Memory And Persistence Layers

#### Claude Code
- Claude has at least four distinct visible memory layers.
- Session memory:
  - `services/SessionMemory/sessionMemory.ts` maintains a markdown memory file in the background
  - extraction is thresholded by context growth and tool-call cadence
  - updates run through a forked subagent
- Extracted memories:
  - `services/extractMemories/extractMemories.ts` writes to auto-memory files
  - overlapping writes can be deferred into a trailing extraction pass
  - successful writes are surfaced back into the transcript as `memory_saved`
- AutoDream:
  - `services/autoDream/autoDream.ts` performs background consolidation over time
  - scheduling is gated by elapsed time, number of sessions touched, and a lock file
  - dream runs are first-class tasks with task-state reporting
- Team memory sync:
  - `services/teamMemorySync/index.ts` syncs repo-scoped shared memory to a server
  - uploads are checksum-delta based
  - deletions do not propagate
  - watcher-driven pushes are debounced
  - secret scanning guards synced content because it is shared with collaborators

#### Codex
- Codex publicly has substantial state machinery:
  - SQLite-backed state in `codex-rs/state`
  - rollout metadata, logs, thread metadata, and job state
  - config-driven DB home overrides
- Codex also has a visible memory-related subsystem in `codex-rs/core/src/memory_trace.rs`, but it appears to be trace summarization into a memory endpoint, not an obvious equivalent to Claude's layered user-facing memory stack.
- I did not find public equivalents to:
  - session-markdown memory files
  - automatic durable memory extraction tied to user conversations
  - background consolidation like AutoDream
  - repo-scoped collaborative team memory sync

#### Verdict
- Claude clearly leads on visible memory productization.
- Codex has strong state infrastructure, but public memory behavior looks narrower and more infrastructural than user-facing.

### 5. Extensibility: Hooks, Skills, Plugins, MCP, Connectors

#### Claude Code
- Claude has real extensibility surfaces:
  - MCP config merging across managed, global, project, and plugin-provided sources in `services/mcp/config.ts`
  - Claude itself exposed as an MCP server in `entrypoints/mcp.ts`
  - skills loaded from multiple directories
  - plugin infrastructure and hot-reload paths
- Claude's plugin story looks architecturally real but publicly less finished:
  - `plugins/bundled/index.ts` is scaffold code with no bundled plugins registered
  - `entrypoints/mcp.ts` still has TODOs for re-exposing MCP tools and validating inputs

#### Codex
- Codex's public extensibility story is stronger and more complete:
  - hooks are a dedicated crate with generated schemas and typed payloads
  - skills are first-class and cached by cwd plus effective config
  - sample skills are bundled in the public repo
  - connectors are first-class with install URLs, pagination, visibility filtering, and app metadata normalization
  - plugins can bundle skills, MCP servers, and app connector IDs
  - `codex mcp` and `codex mcp-server` make MCP a clear public surface
- This is one of the clearest areas where Codex looks more platform-like and less ad hoc than Claude in public source.

#### Verdict
- Codex leads publicly on hooks, plugins, connectors, and the completeness of its extensibility surfaces.
- Claude has the pieces, but more visible TODOs and scaffolded edges remain in the leaked snapshot.

### 6. Remote, Realtime, Voice, And Product Surfaces

#### Claude Code
- Claude has a real remote session control plane:
  - `remote/RemoteSessionManager.ts` manages websocket subscription, HTTP sends, interrupt handling, reconnects, and `viewerOnly` mode
  - `remote/remotePermissionBridge.ts` creates local stub tools for unknown remote-only tools so permission requests can still be bridged
- Remote-facing user surfaces are distributed across commands rather than hidden internals:
  - `/session` for remote session URL and QR code
  - `/remote-env`
  - `/remote-setup`
  - `/desktop`
- Claude also has remote planning and teleport semantics through `/ultraplan`.

#### Codex
- Codex publicly has strong remote and realtime infrastructure:
  - app-server client transport over websocket
  - realtime conversation handling
  - audio input and audio output in the TUI
  - cloud-task CLI surface
  - desktop app launcher on macOS
- `codex-rs/tui/src/voice.rs` and `codex-rs/core/src/realtime_conversation.rs` show that realtime audio is not a stub.
- Public Codex voice/platform support still looks uneven by target platform. The visible TUI dependency story suggests voice is not simply "works everywhere".

#### Verdict
- Codex appears ahead in public realtime and voice infrastructure.
- Claude appears ahead in remote session workflow polish, especially permission bridging, QR/session handoff, and teleport-oriented remote planning.

### 7. Safety, Approvals, And Execution Policy

#### Claude Code
- Claude has many local safety mechanisms:
  - filesystem permission checks in tools
  - plan-mode approval boundaries
  - worktree removal confirmation
  - tmux socket isolation
  - secret scanning before team-memory sync
  - remote permission bridging to keep approvals coherent across environments
- These are strong product-level controls, but they are scattered across services and tools rather than presented as a unified public subsystem.

#### Codex
- Codex's public safety stack is much more explicit and layered:
  - cross-platform sandboxing crates
  - `request_permissions` as a first-class tool
  - typed approval policies
  - exec policy as its own documented subsystem
  - prompt files for `never`, `on_failure`, `on_request`, and `unless_trusted`
- This is another area where Codex looks platform-first in a way Claude does not.

#### Verdict
- Codex clearly leads on public safety-system explicitness and policy infrastructure.
- Claude's safety model is real, but more embedded in workflow features than surfaced as a coherent policy layer.

### Confirmed Or Likely Missing Codex Features Worth Porting

#### 1. First-Class PDF Handling
- Why it matters: this is the most obvious missing modality in public Codex, and it meaningfully changes research, contract review, spec review, and debugging workflows.
- What Claude already proves out:
  - page-ranged reads
  - full-document send when model support allows it
  - extraction fallback when the document is too large or the model cannot take raw PDFs
  - `pdf_reference` reminders for large at-mentions
- Rough scope: add a document input variant, a PDF-aware read tool, page-range parsing, model gating, extraction fallback, and history-safe validation.
- Main risk: once raw documents enter history, invalid or oversized artifacts can poison later turns. Claude's `%PDF-` validation exists for a reason.

#### 2. Notebook Read And Edit Support
- Why it matters: notebooks are a real engineering/documentation surface, and treating `.ipynb` as raw JSON is a poor developer experience.
- What Claude already proves out:
  - notebook reads that preserve cell identity and outputs
  - image-output extraction from notebook cells
  - notebook-native editing by cell
- Rough scope: add notebook parse/serialize helpers, notebook-aware read tool output, and a notebook-edit tool.
- Main risk: preserving notebook metadata and outputs without damaging notebook structure.

#### 3. Pasted-Content Placeholder Workflow
- Why it matters: Claude's `[Image #N]` and truncated-text placeholders reduce prompt bloat without losing structure.
- What Claude already proves out:
  - image-only submits
  - stable session image storage
  - text truncation refs that can be expanded later
  - queued multimodal commands
- Rough scope: build on Codex `TextElement` infrastructure rather than starting from scratch.
- Main risk: history/resume semantics become more complex once placeholders and on-disk cached assets must stay consistent.

#### 4. Worktree Entry And Exit Workflow
- Why it matters: this is one of Claude's strongest isolation/productivity features for longer tasks and multi-agent work.
- What Claude already proves out:
  - explicit user intent gating
  - standardized worktree paths
  - session-aware enter/exit behavior
  - tmux integration
- Rough scope: add a worktree manager plus CLI/tool surfaces, and integrate it with resume/fork flows.
- Main risk: Git edge cases, sparse checkout complexity, and platform-specific shell/session behavior.

#### 5. Layered User-Facing Memory
- Why it matters: Codex already has strong state infrastructure. The likely opportunity is to add better memory behavior on top of it.
- What Claude already proves out:
  - session-memory summaries
  - auto-memory extraction
  - background consolidation
  - repo-scoped shared memory
- Rough scope: start with session memory first. Team memory and dream-style consolidation are follow-on layers.
- Main risk: memory quality failure is worse than no memory. Bad summaries and stale durable memory can quietly corrupt future behavior.

### Quirky Or Delightful Claude Additions
- `pdf_reference` as a UX pattern is unusually good. It turns a hard failure into guided behavior and could port cleanly.
- macOS screenshot thin-space normalization is tiny, weird, and high-value. It is exactly the sort of bugfix polish users notice because nothing breaks.
- Clipboard path heuristics and BMP-to-PNG conversion are another good class of small polish feature: boring, defensive, and user-visible.
- `buddy/companion.ts` is genuinely whimsical. It is not strategically important, but it is a reminder that agent tools do not have to feel sterile.

### Non-Obvious Behavioral Differences
- Claude's full-PDF read path and page-extraction path do not surface content the same way. One injects a document block; the other injects page images.
- Claude intentionally does not cache images and PDFs in the same `file_unchanged` path it uses for text and notebook reads.
- Claude's large-PDF at-mention fallback remains usable even without `pdfinfo`, because it estimates page count heuristically instead of failing open.
- Codex does already have a byte-range placeholder mechanism through `TextElement`. That means Claude's placeholder UX is not fundamentally incompatible with Codex's public protocol model.
- Codex's visible strength is not "less product." It is that many product-adjacent concerns are exposed as reusable public infrastructure rather than being buried in a single application loop.

## Open Questions
- Does non-public Codex code or external OpenAI product code already implement PDF or notebook handling that simply is not visible in the public repo?
- Does the leaked Claude snapshot underrepresent plugin maturity, tests, or internal docs in areas that look rough from TODO markers alone?
- How much of Codex's remote and desktop behavior is intentionally public-API-first versus still moving behind external docs?
- Are office docs, audio, and video intentionally second-class in Claude, or are they simply persisted for later reuse through MCP outputs without model-native ingestion yet?

## Extracted Principles
- None. This note is a comparative feature inventory and correction pass, not a reusable principle extraction.

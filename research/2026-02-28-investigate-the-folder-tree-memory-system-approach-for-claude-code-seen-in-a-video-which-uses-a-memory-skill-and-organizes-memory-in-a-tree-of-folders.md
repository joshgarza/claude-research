---
date: 2026-02-28
topic: Folder-tree memory system approach for Claude Code (/memory skill, hierarchical organization)
status: complete
tags: [claude-code, memory, skills, context-management, folder-tree]
related: []
---

# Folder-Tree Memory System for Claude Code

## Context

This research investigates a pattern seen in video content where Claude Code's memory system is organized as a tree of folders, controlled via a `/memory` skill. The goal is to understand the canonical approaches, community adaptations, and design trade-offs for hierarchical memory in Claude Code sessions.

This connects directly to the existing `agent-context-augmentation.md` principles, which cover CLAUDE.md structure and the 150-line rule, but do not yet address the multi-file folder-tree pattern or auto-memory in depth.

## Findings

### 1. Claude Code's Built-in Memory Architecture

As of 2026, Claude Code ships with a six-tier memory hierarchy loaded at session start, from most general to most specific ([official docs](https://code.claude.com/docs/en/memory)):

| Tier | Location | Scope | Version-controlled |
|------|----------|-------|-------------------|
| Managed policy | `/etc/claude-code/CLAUDE.md` (Linux) | All org users | IT-managed |
| User memory | `~/.claude/CLAUDE.md` | All your projects | No |
| Project memory | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team-shared | Yes |
| Project rules | `./.claude/rules/*.md` | Path-scoped per glob | Yes |
| Project local | `./CLAUDE.local.md` | Just you, auto-gitignored | No |
| Auto memory | `~/.claude/projects/<project>/memory/` | Just you, per-project | No |

More specific tiers override broader ones. The `/memory` built-in command opens a file selector showing all active memory sources and includes an auto-memory toggle — it is a **built-in command**, not a custom skill.

### 2. The Auto-Memory Folder Tree

The most direct implementation of a "folder-tree memory system" is Claude Code's native auto-memory, introduced in late 2025. Its structure:

```
~/.claude/projects/<project>/memory/
├── MEMORY.md          # Concise index — loaded into every session (200-line limit)
├── debugging.md       # Detailed debugging patterns (loaded on demand)
├── api-conventions.md # API design decisions (loaded on demand)
└── patterns.md        # Code style / recurring patterns (loaded on demand)
```

Key mechanics ([official docs](https://code.claude.com/docs/en/memory)):
- `MEMORY.md` first 200 lines are injected into the system prompt at session start. Content beyond 200 lines is silently truncated — Claude is instructed to keep it as a concise index.
- Topic files (`debugging.md`, `api-conventions.md`, etc.) are **not** loaded at startup. Claude reads them on demand using its standard file tools when it needs them.
- Claude writes to these files during sessions when it detects patterns, makes corrections, or is explicitly told to remember something ("remember that we use pnpm, not npm").
- The `<project>` segment is derived from the git repository root. Git worktrees get separate memory directories.

The design philosophy: MEMORY.md as a table of contents, topic files as the actual reference. This is the "folder tree" pattern most commonly demonstrated in video content.

### 3. Modular Rules: .claude/rules/

The `.claude/rules/` directory adds another tree layer — project-specific, version-controlled rules organized by topic, optionally scoped to file paths:

```
.claude/rules/
├── frontend/
│   ├── react.md
│   └── styles.md
├── backend/
│   ├── api.md
│   └── database.md
└── general.md
```

Rules can have YAML frontmatter with `paths:` glob patterns to make them conditional:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
- All endpoints must include input validation
```

All `.md` files are discovered recursively. Rules without `paths:` apply unconditionally with the same priority as `.claude/CLAUDE.md`. This is the **team-shareable** analogue to auto-memory's personal folder tree.

Additionally, `~/.claude/rules/` provides user-level rules that apply across all projects.

### 4. The /memory Skill Pattern (Community Adaptation)

While `/memory` is a built-in command, the community has built **custom skills** that implement enhanced folder-tree memory management. These follow the Skills architecture:

```
~/.claude/skills/memory/
├── SKILL.md           # Instructions (invoked via /memory-<subcommand>)
├── templates/
│   └── session-summary.md
└── scripts/
    └── consolidate.py
```

The most notable community implementation is **Rick Hightower's `project-memory` skill** ([SpillwaveSolutions/project-memory](https://github.com/SpillwaveSolutions/project-memory)), built as a SKILL.md skill that creates a structured memory tree under `docs/project_notes/`:

```
docs/project_notes/
├── bugs.md        # Bug log: issue, root cause, solution, prevention
├── decisions.md   # Architectural Decision Records (ADRs)
├── key_facts.md   # Non-sensitive config: hostnames, ports, account names
└── issues.md      # Work log: completed tickets with URLs
```

This skill was itself inspired by watching a YouTube video about linking small markdown files from CLAUDE.md to track decisions, bugs, and key facts. The skill then configures `CLAUDE.md` and `AGENTS.md` with protocols like "search bug logs before debugging" and "consult decisions before proposing architecture changes." Security emphasis: no passwords or API keys in any of these files — they're version-controlled.

### 5. The Cline Memory Bank Pattern (Folder Tree With Dependencies)

The Cline Memory Bank ([docs.cline.bot/features/memory-bank](https://docs.cline.bot/features/memory-bank), [blog post](https://cline.bot/blog/memory-bank-how-to-make-cline-an-ai-agent-that-never-forgets)) is the origin of the most widely copied "folder tree with explicit dependencies" approach. It uses 6 hierarchical files where later files depend on earlier ones:

```
memory-bank/
├── projectbrief.md    # Foundation: project overview, requirements, goals
├── productContext.md  # Why it exists, UX objectives
├── systemPatterns.md  # Architecture and design patterns (uses productContext)
├── techContext.md     # Tech stack, dependencies, setup (uses systemPatterns)
├── activeContext.md   # Current focus, recent changes (synthesizes 2-4)
└── progress.md        # Status, milestones, known issues (synthesizes activeContext)
```

Key innovation: Mermaid diagram syntax in custom instructions teaches the AI the update workflow — structured format rather than prose, potentially clearer for AI systems. The update cycle: at session end, update `activeContext.md` with what changed; only update others when their specific domain changes.

Multiple Claude Code adaptations exist:
- [hudrazine/claude-code-memory-bank](https://github.com/hudrazine/claude-code-memory-bank): Adds custom slash commands (`/init-memory-bank`, `/update-memory`) and workflow phases (understand, plan, execute, update-memory)
- [boyte/claude-code-memory-bank-starter](https://github.com/boyte/claude-code-memory-bank-starter): Simpler starter template
- [centminmod/my-claude-code-setup](https://github.com/centminmod/my-claude-code-setup): Adds project-type specializations (CLAUDE-cloudflare.md, CLAUDE-convex.md)

### 6. Advanced: Attention-Based Folder Loading (Claude Cognitive)

[GMaN1911/claude-cognitive](https://github.com/GMaN1911/claude-cognitive) implements a sophisticated HOT/WARM/COLD attention system layered on top of a documentation tree:

- **HOT** (score > 0.8): Full file content injected
- **WARM** (0.25–0.8): Headers only (first 25 lines)
- **COLD** (< 0.25): Not injected

Files activate based on keyword matching from your prompt against a `.claude/keywords.json` config. They decay each turn unless re-mentioned, simulating human attention. Co-activation boosts apply to related files. Validated on a 1M+ line codebase with 3,200+ Python modules — reported 64–95% token reduction.

This is the most sophisticated implementation of the folder-tree pattern: a tree of documentation files with dynamic, relevance-weighted loading.

### 7. Memory MCP: Graph-Based Alternative

[Claude-World memory guide](https://claude-world.com/articles/memory-system-guide/) describes a Memory MCP approach: rather than flat markdown files, it maintains a persistent knowledge graph with entities, relations, and observations stored in `.claude/memory.json`. The `/memory-audit` command periodically reviews the graph for stale entries. This is an alternative to folder-tree markdown — more queryable but less readable.

### 8. Auto-Diary Pattern (PreCompact Hook)

[rlancemartin/claude-diary](https://github.com/rlancemartin/claude-diary) hooks into the `PreCompact` lifecycle event to auto-generate diary entries before context compression. The `/reflect` command synthesizes patterns across multiple diary entries and writes rules back into CLAUDE.md. This implements a feedback loop: observations → reflection → retrieval (adapted from the Generative Agents paper).

### 9. The /memory Command vs. /memory Skill

This is the key disambiguation:

**Built-in `/memory` command**: Anthropic-provided, opens a file selector UI showing all loaded memory sources (CLAUDE.md hierarchy + auto-memory), includes an auto-memory toggle. Cannot be customized.

**Custom `/memory` skill**: A skill you create in `~/.claude/skills/memory/SKILL.md` (or project-level). When you type `/memory`, Claude Code resolves user-invocable skills first and can conflict with or shadow the built-in. Best practice: name custom memory skills distinctly (`/memory-update`, `/memory-save`, `/mem-tree`) to avoid shadowing the built-in.

### 10. The Video Context

Based on the research, the "video" this topic refers to most likely shows one of:
1. **The official Claude Code auto-memory demo** — showing how MEMORY.md + topic files creates a folder tree at `~/.claude/projects/<project>/memory/`
2. **Rick Hightower's project-memory skill tutorial** — which explicitly notes it was inspired by a YouTube video showing linked markdown files from CLAUDE.md
3. **A Cline Memory Bank adaptation for Claude Code** — the methodology predates Claude Code and has been demoed extensively

The pattern is consistent across all implementations: a root index file (MEMORY.md or projectbrief.md) with pointers into topic-specific files organized under a dedicated directory.

### 11. Observed Trade-offs

| Approach | Strengths | Weaknesses |
|----------|-----------|------------|
| Official auto-memory (MEMORY.md + topic files) | Zero setup, Claude manages it, per-project isolation | Only personal (not team-shareable), Claude's notes can be inaccurate |
| .claude/rules/ folder tree | Team-shareable, path-scoped, version-controlled | Manual maintenance, risks over-specification |
| Cline Memory Bank adaptation | Structured, dependency-explicit, battle-tested methodology | 6-file overhead even for small projects, update discipline required |
| Custom /memory skill | Flexible, composable with other skills | Shadows built-in `/memory`, requires skill authoring |
| Claude Cognitive (HOT/WARM/COLD) | Extreme token efficiency, attention-adaptive | Complex setup, requires keywords.json maintenance |
| Memory MCP (graph) | Queryable, structured | Less human-readable, tooling dependency |

## Open Questions

1. **Does the built-in `/memory` command expose all 6 tiers in the file selector**, or only auto-memory and CLAUDE.md? The docs are ambiguous.
2. **Can the auto-memory folder tree be committed to git** for team sharing? The docs say auto-memory is personal, but nothing prevents committing `~/.claude/projects/...`. The correct team-shareable analog is `.claude/rules/`.
3. **What is the optimal depth for the topic-file tree?** The official docs show flat (MEMORY.md + sibling files). Cline Memory Bank uses a flat 6-file set. Claude Cognitive suggests per-module trees. No empirical data on what depth maximizes recall.
4. **Does the specific video referenced in this task** describe a pattern not yet documented — e.g., a community skill that wraps the auto-memory folder tree with additional structure?

## Extracted Principles

The following principles were added to `principles/agent-context-augmentation.md`:

- **Index + On-Demand Loading**: Use a concise index file (MEMORY.md or similar) with topic-specific satellite files loaded only when relevant. Never load the full tree upfront.
- **Separate Personal vs Team Memory**: Auto-memory (`~/.claude/projects/`) is personal and Claude-written; `.claude/rules/` is team-shared and human-written. Don't conflate them.
- **Never Name Custom Skills the Same as Built-ins**: A `/memory` skill shadows the built-in `/memory` command. Use distinct names like `/memory-update` or `/mem-tree`.

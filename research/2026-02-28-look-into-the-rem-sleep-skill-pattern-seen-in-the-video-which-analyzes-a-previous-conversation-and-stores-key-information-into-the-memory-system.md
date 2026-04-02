---
date: 2026-02-28
topic: "The /rem-sleep skill pattern: post-session conversation analysis for memory consolidation"
status: complete
tags: [claude-code, memory, skills, memory-consolidation, post-session, rem-sleep]
related: [2026-02-28-investigate-the-folder-tree-memory-system-approach-for-claude-code-seen-in-a-video-which-uses-a-memory-skill-and-organizes-memory-in-a-tree-of-folders.md]
---

# The /rem-sleep Skill Pattern: Post-Session Conversation Analysis for Memory Consolidation

## Context

This research investigates the `/rem-sleep` skill pattern seen in video content about Claude Code. The
skill is described as one that analyzes a previous conversation and stores key information into the
memory system -- a post-session consolidation step that mirrors biological REM sleep.

This is a companion to the previous folder-tree memory research
(`2026-02-28-investigate-the-folder-tree-memory-system-approach...`), which covered WHERE memories are
stored. This research covers HOW conversation analysis feeds into that memory system.

The research question: does a named `/rem-sleep` skill exist publicly, and if not, what is the
ecosystem of equivalent patterns?

## Findings

### 1. The Biological Metaphor: Why REM Sleep?

REM (Rapid Eye Movement) sleep is the phase where the brain consolidates memories from the day. During
REM sleep:

- **Sharp-wave ripples** replay recent experiences at 5-20x real-time speed
- **Pattern extraction**: generalizations emerge from specific episodes; "5 examples of a pattern"
  becomes "the rule"
- **Integration**: new memories are woven into existing knowledge structures
- **Pruning**: low-signal memories fade; high-signal ones are strengthened

The AI analogy is exact. A Claude Code session is the "waking day" -- raw experience, unorganized.
The `/rem-sleep` skill is the overnight consolidation step that:

1. Reads the previous conversation's JSONL transcript
2. Extracts key decisions, patterns, preferences, and solutions
3. Deduplicates against existing memory
4. Writes distilled insights into the memory system (MEMORY.md, topic files, CLAUDE.md)

**One key researcher framing** from blog.fsck.com/episodic-memory:
> "During deep sleep, the hippocampus 'broadcasts' the day's experiences to the cortex at 5-20x
> real-time speed. The cortex extracts patterns, creates generalizations, and integrates new memory
> with existing knowledge. Language models are currently like a person who has never slept."

### 2. Public Availability of a Named "/rem-sleep" Skill

After extensive search across GitHub, YouTube, HackerNews, and Claude Code skill marketplaces, **no
publicly published skill exists under the specific name `/rem-sleep`**. The name appears in one search
result as an informal description of claude-mem's capabilities ("a shared memory layer you can drop in
as a Claude Code Skill -- basically a tiny memory DB with recall that remembers your sessions"), but
this was not the skill's official name.

The pattern the `/rem-sleep` name describes is, however, extremely well-documented across multiple
community implementations under different names. The rest of this research documents those
implementations and the design principles they converge on.

### 3. Community Implementations of the Pattern

#### 3a. claude-diary: The Closest Conceptual Match

**Repository**: [rlancemartin/claude-diary](https://github.com/rlancemartin/claude-diary)
**Inspiration**: Interview with Cat Wu (Claude Code PM) and Boris Cherny (Claude Code lead), who
mentioned Anthropic staff generating diary entries from sessions and reflecting on them.

**Two-phase design** (maps directly to NREM/REM analogy):

**Phase 1: `/diary`** (raw experience capture -- NREM analogy)
- Runs at session end, manually or via `PreCompact` hook automatically
- Claude reads the conversation already in its context (not raw JSONL)
- Extracts: task summary, work done, design decisions, user preferences, errors + solutions, code
  patterns
- Stores as timestamped markdown in `~/.claude/memory/diary/`
- A `processed.log` prevents duplicate analysis

**Phase 2: `/reflect`** (pattern extraction and integration -- REM analogy)
- Runs periodically (manually triggered to prevent unintended CLAUDE.md changes)
- Reads accumulated diary entries across multiple sessions
- Identifies violations of existing CLAUDE.md rules
- Extracts patterns across 6 categories: PR feedback, preferences, design decisions, anti-patterns,
  efficiency lessons, project-specific patterns
- Writes new rules to CLAUDE.md as one-line bullets in imperative tone
- Only patterns appearing 2+ times are treated as real (3+ = strong pattern)

**Academic foundation**: CoALA memory framework (Sumers et al., 2023), Generative Agents paper (Park
et al., 2023 -- observation→reflection→retrieval cycle), Zhang et al. (2025) "grow and refine".

#### 3b. Sionic AI's /retrospective: Team Skill Registry

**Source**: [HuggingFace blog: How We Use Claude Code Skills to Run 1,000+ ML Experiments/Day](https://huggingface.co/blog/sionic-ai/claude-code-skills-training)

**Design**: Post-session knowledge capture that writes a full SKILL.md and opens a PR to a shared
team registry. Used in production for 1,000+ ML experiments/day.

**How it works**:
1. User types `/retrospective` at session end
2. Claude reads the entire conversation history from context
3. Extracts: goal, what worked, what failed (with exact failure modes and fixes), hyperparameters,
   and the rationale behind decisions
4. Creates a structured SKILL.md in `plugins/<category>/<experiment-name>/`
5. Opens a PR to the team's GitHub skill registry

**Key innovation**: The "Failed Attempts" table is referenced most frequently -- failure modes are
institutional knowledge. The `/advise` command surfaces this before new experiments begin.

**CLAUDE.md snippet from their implementation**:
```markdown
### /retrospective
Save learnings as new skill.
1. Summarize key findings from conversation
2. Create plugin folder from templates/experiment-skill-template/
3. Fill SKILL.md: goal, what worked, what failed, final parameters
4. Create branch and open PR
```

#### 3c. Build Insights Logger

**Source**: [nathanonn.com: Make Claude Code Remember Everything With This Skill](https://www.nathanonn.com/make-claude-code-remember-everything-with-this-skill/)

**Design**: Continuous passive capture during the session, with a manual curation step.

**Three phases**:
1. **Automatic capture**: logs insights to `.claude/insights/` during active coding (architectural
   decisions, edge cases, performance optimizations, security implications, API gotchas, design
   patterns)
2. **Review**: user runs the skill to review insights organized by category
3. **Integration**: skill surgically integrates selected insights into CLAUDE.md sections --
   patterns are generalized, not copy-pasted

**Key distinction vs. diary**: captures mid-session as events occur rather than retrospectively; but
requires the same manual curation step before integration into CLAUDE.md.

#### 3d. claude-reflect: Correction-Driven Learning

**Repository**: [BayramAnnakov/claude-reflect](https://github.com/BayramAnnakov/claude-reflect)

**Design**: Specialized for capturing and integrating user corrections -- when you say "no, use X
instead" or "that's wrong," the system queues the correction.

**Two skills**:
- `/reflect`: analyzes session history, identifies corrections, presents them with confidence scores
  (0.60-0.95), requires human review before writing to CLAUDE.md or AGENTS.md
- `/reflect-skills`: identifies recurring task patterns across sessions and suggests creating reusable
  skills (e.g., 3 instances of "review productivity" → propose `/daily-review` skill)

**Architecture**: hybrid detection (real-time regex during session + semantic AI validation during
review). Semantic deduplication prevents similar learnings from accumulating as duplicates.

#### 3e. claude-mem: Automated Capture + Injection

**Repository**: [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)

**Design**: Fully automated pipeline -- no manual skill invocation required.

**Pipeline**:
1. **Hook**: captures all tool operations during every session
2. **Compression**: Claude Agent SDK processes captured observations into semantic summaries
3. **Storage**: SQLite + Chroma (vector search) for semantic retrieval
4. **Injection**: at next session start, related context is automatically injected

**Key distinction**: fully automated, no human curation step. This trades control for friction
reduction -- every session is analyzed, but no one decides what to keep vs. discard.

#### 3f. claude-engram Sleep Cycle (Chat-Side Implementation)

**Repository**: [mlapeter/claude-engram](https://github.com/mlapeter/claude-engram)

**Design**: Closest to the literal REM sleep metaphor -- a periodic "Sleep Cycle" command that
consolidates memories by merging redundancies, resolving contradictions, extracting patterns, and
pruning weak memories. Auto-runs every 3 days.

**Not Claude Code-native**: runs inside claude.ai chat as a React artifact. Demonstrates the concept
but isn't deployable as a Claude Code skill.

### 4. Claude Code's Built-in Session Memory (Official Approach)

Claude Code ships with automated session memory as of late 2025 / early 2026:

**Storage**: `~/.claude/projects/<project>/<session-id>/session-memory/summary.md`

**Cadence**: first extraction after ~10,000 tokens; subsequent updates every ~5,000 tokens or 3 tool
calls.

**What gets extracted** per summary:
- Session title (auto-generated)
- Current status: completed items, discussion points, open questions
- Key results: decisions, chosen patterns
- Work log: chronological action record

**Cross-session recall**: at session start, relevant past summaries are injected with a caveat: "from
PAST sessions that might not be related to the current task."

**The `/remember` command** bridges automatic to deliberate: scans session memories for recurring
patterns and proposes updates to `CLAUDE.local.md` (requires human confirmation before writing).

**Terminal indicators**: "Recalled X memories" and "Wrote X memories" became visible in v2.1.30+
(early February 2026). Feature flagged as `tengu_session_memory` and `tengu_sm_compact`. Not
available on Bedrock/Vertex.

**Limitation vs. rem-sleep**: the official system is fully automatic with no user control over what
gets extracted or where it's stored. The `/rem-sleep` skill pattern gives explicit control.

### 5. Conversation Storage Format (Enabling Manual Analysis)

For custom rem-sleep-style skills, the raw material is:

**Location**: `~/.claude/projects/<project-path-with-slashes-to-hyphens>/`
**Format**: JSONL files -- one JSON object per line
**Content**: `{type, timestamp, git_branch, role, message_content, tool_uses}`

**Global index**: `~/.claude/history.jsonl` -- every prompt ever sent, with project path and
session ID.

**Default retention**: 30 days (configurable via `cleanupPeriodDays`)

**Example analysis tools**:
- [alexop.dev conversation search skill](https://alexop.dev/posts/building-conversation-search-skill-claude-code/)
  -- Python script with weighted relevance scoring (summaries 3x, user messages 1.5x, tool uses
  1.3x)
- [eric-tramel BM25 MCP server](https://eric-tramel.github.io/blog/2026-02-07-searchable-agent-memory/)
  -- single-file Python MCP server with debounced reindexing via watchdog
- [ZeroSumQuant/claude-conversation-extractor](https://github.com/ZeroSumQuant/claude-conversation-extractor)
  -- exports raw JSONL as clean markdown with metadata

### 6. Design Patterns and Trade-offs

All implementations converge on a core design space with explicit trade-offs:

#### Manual vs. Automatic Triggering

| Approach | Trigger | Example | Trade-off |
|----------|---------|---------|-----------|
| Manual skill invocation | User types `/rem-sleep` | claude-diary's `/diary` | Control over what gets analyzed; requires discipline |
| PreCompact hook | Before context compaction | claude-diary PreCompact mode | Automatic but only fires when context is near limit |
| Stop hook | When Claude session ends | claude-mem | Fully automatic; no user choice |
| Scheduled cron | Nightly/weekly | claude-engram's 3-day cycle | Batch processing; adds latency |

#### Human Curation vs. Full Automation

**Human curation (claude-diary, claude-reflect)**: Claude proposes; human reviews and approves
changes before they propagate to CLAUDE.md. Lower risk of incorrect rules accumulating. More
friction.

**Full automation (claude-mem, session-memory)**: Everything captured and injected automatically.
Zero friction. Risk: low-quality memories inject noise; incorrect patterns become permanent
instructions.

**Hybrid (Build Insights Logger)**: automatic capture, manual selection, automatic integration.
Good balance for most use cases.

#### Where Extracted Insights Are Written

| Target | Contents | Persistence | Team-shareable |
|--------|----------|------------|---------------|
| `~/.claude/projects/<p>/memory/MEMORY.md` | Personal notes, patterns | Per-project, permanent | No |
| `CLAUDE.local.md` | User-specific project rules | Per-project | No (gitignored) |
| `~/.claude/CLAUDE.md` | Global user preferences | All projects | No |
| `CLAUDE.md` / `.claude/rules/*.md` | Team conventions | Per-project | Yes |
| Team skill registry | Reusable procedures | Shared | Yes (PR workflow) |

### 7. What a /rem-sleep Skill Would Contain

Based on the converging community patterns, a `/rem-sleep` skill for Claude Code would:

**Frontmatter**:
```yaml
---
name: rem-sleep
description: Post-session memory consolidation. Analyzes the current conversation to extract
  decisions, patterns, and preferences, then stores distilled insights into the memory system.
  Use at end of session or when you want to consolidate what was learned.
user-invocable: true
model: claude-haiku-4-5  # Keep cost low for routine consolidation
allowed-tools: [Read, Write, Edit, Glob]
---
```

**Instructions** (based on claude-diary + retrospective patterns):
```markdown
Analyze the conversation history currently in context. Extract:

1. **Decisions made**: architectural choices, technology selections, patterns adopted
2. **User preferences expressed**: corrections ("don't do X"), preferences ("always use Y")
3. **Solutions to problems**: bugs fixed, workarounds discovered, gotchas resolved
4. **Patterns confirmed**: recurring themes across this session
5. **Open questions**: unresolved issues worth tracking

Then:
- Read ~/.claude/projects/<project>/memory/MEMORY.md (if it exists)
- Deduplicate against existing memory entries
- Append new, non-duplicate insights to MEMORY.md using the index+topic-file structure
- If any insight belongs to an existing topic file (debugging.md, api-conventions.md, etc.),
  add it there instead
- If a pattern was corrected (user said "no, do X instead of Y"), update the existing entry

Do NOT write speculative conclusions. Only write what was explicitly demonstrated or stated.
Only propose changes to CLAUDE.md if a pattern appeared 3+ times across sessions.
```

**Hook integration** (for automatic triggering):
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "claude --skill rem-sleep --print"}]
      }
    ]
  }
}
```

### 8. Convergent Design Principles Across All Implementations

After analyzing 8+ implementations, the following patterns appear in nearly all of them:

**A) Two-phase separation**: raw capture (diary/observations) is separate from pattern synthesis
(reflect/integration). Don't conflate them -- reflection needs multiple observations to be meaningful.

**B) Human approval gate for CLAUDE.md changes**: all mature implementations require human review
before writing permanent instructions. Auto-writing to CLAUDE.md from conversation analysis has high
risk of encoding session-specific context as permanent rules.

**C) Pattern threshold**: most implementations use 2-3 occurrences before treating something as a
pattern worth encoding. Single-occurrence decisions go into notes, not rules.

**D) Failure modes are most valuable**: the Sionic AI retrospective research confirms that "Failed
Attempts" sections are referenced most frequently. Document what didn't work, not just what did.

**E) Context is already there**: claude-diary specifically notes that reading conversation context
is cheaper than re-reading JSONL files. The rem-sleep skill should analyze what's already in the
context window, not spawn a new subagent to read files.

**F) Use Haiku for consolidation**: memory consolidation is a routine, structured task -- no need
for Sonnet/Opus. Using Haiku keeps the cost of daily consolidation near zero.

### 9. Integration With Folder-Tree Memory System

The rem-sleep skill is the **write path** for the folder-tree memory system documented in the
companion research. The memory tree (`MEMORY.md` + topic files) is the **storage layer**; rem-sleep
is the **pipeline** that feeds it.

The full lifecycle:
1. **During session**: work happens, insights occur in context
2. **End of session**: `/rem-sleep` analyzes conversation, extracts insights
3. **Writes to memory tree**: new entries in `MEMORY.md` or topic files
4. **Next session start**: `MEMORY.md` (200 lines) auto-loaded into system prompt
5. **On demand**: topic files (`debugging.md`, `api-conventions.md`) loaded when relevant
6. **Periodically**: `/reflect` synthesizes multiple diary entries into CLAUDE.md rules

This mirrors biological memory consolidation exactly:
- Session = waking day (experiences)
- rem-sleep skill = sleep consolidation (extract, integrate, prune)
- MEMORY.md = working memory / hippocampus (fast access)
- CLAUDE.md = long-term cortical storage (stable rules)

## Open Questions

1. **Why isn't there a canonical `/rem-sleep` skill?** The pattern is well-understood but exists as
   N different implementations. A standard implementation would benefit from community consolidation.

2. **How much noise does automatic capture introduce?** claude-mem (fully automated) vs. claude-diary
   (human curated) -- no empirical comparison of memory quality vs. quantity trade-off.

3. **Optimal consolidation interval**: nightly? per-session? after N sessions? The biology suggests
   nightly is optimal, but daily claude-diary invocations may overfit to session-specific context.

4. **Deduplication quality**: semantic deduplication (claude-reflect) vs. simple text comparison --
   when does semantic deduplication become necessary vs. unnecessary overhead?

5. **Should rem-sleep run on a SubAgent?** claude-diary notes that using a Haiku subagent prevents
   context bloat from reading old conversations. But if the current conversation is already the
   target, a subagent adds overhead.

## Extracted Principles

The following principles are candidates for addition to `principles/agent-context-augmentation.md`:

- **Two-Phase Memory Consolidation**: Separate raw capture (/diary, observations) from pattern
  synthesis (/reflect, integration). Don't auto-update CLAUDE.md from single-session analysis.
  Reflection requires multiple sessions to identify real patterns.

- **Failure Documentation Is Most Valuable**: In post-session consolidation, documenting what failed
  and why outperforms documenting what succeeded. Failed attempts surface which paths to skip, making
  them the most retrieved memory type (Sionic AI retrospective research).

- **Human Approval Gate for Permanent Rules**: All mature implementations require human review before
  writing to CLAUDE.md. Auto-writing from session analysis has high risk of encoding session-specific
  context as permanent project-wide rules.

- **Rem-Sleep Writes; Session Memory Reads**: Use post-session consolidation (rem-sleep pattern) to
  write to the memory tree; rely on the built-in session memory inject at session start for the read
  path. These are complementary, not competing.

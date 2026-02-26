---
date: 2026-02-26
topic: Tmux workflows for agentic engineering
status: complete
tags: [tmux, claude-code, agents, terminal, workflow, notifications, multi-agent]
related: [2026-02-12-termius-tmux-scrollback.md]
---

# Tmux Workflows for Agentic Engineering

## Context

The user is already fluent with tmux fundamentals: session/window/pane creation, navigation, renaming. The question is: what are practitioners doing that's genuinely innovative at the intersection of tmux and agentic AI engineering? Specific ideas explored: clickable notifications that jump to the correct session/window/pane when Claude needs attention, dynamic window/pane titles that describe what an agent is currently doing, multi-agent parallel layouts with git worktree isolation, and monitoring dashboards across many simultaneous agent sessions.

---

## Findings

### 1. Claude Code Lifecycle Hooks — The Foundation of Everything

Claude Code's hook system (`~/.claude/settings.json`) is the entry point for all tmux integration. As of early 2026, there are **14 lifecycle events**:

| Event | Fires When |
|---|---|
| `SessionStart` | Session starts (startup / resume / clear / compact) |
| `SessionEnd` | Session ends |
| `UserPromptSubmit` | User submits a prompt |
| `PreToolUse` | Before any tool executes |
| `PermissionRequest` | Permission dialog appears |
| `PostToolUse` | After successful tool execution |
| `PostToolUseFailure` | After tool execution failure |
| `Notification` | Notification fires (permission_prompt / idle_prompt) |
| `Stop` | Claude completes its response |
| `SubagentStart` | A subagent starts |
| `SubagentStop` | A subagent completes |
| `PreCompact` | Before context compaction |
| `TeammateIdle` | An Agent Teams teammate becomes idle |
| `TaskCompleted` | A task is marked complete |

Source: [Claude Code Hooks Guide (SmartScope, Feb 2026)](https://smartscope.blog/en/generative-ai/claude/claude-code-hooks-guide/)

Hooks execute shell commands, pass JSON context via stdin, and can influence Claude's behavior via exit codes. This makes them the ideal integration point for every tmux feature described below.

---

### 2. Window Titles as Real-Time State Indicators

The single highest-value, lowest-effort improvement: rename tmux windows to reflect Claude's current state using hooks. A GitHub gist by posva demonstrates a complete implementation:

```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [{
      "type": "command",
      "command": "tmux rename-window -t $(tmux display-message -p '#{window_index}') '🤖 '$(basename $CLAUDE_PROJECT_DIR)"
    }],
    "UserPromptSubmit": [{
      "type": "command",
      "command": "tmux rename-window -t $(tmux display-message -p '#{window_index}') '⚡ '$(basename $CLAUDE_PROJECT_DIR)"
    }],
    "Notification": [{
      "type": "command",
      "command": "tmux rename-window -t $(tmux display-message -p '#{window_index}') '💬 '$(basename $CLAUDE_PROJECT_DIR)"
    }],
    "PermissionRequest": [{
      "type": "command",
      "command": "tmux rename-window -t $(tmux display-message -p '#{window_index}') '💬 '$(basename $CLAUDE_PROJECT_DIR)"
    }],
    "Stop": [{
      "type": "command",
      "command": "tmux rename-window -t $(tmux display-message -p '#{window_index}') '🤖 '$(basename $CLAUDE_PROJECT_DIR)"
    }],
    "SessionEnd": [{
      "type": "command",
      "command": "tmux set-window-option -t $(tmux display-message -p '#{window_index}') automatic-rename on"
    }]
  }
}
```

The emoji prefix alone provides instant glanceability across a tmux window list:
- `🤖 project` = idle/paused
- `⚡ project` = actively processing user input
- `💬 project` = needs attention (permission or notification)

Source: [Auto tmux title Claude Code (posva gist)](https://gist.github.com/posva/21ddab24ed68684b130ffa58c97da546)

#### Bell-Based Alternative

A simpler but less precise approach: configure Claude's `Stop` hook to send an ASCII BEL character to the pane. tmux's `alert-bell` hook and `visual-bell`/`bell-action` options can then show a badge or message in the status bar. The `set-hook -g alert-bell "run-shell '~/.config/tmux/bell.sh \"#S\" \"#W\"'"` pattern lets you trigger any script when any window bells, including desktop notification delivery.

---

### 3. AI-Powered Window Auto-Renaming

When you have 6+ agent windows open, names like `🤖 myproject` all look the same. The next level: use AI to generate a 1-3 word description of what the agent is actually working on.

[Hwee-Boon Yar's approach](https://hboon.com/auto-renaming-tmux-windows-for-ai-coding-agents/) runs a polling script (every 30 seconds) that:

1. Lists all tmux windows matching agent tool patterns (e.g., Claude version string)
2. Reads pane content via `tmux capture-pane` after the tool header
3. Skips windows with fewer than 10 non-empty lines (agent just started)
4. Sends content to an AI model with a naming prompt: "generate a 1-3 word window name that hints at what this window is for. The first word MUST be [project prefix]. Do NOT use any of these words: [words in directory path]"
5. Renames the window with the result: `hb post draft`, `blue fix auth`, `wm add hotkey`

The script uses `tmux capture-pane -p -t [window_id]` as the primitive. It runs via Bun: `bun ~/scripts/tmux-rename-agent-windows.ts`.

**Key design decisions:**
- Project prefix ensures names sort/group visually by project
- Threshold prevents useless names for freshly-started sessions
- Exclude directory path words to avoid redundancy

Source: [Auto-Renaming tmux Windows for AI Coding Agents](https://hboon.com/auto-renaming-tmux-windows-for-ai-coding-agents/)

---

### 4. Clickable Notifications That Jump to the Right Pane

This is the full solution to "Claude needs attention → I'm in the right place in 1 click." Alexandre Quemy built a complete system using:

**Architecture:**
```
Claude Stop/Notification hook
  → enriches payload with tmux context
  → POSTs to n8n webhook
    → Gotify (multi-device/mobile notifications)
    → local webhook server (macOS notification with clickable action)
      → click → go-tmux.sh → tmux select-window + select-pane + focus Ghostty
```

**Context capture in `.zshrc`:**
```bash
if [ -n "$TMUX" ] && [ -z "$WS_TMUX_LOCATION" ]; then
  export WS_TMUX_LOCATION=$(tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}')
  export WS_TMUX_SESSION_NAME=$(tmux display-message -p '#{session_name}')
  export WS_TMUX_WINDOW_NAME=$(tmux display-message -p '#{window_name}')
fi
```

These env vars are set once at shell startup (not per-command) — they capture the context of the shell that launched Claude, which is exactly what you want.

**The navigation script (`go-tmux.sh`):**
```bash
SESSION=$(echo "$LOCATION" | cut -d: -f1)
WINDOW=$(echo "$LOCATION" | cut -d: -f2 | cut -d. -f1)
PANE=$(echo "$LOCATION" | cut -d. -f2)

tmux select-window -t "$SESSION:$WINDOW"
tmux select-pane -t "$SESSION:$WINDOW.$PANE"
osascript -e 'tell application "Ghostty" to activate'
```

**The notification click:**
```bash
/opt/homebrew/bin/terminal-notifier \
  -subtitle "🤖 Claude is $([ "$7" = "Stop" ] && echo "done" || echo "waiting")." \
  -title "tmux s:$SESSION w:$WINDOW" \
  -execute "/usr/bin/curl -X POST 'http://localhost:9000/hooks/show-ghostty?tmux_location=$LOCATION'"
```

The title shows `tmux s:myproject w:auth-refactor` so even without clicking you know where to look. Clicking jumps you there directly.

Source: [Notification System for Tmux and Claude Code (quemy.info)](https://quemy.info/2025-08-04-notification-system-tmux-claude.html)

**Simpler macOS-only version:** For a lighter stack, the `Stop` hook alone + `osascript` for a notification + `tmux select-window` is sufficient without n8n/Gotify if you don't need mobile/multi-device.

---

### 5. Git Worktrees + tmux Windows: The Isolation Pattern

The dominant architectural pattern for parallel agent work: **one git worktree per agent, one tmux window per worktree.** This lets multiple Claude instances modify the same repository simultaneously without overwriting each other.

**Claude Code built-in support** (Boris Cherny, Anthropic):
```bash
# New: Claude Code now has native flags for this
claude --worktree          # creates its own git worktree automatically
claude --worktree --tmux   # creates worktree + launches in its own tmux session
claude --worktree --name auth-refactor  # named worktree
```

Source: [Boris Cherny on Threads](https://www.threads.com/@boris_cherny/post/DVAAoZ3gYut/use-claude-worktree-for-isolation-to-run-claude-code-in-its-own-git-worktree)

**Manual pattern** (Andy Nu's scripts):

`tmx-claude` — quick dispatch without branch isolation:
```bash
tmx-claude -d ~/work/src/myapp "Fix the flaky test in user_spec.rb"
tmx-claude -n "auth-fix" -d ~/work/src/auth "Debug the OAuth callback"
```

`tmx-worktree` — isolated feature work:
```bash
tmx-worktree -b feature-auth "Implement OAuth login flow"
tmx-worktree -p ~/work/src/myapp -b fix-123 "Fix the race condition"
```

`worktree-clean` — safe cleanup with uncommitted change protection:
```bash
worktree-clean --merged  # clean all merged worktrees
```

Both scripts operate identically: create tmux window in target directory → `tmux send-keys` to launch Claude with prompt → return focus to original window.

Source: [Multi-agent Claude Code workflow using tmux (andynu gist)](https://gist.github.com/andynu/13e362f7a5e69a9f083e7bca9f83f60a)

**Workmux** — a more complete tool:
- `workmux add feature-name` creates worktree + tmux window in one command
- Status tracking in window names: `working` / `waiting` / `done` indicators
- Automatic cleanup: `workmux merge` merges + deletes worktree + closes window
- Pane layout config (YAML): define agent pane + dev server pane + watcher pane
- Claude Code `/worktree` slash command delegation built-in
- `workmux dashboard` = TUI showing all active agents across all sessions

Source: [workmux (raine/workmux)](https://github.com/raine/workmux)

---

### 6. Agent Forking: Context-Inheriting Subagents

When you're mid-session and want to spin off a parallel investigation without polluting the main context:

[Kaushik Gopal's forking pattern](https://kau.sh/blog/agent-forking/) uses a script that:
1. Captures current session transcript via `tmux capture-pane`
2. Optionally compresses it via LLM (for long transcripts)
3. Creates a new tmux window with a structured payload:
   ```
   <context>
   [captured transcript or AI summary]
   </context>
   <task>
   [specific fork task]
   </task>
   ```
4. Labels the new window descriptively: "every time an agent is spawned, I label the tmux window with something that will help me remember"

This is tool-agnostic — works for Claude, Codex, Gemini. The context passed via `<context>` tags ensures the subagent has orientation without inheriting the full conversation. The author prefers interactive sessions (can read/redirect subagent) over fully headless execution.

---

### 7. Parallel Agent Spawning at Scale

For running many agents on the same prompt with different approaches:

**Uzi CLI** (skeptrune) — purpose-built for this:
```bash
uzi start --agents claude:3,codex:2 --prompt "Implement OAuth login"
uzi ls              # show active agents + branch status
uzi broadcast       # send follow-up prompt to all agents
uzi exec --all -- yarn dev  # run a command in all worktrees
uzi checkpoint      # commit + manage branches
```

The rationale: if each agent has ~25% chance of a good solution, running 4 gives 68% success rate. At ~$0.40 for 4 runs vs ~$0.10 for 1, the cost delta is negligible compared to time savings.

Source: [LLM Codegen Go Brrr (DEV Community)](https://dev.to/skeptrune/llm-codegen-go-brrr-parallelization-with-git-worktrees-and-tmux-2gop)

**Hierarchical agent systems** (scuti.asia): Named tmux sessions for organizational roles (PRESIDENT → boss1 → worker1/2/3), with `agent-send.sh [recipient] "[message]"` for inter-agent communication through shell scripts. Each agent has its own instruction file in `.claude/`. Users observe all agents in parallel via `tmux attach-session -t president`, etc.

---

### 8. Monitoring Dashboards for Multiple Agents

When running 5+ agents simultaneously, per-window inspection doesn't scale.

**Agent Deck** (asheshgoplani/agent-deck) — the most comprehensive tool:
- Built on tmux internally (sessions prefixed `agentdeck_*`)
- Written in Go with TUI + optional web UI at `localhost:8420`
- **4-state status detection**: Running (● green) / Waiting (◐ yellow) / Idle (○ gray) / Error (✕ red) via smart polling
- **Status bar integration**: tmux status bar shows a `⚡` for sessions needing attention; `Ctrl+b 1-6` jumps to them
- **Session forking**: `f` key creates branch from conversation with context inherited
- **MCP socket pooling**: 85-90% memory reduction by sharing MCP processes across sessions via Unix sockets
- **Conductor system**: persistent Claude sessions that monitor other sessions, auto-respond when confident, escalate when uncertain. Optional Telegram/Slack remote control.
- **Git worktree integration**: configurable isolation for parallel work on same repo

Install: `curl -fsSL https://raw.githubusercontent.com/asheshgoplani/agent-deck/main/install.sh | bash`

Source: [agent-deck (asheshgoplani)](https://github.com/asheshgoplani/agent-deck)

**Agent Tmux Monitor (ATM)** (damelLP) — context window focus:
- Hooks into PreToolUse, PostToolUse, and StatusLine events via `~/.claude/settings.json`
- `atm-hook` script sends events to a Rust daemon (`atmd`) via Unix socket
- `atm` TUI shows: context window progress bars, operational status, cost tracking, session jump
- Sessions appear automatically, stale after 90s without updates
- Vim navigation (j/k) in the dashboard

Source: [agent-tmux-monitor (damelLP)](https://github.com/damelLP/agent-tmux-monitor)

**Claude-tmux** (nielsgroen) — lighter weight:
- Popup overlay for managing multiple Claude Code sessions inside tmux
- Status monitoring + quick switching + git worktree + PR support

Source: [claude-tmux (nielsgroen)](https://github.com/nielsgroen/claude-tmux)

---

### 9. Status Bar as Workspace Dashboard

The tmux status bar supports arbitrary shell output via `#(command)` format strings, refreshed on a configurable interval. For agentic workflows, useful patterns:

**Git context per pane:**
```bash
set -g status-right "#(cd #{pane_current_path}; git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '-')"
```

**Count of waiting agents (custom script):**
```bash
# ~/bin/waiting-agents.sh — count windows with 💬 in name
set -g status-right "#(tmux list-windows -F '#{window_name}' | grep -c '💬')"
```

**Combined status bar:**
```bash
set -g status-right "waiting:#{#(waiting-agents.sh)} | %H:%M"
set -g status-interval 5  # refresh every 5s
```

The status bar has a `status-left`, window list (center), and `status-right`. For agent work, the right side is most natural for aggregate metrics.

Source: [ArcoLinux tmux status bar guide](https://arcolinux.com/everything-you-need-to-know-about-tmux-status-bar/)

**Gitmux** — polished git status in the status bar, replaces the older tmux-gitbar plugin.
Source: [arl/tmux-gitbar](https://github.com/arl/tmux-gitbar)

---

### 10. Core tmux Primitives for Agentic Scripting

The primitives everything above is built on:

**Reading pane content:**
```bash
# Full buffer (last 50,000 lines)
tmux capture-pane -t myproject:1.0 -p -S -50000

# Just visible content
tmux capture-pane -t myproject:1.0 -p

# Preserve wrapped lines (better for code)
tmux capture-pane -t myproject:1.0 -p -J
```

**Sending commands to panes (scripting from outside tmux):**
```bash
tmux send-keys -t myproject:1.0 "claude 'fix the failing test'" Enter
```

**Reliable targeting with IDs:**
```bash
# Pane ID ($TMUX_PANE in any tmux shell) — never changes even if renamed
tmux send-keys -t %47 "some command" Enter
```

**Logging all pane output to file:**
```bash
tmux pipe-pane -t myproject:1.0 -o 'cat >> /tmp/agent-log.txt'
```

**Querying state across all sessions:**
```bash
# List all panes server-wide with status
tmux list-panes -a -F '#{session_name}:#{window_name}.#{pane_index} #{pane_current_command}'
```

Source: [tmux Advanced Use Wiki](https://github.com/tmux/tmux/wiki/Advanced-Use)

**Environment variable available in all tmux shells:**
- `$TMUX` — socket path (confirms running in tmux)
- `$TMUX_PANE` — current pane's unique ID (e.g., `%47`)

These mean scripts running inside Claude's environment can self-identify their pane location without any external configuration.

---

### 11. Practical .tmux.conf Baseline for Agent Work

```bash
# High scrollback for long Claude responses
set -g history-limit 100000

# Prevent automatic renaming so hook-set names persist
set-window-option -g automatic-rename off
set-option -g allow-rename off

# Visual feedback for background activity (not audio)
set -g visual-bell off
set -g visual-activity on
set -g monitor-activity on
set -g bell-action other  # only alert for other windows' bells

# Status bar refresh for dynamic info
set -g status-interval 5

# Alert hook: run custom script on any bell
set-hook -g alert-bell "run-shell '~/.config/tmux/alert.sh \"#S\" \"#W\" \"#P\"'"

# Mouse on for convenience
set -g mouse on
```

Key decisions:
- `automatic-rename off` is required so hook-set window names (e.g., `⚡ myproject`) don't get overwritten by the shell's current command
- `bell-action other` vs `any` — `other` only alerts when a background window bells, not the focused one
- `monitor-activity on` gives a secondary signal when background panes produce output

---

## Open Questions

1. **Status bar performance at scale**: `#(command)` in the status bar runs a subprocess every `status-interval` seconds. At 5-second intervals with 3 shell calls, this is usually fine. But at 1-second intervals with 10+ calls, it can introduce latency. Does `run-shell` in hooks have better characteristics than polling?

2. **Cross-platform notification**: The clickable notification approach using `terminal-notifier` is macOS-specific. What's the Linux equivalent for WSL2 (where the user is, based on env context)? `notify-send` + a custom URI handler? The quemy.info approach via n8n+Gotify is inherently cross-platform.

3. **Agent Deck maturity**: It's a promising all-in-one solution but appears recently released (Go 1.24+, active development). How stable is the polling-based status detection for different Claude Code versions?

4. **Conductor system reliability**: Agent Deck's Conductor (a Claude session monitoring other Claude sessions) is an interesting pattern but introduces meta-agent complexity. What failure modes exist when the monitor becomes the bottleneck?

5. **Hooks latency**: Claude Code hooks fire synchronously by default — a slow hook can delay Claude. For notification delivery (which involves HTTP requests), should hooks use `&` for background execution?

6. **WSL2-specific considerations**: The user is on WSL2. `osascript` (macOS) doesn't apply. Desktop notifications on WSL2 require `wsl-notify-send` or PowerShell interop. Worth a dedicated follow-up.

---

## Extracted Principles

Distilled into: `principles/terminal-tmux-agentic.md` (new file — created alongside this research).

Key principles extracted:
1. Claude Code lifecycle hooks are the integration layer between agent state and terminal state
2. Window names are the cheapest useful UI surface — emoji-prefixed state machines
3. Capture tmux context at shell startup (not per-hook) for reliable pane addressing
4. Worktree + window pairing is the atomic unit of parallel agent work
5. AI-generated names beat static names at scale (>3 agents)
6. `automatic-rename off` is required when using hook-managed names

# Terminal & Tmux for Agentic Engineering

## Summary

Tmux is the primary substrate for managing multiple simultaneous AI coding agents. The combination of Claude Code lifecycle hooks, window renaming, git worktree isolation, and monitoring tools creates a fully observable, navigable agentic workspace without any additional UI infrastructure.

## Principles

### Hooks Are the Integration Layer

- **What:** Claude Code's 14 lifecycle hooks (`SessionStart`, `Stop`, `Notification`, `PreToolUse`, `PostToolUse`, `TeammateIdle`, `TaskCompleted`, etc.) are the right place to drive all tmux state updates — not polling or external watchers.
- **Why:** Hooks fire at exact state transitions (processing → done → waiting), giving precise signal with zero polling overhead.
- **When:** Always use hooks for window naming, bell firing, and notification dispatch. Use polling only for aggregate status bar displays where per-event overhead matters.
- **Source:** research/2026-02-26-tmux-workflows.md

### Window Names as State Machines

- **What:** Rename tmux windows with emoji-prefixed state labels via hooks. Minimum viable: `🤖 project` (idle/stop), `⚡ project` (processing), `💬 project` (needs attention/permission).
- **Why:** Window names are the only always-visible UI surface in tmux — they're shown in the status bar even when you're focused elsewhere. They're the cheapest useful observability surface.
- **When:** Every Claude Code window. Disable `automatic-rename` so shell commands don't overwrite hook-set names.
- **Source:** research/2026-02-26-tmux-workflows.md — posva gist pattern

### Capture Tmux Context at Shell Startup

- **What:** Export pane address in `.zshrc`/`.bashrc` when a new shell starts inside tmux, not inside each hook:
  ```bash
  if [ -n "$TMUX" ] && [ -z "$WS_TMUX_LOCATION" ]; then
    export WS_TMUX_LOCATION=$(tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}')
  fi
  ```
- **Why:** Hooks fire in the Claude process environment, not a fresh shell. The tmux context variables captured at shell startup persist as inherited env vars. Capturing per-hook is fragile; capturing once at shell start is reliable.
- **When:** Any setup where hooks need to know which pane/window/session they belong to (notifications, logging, external dispatch).
- **Source:** research/2026-02-26-tmux-workflows.md — quemy.info notification system

### Clickable Notifications Require Stored Location

- **What:** For notifications that jump to the correct pane when clicked, you need: (1) stored `WS_TMUX_LOCATION` env var, (2) a navigation script (`tmux select-window` + `tmux select-pane` + focus terminal app), (3) a notification system that can execute a shell command on click (e.g., `terminal-notifier -execute` on macOS, `notify-send` with action on Linux).
- **Why:** Without the stored location, you know Claude finished but not where. The stored location collapses "find the right pane" to 1 click.
- **When:** Multi-agent workflows where you've context-switched away from an agent. Single-agent workflows can just use a bell.
- **Source:** research/2026-02-26-tmux-workflows.md — quemy.info notification system

### Worktree + Window Is the Atomic Unit of Parallel Work

- **What:** For each parallel agent task, create a git worktree (isolated branch + directory) and a corresponding tmux window. These are created together and destroyed together.
- **Why:** Worktrees prevent agents from overwriting each other's changes. Windows give you a direct navigation target. Keeping them 1:1 makes mental mapping trivial.
- **When:** Any time 2+ Claude instances need to modify the same repository simultaneously. Use `claude --worktree --tmux` (built-in), `workmux`, or manual `tmx-worktree` script.
- **Source:** research/2026-02-26-tmux-workflows.md — workmux, andynu gist, boris_cherny

### AI-Generated Window Names Beat Static Names at Scale

- **What:** At 3+ agents, static names like `🤖 myproject` become useless. Run a polling script (30s interval) that reads pane content via `capture-pane`, sends to an LLM, and renames windows to `[project-prefix] [1-3 word description]`.
- **Why:** At a glance: `hb post draft`, `blue fix auth`, `wm add hotkey` is dramatically more useful than three identical `myproject` windows. The AI step is cheap relative to the cognitive cost of checking each pane.
- **When:** 3+ simultaneous agent windows, especially long-running (minutes+) sessions.
- **Caveats:** Add a minimum content threshold (e.g., 10 non-empty lines) to skip freshly-started sessions. Exclude directory path components to avoid redundant names.
- **Source:** research/2026-02-26-tmux-workflows.md — hboon.com pattern

### `automatic-rename off` Is Required with Hook-Managed Names

- **What:** Set `set-window-option -g automatic-rename off` and `set-option -g allow-rename off` in `~/.tmux.conf` when using hook-based window naming.
- **Why:** tmux's automatic rename overwrites custom names the moment a shell command runs in the window. Without disabling it, hooks set the name and then the next shell command immediately resets it.
- **When:** Always, when using hooks or scripts to name windows. Restore auto-rename only via `SessionEnd` hook if desired.
- **Source:** research/2026-02-26-tmux-workflows.md

### Use Unique Pane IDs for Reliable Scripting

- **What:** Target panes via their unique `%ID` (available as `$TMUX_PANE` inside any tmux shell) rather than `session:window.pane` positional addresses.
- **Why:** Unique IDs are stable — panes can be moved, sessions renamed, windows reordered, and the `%ID` never changes. Positional addresses break when layout changes.
- **When:** Any script that stores a pane reference for later use (e.g., the stored `WS_TMUX_LOCATION` pattern). For one-off commands, positional addressing is fine.
- **Source:** research/2026-02-26-tmux-workflows.md — tmux Advanced Use wiki

### Monitoring Dashboards for >5 Agents

- **What:** Beyond 5 concurrent agents, per-window observation doesn't scale. Use a TUI dashboard: Agent Deck (all-in-one Go TUI, 4-state detection, conductor orchestration), Agent Tmux Monitor (Rust, context-window progress bars + cost tracking), or workmux dashboard.
- **Why:** At scale, you need aggregate status (how many waiting?) rather than per-session inspection. The `⚡`-in-status-bar pattern from Agent Deck + keyboard jump (Ctrl+b 1-6) gives this.
- **When:** 5+ simultaneous agents, or any workflow where you're regularly context-switching between agents.
- **Source:** research/2026-02-26-tmux-workflows.md — agent-deck, agent-tmux-monitor

### `bell-action other` for Background Alerting

- **What:** Set `bell-action other` (not `any`) in tmux config. `other` alerts only when a background window sends a bell — not the focused window.
- **Why:** `any` makes the focused window bell too, which is distracting. `other` gives you signal precisely when something in the background needs attention.
- **When:** Whenever using bell-based agent completion signals.
- **Source:** research/2026-02-26-tmux-workflows.md

## Revision History

- 2026-02-26: Initial extraction from research/2026-02-26-tmux-workflows.md. 9 principles covering hooks, window naming, notifications, worktree isolation, and monitoring.

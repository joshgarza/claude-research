---
date: 2026-02-12
topic: Termius + tmux scrollback not working
status: complete
tags: [termius, tmux, ssh, scrollback, mobile, ios, terminal]
---

# Termius + tmux: Why Scrollback Doesn't Work and How to Fix It

## Context

When connecting via Termius (mobile SSH client on iOS/Android) to a remote machine running tmux, swiping up to scroll through previous output does not work as expected. The user has `set -g mouse on` in their tmux config. Instead of scrolling through history, the terminal either does nothing, sends garbage input, or auto-scrolls back to the bottom.

## Root Cause Analysis

There are **three layers** to this problem, and all three interact:

### Layer 1: tmux Uses the Alternate Screen Buffer

This is the fundamental architectural issue. When tmux starts, it switches the parent terminal into the **alternate screen buffer** — the same mechanism used by vim, less, and other full-screen applications. The alternate screen buffer:

- Has **exactly the same dimensions** as the terminal window (no off-screen area)
- **Does not have native scrollback**. Any output that leaves the visible area is gone from the terminal's perspective
- When tmux exits, the terminal switches back to the main buffer, restoring the pre-tmux display

This means **your terminal's native scroll gesture (swipe up on iOS) scrolls the terminal's buffer, but tmux's alternate screen buffer has nothing to scroll through**. The terminal sees a full-screen application occupying exactly one screen of content.

tmux compensates by maintaining its **own internal scrollback buffer** (default: 2000 lines). But you can only access this buffer through **tmux's copy mode**, not through the terminal's native scroll.

**Source:** [tmux in practice: scrollback buffer (freeCodeCamp)](https://www.freecodecamp.org/news/tmux-in-practice-scrollback-buffer-47d5ffa71c93/)

### Layer 2: Termius Touch Gesture → Mouse Event Translation

When you swipe up on Termius, the app must decide what to do with that touch gesture. There are two possibilities:

1. **Scroll the terminal's own buffer** (native scroll) — but the alternate screen buffer has nothing to scroll
2. **Translate the swipe into mouse wheel-up events** and send them to the remote application (tmux)

If Termius translates the swipe into mouse wheel events AND tmux has `set -g mouse on`, then tmux **should** receive those events and enter copy mode. However:

- Older versions of Termius did **not** properly handle the alternate screen buffer, causing scroll to do nothing or produce glitchy behavior
- Termius has shipped fixes for "scrolling in the terminal when an alternate screen buffer is being used" in iOS changelogs
- There is also a known iOS Termius bug where the interface **auto-scrolls back to the input field** after any output, preventing you from viewing previous content

**Source:** [Termius iOS changelog](https://termius.com/changelog/ios-changelog), [gemini-cli issue #10349](https://github.com/google-gemini/gemini-cli/issues/10349)

### Layer 3: xterm.js Alternate Buffer Limitation

Termius's terminal rendering is likely built on or similar to xterm.js (the dominant web/cross-platform terminal library). xterm.js has a **known architectural limitation**: it does not support scrollback in the alternate screen buffer. This is unlike iTerm2, which has a "Save lines to scrollback in alternate screen mode" option.

The xterm.js issue requesting this feature (#3607) was **closed as out-of-scope** in January 2026. This means terminals built on xterm.js fundamentally cannot offer iTerm2-style "scroll through tmux output natively."

**Source:** [xterm.js issue #3607](https://github.com/xtermjs/xterm.js/issues/3607), [xterm.js issue #802](https://github.com/xtermjs/xterm.js/issues/802)

## Solutions (Ranked by Effectiveness)

### Solution 1: Use tmux Copy Mode via Keyboard (Most Reliable)

This bypasses all terminal-specific issues entirely. It works on every terminal, every platform, every version.

**Enter copy mode:**
```
Ctrl+b then [
```

**Navigate in copy mode:**
- Arrow keys to scroll line by line
- `Page Up` / `Page Down` to scroll by pages
- `g` to go to top of history (vi mode)
- `G` to go to bottom of history (vi mode)
- `/` to search forward, `?` to search backward
- `q` to exit copy mode

**Enable vi-style navigation (recommended):**
Add to `~/.tmux.conf`:
```
set-window-option -g mode-keys vi
```

This gives you `h/j/k/l` movement, `Ctrl+u/d` for half-page scroll, `w/b` for word jumping, and `/` search.

### Solution 2: Ensure `set -g mouse on` and Update Termius

If mouse mode is on **and** Termius properly translates swipe gestures into mouse wheel events, then swiping up should automatically enter tmux copy mode.

**Required tmux config:**
```bash
# ~/.tmux.conf
set -g mouse on
```

**Required Termius action:**
- Update Termius to the latest version (multiple scroll/alternate-buffer fixes have been shipped)
- On iOS, ensure Termius has the latest trackpad/mouse support updates

**Testing:** After configuring, try swiping up in a tmux pane. If it enters copy mode (you'll see a yellow `[0/N]` indicator in the top right), mouse events are being translated correctly.

### Solution 3: Add Explicit WheelUpPane Bindings

If `set -g mouse on` alone doesn't work (because Termius sends events that tmux doesn't interpret correctly), add explicit scroll bindings:

```bash
# ~/.tmux.conf
set -g mouse on

# Explicit mouse wheel bindings for better compatibility
bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'select-pane -t=; copy-mode -e; send-keys -M'"
bind -n WheelDownPane select-pane -t= \; send-keys -M
```

This configuration:
- If the pane's program wants mouse events (e.g., vim), passes them through
- If you're already in copy mode, passes scroll events to copy mode
- Otherwise, enters copy mode and then scrolls

### Solution 4: Increase the History Limit

The default tmux scrollback is only 2000 lines. If you can scroll but can't go back far enough:

```bash
# ~/.tmux.conf
set -g history-limit 50000
```

**Note:** This only affects new panes/windows created after the setting is applied. Existing panes keep their old limit. Recommended range: 10,000–50,000. Avoid 100,000+ as it increases memory usage per pane.

### Solution 5: Fine-Tune Scroll Speed

Default mouse wheel scroll in tmux jumps 5 lines per tick, which can feel jarring. Reduce it:

```bash
# ~/.tmux.conf (requires vi copy mode)
bind -T copy-mode-vi WheelUpPane select-pane \; send-keys -X -N 2 scroll-up
bind -T copy-mode-vi WheelDownPane select-pane \; send-keys -X -N 2 scroll-down
```

### Solution 6: Workaround for the iOS Auto-Scroll Bug

If Termius on iOS keeps snapping back to the bottom after output (the auto-scroll bug from gemini-cli #10349), the only reliable workaround is:

1. **Use keyboard copy mode** (Solution 1) — this is immune to the auto-scroll issue
2. **Wait for Termius to fix it** — this appears to be a Termius-side bug, not a tmux issue
3. **Try a different iOS SSH client** (Blink Shell has better tmux integration, including two-finger scroll that works reliably)

## Complete Recommended tmux.conf for Termius

```bash
# Mouse support — allows swipe/scroll to enter copy mode
set -g mouse on

# Vi-style copy mode navigation
set-window-option -g mode-keys vi

# Generous scrollback buffer
set -g history-limit 50000

# Explicit wheel bindings for better terminal compatibility
bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'select-pane -t=; copy-mode -e; send-keys -M'"
bind -n WheelDownPane select-pane -t= \; send-keys -M

# Smoother scroll in copy mode (2 lines per tick instead of 5)
bind -T copy-mode-vi WheelUpPane select-pane \; send-keys -X -N 2 scroll-up
bind -T copy-mode-vi WheelDownPane select-pane \; send-keys -X -N 2 scroll-down

# Don't exit copy mode when scrolling past the bottom
# (requires tmux-better-mouse-mode plugin for full control)
```

## Open Questions

- **Does Termius use xterm.js internally?** This is suspected but not confirmed. If it does, the alternate-buffer scrollback limitation is structural and won't be fixed by Termius config changes.
- **Does Termius support DECSET 1007 (alternate scroll mode)?** This terminal escape sequence tells the terminal to convert scroll wheel events to cursor key events when in the alternate screen buffer. If Termius supports it, tmux could theoretically be configured to use it.
- **Blink Shell comparison:** Blink Shell on iOS reportedly has better tmux scroll integration. A direct comparison would be valuable for users willing to switch clients.

## Extracted Principles

- When tmux scrollback doesn't work in a terminal, the root cause is almost always the alternate screen buffer interaction — not a tmux bug. The terminal must either (a) translate scroll gestures into mouse events for tmux, or (b) implement iTerm2-style alternate buffer scrollback.
- Keyboard copy mode (`Ctrl+b [`) is the universal, always-works solution for tmux scrollback regardless of terminal client.
- Mobile SSH clients have an extra translation layer (touch gesture → mouse event) that desktop terminals don't. This is where most mobile-specific scroll bugs originate.

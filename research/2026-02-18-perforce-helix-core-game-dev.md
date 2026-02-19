---
date: 2026-02-18
topic: Perforce Helix Core for game dev workflows
status: complete
tags: [version-control, perforce, game-dev, helix-core, p4]
---

# Perforce Helix Core for Game Dev (from a Git Background)

## Context
Research into Perforce Helix Core as the industry-standard VCS for game development. Framed for someone with Git-only experience who needs to understand P4 concepts, workflows, and the mental model shift required.

## The Fundamental Shift: Centralized vs Distributed

Git is **distributed** — every developer has the full repo history locally. Perforce is **centralized** — there's one server (the "depot"), and developers sync subsets of it to local "workspaces." This single difference drives nearly every workflow difference.

| Aspect | Git | Perforce |
|--------|-----|----------|
| History | Full copy on every machine | Server only; client has working files |
| Offline work | Full capability | Limited (can't browse history, must explicitly check out) |
| Branching | Lightweight pointers | Streams (structured, heavier, metadata-rich) |
| Binary files | Struggles (even with LFS) | First-class citizen, no size limits |
| File locking | Bolted on (LFS lock) | Native exclusive checkout (`+l` modifier) |
| Merging | Excels at text merge | Excels at preventing unmergeable conflicts |

**Why game studios chose Perforce:** Game projects routinely hit 100GB-1TB+ with textures, 3D models, audio, video, and engine binaries. Git (even with LFS) breaks down past ~50GB repos or ~5GB individual files. Perforce handles this natively — no pointer files, no separate storage backends. 19 of the top 20 AAA studios use it.

## Terminology: Git → Perforce Rosetta Stone

| Git Concept | Perforce Equivalent | Notes |
|-------------|---------------------|-------|
| Repository | **Depot** | The central server-side store. Multiple depots can exist on one server. |
| Clone | **Workspace** (or Client) | A local mapping of depot paths to your machine. NOT a full copy. |
| Working directory | **Workspace root** | Where synced files live locally. |
| Branch | **Stream** | Structured branches with parent-child relationships and enforced flow. |
| Commit | **Changelist** (CL) | Numbered (CL#12345). Goes directly to server on submit. |
| `git add` + `git commit` | **`p4 add`** / **`p4 edit`** + **`p4 submit`** | Must explicitly open files before editing. |
| `git push` | (included in `p4 submit`) | Submit = commit + push in one step. No local-only commits. |
| `git pull` | **`p4 sync`** | Downloads latest from depot to workspace. |
| `git stash` | **`p4 shelve`** | But stored on the *server*, not locally — others can unshelve your work. |
| `git stash pop` | **`p4 unshelve`** | Restores shelved files to your workspace. |
| `git checkout <branch>` | **`p4 switch`** | Switches between streams. |
| `git merge` | **`p4 merge`** / **`p4 integrate`** | Integrate is the more general operation. |
| `git log` | **`p4 changes`** / **`p4 filelog`** | `changes` for CLs, `filelog` for per-file history. |
| `git diff` | **`p4 diff`** | Diff workspace file against depot version. |
| `git blame` | **`p4 annotate`** | Same concept. |
| `git tag` | **`p4 label`** / **`p4 tag`** | Labels are the equivalent of tags. |
| `git status` | **`p4 status`** / **`p4 opened`** | `opened` shows files you've checked out. |
| `.gitignore` | **P4IGNORE** file | Similar syntax, set via `p4 set P4IGNORE=.p4ignore`. |
| Pull request | **Shelved changelist** + **Helix Swarm** | Swarm is P4's code review tool. Shelve your CL, create a Swarm review. |

## Key Concepts Deep Dive

### Workspaces (Clients)

The biggest mental model change. In Git, `git clone` gives you everything. In Perforce, a **workspace** is a *mapping* — it defines which depot paths appear where on your local disk.

```
# Workspace view example — maps depot paths to local paths
//GameProject/Main/Source/... //josh-workspace/Source/...
//GameProject/Main/Content/Characters/... //josh-workspace/Content/Characters/...
```

**Why this matters for game dev:** A full game project might be 500GB. An engineer working on gameplay code doesn't need every texture. Workspace views let you sync only what you need — dramatically faster syncs and less disk usage.

**Stream workspaces** (modern approach) auto-generate the view from the stream spec. Classic workspaces require manual view mapping.

### Streams (Structured Branching)

Streams are Perforce's answer to branching, but they're opinionated and hierarchical — not the lightweight free-for-all of Git branches.

**Stream types:**
- **Mainline** — The trunk. Foundation for all other streams. Always exists.
- **Development** — Feature/experiment branches. Child of mainline (or another dev stream).
- **Release** — Stabilization branches. Created from mainline for a release cut.
- **Virtual** — Read-only views (useful for narrowing what you see without copying files).
- **Task** — Short-lived, lightweight branches for quick fixes. Delete after merge.

**Enforced flow — merge down, copy up:**
```
Release ← (copy up) ← Mainline ← (copy up) ← Development
Release → (merge down) → Mainline → (merge down) → Development
```

Changes flow *down* from stable to less stable (merge), and *up* from less stable to stable (copy). Perforce enforces this — you can't accidentally merge the wrong direction.

**Game studio pattern:**
```
                    Release/1.0
                        ↑ copy up
    Main (mainline)
     ↓ merge down          ↑ copy up
    Dev/Gameplay       Dev/Art       Dev/Networking
```

Artists work in an art stream, engineers in a gameplay stream. They don't see each other's in-progress work. When gameplay code stabilizes, it's copied up to Main, then merged down to the art stream.

### Explicit Checkout Model

This is the biggest daily-workflow shock for Git users.

**In Git:** Files are always writable. Edit anything, `git add` when ready.

**In Perforce:** Files are **read-only by default**. You must explicitly tell the server you're editing a file before you can modify it:

```bash
p4 edit //GameProject/Main/Source/PlayerController.cpp
# File is now writable locally and "checked out" on the server
# Other users can see you have it open
```

**Why:** This enables the server to track who's working on what *in real time*. Critical for binary files that can't be merged — if an artist is editing a character model, everyone else sees it's checked out and knows to wait.

**`p4 reconcile`** — The escape hatch. If you edit files without checking them out first (common when tools auto-generate files), `p4 reconcile` scans your workspace and opens the changed files automatically. Closest thing to `git add .` behavior.

### File Locking (Exclusive Checkout)

The killer feature for game dev binary assets.

**Two mechanisms:**

1. **`+l` file type modifier** (exclusive-open) — Configured per file type in the **typemap**. When a file has `+l`, only one user can check it out at a time. First one wins; others get an error.

2. **`p4 lock`** — Manual, per-changelist lock. Anyone can still open the file, but only the lock holder can submit.

For game dev, `+l` on binary assets is standard practice. Set it in the typemap so it's automatic.

### TypeMap (Critical for Game Engines)

The typemap tells Perforce how to handle different file extensions. **Set this before adding any files** — it only affects files added after configuration.

**Recommended typemap for Unreal Engine:**
```
TypeMap:
    binary+w //depot/....exe
    binary+w //depot/....dll
    binary+w //depot/....lib
    binary+w //depot/....app
    binary+w //depot/....dylib
    binary+w //depot/....stub
    binary+w //depot/....ipa
    binary   //depot/....bmp
    text     //depot/....ini
    text     //depot/....config
    text     //depot/....cpp
    text     //depot/....h
    text     //depot/....c
    text     //depot/....cs
    text     //depot/....py
    binary+l //depot/....uasset
    binary+l //depot/....umap
    binary+l //depot/....upk
    binary+l //depot/....udk
    binary+l //depot/....ubulk
```

Key detail: `.uasset` and `.umap` get `binary+l` — binary with exclusive lock. These are Unreal's asset and map files; they cannot be text-merged, so locking prevents conflicts entirely.

**Unity equivalent:** `.unity`, `.prefab`, `.asset`, `.mat`, `.anim`, `.controller` files should all be `binary+l`.

### Shelving (Server-Side Stash)

Unlike `git stash` (local only), `p4 shelve` stores your pending changes **on the server**:

```bash
# Shelve your work (stays on server)
p4 shelve -c 12345

# Someone else can grab your shelved work
p4 unshelve -s 12345

# Delete the shelf when done
p4 shelve -d -c 12345
```

**Used for:**
- Code review (shelve → create Swarm review → reviewers unshelve to test)
- Switching context (shelve current work, sync to a different state)
- Sharing WIP with teammates (unlike Git stash, others can access it)
- Pre-submit testing (shelve, have CI unshelve and build)

## Daily Workflow: The Git User's Day in P4

### Morning: Get latest
```bash
# Git equivalent: git pull
p4 sync
```

### Start working on a file
```bash
# Git: just edit the file
# P4: must check out first
p4 edit Source/PlayerController.cpp
# Now edit the file in your editor/IDE
```

### Check what you have open
```bash
# Git: git status
p4 opened
p4 status    # also catches files changed outside P4
```

### Add a new file
```bash
# Git: git add NewFile.cpp
p4 add Source/NewFile.cpp
```

### Delete a file
```bash
# Git: git rm OldFile.cpp
p4 delete Source/OldFile.cpp
```

### Review your changes
```bash
# Git: git diff
p4 diff
```

### Submit (commit + push in one step)
```bash
# Git: git commit -m "msg" && git push
p4 submit -d "Add player dash ability"
```

### Oops, need to get latest first (conflict)
```bash
p4 sync
p4 resolve          # Interactive merge resolution
p4 submit -d "Add player dash ability"
```

### Shelve work to switch context
```bash
# Git: git stash
p4 shelve -c default
p4 revert //...     # Clean workspace

# Later, restore:
# Git: git stash pop
p4 unshelve -s <CL#>
```

### View history
```bash
# Git: git log
p4 changes -m 20 //GameProject/Main/...

# Git: git log <file>
p4 filelog Source/PlayerController.cpp

# Git: git blame <file>
p4 annotate Source/PlayerController.cpp
```

## Tools & Interfaces

### P4V (Helix Visual Client)
The primary GUI. Most game studios mandate P4V for artists/designers (simpler than CLI). Includes:
- **Workspace tree** — visual file browser with checkout status
- **History view** — timeline of changes
- **Stream graph** — visual stream hierarchy
- **Merge/resolve** — visual diff and merge tools
- **Time-lapse view** — `git blame` but visual and navigable

### P4 CLI
Power-user interface. Faster for engineers who live in terminal. All examples in this doc use CLI.

### P4VS / P4Connect
IDE plugins — Visual Studio plugin (P4VS), Unity plugin (P4Connect). Enable checkout/submit from within the IDE/engine.

### Helix Swarm
Web-based code review tool. Equivalent to GitHub PRs. Integrates with shelved changelists.

### UnrealGameSync (UGS)
Epic's tool for Unreal teams. Syncs specific CLs, shows build status per CL, lets artists sync known-good builds. Not part of Perforce itself but deeply integrated.

## Game Studio Stream Patterns

### Small team (5-15 people)
```
Main (mainline)
  └── Dev (development) — everyone works here
```
Simple. Artists and engineers share one dev stream. Changes flow up to Main when stable. Release from Main.

### Medium team (15-50 people)
```
Main (mainline)
  ├── Dev/Feature-A (development)
  ├── Dev/Feature-B (development)
  ├── Dev/Art (development) — artists work here
  └── Release/1.0 (release)
```
Separate streams for major features and art. Merge down from Main regularly.

### Large studio (50+ people)
```
Main (mainline)
  ├── Dev/Gameplay (development)
  ├── Dev/AI (development)
  ├── Dev/Art (development)
  ├── Dev/Audio (development)
  ├── Dev/Tools (development)
  ├── Staging (development) — integration testing
  └── Release/1.0 (release)
      └── Release/1.0.1 (release) — hotfix
```
Full isolation between disciplines. Staging stream for integration before Main.

## Common Pitfalls for Git Users

### 1. Forgetting to check out before editing
Files are read-only. Your editor might fail silently or create temp files. Use `p4 reconcile` to catch out-of-band edits, but build the habit of `p4 edit` first.

### 2. Treating submit like commit
`p4 submit` = `git commit && git push`. There's no local-only save point. If you want to save work without publishing, use `p4 shelve`.

### 3. Expecting lightweight branches
Git branches are pointers — free to create. Perforce streams involve server-side metadata and workspace reconfiguration. Don't create streams for every tiny experiment. Use task streams for quick fixes; shelve for everything else.

### 4. Not setting up the typemap first
If you add files before configuring the typemap, they get default types. Binary files treated as text = corruption. Text files without `+l` that should have it = merge conflicts on unmergeable assets. **Always configure typemap before first submit.**

### 5. Syncing the entire depot
Unlike `git clone`, you control what you sync via workspace view. Sync only what you need. A full sync of a AAA project can take hours and hundreds of GB.

### 6. Ignoring the stream graph
Streams have enforced parent-child flow. Learn merge-down, copy-up — trying to push changes the "wrong way" will be blocked.

### 7. Not shelving before sync
If you sync with open edits, you might need to resolve. Shelve first if you're uncertain about conflicts.

## Pricing

- **Free tier:** Up to 5 users, 20 workspaces. Perpetual, not a trial. Full features including streams, locking, binary management. Good for indie teams.
- **Standard:** ~$50-75/user/month (6-25 users).
- **Enterprise:** ~$75-100+/user/month (larger teams).
- **Self-hosted vs cloud:** Helix Core Cloud (managed) or self-host on your own infra.

## Open Questions

- How does P4's DVCS mode (introduced in recent versions) compare to full Git for hybrid workflows?
- What's the current state of Perforce + Git coexistence (Helix4Git connector) in practice?
- How do CI/CD pipelines (GitHub Actions, Jenkins) integrate with P4 triggers and shelved changelists?
- What's the real-world experience of switching between P4V and CLI as a power user?

## Extracted Principles

No standalone principles file extracted — this is domain-specific reference material for game dev VCS, not a general engineering principle. If a game dev project starts, this research serves as the onboarding reference.

## Sources

- [Perforce for Game Development: Complete Version Control Guide 2025](https://generalistprogrammer.com/tutorials/perforce-game-development-version-control-guide)
- [Git vs. Perforce: How to Choose](https://www.perforce.com/blog/vcs/git-vs-perforce-how-choose-and-when-use-both)
- [Git vs Perforce for Game Development (Anchorpoint)](https://www.anchorpoint.app/blog/git-vs-perforce-for-game-development)
- [Perforce Cheat Sheet](https://www.perforce.com/blog/vcs/perforce-cheat-sheet)
- [How to Use Perforce Streams 101](https://www.perforce.com/blog/vcs/how-use-perforce-streams-101)
- [Exclusive File Locking](https://portal.perforce.com/s/article/3114)
- [Using Perforce as Source Control for Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-perforce-as-source-control-for-unreal-engine)
- [Configure TypeMap Settings (Perforce Help)](https://help.perforce.com/helix-core/quickstart-unreal/Content/quickstart/game-configure-typemap-settings.html)
- [P4 Quick Start Guide for Git Users (Cyber Stoat)](https://cyberstoat.medium.com/perforce-p4-cli-a-very-quick-start-guide-for-a-git-user-0edbdb45a99b)
- [Perforce vs Git: Comprehensive Guide (Assembla)](https://get.assembla.com/blog/perforce-vs-git-game-development/)
- [Perforce vs Git: Why Artists Don't Care (Artstash)](https://www.artstash.io/resources/perforce-vs-git-for-game-development)
- [Unreal Fest 2024: Workflow Best Practices with Perforce & UE](https://forums.unrealengine.com/t/talks-and-demos-workflow-best-practices-avoiding-common-pitfalls-with-perforce-unreal-engine-unreal-fest-2024/2016377)
- [Perforce Helix Core Documentation](https://www.perforce.com/products/helix-core/learning-resources)

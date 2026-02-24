---
date: 2026-02-23
topic: AI-powered weekly review and daily todo generation
status: complete
tags: [productivity, obsidian, ai-agent, task-management, dashboard]
---

# AI-Powered Weekly Review & Daily Todo Generation

## Context

Growing todo list in Obsidian (weekly notes format: `2026 Week 08.md` with `- [ ]` checkboxes). Custom dashboard has a `WeeklyTodos` widget showing progress bar (completed/total). The widget currently shows the whole week — goal is to replace it with a focused "today" view, powered by a weekly AI agent interview that learns user patterns over time and distributes tasks into daily plans.

### Current Setup
- **Vault path:** `/mnt/c/Users/josh/OneDrive/Documents/Obsidian/Obsidian Vault`
- **Weekly note format:** `YYYY Week WW.md` with `- [ ]` / `- [x]` items
- **Dashboard backend:** Express 5 + TypeScript at `dashboard/backend/`
- **Obsidian service:** `dashboard/backend/src/services/obsidianService.ts` — parses markdown checkboxes
- **Widget:** `dashboard/frontend/src/modules/WeeklyTodos/` — progress bar + counts
- **API:** `GET /api/obsidian/weekly-todos` — returns `WeeklyTodoSummary`

## Findings

### Landscape: Commercial Tools

Three tiers exist:

**Auto-schedulers** (fully automated time-blocking):
- **Motion** ($19/mo) — AI auto-schedules tasks into calendar, named agents (Alfred, Chip), $550M valuation. Overkill for this use case and opaque about *why* it schedules things.
- **Reclaim.ai** ($8/mo, acquired by Dropbox Aug 2024) — pulls tasks from 6+ sources, auto-finds time. Good integration story but again, fully automated with no weekly interview concept.

**Guided daily planning** (closer to the target):
- **Sunsama** ($16/mo) — "satisficing" approach, planned Timeboxing 2.0 + AI task surfacing. Closest commercially to the weekly→daily breakdown concept.
- **Morgen** ($9/mo) — has **direct Obsidian integration** (sync tasks to calendar), energy-aware scheduling. Most interesting commercial option.
- **Akiflow** ($15/mo) — speed-first, auto-import from Slack/Gmail/Notion.

**AI-enhanced traditional:**
- **Todoist** — Ramble (voice-to-project), Task Assist (pattern suggestions), programmable agents on Business tier.
- **Clockwise** — launched first MCP server in category (Sept 2025), letting Claude access its scheduling intelligence.

**Assessment:** None of these solve the actual problem. The user wants a *learning agent* that conducts weekly interviews and generates daily plans. These tools are either fully automated (no interview) or manual (no learning).

### Landscape: Agent-Based Approaches

**Teresa Torres's system** (most relevant reference):
- Uses Claude Code with a custom `/today` slash command
- Python script scans all task markdown files in Obsidian vault
- Generates daily lists with due/overdue/in-progress items
- 3-layer Claude.md context system (global → project → task)
- Separate "LLM Context" vault with dozens of focused context files
- End-of-session learning: "what'd you learn today that we should document?"
- Source: chatprd.ai interview

**Zapier MCP + Claude pattern:**
- Connects Notion/Asana tasks + Google Calendar through Zapier MCP
- Claude queries tasks, analyzes calendar, estimates durations, creates events
- Simple but no learning over time

**Gap:** No one has built a proper weekly review agent with learning. This is the opportunity.

### Obsidian Plugin Ecosystem (Relevant)

**obsidian-tasks-mcp** (GitHub: dss99911/obsidian-tasks-mcp):
- MCP server exposing 7 tools: `add_task`, `update_task`, `remove_task`, `toggle_task`, `query_tasks`, `list_tasks`, `get_tasks_by_date`
- Would let Claude interact with tasks structured way
- Requires Obsidian Tasks plugin format

**Obsidian Local REST API** (GitHub: coddingtonbear/obsidian-local-rest-api):
- HTTP API at `localhost:27123`
- Full vault CRUD access
- Could be used by the dashboard backend to read/write tasks

**Day Planner** (2.6k stars, active):
- Timeline/calendar view from daily notes
- ICS calendar sync
- TypeScript + Svelte

**TaskNotes** (GitHub: callumalpass/tasknotes):
- Each task as a separate markdown note
- Formula properties (urgencyScore, efficiencyRatio)
- Google/Microsoft calendar OAuth sync

### Architecture Options

#### Option A: Dashboard-Native (Recommended)

Everything lives in the existing dashboard. Weekly review is a new page/view in the dashboard, daily todos replace the current widget.

```
┌─────────────────────────────────────────────────┐
│                  Dashboard                       │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Today Widget │  │ Weekly Review Page        │  │
│  │ (replaces   │  │ (agent interview UI)      │  │
│  │  WeeklyTodos)│  │                          │  │
│  └──────┬──────┘  └────────────┬─────────────┘  │
│         │                      │                 │
│  ┌──────┴──────────────────────┴─────────────┐  │
│  │         Backend API Layer                  │  │
│  │  /api/obsidian/today-todos                │  │
│  │  /api/obsidian/weekly-review (SSE)        │  │
│  │  /api/obsidian/user-profile               │  │
│  └──────┬──────────────────────┬─────────────┘  │
│         │                      │                 │
│  ┌──────┴──────┐  ┌───────────┴──────────────┐  │
│  │ Obsidian    │  │ User Profile              │  │
│  │ Vault       │  │ (learning.yaml)           │  │
│  │ (markdown)  │  │                           │  │
│  └─────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Weekly Review Flow:**
1. Every Sunday (or user-chosen day), dashboard shows a "Weekly Review" prompt
2. Agent reads last week's todos (completed, deferred, abandoned)
3. Agent reads this week's new todos
4. Agent conducts structured interview via chat:
   - "These 3 items got deferred every day last week. Should we drop them or schedule them specifically?"
   - "You have 12 items this week. That's more than your typical 8. What's the priority order?"
   - "Any days with heavy meetings/commitments where you need a lighter load?"
5. Agent generates a daily distribution and saves it
6. Each morning, "Today" widget shows only that day's tasks

**Daily Todo Flow:**
1. `GET /api/obsidian/today-todos` returns today's assigned tasks
2. Widget shows ordered list with checkboxes
3. Checking items off updates the Obsidian vault markdown (via filesystem write or Local REST API)
4. End of day: uncompleted items roll to next day (with a "why" prompt if pattern detected)

**Components to build:**
- `obsidianService.ts` — extend with daily plan read/write, user profile read/write
- New backend route: `/api/obsidian/today-todos`
- New backend route: `/api/obsidian/weekly-review` (SSE streaming for agent conversation)
- New frontend module: `TodayTodos/` (replaces `WeeklyTodos/`)
- New frontend module: `WeeklyReview/` (chat-like interview UI)
- User profile file in vault: `_meta/learning-profile.yaml`
- Daily plan files in vault: `_meta/daily-plans/YYYY-MM-DD.md`

#### Option B: Claude Code Slash Commands

Like Teresa Torres's approach. `/weekly-review` and `/today` commands.

**Pros:** Quick to build, leverages Claude Code's existing infrastructure.
**Cons:** Separate from dashboard, no visual widget, harder to integrate with daily workflow unless the user lives in terminal.

#### Option C: Standalone Agent (Cron + Notification)

A script that runs on a schedule, reads the vault, generates daily plans, and sends a notification (push, email, or Slack).

**Pros:** Fully automated morning delivery.
**Cons:** No interview capability (or requires a separate chat interface), harder to iterate.

### User Learning Profile

The agent should maintain a learning profile that evolves over time. Stored as YAML in the Obsidian vault for transparency and portability:

```yaml
# _meta/learning-profile.yaml
energy_patterns:
  high_energy_days: [tuesday, wednesday]
  low_energy_days: [monday, friday]
  peak_hours: "9am-12pm"

work_preferences:
  max_daily_tasks: 5
  preferred_task_types_morning: [deep-work, creative]
  preferred_task_types_afternoon: [admin, communication]
  buffer_percentage: 20  # % of day left unscheduled

completion_patterns:
  avg_completion_rate: 0.72
  commonly_deferred_tags: [admin, cleanup]
  commonly_completed_first: [urgent, client-facing]

scheduling_preferences:
  review_day: sunday
  plan_delivery_time: "7:30am"
  rollover_policy: "ask"  # ask | auto-rollover | drop

weekly_history:
  - week: "2026-W08"
    planned: 10
    completed: 7
    deferred: 2
    dropped: 1
    notes: "Heavy meeting week, adjusted capacity down"
```

**Learning mechanism:** After each weekly review, the agent proposes profile updates based on observed patterns. User confirms or rejects. Over ~4-6 weeks, the profile becomes highly personalized.

### Daily Plan Format

Stored in the vault for Obsidian visibility:

```markdown
<!-- _meta/daily-plans/2026-02-24.md -->
# Monday, Feb 24

## Today's Focus
Ship the auth refactor (deep work, morning)

## Tasks
- [ ] Complete auth middleware refactor (#priority-1)
- [ ] Review PR from Alex (#communication)
- [ ] Update deployment docs (#admin)
- [ ] Respond to client email (#client-facing)

## Rolled Over
- [ ] Clean up test fixtures (from Friday — 3rd deferral)

## Notes
Light meeting day — good for the auth work.
```

### Interview Question Framework

The weekly review agent should follow a structured but conversational interview:

**Phase 1: Reflection (2-3 min)**
- What got done? What didn't? Why?
- Any surprises or blockers?
- How was energy/motivation this week?

**Phase 2: Triage (3-5 min)**
- Here's what's on the list. Walk through items.
- For deferred items: keep, reschedule, or drop?
- Any new items to add?

**Phase 3: Planning (2-3 min)**
- Priority ordering
- Daily distribution based on calendar + energy patterns
- Any hard deadlines or time-sensitive items?

**Phase 4: Calibration (1 min)**
- Does this daily breakdown feel realistic?
- Any adjustments to the learning profile?

## Open Questions

1. **How structured should the weekly note be?** Currently just `- [ ]` items. Would adding tags/priorities (e.g., `#urgent`, `#deep-work`) to existing items be acceptable friction?
2. **Calendar integration?** Would connecting Google Calendar data make the daily distribution smarter (e.g., "Tuesday has 4 hours of meetings, schedule fewer tasks")?
3. **Notification delivery?** How should the daily plan surface — just the dashboard widget, or also a morning notification?
4. **Automation level for weekly review?** Should it be opt-in each week (user clicks "Start Review") or auto-triggered on review day?
5. **Task granularity?** Some todo items are 10 minutes, some are 4 hours. Is duration estimation worth the friction?

## Extracted Principles

None yet — this is an architecture exploration. Principles will emerge from building and iterating.

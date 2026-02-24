---
date: 2026-02-23
topic: AI-powered todo management and prioritization landscape
status: complete
tags: [ai, productivity, obsidian, task-management, scheduling, agents]
---

# AI-Powered Todo Management & Prioritization Landscape

## Context
Research into the current state of AI-driven todo management, prioritization, and scheduling systems. Goal: understand what exists (commercial, open-source, Obsidian-native), how agent-based approaches work for periodic planning/review, technical patterns for building such systems, and the Obsidian plugin ecosystem for task management.

---

## 1. Existing Tools: Commercial AI Todo/Scheduling Apps

### Tier 1: Full AI Auto-Scheduling

#### Motion ($19/mo individual)
- **What it does:** AI auto-schedules tasks around calendar events, respects priorities/deadlines/dependencies, auto-reschedules when things shift.
- **2025-2026 evolution:** Repositioned from "AI scheduler" to "AI Employee SuperApp." New AI Employees: Alfred (EA), Chip (Sales), Clide (Support), Millie (PM), Suki (Marketing), plus custom employee builder.
- **Funding:** $60M Series C (Dec 2025) at $550M valuation.
- **Strengths:** Fully autonomous scheduling, team workload balancing, dependency-aware.
- **Weaknesses:** Expensive, opinionated (you lose manual control), steep learning curve.
- **Best for:** Teams/managers who want AI to own the schedule entirely.

#### Reclaim.ai ($8/mo)
- **What it does:** Smart time-blocking for Google/Outlook calendars. Auto-schedules tasks from Todoist/Asana/ClickUp/Linear/Jira/Google Tasks. Protects focus time and habits.
- **2024 event:** Acquired by Dropbox (Aug 2024).
- **Strengths:** Best integration breadth (6+ task sources), habit scheduling, affordable.
- **Weaknesses:** Less autonomous than Motion (more defensive than proactive), Google Calendar dependent.
- **Best for:** Individuals/solopreneurs who want time-blocking with protected focus time.

#### Clockwise
- **What it does:** AI calendar optimizer for teams, auto-rearranges meetings for focus time.
- **2025 update:** Launched MCP server (Sept 2025) — first in category. AI agents from Claude/Cursor can access Clockwise scheduling intelligence.
- **Dropped:** Asana integration (Jan 2025).
- **Best for:** Team-level meeting optimization.

### Tier 2: Guided Daily Planning

#### Sunsama ($16/mo)
- **Philosophy:** "Satisficing Theory" — good enough decisions fast > perfect decisions slow.
- **What it does:** Guided daily planning ritual. Pull tasks from connected tools, set intentions, estimate effort, build sustainable days.
- **2025 roadmap:** Backlog feature (H1), Timeboxing 2.0 with AI-powered task surfacing (H2), Objectives 2.0 (H2).
- **Strengths:** Intentional/mindful approach, prevents overcommitting, ritual-based.
- **Weaknesses:** More manual than Motion/Reclaim, less AI autonomy.
- **Best for:** People who want a reflective planning process, not full automation.

#### Akiflow ($15/mo)
- **Philosophy:** "Flow State Theory" — remove all friction between thought and action.
- **What it does:** Command-bar-first task inbox. Auto-imports from Slack/Gmail/Notion. Rules-based auto-scheduling and tagging.
- **Strengths:** Speed-first design, keyboard shortcuts, high input volume handling.
- **Weaknesses:** Less AI intelligence, more automation rules.
- **Best for:** High-velocity professionals drowning in inputs.

#### Morgen ($9/mo)
- **What it does:** AI Planner suggests when to tackle tasks based on time, energy, and focus. Preview-first flow: suggests schedule, you approve.
- **Obsidian integration:** Direct sync — schedule and display Obsidian tasks in Morgen calendar.
- **Strengths:** Energy-aware scheduling, Obsidian integration, balanced autonomy.
- **Best for:** Users who want AI suggestions but maintain control.

### Tier 3: AI-Enhanced Traditional Todo

#### Todoist (Pro $5/mo, Business $8/mo)
- **2025-2026 AI features:**
  - **Ramble:** Voice capture that structures stream-of-consciousness into project lists.
  - **Task Assist:** AI suggests scheduling based on historical completion patterns.
  - **Filter Assist:** Natural language filter creation.
  - **AI task breakdown:** Goals → actionable sub-tasks.
  - **Todoist Agents:** Programmable agents (Business tier).
- **Strengths:** Mature ecosystem, 40+ languages, natural language processing.
- **Weaknesses:** AI features feel bolted on, not deeply integrated into planning flow.

#### Trevor AI (pairs with Todoist)
- Syncs Todoist tasks to Google Calendar/Outlook in real-time for time-blocking.
- Smart scheduling across calendar systems.

### Comparison Matrix

| Tool | AI Autonomy | Calendar Integration | Task Sources | Energy-Aware | Price |
|------|------------|---------------------|-------------|-------------|-------|
| Motion | Full auto | Google/Outlook | Built-in | No | $19/mo |
| Reclaim | Semi-auto | Google/Outlook | 6+ integrations | No | $8/mo |
| Clockwise | Team-focused | Google/Outlook | Limited | No | Freemium |
| Sunsama | Guided | Google/Outlook | 8+ integrations | Yes (manual) | $16/mo |
| Akiflow | Rules-based | Google/Outlook | Slack/Gmail/Notion | No | $15/mo |
| Morgen | Suggested | Google/Outlook | Obsidian + others | Yes | $9/mo |
| Todoist | Suggestions | Via Trevor/Reclaim | Built-in | No | $5/mo |

---

## 2. Open-Source Solutions

### Super Productivity
- **GitHub:** [super-productivity/super-productivity](https://github.com/johannesjo/super-productivity)
- **What:** Advanced todo with timeboxing, time tracking, Pomodoro, break reminders.
- **Integrations:** Jira, GitLab, GitHub, Open Project.
- **AI:** No native AI, but an AI-enhanced fork exists ([chophe/ai-super-productivity](https://github.com/chophe/ai-super-productivity)).
- **Stack:** Angular, Electron.
- **Note:** Most mature open-source option for non-AI task management.

### ai-todo (MCP-native)
- **GitHub:** [fxstein/ai-todo](https://github.com/fxstein/ai-todo)
- **What:** AI-native task management stored in `TODO.md` files. MCP server for agent interaction.
- **Agents supported:** Cursor, Claude, Copilot.
- **Features:** Persistent, version-controlled, zero config, tag-based, subtasks, GitHub issue references, archival.
- **Architecture:** MCP server run via `uvx ai-todo serve --root ${workspaceFolder}`. Tasks in standard Markdown.

### todo-for-ai
- **GitHub:** [todo-for-ai/todo-for-ai](https://github.com/todo-for-ai/todo-for-ai)
- **What:** Task management system designed FOR AI assistants. MCP integration, team collaboration.
- **Stack:** React + Flask + Docker.
- **Live:** [todo4ai.org](https://todo4ai.org/)

### Leantime
- **URL:** [leantime.io](https://leantime.io/)
- **What:** Open-source project management with AI features (strategy → OKRs → tasks).
- **Approach:** Goal-first, ADHD-friendly design.

### tududi
- **GitHub:** [chrisvel/tududi](https://github.com/chrisvel/tududi)
- **What:** Self-hosted task management, privacy-focused. Personal + professional project organization.

---

## 3. Obsidian-Specific Ecosystem

### Core Task Plugins

#### Obsidian Tasks Plugin
- **GitHub:** [obsidian-tasks-group/obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)
- **Downloads:** 1M+ (most popular task plugin)
- **Emoji format reference:**
  - Priority: `🔺` Highest, `⏫` High, `🔼` Medium, `🔽` Low, `⬇️` Lowest (no emoji = Normal)
  - Dates: `📅` Due, `⏳` Scheduled, `🛫` Start, `➕` Created, `✅` Done, `❌` Cancelled
  - Recurrence: `🔁` (e.g., `🔁 every week`)
  - Depends on: `⛔` (e.g., `⛔ abc123`)
  - ID: `🆔` (e.g., `🆔 abc123`)
- **Query syntax:**
  ```
  ```tasks
  not done
  due before tomorrow
  priority is above low
  sort by priority
  group by filename
  ```
  ```
- **Key capabilities:** Global task queries, recurring tasks, dependency tracking, custom statuses, auto-suggest, multiple format support (emoji, dataview, custom).

#### Obsidian Dataview
- **What:** SQL-like query language for your vault. Can query tasks with rich filtering.
- **Task query example:**
  ```dataview
  TASK
  WHERE !completed
  WHERE due >= date(today)
  WHERE due <= date(today) + dur(7 days)
  SORT due ASC
  ```
- **Limitation:** Cannot parse Tasks plugin emoji priorities natively (only date shorthands supported).
- **Strength:** More flexible than Tasks queries for cross-referencing with note metadata.

#### Obsidian Bases (Core Plugin, 2025)
- **What:** Native database-like views for notes. Each note = row, properties = columns. Filter/sort/group without code.
- **Task setup:**
  - Each task is a separate note with YAML frontmatter: `priority`, `effort`, `due_date`, `scheduled_date`, `category`, `status`, `depends_on`, `related_project`, `done_date`
  - Formula properties: `urgencyScore` (weighted: priority×2, due_date×3, overdue penalty), `daysUntilDue`, `isOverdue`, `efficiencyRatio`
  - 8 views from one Base: All, Tasks for Daily, Overdue, Behind Schedule, Due in 7 Days, Scheduled for 7 Days, Due Today, Scheduled Today
  - Embed views in notes: `![[Task.base#ViewName]]`
- **Current limitation:** Table views only (no kanban/calendar yet).
- **Advantage over Tasks plugin:** Richer per-task metadata, formula-based dynamic scoring, no emoji-cramming on one line.

### Planning & Calendar Plugins

#### Day Planner
- **GitHub:** [ivan-lednev/obsidian-day-planner](https://github.com/ivan-lednev/obsidian-day-planner) (2.6k stars, active — v0.28.0, May 2025)
- **What:** Timeline/calendar view from daily notes. Time tracking. ICS calendar sync (Google/iCloud/Outlook).
- **Task formats:** Tasks plugin emoji (`⏳ 2024-12-10`), Dataview property syntax (`[scheduled:: date]`).
- **Stack:** TypeScript (77%), Svelte (20%). Requires Dataview.

#### Day Planner OG
- **GitHub:** [ebullient/obsidian-day-planner-og](https://github.com/ebullient/obsidian-day-planner-og)
- **What:** Fork of original Day Planner with Pomodoro timer integration.

#### Tasks Calendar
- **GitHub:** [702573N/Obsidian-Tasks-Calendar](https://github.com/702573N/Obsidian-Tasks-Calendar)
- **What:** Custom Dataview-powered calendar displaying Tasks plugin and daily note tasks. Highly customizable.

#### Tasks Calendar Wrapper
- **GitHub:** [Leonezz/obsidian-tasks-calendar-wrapper](https://github.com/Leonezz/obsidian-tasks-calendar-wrapper)
- **What:** Timeline view with customizable filters and rendering.

### Board/Project Views

#### Kanban Plugin
- **What:** Turns markdown lists into drag-and-drop Kanban boards. Simple, plain text format.

#### Kanban Plus
- **What:** Fork of Kanban with Full Calendar integration and additional features.

#### Task Board
- **GitHub:** [tu2-atmanand/Task-Board](https://github.com/tu2-atmanand/Task-Board)
- **What:** Scans entire vault for tasks, presents on visual board. Real-time updates, sub-tasks, metadata filtering, priority-based organization.

### Dashboard Plugins

#### Homepage Plugin
- **GitHub:** [Rainbell129/Obsidian-Homepage](https://github.com/Rainbell129/Obsidian-Homepage)
- **What:** Opens a specified note on startup. Users build dashboards using Dataview/Tasks query blocks embedded in a single note.
- **Typical dashboard sections:** Overdue tasks, Today tasks, Tomorrow tasks, Upcoming tasks, in-progress projects, recent notes.

#### Dashboards Plugin
- **GitHub:** [decaf-dev/obsidian-dashboards](https://github.com/decaf-dev/obsidian-dashboards)
- **What:** Flexible grid layouts (1×2, 2×2, 3×3+). Each cell embeds vault files, code blocks, or external URLs.

#### StartPage Plugin
- **GitHub:** [kuzzh/obsidian-startpage](https://github.com/kuzzh/obsidian-startpage)
- **What:** Beautiful dashboard with vault statistics, pinned notes, recent notes.

### AI-Adjacent Obsidian Tools

#### AgendaHeroOKR
- **GitHub:** [ImpBonobo/AgendaHeroOKR](https://github.com/ImpBonobo/AgendaHeroOKR)
- **What:** OKR-based task management with calendar view, task list, Scrum board.
- **Hierarchy:** Objectives → Key Results → Projects → Tasks.
- **"Intelligent" scheduling:** Algorithmic (priority-based, deadline-aware, conflict resolution) — NOT AI/ML.
- **Stack:** TypeScript (94.6%), CSS (4.2%).

#### TaskNotes
- **GitHub:** [callumalpass/tasknotes](https://github.com/callumalpass/tasknotes)
- **What:** Each task = separate markdown note. Views powered by Obsidian Bases.
- **Features:** Natural language task creation, RRULE recurrence, time tracking (Pomodoro), Google/Microsoft calendar sync via OAuth, optional HTTP API + CLI + browser extension + webhooks.
- **Custom properties:** Any field (energy-level, client, etc.) for filtering.
- **Formula properties:** `daysUntilDue`, `isOverdue`, `urgencyScore`, `efficiencyRatio`.
- **Language support:** UI in 9 languages, NLP parsing in 12.

#### Hypr (standalone companion app)
- **GitHub:** [different-ai/hypr-v0](https://github.com/different-ai/hypr-v0)
- **What:** Standalone AI task manager that reads Obsidian tasks. Dashboard with AI-prioritized actionable steps.
- **Status:** Early stage (Nov 2024 demo). Note: GitHub repo appears to have pivoted to a different product (Agent Bank / 0.finance).

#### TaskForge (mobile companion)
- **URL:** [taskforge.md](https://taskforge.md)
- **What:** Native iOS/Android/Mac app that syncs with Obsidian vault. Full Tasks plugin format support.
- **Features:** Push notifications, home screen widgets, kanban boards, calendar views, custom filtered lists, offline-first.
- **Version 2.0:** Fresh design, multi-language, weekly calendar view.
- **Pricing:** Freemium mobile app.

### External Access to Obsidian Vault

#### Local REST API Plugin
- **GitHub:** [coddingtonbear/obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)
- **What:** Secure HTTPS REST API for vault access. API key auth. Full CRUD on notes, periodic notes, commands.
- **Endpoints:** Read, create, update (append/prepend/overwrite), delete, search, list, PATCH for section insertion.
- **Port:** `http://127.0.0.1:27123` (HTTP) or `https://127.0.0.1:27124` (HTTPS).

#### Obsidian Tasks MCP Server
- **GitHub:** [dss99911/obsidian-tasks-mcp](https://github.com/dss99911/obsidian-tasks-mcp)
- **What:** MCP server exposing Tasks plugin functionality to AI assistants.
- **Tools exposed:**
  - `add_task` — Add task to file or today's daily note
  - `update_task` — Modify status, dates, priority, tags, recurrence
  - `remove_task` — Delete by ID/location
  - `toggle_task` — Complete/incomplete with recurrence handling
  - `query_tasks` — Search using Tasks plugin query syntax
  - `list_tasks` — All tasks with full metadata
  - `get_tasks_by_date` — Tasks due on date, optionally including overdue
- **Port:** `localhost:3789`
- **Key:** When Tasks plugin is available, leverages its API for recurrence handling and completion dates.

#### Obsidian MCP Server (General)
- **GitHub:** [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server)
- **What:** General vault MCP server via Local REST API plugin. Read/write/search notes, manage frontmatter/tags.
- **Tools:** `obsidian_read_note`, `obsidian_update_note`, `obsidian_search_replace`, `obsidian_global_search`, `obsidian_list_notes`, `obsidian_manage_frontmatter`, `obsidian_manage_tags`, `obsidian_delete_note`.
- **Performance:** In-memory cache with 10-min refresh.

---

## 4. Agent-Based Approaches to Todo Review/Planning

### Teresa Torres's Claude Code + Obsidian System
- **Source:** [ChatPRD interview](https://www.chatprd.ai/how-i-ai/teresa-torres-claude-code-obsdian-task-management), [Full tutorial](https://creatoreconomy.so/p/automate-your-life-with-claude-code-teresa-torres)
- **Daily workflow:**
  1. Type `/today` (custom Claude Code slash command)
  2. Claude executes Python script scanning all task markdown files
  3. Output: Tasks due today, overdue tasks, in-progress ideas
  4. Natural language task creation: "new task, send thank you to Claire, do today, How I AI was a blast"
  5. Claude creates markdown file with YAML frontmatter, applies tags from taxonomy
- **Context architecture:**
  - Separate "LLM Context" Obsidian vault
  - Dozens of focused markdown files (business/personal folders)
  - 3-layer Claude.md: global preferences → project-specific → task-specific
  - Index files as navigation maps for Claude
  - End-of-session: "what'd you learn today that we should document?" → auto-updates context files
- **Key insight:** Eliminates GUI friction (no browsers, date pickers, drag-and-drop). Everything is text → LLM → text.

### Zapier MCP + Claude Scheduling Agent
- **Source:** [xray.tech](https://www.xray.tech/post/ai-agent-scheduling)
- **Architecture:**
  1. Zapier MCP server connects Claude to Notion (tasks) + Google Calendar
  2. Claude queries task database for all tasks with metadata
  3. Analyzes calendar for availability
  4. Applies scheduling algorithm: due dates, urgency, dependencies
  5. Estimates realistic completion times
  6. Creates calendar events respecting constraints (work hours, meetings, dependencies)
- **User specifies:** Working hours, blackout times, preferences via natural language prompt.
- **Limitation:** No learning over time — each session is fresh.

### Claude Code Task DAG Pattern
- **Source:** [VentureBeat](https://venturebeat.com/orchestration/claude-codes-tasks-update-lets-agents-work-longer-and-coordinate-across)
- **Pattern:** Tasks as directed acyclic graphs (DAGs). Task 3 blocked until Tasks 1 and 2 complete.
- **Relevance:** Same pattern applies to personal task management — dependencies, blocking, parallel execution.

### Weekly Review Agent Pattern (Synthesized)
No single product does this well yet. The pattern would be:

1. **Interview phase:** Agent asks structured questions about the past week and upcoming priorities
2. **Data collection:** Pull task completion data, deferred items, calendar events
3. **Pattern recognition:** What gets deferred repeatedly? What times are most productive?
4. **Priority negotiation:** Agent proposes priorities, user adjusts
5. **Schedule generation:** Create daily task lists for the week
6. **Mid-week check-in:** Adjust based on actual progress

---

## 5. Technical Patterns for Building This

### A. Parsing Obsidian Markdown Tasks Programmatically

**Option 1: Direct file system parsing (external to Obsidian)**
```typescript
// Regex for Tasks plugin emoji format
const TASK_REGEX = /^- \[([ x\/\-])\] (.+)$/gm;
const DUE_REGEX = /📅 (\d{4}-\d{2}-\d{2})/;
const SCHEDULED_REGEX = /⏳ (\d{4}-\d{2}-\d{2})/;
const START_REGEX = /🛫 (\d{4}-\d{2}-\d{2})/;
const PRIORITY_MAP = {
  '🔺': 'highest', '⏫': 'high', '🔼': 'medium',
  '🔽': 'low', '⬇️': 'lowest'
};

// Walk vault directory, parse .md files, extract tasks
```

**Option 2: Via Obsidian Local REST API**
- Install `obsidian-local-rest-api` plugin
- HTTP requests to `http://127.0.0.1:27123`
- API key in headers
- Full CRUD + search

**Option 3: Via MCP (recommended for AI agents)**
- Install `obsidian-tasks-mcp` plugin
- Configure MCP client (Claude, Cursor, etc.) to connect to `localhost:3789`
- Use `query_tasks` with Tasks plugin syntax
- Best option: handles recurrence, statuses, all metadata natively

**Option 4: Via Bases approach (one task = one note)**
- Each task is a markdown file with YAML frontmatter
- Parse frontmatter with any YAML parser (`gray-matter` for Node.js)
- Richer metadata possible (energy-level, context, project, etc.)
- More structured but more file management

**Libraries:**
- `@jooooock/obsidian-markdown-parser` (JSR) — Obsidian-flavored markdown parsing
- `ts-stack/markdown` — Full TypeScript markdown parser
- `gray-matter` — YAML frontmatter extraction
- `globby` — File discovery in vault directory

### B. Structuring a "Weekly Interview" Agent

```
Weekly Review Agent Architecture
================================

1. DATA COLLECTION (automated)
   ├── Read all tasks from vault (via MCP or file parsing)
   ├── Categorize: completed, deferred, new, overdue
   ├── Pull calendar data (via ICS or Google Calendar API)
   └── Load user profile (preferences, patterns, energy map)

2. REFLECTION INTERVIEW (interactive)
   ├── "What went well this week?"
   ├── "What didn't get done that should have?"
   ├── "Any new priorities or deadlines?"
   ├── "How's your energy/stress level (1-5)?"
   ├── "Any commitments next week I should know about?"
   └── "Which deferred tasks should we drop vs. reschedule?"

3. ANALYSIS (automated)
   ├── Pattern detection: repeatedly deferred tasks
   ├── Workload estimation vs. available time
   ├── Priority scoring (urgency × importance × energy fit)
   └── Dependency graph resolution

4. PLAN GENERATION (collaborative)
   ├── Propose weekly priorities (top 3-5)
   ├── Distribute tasks across days (energy-aware)
   ├── Schedule deep work blocks
   ├── Buffer time for interruptions
   └── User reviews/adjusts → finalize

5. DAILY EXECUTION (automated)
   ├── Morning: generate today's task list from weekly plan
   ├── Mid-day: check-in if behind
   └── Evening: mark completions, note carry-overs
```

### C. Maintaining a Learning Profile

```yaml
# user-profile.yaml — evolves over time
meta:
  created: 2026-02-23
  last_updated: 2026-02-23
  review_count: 0

energy_patterns:
  morning: high       # 6-10am: deep work
  midday: medium      # 10am-2pm: meetings, collaborative
  afternoon: low      # 2-4pm: admin, low-effort
  evening: medium     # 4-6pm: second wind

work_preferences:
  max_daily_tasks: 5
  deep_work_block_minutes: 90
  preferred_meeting_days: [tuesday, thursday]
  no_meeting_windows: ["9:00-11:00"]
  break_frequency_minutes: 50

task_patterns:
  avg_completion_rate: 0.72
  commonly_deferred_tags: [admin, email]
  fastest_completion_tags: [coding, writing]
  overcommit_threshold: 7  # tasks/day where quality drops

scheduling_preferences:
  hardest_tasks_when: morning
  admin_tasks_when: afternoon
  email_batch_times: ["10:00", "15:00"]

history:
  - week: 2026-W08
    planned: 23
    completed: 17
    deferred: 4
    dropped: 2
    satisfaction: 4  # 1-5 self-reported
```

**Storage approach:** Structured YAML/JSON file in vault, updated after each weekly review. LLM reads this as context for planning decisions. Key: store patterns (what works), not raw data (every task ever).

**Memory admission criteria** (from [freeCodeCamp article](https://www.freecodecamp.org/news/how-to-build-ai-agents-that-remember-user-preferences-without-breaking-context/)):
1. **Durability:** Will this matter in future sessions?
2. **Reusability:** Will it meaningfully influence future decisions?
3. **Safety:** Does it avoid PII, secrets, or session-specific data?

### D. Generating Daily Task Lists from Weekly Plan

```
Weekly Plan → Daily Lists Pipeline
====================================

Input: weekly_plan.md (priorities, task assignments per day)
Input: user_profile.yaml (energy patterns, preferences)
Input: calendar_events.ics (meetings, commitments)

Process:
1. Load today's assigned tasks from weekly plan
2. Check calendar for available time blocks
3. Sort tasks by:
   a. Hard deadlines (immovable)
   b. Priority × energy fit for current time block
   c. Estimated duration vs. available block size
   d. Dependencies (blocked tasks pushed later)
4. Generate ordered list with time estimates
5. Add buffer (15-20% of total for interruptions)
6. Flag any overcommitment (> max_daily_tasks or > available hours)

Output: daily-2026-02-23.md
  ## Today's Focus
  - [ ] [Priority task from weekly goals]

  ## Scheduled
  - [ ] 09:00-10:30 Deep work: [task] (90min)
  - [ ] 11:00-11:30 Meeting: [name]
  - [ ] 14:00-14:30 Admin: [task] (30min)
  - [ ] 15:00-16:00 [task] (60min)

  ## If Time Allows
  - [ ] [lower priority items]

  ## Carried Over
  - [ ] [from yesterday, not completed]
```

---

## 6. Architecture for a Buildable System

### Option A: Claude Code + Obsidian (Teresa Torres Pattern)

**Pros:** Zero infrastructure, works today, full vault access, text-native.
**Cons:** No persistent learning (each session starts fresh unless context files maintained), requires Claude subscription, no mobile.

**Implementation:**
1. Custom slash command (`/today`, `/weekly-review`)
2. Python/TypeScript script to scan vault tasks
3. Claude.md files for context layering
4. User profile markdown file updated each session

### Option B: Obsidian Plugin + Local LLM

**Pros:** Privacy, no API costs, runs offline, deep Obsidian integration.
**Cons:** Local LLM quality lower, plugin development complexity, no calendar sync.

**Implementation:**
1. Obsidian plugin (TypeScript) using Tasks/Dataview APIs
2. Ollama for local inference
3. Custom views via Bases or Dataview
4. Profile stored as note with YAML frontmatter

### Option C: MCP Server + Claude Desktop/CLI

**Pros:** Best AI quality, structured tool access, can combine multiple data sources.
**Cons:** Requires Claude subscription, MCP setup complexity.

**Implementation:**
1. `obsidian-tasks-mcp` for task access
2. Google Calendar MCP for calendar data
3. Custom MCP server for user profile management
4. Claude orchestrates via MCP tools

### Option D: Standalone Agent (Most Flexible)

**Pros:** Full control, can integrate anything, persistent learning.
**Cons:** Most development effort, another app to maintain.

**Implementation:**
1. TypeScript CLI/web app
2. Direct vault file parsing (no Obsidian dependency for reading)
3. Anthropic API for Claude inference
4. SQLite for learning profile + task history
5. ICS/Google Calendar API for scheduling
6. Cron for daily/weekly triggers

### Recommended: Hybrid (A + C)

Start with Claude Code slash commands (quick win), evolve toward MCP-based agent:

1. **Phase 1:** `/today` and `/weekly-review` slash commands with Python scripts
2. **Phase 2:** Add `obsidian-tasks-mcp` for structured task access
3. **Phase 3:** User profile YAML file with learning updates
4. **Phase 4:** Calendar integration via MCP
5. **Phase 5:** Daily cron trigger for morning task generation

---

## Open Questions

1. **Morgen's Obsidian integration depth** — How tight is the sync? Can it read Tasks plugin metadata? Or just basic checklists?
2. **Obsidian Bases + Tasks plugin interop** — Can Bases query Tasks plugin data, or are they separate systems?
3. **obsidian-tasks-mcp maturity** — How stable is this? Production-ready or experimental?
4. **Local LLM quality for planning** — Is Llama 3.1/Qwen 2.5 good enough for weekly review interviews, or does this need Claude-tier reasoning?
5. **Energy-based scheduling evidence** — How much does matching task type to energy level actually improve completion rates?

## Extracted Principles

This research is primarily a landscape survey. Principles will be extracted when/if a system is built from these patterns. Key candidates:
- Task metadata design (what to track for AI-powered prioritization)
- Learning profile schema (what to remember about user patterns)
- Interview-based planning agent architecture
- MCP as the preferred integration layer for Obsidian + AI

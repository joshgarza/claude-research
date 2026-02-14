# Session Log

Chronological record of all research sessions. One line per session.

Format: `YYYY-MM-DD | topic | research file link | notes`

Use `[process]` tag for sessions that included CLAUDE.md modifications.

---

<!-- Sessions will be logged below this line -->
2026-02-11 | OpenClaw low-level integration patterns | research/2026-02-11-openclaw-low-level-patterns.md | First session. Analyzed iMessage monitoring (JSON-RPC subprocess), Swabble wake-word daemon, BlueBubbles webhooks, Signal SSE, WhatsApp Baileys, pairing system, channel abstraction.
2026-02-11 | Frontend UI/UX & branding trends 2026 | research/2026-02-11-frontend-uiux-trends-2026.md | Broad survey across 4 domains: UI/UX visual design, frontend tech (CSS/frameworks), branding/identity, AI-native interfaces (A2UI, generative UI). Key finding: UI is commodity, generative UI is next paradigm.
2026-02-12 | LinkedIn channel integration spec | research/2026-02-12-linkedin-channel-spec.md | High-level spec for OpenClaw LinkedIn channel plugin. Revised to low-frequency polling (1-2x/day) instead of SSE — drops detection risk to near-zero, drastically simplifies architecture. Cron trigger + Voyager REST + state diffing. Cookie-based auth only. SSE documented as upgrade path if real-time ever needed.
2026-02-12 | Termius + tmux scrollback fix | research/2026-02-12-termius-tmux-scrollback.md | Root cause: tmux alternate screen buffer has no native scrollback; Termius (likely xterm.js-based) can't scroll alt buffer. Three-layer problem: alt screen buffer, touch→mouse event translation, xterm.js limitation. Primary fix: keyboard copy mode (Ctrl+b [). Secondary: ensure mouse on + explicit WheelUpPane bindings + update Termius.
2026-02-13 | Frontend engineering practices 2026 | research/2026-02-13-frontend-engineering-practices.md | Engineering companion to the 02-11 UI/UX research. Covers meta-frameworks (Next.js vs TanStack Start vs React Router v7), RSC patterns, Feature-Sliced Design, state management taxonomy, end-to-end type safety (tRPC+Zod), Playwright over Cypress, INP optimization, Vite+pnpm+Turborepo toolchain, CI/CD with preview deploys. Principles extracted to principles/frontend-engineering.md.
2026-02-13 | Backend & API engineering practices 2026 | research/2026-02-13-backend-api-practices.md | Comprehensive backend survey. Frameworks (Hono for edge, Fastify for Node, Express is legacy). API paradigms (tRPC internal, REST external, mix-and-match). Drizzle over Prisma for new projects. Better Auth + passkeys + server-side sessions. Zod at every boundary. OpenTelemetry from day one. BullMQ → Kafka graduation path. Multi-layer caching. Expand-and-contract migrations. Start monolith, extract services. Principles extracted to principles/backend-api-engineering.md.

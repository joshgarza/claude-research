---
date: 2026-02-24
topic: Lichess solo engineer case study — how 1 developer outperforms 138
status: complete
tags: [architecture, simplicity, open-source, scala, bare-metal, solo-dev, efficiency]
related: [2026-02-13-backend-api-practices.md, 2026-02-14-performance-scalability.md]
---

# How 1 Software Engineer Outperforms 138 — Lichess Case Study

## Context

Research prompted by Tom Delalande's YouTube video ([How 1 Software Engineer Outperforms 138 - Lichess Case Study](https://www.youtube.com/watch?v=7VSVfQcaxFY)). The video examines how Thibault Duplessis, a single core developer, built and maintains Lichess.org — a free, open-source chess platform serving millions of users — while Chess.com employs 138 engineers (2022 figure, likely 200+ now with 700 total staff). The question: what architectural and philosophical decisions enable this kind of leverage?

## Findings

### The Numbers

| Metric | Lichess | Chess.com |
|--------|---------|-----------|
| Engineering team | ~1 core dev (Thibault), ~5 contributors | 138 engineers (2022), 700+ total staff |
| Monthly games | 5M+ new games/month | Comparable or higher |
| Monthly active users | 4M+ | 100M+ accounts |
| Server cost | ~$183/month (as of early reports; likely higher now but still bare metal) | Enterprise cloud infra |
| Revenue model | Donations only, no ads | Subscriptions, ads, premium content |
| Source code | Fully open source (AGPL-3.0) | Proprietary |

### Technology Stack

**Backend:**
- **Scala** (now Scala 3) on the Play Framework (2.8+)
- **MongoDB** for data storage — flexible schema, good locality for related data
- Akka actors for concurrent message passing and async I/O
- Scala Futures throughout — fully asynchronous server
- **Scalatags** for server-side templating (later replaced Twirl)
- **scalachess** — custom chess logic library, fully functional and immutable

**Frontend:**
- **Snabbdom** (lightweight virtual DOM, ~200 lines of runtime) — chosen over Scala.js for minimal runtime overhead
- TypeScript + plain JS — no heavy framework (no React, no Vue)
- Server-side rendering primary, minimal client-side JavaScript

**Infrastructure:**
- **Bare metal servers** — no cloud (AWS/GCP/Azure)
- Nginx as reverse proxy (HTTP on port 80, WebSockets on port 9000)
- Redis for caching/pub-sub
- Elasticsearch for indexing 4.7B+ games
- Simple, manual deployment from local machines — no CI/CD pipeline

**Supporting services:**
- stockfish.wasm / stockfish.js — browser-based chess engine via WebAssembly
- lila-ws — dedicated WebSocket server (Rust? or Scala)
- pgn-viewer — embedded PGN viewer in TypeScript

### Architecture Decisions That Create Leverage

**1. Minimal runtime, minimal abstraction**
- Snabbdom instead of React/Vue/Scala.js — the lightest possible virtual DOM
- No SPA framework overhead — server-side rendering + progressive enhancement
- The Lobsters discussion highlights the tension: "simplicity" as code reduction vs. "simplicity" as minimal runtime overhead. Lichess optimizes for the latter.

**2. Modularized monolith**
- 69 feature-based modules, ~59,000 lines of backend code (as of 2019 analysis)
- Largest modules: Tournament (5.4K), Study (4.4K), Game (3.9K), Common (3.3K), Security (3.3K), User (3.1K)
- No microservices. One deployable unit. One developer can hold the entire system in their head.

**3. Bare metal over cloud**
- Eliminates cloud abstraction tax (IAM, networking, billing complexity)
- Eliminates per-request/per-byte cloud costs — fixed monthly hardware costs
- Full control over hardware optimization
- The HN discussion praised this: "I love that all of LiChess runs on metal. Truly the dream."

**4. Functional, immutable core logic**
- scalachess is entirely functional, immutable, and side-effect-free
- This makes the most critical code (chess rules) trivially testable and mathematically verifiable
- Bugs in chess logic would be catastrophic — this design prevents entire classes of errors

**5. Minimal testing, maximum type safety**
- Only 2.68% branch coverage (2019 analysis) — 7 modules exceed 5% coverage
- Thibault explicitly stated functional tests aren't a priority
- Relies on Scala's strong type system + immutable data structures instead
- This is viable *because* of the single-developer model — one person's mental model IS the specification

**6. No CI/CD, manual deployment**
- Deploys from local machine
- Sounds crazy for a site serving millions — but removes an entire layer of tooling complexity
- Viable because: one deployer, one codebase, one server target

**7. MongoDB for flexibility**
- Schema flexibility allows rapid iteration without migrations
- Good data locality for chess-specific document shapes (game records, user profiles)
- Trade-off: no relational integrity guarantees, but chess data is mostly document-shaped anyway

### Why This Works (and When It Doesn't)

**It works because:**
- **Single domain**: Chess is a well-defined, stable domain. The rules don't change. The core product (play chess online) hasn't fundamentally changed in 15 years.
- **Single decision-maker**: No design-by-committee, no sprint planning, no architecture review boards. Thibault can refactor anything at any time.
- **Aligned incentives**: No ads, no premium features, no A/B tests for conversion optimization, no marketing features. Every line of code serves the chess experience.
- **Donations model**: No product managers asking for features to drive revenue. No growth hacking. No engagement metrics to optimize.
- **Community contributions**: While Thibault controls 96% of commits, the open-source community contributes patches, translations, and feature work. It's not truly "1 engineer" — it's 1 maintainer with community support.

**It would NOT work when:**
- **Revenue model requires feature breadth**: Chess.com's 138 engineers build premium content, coaching tools, puzzles, streaming integration, mobile apps, partnerships, community features, payment systems, customer support tools, content moderation — most of which Lichess doesn't need because it's donation-funded.
- **Multi-product portfolio**: Chess.com acquired Play Magnus Group and operates multiple chess-related products.
- **Regulatory/enterprise requirements**: GDPR compliance, SOC 2, enterprise sales, SLAs — each demands dedicated engineering.
- **Bus factor = 1**: If Thibault stops, Lichess has a serious continuity problem. Chess.com can lose any individual engineer.

### The Real Lesson

The video title is clickbait-adjacent. Thibault doesn't "outperform" 138 engineers in absolute output. He outperforms them in *efficiency per engineer* by:

1. **Solving a narrower problem** — free chess, no monetization features
2. **Choosing boring, proven technology** — Scala/Play/MongoDB/Nginx/bare metal
3. **Eliminating coordination overhead** — no meetings, no PRs to review, no merge conflicts, no alignment discussions
4. **Optimizing for runtime efficiency** — bare metal, minimal frameworks, async everything
5. **Leveraging strong typing over testing** — Scala's type system as the primary correctness mechanism
6. **Accepting trade-offs** — minimal testing, no CI/CD, manual deploys, MongoDB over Postgres

The comparison is structurally unfair: Chess.com builds a business; Lichess builds a public utility. Different constraints produce different architectures. But the principles of simplicity, minimal abstraction, and single-domain focus are universally applicable even if the specific trade-offs aren't.

## Open Questions

- What is Lichess's actual current infrastructure cost? Early figure of $183/month seems outdated for 4M+ MAU.
- How has the architecture evolved with Scala 3 migration? Any concurrency model changes?
- What's the actual breakdown of community vs. Thibault contributions for feature work vs. maintenance?
- How does Lichess handle database backups and disaster recovery with manual deployment?

## Extracted Principles

1. **Monolith until proven otherwise** — A modularized monolith with one deployer eliminates entire categories of distributed systems complexity. Microservices solve team coordination problems, not technical ones.
2. **Match infrastructure to team size** — Bare metal for a solo dev; cloud for teams that need IAM, environments, and self-service. Don't adopt coordination tools when there's no coordination to do.
3. **Type systems over test suites** — When one person holds the full mental model, strong static typing + immutable data catches more bugs per hour than writing tests. This trade-off flips as team size grows.
4. **Narrow scope creates exponential leverage** — Every feature you don't build removes code, tests, documentation, support, and attack surface. The biggest productivity multiplier is saying no.
5. **Boring technology is a force multiplier for small teams** — Scala, Play, MongoDB, Nginx have been stable for a decade. Zero time spent evaluating, migrating, or debugging cutting-edge tools.

See also: [performance-scalability principles](/principles/performance-scalability.md), [backend-api-engineering principles](/principles/backend-api-engineering.md).

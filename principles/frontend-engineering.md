# Frontend Engineering Principles (2026)

## Summary
Opinionated, practical engineering guidance for building frontend applications in 2026. Covers framework selection, architecture, type safety, testing, performance, and tooling. Focused on engineering decisions, not visual design.

## Principles

### Use a Meta-Framework
- **What:** Start every professional project with a meta-framework (Next.js, TanStack Start, or React Router v7). Don't roll your own routing, SSR, or build config.
- **Why:** Meta-frameworks encode hundreds of infrastructure decisions. Rolling your own costs months and produces worse results.
- **When:** Every production web app. Skip only for tiny widgets, learning projects, or embedded components.
- **When NOT:** Libraries, packages, or components intended for framework-agnostic consumption.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Categorize Your State
- **What:** Treat state management as a category problem. Server state → TanStack Query. Local → useState. Shared client → Zustand. Complex flows → XState. Global environment → Context.
- **Why:** No single library handles all state well. Mixing categories (e.g., putting server data in Redux) creates unnecessary complexity and bugs.
- **When:** Always. Even small apps benefit from the mental model.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### End-to-End Type Safety
- **What:** TypeScript from database to UI. Prisma/Drizzle → tRPC + Zod → TanStack Query. The compiler is the API contract.
- **Why:** Eliminates an entire class of bugs (type mismatches between client and server) and removes the need for code generation or OpenAPI specs.
- **When:** Any TypeScript monorepo or full-stack TypeScript project.
- **When NOT:** Polyglot backends, public APIs consumed by third parties (use OpenAPI), or teams where backend is a separate org.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Server Components as Default, Client as Opt-In
- **What:** In RSC-enabled frameworks, every component is a Server Component by default. Add `'use client'` only at boundary entry points where you need browser APIs or interactivity.
- **Why:** Reduces client JS, improves performance, simplifies data fetching. The Container/Presentational pattern maps directly to Server/Client.
- **When:** Projects using Next.js App Router or other RSC-enabled frameworks.
- **When NOT:** Offline-first apps, heavy real-time interactivity, teams without server infrastructure ownership.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Structure by Business Domain, Not Technical Layer
- **What:** Organize code by feature/domain (auth, cart, profile) not by type (components, hooks, utils). Feature-Sliced Design provides the most structured methodology.
- **Why:** Feature-sliced code has higher cohesion and lower coupling. Related code lives together. Import restrictions between slices prevent spaghetti.
- **When:** Any project beyond a handful of files. Adopt incrementally.
- **When NOT:** Very small projects, or component libraries where technical organization makes more sense.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Playwright for E2E Testing
- **What:** Use Playwright over Cypress for new projects. Cover Chromium, Firefox, and WebKit. Keep E2E to 5-10% of tests — critical user journeys only.
- **Why:** Better browser coverage (Safari), 4x faster, multi-tab support, fewer dependencies (1 vs 160+), surpassed Cypress in downloads mid-2024.
- **When:** Any project that needs E2E tests.
- **When NOT:** If your team is already productive with Cypress and doesn't need Safari coverage.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Optimize for INP
- **What:** Interaction to Next Paint is the Core Web Vital that most sites fail. Break long tasks (>50ms), use Web Workers for heavy computation, hydrate selectively, audit bundle size.
- **Why:** INP replaced FID in March 2024. It measures all interactions across a session, not just the first. Google uses it for search ranking.
- **When:** Any user-facing web application.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Vite + pnpm + Turborepo
- **What:** Vite for build tooling (don't use Webpack for new projects). pnpm for package management (strict deps, content-addressable store). Turborepo for monorepo orchestration.
- **Why:** This is the community consensus. Fast, well-integrated, minimal lock-in.
- **When:** New projects and monorepos.
- **When NOT:** Nx over Turborepo if you need advanced dependency graph analysis in very large orgs.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Preview Deploys + E2E in CI
- **What:** Every PR gets a preview deployment (Vercel/Netlify/Cloudflare Pages). Run Playwright E2E tests against the preview URL in CI.
- **Why:** Catches integration issues before merge. Gives reviewers a live environment to test. E2E against real deployments is more reliable than local-only testing.
- **When:** Any project with a CI pipeline and deployment target.
- **Source:** [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md)

### Patch React/Next.js Immediately on Security Releases
- **What:** Subscribe to React and Next.js security advisories. Patch within 48 hours of disclosure. Verify patches are complete — the Dec 2025 chain required 19.2.2→19.2.3→19.2.4.
- **Why:** CVE-2025-55182 (React2Shell, CVSS 10.0) was exploited within 48 hours. RondoDox botnet actively scanning. Initial patches were incomplete.
- **When:** Any project using RSC or Server Actions.
- **Source:** [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md)

### Treat Server Actions as Public Endpoints
- **What:** Every `"use server"` function is a public HTTP endpoint. Apply: input validation (Zod), authentication, authorization, and never capture secrets in closures.
- **Why:** Server Actions are callable via HTTP. Without validation/auth, they're open attack surfaces. Multiple CVEs in Dec 2025–Jan 2026 targeted these endpoints.
- **When:** Any project using Server Actions (Next.js, React Router v7 Framework Mode).
- **Source:** [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md)

### CSS Anchor Positioning Over JS Libraries
- **What:** Use CSS anchor positioning for tooltips, popovers, and dropdowns. Replace Popper.js / Floating UI with native CSS.
- **Why:** Baseline cross-browser as of January 2026 (Chrome, Firefox 147, Safari). No JS overhead, browser handles overflow and repositioning.
- **When:** New components. Migrate existing components opportunistically.
- **When NOT:** If you need to support browsers older than ~2024.
- **Source:** [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md)

### No Runtime CSS-in-JS for New Projects
- **What:** Do not start new projects with styled-components or Emotion. Use Tailwind CSS, CSS Modules, StyleX, or Panda CSS.
- **Why:** styled-components entered maintenance mode (Jan 2024). RSC incompatible. Runtime overhead unacceptable for modern performance budgets.
- **When:** All new projects. Existing codebases can continue but should plan migration.
- **Source:** [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md)

### npm Supply Chain Security Hygiene
- **What:** Use pnpm's strict dependency model. Enable npm provenance checking. Use Trusted Publishing (OIDC) for CI. Set minimum release age. Use lockfile-lint.
- **Why:** 2025 saw multiple major npm supply chain attacks (Shai-Hulud, self-replicating worm affecting 796 packages). pnpm 10 blocks lifecycle scripts by default.
- **When:** All projects. Prioritize for anything with user data.
- **Source:** [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md)

### Better Auth for New Projects
- **What:** Use Better Auth instead of Auth.js/NextAuth for new projects. TypeScript-first, framework-agnostic, built-in MFA/rate limiting, mature passkey support.
- **Why:** Auth.js team now maintained by Better Auth team, who recommend Better Auth for new projects. Auth.js passkey support still experimental.
- **When:** New projects needing authentication. Existing Auth.js projects: no urgent migration needed.
- **Source:** [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md)

## Revision History
- 2026-02-13: Initial extraction from [research/2026-02-13-frontend-engineering-practices.md](../research/2026-02-13-frontend-engineering-practices.md).
- 2026-02-14: Added 6 new principles (security patching, server action security, CSS anchor positioning, no runtime CSS-in-JS, npm supply chain hygiene, Better Auth) from [research/2026-02-14-frontend-engineering-update.md](../research/2026-02-14-frontend-engineering-update.md).

# Accessibility Principles

## Summary
Practical accessibility guidance for React/Next.js web applications. Covers WCAG 2.2 compliance, semantic HTML, ARIA patterns, keyboard navigation, automated testing, screen reader testing, component library selection, and design system accessibility contracts. Motivated by the EAA (enforceable June 2025), surging ADA litigation, and the fact that 94.8% of web pages have detectable WCAG failures.

## Principles

### Semantic HTML Before ARIA, Always
- **What:** Use native HTML elements (`<button>`, `<a>`, `<dialog>`, `<nav>`, `<input>`) before reaching for ARIA roles. The first rule of ARIA is "don't use ARIA" if a native element does the job.
- **Why:** Native elements have built-in keyboard handling, screen reader support, and form participation. Pages using ARIA have 34.2% more errors on average (WebAIM 2025). ARIA adds complexity and is frequently misused.
- **When:** Always start here. Use ARIA only for custom widgets with no native equivalent (combobox, tree view) or states HTML cannot express (aria-expanded, aria-live).
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Target WCAG 2.2 AA as the Compliance Baseline
- **What:** Build to WCAG 2.2 Level AA including new criteria: focus not obscured, 24px target size minimum, dragging alternatives, accessible authentication, redundant entry, consistent help.
- **Why:** AA is referenced by ADA, EAA (EN 301 549), and virtually every legal settlement. WCAG 2.2 is ISO/IEC 40500:2025. EAA enforceable since June 2025. ADA lawsuits up 37% in H1 2025. Retrofitting is 5-10x more expensive than building in.
- **When:** Every project, from the start. AAA criteria are aspirational targets for specific features, not whole-site requirements.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Use a Headless Accessible Component Library
- **What:** Build on Radix UI or React Aria rather than implementing ARIA patterns from scratch. Radix + shadcn/ui for rapid development. React Aria for the most rigorous accessibility coverage.
- **Why:** Composite ARIA widgets (combobox, dialog, tabs) are extraordinarily complex. They require specific keyboard interactions, focus management, and screen reader behavior across platforms. Library authors spend years on edge cases.
- **When:** Any interactive widget beyond basic buttons and links. Never hand-roll a combobox, modal, or tab panel.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Layer Automated Testing: Lint, Component, Page
- **What:** Three layers: (1) eslint-plugin-jsx-a11y for static analysis, (2) Storybook a11y addon for component checking, (3) @axe-core/playwright for page-level CI testing. Target WCAG 2.2 AA tags.
- **Why:** Each layer catches different issue categories. Together they cover ~57% of WCAG issues (Deque). The remaining 43% requires manual screen reader testing.
- **When:** From project inception. Lint on every save/commit. Storybook during development. Playwright on every PR. Full scan nightly. Never rely on automation alone.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Test with Real Screen Readers
- **What:** Test complete user flows with NVDA + Firefox/Chrome (Windows) and VoiceOver + Safari (macOS). Test heading navigation, landmark navigation, focus management, and live region announcements.
- **Why:** Automated tools cannot verify that the experience makes sense — that announcements are helpful, focus order is logical, or dynamic content is communicated. 43% of issues require manual testing.
- **When:** Before every major release. During development of new interactive components, forms, modals, and dynamic content.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Manage Focus Deliberately in SPAs
- **What:** On route changes, move focus to the main heading. On modal open, focus into modal and trap. On modal close, return to trigger. On form error, focus the first error. Never let focus get lost.
- **Why:** Client-side routing doesn't reset focus. Next.js announces routes but doesn't manage focus. Lost focus = lost users for keyboard and screen reader navigation.
- **When:** Every SPA route transition, modal open/close, form error, and dynamic content change requiring attention.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Never Remove Focus Indicators Without Replacing Them
- **What:** Never `outline: none` without a custom focus indicator. Use `:focus-visible` for keyboard-only indicators. Custom indicators: 2px+ thick, 3:1 contrast between focused/unfocused states.
- **Why:** Focus indicators are the keyboard user's cursor. WCAG 2.2 strengthened focus requirements (2.4.11 Focus Not Obscured at AA). Ensure sticky headers and cookie banners don't cover focused elements.
- **When:** Always. Replace default outlines with `:focus-visible` styling if the default conflicts with design. Never remove entirely.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Respect Motion Preferences
- **What:** Wrap all animations in `prefers-reduced-motion`. Remove parallax/scaling/panning entirely. Replace other animations with fades or instant transitions. Provide pause controls for animations >5s.
- **Why:** 35%+ of adults over 40 have experienced vestibular dysfunction. Parallax and large-scale motion cause vertigo, nausea, and migraines. This is a medical need, not a preference.
- **When:** Every animation, transition, and scroll effect. Test with Chrome DevTools motion emulation.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Size Touch Targets for Fingers, Not Mice
- **What:** 44x44 CSS pixels minimum for interactive targets. WCAG 2.5.8 floor is 24x24px, but research shows 3x error rates below 44px. Primary mobile actions: 48x48px.
- **Why:** WCAG 2.5.8 Target Size (Minimum) is a new Level AA requirement in 2.2 — now legally required under ADA, Section 508, and EAA. The 24px minimum is a legal floor, not a design target.
- **When:** All interactive elements on responsive layouts. Close buttons, icon buttons, form inputs, links in dense lists, pagination.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Every Input Needs a Visible, Associated Label
- **What:** Every `<input>` must have a `<label>` with matching htmlFor/id. Label must be visible. Placeholder is NOT a label. Errors linked via aria-describedby + aria-invalid="true".
- **Why:** Missing labels affect 48.6% of sites (WebAIM 2025). Screen readers can't identify unlabeled inputs. Visible labels help sighted users too, especially on mobile where placeholders vanish on focus.
- **When:** Every form field, no exceptions. Use aria-label only when visible labels are genuinely impossible (search with icon).
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Define Accessibility Contracts for Components
- **What:** Every design system component documents: supported keyboard interactions, focus behavior, ARIA attributes, labeling requirements the consumer must provide, expected screen reader announcements.
- **Why:** Accessibility breaks at integration boundaries. A perfectly accessible component becomes inaccessible if the consumer forgets aria-label or focus management. Explicit contracts make requirements visible and testable.
- **When:** Every component in a shared design system. Document in Storybook with a keyboard interaction table.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

### Overlays Are Not Accessibility Solutions
- **What:** Never use accessibility overlay widgets (accessiBe, UserWay, AudioEye). They don't work, increase lawsuit risk, and are actively harmful.
- **Why:** 25% of 2024 ADA lawsuits cited overlays as barriers. FTC fined accessiBe $1M (Jan 2025). Overlays can't fix structural problems (missing semantics, broken focus, absent alt text). They add bloat and break existing accessible patterns.
- **When:** Never. If stakeholders suggest one, cite litigation data and FTC enforcement. The only path is building accessibility into the product.
- **Source:** [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-accessibility.md](../research/2026-02-14-accessibility.md).

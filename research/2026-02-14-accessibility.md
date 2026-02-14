---
date: 2026-02-14
topic: Accessibility for Web Applications
status: complete
tags: [accessibility, wcag, aria, screen-reader, keyboard-navigation, a11y-testing, react-aria, radix]
related: [2026-02-13-frontend-engineering-practices.md, 2026-02-14-frontend-engineering-update.md]
---

# Accessibility for Web Applications

## Context

Accessibility was identified as a complete gap in the principles knowledge bank. With the European Accessibility Act enforceable since June 2025, ADA website lawsuits surging 37% in H1 2025, and WCAG 2.2 now an ISO standard, accessibility is both a legal requirement and an ethical obligation. This research covers WCAG 2.2 compliance, legal landscape, semantic HTML, ARIA patterns, keyboard navigation, color/contrast, screen reader testing, automated testing, React-specific patterns, common mistakes, mobile accessibility, animations, and design system accessibility contracts.

Key sources: W3C WAI, MDN Web Docs, web.dev, WebAIM Million 2025, Deque, Smashing Magazine, W3C APG, Playwright docs, React Aria docs, Radix UI docs, Next.js docs, UsableNet litigation reports.

## Findings

### 1. WCAG 2.2 Compliance Levels

**Level A** (minimum): Basic features. Failure makes content fundamentally inaccessible. Examples: text alternatives for images (1.1.1), keyboard operability (2.1.1).

**Level AA** (standard target): The legally referenced level. ADA, EAA, and Section 508 all reference AA. Covers contrast, resize, navigation consistency.

**Level AAA** (enhanced): Aspirational. Not typically required by law. Useful as a goal for specific critical features.

**New in WCAG 2.2 (October 2023, updated December 2024):**

Key Level AA criteria:
- **2.4.11 Focus Not Obscured** — Focused elements must not be hidden by sticky headers, cookie banners, or overlays.
- **2.5.7 Dragging Movements** — Any drag functionality must have a single-pointer alternative.
- **2.5.8 Target Size (Minimum)** — Interactive targets at least 24x24 CSS pixels, or 24px spacing from adjacent targets.
- **3.3.8 Accessible Authentication** — No cognitive function test required for auth unless alternative available (copy-paste, password managers, biometrics).

Removed: 4.1.1 Parsing is now obsolete (HTML5 specifies consistent handling of malformed markup).

WCAG 2.2 is now ISO/IEC 40500:2025.

Source: [W3C WAI - What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

### 2. Legal Requirements

**ADA:** DOJ April 2024 rule establishes WCAG 2.1 AA for government sites (deadlines: April 2026/2027). Private sector: courts treat WCAG 2.1 AA as the standard. H1 2025: 2,014 lawsuits (37% increase). 25% of 2024 lawsuits cited overlay widgets as barriers. FTC fined accessiBe $1M (Jan 2025). 41% of federal filings target companies already sued before.

**EAA:** Enforceable June 28, 2025 in all EU states. References EN 301 549 (WCAG 2.1 AA). Applies to any business serving EU consumers. Penalties up to 500,000 euros. Exempt: companies <10 employees.

**Section 508:** US federal agencies. References WCAG 2.0 AA (refresh pending).

Sources: [UsableNet 2025 Midyear](https://blog.usablenet.com/2025-midyear-accessibility-lawsuit-report-key-legal-trends), [Accessibility.works 2024](https://www.accessibility.works/blog/ada-lawsuit-trends-statistics-2024-summary/), [European Commission EAA](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)

### 3. Semantic HTML

The First Rule of ARIA (W3C): "If you can use a native HTML element with the semantics and behavior you require already built in, do so."

Pages using ARIA average 34.2% more detected errors than those without (WebAIM Million 2025).

**Practical mapping:**
- `<button>` over `<div role="button" tabindex="0">`
- `<a href>` over `<span role="link" onclick>`
- `<dialog>` over `<div role="dialog">`
- `<details>`/`<summary>` over custom accordions
- `<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>` over div+role equivalents

**When ARIA IS needed:** Custom composite widgets (combobox, tree view), live region announcements, relationships (aria-describedby, aria-labelledby), states that HTML cannot express (aria-expanded, aria-selected).

Sources: [MDN ARIA Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA), [web.dev ARIA and HTML](https://web.dev/learn/accessibility/aria-html), [WebAIM Million 2025](https://webaim.org/projects/million/)

### 4. ARIA Patterns

**Landmark Roles:** banner, navigation, main, complementary, contentinfo, search, form, region. If multiple of same type, each needs aria-label/labelledby. Don't include role in label ("Primary", not "Primary Navigation"). Keep under 8 landmarks.

**Live Regions:** `aria-live="polite"` (waits for pause — status, success). `aria-live="assertive"` (interrupts — errors, critical). Place containers in DOM at load, populate via JS.

**Dialog/Modal:** role="dialog" + aria-modal="true" + aria-labelledby. Focus into dialog on open. Trap tab order. Escape to close. Return focus to trigger on close. Use `inert` on background. Prefer native `<dialog>` with `.showModal()`.

**Combobox:** Most complex ARIA pattern. Use React Aria's `useComboBox` or Radix — don't build from scratch.

**Tab Panels:** tablist/tab/tabpanel roles. Arrow keys between tabs, Tab into panel. aria-selected on active tab.

Sources: [W3C APG Landmarks](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), [W3C APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [MDN ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)

### 5. Keyboard Navigation

**Tab Order:** Natural DOM order. Avoid tabindex > 0. Only interactive elements in tab order. tabindex="0" = focusable, tabindex="-1" = programmatically focusable only.

**Roving Tabindex:** For composite widgets (tabs, toolbars, menus). One item has tabindex="0", rest have tabindex="-1". Arrow keys move focus.

**Focus Trapping:** Modals must trap Tab/Shift+Tab. Use focus-trap-react or native `<dialog>`.showModal(). On open: focus first element. On close: return to trigger.

**Skip Links:** Visually hidden link at top, visible on focus: "Skip to main content". Critical for keyboard users.

**SPA Focus Management:** Route changes don't reset focus. Next.js has a route announcer but doesn't manage focus. Move focus to `<h1>` on route change.

Sources: [W3C APG Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [MDN Keyboard-navigable Widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets), [Next.js Accessibility](https://nextjs.org/docs/architecture/accessibility)

### 6. Color and Contrast

**WCAG Requirements:**
- 4.5:1 — normal text (AA)
- 3:1 — large text, UI components (AA)
- 7:1 — normal text (AAA)

**The #1 problem:** Low contrast text on 79.1% of pages (WebAIM 2025). Average 29.6 instances per page.

**Tools:** WebAIM Contrast Checker, Chrome DevTools color picker, axe DevTools extension.

**Common mistakes:** Light gray placeholders, color-only meaning (red/green), disabled state too low contrast.

Source: [WebAIM Million 2025](https://webaim.org/projects/million/)

### 7. Screen Reader Testing

**Test with:** NVDA + Firefox/Chrome (Windows, ~66% users), VoiceOver + Safari (macOS/iOS, ~44% users). At minimum both.

**Testing workflow:**
1. Tab through entire page — focus order logical?
2. Heading navigation (H key) — hierarchy correct?
3. Landmark navigation (D key) — structure clear?
4. Complete full user flows
5. Verify live regions announce dynamic changes
6. Verify modals trap focus

**Key fact:** Automated tools catch ~57% of WCAG issues (Deque). Remaining 43% requires manual testing.

Source: [Deque Automated Coverage Report](https://www.deque.com/automated-accessibility-coverage-report/)

### 8. Automated Accessibility Testing

**Three-layer stack:**

1. **eslint-plugin-jsx-a11y** — Static analysis at write-time. Catches missing alt, labels, incorrect roles.
2. **@axe-core/playwright** — Runtime in E2E tests. Target specific levels: `.withTags(['wcag2aa', 'wcag22aa'])`.
3. **Storybook a11y addon** — Component-level during development. Every story scanned with axe-core.

**CI integration:** Lint in pre-commit + CI. Storybook checks during development. Playwright a11y on every PR. Full WCAG scan nightly.

Sources: [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing), [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)

### 9. React-Specific Accessibility

**Accessible component libraries:**
- **Radix UI** — 32+ unstyled primitives, full WAI-ARIA. Powers shadcn/ui. Best DX.
- **React Aria** (Adobe) — Hooks-based, most rigorous a11y implementation. Handles edge cases others miss (mobile screen readers, virtual cursor).
- **Headless UI** (Tailwind Labs) — Smaller set, Tailwind-integrated.

**Selection:** React Aria for strictest a11y. Radix + shadcn/ui for rapid development with good defaults.

**Focus management:** useRef + useEffect for programmatic focus. focus-trap-react for modals.

**Accessible forms:** Every input needs visible `<label>` with htmlFor/id. Placeholder is NOT a label. Errors linked via aria-describedby + aria-invalid="true". Validate on submit initially, on change for corrections.

Sources: [React Aria](https://react-spectrum.adobe.com/react-aria/), [Radix UI](https://www.radix-ui.com/), [Smashing Magazine Forms](https://www.smashingmagazine.com/2023/02/guide-accessible-form-validation/)

### 10. Common Accessibility Mistakes (WebAIM 2025)

1. Low contrast text — 79.1% of pages
2. Missing alt text — 54.5%
3. Missing form labels — 48.6%
4. Empty links — 44.6%
5. Empty buttons — common and increasing
6. Missing document language

Other: outline:none without replacement, keyboard traps, auto-playing media, div/span instead of button/a, color-only state, heading hierarchy gaps.

### 11. Mobile Accessibility

**Touch targets:** WCAG 2.5.8 minimum 24x24px. Research shows 3x error rates below 44px. Target 44px minimum, 48px for primary actions on touch.

**Zoom:** Must work at 200% (AA) and 400%/320px width (AA). Never use user-scalable=no.

**Orientation:** Must not lock to single orientation (AA) unless essential.

### 12. Accessible Animations

**prefers-reduced-motion:** Wrap all animations. Remove parallax/scaling/panning entirely when reduced. Replace with fades/instant transitions.

**Rules:** Pausable animations >5s. No flashing >3 times/second. Over 35% of adults 40+ have experienced vestibular dysfunction.

**Testing:** Chrome DevTools > Rendering > emulate prefers-reduced-motion.

### 13. Design System Accessibility

**A11y contracts per component:** keyboard interactions, focus behavior, ARIA attributes, labeling requirements consumer must provide, screen reader announcements.

**Native features to leverage:** `<dialog>` with .showModal(), `inert` attribute, `popover` attribute (Baseline Jan 2025).

## Open Questions

1. **WCAG 3.0 timeline:** W3C is developing WCAG 3.0 with a new conformance model (bronze/silver/gold replacing A/AA/AAA). Timeline unclear — 2027-2028 earliest. Monitor but don't wait for it.
2. **AI-powered accessibility testing:** Tools like Deque's axe AI are adding LLM-based testing. How much of the manual 43% can these cover?
3. **React Server Components a11y:** How do RSC patterns interact with client-side focus management? Any new patterns needed?
4. **Mobile screen reader testing automation:** Can Playwright/Appium automate VoiceOver/TalkBack testing?

## Extracted Principles

12 principles extracted to [principles/accessibility.md](../principles/accessibility.md):

1. Semantic HTML Before ARIA
2. Target WCAG 2.2 AA
3. Use Headless Accessible Component Library
4. Layer Automated Testing
5. Test with Real Screen Readers
6. Manage Focus in SPAs
7. Never Remove Focus Indicators
8. Respect prefers-reduced-motion
9. Size Touch Targets for Fingers
10. Every Input Needs a Visible Label
11. Define Accessibility Contracts
12. Overlays Are Not Solutions

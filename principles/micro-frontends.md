# Micro-Frontends

## Summary
Micro-frontends are an organizational scaling tool, not a default frontend architecture. Use them when multiple teams need independent delivery inside a shared product surface, and back that autonomy with a platform layer that owns runtime composition, contracts, governance, and shared dependencies.

## Principles

### Use Micro-Frontends to Solve Organizational Scaling
- **What:** Adopt micro-frontends only when multi-team delivery, gradual legacy migration, or cross-product composition is the real bottleneck.
- **Why:** Their main benefit is team autonomy and independent release cadence. Their main cost is operational and governance complexity.
- **When:** Large product suites, strangler migrations, and organizations with multiple teams shipping into one UX surface.
- **When NOT:** Single-team apps, small products, or codebases where a modular monolith still gives enough autonomy.
- **Source:** [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md)

### Prefer Runtime Composition When Independent Deploys Matter
- **What:** Prefer runtime composition through import maps, SystemJS, or an equivalent runtime control plane over build-time package aggregation when independent deployment is a core requirement.
- **Why:** Build-time integration reintroduces lockstep release coupling. Runtime composition preserves team autonomy and supports versioned artifact rollout and rollback.
- **When:** Multi-repo, multi-team frontend platforms where widgets must ship independently.
- **When NOT:** Intentionally lockstep systems, or webpack-standardized organizations where Module Federation provides sufficient autonomy at lower platform cost.
- **Source:** [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md)

### Keep the Shell Thin and Platform-Owned
- **What:** Centralize routing, auth, layout, logging, i18n, analytics, dependency loading, and quality controls in a platform-owned shell and server layer. Keep business logic inside widgets.
- **Why:** This gives teams shared infrastructure without re-centralizing feature ownership.
- **When:** Any micro-frontend architecture with a platform team and multiple product teams.
- **When NOT:** Cases where the shell becomes a feature-heavy parent app that forces teams to change together.
- **Source:** [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md)

### Share Only Stable, High-Leverage Dependencies
- **What:** Externalize and share only heavyweight, stable dependencies and utility modules with mature contracts. Duplicate smaller or fast-moving libraries when that preserves team autonomy.
- **Why:** Sharing everything creates coordinated upgrades and version lockstep. Sharing nothing can bloat payloads and waste bandwidth.
- **When:** Shared frameworks like React, design-system foundations, auth helpers, and other mature common infrastructure.
- **When NOT:** Small or experimental dependencies that teams need to upgrade independently.
- **Source:** [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md)

### Make Contracts Explicit, Avoid Shared Global State
- **What:** Let micro-frontends communicate through routes, explicit public imports, or events. Avoid shared global stores and shared domain models across independently deployed frontends.
- **Why:** Shared state erodes autonomy, makes upgrades coordinated, and hides coupling in places that are hard to test.
- **When:** All micro-frontend systems.
- **When NOT:** Only in tightly coupled sub-features that are better modeled as one application instead of multiple micro-frontends.
- **Source:** [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md)

### Optimize Local Dev for One Widget, Test in an Integrated Environment
- **What:** Let developers run a single widget locally against deployed versions of the rest, but require preview or staging validation in a production-like shell with contract and smoke tests.
- **Why:** Single-widget dev keeps iteration fast, while integrated testing catches environment drift, route contract breakage, and runtime-composition issues.
- **When:** Any runtime-composed micro-frontend platform.
- **When NOT:** Never skip integrated validation if the production container differs from local standalone mode.
- **Source:** [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md)

## Revision History
- 2026-04-06: Initial extraction from [research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md](../research/2026-04-06-research-this-https-www-docusign-com-blog-developers-innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework.md).

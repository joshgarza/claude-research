# Hexagonal Architecture

## Summary
Hexagonal architecture is useful when a codebase has meaningful domain behavior, multiple or changing edges, and a real need to test core logic without infrastructure. The pattern is not "add interfaces everywhere." The core value is an application core that speaks domain language, depends on no external technology, and is surrounded by replaceable adapters whose dependency direction points inward.

## Principles

### Use Hexagonal Architecture Only When The Edges Are Likely To Change
- **What:** Apply hexagonal architecture when the same business capability must survive UI, database, API, or messaging changes, or when the same core logic must serve multiple entry points.
- **Why:** The architecture adds interfaces, adapters, tests, and wiring. That cost is justified by replaceability and testability, not by aesthetics.
- **When:** Domain-heavy services, modernization work, multi-channel applications, or systems with credible infrastructure churn. Not for thin single-path CRUD where a simple modular layer split is enough.
- **Source:** [research/2026-03-14-look-into-hexagonal-architecture.md](../research/2026-03-14-look-into-hexagonal-architecture.md)

### Define Ports In Application Language, Not Technology Language
- **What:** Ports should describe business conversations such as `Orders.save` or `Payments.charge`, not SQL statements, HTTP payload plumbing, or SDK-specific operations.
- **Why:** A technology-shaped port is only weak conformance to the pattern. It keeps the same dependency direction on paper while still leaking external technology into the core.
- **When:** Every port definition at the application boundary. Not applicable only when there is no meaningful core and the code is intentionally just infrastructure glue.
- **Source:** [research/2026-03-14-look-into-hexagonal-architecture.md](../research/2026-03-14-look-into-hexagonal-architecture.md)

### Keep Adapters Pointing Inward, Never Sideways
- **What:** Entry points and outbound integrations may depend on the core, but adapters should not become a second application layer that imports one another arbitrarily.
- **Why:** Adapter-to-adapter coupling recreates the same entanglement the pattern is supposed to remove. Once edge code starts coordinating business behavior directly, the core stops being the true center of the system.
- **When:** Package boundaries, code review, and architecture tests. Not relevant for tiny scripts with no stable boundary at all.
- **Source:** [research/2026-03-14-look-into-hexagonal-architecture.md](../research/2026-03-14-look-into-hexagonal-architecture.md)

### Test The Core Before You Build The Real Adapters
- **What:** Write fast tests against domain and use-case code with doubles for ports, then add integration tests for adapters and a thin end-to-end layer through primary adapters.
- **Why:** Fast isolated tests are the main operational payoff of hexagonal architecture. If most tests still run through HTTP or a real database, the abstraction cost is being paid without the benefit.
- **When:** Any ports-and-adapters implementation, especially when adopting TDD or refactoring legacy systems behind new seams.
- **Source:** [research/2026-03-14-look-into-hexagonal-architecture.md](../research/2026-03-14-look-into-hexagonal-architecture.md)

### Enforce Architectural Boundaries With Tooling
- **What:** Encode dependency rules in architecture tests or lint rules instead of relying on diagrams or reviewer memory.
- **Why:** Boundary erosion is gradual and predictable. The codebase needs executable checks so urgency does not silently reintroduce framework and infrastructure dependencies into the core.
- **When:** Medium and large codebases, or any team with more than one active contributor. Optional for throwaway prototypes, but add it before the structure starts to drift.
- **Source:** [research/2026-03-14-look-into-hexagonal-architecture.md](../research/2026-03-14-look-into-hexagonal-architecture.md)

## Revision History
- 2026-03-14: Initial extraction from [research/2026-03-14-look-into-hexagonal-architecture.md](../research/2026-03-14-look-into-hexagonal-architecture.md).

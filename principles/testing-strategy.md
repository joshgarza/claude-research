# Testing Strategy Principles

## Summary
Opinionated testing strategy for TypeScript/Node.js full-stack projects. Follows the Testing Trophy model (integration-heavy), uses Vitest as the standard runner, and covers unit, integration, E2E, contract, load, component, and AI/LLM testing. Synthesized from Kent C. Dodds, Martin Fowler, Playwright docs, Vitest docs, and Anthropic engineering guides.

## Principles

### Testing Trophy Distribution
- **What:** Invest ~60% in integration tests, ~20% unit, ~15% E2E, ~5% manual. Static analysis (TypeScript strict + ESLint + Zod) is the foundation layer — not optional.
- **Why:** Integration tests provide the best confidence-to-cost ratio. They test behavior as users experience it without being as slow or brittle as E2E. "Write tests. Not too many. Mostly integration."
- **When:** Every project. Don't debate percentages — focus on tests that are fast, reliable, expressive, and only fail for useful reasons.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Use Vitest
- **What:** Vitest over Jest for all TypeScript projects. Native ESM, Vite pipeline, Jest-compatible API, parallel by default. Co-locate test files. Use `@vitest/coverage-v8` with 80% threshold and `thresholds.autoUpdate` for auto-ratcheting.
- **Why:** Community consensus in 2026. Faster than Jest, handles ES modules natively, no Babel configuration.
- **When:** Every new TypeScript project. Migrate existing Jest suites incrementally (API is compatible).
- **When NOT:** Only if locked into a Jest-specific ecosystem with no migration path.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Test Behavior, Not Implementation
- **What:** Query components by role/text/label, not CSS selectors. Mock network boundaries, not internal modules. Use `vi.spyOn()` over `vi.mock()`. If a refactor doesn't change user-visible behavior, tests shouldn't break.
- **Why:** Implementation-detail tests are the #1 cause of test maintenance burden. They break on every refactor and give false confidence.
- **When:** All component and integration tests. Kent C. Dodds' Testing Library enforces this by design.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Use Testcontainers for Database Tests
- **What:** Run real Postgres/MySQL in Docker via Testcontainers for integration tests. One container per test file, real migrations, truncate between tests. Never substitute SQLite for Postgres in tests.
- **Why:** SQLite behaves differently than Postgres (types, constraints, JSON, extensions). Testing against a different engine than production is testing a fiction.
- **When:** Any project with database queries. Requires Docker in CI (GitHub Actions supports this natively).
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Schema-Based Contracts Over Pact
- **What:** For TypeScript-first projects, use Zod schemas to generate OpenAPI specs and diff them in CI to detect breaking changes. Use Pact only when teams are separate or backend is polyglot.
- **Why:** Leverages existing Zod investment. No separate contract testing tool needed. tRPC and Hono RPC monorepos don't need contract testing at all — TypeScript IS the contract.
- **When:** Separate frontend/backend repos, public APIs. Skip for tRPC/Hono RPC monorepos.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### E2E Only Critical Paths
- **What:** Playwright for critical user journeys only — signup, login, checkout, payment, OAuth flows. Use role locators, auto-waiting, Page Object Model. Run against preview deploys in CI.
- **Why:** E2E tests are slow and brittle relative to integration tests. Reserve them for flows that cross page boundaries or involve third-party integrations.
- **When:** Any project with user-facing flows. Keep to 5-15% of total test count.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Load Test Before Launch
- **What:** k6 for load testing. Smoke tests (1-5 VUs) on every deploy. Load tests on release branches. Measure p95/p99, not averages. Set k6 thresholds to fail CI pipelines.
- **Why:** Averages hide tail latency. A 200ms average with 2s p99 means 1% of users wait 10x longer. Load testing before launch prevents discovering capacity limits in production.
- **When:** Before any launch with expected traffic. Smoke tests from day one, full load tests before milestones.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Factories Over Fixtures
- **What:** Use Fishery for TypeScript test data factories. Build objects with sensible defaults, override only what the test cares about. Each test creates its own data. Never share test data between tests.
- **Why:** Static fixtures lead to shared-state bugs and brittle tests. Factories produce unique, valid data per test with minimal boilerplate.
- **When:** All tests that need data. Use Faker for generation, not for assertions.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Avoid Large Snapshots
- **What:** Use inline snapshots (`toMatchInlineSnapshot`) for small values only (<20 lines). Never snapshot component DOM trees. Use property-based testing (fast-check) for roundtrips, parsers, and invariants instead of snapshots.
- **Why:** Large snapshots become "approve and move on" — nobody reviews 200-line diffs. They test nothing meaningful and create maintenance burden.
- **When:** Small serialized values (API shapes, config objects, error messages). Property-based testing for any function with clear invariants.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Three-Layer AI Testing
- **What:** Layer 1: Deterministic mocks (`MockLanguageModelV1`) for surrounding logic. Layer 2: Eval-based tests (Promptfoo, LLM-as-judge) for output quality. Layer 3: End-to-end agent tests for trajectory and task completion. Run evals in CI on every prompt/model change.
- **Why:** LLM outputs are non-deterministic. Unit tests can't assess quality. Evals bridge the gap between "code works" and "output is good."
- **When:** Any project with LLM integrations. Start with Layer 1 immediately, add Layer 2 as quality matters, Layer 3 for agents.
- **Source:** [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md)

### Seed Your PRNG for Reproducible Randomized Tests

- **What:** Any randomized test (fuzz test, property test, chaos scenario) must: (1) seed a PRNG at the start, (2) route all random decisions through that PRNG, (3) log the seed on failure. Never use `Math.random()` or `crypto.randomBytes()` inside a test scenario — use the seeded PRNG.
- **Why:** Seed-based reproducibility transforms "I can't reproduce it" into "run it again with seed X." This is the minimum viable version of deterministic fault injection — low cost, high value.
- **When:** Any test involving randomness: property-based tests, randomized workload generators, fault injection. Applies in TypeScript (`fast-check` manages seeds automatically), Rust, Go, etc.
- **When NOT:** Pure unit tests with no randomness don't need this.
- **Source:** [research/2026-02-24-determinisitic-fault-injection.md](../research/2026-02-24-determinisitic-fault-injection.md)

### Deterministic Fault Injection for Reliability-Critical Systems

- **What:** For systems with durability or consistency guarantees, inject faults deterministically via: (a) a simulated VFS/network layer controlled by a seeded PRNG, (b) BUGGIFY-style production annotations that only fire in simulation, or (c) a deterministic hypervisor (Antithesis). Run millions of seeds in CI. Treat any failing seed as a blocker.
- **Why:** FoundationDB had ~1 production bug ever. Dropbox runs tens of millions of seeds nightly. WarpStream found a microsecond-wide data loss race in 1 hour that 10,000 hours of standard testing never caught. Combinatorial failures (network + disk + process crash simultaneously) are nearly impossible to exercise without simulation.
- **When:** Systems making durability/consistency guarantees — databases, financial ledgers, sync engines, distributed storage. Worth the investment when failure modes are combinatorial and user-visible correctness matters.
- **When NOT:** Stateless API layers, simple CRUD services with no durability semantics. Overkill when standard integration testing covers your failure modes.
- **Source:** [research/2026-02-24-determinisitic-fault-injection.md](../research/2026-02-24-determinisitic-fault-injection.md)

### Cooperative Fault Injection (BUGGIFY Pattern)

- **What:** Annotate production code with fault injection hooks that only fire in simulation (`if (BUGGIFY) { throw IOError() }`). Keep them in the production binary — they're dead code outside simulation. Per-run: each site is enabled or disabled once at start; enabled sites fire with 25% probability per evaluation. After N simulated seconds, reduce fault frequency to allow recovery.
- **Why:** Black-box fault injection can only target the system boundary. BUGGIFY targets specific code paths with calibrated probabilities, reaches code that external faults never exercise, and keeps fault injection code under the same review discipline as production code.
- **When:** Any system already investing in DST. Trivial to add to existing code. Start with wrapping rare error returns: `if (unlikely_condition || BUGGIFY) { handle_error(); }`.
- **Source:** [research/2026-02-24-determinisitic-fault-injection.md](../research/2026-02-24-determinisitic-fault-injection.md)

### Separate Safety and Liveness Testing

- **What:** Run two distinct simulation modes. Safety mode: inject faults uniformly at random, verify invariants are never violated (no data loss, no stale reads after acknowledged writes). Liveness mode: after establishing a fault scenario, freeze additional faults and verify the system eventually makes progress. These are different properties requiring different test designs.
- **Why:** Safety faults alone never reveal liveness bugs. TigerBeetle's liveness split found a resonance deadlock that 100% safety testing never surfaced — faults in safety mode would eventually "accidentally" resolve what the liveness mode held fixed.
- **When:** Distributed systems with consensus or replication. If you only test one, test safety first — data loss is worse than being slow.
- **Source:** [research/2026-02-24-determinisitic-fault-injection.md](../research/2026-02-24-determinisitic-fault-injection.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-testing-strategy.md](../research/2026-02-14-testing-strategy.md).
- 2026-02-24: Added 4 deterministic fault injection principles from [research/2026-02-24-determinisitic-fault-injection.md](../research/2026-02-24-determinisitic-fault-injection.md).

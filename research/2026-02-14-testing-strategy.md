---
date: 2026-02-14
topic: Testing Strategy for Full-Stack TypeScript
status: complete
tags: [testing, vitest, playwright, integration-testing, load-testing, tdd, test-strategy]
related: [2026-02-13-frontend-engineering-practices.md, 2026-02-14-ai-llm-integration-practices.md]
---

# Testing Strategy for Full-Stack TypeScript

## Context

Testing strategy is a critical gap when moving from demo to production. Without a coherent testing plan, teams either under-test (shipping bugs to production) or over-test (wasting engineering time on low-value tests that break on every refactor). This research synthesizes guidance from the highest-quality sources in the testing space to produce an opinionated, actionable strategy for TypeScript/Node.js full-stack projects.

Key sources:
- Kent C. Dodds (kentcdodds.com) — Testing Trophy, Testing Library philosophy
- Martin Fowler (martinfowler.com) — Practical Test Pyramid, test shapes
- Playwright official docs — E2E best practices
- Vitest official docs — unit/integration test runner
- Storybook docs — component testing with Vitest integration
- Anthropic engineering blog — AI agent evaluation
- Vercel AI SDK docs — LLM testing utilities
- k6/Grafana docs — load testing
- Pact docs — contract testing
- web.dev — testing strategy shapes (Google testing team)
- Testcontainers docs — database integration testing

## Findings

### 1. Testing Trophy over Testing Pyramid

The traditional testing pyramid (lots of unit tests, fewer integration, fewest E2E) is based on 2012-era assumptions about test speed and cost. Modern tooling has changed the economics.

**Kent C. Dodds' Testing Trophy** reframes the distribution:

```
     ___
    / E2E \        — Few: critical user journeys only
   /________\
  /Integration\    — Most: the bulk of your tests
 /______________\
 |  Unit Tests  |  — Some: pure logic, algorithms, utilities
 |______________|
  Static Analysis  — Foundation: TypeScript, ESLint, Zod
```

The core mantra: **"Write tests. Not too many. Mostly integration."**

The rationale is the **confidence coefficient** — integration tests provide the best ROI because they test behavior as users experience it, without being as slow or brittle as E2E tests. The more your tests resemble the way your software is used, the more confidence they give you.

**Martin Fowler's position** converges with this. In "On the Diverse and Fantastical Shapes of Testing" (2021), he argues that debating test percentages is a distraction. What matters: tests should be fast, reliable, expressive, have clear boundaries, and only fail for useful reasons. The proportions are much less important than those qualities.

**Practical distribution for a TypeScript full-stack project:**
- Static analysis (TypeScript strict mode + ESLint + Zod validation): foundation, not optional
- Unit tests: ~20% — pure functions, business logic, algorithms, utilities
- Integration tests: ~60% — API routes, database queries, multi-component behavior, service interactions
- E2E tests: ~15% — critical user journeys, signup/login/checkout/payment flows
- Manual/exploratory: ~5% — edge cases, UX feel, accessibility spot-checks

Source: [kentcdodds.com/blog/write-tests](https://kentcdodds.com/blog/write-tests), [kentcdodds.com/blog/the-testing-trophy-and-testing-classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications), [martinfowler.com/articles/2021-test-shapes.html](https://martinfowler.com/articles/2021-test-shapes.html)

### 2. Unit Testing Philosophy

**Use Vitest as the standard.** Vitest is the consensus TypeScript testing framework in 2026. It shares Vite's transformation pipeline, handles ES modules natively (no Babel), runs tests in parallel, and has a Jest-compatible API for easy migration.

Key setup decisions:
- **Co-locate tests:** `foo.ts` and `foo.test.ts` in the same directory. Improves discoverability.
- **Use `vitest.config.ts`** separate from `vite.config.ts` in monorepos. Use projects (formerly workspaces) for multi-package repos. Coverage is workspace-global.
- **Coverage:** Use `@vitest/coverage-v8` (faster than Istanbul). Set threshold to 80% for business logic packages, auto-ratchet with `thresholds.autoUpdate`.

**What to unit test:**
- Pure functions with complex logic
- Business rules and validation logic
- Data transformation/serialization
- State machines and reducers
- Utility functions with edge cases

**What NOT to unit test:**
- Simple getters/setters, trivial wrappers
- Framework-generated code (ORM models, route registrations)
- Implementation details (internal state, private methods)
- Things better covered by integration tests (API handlers, component rendering)

**Mocking philosophy (from Kent C. Dodds):**
- Mock as little as possible. Every mock is a point where your test diverges from reality.
- Never mock what you don't own — wrap third-party code and mock the wrapper.
- Mock network boundaries (HTTP calls), not internal modules.
- Use `vi.spyOn()` over `vi.mock()` when you can — spies preserve the real implementation.
- For HTTP mocking in TypeScript projects using `httpx`: use `respx` (not `responses`). For `fetch`: use MSW (Mock Service Worker).

Source: [vitest.dev/guide](https://vitest.dev/guide/), [kentcdodds.com/blog/testing-implementation-details](https://kentcdodds.com/blog/testing-implementation-details)

### 3. Integration Testing Patterns

Integration tests are the workhorse of the Testing Trophy. They test real interactions between components.

#### Database Integration Testing with Testcontainers

**Testcontainers for Node.js** provides throwaway Docker containers for real databases in tests. This is categorically better than in-memory SQLite substitutes because you test against the actual database engine (Postgres, MySQL, etc.).

Pattern:
```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  db = drizzle(container.getConnectionUri());
  await migrate(db, { migrationsFolder: './drizzle' });
}, 60_000); // containers need time to start

afterAll(async () => {
  await container.stop();
});

beforeEach(async () => {
  // Truncate or use savepoints for test isolation
  await db.execute(sql`TRUNCATE users CASCADE`);
});
```

Key practices:
- **Start container once per test file** (`beforeAll`), not per test. Container startup is 2-5 seconds.
- **Use real migrations** against the container — tests your migration scripts too.
- **Truncate between tests** for isolation. Transaction rollback is faster but can mask bugs.
- **Snapshot/restore** for complex seed states (Testcontainers >= 10.23.0 for Postgres).
- **CI consideration:** Docker must be available. GitHub Actions supports it natively. Use `services` in CI config or Testcontainers Cloud for remote containers.

Source: [node.testcontainers.org](https://node.testcontainers.org/), [nikolamilovic.com/posts/2025-4-15-integration-testing-node-vitest-testcontainers](https://nikolamilovic.com/posts/2025-4-15-integration-testing-node-vitest-testcontainers/)

#### API Route Integration Testing

For Hono/Fastify/Express APIs, test the actual HTTP layer:

```typescript
import { testClient } from 'hono/testing';
// or use supertest for Express/Fastify

it('creates a user and returns 201', async () => {
  const res = await testClient(app).api.users.$post({
    json: { name: 'Test User', email: 'test@example.com' }
  });
  expect(res.status).toBe(201);
  const user = await res.json();
  expect(user.id).toBeDefined();
});
```

- Test real request/response cycles, not handler functions directly
- Include auth middleware in tests (use test tokens/sessions)
- Test error paths: validation failures, 404s, auth failures, rate limits

### 4. Contract Testing for API Boundaries

For services that communicate over HTTP, contract testing prevents breaking changes at API boundaries.

#### When you need contract testing
- Separate frontend and backend teams/repos
- Microservices communicating over HTTP/messaging
- Public APIs consumed by third parties
- Any boundary where "it works on my machine" doesn't cut it

#### When you DON'T need it
- tRPC monorepo (TypeScript IS your contract — compile-time safety)
- Hono RPC (similar — built-in type safety)
- Single team owning both sides of the boundary

#### Approach 1: Schema-Based Contracts (Zod + OpenAPI)

For TypeScript-first projects, this is the pragmatic choice:

1. Define API contracts as Zod schemas
2. Generate OpenAPI specs from Zod (using `@asteasolutions/zod-to-openapi` or `zod-openapi`)
3. Diff OpenAPI specs in CI to detect breaking changes
4. Validate responses against Zod schemas in Playwright API tests

This approach leverages existing Zod investment and doesn't require a separate contract testing tool. Tim Deschryver's pattern of using Zod validation inside Playwright API tests is particularly elegant — you test the real API and validate the contract simultaneously.

#### Approach 2: Pact (Consumer-Driven Contracts)

Pact is the standard for consumer-driven contract testing when teams are separate:

- **Consumer** writes tests defining its expectations — generates a Pact contract file
- **Provider** verifies it can satisfy those expectations
- **Pact Broker** (or Pactflow) manages contract versions and compatibility

Pact-js v4+ has improved TypeScript support. Best for: polyglot backends, separate team ownership, strict API governance.

**Bi-directional contract testing** (Pactflow only, paid) allows either side to drive the contract. Better for teams adopting contract testing incrementally.

Source: [docs.pact.io](https://docs.pact.io/), [stevekinney.com/courses/full-stack-typescript/testing-zod-schema](https://stevekinney.com/courses/full-stack-typescript/testing-zod-schema), [timdeschryver.dev/blog/playwright-api-testing-with-zod](https://timdeschryver.dev/blog/playwright-api-testing-with-zod)

### 5. E2E Testing with Playwright

Already covered in frontend engineering principles (use Playwright over Cypress), but additional testing-specific guidance:

**Playwright best practices (from official docs):**
- **Test isolation:** Each test gets its own browser context. No shared state.
- **Use role locators:** `getByRole('button', { name: 'Submit' })` over CSS selectors. Mirrors how users/assistive tech perceive the page.
- **Auto-waiting:** Playwright waits for elements to be stable/visible/enabled automatically. Don't add manual waits.
- **Assertions on expected states:** `expect(locator).toBeVisible()` rather than checking DOM presence.
- **Page Object Model** for maintainability in large test suites.
- **Tracing + screenshots + video** for debugging CI failures.
- **Run against preview deploys** in CI for maximum confidence.

**What to E2E test:**
- Critical user journeys: signup, login, checkout, payment
- Cross-page flows that can't be covered by component tests
- Third-party integration flows (OAuth, payment providers)
- Accessibility flows (keyboard navigation through critical paths)

**What NOT to E2E test:**
- Individual component behavior (use component tests)
- API-only logic (use integration tests)
- Every permutation of a form (use component tests + unit tests for validation)

Source: [playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices)

### 6. Load and Performance Testing

**When to start:** After your API is stable enough that endpoints won't change weekly. Typically after the first real users or before a launch with expected traffic. Don't wait until production is on fire.

**k6 is the standard** for developer-centric load testing. Written in Go, scripts in JavaScript/TypeScript. Integrates with Grafana for dashboards.

**Test types (from k6 docs):**
- **Smoke test:** 1-5 VUs, verify the test script works (run on every deploy)
- **Load test:** Expected production traffic pattern (run weekly or on release branches)
- **Stress test:** 2-3x expected traffic (run before major launches)
- **Spike test:** Sudden traffic burst (run for event-driven features)
- **Soak test:** Sustained moderate traffic for hours (run monthly, find memory leaks)

**What to measure:**
- p95 and p99 response times (not averages — averages lie)
- Error rate under load
- Throughput (requests/second)
- Resource consumption (CPU, memory, connection pool saturation)

**CI integration:**
- Smoke tests: run on every deploy
- Load tests: run nightly or on release branches, not on every commit
- Set k6 thresholds to fail the pipeline: `http_req_duration: ['p(95)<500']`
- Export results to Grafana k6 Cloud or InfluxDB for historical comparison

**Artillery** is the alternative — YAML-based, good for teams that prefer configuration over code. k6 is better for teams that want programmatic control.

Source: [grafana.com/docs/k6/latest](https://grafana.com/docs/k6/latest/), [k6.io/our-beliefs](https://k6.io/our-beliefs/)

### 7. Test Data Management

**Use factories over fixtures.** Factories generate unique data per test; fixtures are static and lead to shared-state bugs.

**Fishery** is the TypeScript-first factory library (from thoughtbot, the factory_bot team):

```typescript
import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';

const userFactory = Factory.define<User>(({ sequence }) => ({
  id: sequence,
  name: faker.person.fullName(),
  email: faker.internet.email(),
  role: 'user',
  createdAt: new Date(),
}));

// Usage
const user = userFactory.build(); // in-memory object
const adminUser = userFactory.build({ role: 'admin' }); // override defaults
const users = userFactory.buildList(5); // batch
```

**Key patterns:**
- **Factories for unit/integration tests:** Build objects in memory with sensible defaults. Override only what matters for each test.
- **Database seeding for E2E tests:** Seed the database before test runs. Use Drizzle's `db.insert()` with factory-generated data.
- **Test isolation:** Each test creates its own data. Never depend on data from other tests.
- **Meaningful defaults:** Factory defaults should produce valid objects. Tests override only the fields relevant to the assertion.
- **Avoid `faker` in assertions:** Use `faker` for generation, not for expected values. Assert on overridden values or structural properties.

**Anti-patterns:**
- Shared test databases across parallel test runs (use per-test-file containers or transactions)
- Giant seed files that every test depends on (fragile, hard to reason about)
- Using production data in tests (PII risk, non-deterministic)

Source: [github.com/thoughtbot/fishery](https://github.com/thoughtbot/fishery)

### 8. Snapshot Testing and Property-Based Testing

#### Snapshot Testing — Use Sparingly

**When snapshots help:**
- Tracking serialized output of pure functions (API response shapes, config objects)
- Catching unintended changes to CLI output or error messages
- Small, focused snapshots (<20 lines)

**When snapshots hurt (most of the time):**
- Large component DOM snapshots — nobody reviews 200-line snapshot diffs
- Anything with dynamic values (timestamps, IDs) — constant false failures
- As a substitute for real assertions — "it renders" tells you nothing about correctness
- When developers routinely press `u` to update without reviewing

**Kent C. Dodds' guidance on effective snapshots:** Keep them small and focused. If a snapshot is more than a few dozen lines, it will suffer major maintenance issues. Use inline snapshots (`toMatchInlineSnapshot`) for small values.

#### Property-Based Testing with fast-check

Property-based testing generates hundreds of random inputs and verifies that properties (invariants) hold for all of them. **fast-check** is the TypeScript standard.

**When it helps:**
- Serialization/deserialization roundtrips (`parse(serialize(x)) === x`)
- Sorting algorithms, data structure operations
- Parsers and encoders (Zod schema validation)
- Any function with a clear mathematical invariant
- Discovering edge cases humans wouldn't think to test

**When it doesn't help:**
- UI component rendering
- Business logic with complex preconditions
- Code where the "property" is just restating the implementation

```typescript
import fc from 'fast-check';

test('JSON roundtrip preserves data', () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    })
  );
});
```

**Key feature: shrinking.** When fast-check finds a failing input, it automatically finds the smallest input that still fails — producing minimal reproducible examples.

Source: [fast-check.dev](https://fast-check.dev/), [kentcdodds.com/blog/effective-snapshot-testing](https://kentcdodds.com/blog/effective-snapshot-testing)

### 9. Testing React Server Components and Server Actions

RSC testing is a gap area in 2026. The tooling is catching up but not fully there.

**Current state:**
- **Async Server Components** are NOT natively supported by Vitest or React Testing Library. The `render()` function doesn't handle `async` components.
- **Workaround:** `render(await MyServerComponent())` — call the component as a function and await it before passing to render. Works for simple cases but breaks when components rely on Next.js-specific context (cookies, headers, route params).
- **Official recommendation:** Use E2E tests (Playwright) for async RSC. This is the highest-confidence approach.

**What you CAN unit test:**
- Synchronous Server Components (render normally with RTL)
- Server Actions (they're just async functions — test them directly)
- Data fetching functions used by Server Components (mock the fetch layer)
- Validation logic used in Server Actions (Zod schemas)

**What you SHOULD E2E test:**
- Full page renders with nested async RSC
- Server Action form submissions and their effects
- Cache invalidation after mutations (`revalidatePath`, `revalidateTag`)
- Error boundaries in server-rendered pages

**The RSC testing gap** is expected to close as React Testing Library adds native async component support (tracked in [github.com/testing-library/react-testing-library/issues/1209](https://github.com/testing-library/react-testing-library/issues/1209)).

Source: [nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest), [github.com/nickserv/rsc-testing](https://github.com/nickserv/rsc-testing)

### 10. Testing AI/LLM Integrations

Three layers of testing for AI features, from cheapest to most expensive:

#### Layer 1: Deterministic Tests (Unit)

Mock the LLM entirely. Test the surrounding logic:
- Input preprocessing (prompt construction, context assembly)
- Output parsing (structured output handling, error cases)
- Tool call routing and execution
- Retry logic and error handling

Vercel AI SDK provides `MockLanguageModelV1` for deterministic mocking:

```typescript
import { MockLanguageModelV1 } from 'ai/test';

const model = new MockLanguageModelV1({
  defaultObjectGenerationMode: 'json',
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    text: '{"sentiment": "positive", "confidence": 0.95}',
  }),
});
```

Use `simulateReadableStream` to test streaming responses without hitting real APIs.

#### Layer 2: Eval-Based Tests (Integration)

Use real LLM calls but with structured evaluation:
- **Assertion-based:** Check for presence/absence of specific content
- **LLM-as-judge:** Use a model to grade another model's output against a rubric
- **Semantic similarity:** Compare output embeddings to reference embeddings

Anthropic's framework from "Demystifying Evals for AI Agents" recommends:
- Start with evals early — don't wait for perfection
- Source tasks from real-world failures
- Define unambiguous success criteria
- Combine multiple grader types (deterministic + LLM-as-judge)
- Run evals in CI on every prompt/model change

Tools: **Promptfoo** (lightweight, YAML config, Anthropic uses it internally), **Braintrust** (experiment-driven), **DeepEval** (pytest-style).

#### Layer 3: End-to-End Agent Tests

For multi-step agents:
- **Trajectory matching:** Define expected tool-call sequences, verify agent follows them
- **Task completion:** Give agent a goal, verify it achieved it (regardless of path)
- **Safety/boundary testing:** Verify agent stays within defined guardrails

Key challenge: LLM responses are non-deterministic. Solutions:
- Set `temperature: 0` for evals (reduces but doesn't eliminate variance)
- Run each eval multiple times and assert pass rate (e.g., "passes 4/5 times")
- Use semantic assertions ("response discusses X") not exact string matching

Source: [anthropic.com/engineering/demystifying-evals-for-ai-agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [ai-sdk.dev/docs/ai-sdk-core/testing](https://ai-sdk.dev/docs/ai-sdk-core/testing), [xata.io/blog/llm-evals-with-vercel-ai-and-vitest](https://xata.io/blog/llm-evals-with-vercel-ai-and-vitest)

### 11. Component Testing with Storybook and Testing Library

**Storybook 9 + Vitest** is the current best approach for component testing:

- Storybook stories are automatically treated as Vitest tests via the `@storybook/addon-vitest` addon
- Stories define component states; play functions define interactions
- Tests run in Vitest's browser mode for real DOM rendering
- Three built-in test types: interaction tests, accessibility tests, visual tests

**Testing Library philosophy** (from Kent C. Dodds):
- "The more your tests resemble the way your software is used, the more confidence they can give you."
- Query by role (`getByRole`), text (`getByText`), or label (`getByLabelText`) — never by CSS class or test ID unless necessary
- Test behavior, not implementation details. If a refactor doesn't change behavior, tests shouldn't break.
- Use `userEvent` over `fireEvent` — `userEvent` simulates real browser behavior (focus, blur, keyboard events)

**Portable stories** allow reusing Storybook stories in Vitest tests outside of Storybook:

```typescript
import { composeStories } from '@storybook/react';
import * as stories from './Button.stories';

const { Primary, Loading, Disabled } = composeStories(stories);

test('primary button renders correctly', async () => {
  render(<Primary />);
  await Primary.play?.();
  expect(screen.getByRole('button')).toBeVisible();
});
```

Source: [storybook.js.org/blog/component-test-with-storybook-and-vitest](https://storybook.js.org/blog/component-test-with-storybook-and-vitest/), [storybook.js.org/docs/api/portable-stories/portable-stories-vitest](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest), [kentcdodds.com/blog/testing-implementation-details](https://kentcdodds.com/blog/testing-implementation-details)

## Open Questions

1. **RSC testing maturity:** When will React Testing Library natively support async Server Components? The current workarounds are brittle. This is the biggest gap in the TypeScript testing ecosystem.

2. **LLM eval standardization:** There's no consensus on eval frameworks yet. Promptfoo, Braintrust, DeepEval, LangSmith — all have different approaches. The ecosystem needs convergence.

3. **Visual regression testing at scale:** Chromatic (paid) vs Percy vs Playwright visual comparison vs Argos. This research didn't deep-dive visual testing — worth a follow-up.

4. **Mutation testing adoption:** Tools like Stryker can verify test quality by introducing bugs and checking if tests catch them. Powerful but slow. Worth investigating for critical business logic.

5. **Test parallelism strategies:** Vitest runs tests in parallel by default, but database tests with shared containers need careful isolation. Best patterns for parallelizing Testcontainers across test files are still emerging.

## Extracted Principles

10 principles extracted to [principles/testing-strategy.md](../principles/testing-strategy.md):

1. Testing Trophy Distribution
2. Use Vitest
3. Test Behavior, Not Implementation
4. Use Testcontainers for Database Tests
5. Schema-Based Contracts Over Pact
6. E2E Only Critical Paths
7. Load Test Before Launch
8. Factories Over Fixtures
9. Avoid Large Snapshots
10. Three-Layer AI Testing

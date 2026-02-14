# API Versioning & Evolution Principles

## Summary
API versioning, backwards compatibility, deprecation, OpenAPI documentation, SDK generation, and breaking change detection for TypeScript/Node.js APIs. Covers REST (URL path and header versioning), GraphQL (versionless evolution), tRPC (type-safe monorepo), Stripe's date-based model, deprecation headers (RFC 9745/8594), Zod-to-OpenAPI generation, SDK tools (openapi-typescript, Speakeasy, Stainless), CI-based breaking change detection (oasdiff, Optic), API lifecycle stages, rate limit headers, and API gateway routing.

## Principles

### Start With URL Path Versioning, Graduate to Header Versioning
- **What:** Use URL path versioning (`/v1/`) for new external APIs. If you reach the scale where many integrators need gradual migration, adopt Stripe-style header versioning with account pinning.
- **Why:** URL path versioning is universally understood, trivially implementable, and works with every HTTP tool. Header versioning provides superior migration ergonomics but adds complexity. Most APIs never need the sophistication of header-based versioning.
- **When:** Always for external APIs. For internal APIs in a monorepo with tRPC, you likely need no versioning at all -- TypeScript's type system handles contract safety at compile time.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Define Your Breaking Change Contract Explicitly and Upfront
- **What:** Document a clear, exhaustive list of what your API considers a breaking change vs. a non-breaking change. Publish this in your API documentation before your first release.
- **Why:** Without an explicit contract, every change becomes a negotiation. Google (AIP-180), Zalando, and Microsoft all publish their compatibility rules. Your API should too. This is the single most important thing you can do to prevent versioning pain.
- **When:** Before your API's first public release. Update the contract only when absolutely necessary, and with notice.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Clients Must Ignore Unknown Fields; Servers Must Never Remove Fields
- **What:** Apply Postel's Law asymmetrically: clients must tolerate unknown response fields (forward compatibility), and servers must never remove, rename, or change the type of existing response fields without a major version bump (backward compatibility).
- **Why:** This is the foundation of safe API evolution. If clients ignore unknown fields, you can add new response fields freely. If servers never remove fields, existing clients never break. These two rules together enable years of additive evolution without version bumps.
- **When:** Always, for every API. Enforce client-side tolerance in SDK generation; enforce server-side stability with CI tooling (oasdiff, Optic).
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Use Deprecation and Sunset Headers Together With Usage Monitoring
- **What:** When deprecating an endpoint, add the `Deprecation` header (RFC 9745) with the deprecation date and the `Sunset` header with the removal date. Monitor usage of deprecated endpoints per API key. Only remove after sunset date AND confirmed low/zero usage.
- **Why:** Headers provide machine-readable deprecation signals that SDKs and monitoring tools can consume automatically. Usage monitoring prevents you from breaking active integrations. The combination of both is far more reliable than email announcements alone.
- **When:** For any external API deprecation. Internal APIs can use simpler mechanisms (compiler warnings, Slack notifications) but should still have a defined deprecation period.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Generate Your OpenAPI Spec From Zod Schemas, Not the Reverse
- **What:** Define your API contract as Zod schemas (single source of truth for validation + types), generate OpenAPI specs from them using `zod-openapi`, and use the generated spec for documentation, SDK generation, and breaking change detection.
- **Why:** Zod schemas give you runtime validation, TypeScript types, AND OpenAPI documentation from one definition. If you start with an OpenAPI spec and generate code, you get documentation but lose the tight coupling between validation logic and types. The Zod-first approach keeps your contract living in code, not in a YAML file that drifts.
- **When:** For TypeScript/Node.js APIs where you control the server. If you're consuming an external API, go the other direction (OpenAPI spec -> types via `openapi-typescript`).
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Run Breaking Change Detection in CI on Every PR
- **What:** Generate your OpenAPI spec in CI, diff it against the main branch spec using `oasdiff` or Optic, and block PRs that introduce unacknowledged breaking changes. Spectral alone is insufficient -- it only lints a single spec, it cannot detect breaking changes.
- **Why:** Breaking changes caught in a PR are cheap to fix. Breaking changes caught in production are expensive. Automated diffing catches changes that humans miss: subtle type changes, removed optional fields, tightened validation.
- **When:** As soon as you have an OpenAPI spec (which should be from day one if you follow Principle 5). This is non-negotiable for any API with external consumers.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Use Stability Stages for New API Features
- **What:** Adopt Google's Alpha/Beta/Stable lifecycle for API features. Alpha features can break at any time (opt-in only). Beta features are complete but need 90 days of bake time. Stable features have full backward compatibility guarantees. Communicate the stage clearly in documentation and optionally in response headers.
- **Why:** Not all API features are equally mature. Shipping everything as "stable" forces you into premature compatibility commitments. Shipping everything as "experimental" erodes trust. Explicit stages set clear expectations with consumers.
- **When:** For APIs with ongoing feature development. Not needed for small, static APIs that ship as complete.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Prefer Scalar Over Swagger UI for New Projects
- **What:** Use [Scalar](https://github.com/scalar/scalar) for API documentation hosting. It provides interactive "try it out" functionality, modern UI, integrated API client, and is now Microsoft's default for .NET 9. Fall back to Redocly for polished, read-only public documentation.
- **Why:** Swagger UI is mature but aging. Scalar provides the same functionality with better UX, better code-first integration (Express, Fastify, etc.), and active development. It's open-source with an enterprise tier when needed.
- **When:** For new projects. Don't migrate existing Swagger UI setups unless there's a specific pain point.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Use openapi-typescript for Internal Consumption, Speakeasy/Stainless for External SDKs
- **What:** For internal TypeScript consumers of your API, generate types with `openapi-typescript` + `openapi-fetch` (zero runtime, ~6kb client). For external consumers who need production-grade SDKs with retries, pagination, and error handling, use Speakeasy or Stainless to generate full SDKs.
- **Why:** Internal consumers don't need the overhead of a full SDK -- types and a thin fetch wrapper are sufficient and keep dependencies minimal. External consumers need a polished experience with retry logic, streaming support, and idiomatic error handling that generated SDKs provide.
- **When:** Internal: always. External SDKs: when you have paying API consumers or when API adoption is a business goal. Stainless if SDK quality is a competitive differentiator (used by Anthropic, OpenAI). Speakeasy for broader language support and MCP server generation.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Adopt the IETF RateLimit Headers for New APIs
- **What:** Use the emerging `RateLimit-Policy` and `RateLimit` headers (IETF draft-ietf-httpapi-ratelimit-headers) instead of the legacy `X-RateLimit-*` headers. Always return `429` with `Retry-After` when limits are exceeded.
- **Why:** The legacy `X-RateLimit-*` headers have no standard -- every API implements them differently (unix timestamps vs. seconds, different header names). The IETF draft standardizes the format and is already being adopted by Cloudflare and Atlassian. Starting with the standard format avoids a migration later.
- **When:** For new external APIs. Existing APIs with established `X-RateLimit-*` headers should continue supporting them but can add the new headers in parallel.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### GraphQL APIs Should Never Be Versioned -- Use Field Deprecation Instead
- **What:** Do not version GraphQL schemas. Use the `@deprecated` directive with clear `reason` strings pointing to replacements. Monitor deprecated field usage via query analytics. Remove fields only when usage reaches zero.
- **Why:** GraphQL's query model (clients request only what they need) makes additive changes inherently non-breaking. Versioning a GraphQL API introduces all the pain of REST versioning with none of the benefits, since clients already get exactly the fields they ask for.
- **When:** Always for GraphQL. If you need to fundamentally restructure a type, create a new type (e.g., `UserV2`) rather than versioning the entire schema.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

### Version Your API Gateway Routing, Not Just Your Application Code
- **What:** Use your API gateway (Kong, AWS API Gateway, Cloudflare) to handle version routing at the infrastructure level. Route `/v1/` to one backend deployment and `/v2/` to another. Use weighted routing for canary deployments of new versions.
- **Why:** Decoupling version routing from application code means your backends only need to serve one version each, dramatically reducing code complexity. It also enables independent scaling, deployment, and rollback of API versions. Gateway-level routing works with any versioning strategy (path, header, or content negotiation).
- **When:** When you need to run multiple major versions simultaneously. For single-version APIs with only additive changes, application-level routing is fine.
- **Source:** [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-api-versioning-evolution.md](../research/2026-02-14-api-versioning-evolution.md).

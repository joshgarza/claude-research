---
date: 2026-02-14
topic: API Versioning and Evolution
status: complete
tags: [api-versioning, openapi, sdk-generation, deprecation, breaking-changes, graphql, trpc, rate-limiting]
related: [2026-02-14-backend-api-practices-update.md]
---

# API Versioning and Evolution

## Context

API versioning and evolution were identified as a gap in the principles knowledge bank. As APIs become the primary integration surface for both human developers and AI agents, having a clear versioning strategy, backwards compatibility rules, deprecation workflow, and SDK generation pipeline is essential. This research covers versioning strategies (URL path, header, content negotiation), Stripe's date-based versioning, backwards compatibility rules (Google AIP, Zalando, Microsoft), deprecation workflows (RFC 9745, RFC 8594), OpenAPI generation from Zod, SDK generation (openapi-typescript, Speakeasy, Stainless), breaking change detection in CI, API lifecycle management, GraphQL versioning, tRPC versioning, rate limiting headers, and API gateway patterns.

Key sources: Google AIP, Zalando RESTful API Guidelines, Microsoft API Guidelines, Stripe API docs and blog, RFC 9745, RFC 8594, IETF rate limit headers draft, Optic, oasdiff, openapi-typescript, Speakeasy, Stainless, Apollo GraphQL, tRPC docs.

## Findings

### 1. Versioning Strategies

#### URL Path Versioning (`/v1/`, `/v2/`)
The most widely adopted approach, used by companies like Twitter, Airbnb, and Google Cloud. The version is embedded directly in the URL path (e.g., `/api/v1/users`).

**Advantages:**
- Immediately visible which version is in use; no tooling needed to inspect
- Easy caching -- different URLs are naturally distinct cache keys
- Simple routing at the infrastructure level (load balancers, API gateways can route by path)
- Browser-testable without custom headers

**Disadvantages:**
- URL bloat when multiple major versions coexist
- Entire API is versioned monolithically -- you cannot version individual endpoints independently
- Encourages "big bang" version bumps rather than incremental evolution

Google's approach ([AIP-185](https://google.aip.dev/185)): Major version only in the URL path (e.g., `/v1`, `/v2`). No minor or patch versions are exposed. This is deliberate -- minor/patch changes are rolled out in-place within a major version.

**Source:** [Google Cloud API Design Guide - Versioning](https://cloud.google.com/apis/design/versioning), [Lonti - API versioning comparison](https://www.lonti.com/blog/api-versioning-url-vs-header-vs-media-type-versioning)

#### Header Versioning (`Accept-Version: 2`, `Stripe-Version: 2024-09-30`)
Version information is passed as a custom request header, keeping URLs clean and stable.

**Advantages:**
- Clean, stable URLs that don't change between versions
- Fine-grained control -- different endpoints can theoretically be at different versions
- Better alignment with REST principles (the resource identity doesn't change)

**Disadvantages:**
- Invisible to casual inspection; requires tools like curl/Postman to test
- Cannot be bookmarked or linked to a specific version in a browser
- Caching requires `Vary` headers on the version header, which complicates CDN behavior

Stripe's implementation is the gold standard: your account is pinned to a version on first API call, and you can override per-request with the `Stripe-Version` header. This combines the safety of pinning with the flexibility of headers.

**Source:** [Stripe API - Versioning](https://docs.stripe.com/api/versioning), [Stripe Blog - APIs as Infrastructure](https://stripe.com/blog/api-versioning)

#### Content Negotiation (`Accept: application/vnd.api+json;version=2`)
Version is embedded in the media type, following the REST content negotiation mechanism.

**Advantages:**
- Most RESTful approach -- leverages HTTP's built-in content negotiation
- Allows versioning at the representation level, not the resource level
- Can version individual resource representations independently

**Disadvantages:**
- Most complex to implement -- controllers must dispatch on media type
- Hardest to test and debug
- Poor discoverability -- developers must know the custom media types

**Verdict for most TypeScript/Node.js APIs:** URL path versioning is the pragmatic default for external APIs. Header versioning (Stripe-style) is superior for APIs with many integrators who need stability guarantees and gradual migration. Content negotiation is rarely worth the complexity outside of highly RESTful public APIs.

**Source:** [Google Cloud Blog - Which version of versioning](https://cloud.google.com/blog/products/api-management/api-design-which-version-of-versioning-is-right-for-you)

#### Query Parameter Versioning (`?version=2`)
Rarely recommended. Mixes API contract concerns with request parameters. Difficult to enforce, easy to forget. Primarily used for quick prototypes or internal tooling.

### 2. Backwards Compatibility Rules

#### What Constitutes a Breaking Change

Based on [Google AIP-180](https://google.aip.dev/180), [Zalando REST API Guidelines](https://github.com/zalando/restful-api-guidelines/blob/main/chapters/compatibility.adoc), and [Microsoft API Guidelines](https://github.com/microsoft/api-guidelines):

**Definitely breaking:**
- Removing or renaming a field, endpoint, or enum value
- Changing a field's type (even if wire-compatible -- generated code changes)
- Making an optional field required
- Tightening validation constraints (e.g., reducing max length, narrowing enum values)
- Changing HTTP status codes or error codes for existing scenarios
- Changing the semantic meaning of a field (e.g., `created_at` from UTC to local time)
- Changing resource names/identifiers
- Removing or reordering required request parameters
- Changing authentication/authorization requirements

**Definitely NOT breaking (additive/permissive changes):**
- Adding a new optional field to a request or response
- Adding a new endpoint or resource
- Adding a new optional query parameter
- Making a required field optional (loosening)
- Expanding validation constraints (e.g., accepting wider range of values)
- Adding new enum values to output-only fields (with caveats -- see below)
- Adding new HTTP methods to existing resources

**Gray area (handle with care):**
- Adding new enum values to fields that clients might `switch` on -- Zalando recommends using open-ended value lists for output enums
- Adding new error codes -- existing error-handling code may not expect them
- Changing default values -- technically non-breaking but can alter behavior
- Adding required fields with default values -- wire-compatible but schema-breaking

#### Postel's Law (Robustness Principle)

"Be liberal in what you accept, conservative in what you send."

In API terms:
- **Servers** should accept unknown fields without error (ignore them) and tolerate missing optional fields
- **Servers** should only send documented fields and maintain strict output schemas
- **Clients** should ignore unknown fields in responses
- **Clients** should not depend on undocumented behavior

The Zalando guidelines formalize this: "Clients must be prepared for compatible API extensions of response bodies. Service providers should apply Postel's Law."

**Source:** [Zalando RESTful API Guidelines - Compatibility](https://github.com/zalando/restful-api-guidelines/blob/main/chapters/compatibility.adoc), [Google AIP-180](https://google.aip.dev/180)

### 3. Stripe's Date-Based Versioning (Deep Dive)

Stripe's system is the most sophisticated API versioning approach in production. Key architecture details:

**Version Pinning:** On first API call, your account is pinned to the latest version. All subsequent calls default to that version. You can override per-request with the `Stripe-Version` header.

**Compatibility Modules:** Internally, each version change is encapsulated in a self-contained "version change module" that transforms requests/responses between adjacent versions. These modules are chained: a request at version `2020-03-01` passes through all transformation modules between that version and the current internal version. This is a pipeline architecture.

**Side Effects Annotation:** Modules that define behavior changes (not just shape changes) are annotated with `has_side_effects`, making them no-ops in certain contexts. This keeps the system predictable.

**New Release Cadence (post-2024):** Starting with `2024-09-30.acacia`, Stripe uses a dual cadence:
- **Monthly releases**: Backwards-compatible only, safe to adopt immediately
- **Bi-annual major releases** (named: Acacia, Basil, Clover...): May contain breaking changes, ship with migration guides and changelogs

SDK major versions align with bi-annual API releases; SDK minor versions align with monthly releases.

**Source:** [Stripe Blog - APIs as Infrastructure](https://stripe.com/blog/api-versioning), [Stripe Blog - New API Release Process](https://stripe.com/blog/introducing-stripes-new-api-release-process), [Stripe API Versioning Docs](https://docs.stripe.com/api/versioning), [Stripe API Upgrades](https://docs.stripe.com/upgrades)

### 4. API Deprecation Workflow

#### HTTP Headers for Deprecation

Two standardized headers now exist:

**`Deprecation` header** (RFC 9745, published March 2025): Indicates that an endpoint is deprecated or will be deprecated. Value is either `@<unix-timestamp>` for a future deprecation date or `true` if already deprecated.

**`Sunset` header** (RFC 8594): Indicates when the endpoint will be completely removed. Value is an HTTP date (e.g., `Wed, 31 Dec 2025 23:59:59 GMT`). The Sunset date must NOT be earlier than the Deprecation date.

**Best practice workflow:**
1. **Announce** deprecation via changelog, email, and developer portal
2. **Add `Deprecation` header** with future date to all affected endpoints
3. **Add `Sunset` header** with removal date
4. **Monitor usage** of deprecated endpoints -- track which API keys are still calling them
5. **Send targeted notifications** to active users of deprecated endpoints
6. **Add `Link` header** pointing to migration documentation
7. **Remove endpoint** only after sunset date and confirmed low/zero usage
8. **Return `410 Gone`** after removal (not `404`)

**Microsoft's standard:** Deprecated elements must be supported for a minimum of 36 months (or 24 months with demonstrated non-usage) in Microsoft Graph APIs.

**Source:** [RFC 9745 - Deprecation HTTP Response Header Field](https://datatracker.ietf.org/doc/rfc9745/), [Zalando RESTful API Guidelines - Deprecation](https://github.com/zalando/restful-api-guidelines/blob/main/chapters/deprecation.adoc), [Microsoft Graph API Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/graph/GuidelinesGraph.md)

### 5. OpenAPI/Swagger Documentation Generation

#### From Zod Schemas

The primary library is **[zod-openapi](https://github.com/samchungy/zod-openapi)** (by samchungy) -- uses Zod's native `.meta()` method to attach OpenAPI metadata. No monkey-patching required. Generates OpenAPI v3.x documents.

Another option is **[zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi)** (by Astea Solutions) -- slightly different API, also generates OpenAPI docs from Zod schemas.

For **Zod v4**, Speakeasy has published guidance on using the updated `.meta()` API for OpenAPI generation.

#### From tRPC

tRPC does not natively produce OpenAPI specs (it uses its own RPC protocol). To bridge this:
- **trpc-openapi** (community package) -- exposes tRPC procedures as REST endpoints with OpenAPI documentation
- **Speakeasy's tRPC integration** -- generates OpenAPI specs from tRPC routers for SDK generation

#### Auto-generation in CI

Best practice: generate OpenAPI spec as a CI artifact, then use it for docs, SDK generation, and breaking change detection. Tools:
- Run `zod-openapi` or `zod-to-openapi` as a build step
- Commit the generated spec or publish it as a CI artifact
- Use `oasdiff` or Optic to compare against the previous version

#### Documentation Hosting (2025 landscape)

**[Scalar](https://github.com/scalar/scalar):** Modern, open-source, now Microsoft's default for .NET 9. Interactive "try it out" built in. Best for code-first teams. Provides API client integrated with docs.

**Swagger UI:** The original. Mature, widely supported, interactive. SwaggerHub for enterprise features. Still the safe default.

**Redocly/Redoc:** Beautiful three-panel layout (Stripe-style). Read-only -- no "try it out" functionality in open-source version. Best for polished public API documentation.

**Source:** [Speakeasy - Generate OpenAPI with Zod](https://www.speakeasy.com/openapi/frameworks/zod), [zod-openapi npm](https://www.npmjs.com/package/zod-openapi), [Scalar GitHub](https://github.com/scalar/scalar), [APIs You Won't Hate - Best API Docs Tools 2025](https://apisyouwonthate.com/blog/top-5-best-api-docs-tools/)

### 6. SDK Generation

#### openapi-typescript

**[openapi-typescript](https://openapi-ts.dev/)** generates zero-runtime TypeScript types from OpenAPI 3.0/3.1 specs. Paired with **openapi-fetch** (~6kb), it provides a type-safe fetch wrapper. This is the best lightweight option for internal consumption.

```
npx openapi-typescript ./api.yaml -o ./src/api-types.ts
```

Supports local/remote schemas, YAML/JSON, discriminators, and all OpenAPI 3.1 features.

#### Speakeasy

**[Speakeasy](https://www.speakeasy.com/)** generates full-featured SDKs (TypeScript, Python, Go, Java, C#, etc.) from OpenAPI specs. Generated TypeScript SDKs use native Fetch API, Zod for validation, and support:
- Polymorphic types (oneOf/anyOf)
- Server-sent events (SSE) streaming
- Retries, pagination, error handling
- MCP server generation (AI tool use)

Best for: public APIs where you need to distribute SDKs to external developers.

#### Stainless

**[Stainless](https://www.stainless.com/)** is used by Anthropic, OpenAI, and other major API providers. Generates "hand-crafted feel" SDKs with:
- Dependency-free TypeScript (uses built-in fetch)
- Retries, pagination, structured errors out of the box
- Auto-regeneration on spec changes (opens PRs automatically)
- Auto-publishing to npm, pypi, maven

Best for: high-profile public APIs where SDK quality is a competitive advantage.

**Source:** [openapi-ts.dev](https://openapi-ts.dev/), [Speakeasy SDK Generation](https://www.speakeasy.com/product/sdk-generation), [Stainless Blog](https://www.stainless.com/blog/announcing-the-stainless-sdk-generator)

### 7. Breaking Change Detection in CI

#### oasdiff

**[oasdiff](https://github.com/oasdiff/oasdiff)** -- Go-based CLI and GitHub Action. Compares two OpenAPI specs and detects breaking changes. Outputs diff, changelog, and breaking change reports. Has a [GitHub Action](https://github.com/oasdiff/oasdiff-action) that posts results as PR comments.

#### Optic

**[Optic](https://github.com/opticdev/optic)** -- more full-featured. Provides both linting (like Spectral) and diffing (unlike Spectral, which only sees one version at a time). Runs in PRs via GitHub Action, gives actionable feedback. Better at catching subtle breaking changes like semantic shifts.

Key insight from Optic's documentation: **Spectral cannot catch breaking changes** because it only analyzes a single spec. You need a diff tool that compares two versions.

#### openapi-changes (pb33f)

**[openapi-changes](https://github.com/pb33f/openapi-changes)** -- supports OpenAPI 3.0, 3.1, and Swagger. Configurable breaking change rules. Can track a single spec over time (git history).

#### Recommended CI Pipeline

```
1. Generate OpenAPI spec from source (Zod schemas, tRPC, etc.)
2. Run Spectral for style/lint checking (single-spec rules)
3. Run oasdiff or Optic for breaking change detection (two-spec diff)
4. Post results as PR comment
5. Block merge on unacknowledged breaking changes
```

**Source:** [oasdiff GitHub](https://github.com/oasdiff/oasdiff), [Optic - Catch breaking changes in PRs](https://www.useoptic.com/blog/catch-breaking-changes-in-prs), [Optic GitHub](https://github.com/opticdev/optic)

### 8. API Changelog Practices

**Automated changelogs from OpenAPI diffs:**
- **oasdiff** can generate changelogs from spec diffs
- **[api-changelog](https://github.com/smizell/api-changelog)** is an OpenAPI extension for describing planned and actual API changes
- Stripe publishes a structured [changelog](https://docs.stripe.com/changelog) organized by release name

**Best practices:**
- Generate changelogs automatically from OpenAPI diffs in CI
- Categorize changes as: Added, Changed, Deprecated, Removed, Fixed
- Flag breaking changes prominently
- Include migration guidance for breaking changes
- Publish changelogs in both human-readable (web) and machine-readable (JSON/YAML) formats

**Source:** [oasdiff](https://www.oasdiff.com/), [api-changelog GitHub](https://github.com/smizell/api-changelog), [Stripe Changelog](https://docs.stripe.com/changelog)

### 9. API Lifecycle Management

#### Stability Stages (Google AIP-181 Model)

**Alpha:**
- Disabled by default, opt-in only
- Breaking changes expected at any time without notice
- No SLA, no support guarantees
- API may change incompatibly or be removed entirely
- Suitable for: early feedback, internal testing

**Beta:**
- Enabled by default, considered feature-complete
- Breaking changes possible but must be communicated with deprecation period
- Google recommends 90-day beta period before promotion to stable
- Google recommends 180-day deprecation period for beta features being removed
- Suitable for: public preview, production use with caution

**Stable (GA):**
- Fully supported over the lifetime of the major API version
- No breaking changes without a new major version
- Must have formal deprecation/turn-down process defined
- Suitable for: production use

#### Feature Flags for API Features

Kubernetes pioneered the "feature gate" pattern for API lifecycle:
- Features progress through Alpha -> Beta -> GA stages
- Each stage has defined expectations for stability, defaults, and deprecation
- Feature gates can be toggled per-deployment

For TypeScript/Node.js APIs, this translates to:
- Use feature flags or capability headers to gate new API features
- Advertise feature stability in API responses or documentation
- Progress features through alpha/beta/stable with clear criteria

**Source:** [Google AIP-181](https://google.aip.dev/181), [Google Cloud Blog - API Stability Tenets](https://cloud.google.com/blog/topics/inside-google-cloud/new-api-stability-tenets-govern-google-enterprise-apis)

### 10. GraphQL Versioning

GraphQL's philosophy is explicitly "versionless" -- the schema evolves continuously rather than being versioned.

**Field deprecation:**
```graphql
type User {
  name: String @deprecated(reason: "Use `firstName` and `lastName`")
  firstName: String
  lastName: String
}
```

The `@deprecated` directive is built into the GraphQL spec. Deprecated fields continue to work but are flagged in tooling (GraphiQL, Apollo Studio).

**Schema evolution best practices:**
1. **Add** new fields/types freely (never breaking)
2. **Deprecate** old fields with `@deprecated(reason: "...")` and a clear alternative
3. **Monitor** usage of deprecated fields via query analytics
4. **Remove** only when usage drops to zero (or after a defined deprecation period)

**Why versioning is rarely needed:** Clients explicitly request only the fields they need, so new fields don't affect existing queries. This makes additive evolution inherently safe.

**When versioning IS needed:** If you need to change the fundamental structure of a type or remove fields that many clients depend on, consider creating a parallel type (e.g., `UserV2`) rather than versioning the entire schema.

**Source:** [Apollo GraphQL Docs - Schema Deprecations](https://www.apollographql.com/docs/graphos/schema-design/guides/deprecations), [Production Ready GraphQL - How Should We Version](https://productionreadygraphql.com/blog/2019-11-06-how-should-we-version-graphql-apis/)

### 11. tRPC Versioning

tRPC generally does **not** need versioning in a monorepo because:
- Client and server share types directly via TypeScript -- there is no serialized contract to version
- Changes to procedure signatures are caught at compile time
- Deployment is typically synchronized (same CI pipeline)

**When you DO need tRPC versioning:**
- Distributed systems where client and server deploy independently
- Public-facing tRPC APIs (unusual but possible)
- Gradual migration scenarios

**Approach for versioned tRPC:**
- Duplicate procedures when making breaking changes (e.g., `user.getById` and `user.getByIdV2`)
- Use a REST endpoint to advertise supported versions
- Consider generating an OpenAPI spec from tRPC for external consumers

**Monorepo best practices:**
- Set up tRPC as its own package (not embedded in frontend or backend)
- Use Turborepo or Nx for orchestration
- Always update all `@trpc/*` packages together -- they must be at the same version

**Source:** [tRPC FAQ](https://trpc.io/docs/faq), [tRPC Discord - Versioning Discussion](https://discord-questions.trpc.io/m/1215215337281298452), [tRPC GitHub Discussion #1860](https://github.com/trpc/trpc/discussions/1860)

### 12. Rate Limiting and Quotas

#### Standard Headers (Current and Emerging)

**Legacy (widely adopted):**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1672531200
```

**IETF Draft Standard (draft-ietf-httpapi-ratelimit-headers-10):**
```
RateLimit-Policy: default;q=1000;w=3600
RateLimit: default;r=999
```

The new standard uses `RateLimit-Policy` (quota policy: quota `q` and window `w`) and `RateLimit` (remaining quota `r`). Cloudflare and Atlassian are already adopting this format.

**Error Response:** Always return `429 Too Many Requests` with a `Retry-After` header (seconds until retry is safe).

#### Design Patterns for External APIs

- **Per-key limits:** Each API key gets its own quota (prevents noisy neighbor)
- **Usage tiers:** Free/Pro/Enterprise with different rate limits
- **Endpoint-specific limits:** Write endpoints get stricter limits than read endpoints
- **Sliding window:** Smoother than fixed window; prevents burst-then-wait patterns
- **Token bucket:** Best for APIs with variable burst requirements

#### Implementation for TypeScript/Node.js

Middleware-based approach: use libraries like `rate-limiter-flexible` or `express-rate-limit` for application-level limiting. For production, use Redis-backed distributed rate limiting. API gateways (Kong, AWS API Gateway) can handle this at the infrastructure level.

**Source:** [IETF Draft - RateLimit Header Fields](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), [Cloudflare Rate Limiting Headers](https://developers.cloudflare.com/changelog/2025-09-03-rate-limiting-improvement/), [REST API Rate Limit Guidelines](https://restfulapi.net/rest-api-rate-limit-guidelines/)

### 13. API Gateway Patterns

#### Key Players (2025)

**Kong:** Open-source, plugin-based architecture, strong Kubernetes support. Best for: teams that want flexibility and a large plugin ecosystem. Supports gRPC, mTLS, observability.

**Tyk:** Open-source, batteries-included (built-in auth schemes: OIDC, OAuth2, mTLS, HMAC). Best for: teams that want auth out of the box without plugins.

**AWS API Gateway:** Serverless, managed. HTTP APIs at $1.00/million requests (after free tier). Native mTLS, WAF integration. Best for: AWS-native architectures, serverless backends.

**Cloudflare API Shield:** Edge-native, built on Cloudflare's network. Schema validation at the edge, DDoS/WAF included, mTLS termination. Starts at $5/month. Best for: edge-first architectures, API security focus.

#### Versioning at the Gateway Level

API gateways can route requests to different backend versions based on:
- URL path (`/v1/` -> service-v1, `/v2/` -> service-v2)
- Header (`Accept-Version` -> appropriate backend)
- Weighted routing (canary deployments for new versions)

This decouples versioning from application code -- the gateway handles routing, and backends only serve their specific version.

**Source:** [API7 - Top 11 API Gateways](https://api7.ai/top-11-api-gateways-platforms-compared), [Moesif - How to Choose an API Gateway](https://www.moesif.com/blog/technical/api-gateways/How-to-Choose-The-Right-API-Gateway-For-Your-Platform-Comparison-Of-Kong-Tyk-Apigee-And-Alternatives/)

## Open Questions

1. **MCP as an API surface:** How does MCP (Model Context Protocol) change API versioning? MCP tools have their own schema evolution concerns.
2. **API-first vs code-first:** When does the overhead of maintaining an OpenAPI spec-first workflow pay off vs. generating from code?
3. **Versioning for AI agents:** Do AI agent consumers need different versioning considerations than human developers?

## Extracted Principles

12 principles extracted to [principles/api-versioning-evolution.md](../principles/api-versioning-evolution.md):

1. Start With URL Path Versioning, Graduate to Header Versioning
2. Define Your Breaking Change Contract Explicitly and Upfront
3. Clients Must Ignore Unknown Fields; Servers Must Never Remove Fields
4. Use Deprecation and Sunset Headers Together With Usage Monitoring
5. Generate Your OpenAPI Spec From Zod Schemas, Not the Reverse
6. Run Breaking Change Detection in CI on Every PR
7. Use Stability Stages for New API Features
8. Prefer Scalar Over Swagger UI for New Projects
9. Use openapi-typescript for Internal, Speakeasy/Stainless for External SDKs
10. Adopt the IETF RateLimit Headers for New APIs
11. GraphQL APIs Should Never Be Versioned
12. Version Your API Gateway Routing, Not Just Your Application Code

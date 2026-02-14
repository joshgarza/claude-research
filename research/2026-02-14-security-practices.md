---
date: 2026-02-14
topic: Security Practices for Full-Stack TypeScript
status: complete
tags: [security, owasp, rate-limiting, cors, csp, encryption, authorization, vulnerability-management]
related: [2026-02-13-frontend-engineering-practices.md, 2026-02-13-backend-api-practices.md, 2026-02-13-devops-infrastructure-practices.md, 2026-02-14-frontend-engineering-update.md, 2026-02-14-backend-api-practices-update.md, 2026-02-14-devops-infrastructure-update.md]
---

# Security Practices for Full-Stack TypeScript

## Context

Security principles were scattered across three principle files (frontend-engineering.md, backend-api-engineering.md, devops-infrastructure.md) with no unified security coverage. Those files cover:

- **Frontend**: npm supply chain hygiene, server action security, React security patching
- **Backend**: Zod validation, passkeys, MCP governance
- **DevOps**: supply chain security (SBOM/SLSA/Sigstore), secrets management, policy-as-code

This research fills the gaps: OWASP mapping, rate limiting, CORS, CSP, security headers, encryption, authorization patterns, JWT pitfalls, dependency vulnerability workflows, secure coding patterns, security testing, and production readiness.

## Findings

### OWASP Top 10 2025 — Mapped to TypeScript/Node.js

The OWASP Top 10 2025 was released based on analysis of 175,000+ CVE records. Key changes from 2021: Security Misconfiguration surged to #2, new "Software Supply Chain Failures" and "Mishandling of Exceptional Conditions" categories added, SSRF consolidated into Broken Access Control.

| # | Category | TypeScript/Node.js Mitigation |
|---|----------|-------------------------------|
| A01 | **Broken Access Control** | CASL/Casbin for authorization. Check object-level permissions on every endpoint. Deny by default. SSRF now folded in — validate all URLs in server-side fetch calls, allowlist destinations. |
| A02 | **Security Misconfiguration** | Helmet.js defaults + strict CSP. Hono `secureHeaders` middleware. Disable debug endpoints in production. Review default configs of every dependency. |
| A03 | **Software Supply Chain Failures** | (Covered in devops-infrastructure.md and frontend-engineering.md) — SBOM, SLSA, pnpm strict deps, npm provenance, Socket.dev behavioral analysis. |
| A04 | **Cryptographic Failures** | TLS 1.3 everywhere. AES-256-GCM for encryption at rest. Never roll custom crypto — use Node.js `crypto` module or `libsodium`. Hash passwords with Argon2id (preferred) or bcrypt. |
| A05 | **Injection** | (Partially covered in backend-api-engineering.md) — Zod at every boundary. Parameterized queries only — Drizzle and Prisma do this by default. Escape user input in raw SQL. Template literal SQL (Drizzle's `sql` tag) is safe. Never use string concatenation. |
| A06 | **Insecure Design** | Threat modeling during design, not after implementation. STRIDE framework. Rate limiting on auth endpoints. Business logic abuse testing. CWE-284 (improper access control) is the core issue. |
| A07 | **Authentication Failures** | (Covered in backend-api-engineering.md) — Passkeys + Better Auth. MFA. Account lockout with progressive delays. Credential stuffing protection via rate limiting. |
| A08 | **Software or Data Integrity Failures** | Verify CI/CD pipeline integrity. Sign artifacts (Sigstore/cosign). Subresource Integrity (SRI) for CDN scripts. Validate auto-updates. |
| A09 | **Security Logging and Alerting Failures** | (Partially covered in devops-infrastructure.md via OTel) — Log auth events, access denials, input validation failures. Structured JSON logs. Never log secrets, tokens, or PII. SIEM integration. Alert on anomalies, not just errors. |
| A10 | **Mishandling of Exceptional Conditions** | (NEW in 2025) — Never expose stack traces. Custom error classes with safe serialization. Fail closed, not open. `Effect-TS` for typed error handling. Express/Hono error middleware must catch all. |

**Source:** [OWASP Top 10:2025](https://owasp.org/Top10/2025/), [GitLab analysis](https://about.gitlab.com/blog/2025-owasp-top-10-whats-changed-and-why-it-matters/)

### OWASP API Security Top 10 — Mapped to Hono/Fastify/tRPC

The latest edition is OWASP API Security Top 10 2023.

| # | Risk | Framework-Specific Mitigation |
|---|------|-------------------------------|
| API1 | **Broken Object Level Authorization (BOLA)** | Middleware that checks `resource.ownerId === user.id` on every handler. CASL abilities per request. tRPC: authorization in middleware, not procedures. Hono: context-based auth middleware. |
| API2 | **Broken Authentication** | Better Auth with passkeys. Rate limit `/login` and `/register` (5 req/min per IP). Hono: `hono-rate-limiter`. Fastify: `@fastify/rate-limit`. |
| API3 | **Broken Object Property Level Authorization** | Zod schemas as allowlists — only declared fields pass through. Never `Object.assign(entity, req.body)`. tRPC input schemas automatically whitelist. Drizzle: select only needed columns. |
| API4 | **Unrestricted Resource Consumption** | Rate limiting (see dedicated section). Payload size limits (Hono `bodyLimit`, Fastify `bodyLimit`). Query complexity limits for GraphQL. Pagination required on all list endpoints. |
| API5 | **Broken Function Level Authorization** | RBAC/ABAC middleware. Admin endpoints on separate route prefix with distinct auth middleware. tRPC: admin procedures in separate router with admin middleware. |
| API6 | **Unrestricted Access to Sensitive Business Flows** | CAPTCHA, device fingerprinting, or proof-of-work for high-value operations. Bot detection. Rate limiting per user, not just per IP. |
| API7 | **Server-Side Request Forgery (SSRF)** | Allowlist outbound URL destinations. Block private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x). Use `ssrf-req-filter` or similar. Never pass user input directly to `fetch()`. |
| API8 | **Security Misconfiguration** | Helmet.js / Hono `secureHeaders`. Disable TRACE/TRACK methods. Remove `X-Powered-By`. Audit CORS configuration. Error responses must not leak internals. |
| API9 | **Improper Inventory Management** | OpenAPI spec as source of truth. Decommission old API versions. Shadow API detection. API gateway inventory. |
| API10 | **Unsafe Consumption of APIs** | Validate all third-party API responses with Zod. Timeout external calls. Circuit breaker pattern for external dependencies. Never trust external data. |

**Source:** [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

### Rate Limiting and Abuse Prevention

#### Algorithms

| Algorithm | How It Works | Best For | Trade-off |
|-----------|-------------|----------|-----------|
| **Token Bucket** | Tokens added at fixed rate. Each request consumes a token. Bucket has max capacity. | APIs needing burst tolerance. General purpose. | Allows bursts up to bucket size. |
| **Sliding Window Log** | Stores timestamp of each request. Counts requests in rolling window. | Strict enforcement. Billing/usage tracking. | Higher memory (stores all timestamps). |
| **Sliding Window Counter** | Weighted average of current + previous window counts. | Balance of accuracy and efficiency. | Slight inaccuracy at window boundaries. |
| **Fixed Window** | Counts requests in fixed time windows. | Simplest implementation. | Burst at window boundaries (2x rate). |

#### Implementation Stack

- **Edge/CDN layer:** Cloudflare Rate Limiting (free tier, WAF rules). First line of defense. Rate limit by IP, API key, session, or custom header. Can count on any header, cookie, query param, or JSON body field.
- **Application layer:** `@upstash/ratelimit` for serverless/edge (HTTP-based Redis, no connections). Supports fixed window, sliding window, and token bucket. In-memory cache of blocked identifiers avoids Redis roundtrips. Dynamic limits at runtime. `hono-rate-limiter` for Hono. `@fastify/rate-limit` for Fastify.
- **Custom middleware:** For fine-grained per-user, per-endpoint, per-plan limits. Combine with Upstash for distributed state.

#### What to Rate Limit

| Endpoint Type | Suggested Limit | Why |
|--------------|----------------|-----|
| Login/Register | 5-10 req/min per IP | Credential stuffing, brute force |
| Password Reset | 3 req/hour per account | Account enumeration |
| API mutations (POST/PUT/DELETE) | 30-60 req/min per user | Abuse prevention |
| API reads (GET) | 100-300 req/min per user | Resource protection |
| Webhook receivers | 100 req/sec global | DDoS via webhook floods |
| File uploads | 5-10 req/min per user | Storage abuse |
| AI/LLM endpoints | Per-token or per-request budgets | Cost control |

**Source:** [Upstash Ratelimit](https://github.com/upstash/ratelimit-js), [Cloudflare Rate Limiting Best Practices](https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/)

### CORS Configuration

#### Common Mistakes (All Exploitable)

1. **Reflecting origin without validation** — `Access-Control-Allow-Origin: ${req.headers.origin}`. Allows any site to make credentialed requests. The most dangerous CORS mistake.
2. **`Access-Control-Allow-Origin: *` with credentials** — Browsers block this, but developers then "fix" it by reflecting origin, creating vulnerability #1.
3. **Allowing `null` origin** — Sandboxed iframes and local files send `Origin: null`. Attackers can exploit this via sandboxed iframes.
4. **Flawed origin validation** — `origin.startsWith('https://trusted.com')` matches `https://trusted.com.evil.com`. Use exact match or strict suffix checking.
5. **Same config across environments** — Dev origins (`localhost:3000`) allowed in production.

#### Correct Pattern

```typescript
// Hono CORS middleware
import { cors } from 'hono/cors';

const allowedOrigins = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

// Or for subdomains:
const isAllowed = (origin: string) =>
  allowedOrigins.has(origin) ||
  /^https:\/\/[\w-]+\.example\.com$/.test(origin);

app.use('/*', cors({
  origin: (origin) => isAllowed(origin) ? origin : '',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours — reduce preflight requests
}));
```

Key rules:
- **Allowlist origins explicitly.** Never reflect without validation.
- **Use environment variables** for origin lists. Different lists per environment.
- **Set `maxAge`** to cache preflight responses (reduces OPTIONS requests).
- **Be specific with methods and headers.** Don't allow `*`.

**Source:** [PortSwigger CORS](https://portswigger.net/web-security/cors), [Detectify CORS Misconfigurations](https://blog.detectify.com/best-practices/cors-misconfigurations-explained/), [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors)

### Content Security Policy (CSP)

#### Nonce-Based CSP with Next.js

Next.js supports nonce-based CSP through middleware. Key considerations:

- **Nonces require dynamic rendering.** Pages using nonce-based CSP cannot be statically generated or use ISR. Every request gets a fresh nonce.
- **Partial Prerendering (PPR) is incompatible** with nonce-based CSP because the static shell won't have the nonce.
- **Next.js auto-injects nonces** into script tags when it detects a CSP header with `nonce-{value}`.

```typescript
// middleware.ts — Next.js nonce-based CSP
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);
  return response;
}
```

#### Hono CSP via Secure Headers

```typescript
import { secureHeaders } from 'hono/secure-headers';

app.use(secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'strict-dynamic'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));
```

#### CSP Rules of Thumb

- **`'strict-dynamic'`** is the modern approach — trusts scripts loaded by already-trusted scripts. Eliminates need to allowlist CDN domains.
- **Never use `'unsafe-inline'`** for scripts. Use nonces or hashes.
- **`'unsafe-eval'` is almost never needed.** If a library requires it, find a different library.
- **`frame-ancestors: 'none'`** replaces X-Frame-Options for clickjacking prevention.
- **Report violations** with `report-uri` or `report-to` directive. Use `Content-Security-Policy-Report-Only` header during rollout to find breakage before enforcing.

**Source:** [Next.js CSP Guide](https://nextjs.org/docs/app/guides/content-security-policy), [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [Hono Secure Headers](https://hono.dev/docs/middleware/builtin/secure-headers)

### Security Headers — Comprehensive Checklist

| Header | Recommended Value | Purpose |
|--------|-------------------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS. 2-year max-age. Submit to HSTS preload list. |
| `Content-Security-Policy` | See CSP section above | Prevents XSS, data injection, clickjacking. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing. |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | Prevents clickjacking. Superseded by CSP `frame-ancestors` but still set for older browsers. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information leakage. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restricts browser feature access. Deny what you don't need. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevents Spectre-type side-channel attacks. Required for `SharedArrayBuffer`. |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Prevents loading cross-origin resources without explicit opt-in. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents other sites from including your resources. |
| `X-DNS-Prefetch-Control` | `off` | Prevents DNS prefetching that can leak browsing behavior. |
| `X-Permitted-Cross-Domain-Policies` | `none` | Prevents Adobe Flash/PDF cross-domain data access. |

**Implementation:** Helmet.js (`app.use(helmet())`) sets sensible defaults for all of these in Express/Connect. Hono's `secureHeaders()` middleware provides equivalent coverage. One line of code.

**Headers to REMOVE:** `X-Powered-By`, `Server` (version details), any header that leaks tech stack.

**Source:** [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)

### Encryption

#### In Transit

- **TLS 1.3** is the minimum. TLS 1.2 acceptable only for legacy compatibility. TLS 1.0/1.1 are deprecated.
- **Certificate lifecycle is shortening:** CA/Browser Forum approved reducing public TLS certificate lifespans to 47 days by 2029 (phased reduction starting March 2026). Automate certificate management now — manual renewal will be impossible.
- **Let's Encrypt + certbot** for automated free certificates. Caddy auto-manages TLS. Cloudflare provides edge TLS for proxied domains.
- **Internal services:** mTLS (mutual TLS) between services. Istio/Linkerd service mesh or Cloudflare Tunnel for zero-trust networking.
- **Node.js:** Drop `axios` and `node-fetch` — native `fetch` (Undici 7.0) is 30% faster and handles TLS correctly. Set `NODE_TLS_REJECT_UNAUTHORIZED=1` (the default; never set to 0 in production).

#### At Rest

- **Database-level:** Most managed databases (RDS, Cloud SQL, PlanetScale, Neon) encrypt at rest by default with AES-256. Verify it's enabled.
- **Field-level encryption:** For PII, payment data, health records. Encrypt before writing to database. MongoDB has Client-Side Field Level Encryption (CSFLE). For Postgres/Drizzle: use `pgcrypto` extension or encrypt in application layer.
- **Application-layer encryption pattern:**
  ```typescript
  import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

  const algorithm = 'aes-256-gcm';

  function encrypt(plaintext: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }
  ```
- **Key management:** Use a KMS (AWS KMS, GCP KMS, Vault Transit). Never store encryption keys in the same database as encrypted data. Rotate keys on a schedule (90 days for high-sensitivity data).
- **Hashing:** Argon2id for passwords (preferred over bcrypt — memory-hard, resistant to GPU attacks). bcrypt still acceptable. Never SHA-256 for passwords (no salt, no work factor).

**Source:** [OWASP Cryptographic Failures](https://owasp.org/Top10/2025/), [Node.js TLS Documentation](https://nodejs.org/api/tls.html)

### API Security Beyond Validation — Authorization Patterns

#### RBAC vs ABAC vs ReBAC

| Pattern | Use When | TypeScript Library | Example |
|---------|----------|-------------------|---------|
| **RBAC** (Role-Based) | Simple role hierarchy. User is admin/editor/viewer. | CASL, Casbin | `user.role === 'admin'` |
| **ABAC** (Attribute-Based) | Authorization depends on user attributes, resource attributes, or environment. | CASL, Casbin | `user.department === resource.department && time.isBusinessHours` |
| **ReBAC** (Relationship-Based) | Authorization is about relationships — "user X is member of org Y which owns resource Z." | Permit.io, SpiceDB (Zanzibar), Oso | Google Docs sharing model |

**Recommendation:** Start with RBAC (CASL). Graduate to ABAC when you add conditional logic based on attributes. Move to ReBAC (SpiceDB/Permit.io) when authorization is fundamentally about entity relationships (multi-tenant, org hierarchies, document sharing).

**CASL** is the go-to for TypeScript:
- 6KB minzipped. Isomorphic (runs in Node and browser).
- Integrates with Prisma (`@casl/prisma`) for SQL-level filtering and Mongoose (`@casl/mongoose`).
- Define abilities as `(action, subject, conditions, fields)` tuples.
- Can share permission logic between frontend (hide UI elements) and backend (enforce access).

#### JWT Security Pitfalls

JWTs are frequently misused for sessions. Key pitfalls:

1. **Algorithm confusion:** Attacker changes `alg` header to `none` or `HS256` (when server expects RS256). **Fix:** Whitelist allowed algorithms explicitly. Never trust the JWT's `alg` claim.
2. **Weak signing secrets:** Secrets under 256 bits are brute-forceable. **Fix:** Use cryptographically strong secrets (minimum 256 bits). Better: use asymmetric keys (RS256/ES256).
3. **No expiration or long-lived tokens:** Stolen tokens are valid indefinitely. **Fix:** Short-lived access tokens (5-15 minutes). Refresh token rotation — detect stolen tokens by detecting reuse.
4. **Storing JWTs in localStorage:** Accessible via XSS. **Fix:** HttpOnly, Secure, SameSite=Strict cookies. If SPA must use tokens, use memory-only (not localStorage).
5. **Not validating `iss`/`aud` claims:** Accept tokens from any issuer. **Fix:** Always validate issuer and audience.
6. **Using JWTs for sessions when you don't need to:** JWTs are for stateless claims between services. For web sessions, server-side sessions with opaque session IDs are simpler and more secure (revocable, no client-side data exposure).

**Rule of thumb:** JWTs for service-to-service auth. Server-side sessions for user-facing apps (as covered in backend-api-engineering.md).

#### Session Hijacking Prevention

- HttpOnly, Secure, SameSite=Strict cookies.
- Session ID rotation on privilege changes (login, role change).
- Bind sessions to device fingerprint (IP + User-Agent) — alert on mismatch.
- Short session timeouts for sensitive operations. Absolute timeout (8-24 hours) + idle timeout (15-30 minutes).
- HTTPS everywhere (see HSTS above).

**Source:** [PortSwigger JWT Attacks](https://portswigger.net/web-security/jwt), [SuperTokens JWT Guide](https://supertokens.com/blog/are-you-using-jwts-for-user-sessions-in-the-correct-way), [CASL](https://casl.js.org/)

### Dependency Vulnerability Management

#### Workflow

1. **Detect:** `npm audit` in CI (built-in). Snyk/Socket.dev for richer analysis (behavioral analysis catches what CVE scanning misses). `pnpm audit` preferred — strict dependency resolution reduces false positives.
2. **Triage:** Not all vulnerabilities are equal. Check: Is the vulnerable code path actually reachable in your app? Is there a known exploit? What's the CVSS score?
3. **Prioritize by severity SLA:**

| Severity | CVSS Score | Patch SLA | Notes |
|----------|-----------|-----------|-------|
| Critical | 9.0-10.0 | 24-48 hours | Drop everything. Hotfix. |
| High | 7.0-8.9 | 7 days | Next sprint priority. |
| Medium | 4.0-6.9 | 30 days | Plan into regular maintenance. |
| Low | 0.1-3.9 | 90 days | Batch with other maintenance. |

4. **Remediate:** Update dependency (preferred). If update breaks things, use Snyk patches as temporary measure. If transitive dependency, check if direct dependency has a newer version that pulls a patched transitive.
5. **Verify:** Re-run audit. Confirm the CVE is resolved. Run test suite.
6. **Document:** Track accepted risks (vulnerabilities you've triaged as non-impacting) with justification and review date.

**Key finding from Snyk research:** 52% of teams fail to meet vulnerability SLA deadlines. 74% set unrealistic SLAs (under 1 week for all severities). The SLA table above is realistic and industry-aligned.

**Source:** [Snyk Vulnerability Management](https://docs.snyk.io/scan-with-snyk/snyk-open-source/manage-vulnerabilities/fix-your-vulnerabilities)

### Secure Coding Patterns in TypeScript

#### Prototype Pollution

- **What:** Attacker modifies `Object.prototype` via `__proto__`, `constructor`, or `prototype` properties in user-supplied JSON.
- **Where it happens:** `Object.assign()`, lodash `merge`/`defaultsDeep`, any recursive merge of user input into objects.
- **Prevention:**
  - Use `Object.create(null)` for dictionary objects (no prototype chain).
  - Zod validation strips unknown keys by default (`.strict()` rejects them).
  - Block `__proto__`, `constructor`, `prototype` keys in input validation.
  - Use `Map` instead of plain objects for user-keyed data.
  - TypeORM had a prototype pollution CVE (CVE-2020-8158) — keep ORMs updated.

#### SQL Injection with ORMs

- **False sense of safety:** ORMs don't automatically prevent all SQL injection. Raw query methods (`$queryRaw` in Prisma, `sql.raw()` in Drizzle) are unsafe with string interpolation.
- **Safe patterns:**
  - Drizzle: Tagged template literals (`sql`\`WHERE id = ${userId}\``) are parameterized automatically.
  - Prisma: `$queryRaw` with tagged template literals is safe. String concatenation is not.
  - Never use `$queryRawUnsafe` or Drizzle `sql.raw()` with user input.
- **Rule:** If you're concatenating strings to build SQL, you have an injection vulnerability. Full stop.

#### ReDoS (Regular Expression Denial of Service)

- **What:** Crafted input causes catastrophic backtracking in regex, blocking the event loop.
- **Prevention:**
  - Use `re2` (Google's regex library) for user-supplied patterns. Linear time guarantee.
  - Audit regexes with tools like `safe-regex` or `recheck`.
  - Set timeouts on regex operations.
  - Prefer Zod string validators (`.email()`, `.url()`, `.uuid()`) over custom regex — they're tested against ReDoS.

#### Other TypeScript-Specific Patterns

- **Avoid `eval()`, `new Function()`, `vm.runInNewContext()`** with user input. Use Node.js `--permission` model for running untrusted code.
- **Prevent path traversal:** Validate file paths. Use `path.resolve()` and verify the result starts with the expected directory.
- **Timing attacks on comparisons:** Use `crypto.timingSafeEqual()` for comparing secrets, tokens, or hashes.

**Source:** [Snyk Prototype Pollution](https://snyk.io/articles/prevent-prototype-pollution-vulnerabilities-javascript/)

### Security Testing

#### SAST (Static Application Security Testing)

| Tool | Strengths | Weaknesses | Use For |
|------|-----------|------------|---------|
| **Semgrep** | Fast. Custom rules. 82% accuracy. Framework-aware (Express, NestJS, React, Angular). 50+ npm library models. Free OSS tier. | 12% false positive rate. | CI/CD pipeline. Custom org rules. |
| **CodeQL** | 88% accuracy. 5% false positive rate. Deep semantic analysis. Free for open source on GitHub. | Slower. GitHub-centric. | GitHub repos. Deep vulnerability analysis. |
| **ESLint security plugins** | `eslint-plugin-security`, `eslint-plugin-no-unsanitized`. Zero config. | Surface-level only. | Baseline. Catches obvious issues. |
| **Biome/Oxlint** | Fast linting with some security rules. | Security rules less comprehensive. | If already using for linting. |

**Recommendation:** Semgrep in CI + CodeQL on GitHub + ESLint security plugins locally.

#### DAST (Dynamic Application Security Testing)

- **OWASP ZAP** — Free, open source. Run against preview deploys in CI. Good for automated baseline scans.
- **Nuclei** — Template-based vulnerability scanner. Large community template library. Good for known CVE detection.
- Run DAST against staging, not production.

#### Penetration Testing

- Annual pen test minimum for production apps handling user data.
- Use OWASP Testing Guide as the methodology.
- Bug bounty programs (HackerOne, Bugcrowd) for continuous testing at scale.
- Internal security review before each major release.

**Source:** [Semgrep JavaScript Analysis](https://semgrep.dev/blog/2025/a-technical-deep-dive-into-semgreps-javascript-vulnerability-detection/)

### Production Security Readiness Checklist

Before deploying to production, verify:

**Headers & Transport:**
- [ ] HTTPS everywhere, HSTS enabled with preload
- [ ] Security headers set (Helmet.js / Hono secureHeaders)
- [ ] CSP configured and enforced (not just report-only)
- [ ] CORS restricted to specific origins

**Authentication & Authorization:**
- [ ] Auth on every endpoint (deny by default)
- [ ] Authorization checks at object level (BOLA prevention)
- [ ] Session management: HttpOnly, Secure, SameSite cookies
- [ ] Rate limiting on auth endpoints
- [ ] MFA available for sensitive operations

**Input & Output:**
- [ ] All input validated with Zod schemas
- [ ] No raw SQL with string concatenation
- [ ] Error responses don't leak stack traces or internals
- [ ] File uploads validated (type, size, content)

**Data Protection:**
- [ ] Encryption at rest enabled on database
- [ ] Field-level encryption for PII/payment data
- [ ] Secrets in secrets manager (not .env files, not code)
- [ ] No secrets in logs

**Monitoring & Response:**
- [ ] Security events logged (auth failures, access denials)
- [ ] Alerting on anomalous patterns
- [ ] Incident response plan documented
- [ ] Vulnerability management SLAs defined

**CI/CD & Dependencies:**
- [ ] SAST (Semgrep/CodeQL) in CI pipeline
- [ ] Dependency scanning (Snyk/npm audit) in CI
- [ ] No known critical/high vulnerabilities
- [ ] Container images scanned

**Source:** [Gruntwork Production Readiness](https://gruntwork.io/devops-checklist/)

## Open Questions

1. **CSP + PPR trade-off:** Next.js Partial Prerendering is incompatible with nonce-based CSP. Is hash-based CSP a viable alternative that preserves static optimization? Needs testing.
2. **ReBAC adoption maturity:** SpiceDB/Zanzibar-style authorization is powerful but complex. At what team/product size does it become worth the investment over CASL + ABAC?
3. **47-day certificate lifespan impact:** The CA/Browser Forum's 2029 target for 47-day certificates will require full automation. What's the migration path for teams still using manual certificate management?
4. **AI-generated code security:** With 90% of developers using AI coding assistants, are the SAST tools keeping up with the patterns AI generates? Semgrep claims framework awareness, but coverage for AI-generated anti-patterns is untested.
5. **Effect-TS for security-critical paths:** Does typed error handling with Effect-TS meaningfully reduce security bugs from exception mishandling (OWASP A10)? No empirical data yet.

## Extracted Principles

12 principles extracted to [principles/security.md](../principles/security.md):

1. Helmet.js + Strict CSP with Nonces
2. CORS Allowlist, Never Reflect
3. Rate Limit in Layers
4. Authorization at Object Level (CASL/ABAC)
5. Server-Side Sessions Over JWTs for Users
6. Encrypt at Rest with KMS-Managed Keys
7. Automate Certificate Lifecycle
8. Parameterized Queries Only, Even with ORMs
9. Semgrep + CodeQL in CI
10. Severity-Based Vulnerability SLAs
11. Fail Closed on Exceptions
12. Production Security Checklist as CI Gate

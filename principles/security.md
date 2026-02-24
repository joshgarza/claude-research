# Security Principles

## Summary
Holistic security guidance for TypeScript/Node.js applications, filling gaps not covered by other principle files. Covers OWASP mapping, rate limiting, CORS, CSP, security headers, encryption, authorization patterns, JWT pitfalls, dependency vulnerability management, secure coding, security testing, and securing AI-agent-generated code. Security principles in other files remain authoritative for their domains.

## Related Principles (in other files)
- **frontend-engineering.md:** npm supply chain hygiene, server action security, React security patching
- **backend-api-engineering.md:** Zod validation at every boundary, passkeys + server-side sessions, MCP governance
- **devops-infrastructure.md:** supply chain security (SBOM/SLSA/Sigstore), secrets management (Doppler/Infisical), policy-as-code (OPA/Kyverno)

## Principles

### Map OWASP Top 10 to Your Stack
- **What:** Audit against the OWASP Top 10 2025 mapped to TypeScript/Node.js: (1) Broken Access Control — enforce authz on every route, (2) Cryptographic Failures — TLS everywhere, encrypt PII at rest, (3) Injection — parameterized queries via Drizzle/Prisma (never string concat), Zod input validation, (4) Insecure Design — threat model before building, (5) Security Misconfiguration — Helmet.js defaults, disable x-powered-by. Remaining items: vulnerable components, auth failures, data integrity, logging gaps, SSRF.
- **Why:** OWASP Top 10 is the industry-standard security baseline. Auditors and compliance frameworks reference it directly.
- **When:** Before any production launch. Revisit annually or when OWASP updates.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Rate Limit at Multiple Layers
- **What:** Edge/CDN rate limiting (Cloudflare, Vercel) for DDoS. Application-level (Upstash Ratelimit with sliding window) for API abuse. Per-endpoint limits tuned to use case: auth endpoints strict (5/min), search relaxed (60/min). Return `429` with `Retry-After` header.
- **Why:** A single rate limit layer is insufficient. Edge stops volumetric attacks. Application-level stops credential stuffing and API abuse. Sliding window is smoother than fixed window (no burst-at-boundary problem).
- **When:** Every public-facing API from day one. Internal APIs: rate limit when agents or automation are consumers.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Strict CORS with Explicit Origins
- **What:** Never use `Access-Control-Allow-Origin: *` on authenticated endpoints. Whitelist specific origins. Validate the `Origin` header server-side — don't reflect it back. Set `Access-Control-Allow-Credentials: true` only with explicit origins. Restrict `Access-Control-Allow-Methods` to what's actually needed.
- **Why:** Misconfigured CORS is a top-5 API vulnerability. Reflecting the Origin header back enables any site to make authenticated requests. Wildcard + credentials is blocked by browsers but misconfigurations still leak data.
- **When:** Every API that serves browser clients. Configure per-environment (localhost for dev, production domain for prod).
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Nonce-Based CSP
- **What:** Content Security Policy with nonces for inline scripts. In Next.js: generate a nonce per request in middleware, pass via header, inject into `<Script>` tags. Avoid `unsafe-inline` and `unsafe-eval`. Use `report-uri` or `report-to` for violation monitoring.
- **Why:** CSP is the strongest defense against XSS. Nonce-based CSP allows your inline scripts while blocking injected ones. `unsafe-inline` defeats the purpose of CSP entirely.
- **When:** Every production web application. Start with `Content-Security-Policy-Report-Only` to test, then enforce.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Helmet.js + Full Security Headers
- **What:** Use Helmet.js as the baseline (sets 11 headers). Ensure: `Strict-Transport-Security` (HSTS, min 1 year, includeSubDomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (disable unused APIs: camera, microphone, geolocation). Add CSP separately (Helmet's default is too permissive).
- **Why:** Security headers are defense-in-depth. HSTS prevents downgrade attacks. X-Frame-Options prevents clickjacking. Each header closes a specific attack vector at near-zero cost.
- **When:** Every web application. Takes 5 minutes to set up. No excuse not to.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Encrypt PII at Rest, TLS 1.3 in Transit
- **What:** Field-level encryption for PII (SSN, payment data) using AES-256-GCM. Database-level transparent encryption (TDE) for the full database. TLS 1.3 minimum for all connections (disable TLS 1.0/1.1). Use managed certificates (Let's Encrypt, ACM) — never self-signed in production.
- **Why:** Encryption at rest protects against database breaches and stolen backups. TLS 1.3 is faster (1-RTT handshake) and more secure than 1.2. Field-level encryption means a database dump doesn't expose PII.
- **When:** Any application handling PII, payment data, or health records. Managed Postgres services (Neon, Supabase, RDS) provide TDE by default.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### RBAC by Default, ABAC/ReBAC When Needed
- **What:** Start with Role-Based Access Control (RBAC) — roles map to permissions, users have roles. Graduate to Attribute-Based Access Control (ABAC) for context-dependent rules or Relationship-Based (ReBAC) for data ownership. Use CASL for TypeScript (isomorphic, works client and server).
- **Why:** RBAC covers 80% of authorization needs with minimal complexity. ABAC adds conditions (time, IP, department). ReBAC handles "can this user edit this specific document" via ownership graphs. Don't over-engineer authorization — start simple.
- **When:** Every application with user roles. CASL integrates with Drizzle/Prisma for database-level filtering.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Avoid JWT for Sessions
- **What:** Use server-side sessions (HttpOnly, Secure, SameSite=Strict cookies) for user authentication. JWTs are for service-to-service auth, short-lived tokens, and stateless claims. If you must use JWT: short expiry (15min), rotate signing keys, never store sensitive data in payload, validate `iss`/`aud`/`exp`.
- **Why:** JWTs can't be revoked without a blocklist (which defeats statelessness). They're often too large for cookies. Most "JWT for sessions" implementations reimplement sessions poorly.
- **When:** Server-side sessions for user auth. JWTs for S2S auth, API keys, and short-lived access tokens paired with refresh tokens.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Dependency Vulnerability SLAs
- **What:** Critical/High: patch within 48 hours. Medium: patch within 2 weeks. Low: next sprint. Run `npm audit` and Snyk/Socket.dev in CI — fail the build on Critical. Add behavioral analysis (Socket.dev) to catch threats CVE scanning misses. Pin exact versions.
- **Why:** Known vulnerabilities with public exploits are the easiest attack vector. SLAs prevent "we'll get to it" from becoming "we got breached." Behavioral analysis catches malicious packages before CVEs are assigned.
- **When:** Every project. Integrate into CI from day one. Review Snyk/audit reports weekly.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Prevent TypeScript-Specific Vulnerabilities
- **What:** Prototype pollution: freeze prototypes, use `Object.create(null)` for dictionaries, validate with Zod (strips `__proto__`). ORM injection: never interpolate user input into raw SQL — use parameterized queries exclusively. ReDoS: audit regexes with `safe-regex`, prefer Zod string validators over custom regex.
- **Why:** These are the top 3 TypeScript/Node.js-specific vulnerability classes. ORMs protect against SQL injection only when used correctly — `db.execute(sql`...${userInput}`)` in Drizzle is parameterized, string concatenation is not.
- **When:** Every TypeScript project. Add ESLint rules to flag raw SQL, unvalidated object spreads, and complex regex.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### SAST in CI, DAST Before Launch
- **What:** Static analysis: Semgrep (fast, custom rules, free tier) or CodeQL (GitHub-native, deeper analysis) in CI on every PR. Dynamic testing: OWASP ZAP against staging before major launches. Penetration testing annually or before handling payment/health data.
- **Why:** SAST catches vulnerability patterns before code ships. DAST finds runtime issues SAST can't (misconfigurations, auth bypasses). Neither replaces the other — use both.
- **When:** SAST from day one (add Semgrep to CI in 10 minutes). DAST before production launch. Pentesting before handling sensitive data.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Production Security Readiness Checklist
- **What:** Before production: (1) all inputs validated with Zod, (2) auth on every route, (3) HTTPS-only + HSTS, (4) security headers set, (5) CSP enforced, (6) secrets in manager not .env, (7) dependencies audited, (8) CORS configured per-environment, (9) rate limiting on public endpoints, (10) error responses don't leak internals, (11) logging captures security events, (12) SAST passing in CI.
- **Why:** A checklist prevents "we forgot to configure CORS" from becoming a breach. Run through it before every production deployment.
- **When:** Before first production deploy. Review quarterly.
- **Source:** [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md)

### Three-Layer Security for Agentic Code
- **What:** Secure AI-agent-generated code at three enforcement points: (1) **Pre-generation** — inject security context via CLAUDE.md instructions, OWASP skill (claude-code-owasp), and OpenSSF-recommended concrete rules (not "act as security expert"). (2) **In-flow scanning** — Semgrep MCP server for agent self-audit, Cursor hooks for deterministic enforcement on file edits. (3) **CI/CD gates** — Semgrep/Opengrep SAST, Bearer data flow analysis, Gitleaks secret detection, Trivy SCA, OWASP ZAP DAST.
- **Why:** ~25-40% of AI-generated code contains vulnerabilities. Single-layer security is insufficient because agents skip optional checks, pre-commit misses real-time feedback, and CI catches issues too late. Three layers provide defense-in-depth matching the velocity of agentic code generation.
- **When:** Every project using AI coding agents (Claude Code, Cursor, Copilot). Layer 1 (pre-generation context) takes 10 minutes. Layer 2 (Semgrep MCP) takes 5 minutes. Layer 3 (CI) is standard DevSecOps.
- **Source:** [research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md](../research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md)

### Deterministic Enforcement Over Prompt-Based Security
- **What:** Security scanning must run via system infrastructure (hooks, CI gates, MCP tool calls) — not via prompt instructions that agents can ignore or misapply. Cursor `afterFileEdit` hooks triggering Semgrep are the gold standard: the agent cannot skip the check. In Claude Code, use the Semgrep MCP server as the closest equivalent (agent-invoked but at least available). Never rely solely on "please check for security issues" instructions.
- **Why:** Research shows the "persona pattern" (telling AI to act as a security expert) actually *increases* vulnerabilities. Prompts are suggestions; hooks are guarantees. Security that depends on agent discretion will be skipped under time pressure or complex tasks.
- **When:** Always. Start with Semgrep MCP server (5-minute setup), graduate to Cursor hooks or equivalent when available.
- **Source:** [research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md](../research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md), [OpenSSF Guide](https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions)

### Treat AI-Generated Code as Untrusted
- **What:** All AI-generated code must pass the same rigor as third-party dependencies: automated SAST scanning, peer review, and sandbox testing before production. Specific AI failure modes to watch for: hardcoded secrets (~70% prevalence), permissive CORS, package hallucination (19.7% of suggested packages don't exist), deprecated crypto patterns, missing input validation. Use RCI (Recursive Criticism and Improvement) — ask the agent to review its own output for vulnerabilities, then improve — which reduces weaknesses by ~10x.
- **Why:** AI agents reproduce vulnerability patterns from training data reliably and at scale. They don't understand security implications — they pattern-match. The code looks correct and compiles, making vulnerabilities harder to spot in review.
- **When:** Every AI-generated code change. Build the scanning pipeline once; it runs automatically forever.
- **Source:** [research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md](../research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md), [OpenSSF Guide](https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions)

### Semgrep MCP as Minimum Agentic Security Integration
- **What:** Install the Semgrep MCP server (`uvx semgrep-mcp`) in every AI coding agent setup. Provides `security_check`, `semgrep_scan`, and custom rule scanning directly in the agent's tool palette. Free open-source engine, 30+ languages, 2,000+ rules, millisecond-per-file speed. For fully open-source: use Opengrep (LGPL-2.1 fork with taint analysis and inter-procedural scanning).
- **Why:** Lowest-friction, highest-coverage free security integration for agentic workflows. The agent can self-audit before presenting code. Combined with OWASP Top 10 + TypeScript rule packs, it catches the most common AI-generated vulnerability patterns.
- **When:** Every project using AI coding agents. 5-minute setup. Add to MCP config once; available in every session.
- **Source:** [research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md](../research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md), [Semgrep MCP](https://github.com/semgrep/mcp)

### Secret Detection is Non-Negotiable for AI Workflows
- **What:** Run Gitleaks or TruffleHog as both pre-commit hooks and CI gates. AI agents hallucinate and hardcode secrets (API keys, DB strings, JWT secrets) at high rates — this is the single most common AI-generated vulnerability. TruffleHog adds live verification (checks if detected secrets are active). Use both: Gitleaks for speed in pre-commit, TruffleHog for verification in CI.
- **Why:** A leaked secret in a public repo is exploited in minutes. AI agents don't understand the difference between placeholder and real credentials, and they reproduce credential patterns from training data. Secret detection is the highest-ROI security check for AI-generated code.
- **When:** Every project, from first commit. Pre-commit hook blocks secrets locally; CI gate catches anything that slips through.
- **Source:** [research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md](../research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-security-practices.md](../research/2026-02-14-security-practices.md).
- 2026-02-24: Added 5 agentic code security principles from [research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md](../research/2026-02-24-appsec-security-tooling-uses-in-agentic-engineering.md).

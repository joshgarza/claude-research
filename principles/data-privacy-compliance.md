# Data Privacy & Compliance Principles

## Summary
Practical privacy and compliance guidance for TypeScript/Node.js applications. Covers GDPR as the baseline framework, CCPA/CPRA layering, PII handling (field-level encryption, tokenization), data retention and deletion architecture, consent management, data classification, Privacy by Design, DPAs, cross-border transfers, and GDPR-compliant logging. Security-specific privacy controls (encryption, headers) are covered in security.md; this file focuses on regulatory compliance and data lifecycle.

## Related Principles (in other files)
- **security.md:** Encryption at rest/transit, CORS, CSP, dependency vulnerabilities
- **database-data-architecture.md:** RLS multi-tenancy, soft deletes, schema design
- **backend-api-engineering.md:** Zod validation, passkeys, server-side sessions

## Principles

### Lawful Basis Before Code
- **What:** Document your lawful basis for each data processing activity before writing the feature. Map every PII field to a specific lawful basis (contract, consent, legitimate interest, or legal obligation).
- **Why:** GDPR requires a lawful basis to exist *before* processing begins. Retroactive justification is non-compliant and creates legal risk. The ICO requires you to be able to demonstrate your choice.
- **When:** Every time you add a feature that collects, stores, or processes personal data. NOT needed for purely anonymous/aggregated data that cannot be linked to individuals.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Build for GDPR First, Layer Regional Requirements
- **What:** Use GDPR as your baseline compliance framework, then add jurisdiction-specific features (CCPA "Do Not Sell" toggle, COPPA age gates) as incremental overlays.
- **Why:** GDPR is the strictest and most comprehensive general privacy regulation. Meeting GDPR puts you at 80-90% compliance for CCPA/CPRA, LGPD, and most other privacy laws. Building for the lowest common denominator (e.g., CCPA opt-out only) creates expensive rework when you expand to EU markets.
- **When:** Always for new applications. NOT when building a product exclusively for a single non-EU market with no plans to expand.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Encrypt PII at the Field Level, Not Just the Disk
- **What:** Apply AES-256-GCM encryption to individual PII columns (email, phone, SSN) in your database, with keys managed in a KMS (AWS KMS, Vault). Use per-tenant or per-user key hierarchies. Add salted hash columns for searchability.
- **Why:** Disk-level encryption protects against physical theft but not application-layer breaches, SQL injection, or insider access. Field-level encryption ensures that even if the database is compromised, PII remains unreadable without KMS access. Per-user keys enable cryptographic erasure (destroy the key = destroy the data).
- **When:** For any PII classified as Confidential or Restricted (names, emails, phone numbers, financial data, health data). NOT needed for Public or Internal-only data.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Implement Soft-TTL + Hard-TTL Deletion
- **What:** On an erasure request, immediately soft-delete (block all access, purge caches/search indexes) within seconds. After a documented grace period (7-30 days), hard-delete or cryptographically erase all PII. Maintain a `deletion_ledger` so backup restores can replay erasures.
- **Why:** Immediate hard-delete risks data loss from fraud, pending transactions, or accidental requests. Pure soft-delete (flagging records as deleted) does not satisfy GDPR Art. 17 because the data still exists and is recoverable. The two-phase approach gives operational safety while meeting the legal standard.
- **When:** For all user-facing deletion features and DSAR (Data Subject Access Request) processing. NOT for internal data retention that has a separate legal basis (e.g., tax records).
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Consent Must Be Granular, Auditable, and Instantly Revocable
- **What:** Store consent per-purpose (marketing, analytics, third-party sharing) with full provenance (timestamp, UI version, policy version, mechanism). Implement real-time propagation on withdrawal. Provide a persistent, no-login-required mechanism for withdrawal (footer widget).
- **Why:** Bundled consent ("agree to everything") is invalid under GDPR. Consent without provenance records is unenforceable during audits. Delayed withdrawal propagation means you are processing data without lawful basis during the lag.
- **When:** For every processing activity where consent is the lawful basis (marketing emails, non-essential cookies, optional analytics, third-party data sharing). NOT for processing based on contract or legal obligation.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Block Non-Essential Cookies Until Explicit Consent
- **What:** Implement prior consent blocking: no analytics, marketing, or third-party cookies/pixels/local storage may fire until the user explicitly opts in per category. Use server-side consent storage alongside client-side for auditability. Retain consent logs for at least 5 years.
- **Why:** The ePrivacy Directive (Article 5(3)) requires opt-in consent for all non-essential storage/access on user devices. Showing a banner while cookies already fire is a violation. Cumulative GDPR fines have reached EUR 5.65 billion as of March 2025, with consent violations among the most frequently enforced.
- **When:** For any web application serving EU users that uses analytics, advertising, or third-party tracking. NOT needed for strictly necessary cookies (session management, load balancing, security).
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Never Log Raw PII
- **What:** Pseudonymize all personal data in application logs. Log hashed user IDs (not emails), mask IP addresses, redact request/response bodies containing PII. Set log retention to 6-12 months for security logs, 30-90 days for operational logs. Automate purging.
- **Why:** Logs are the most common unintentional PII store. They are often retained indefinitely, replicated across monitoring systems, and accessed by broad engineering teams. A data breach of logs can expose PII that was never meant to be stored there. Logs containing PII are also subject to DSAR and erasure requests, which is operationally painful.
- **When:** Always. Every application log, error log, and audit log. NOT for audit trail entries that intentionally record data access patterns (but even those should use pseudonymized identifiers).
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Maintain a Living Data Map
- **What:** Create and maintain a machine-readable inventory of every PII field in your system: what it is, where it lives (databases, caches, third-party services, backups), its lawful basis, its retention period, and its classification tier. Automate PII scanning in CI/CD to catch drift.
- **Why:** You cannot comply with GDPR Article 30 (Records of Processing Activities), respond to DSARs, or implement deletion requests without knowing where all PII lives. Manual inventories go stale within weeks. The data map is the foundation for every other privacy control.
- **When:** From day one of any project that handles personal data. Update on every schema migration or new third-party integration. NOT a one-time compliance exercise.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### DPAs Are Not Optional for Any Third-Party That Touches User Data
- **What:** Maintain a register of all data processors. Verify every SaaS vendor, cloud provider, and subcontractor has a signed DPA before sending them any personal data. Review DPAs annually. Verify sub-processor lists and notification mechanisms.
- **Why:** GDPR Article 28 makes the controller liable for processor violations if there is no DPA in place. Most major vendors (Stripe, AWS, Vercel, Auth0) have pre-signed DPAs available on their websites -- but you must actually execute them. Without a DPA, every API call that sends PII to a third party is a compliance violation.
- **When:** Before integrating any new third-party service that will receive, store, or process personal data. During annual compliance reviews. NOT needed for services that only receive anonymized or aggregated data.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Use TypeScript's Type System to Enforce Privacy Rules
- **What:** Create branded/opaque types for PII fields (`type Email = string & { __brand: 'PII_Email' }`). Build middleware that strips PII-branded fields from log serialization. Use discriminated unions for consent states. Type-check that PII fields are encrypted before database writes.
- **Why:** Runtime PII handling mistakes (logging an email, returning a SSN in an API response, storing unencrypted PII) are the most common privacy bugs. TypeScript's type system can catch many of these at compile time, shifting privacy enforcement left in the development process.
- **When:** In any TypeScript/Node.js application handling PII. Especially valuable in teams where not every developer is privacy-trained. NOT a substitute for runtime controls (encryption, access control), but a powerful complement.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Design Data Portability as a First-Class API
- **What:** Build a `/users/:id/export` endpoint that returns all user-provided data in JSON format. Include profile data, content, transactions, consent records, and communication preferences. Exclude derived/inferred data (risk scores, internal notes). Support both download and machine-to-machine transfer.
- **Why:** GDPR Article 20 requires data to be provided in a structured, commonly used, machine-readable format. Building this as an afterthought means crawling across dozens of services to assemble a response. Building it as a first-class API from day one also forces good data architecture -- you must know where all user data lives.
- **When:** From the first version of any SaaS application that stores user data. Scale the implementation as the data model grows. NOT needed for data the user did not provide (analytics derived from their behavior).
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

### Verify Cross-Border Transfer Mechanisms for Every Vendor
- **What:** For each third-party service processing EU personal data, verify one of: (a) the service operates in an adequate jurisdiction, (b) the vendor is EU-US DPF certified (check dataprivacyframework.gov), or (c) the DPA includes current EU SCCs. Document the mechanism in your ROPA. Re-verify annually or on vendor change.
- **Why:** Cross-border transfer violations carry heavy fines (Meta was fined EUR 1.2 billion in 2023). The EU-US DPF survived legal challenge in September 2025 but remains politically fragile (PCLOB staffing risk). SCCs are the reliable fallback but require a Transfer Impact Assessment. Ignorance of where your data flows is not a defense.
- **When:** During vendor onboarding, annual compliance reviews, and whenever a vendor changes their infrastructure or sub-processors. NOT needed for data that never leaves the EU or adequate jurisdictions.
- **Source:** [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md)

## Revision History
- 2026-02-14: Initial extraction from [research/2026-02-14-data-privacy-compliance.md](../research/2026-02-14-data-privacy-compliance.md).

---
date: 2026-02-14
topic: Data Privacy and Compliance
status: complete
tags: [gdpr, ccpa, privacy, pii, consent, data-retention, right-to-deletion, data-portability, dpa, coppa]
related: [2026-02-14-security-practices.md]
---

# Data Privacy and Compliance

## Context

Data privacy and compliance were identified as a gap in the principles knowledge bank. With GDPR cumulative fines reaching EUR 5.65 billion by March 2025, the EU-US Data Privacy Framework surviving legal challenge in September 2025, and CPRA enforcement maturing, privacy compliance is a legal requirement for any application handling personal data. This research covers GDPR practical implementation, CCPA/CPRA differences, PII handling patterns, data retention, right to deletion, data portability, consent management, data classification, Privacy by Design, DPAs, children's data (COPPA), cross-border transfers, and GDPR-compliant logging.

Key sources: ICO (UK), CNIL (France), EDPB, OWASP, GDPR.eu, IAPP, Auth0 GDPR docs, Stripe Privacy Center, AWS Data Classification, FTC COPPA guidance.

## Findings

### 1. GDPR Practical Implementation for TypeScript/Node.js Applications

**Lawful Basis**

GDPR Article 6 requires a lawful basis for every processing activity. The six lawful bases are: consent, contract, legal obligation, legitimate interests, vital interests, and public task. Per the [ICO's Lawful Basis Guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/), you must identify and document your lawful basis *before* processing begins. You cannot retroactively change your lawful basis. The ICO provides an [interactive guidance tool](https://ico.org.uk/for-organisations/gdpr-resources/lawful-basis-interactive-guidance-tool/) to help determine which basis applies.

For most SaaS applications:
- **Contract** (Art. 6(1)(b)): Processing necessary to deliver the service the user signed up for. This is the workhorse basis for core functionality.
- **Legitimate interests** (Art. 6(1)(f)): Analytics, fraud prevention, security logging. Requires a documented Legitimate Interests Assessment (LIA) balancing your interests against the data subject's rights.
- **Consent** (Art. 6(1)(a)): Marketing emails, optional tracking, non-essential cookies. Must be freely given, specific, informed, and unambiguous. Must be as easy to withdraw as to give.
- **Legal obligation** (Art. 6(1)(c)): Tax records, financial reporting, regulatory retention requirements.

**CNIL Developer Guide**

The [CNIL GDPR Developer Guide](https://lincnil.github.io/GDPR-Developer-Guide/) (available on [GitHub](https://github.com/LINCnil/GDPR-Developer-Guide)) is the single best practical resource for developers. It contains 16 sheets covering:
- Sheet 1: Identify personal data
- Sheet 2: Prepare your development
- Sheet 4: Manage users' profiles (access control, role-based permissions)
- Sheet 5: Make an informed choice of architecture
- Sheet 6: Secure your websites, applications and servers
- Sheet 7: Minimize data collection
- Sheet 10: Ensure quality of code (minimize PII in logs)
- Sheet 12: Encrypt, hash or sign
- Sheet 13: Prepare for the exercise of people's rights
- Sheet 14: Define a data retention period

Key technical recommendations from CNIL:
- Encrypt internal flows using TLS, IPsec, or SSH
- Use AES-256 for encryption at rest
- Hash passwords with bcrypt, scrypt, or Argon2
- Pseudonymize data using cryptographic hashing (e.g., HMAC) when full anonymization is not feasible
- Implement unique, individual user identifiers with differentiated access management (read/write/delete) by role
- Provide downloadable data export in CSV, XML, or JSON for data portability

Source: [CNIL GDPR Developer's Guide](https://www.cnil.fr/en/gdpr-developers-guide)

### 2. CCPA/CPRA Requirements and How They Differ from GDPR

Key differences for developers building applications that serve both EU and California users:

| Aspect | GDPR | CCPA/CPRA |
|--------|------|-----------|
| Consent model | Opt-in (must get consent before processing) | Opt-out (can process, must honor "Do Not Sell/Share") |
| Scope | All personal data of EU residents | Personal info of California residents; revenue/data thresholds apply |
| Sensitive data | Requires explicit consent (Art. 9) | CPRA requires opt-in for "sensitive personal information" |
| Right to correct | Yes (Art. 16) | Yes (added by CPRA) |
| Right to delete | Yes (Art. 17) | Yes, with broader exceptions for business needs |
| Private right of action | Limited (via supervisory authorities) | Yes, for data breaches involving unencrypted/unhashed PII |
| DPIAs | Required for high-risk processing | CPRA requires "risk assessments" for significant processing |

**CPRA additions over CCPA** (effective January 1, 2023, enforced from 2024):
- New category of "sensitive personal information" (SSN, financial accounts, precise geolocation, biometrics, health, sex life, racial/ethnic origin)
- Right to limit use of sensitive personal information
- Mandatory cybersecurity audits for high-risk processors
- Data minimization and purpose limitation requirements (bringing it closer to GDPR)

**Implementation note**: If you build for GDPR compliance first, you cover most CCPA/CPRA requirements. The main addition is implementing a "Do Not Sell or Share My Personal Information" mechanism and handling the "sensitive personal information" category.

Sources: [Ketch GDPR vs CCPA comparison](https://www.ketch.com/blog/posts/gdpr-ccpa-cpra-compliance-what-the-difference), [DataGuidance comparison PDF](https://www.dataguidance.com/sites/default/files/gdpr_v_ccpa_and_cpra_v6.pdf)

### 3. PII Detection and Handling Patterns

**Identifying PII in Data Flows**

The [OWASP User Privacy Protection Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html) recommends creating a PII data flow map that tracks personal data from collection through storage, processing, and deletion. This map should identify every system, service, and database that touches PII.

PII categories to track:
- **Direct identifiers**: Name, email, phone, SSN, passport number, biometrics
- **Indirect identifiers**: IP address, device ID, cookie ID, geolocation, behavioral data
- **Sensitive data**: Health, financial, racial/ethnic, sexual orientation, political opinions, religious beliefs

**Node.js/TypeScript PII Detection Libraries**:
- `redact-pii` (TypeScript): Pattern-based detection and redaction, supports Google DLP integration for broader coverage
- `@coffeeandfun/remove-pii`: Automated detection and removal from text
- `pii-filter`: Detection, parsing, and removal from strings and objects
- Microsoft Presidio (open source): Framework for detecting and anonymizing PII across text and structured data

Source: [redact-pii on npm](https://www.npmjs.com/package/redact-pii), [OWASP Privacy Controls](https://owasp.org/www-project-mobile-top-10/2023-risks/m6-inadequate-privacy-controls)

**Field-Level Encryption**

FLE encrypts individual database fields rather than entire tables or volumes. This is appropriate when:
- You need to query non-sensitive columns while protecting PII columns
- Different fields have different access requirements
- You want defense-in-depth beyond disk-level encryption

Implementation approach in Node.js:
- Use AES-256-GCM for field encryption (via Node.js `crypto` module or `jose` library for JWE)
- Store encryption keys in a KMS (AWS KMS, HashiCorp Vault), never in the application database
- Create a per-field or per-tenant key hierarchy to limit blast radius
- Add a salted hash column alongside encrypted PII fields for indexing/search (search the hash, decrypt only when needed)

**Tokenization**

Tokenization replaces PII with a non-reversible token; the mapping lives in a separate token vault. Stripe's model is exemplary: PII tokens are single-use, created via API, and the actual data never touches the merchant's servers.

Use tokenization when:
- The same PII appears in multiple systems (centralize the real data in one vault)
- You need to comply with PCI-DSS (credit card tokenization)
- You want to decouple PII from analytics/processing pipelines

Use field-level encryption when:
- PII lives in a single database and needs reversible access
- You need to decrypt for legitimate processing

Source: [Stripe Encryption vs Tokenization](https://stripe.com/resources/more/encryption-vs-tokenization-how-they-are-different-and-how-they-work-together), [Skyflow Tokenization vs Encryption](https://www.skyflow.com/post/tokenization-vs-encryption-and-when-to-use-them)

### 4. Data Retention Policies

**Implementation Strategy**

Per [IAPP guidance](https://iapp.org/news/a/how-to-draft-a-gdpr-compliant-retention-policy), data retention policies must:
1. Map every data category to a specific retention period with legal justification
2. Document the justification (legal requirement, business need, contractual obligation)
3. Automate deletion at expiry using TTL mechanisms or scheduled jobs
4. Handle different retention periods for different data categories within the same record

**Technical Implementation Patterns**:

- **Database TTL fields**: Add `expires_at` or `retain_until` columns. Run nightly/hourly cleanup jobs. PostgreSQL does not have native TTL, so use cron + DELETE queries. MongoDB has native TTL indexes. Redis has native key expiry.
- **Tiered retention**: Raw data (30-90 days) -> anonymized aggregates (1-3 years) -> permanent aggregates (no PII). Transform before archiving.
- **Audit trail retention**: Audit logs containing access/modification records should be retained for 6-24 months depending on regulatory requirements. Logs that contain PII (e.g., who accessed what user record) must themselves have retention limits. CNIL recommends a 6-month retention for traceability logs, with a maximum of 12-13 months.
- **Financial/tax records**: Typically 7 years (varies by jurisdiction). These override GDPR's data minimization principle where legal obligations apply.

**Practical recommendations**:
- Use a centralized retention schedule that maps (data_category, jurisdiction) -> retention_period
- Implement deletion as a background job with retry logic and logging
- Never delete without recording what was deleted and when (the deletion log itself should not contain PII)
- Test that disaster recovery restores do not resurface deleted data

Source: [IAPP Data Retention Best Practices](https://iapp.org/resources/article/data-retention-policy-best-practices-template/), [CNIL Traceability Retention](https://iapp.org/news/a/cnil-releases-draft-recommendation-on-retention-of-traceability-data)

### 5. Right to Deletion (GDPR Art. 17)

**Practical Implementation**

The [ICO's right to erasure guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/) clarifies that the right is not absolute. You can refuse when processing is necessary for:
- Freedom of expression
- Legal obligation compliance
- Public health
- Archiving in the public interest / scientific research
- Establishment, exercise, or defense of legal claims

**Deletion Architecture (Soft TTL + Hard TTL pattern)**:

1. **Soft delete (immediate)**: On receiving a validated erasure request, immediately mark the user record as deleted. All API reads return 404 / empty. Search indexes purged. Cache entries evicted. The user can no longer log in. This should happen within seconds.

2. **Grace period (soft TTL)**: Hold data in a "tombstone" state for a short period (7-30 days) to handle edge cases: pending transactions, fraud investigation windows, support disputes. During this period, the data exists but is not accessible through normal application paths.

3. **Hard delete (hard TTL)**: Irreversibly purge all PII. Options:
   - DELETE rows from database
   - Overwrite PII fields with NULL / anonymized placeholders while retaining non-personal transactional data (e.g., keep order records but replace customer name with "DELETED_USER_12345")
   - Destroy per-user encryption keys if using envelope encryption (renders encrypted data unrecoverable without touching every row)

4. **Backup handling**: Per [VeraSafe's analysis](https://verasafe.com/blog/do-i-need-to-erase-personal-data-from-backup-systems-under-the-gdpr/), GDPR does not provide a backup exemption. However, the ICO acknowledges practical limitations: if deletion from backups is technically infeasible, document why, inform the data subject, and ensure that backup restoration processes include a step to re-apply erasure requests (maintain a `deletion_ledger` that runs on restore).

5. **Third-party propagation**: Article 17(2) requires controllers to inform other controllers processing the data. In practice: send deletion webhooks/API calls to all processors (analytics, CRM, email providers, etc.). Track confirmation. Log the propagation.

**Audit trail paradox**: You need to record that a deletion happened (for compliance auditing) but the log entry itself cannot contain the deleted PII. Solution: log the request ID, timestamp, categories of data deleted, and systems notified. Do NOT log the user's name, email, or other PII in the deletion audit trail.

Sources: [GDPRhub Article 17](https://gdprhub.eu/Article_17_GDPR), [ICO Right to Erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)

### 6. Right to Data Portability

GDPR Article 20 requires data to be provided in a "structured, commonly used and machine-readable format." Per [ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-data-portability/):

- Applies only to data processed on the basis of consent or contract
- Applies only to data the individual *provided* (not derived/inferred data)
- Must respond within one month
- JSON is the recommended format for complex nested data; CSV for flat/tabular data
- Must support direct controller-to-controller transfer "where technically feasible"

**Implementation for a TypeScript/Node.js app**:
- Build an API endpoint (`GET /api/users/:id/export`) that gathers all user-provided data across your systems
- Output as JSON (preferred) or CSV with clear field descriptions
- Include: profile data, content created, transaction history, consent records, communication preferences
- Exclude: derived analytics, risk scores, internal notes about the user
- Provide both download and machine-to-machine transfer options
- Auth0 recommends building this as a dedicated GDPR endpoint in your API

Source: [Auth0 GDPR Data Portability](https://auth0.com/docs/secure/data-privacy-and-compliance/gdpr/gdpr-data-portability), [ICO Right to Data Portability](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-data-portability/)

### 7. Consent Management

**Architecture**

Modern consent management requires dual-layer storage:
- **Client-side** (browser storage/cookies): For immediate script-blocking decisions (which cookies/trackers to load)
- **Server-side** (database): Tamper-proof audit trail, cross-device synchronization, regulatory evidence

Per [CNIL Sheet 13](https://www.cnil.fr/en/sheet-ndeg13-prepare-exercise-peoples-rights), consent records must capture: what was consented to, when, how consent was given (the exact UI presented), and the version of the privacy policy at the time.

**Consent data model** (minimum viable):

```typescript
interface ConsentRecord {
  userId: string;
  consentType: string;       // e.g., 'marketing_email', 'analytics_cookies', 'third_party_sharing'
  granted: boolean;
  grantedAt: Date;
  withdrawnAt?: Date;
  mechanism: string;          // e.g., 'cookie_banner_v3', 'signup_form', 'preference_center'
  policyVersion: string;      // version of privacy policy shown
  ipAddress?: string;         // optional, for evidence
  userAgent?: string;         // optional, for evidence
}
```

**Withdrawal requirements**:
- Must be as easy as granting consent (GDPR Art. 7(3))
- Must propagate in real-time across all processing systems
- Must not require account login (a persistent footer widget is the standard pattern)
- Withdrawal is prospective only -- processing that occurred before withdrawal remains lawful

**Cookie consent specifics**:
- The ePrivacy Directive (Article 5(3)) requires prior opt-in consent for all non-essential cookies and similar technologies (local storage, pixels, fingerprinting)
- The European Commission withdrew the ePrivacy Regulation proposal in February 2025, so the existing Directive remains law
- Non-essential cookies must be blocked until explicit consent. Simply showing a banner while cookies fire is a violation.
- Consent must be granular (analytics vs. marketing vs. functional)
- CNIL's 2025 consultation signals that email tracking pixels may also require explicit consent

Source: [GDPR.eu Cookies](https://gdpr.eu/cookies/), [OneTrust CMP](https://www.onetrust.com/products/cookie-consent/)

### 8. Data Classification Tiers

Standard four-tier model with handling rules per tier:

**Public**
- Definition: Information intended for public consumption (marketing content, public docs)
- Handling: No encryption required. No access control needed. Can be cached on CDNs.

**Internal**
- Definition: Business information not meant for external sharing (internal memos, non-sensitive configs)
- Handling: Require authentication for access. Basic access logging. No special encryption beyond TLS in transit.

**Confidential**
- Definition: PII, customer data, financial records, business plans, API keys
- Handling: Encryption at rest (AES-256) and in transit (TLS 1.2+). Role-based access control with principle of least privilege. All access logged and auditable. Data loss prevention (DLP) scanning on egress. Data Processing Agreements with any third party that handles it.

**Restricted**
- Definition: Highly sensitive PII (health data, biometrics, payment credentials), trade secrets, encryption keys
- Handling: Field-level encryption or tokenization. Multi-factor authentication for access. Continuous monitoring. Minimal copies across systems. Data must be masked or anonymized in non-production environments. Never stored in logs.

Source: [AWS Data Classification](https://docs.aws.amazon.com/whitepapers/latest/data-classification/data-classification-models-and-schemes.html), [OWASP Data Protection](https://top10proactive.owasp.org/archive/2018/c8-protect-data-everywhere/)

### 9. Privacy by Design

The [EDPB Guidelines 4/2019](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42019-article-25-data-protection-design-and_en) on Article 25 make Privacy by Design a legal obligation, not just a best practice. The seven foundational principles (Cavoukian) map to concrete engineering practices:

1. **Proactive not reactive**: Threat model for privacy during design phase. Add privacy to your Definition of Done.
2. **Privacy as default**: Ship features with the most restrictive data settings. Opt-in, not opt-out. Don't pre-check consent boxes.
3. **Privacy embedded in design**: Data minimization at the schema level. Don't add "nice to have" PII fields. Every column that stores PII must have a documented purpose and retention period.
4. **Full functionality (positive-sum)**: Privacy and functionality are not a tradeoff. Example: privacy-preserving analytics (aggregate, don't track individuals).
5. **End-to-end security**: Encryption in transit, at rest, and in use. Secure the full lifecycle from collection to deletion.
6. **Visibility and transparency**: Clear privacy policies, machine-readable consent records, accessible data export endpoints.
7. **Respect for user privacy**: User-facing controls for data access, export, deletion, consent management.

**Practical implementation checklist for a TypeScript app**:
- Run PII scanning in CI/CD to catch accidental PII in logs or test fixtures
- Use TypeScript's type system to create branded types for PII fields (e.g., `type Email = string & { __brand: 'email' }`) that enforce handling rules at compile time
- Default database queries to exclude soft-deleted records
- Implement data masking middleware for non-production environments
- Apply purpose limitation at the API layer: endpoints should return only the fields needed for that feature

Source: [EDPB Privacy by Design Guidelines](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201904_dataprotection_by_design_and_by_default_v2.0_en.pdf), [IAPP Privacy by Design Principles](https://iapp.org/media/pdf/resource_center/pbd_implement_7found_principles.pdf)

### 10. Data Processing Agreements (DPAs)

**When You Need One**

GDPR Article 28(3) requires a DPA whenever a controller engages a processor to handle personal data. In practice, you need a DPA with:
- Cloud hosting providers (AWS, GCP, Azure)
- SaaS tools that process user data (Stripe, SendGrid, Intercom, Mixpanel)
- Analytics providers
- Customer support tools
- Any subcontractor or freelancer who accesses user data

**What They Must Cover** (Article 28(3)):
- Subject matter, duration, nature, and purpose of processing
- Type of personal data and categories of data subjects
- Obligations and rights of the controller
- Processor processes data only on documented instructions from the controller
- Persons authorized to process data are bound by confidentiality
- Processor implements appropriate technical and organizational security measures
- Sub-processing only with controller's written authorization
- Processor assists with data subject rights requests
- Processor deletes or returns all data on termination
- Processor allows and contributes to audits
- Processor immediately informs controller if an instruction infringes GDPR

**Practical note for startups**: Most major SaaS vendors (Stripe, AWS, Auth0, Vercel) have pre-signed DPAs available on their websites. You should download and countersign these as part of your vendor onboarding process, and maintain a register of all DPAs.

Source: [GDPR.eu DPA Template](https://gdpr.eu/data-processing-agreement/), [Stripe Privacy Center](https://stripe.com/legal/privacy-center)

### 11. Children's Data (COPPA)

**COPPA applies** if your service is directed to children under 13 (US) or if you have actual knowledge that users are under 13. The FTC finalized major COPPA updates in 2025 (effective June 23, 2025, compliance deadline April 22, 2026).

Key requirements:
- **Verifiable parental consent** before collecting any personal information from children under 13
- Acceptable consent methods: signed consent form, credit card verification, toll-free phone call, video conference, government ID face-match
- **Clear privacy notice** specifically addressing children's data practices
- **Data minimization**: Cannot condition a child's participation on collecting more data than necessary
- **Data retention limits**: Cannot retain children's data longer than reasonably necessary
- **Security**: Must maintain reasonable security measures

**GDPR Children's Data** (Article 8): Consent for "information society services" requires parental consent for children under 16 (member states can lower to 13). The UK sets this at 13. The [ICO's Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/annex-c-lawful-basis-for-processing/) provides extensive guidance.

**Implementation approach**:
- Implement age-gating during registration
- If a user indicates they are under 13 (US) or the applicable age threshold, do NOT collect data until parental consent is verified
- Store consent verification records
- Provide a separate, simplified privacy notice for children
- Build a parental dashboard for consent management and data review

Source: [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [ICO Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/)

### 12. Cross-Border Data Transfers

**Transfer Mechanisms** (ranked by simplicity):

1. **Adequacy decisions**: The EU has recognized certain countries as providing adequate data protection. You can transfer data freely to these countries. Key adequacy decisions:
   - **EU-US Data Privacy Framework (DPF)**: Adopted July 2023. Upheld by EU General Court in September 2025. US companies must self-certify via [dataprivacyframework.gov](https://www.dataprivacyframework.gov/). Note: Political risk remains due to PCLOB staffing concerns.
   - **UK**: Extended until 2031 (EDPB Opinion October 2025). UK continues to be deemed essentially equivalent.
   - **Brazil**: Draft adequacy decision published September 2025, EDPB positive opinion October 2025.
   - Others: Japan, South Korea, Canada (commercial), Israel, Switzerland, etc.

2. **Standard Contractual Clauses (SCCs)**: Pre-approved contractual templates from the European Commission. Required when transferring to a country without an adequacy decision and not covered by another mechanism. Must be supplemented with a Transfer Impact Assessment (TIA) evaluating the destination country's laws.

3. **Binding Corporate Rules (BCRs)**: For intra-group transfers within multinational organizations. Expensive and slow to set up (requires DPA approval).

**Practical approach for a Node.js SaaS**:
- Verify all cloud infrastructure providers have DPAs with SCCs or operate in adequate jurisdictions
- If using US-based SaaS (most common), verify the vendor is DPF-certified OR has SCCs in their DPA
- Cloudflare's [Data Localization Suite](https://www.cloudflare.com/data-localization/) allows controlling where data is inspected and stored for edge processing
- AWS supports data residency controls through region selection and dedicated infrastructure
- Document all transfers in your Record of Processing Activities (ROPA)

Source: [EU Commission SCCs](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en), [Cloudflare Data Localization](https://blog.cloudflare.com/introducing-the-cloudflare-data-localization-suite/)

### 13. GDPR-Compliant Logging

Per the [CNIL Security Practice Guide (2024)](https://www.cnil.fr/en/practice-guide-security-personal-data-2024-edition) and [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html):

- **Minimize PII in logs**: Never log passwords, tokens, full credit card numbers, or session IDs. Log user identifiers only when necessary for security/audit purposes.
- **Encrypt logs at rest**: Use AES-256-GCM. If using cloud logging (CloudWatch, Datadog), verify the provider encrypts at rest.
- **Set retention periods**: 6-12 months for security logs, 30-90 days for operational logs. Automate purging.
- **Pseudonymize where possible**: Log hashed user IDs instead of emails. If you need to correlate back, maintain a separate lookup table with restricted access.
- **Access control**: Restrict log access to security/ops teams. Log who accesses the logs (meta-audit).
- **HSTS, TLS**: All log transport must be encrypted. Enable HSTS headers.

Source: [CNIL Security Guide 2024](https://www.cnil.fr/sites/default/files/2024-03/cnil_guide_securite_personnelle_ven_0.pdf)

## Open Questions

1. **AI and GDPR:** How does GDPR apply to LLM training data, RAG retrieval of PII, and AI-generated content about individuals? The EU AI Act interacts with GDPR but boundaries are unclear.
2. **Privacy-preserving analytics:** What are the best self-hosted alternatives to Google Analytics that avoid cookie consent requirements entirely? (Plausible, Umami, Fathom)
3. **GDPR enforcement trends:** Which DPAs are most active in enforcement? How do fine amounts correlate with company size?
4. **ePrivacy Regulation:** The EU withdrew the proposal in February 2025. What's the status and timeline for a replacement?

## Extracted Principles

12 principles extracted to [principles/data-privacy-compliance.md](../principles/data-privacy-compliance.md):

1. Lawful Basis Before Code
2. Build for GDPR First, Layer Regional Requirements
3. Encrypt PII at the Field Level, Not Just the Disk
4. Implement Soft-TTL + Hard-TTL Deletion
5. Consent Must Be Granular, Auditable, and Instantly Revocable
6. Block Non-Essential Cookies Until Explicit Consent
7. Never Log Raw PII
8. Maintain a Living Data Map
9. DPAs Are Not Optional for Any Third-Party That Touches User Data
10. Use TypeScript's Type System to Enforce Privacy Rules
11. Design Data Portability as a First-Class API
12. Verify Cross-Border Transfer Mechanisms for Every Vendor

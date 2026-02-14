# Research Backlog

Gap analysis of principles needed to guide a software project from demo to full-scale deployment. Ordered by priority.

## Status Key
- `pending` — Not yet researched
- `in-progress` — Currently being researched
- `complete` — Research done, principles extracted

## Critical (blocks going to production)

- [x] **Testing Strategy** — `complete`
  Testing pyramid/trophy, unit testing philosophy, integration testing patterns, contract testing, load/performance testing, test data management, snapshot and property-based testing.

- [x] **Database & Data Architecture** — `complete`
  Database selection guidance, schema design patterns, indexing strategy, connection pooling, read replicas, horizontal scaling triggers, backup/recovery, multi-tenant data modeling.

- [x] **Security (holistic)** — `complete`
  Consolidate scattered coverage into unified file. OWASP Top 10 mapped to TypeScript stack, rate limiting, CORS/CSP/security headers, encryption at rest and in transit, API security, dependency vulnerability workflow, production readiness checklist.

- [x] **Error Handling & Resilience Patterns** — `complete`
  Error taxonomy, circuit breakers, bulkheads, timeouts, retry with backoff+jitter, graceful degradation, dead letter queues, health checks and readiness probes.

## Important (needed before real users at scale)

- [x] **Performance & Scalability** — `complete`
  Backend profiling, connection pooling patterns, CDN strategy, horizontal vs vertical scaling decisions, load balancing, database query optimization, rate limiting as scalability tool.

- [x] **Data Privacy & Compliance** — `complete`
  GDPR/CCPA practical implementation, PII handling, data retention, right-to-deletion, audit logging architecture, consent management, data classification.

- [x] **API Versioning & Evolution** — `complete`
  Versioning strategies, backwards compatibility rules, deprecation workflow, OpenAPI documentation generation, SDK generation, breaking change detection in CI.

- [x] **Accessibility** — `complete`
  WCAG 2.2 compliance levels, semantic HTML and ARIA, keyboard navigation, automated a11y testing (axe-core in Playwright), screen reader testing.

## Moderate (valuable at scale but not blocking)

- [ ] **Real-time & Event-Driven Architecture** — `pending`
  WebSocket vs SSE vs polling decision framework, event sourcing, CQRS, pub/sub design, eventual consistency in UI.

- [ ] **Migration & Legacy Modernization** — `pending`
  Strangler fig pattern, parallel old/new systems, data migration at scale, feature parity tracking.

- [ ] **Team & Process Practices** — `pending`
  Code review standards, ADRs, technical debt tracking, on-call from the dev side, documentation standards.

- [ ] **Search, Analytics & Product Observability** — `pending`
  Full-text search (Meilisearch/Typesense vs Elasticsearch), event tracking architecture, A/B testing infrastructure, business metrics dashboards.

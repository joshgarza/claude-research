# Web Crawling

## Summary

Principles for adopting managed crawl APIs, especially Cloudflare Browser Rendering `/crawl`, without overbuilding or abusing the crawl surface. The central decision is which crawl boundary you actually need: single-page fetch, bounded site crawl, managed site sync, or a custom crawler. Start with the narrowest and cheapest option, stay respectful of site controls, and treat crawl output as durable artifacts rather than transient text.

## Principles

### Choose The Crawl Surface By Control Boundary
- **What:** Use a single-page scrape endpoint for one-page extraction, a bounded crawl endpoint such as Cloudflare `/crawl` for one-site traversal jobs, a managed site-sync/indexing product for your own site search, and a custom crawler only when you need explicit frontier, recrawl, or cross-domain control.
- **Why:** Most teams reach for too much crawler infrastructure too early. The wrong boundary either adds avoidable engineering work or hides crawl behavior you actually need to control.
- **When:** At the start of any crawling or content-ingestion design. Re-evaluate when the workload shifts from ad hoc extraction to scheduled indexing or multi-domain crawling.
- **Source:** [research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md](../research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md)

### Set Explicit Crawl Bounds
- **What:** Always set crawl bounds such as page limit, depth, discovery source, and include/exclude path filters explicitly instead of relying on managed-crawl defaults.
- **Why:** Cloudflare `/crawl` defaults are permissive enough to surprise you, especially when sitemap and link discovery are both enabled. Explicit bounds keep the crawl aligned with intent and budget.
- **When:** Any managed crawl job beyond quick experimentation, especially docs, blog, and changelog crawls where site structure can expose more URLs than expected.
- **Source:** [research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md](../research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md)

### Start Static-First, Then Earn Full Rendering
- **What:** Default to static extraction, markdown output, low page caps, and shallow depth. Turn on JavaScript execution, screenshots, or richer extraction only when the target site demonstrably requires them.
- **Why:** Full browser rendering increases cost, latency, and failure modes. Static-first crawling is faster, cheaper, and easier to reason about.
- **When:** Any new site crawl, especially docs, blogs, changelogs, and marketing sites. Escalate only after verifying that important content is missing from the static response.
- **Source:** [research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md](../research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md)

### Treat Robots, Sitemaps, And Allowlists As Core Inputs
- **What:** Design the crawl around `robots.txt`, sitemap quality, crawl-delay behavior, and any required security allowlisting before tuning concurrency or extraction.
- **Why:** Crawl correctness and throughput are constrained by site-owner controls first. Ignoring those inputs leads to brittle pipelines, missing coverage, or immediate blocking.
- **When:** Always. This is especially important for Cloudflare-protected sites, authenticated targets, and any workload where polite crawling matters.
- **Source:** [research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md](../research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md)

### Model Crawl Jobs As Async Artifact Pipelines
- **What:** Persist crawl job IDs, page metadata, extracted content, timing, and failure state rather than wrapping a crawl in a single synchronous helper.
- **Why:** Crawls are naturally asynchronous, partial, and retry-prone. Artifact-first modeling makes monitoring, reprocessing, and downstream extraction much simpler.
- **When:** Any multi-page crawl integration, even small ones. It matters most when a crawl feeds queues, background workers, or later post-processing stages.
- **Source:** [research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md](../research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md)

## Revision History
- 2026-03-14: Initial extraction from [research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md](../research/2026-03-14-look-into-cloudflare-crawl-api-for-crawling-sites.md).
- 2026-03-14: Refreshed against the March 10, 2026 Cloudflare `/crawl` docs and added explicit crawl-bounds guidance.

---
date: 2026-03-14
topic: Look into cloudflare /crawl api for crawling sites
status: complete
tags: []
---

# Look into cloudflare /crawl api for crawling sites

## Context
This was investigated because the task description was exactly "Look into cloudflare /crawl api for crawling sites". The goal was to understand what Cloudflare's `/crawl` endpoint actually does as of March 14, 2026, where it fits relative to `/scrape`, AI Search website sync, and custom crawler infrastructure, and what the practical operational constraints are if we use it for real crawling work.

Repo orientation found one relevant principle file, `principles/web-crawling.md`, and an existing research note at this same path. The principles DB query for "Look into cloudflare" returned no match, while the prior-research DB query failed locally with a SQLite `malformed JSON` error, so the safest path was to verify against current official docs and refresh the note with the current API shape.

## Findings

### 1. Current product shape, `/crawl` is a bounded managed crawl job, not a crawler platform
Cloudflare announced the Browser Rendering `/crawl` endpoint in open beta on March 10, 2026. Cloudflare describes it as a REST API that "crawls websites" from a starting URL and returns site content as HTML, Markdown, or structured JSON, with support for long-running jobs and pagination. The same changelog also says the crawler is a "signed agent" that respects `robots.txt` and AI Crawl Control by default. [Source: Cloudflare changelog, March 10, 2026, https://developers.cloudflare.com/changelog/2026-03-10-crawl-api-beta/]

That positioning is important. `/crawl` is not exposed as a full crawler-control plane with first-class scheduling, frontier ownership, revisit policy, or cross-domain orchestration. It is a managed crawl primitive for a bounded crawl job:

- start from one URL
- discover URLs from links, sitemaps, or both
- cap depth and URL count
- optionally render pages in a real browser
- return crawl records with extracted content and metadata

Recommendation: use `/crawl` when you need "crawl this site or section now and give me page artifacts." Do not use it when you actually need "own the crawl frontier for many sites over time." In that second case, use a custom crawler, such as Workers Bindings plus Queues or another dedicated crawl system. Cloudflare's own Browser Rendering platform docs explicitly position Workers Bindings for advanced browser automation and custom workflows. [Source: Cloudflare Browser Rendering API overview, https://developers.cloudflare.com/browser-rendering/platform/browser-rendering-api/]

### 2. The API model is job-based and the result model is inline records, not page-by-page fetch endpoints
The current `/crawl` docs show a two-step job model:

1. `POST /client/v4/accounts/{account_id}/browser-rendering/crawl` to create a job.
2. `GET /client/v4/accounts/{account_id}/browser-rendering/crawl/{job_id}` to inspect job state and retrieve results.

The `GET` response can also be filtered with query parameters like `status`, `limit`, and `cursor`, and the docs note that if the response would exceed 10 MB, Cloudflare appends a cursor automatically so the job result must be paginated. The result payload includes a `status` and `records`, where each record has fields such as `url`, `status`, `mimeType`, `depth`, `contentType`, `content`, `createdAt`, `crawl.delay`, and `crawl.source`. The docs list record statuses including `completed`, `disallowed`, and `skipped`. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

This matters architecturally. The clean integration shape is:

- create job
- store `job_id`
- poll status
- page through result records
- persist normalized page artifacts in your own store

Do not wrap `/crawl` as if it were a one-shot synchronous helper. The endpoint has a maximum run time of seven days, and Cloudflare deletes crawl-job data after 14 days. That means Cloudflare is an execution layer, not a durable crawl database. Persist outputs you care about quickly. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

### 3. The most important best practice is to bound the crawl explicitly, because the defaults are permissive
The current docs expose the crawl shape through a small but important set of parameters:

- `url`, starting point, required
- `limit`, max number of URLs, default `10`, max `100000`
- `depth`, max crawl depth, default `100000`, max `100000`
- `source`, URL discovery source, `all`, `sitemaps`, or `links`, default `all`
- `render`, whether to use the browser renderer, default `true`
- `formats`, output format list, `html`, `markdown`, and `json`
- `options.includeExternalLinks`, default `false`
- `options.includeSubdomains`, default `false`
- `options.includePaths` and `options.excludePaths`
- `options.allowBackwardCrawling`
- `options.waitForSelector` and `options.gotoOptions`
- `maxAge` for result caching reuse
- `modifiedSince` for incremental recrawls

These knobs are all in the official `/crawl` docs, and two defaults stand out immediately: `depth` defaults to `100000`, which is effectively "unbounded enough to surprise you," while `source` defaults to `all`, which means discovery can pull from both sitemaps and links. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

Recommendation:

- Always set `limit`, `depth`, and `source` explicitly.
- Add `includePaths` or `excludePaths` for docs sections, changelogs, blogs, or other segmented sites.
- Leave `includeExternalLinks` off unless you are intentionally doing off-site traversal.
- Keep `includeSubdomains` off unless the target information architecture really spans them.

If you skip those bounds, the crawl surface becomes a side effect of the target site's navigation and sitemap quality instead of your own intent.

### 4. Static-first is the right default, and Cloudflare now exposes that choice directly with `render`
The current API makes the rendering choice explicit. `render: true` is the default and runs the crawl through Browser Rendering. `render: false` performs a faster HTML fetch without JavaScript execution. Cloudflare says `render: false` is currently not billed during the beta and will later be charged under Workers pricing instead of Browser Rendering pricing. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

That creates a clear default strategy:

- Start with `render: false`.
- Request `markdown` when the goal is downstream summarization, search indexing, or LLM ingestion.
- Add `html` only when you need DOM-preserving output.
- Turn on `render: true` only when the site proves that client-side rendering is required.

This is stronger than a generic cost heuristic because Cloudflare also exposes runtime accounting. The Browser Rendering pricing page prices usage around browser time, with a free monthly browser-hours allotment and then hourly billing on usage above the included amount. The `/crawl` docs also note that Browser Rendering adds the `x-browser-ms-used` response header so you can track actual browser time used by a crawl run. [Sources: Cloudflare Browser Rendering pricing, https://developers.cloudflare.com/browser-rendering/platform/pricing/ ; Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

Recommendation: for docs sites, changelogs, blogs, and many marketing sites, use `render: false` first. Full rendering should be an earned escalation based on missing content, not the starting posture.

### 5. Incremental crawling is built in, which is a strong reason to avoid re-crawling whole sites blindly
Two parameters make repeated crawls much more practical than a brute-force recrawl:

- `modifiedSince`, only fetch records newer than a given Unix timestamp
- `maxAge`, reuse cached results if the exact crawl request was run recently

Cloudflare documents that `maxAge` applies only when the same start URL and all crawl parameters match, because the cached results live in R2 keyed to the full request shape. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

This gives a sensible decision pattern:

- for one-off site capture, ignore both and just run a bounded crawl
- for recurring "what changed on this docs site?" jobs, use `modifiedSince`
- for accidental repeats or near-term retries, use `maxAge`

Recommendation: if the crawl is part of indexing, monitoring, or content-sync workflows, design the wrapper around incremental behavior from day one. Whole-site recrawls are the easiest thing to implement and the fastest way to waste crawl budget.

### 6. Robots, sitemaps, and bot identity are first-class inputs, not edge details
Cloudflare's `/crawl` docs say URL discovery begins from the start URL, can use the site's `sitemap.xml` when `source` includes sitemaps, and then discovers new URLs from links. Cloudflare also says the crawler checks `robots.txt` if available, follows `crawl-delay`, and marks blocked URLs as `disallowed` in the results. If no `robots.txt` exists, the crawl proceeds unrestricted. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

Cloudflare separately documents a "Robots.txt and Sitemaps" page for Browser Rendering. That page is useful because it adds operational detail:

- requests are sent with a browser-specific `User-Agent` plus crawler identification
- the specific crawler UA is `CloudflareBrowserRenderingCrawler/1.0 (+https://www.cloudflare.com/browser-rendering/)`
- requests include a `cf-brapi-request-id` header
- if you manage a Cloudflare-protected target site and want to allow Browser Rendering, Cloudflare recommends using bot detection ID `128292352`
- crawl discovery can use sitemaps, page links, or both

[Source: Cloudflare Browser Rendering robots and sitemaps docs, https://developers.cloudflare.com/browser-rendering/platform/robots-txt-and-sitemaps/]

This is the key trade-off: `/crawl` is a respectful, identifiable crawler. It is not a stealth scraping product. That is good if you control the site, have permission, or want a clean operational relationship with the target. It is a bad fit if your plan depends on pretending the traffic is an ordinary end user browser.

Recommendation:

- if you crawl your own Cloudflare-protected site, plan allowlisting up front
- if you crawl third-party sites, treat robots and sitemap quality as decisive inputs
- if you need adversarial anti-bot evasion, choose a different toolchain, because `/crawl` is explicitly not built for that

### 7. Sitemaps are not just a convenience, they materially change crawl quality
Because `source` defaults to `all`, Cloudflare can combine `sitemap.xml` discovery with page-link discovery. This is especially useful on sites where good content is not strongly represented in primary navigation, such as:

- deeply nested docs
- release-note archives
- blog tag pages
- pages that are published faster than nav updates

Cloudflare's AI Search website data-source docs reinforce the same point from a higher-level product angle. For AI Search website sync, Cloudflare says it crawls pages from the domain and sitemap, and it tracks changes using sitemap metadata such as `lastmod` and `changefreq`. The same docs say website data sources only work for websites within the same Cloudflare account, require a DNS TXT verification record on the apex domain, and cannot crawl pages if the site has no sitemap. [Source: Cloudflare AI Search website data source docs, https://developers.cloudflare.com/ai-search/configuration/data-sources/website-data-source/]

Recommendation: if the sitemap is high quality, keep sitemap-based discovery on. If the site has no sitemap or a low-quality one, set `source: "links"` and rely on tighter path filters instead of hoping the crawler guesses your intended corpus.

### 8. `/scrape`, `/crawl`, AI Search website sync, and custom crawler code each solve a different problem
The cleanest decision framework is by control boundary:

| Need | Best fit | Why |
| --- | --- | --- |
| Extract one page or a few known pages | `/scrape` | Smaller surface area, selector-oriented extraction, simpler result shape |
| Traverse one site or section now | `/crawl` | Managed discovery + bounded crawl + content records |
| Keep your own Cloudflare-managed site synced for retrieval/search | AI Search website data source | Higher-level managed site sync and indexing |
| Own the crawl frontier, revisit policy, or multi-domain orchestration | Workers Bindings + Queues, or another custom crawler | You need explicit control Cloudflare `/crawl` does not expose |

Cloudflare's `/scrape` docs emphasize selector-based extraction, optional browser rendering, screenshot capture, markdown output, and structured JSON extraction from a single page. That makes `/scrape` the obvious default when you already know the target URLs. [Source: Cloudflare `/scrape` docs, https://developers.cloudflare.com/browser-rendering/rest-api/scrape/]

Cloudflare's Browser Rendering API overview says to use Workers Bindings when you need advanced browser automation and custom workflows, which is a strong hint about the boundary where `/crawl` stops being the right abstraction. [Source: Cloudflare Browser Rendering API overview, https://developers.cloudflare.com/browser-rendering/platform/browser-rendering-api/]

Recommendation: do not pick `/crawl` just because it sounds more powerful. Pick it only when you need discovery and traversal. If the URL set is already known, `/scrape` is often the cleaner and cheaper primitive.

### 9. Free-plan limits and beta billing behavior make `/crawl` easy to test, but production wrappers still matter
Cloudflare's Browser Rendering limits page currently lists crawl-specific free-plan limits of:

- 3 simultaneous crawl jobs
- 1,000 URLs per crawl
- 300 URLs per minute over the REST API

[Source: Cloudflare Browser Rendering limits, https://developers.cloudflare.com/browser-rendering/platform/limits/]

The same limits page also notes that crawl request limits are waived during the beta. Combined with the current `render: false` beta billing exception, this makes `/crawl` unusually easy to evaluate right now. [Sources: Cloudflare Browser Rendering limits, https://developers.cloudflare.com/browser-rendering/platform/limits/ ; Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

The temptation is to treat beta leniency as production truth. That would be a mistake. The right production posture is:

- wrap `/crawl` behind your own adapter
- persist job IDs and normalized records
- meter browser time via `x-browser-ms-used`
- keep crawl shapes explicit and reproducible
- assume limits and pricing can tighten when beta ends

Managed beta products are excellent leverage, but poor places to bury hard business assumptions.

### 10. Concrete implementation pattern
For a docs or changelog site, this is the kind of request shape that matches the current docs and keeps the crawl narrow:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/browser-rendering/crawl" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "url": "https://example.com/docs/",
    "limit": 50,
    "depth": 2,
    "source": "all",
    "render": false,
    "formats": ["markdown"],
    "options": {
      "includePaths": ["/docs/", "/changelog/"],
      "excludePaths": ["/docs/print/", "/docs/archive/"]
    }
  }'
```

This matches the current parameter names in the official docs and follows the opinionated defaults above. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

For a wrapper in TypeScript, the right shape is poll-and-persist, not fetch-and-forget:

```ts
const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering`;
const headers = {
  Authorization: `Bearer ${apiToken}`,
  "Content-Type": "application/json",
};

async function startCrawl() {
  const res = await fetch(`${base}/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: "https://example.com/docs/",
      limit: 50,
      depth: 2,
      source: "all",
      render: false,
      formats: ["markdown"],
      options: {
        includePaths: ["/docs/", "/changelog/"],
        excludePaths: ["/docs/print/", "/docs/archive/"],
      },
    }),
  });

  const body = await res.json();
  return body.result.id as string;
}

async function waitForCompletion(jobId: string) {
  for (;;) {
    const res = await fetch(`${base}/crawl/${jobId}?limit=100`, { headers });
    const body = await res.json();
    const status = body.result.status as string;

    if (status !== "running") return body.result;

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function fetchCompletedRecords(jobId: string) {
  const allRecords: unknown[] = [];
  let cursor: string | undefined;

  for (;;) {
    const url = new URL(`${base}/crawl/${jobId}`);
    url.searchParams.set("status", "completed");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, { headers });
    const body = await res.json();
    allRecords.push(...body.result.records);

    cursor = body.result.cursor;
    if (!cursor) return allRecords;
  }
}
```

Recommendation: keep the Cloudflare result schema at the edge of your system. Normalize records into your own durable page model quickly, because Cloudflare's retention window is 14 days and the response shape can evolve while the feature is still in beta. [Source: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/]

### 11. Opinionated recommendations
If I were adopting Cloudflare `/crawl` today, I would use these defaults:

- Use `/scrape` when the target URL set is already known.
- Use `/crawl` only for bounded, one-site traversal jobs.
- Set `limit`, `depth`, `source`, and path filters explicitly on every crawl.
- Start with `render: false` and `formats: ["markdown"]`.
- Use `modifiedSince` for recurring sync jobs instead of full recrawls.
- Treat sitemap quality and `robots.txt` as part of crawl design, not post-hoc compliance.
- If the target is your own Cloudflare-protected site, arrange allowlisting before rollout.
- Persist crawl artifacts into your own storage within the 14-day retention window.
- Keep a migration path open to custom crawler infrastructure if you later need scheduling, cross-domain traversal, or custom frontier control.

### 12. Emerging trends and what they imply
Three March 2026 signals matter:

1. Cloudflare is moving down-stack and up-stack at the same time. `/crawl` is a lower-level crawl primitive, while AI Search website sync is a higher-level managed indexing product. [Sources: Cloudflare `/crawl` docs, https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/ ; Cloudflare AI Search website data source docs, https://developers.cloudflare.com/ai-search/configuration/data-sources/website-data-source/]
2. Cloudflare is making crawler identity explicit. Signed-agent behavior, robots support, AI Crawl Control support, and Browser Rendering bot identification all point toward cooperative crawling, not stealth scraping. [Sources: Cloudflare changelog, March 10, 2026, https://developers.cloudflare.com/changelog/2026-03-10-crawl-api-beta/ ; Cloudflare Browser Rendering robots and sitemaps docs, https://developers.cloudflare.com/browser-rendering/platform/robots-txt-and-sitemaps/]
3. The API is usable enough to evaluate now, but still beta enough that wrappers and measurement are mandatory. Limits, billing, and result shape should be assumed stable enough for integration tests, not stable enough to hard-code business commitments without an adapter. [Sources: Cloudflare Browser Rendering limits, https://developers.cloudflare.com/browser-rendering/platform/limits/ ; Cloudflare Browser Rendering pricing, https://developers.cloudflare.com/browser-rendering/platform/pricing/]

Overall recommendation: Cloudflare `/crawl` is a strong fit for respectful, bounded, async site crawling where you want Cloudflare to handle browser execution and link discovery but you still want to own the downstream storage and pipeline. It is a weak fit for stealth scraping, long-lived crawl frontier management, or cross-domain crawler infrastructure.

## Open Questions
- How stable will the `/crawl` response schema and status vocabulary remain after the open beta ends?
- What will the exact post-beta cost curve be for `render: false` crawls once they fully move onto Workers pricing?
- How well does the built-in JSON extraction perform on heterogeneous sites compared to a separate post-processing extraction pipeline?
- What are the practical throughput ceilings on paid plans beyond the currently documented free-plan crawl limits?

## Extracted Principles
- Updated [../principles/web-crawling.md](../principles/web-crawling.md).
- Principle: choose the crawl surface by control boundary, `/scrape`, `/crawl`, AI Search website sync, or custom crawler code.
- Principle: set explicit crawl bounds, never rely on permissive managed-crawl defaults.
- Principle: start static-first with `render: false`, then earn full browser rendering.
- Principle: treat robots, sitemaps, and allowlisting as core crawl inputs.
- Principle: model managed crawl jobs as async artifact pipelines with external persistence.

---
date: 2026-02-23
topic: Pinterest API v5 integration for wedding venue recommendation app
status: complete
tags: [pinterest, api, oauth, image-pipeline, wedding-venue-finder]
related: [2026-02-23-multi-modal-venue-recommendation-engine.md]
---

# Pinterest API v5 Integration Research

## Context

The wedding venue recommendation app needs to ingest a user's Pinterest board images, download them, and embed them with CLIP (ViT-B/32, 512d). The flow: user connects Pinterest via OAuth, we fetch their board pins, download the images, and run them through the existing CLIP embedding pipeline. This research covers the full Pinterest API v5 surface needed to implement this.

## 1. Authentication (OAuth 2.0)

### OAuth Flow

Pinterest API v5 uses a standard **OAuth 2.0 Authorization Code** flow. There is no client credentials grant — every request requires user authorization.

**Authorization endpoint:** `https://www.pinterest.com/oauth/`
**Token endpoint:** `https://api.pinterest.com/v5/oauth/token`
**API base URL:** `https://api.pinterest.com/v5`

Flow:
1. Redirect user to `https://www.pinterest.com/oauth/?response_type=code&client_id={app_id}&redirect_uri={redirect_uri}&scope={scopes}&state={csrf_token}`
2. User authorizes, Pinterest redirects to your `redirect_uri` with `?code={auth_code}&state={csrf_token}`
3. Exchange the auth code for an access token via POST to `/v5/oauth/token` with `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`

**Important:** Redirect URI must be an **exact match** to one registered in the Pinterest app profile. No wildcards.

No evidence of PKCE support was found in the documentation — Pinterest appears to rely on the traditional confidential client flow with `client_secret` in the token exchange.

### Required Scopes

For reading boards and pins, the minimum scopes needed:

| Scope | Purpose |
|-------|---------|
| `boards:read` | Read user's public boards |
| `boards:read_secret` | Read user's secret/private boards |
| `pins:read` | Read pins on boards |
| `pins:read_secret` | Read pins on secret boards |
| `user_accounts:read` | Read user profile (likely needed for basic account info) |

**Minimum for our use case:** `boards:read pins:read user_accounts:read`

Add `boards:read_secret` and `pins:read_secret` if we want to allow users to import from their secret/private boards (likely yes — wedding planning boards are often secret).

### Token Lifecycle

| Token Type | Lifespan | Notes |
|-----------|----------|-------|
| Access token | **30 days** | Used for all API calls |
| Refresh token | **1 year** | Used to obtain new access tokens |
| Test token (Trial) | **24 hours** | For quick testing without full OAuth flow |

**Refresh flow:** POST to `/v5/oauth/token` with `grant_type=refresh_token` and `refresh_token`. Returns a new access token (and potentially a new refresh token).

**Implication for our app:** We must store refresh tokens securely and implement automatic token refresh. A background job should refresh tokens proactively before the 30-day expiration. The 1-year refresh token means users won't need to re-authorize frequently, but we should handle the edge case where a refresh token expires (prompt re-authorization).

### Account Requirements

- **Business account required.** The developer who creates the app must have a Pinterest Business Account. Personal accounts cannot create API apps.
- Users who authorize your app can be personal or business accounts — the business requirement is only for the app developer/owner.
- Personal accounts can no longer be linked to business accounts; you need a separate business account or convert.

## 2. Fetching Boards and Pins

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v5/boards` | GET | List all boards for the authenticated user |
| `/v5/boards/{board_id}` | GET | Get a specific board |
| `/v5/boards/{board_id}/pins` | GET | List pins on a board |
| `/v5/boards/{board_id}/sections` | GET | List sections within a board |
| `/v5/boards/{board_id}/sections/{section_id}/pins` | GET | List pins in a specific board section |
| `/v5/pins/{pin_id}` | GET | Get a specific pin |
| `/v5/pins` | GET | List pins for the authenticated user |
| `/v5/user_account/boards` | GET | Search user's boards |

### Pagination Model

Pinterest v5 uses **bookmark-based cursor pagination** (not offset-based).

**Parameters:**
- `page_size`: Number of items per page. Default: **25**, Maximum: **250** (some sources say 100 — the OpenAPI spec suggests up to 250 for some endpoints, but 100 is the safe maximum to assume)
- `bookmark`: Opaque cursor string returned with each page; include in the next request to get the next page

**Response structure:**
```json
{
  "items": [...],
  "bookmark": "abc123..."
}
```

When `bookmark` is null or absent, you've reached the last page. There is no `has_more` field — the presence/absence of `bookmark` is the signal.

### Pin Response Object

Based on the OpenAPI spec and documentation, a pin response includes:

```json
{
  "id": "987654321",
  "created_at": "2025-01-15T10:30:00",
  "link": "https://example.com/original-source",
  "title": "My Pin Title",
  "description": "Pin description text",
  "board_id": "123456789",
  "board_owner": { ... },
  "media": {
    "media_type": "image",
    "images": {
      "150x150": {
        "url": "https://i.pinimg.com/150x150/ab/cd/ef/abcdef123.jpg",
        "width": 150,
        "height": 150
      },
      "400x300": {
        "url": "https://i.pinimg.com/400x300/ab/cd/ef/abcdef123.jpg",
        "width": 400,
        "height": 300
      },
      "600x": {
        "url": "https://i.pinimg.com/600x/ab/cd/ef/abcdef123.jpg",
        "width": 600,
        "height": 900
      },
      "originals": {
        "url": "https://i.pinimg.com/originals/ab/cd/ef/abcdef123.jpg",
        "width": 1200,
        "height": 1800
      }
    }
  },
  "creative_type": "REGULAR",
  "alt_text": "...",
  "dominant_color": "#f5e6d3",
  "parent_pin_id": "...",
  "pin_metrics": { ... }
}
```

**Image size variants available:**
- `150x150` — square thumbnail crop
- `400x300` — medium thumbnail
- `600x` — medium resolution (width-constrained, height varies)
- `originals` — full original resolution

**For CLIP embedding, use `originals`** to get the highest quality image. If download speed/bandwidth is a concern, `600x` is a reasonable fallback — CLIP ViT-B/32 resizes to 224x224 anyway, so anything above ~300px is sufficient quality.

### Media Types

Recent API versions refactored media handling with PinMedia schemas:
- `PinMediaWithImage` — standard image pin
- `PinMediaWithVideo` — video pin
- `PinMediaWithImages` — multi-image pin (carousel)
- `PinMediaWithVideos` — multi-video pin
- `PinMediaWithImageAndVideo` — mixed media

**Note:** `media_type` was reportedly removed from responses in recent API versions (v5.15.0+), replaced by an improved media schema structure. The `creative_type` enum is the newer field to use for distinguishing pin types, with values including `REGULAR`, `VIDEO`, `COLLAGE`, `MAX_WIDTH_REGULAR_COLLECTION`, `MAX_WIDTH_VIDEO_COLLECTION`.

**Filtering out videos:** Check `creative_type` field. If it's `VIDEO`, skip the pin. Alternatively, check whether the `media.images` key exists vs `media.video`.

### Rate Limits

| Aspect | Detail |
|--------|--------|
| Universal hard limit | **100 calls/second** per user per app |
| Trial access | Limits measured **per day** |
| Standard access | Limits measured **per minute** (higher overall) |
| Rate limit enforcement | Per-user AND per-app |

Pinterest's rate limit system is complex and varies by endpoint category. The official documentation doesn't publish exact numbers publicly in a way that search engines can index, but the key structural difference is:

- **Trial:** daily quotas (e.g., X calls per day for read endpoints)
- **Standard:** per-minute quotas (e.g., Y calls per minute for read endpoints)

All user actions (including API calls) also count against unpublished general Pinterest user limits.

**Practical guidance for our use case:** With Trial access, we're rate-limited daily. For a single user importing a board of ~200 pins, this should be manageable with Trial access. For Standard access, the per-minute limits are more generous and better suited for a production app with multiple concurrent users.

## 3. Image Download Pipeline

### CDN URLs and Direct Download

Pinterest hosts all images on its own CDN at **`i.pinimg.com`**. Key findings:

- **No authentication required to download images.** The URLs returned by the API are direct CDN links. A simple HTTP GET to the URL will return the image.
- **No evidence of URL expiration.** Unlike S3 presigned URLs, Pinterest CDN URLs appear to be permanent — they use content-based hashing, not time-limited tokens. The URL format is: `https://i.pinimg.com/{size}/{hash_segment1}/{hash_segment2}/{hash_segment3}/{full_hash}.{ext}`
- **No hotlinking protection detected** on i.pinimg.com specifically for server-to-server downloads. The CDN serves images to any requester.
- **Images are Pinterest-hosted copies**, not the original source. When someone pins an image from the web, Pinterest copies and re-hosts it. The `link` field on the pin points to the original source page, but the image URLs point to Pinterest's copy on i.pinimg.com.

### Image Formats

- Overwhelmingly **JPEG** for photos
- **PNG** for graphics/illustrations
- **WebP** is served in some cases (content negotiation may apply)
- For CLIP embedding, JPEG is fine — no format-specific handling needed

### Batch Download Strategy

Recommended approach for downloading board images:

1. **Fetch all pin metadata first** (paginate through the board completely)
2. **Filter out non-image pins** (videos, etc.)
3. **Download images concurrently** with controlled concurrency (8-16 parallel downloads)
4. **Use `originals` URLs** unless bandwidth is a concern, then use `600x`
5. **Implement retry with exponential backoff** for failed downloads (CDN 429s are possible)
6. **Set a reasonable User-Agent header** — don't impersonate browsers, but don't use bare library defaults either
7. **Stream to disk, don't buffer in memory** for large boards

```
Pseudocode pipeline:
  pins = paginate_all_pins(board_id)  # Multiple API calls
  image_pins = filter(pins, creative_type != VIDEO)
  urls = [pin.media.images.originals.url for pin in image_pins]
  images = concurrent_download(urls, concurrency=12, retries=3)
  embeddings = clip_encode_batch(images, batch_size=32)
```

**Estimated timing for 200-pin board:**
- API fetching: ~2-4 calls (100 pins per page), < 5 seconds
- Image downloads (parallel): ~30-60 seconds depending on image sizes
- CLIP encoding: ~10-20 seconds (GPU) or ~60-120 seconds (CPU)
- **Total: ~1-3 minutes per board**

## 4. Practical Constraints

### Board Size

- **No per-board limit** on number of pins
- Account-wide limit: **200,000 pins** total
- Account-wide limit: **2,000 boards** total
- Typical wedding inspiration board: 50-500 pins
- Edge case: power users might have 1,000+ pins on a board
- Recommendation: warn users if a board has > 500 pins that processing will take longer, and consider offering a "sample first 200" option

### Board Sections

Board sections are **sub-categories within a board** (e.g., a "Wedding" board might have sections for "Venues", "Flowers", "Dresses").

**Critical:** `GET /boards/{board_id}/pins` returns **all pins on the board regardless of section**. You do NOT need to separately fetch section pins to get all images. The sections endpoints are only needed if you want to:
- Show section names to the user for filtering
- Let the user select specific sections (e.g., "only import from the Venues section")

**If we want section-level filtering, the flow is:**
1. `GET /boards/{board_id}/sections` — list all sections
2. Present sections to user for selection
3. `GET /boards/{board_id}/sections/{section_id}/pins` — fetch pins from selected section(s)

### Repins vs Original Pins

- **No difference in data returned.** A repin has the same structure as an original pin.
- The `parent_pin_id` field may indicate it's a repin (linking to the original pin), but the image URL is the same Pinterest-hosted copy regardless.
- The `link` field may differ (repins may preserve the original pin's source URL).
- For our use case, this distinction doesn't matter — we care about the image content, not its provenance.

### Videos

- Video pins will have `creative_type: "VIDEO"` (or similar video-related creative_type values)
- They have a `media.video` structure instead of (or in addition to) `media.images`
- Video thumbnails exist at URLs like `i.pinimg.com/videos/thumbnails/originals/...`
- **Strategy:** Filter out any pin where `creative_type` includes "VIDEO" or where `media.images` is absent. For video pins with thumbnails, we could optionally use the thumbnail as a fallback image, but this is low priority.

## 5. App Review and Approval Process

### Access Tiers

| Tier | Key Limitations | How to Get |
|------|----------------|------------|
| **Trial** | Daily rate limits, content visibility limited to app owner, designed for testing/development | Submit app via developers.pinterest.com, reviewed each business day |
| **Standard** | Per-minute rate limits (higher), full production use, content visible to all users | Submit recorded demo + verify info, reviewed each business day |

**Trial Access:**
- Pins created via Trial access are **only visible to the user who created them** (irrelevant for our read-only use case)
- Trial provides a **24-hour test token** for quick API exploration without setting up OAuth
- Rate limits are daily rather than per-minute
- Sufficient for development and testing

**Standard Access:**
- Required for production deployment with real users
- Requires a **recorded screen demo** showing:
  1. Your app's Pinterest integration in action
  2. The **full OAuth authorization flow** (user clicking "Authorize", redirect happening, etc.)
  3. What features your users will use
- Optional voiceover explaining how the app works

### Approval Process

**Timeline:** Applications are reviewed each business day. Email notification on approval/denial.

**Common rejection reasons** (from extensive community forum reports):
1. **"Demo did not show Pinterest integration"** — The most common rejection. Your demo must clearly show Pinterest data being used in your app, not just the OAuth flow.
2. **"Demo did not show full OAuth flow"** — Must show the complete redirect-based authorization, not just API calls.
3. **Using someone else's demo video** — Must be your own application.
4. **Insufficient integration** — Pinterest wants to see meaningful use of their data, not just a proof-of-concept.

### Known Issues with Approval (2024-2026)

Community forums are filled with frustration:
- **Catch-22 problem:** Some features can only be demonstrated with Standard access, but you need Standard access to demonstrate them. For read-only apps like ours, this is less of an issue since Trial gives read access.
- **Approval delays:** Some apps stuck in "Trial access pending" for weeks (reports from Jan 2026).
- **Vague rejections:** Developers report receiving generic rejection emails with no specific feedback.
- **Multiple rejection cycles:** Developers report recording 3+ demo videos before approval.

### Recommendations for Our App

1. **Start with Trial access** — sufficient for development and initial testing
2. **Build the full integration** with Trial access (read-only works fine in Trial)
3. **Record a polished demo** for Standard access:
   - Show the OAuth flow start to finish
   - Show boards being listed and selected
   - Show pins being fetched and displayed
   - Show the actual recommendation output using Pinterest data
   - Add voiceover explaining the wedding venue recommendation use case
4. **Apply for Standard** only when the demo is compelling

## 6. Alternative Approaches

### If the Official API is Too Restrictive

**Pinterest RSS Feeds:**
- Pinterest used to offer RSS feeds for boards, but this is largely **deprecated/unreliable** for board pin reading.
- RSS is now mainly used in the opposite direction (auto-creating pins from RSS feeds of blog posts).
- Not a viable alternative for ingesting board images.

**Unofficial APIs / Scraping Services:**
- Services like ScrapeCreators offer unofficial Pinterest APIs that don't require business accounts or approval.
- Web scraping with Playwright/Puppeteer is possible but Pinterest has aggressive anti-bot protection (JavaScript rendering required, rate limiting, CAPTCHA).
- **Not recommended** — violation of ToS, unreliable, and unnecessary when the official API covers our read-only use case.

**User Self-Export:**
- Pinterest allows users to **download their own data** via account settings (GDPR-style export), which includes pin images.
- This is manual and clunky (ZIP file), but could be a fallback UX.
- A browser extension approach where the user exports their board data could work but adds significant UX friction.

**Best Approach:** Use the official API. Our use case (read-only, user-authorized, reading their own boards) is well-supported and aligns with Pinterest's intended API usage.

## 7. Developer Resources

### Official

- **API Documentation:** https://developers.pinterest.com/docs/api/v5/
- **OpenAPI Spec (YAML):** https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml
- **OpenAPI Spec (JSON):** https://github.com/pinterest/api-description/blob/main/v5/openapi.json
- **API Quickstart (Python/Node):** https://github.com/pinterest/api-quickstart
- **Python Generated Client:** https://github.com/pinterest/pinterest-python-generated-api-client
- **Postman Collection:** https://www.postman.com/pinterest/pinterest-collections/documentation/4rpuu15/pinterest-rest-api-5-3-0
- **Rate Limits Reference:** https://developers.pinterest.com/docs/reference/rate-limits/
- **Access Tiers:** https://developers.pinterest.com/docs/getting-started/access-tiers/
- **Developer Guidelines Policy:** https://policy.pinterest.com/en/developer-guidelines

### Community

- **Pinterest Business Community (Developers):** https://community.pinterest.biz/c/developers/
- **FAQ Thread:** https://community.pinterest.biz/t/frequently-asked-questions-pinterest-api/2083

### Useful Medium Articles

- [Accessing the Pinterest V5 API as a Back-end Confidential Client](https://medium.com/@wertster/accessing-the-pinterest-v5-api-as-a-back-end-confidential-client-52481384bc13) — Practical walkthrough of backend OAuth flow with refresh token automation.

## Open Questions

1. **Exact Trial rate limits for read endpoints** — The documentation doesn't surface exact daily quotas for `GET /boards/{board_id}/pins` in Trial mode. Need to test empirically or contact Pinterest developer support.
2. **`media_type` removal timeline** — Exactly which API version removed `media_type` from responses, and what the current replacement looks like in practice. The OpenAPI spec at HEAD would clarify this.
3. **PKCE support** — No evidence found that Pinterest supports PKCE. For a web app with a backend, this isn't critical (we have a `client_secret`), but for mobile/SPA flows it matters.
4. **`creative_type` for filtering** — Need to confirm all `creative_type` enum values that indicate non-image content (VIDEO, COLLAGE, etc.) and whether COLLAGE pins still have useful images.
5. **Section-level pins vs board-level pins** — Need to verify empirically: does `GET /boards/{board_id}/pins` truly return ALL pins including those in sections, or only unsectioned pins?
6. **CDN URL longevity** — While URLs appear permanent, need to confirm they don't expire after months. For our use case (download immediately, embed, discard URL), this is low risk.

## Extracted Principles

No new principles extracted — this is application-specific integration research, not generalizable engineering knowledge. The relevant existing principles in `principles/backend-api-engineering.md` (OAuth patterns, API integration) and `principles/error-handling-resilience.md` (retry logic, circuit breakers) already cover the engineering patterns needed.

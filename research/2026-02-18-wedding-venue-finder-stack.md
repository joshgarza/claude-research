---
date: 2026-02-18
topic: Wedding Venue Finder tech stack overview
status: complete
tags: [tech-stack, full-stack, react, express, postgresql, ai, docker]
---

# Wedding Venue Finder — Tech Stack Overview

## Context
Documentation of the end-to-end tech stack for the Wedding Venue Finder project, an AI-powered venue discovery app with a "Tinder for Venues" swipe interface, taste profile generation, and personalized ranking using CLIP embeddings.

## Findings

### Frontend
- **React 19** + **Vite** + **React Router**
- React Spring (animations), React Tinder Card (swipe UI), Leaflet (maps)
- Axios with JWT interceptors

### Backend
- **Express 5** + **TypeScript**
- Zod validation
- JWT auth (access + refresh tokens)
- Helmet, CORS, rate limiting

### Database
- **PostgreSQL 17** with two extensions:
  - **pgvector** — 512-dim CLIP embeddings for taste-based venue ranking
  - **PostGIS** — geospatial radius search
- **Knex.js** for queries & migrations

### AI/ML
- **Ollama** (phi3:3.8b) — local LLM for venue data enrichment
- **CLIP** (Jina clip-server) — image embeddings for visual similarity matching

### Data Pipeline

6-stage pipeline orchestrated by `src/pipeline/runPipeline.ts`, triggered via `npm run pipeline`.

**Stage 1 — Collect (OSM Overpass API)**
- Queries OpenStreetMap via Overpass QL for venues matching wedding-related tags (`amenity~"events_venue|wedding_venue"`, `leisure="resort"`, `historic~"manor|castle"`, name patterns like "Estate", "Vineyard")
- 3 mirror endpoints with automatic fallback (overpass-api.de → private.coffee → osm.jp)
- Tile-based parallelism — bbox split into grid tiles (0.01 degrees), 300ms delay between requests
- Extracts name, website, coordinates → upserts to `venues` table with PostGIS `ST_MakePoint` geometry
- Retry: 4 attempts with exponential backoff (0.5s → 4s)

**Stage 1.5 — Pre-vetting (Homepage keyword screening)**
- Fetches homepage HTML via axios (5s timeout, spoofed User-Agent)
- Scans `<title>`, `<meta>`, `<h1>`, `<h2>` for wedding keywords (10-word list: wedding, venue, reception, ceremony, etc.)
- Classification: 2+ keywords → YES, 1 → NEEDS_CONFIRMATION, 0 → NO (skip crawl)
- `pLimit(10)` concurrency

**Stage 2 — Crawl (crawl4ai + Playwright)**
- BFS crawl of venue websites via crawl4ai Docker container (Playwright headless browser under the hood)
- Config: `fit_markdown` extraction, pruning threshold 0.48, min 75 words, 20s timeout
- Max depth 3, max 10 links per level, same-domain only
- `pLimit(5)` concurrent requests to crawl4ai service
- Aggregates all extracted markdown into single `raw_markdown` TEXT column

**Stage 3 — Images (Download & storage)**
- Extracts image URLs from markdown via regex (`![alt](url)` pattern)
- Downloads with axios streaming to disk, skips images < 50KB (icons/logos)
- Hash-based naming: MD5 of URL → `data/venues/{venue_id}/raw_images/{hash}.{ext}`
- Stores paths in JSONB `image_data` column
- CLI progress bar via `cli-progress`

**Stage 4 — Enrichment (Ollama LLM extraction)**
- Model: `phi3:3.8b-mini-4k-instruct-q4_K_M` (configurable via env)
- Extracts structured attributes from raw markdown: `is_wedding_venue`, `is_estate`, `is_historic`, `has_lodging`, `lodging_capacity`, `pricing_tier`
- Prompt engineering: JSON-only system prompt with examples, first 3000 chars of markdown, response anchoring (prefilled `{`)
- Zod schema validation on output
- 3 retries with increasing temperature (0.1 → 0.3 → 0.5), `top_p: 9`, `num_predict: 256`

**Stage 5 — Image Filter (CLIP logo detection)**
- Sends each image to CLIP `/rank` endpoint with two text descriptors: "a business logo/watermark" vs "a photograph of a place"
- Logo if `logoScore > 0.85 AND logoScore > photoScore` → delete file
- Graceful fallback: CLIP failure → keep image (avoids over-filtering)

**Post-pipeline — Embedding Generation** (`npm run generate:embeddings`)
- Batch encodes venue images via CLIP `/encode/image` → 512-dim vectors
- 50-venue batches, 10-request concurrency per batch
- Stored in `venue_embeddings` table with pgvector `VECTOR(512)` type
- Health check before start via `ensureClipServiceAvailable()`

**Key libraries:** axios (HTTP), p-limit (concurrency), ollama SDK, cli-progress (progress bars), zod (validation)

### Infrastructure
- **Docker Compose** (6 services: db, api, frontend, ollama, clip, crawler)

### Testing
- **Vitest** + **Supertest** (223 tests)

## Open Questions
- None currently — this is a reference snapshot of the stack as of 2026-02-18.

## Extracted Principles
None — this is a project-specific reference doc, not a generalizable research finding.

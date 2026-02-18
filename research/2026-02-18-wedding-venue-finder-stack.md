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
- 5-stage pipeline: collect → crawl (crawl4ai) → download images → enrich (Ollama) → filter

### Infrastructure
- **Docker Compose** (6 services: db, api, frontend, ollama, clip, crawler)

### Testing
- **Vitest** + **Supertest** (223 tests)

## Open Questions
- None currently — this is a reference snapshot of the stack as of 2026-02-18.

## Extracted Principles
None — this is a project-specific reference doc, not a generalizable research finding.

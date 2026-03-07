# YouTube Transcription

## Summary

Extracting transcripts from YouTube videos programmatically is straightforward for videos with captions (use `youtube-transcript-api`), but requires a fallback pipeline (yt-dlp + Whisper) for uncaptioned content. The official YouTube Data API v3 is nearly useless for this use case. Cloud deployments need proxy configuration to avoid IP bans.

## Principles

### Use youtube-transcript-api as the Default (Python)

- **What:** For Python, `youtube-transcript-api` (pip) is the simplest, most reliable method. No API key, no headless browser, no OAuth. Works with auto-generated captions.
- **Why:** It reverse-engineers YouTube's internal timedtext API, returns structured data directly in Python, and has active maintenance (v1.2.4 as of Jan 2026). CLI and multiple output formatters (SRT, VTT, JSON, plain text) included.
- **When:** Any Python project that needs to read transcripts from public YouTube videos.
- **When NOT:** Age-restricted or private videos (no working auth). Cloud deployments without proxy config.
- **Source:** [research/2026-03-07-youtube-transcription.md](../research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md)

### Add Proxy Config for Cloud Deployments

- **What:** YouTube blocks requests from datacenter IPs (AWS, GCP, Azure). Use rotating residential proxies (Webshare residential tier) when running on cloud infrastructure.
- **Why:** Static IPs from cloud providers are on YouTube's blocklist. Rotating residential proxies bypass this; datacenter proxies get banned too.
- **When:** Any deployment on cloud VMs or serverless that calls `youtube-transcript-api` at any meaningful volume.
- **Source:** [research/2026-03-07-youtube-transcription.md](../research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md)

### Use yt-dlp + Whisper as Fallback for Uncaptioned Videos

- **What:** When a video has no captions, download audio with `yt-dlp` and transcribe with OpenAI Whisper (`turbo` model for best speed/accuracy balance).
- **Why:** Auto-generated captions are missing for many videos (niche content, music, old uploads). Whisper produces high-quality transcription from raw audio.
- **When:** Videos where `NoTranscriptFound` or `TranscriptsDisabled` is raised. Also use for age-restricted videos if audio can be obtained another way.
- **When NOT:** Long videos on CPU-only machines (very slow). Use AssemblyAI or Deepgram instead for managed inference.
- **Source:** [research/2026-03-07-youtube-transcription.md](../research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md)

### Skip the Official YouTube Data API v3 for Transcripts

- **What:** The official `captions.download` endpoint requires OAuth, only works on videos you own, cannot access auto-generated captions, and has a 50-downloads/day quota. Do not use it for transcript extraction from arbitrary videos.
- **Why:** It was designed for channel owners to manage their own captions, not for reading public transcripts.
- **When to use it:** Only when building caption management tools for a YouTube channel you control.
- **Source:** [research/2026-03-07-youtube-transcription.md](../research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md)

### Prefer Python Over Node.js for This Task

- **What:** The Python `youtube-transcript-api` is far more stable, actively maintained, and feature-rich than the npm equivalents. If using Node.js, consider a Python microservice sidecar or using the Innertube API directly.
- **Why:** npm packages for YouTube transcripts (`youtube-transcript`, `youtube-transcript-plus`) are less maintained and more prone to breaking on YouTube changes.
- **When NOT:** If Node.js is the only option, `youtube-transcript` npm package works but monitor GitHub issues closely.
- **Source:** [research/2026-03-07-youtube-transcription.md](../research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md)

### Treat youtube-transcript-api as a Fragile Dependency

- **What:** The library uses undocumented YouTube APIs. It will break periodically when YouTube changes its internals. Pin to a known-good version in production and monitor the GitHub issues page.
- **Why:** The maintainer explicitly warns there are no stability guarantees. It has broken before (notably auth changes in 2024) and recovery is not immediate.
- **When:** Always — this applies in all production usage.
- **Source:** [research/2026-03-07-youtube-transcription.md](../research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md)

## Revision History

- 2026-03-07: Initial extraction from research/2026-03-07-look-into-the-simplest-way-to-extract-a-transcription-from-a-youtube-video-programmatically.md

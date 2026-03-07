---
date: 2026-03-07
topic: Simplest way to extract a transcription from a YouTube video programmatically
status: complete
tags: [youtube, transcription, python, javascript, api, yt-dlp, whisper]
---

# Simplest Way to Extract a Transcription from a YouTube Video Programmatically

## Context

Need to extract transcripts from YouTube videos without manual copy-paste. This comes up in AI pipelines (summarization, Q&A over video content), content automation, and research tooling. The goal is the simplest reliable approach, with fallback strategies when the easy path fails.

## Findings

### Option 1: youtube-transcript-api (Python) — The Simplest Path

**This is the de-facto standard for Python.** No API key, no headless browser, no OAuth — just a pip install.

- **Package**: `youtube-transcript-api` by Jonas Depoix (`jdepoix`)
- **Current version**: 1.2.4 (released January 2026)
- **Python support**: 3.8–3.14
- **License**: MIT
- **GitHub**: https://github.com/jdepoix/youtube-transcript-api
- **PyPI**: https://pypi.org/project/youtube-transcript-api/

#### How it works

The library reverse-engineers the undocumented internal YouTube API that the web client uses to fetch captions. It does not use the official YouTube Data API v3.

#### Installation

```bash
pip install youtube-transcript-api
```

#### Basic usage (v1.x API)

```python
from youtube_transcript_api import YouTubeTranscriptApi

# Instantiate the API (supports proxy config in constructor)
ytt_api = YouTubeTranscriptApi()

# Fetch transcript — pass the video ID, not the full URL
transcript = ytt_api.fetch("dQw4w9WgXcQ")

# Each item has: text, start (seconds), duration (seconds)
for snippet in transcript:
    print(snippet.text)
```

#### Extract video ID from URL

```python
import re

def extract_video_id(url: str) -> str | None:
    match = re.search(r"(?:v=)([^&#]+)", url)
    if match:
        return match.group(1)
    match = re.search(r"(?:youtu\.be/)([^&#]+)", url)
    if match:
        return match.group(1)
    return None
```

#### Get plain text (no timestamps)

```python
from youtube_transcript_api.formatters import TextFormatter

formatter = TextFormatter()
text = formatter.format_transcript(transcript)
print(text)
```

#### Get SRT / WebVTT / JSON

```python
from youtube_transcript_api.formatters import SRTFormatter, WebVTTFormatter, JSONFormatter

srt_text = SRTFormatter().format_transcript(transcript)
vtt_text = WebVTTFormatter().format_transcript(transcript)
json_text = JSONFormatter().format_transcript(transcript)
```

#### List available transcripts (languages, auto vs manual)

```python
transcript_list = ytt_api.list("dQw4w9WgXcQ")
for t in transcript_list:
    print(t.language, t.language_code, "auto" if t.is_generated else "manual")

# Fetch a specific language
transcript = transcript_list.find_transcript(["en", "de"]).fetch()

# Translate to another language
translated = transcript_list.find_transcript(["en"]).translate("es").fetch()
```

#### Breaking change in v1.x (from v0.x)

The v0.x static class methods `YouTubeTranscriptApi.get_transcript()` and `.list_transcripts()` were deprecated in v1.0 and removed in a later release. The new API requires instantiation:

```python
# Old (removed):
transcript = YouTubeTranscriptApi.get_transcript("VIDEO_ID")

# New (v1.x):
api = YouTubeTranscriptApi()
transcript = api.fetch("VIDEO_ID")
```

The return type is now a `FetchedTranscript` object (iterable, indexable). If you need the old dict format:

```python
data = transcript.to_raw_data()  # list of {"text": ..., "start": ..., "duration": ...}
```

#### Caveat: Undocumented API

The maintainer explicitly warns: *"This code uses an undocumented part of the YouTube API, which is called by the YouTube web-client. So there is no guarantee that it won't stop working tomorrow."* The library has an active maintenance history (394+ commits, v1.2.4 as of Jan 2026) and tends to recover quickly from YouTube-side changes.

---

### Option 2: yt-dlp (Python/CLI) — Subtitle File Download

`yt-dlp` is a feature-rich downloader that can also fetch subtitle files in VTT, SRT, or other formats without downloading the video.

#### Installation

```bash
pip install yt-dlp
```

#### CLI usage

```bash
# Download subtitles only, skip video, English preferred
yt-dlp --write-subs --write-auto-subs --sub-langs "en" --sub-format "vtt" --skip-download "https://youtu.be/VIDEO_ID"

# List available subtitle tracks first
yt-dlp --list-subs "https://youtu.be/VIDEO_ID"
```

#### Python API usage

```python
import yt_dlp

ydl_opts = {
    "writesubtitles": True,
    "writeautomaticsub": True,
    "subtitleslangs": ["en"],
    "subtitlesformat": "vtt",
    "skip_download": True,
    "outtmpl": "/tmp/%(id)s.%(ext)s",
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(["https://youtu.be/VIDEO_ID"])
# Subtitle saved to /tmp/VIDEO_ID.en.vtt
```

#### When to use yt-dlp over youtube-transcript-api

- You need the subtitle file on disk (for video editing tools, etc.)
- You want to prefer manual subtitles vs auto-generated in one command
- You are already using yt-dlp for audio/video downloading and want to keep one dependency
- You need subtitle formats not supported by youtube-transcript-api

The downside: yt-dlp saves to files; you need to parse VTT/SRT yourself to get plain text in-memory. youtube-transcript-api returns structured data directly in Python.

---

### Option 3: OpenAI Whisper + yt-dlp — Fallback When No Captions Exist

Some videos have no captions at all (disabled by creator, niche content, etc.). The fallback is to download audio and transcribe with Whisper.

```bash
pip install yt-dlp openai-whisper
```

```python
import yt_dlp
import whisper

# Step 1: download audio only
ydl_opts = {
    "format": "bestaudio/best",
    "outtmpl": "/tmp/audio.%(ext)s",
    "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "mp3",
    }],
}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl_opts["outtmpl"] = "/tmp/audio.%(ext)s"
    ydl.download(["https://youtu.be/VIDEO_ID"])

# Step 2: transcribe with Whisper
model = whisper.load_model("turbo")   # or "base", "small", "medium", "large-v3"
result = model.transcribe("/tmp/audio.mp3")
print(result["text"])
```

**Model tradeoffs:**

| Model | Speed | Accuracy | VRAM |
|-------|-------|----------|------|
| base | fastest | lowest | ~1 GB |
| small | fast | decent | ~2 GB |
| turbo | fast | near-large | ~6 GB |
| large-v3 | slow | best | ~10 GB |

The `turbo` model (optimized large-v3) is the practical default for accuracy/speed balance. On CPU it will be slow for long videos — use GPU or the OpenAI Whisper API for hosted inference.

**Hybrid pattern (try captions first, fall back to Whisper):**

```python
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

def get_transcript(video_id: str) -> str:
    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
        return " ".join(s.text for s in transcript)
    except (NoTranscriptFound, TranscriptsDisabled):
        # Fall back to Whisper
        return whisper_transcribe(video_id)
```

---

### Option 4: JavaScript / Node.js

The Python ecosystem is much more mature here, but JS options exist:

- **`youtube-transcript` (npm)**: Most starred package. Works by parsing YouTube's internal timedtext endpoint. No API key. May break on YouTube changes.
- **Innertube API approach**: Manually call YouTube's internal `youtubei/v1/get_transcript` endpoint impersonating Android client. More robust but requires more code.
- **`youtube-transcript-plus` (npm)**: Slightly more advanced wrapper with metadata support.

```javascript
// youtube-transcript npm package
import { YoutubeTranscript } from 'youtube-transcript';

const transcript = await YoutubeTranscript.fetchTranscript('VIDEO_ID');
const text = transcript.map(t => t.text).join(' ');
```

The npm packages are less maintained than the Python library and more prone to breaking.

---

### Option 5: Official YouTube Data API v3 — Mostly Useless for This

The official API (`captions.list` + `captions.download`) has severe practical limitations:

- **OAuth required** (not API key — must authenticate as a user)
- **Only downloads captions for videos you own** (not arbitrary videos)
- **Cannot access auto-generated captions** even for your own videos
- **10,000 quota units/day** — each caption download costs 200 units (~50 downloads/day)
- **Deprecated sync parameter** (March 2024)

Use the official API only if you are building a tool that manages captions for a YouTube channel you control. For reading transcripts from arbitrary public videos, it does not work.

---

### Option 6: Paid SaaS APIs — For Scale or No-Captions Videos

When running at scale or needing to transcribe videos without existing captions:

| Service | Notes | Pricing |
|---------|-------|---------|
| Supadata.ai | Multi-platform (YT, TikTok, IG), AI fallback | $0.99/1K requests |
| AssemblyAI | Download audio, send to ASR API | Pay per minute |
| Deepgram | Similar to AssemblyAI | Pay per minute |
| youtube-transcript.io | YouTube-only, simple REST | $9.99/mo for 1K |

---

### IP Bans on Cloud Providers

**Critical production gotcha**: YouTube blocks most requests from cloud provider IP ranges (AWS, GCP, Azure). If you run `youtube-transcript-api` on a cloud VM or serverless function, you will get `RequestBlocked` or `IpBlocked` errors.

**Workarounds:**

1. **Rotating residential proxies** (most reliable) — Webshare residential tier:

```python
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig

api = YouTubeTranscriptApi(
    proxy_config=WebshareProxyConfig(
        proxy_username="...",
        proxy_password="...",
    )
)
```

2. **Generic proxy/SOCKS**:

```python
from youtube_transcript_api.proxies import GenericProxyConfig

api = YouTubeTranscriptApi(
    proxy_config=GenericProxyConfig(
        http_url="http://proxy:port",
        https_url="https://proxy:port",
    )
)
```

3. **Tor proxy** (free but slow) — run torproxy in Docker, point library at it.

4. **Run from residential IP** — a home server or VPS at a non-datacenter ISP works without proxies.

---

### Decision Framework

```
Does the video have captions?
  YES → Use youtube-transcript-api (Python) or youtube-transcript (npm)
    Running on cloud? → Add rotating residential proxy config
    Running locally? → No proxy needed

  NO (disabled/unavailable) → Use yt-dlp + Whisper
    Have GPU? → Local Whisper (turbo model)
    No GPU / need managed → AssemblyAI or Deepgram API

Need 100+ videos/day at scale?
  → Add proxy rotation OR use a SaaS API (Supadata, AssemblyAI)

Building in Node.js?
  → youtube-transcript npm package (watch for breakage)
  → Consider calling a Python microservice instead

Need official/owned channel caption management?
  → YouTube Data API v3 (only case where it makes sense)
```

---

### Complete Minimal Example (Python, production-safe)

```python
import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled, VideoUnavailable

def extract_video_id(url: str) -> str | None:
    for pattern in [r"(?:v=)([^&#]+)", r"(?:youtu\.be/)([^&#]+)"]:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None

def get_youtube_transcript(url_or_id: str, languages: list[str] = ["en"]) -> str | None:
    video_id = extract_video_id(url_or_id) or url_or_id
    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id, languages=languages)
        return " ".join(snippet.text for snippet in transcript)
    except (NoTranscriptFound, TranscriptsDisabled):
        return None
    except VideoUnavailable:
        return None
```

## Open Questions

- **Reliability long-term**: youtube-transcript-api uses undocumented APIs. It has broken before and recovered, but there's no guarantee. Worth monitoring GitHub issues before depending on it in critical production paths.
- **IP ban thresholds**: YouTube's exact rate limits before triggering IP blocks are undocumented. Community reports suggest burst requests (~100s in quick succession) trigger it more than sustained moderate traffic.
- **Age-restricted videos**: Cookie-based auth was broken in 2024–2025 and has not been restored. No reliable workaround for age-restricted content currently exists in the library.
- **Private videos**: No solution exists — private videos require the channel owner's OAuth access, and even then the transcript download API is limited.
- **Node.js stability**: The npm ecosystem for this is fragile. If Node.js is required, consider a Python sidecar service or using the Innertube API directly.

## Extracted Principles

- Principles extracted to `principles/youtube-transcription.md` (new file).

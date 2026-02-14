---
date: 2026-02-11
topic: OpenClaw broad scan — interesting concepts index
status: complete
tags: [openclaw, index, scan]
related: [2026-02-11-openclaw-low-level-patterns.md]
---

# OpenClaw Broad Scan — Interesting Concepts Index

Quick-pass scan of the entire openclaw repo by 6 parallel agents. This file indexes
concepts flagged as worth a future deep dive, grouped by theme.

## Security & Prompt Injection Defense

- **Prompt injection boundary markers** — Wraps external content (emails, webhooks) with
  markers and detects 9 suspicious patterns including "ignore previous instructions".
  Folds fullwidth Unicode to catch homograph bypass attacks.
  `src/security/external-content.ts`

- **Skill scanner** — Static analysis with 8+ rules detecting dangerous exec, crypto mining,
  data exfiltration, env harvesting, obfuscation.
  `src/security/skill-scanner.ts`

## Memory & Knowledge

- **SQLite vector search** — Uses `sqlite-vec` extension for in-database cosine distance.
  No external vector DB needed. `src/memory/sqlite-vec.ts`

- **Hybrid search** — BM25 keyword + vector similarity with configurable weight blending.
  `src/memory/hybrid.ts`

- **Auto-capture memory** — LanceDB extension with rule-based triggers ("remember",
  "I prefer"). Deduplicates at 0.95 similarity. `extensions/memory-lancedb/`

## Routing & Identity

- **Cross-channel identity links** — Maps peer IDs across platforms to one canonical
  identity. Your Discord and WhatsApp become one person. `src/routing/session-key.ts`

- **7-level route resolution** — peer → parent → guild → team → account → channel → default.
  `src/routing/resolve-route.ts`

- **DM scope modes** — main / per-peer / per-channel-peer / per-account-channel-peer.
  Controls session isolation granularity. `src/sessions/session-key-utils.ts`

## Voice & Telephony

- **Twilio ↔ OpenAI Realtime** — Bidirectional audio WebSocket streaming with call
  barge-in and TTS queue serialization. `extensions/voice-call/src/media-stream.ts`

- **Phone control** — Temporary permission elevation (camera, screen, contacts) with
  auto-expiry state machine. `extensions/phone-control/`

## Auto-Reply Pipeline

- **Fence-aware chunking** — Splits long messages without breaking markdown code fences.
  Per-platform limits. `src/auto-reply/chunk.ts` + `src/markdown/fences.ts`

- **Block streaming coalescer** — Groups streaming tokens into natural paragraphs/sentences
  with idle timeouts. Provider-specific breaking rules. `src/auto-reply/reply/block-streaming.ts`

- **Multi-provider TTS** — ElevenLabs, OpenAI, Edge TTS. Opus for Telegram, MP3 elsewhere.
  Auto-summarizes before synthesis. `src/tts/tts.ts`

## Plugins & Hooks

- **Priority-based hook execution** — Void hooks run parallel, modifying hooks sequential
  with result merging. `src/plugins/hooks.ts`

- **Agent bootstrap hooks** — Mutate workspace files at runtime before agent starts.
  `src/hooks/bootstrap-hooks.ts`

- **Gmail watcher** — Triggers agent turns from incoming email. `src/hooks/gmail-watcher.ts`

- **Lobster subprocess** — JSON-first workflow engine with approval tokens and strict
  path validation. `extensions/lobster/`

## Networking & Discovery

- **Bonjour/mDNS** — Auto-discovers gateways on LAN. Detects Tailscale IPs (100.64/10).
  `src/infra/bonjour-discovery.ts`

- **Wide-area DNS** — Generates zone files for cross-network gateway discovery.
  `src/infra/widearea-dns.ts`

- **ACP bridge** — Bidirectional Agent Client Protocol translation for IDE integration.
  `src/acp/translator.ts`

## Unusual Extensions

- **Nostr** — NIP-04 encrypted DMs over decentralized relay network. `extensions/nostr/`
- **Copilot proxy** — Bridges VS Code Copilot to use OpenClaw's providers. `extensions/copilot-proxy/`
- **Cron with adaptive backoff** — Consecutive error counter for exponential backoff. `src/cron/`
- **Multi-lane command queue** — Per-lane concurrency limits. `src/process/command-queue.ts`

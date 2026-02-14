---
date: 2026-02-11
topic: OpenClaw low-level integration patterns
status: complete
tags: [imessage, macos, messaging, architecture, json-rpc, real-time, channels]
---

# OpenClaw Low-Level Integration Patterns

## Context
First research session. Goal was to understand how openclaw (a personal AI assistant) implements low-level integrations, especially iMessage monitoring, and what other creative solutions exist in the codebase.

## Findings

### How iMessage Monitoring Works

The core insight: **OpenClaw does not read the iMessage database directly**. Instead it spawns an external CLI binary called `imsg` as a subprocess and communicates with it over **line-delimited JSON-RPC 2.0 via stdin/stdout**.

**The flow:**

1. `IMessageRpcClient` (src/imessage/client.ts) spawns `imsg rpc` as a child process
2. Node reads stdout line-by-line via `readline.createInterface`
3. To subscribe to new messages, it sends: `{"jsonrpc":"2.0","id":1,"method":"watch.subscribe","params":{"attachments":true}}`
4. The `imsg` binary watches macOS's `~/Library/Messages/chat.db` (SQLite) for changes — likely via FSEvents or Darwin notifications
5. When a new message arrives, `imsg` pushes a JSON-RPC notification (no `id` field, just `method: "message"`) with the full message payload
6. OpenClaw processes the notification through its monitor pipeline

**Why this architecture matters:**
- The `imsg` binary handles all macOS-specific system access (SIP-protected database, Apple frameworks)
- Node.js stays in userspace doing orchestration
- The binary can be swapped, updated, or even run over SSH on a remote Mac (the code detects SSH wrapper scripts and auto-resolves `remoteHost`)
- JSON-RPC is a clean protocol boundary — easy to test, version, and debug

**Key details in the monitor pipeline** (src/imessage/monitor/monitor-provider.ts):

- **Echo detection**: A `SentMessageCache` with 5-second TTL, scoped by `accountId:target`, prevents the bot from processing its own outbound messages that echo back through the database
- **Inbound debouncing**: Rapid multi-message bursts from the same sender in the same conversation get batched and combined before the AI processes them
- **Group history context**: An in-memory map stores recent unaddressed messages per group chat, injected as context when the bot is finally mentioned
- **Mention-gated responses**: In group chats, the bot only responds when mentioned (configurable via regex patterns), but authorized users can bypass this with control commands

**Sending messages** (src/imessage/send.ts): Also goes through the `imsg` RPC client. Sends a `"send"` method with target, text, service type, and optional file attachment path. Supports addressing by phone/email handle, chat_id, chat_guid, or chat_identifier.

### Other Creative Solutions

#### Swabble — Swift Wake-Word Daemon (Swabble/)

A standalone **Swift 6.2 macOS app** that implements always-on voice activation:

- Uses `AVAudioEngine` to tap the microphone at 2048-byte buffer size
- Routes audio through Apple's on-device `SpeechAnalyzer` + `SpeechTranscriber` ML models
- **Gap-based wake-word detection**: Analyzes time gaps between transcribed words to confirm the trigger word "clawd"
- Uses Swift's async/await actor model for thread-safe audio pipeline management
- On wake-word detection, executes a configurable shell command (hook) with the transcribed text
- Logs transcripts to `~/Library/Application Support/swabble/transcripts.log`

This means you can talk to your AI assistant hands-free on a Mac — it's always listening for the wake word, then pipes the speech to OpenClaw.

#### BlueBubbles — HTTP Webhook Alternative to imsg (extensions/bluebubbles/)

An alternative iMessage integration using the BlueBubbles macOS server app:

- Instead of polling or process spawning, BlueBubbles pushes events to OpenClaw via **HTTP POST webhooks**
- **Reply cache with short IDs**: Maps incrementing integers (1, 2, 3...) to full UUID message GUIDs for token efficiency in LLM context. LRU with 2000-entry cap and 6-hour TTL.
- Supports tapback reactions

#### Signal — SSE Streaming (src/signal/)

- Connects to a locally-running Signal CLI daemon's HTTP API
- Uses **Server-Sent Events** for real-time inbound messages
- Has a resilient SSE reconnection loop (sse-reconnect.ts)
- Sends via JSON-RPC POST calls
- Reaction processing uses timestamp-based message targeting

#### WhatsApp — Baileys Library (src/whatsapp/)

- Uses Baileys, an open-source reverse-engineering of the WhatsApp Web protocol
- WebSocket connection to WhatsApp servers
- Session state persisted locally
- Handles polls, reactions, media, group JID parsing

#### Pairing System (src/pairing/)

A clever authorization flow for unknown senders:

1. Unknown sender messages the bot
2. Bot auto-replies with an 8-character alphanumeric pairing code
3. User provides code to the AI agent through a trusted channel
4. Agent approves, adding sender to the allowlist

Uses file-based JSON store with `proper-lockfile` for atomic writes. Enforces max 3 concurrent pairing requests per channel with 1-hour TTL.

#### Channel Abstraction (src/channels/ + extensions/)

Every messaging platform implements a `ChannelPlugin` interface from a plugin SDK:
- Dynamic registration: `api.registerChannel({ plugin })`
- Each channel handles its own transport (subprocess, webhook, SSE, WebSocket)
- Unified message envelope format across all channels
- Per-channel, per-account configuration
- Hot-reload support via gateway config watcher

### Integration Pattern Summary

| Platform | Transport | Inbound Mechanism | Protocol |
|----------|-----------|-------------------|----------|
| iMessage (imsg) | Subprocess | Database watch → push notifications | JSON-RPC 2.0 over stdio |
| iMessage (BlueBubbles) | HTTP | Webhook POST | REST API |
| Signal | HTTP | Server-Sent Events (SSE) | SSE + JSON-RPC |
| WhatsApp | WebSocket | Baileys library events | WhatsApp Web protocol |
| Telegram | HTTP | Long polling / webhooks | Telegram Bot API |
| Discord | WebSocket | Discord.js gateway | Discord Gateway |
| Slack | HTTP | Events API / Socket Mode | Slack API |

## Open Questions

- How exactly does the `imsg` binary watch chat.db? FSEvents, `kqueue`, Darwin notifications, or polling? The binary source isn't in this repo.
- What are the reliability characteristics of the JSON-RPC subprocess approach vs. the BlueBubbles webhook approach for iMessage?
- How does the Swabble wake-word accuracy compare to commercial solutions? What's the false-positive rate?
- The project supports 15+ messaging channels — which ones see the most community use?

## Extracted Principles

- **Subprocess + RPC as integration boundary**: When you need to access system-level resources (like a SIP-protected database), spawn a dedicated binary and communicate over a structured protocol. Keeps the main process clean and the system access sandboxed. → See principles/integration-patterns.md
- **Echo detection via scoped TTL cache**: When reading from a shared data source (like a message database) that includes your own outbound messages, use a short-TTL cache keyed by conversation scope to filter echoes.
- **Debounce-then-batch for chat input**: Users send rapid multi-message bursts. Debounce inbound messages by sender+conversation, then combine them before processing. Avoids wasted AI calls on partial input.
- **Pairing codes for trust bootstrapping**: For open channels where anyone can message you, use a one-time code exchange to establish trust without requiring manual configuration of every sender.

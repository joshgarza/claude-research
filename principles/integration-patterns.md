# Integration Patterns

## Summary
Patterns for integrating with external systems, especially messaging platforms and OS-level resources. Focused on reliability, clean boundaries, and handling real-time data streams.

## Principles

### Subprocess + Structured RPC as System Boundary
- **What:** When accessing privileged or platform-specific resources, spawn a dedicated binary and communicate via a structured protocol (JSON-RPC, gRPC, etc.) over stdio or sockets.
- **Why:** Keeps the main process clean and portable. The binary handles system-level concerns (permissions, frameworks, SIP). The protocol boundary makes testing, versioning, and replacement straightforward.
- **When:** Any time you need to access OS-protected resources (databases, hardware, keychain) or bridge language boundaries (Swift ↔ Node). NOT worth the overhead for simple file reads or network calls.
- **Source:** research/2026-02-11-openclaw-low-level-patterns.md (iMessage `imsg` CLI pattern)

### Echo Detection via Scoped TTL Cache
- **What:** When reading from a shared data source that includes your own writes, maintain a short-TTL cache of recent outbound content keyed by scope (e.g., `accountId:conversationId`).
- **Why:** Prevents processing your own actions as new input. The scope prevents false matches across different conversations.
- **When:** Any bidirectional integration where reads and writes go through the same stream (message databases, event logs, shared queues). TTL should be short (5-10s) to avoid stale state.
- **Source:** research/2026-02-11-openclaw-low-level-patterns.md (SentMessageCache in iMessage monitor)

### Debounce-then-Batch for Chat Input
- **What:** Buffer rapid inbound messages from the same sender in the same conversation, then combine them into a single processing unit after a quiet period.
- **Why:** Users send multi-message bursts (typing, corrections, follow-ups). Processing each individually wastes compute and produces disjointed responses.
- **When:** Any chat/messaging integration where AI processing is expensive. Skip debouncing for control commands (they need immediate processing).
- **Source:** research/2026-02-11-openclaw-low-level-patterns.md (inbound debouncer in monitor-provider.ts)

### Pairing Codes for Trust Bootstrapping
- **What:** For open channels where unknown senders can reach you, auto-reply with a one-time code. The user provides this code through a trusted channel to establish authorization.
- **Why:** Avoids manual allowlist configuration for every new contact. Works across any messaging platform without platform-specific OAuth.
- **When:** Personal assistant scenarios where the bot is reachable on public channels but should only respond to authorized users. NOT suitable for high-security contexts.
- **Source:** research/2026-02-11-openclaw-low-level-patterns.md (pairing system in src/pairing/)

### Low-Frequency Polling as Detection Avoidance
- **What:** When integrating with platforms that actively detect automation (LinkedIn, Instagram, etc.), reduce request frequency to human-like levels (1-2x per day) instead of engineering stealth measures.
- **Why:** Anti-automation systems are tuned for high-frequency, mechanical patterns. At 1-2 requests per day, you're indistinguishable from a human. No stealth headers, fingerprint spoofing, or proxy rotation needed. The volume alone makes you invisible.
- **When:** Personal-use integrations where latency tolerance is hours, not seconds. NOT suitable when real-time is a hard requirement. Consider SSE/WebSocket for real-time, but understand the detection tradeoffs.
- **Source:** research/2026-02-12-linkedin-channel-spec.md

### State Diffing Over Event Streaming
- **What:** When real-time isn't required, poll periodically and diff against locally persisted state rather than maintaining a persistent event stream connection.
- **Why:** Eliminates an entire class of complexity: connection management, reconnection logic, event parsing, backpressure handling. A cron job + REST call + JSON diff is trivially debuggable.
- **When:** Any integration where hours of latency is acceptable. Keep the event streaming approach documented as an upgrade path. The REST client built for polling can be reused if you later add streaming.
- **Source:** research/2026-02-12-linkedin-channel-spec.md

### Cookie-Based Auth for Platform-Internal APIs
- **What:** For platforms without useful public APIs, use session cookies extracted from a browser to call internal API endpoints directly.
- **Why:** Internal APIs (like LinkedIn's Voyager) expose everything the web app can do. Official APIs often deliberately limit access. Cookie auth from a real browser session is the hardest automation signal to detect — it's a legitimate session.
- **When:** Personal tooling where you control the account. Requires manual cookie extraction (or a browser extension bridge). NOT for multi-user or commercial use — ToS violation is real even if enforcement is unlikely.
- **Source:** research/2026-02-12-linkedin-channel-spec.md

## Revision History
- 2026-02-11: Initial extraction from openclaw research session.
- 2026-02-12: Added low-frequency polling, state diffing, and cookie-based auth patterns from LinkedIn channel research.

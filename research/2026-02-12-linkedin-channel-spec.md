---
date: 2026-02-12
topic: LinkedIn channel integration spec for OpenClaw
status: complete
tags: [linkedin, openclaw, spec, polling, messaging, voyager-api]
related: [2026-02-11-openclaw-low-level-patterns.md, 2026-02-11-openclaw-scan-index.md]
---

# LinkedIn Channel Integration Spec for OpenClaw

## Context

Goal: implement a LinkedIn channel plugin for OpenClaw that provides periodic access to LinkedIn messages — inbound monitoring via low-frequency polling (1-2x per day), with optional outbound sending.

Real-time is not a requirement. The use case is "check my LinkedIn messages once or twice a day and surface anything new" — like a daily digest. This dramatically simplifies the architecture and reduces detection risk to near-zero.

This spec is informed by:
- Deep analysis of LinkedIn's messaging infrastructure (SSE for real-time, Voyager REST API for CRUD)
- Existing open-source libraries (`linkedin-api`, `linkedin-private-api`, Beeper's `linkedin-messaging`)
- OpenClaw's `ChannelPlugin` interface and adapter types
- The Signal channel extension as a reference implementation

## Key Design Decision: Polling Over SSE

LinkedIn supports real-time messaging via SSE (Server-Sent Events), and Beeper's `linkedin-messaging` library proves this works. However, **we deliberately choose low-frequency polling instead** because:

1. **Detection risk drops to near-zero.** 1-2 REST calls per day is indistinguishable from a human briefly checking LinkedIn.
2. **No persistent connections.** SSE requires a long-lived connection from a non-browser context — detectable. Polling makes a single request and disconnects.
3. **Drastically simpler architecture.** No SSE client, no reconnection logic, no event stream parsing. Just a cron job + REST call + diff.
4. **Cookie lifetime improves.** No persistent connection hammering the session. The cookie sits idle between checks.

The SSE approach is documented in the research notes (`research/2026-02-12-linkedin-channel-spec.md` prior revision) if real-time is ever needed later.

---

## Architecture Overview

```
  ┌──────────────────────────────────────────────────┐
  │              OpenClaw Gateway                     │
  │                                                   │
  │  ┌─────────────────────────────────────────────┐  │
  │  │         LinkedIn Channel Plugin              │  │
  │  │         (extensions/linkedin/)               │  │
  │  │                                              │  │
  │  │   ┌─────────────┐     ┌──────────────────┐  │  │
  │  │   │ Cron Trigger │────▶│ Voyager Client   │  │  │
  │  │   │ (1-2x/day)  │     │                  │  │  │
  │  │   └─────────────┘     │ GET conversations │  │  │
  │  │                       │ GET messages      │  │  │
  │  │                       │ POST send         │  │  │
  │  │                       └────────┬─────────┘  │  │
  │  │                                │             │  │
  │  │   ┌────────────────────────────▼──────────┐  │  │
  │  │   │         State Diffing                  │  │  │
  │  │   │                                        │  │  │
  │  │   │  Compare fetched conversations against │  │  │
  │  │   │  last-known state (stored locally).    │  │  │
  │  │   │  Emit new/unread messages to OpenClaw. │  │  │
  │  │   └────────────────────────────────────────┘  │  │
  │  │                                              │  │
  │  │   ┌────────────────────────────────────────┐  │  │
  │  │   │         Session Manager                 │  │  │
  │  │   │                                         │  │  │
  │  │   │  Cookie storage + validation            │  │  │
  │  │   │  Detect expiry on 401/403               │  │  │
  │  │   │  Alert user to re-inject cookies        │  │  │
  │  │   └────────────────────────────────────────┘  │  │
  │  └─────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────┘
```

### Transport: Periodic REST Polling

- **Inbound:** Cron-triggered GET to Voyager conversations endpoint. Diff against stored state. Surface new messages.
- **Outbound:** On-demand POST to Voyager send endpoint (only when user replies).

Total API calls per check: **1-3 requests** (list conversations + fetch new message content if any).

---

## Component Spec

### 1. LinkedIn Voyager Client (`src/voyager-client.ts`)

HTTP client wrapping LinkedIn's internal Voyager API.

**Authentication:**
```typescript
type LinkedInCredentials = {
  liAt: string;           // li_at session cookie
  jsessionId: string;     // JSESSIONID cookie (also CSRF source)
};
```

**Required headers for every request:**
```typescript
const headers = {
  "csrf-token": jsessionId.replace(/"/g, ""),  // strip quotes from JSESSIONID
  "x-li-lang": "en_US",
  "x-restli-protocol-version": "2.0.0",
  "x-li-track": JSON.stringify({
    clientVersion: "1.2.6216",
    osName: "web",
    timezoneOffset: new Date().getTimezoneOffset() / -60,
    deviceFormFactor: "DESKTOP",
    mpName: "voyager-web",
  }),
  "User-Agent": "<realistic browser UA — must match the browser the cookies came from>",
};
```

**Key endpoints:**

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List conversations | GET | `/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX` |
| Get messages | GET | `/voyager/api/messaging/conversations/{id}/events` |
| Send message | POST | `/voyager/api/messaging/conversations/{id}/events` |
| New conversation | POST | `/voyager/api/messaging/conversations` |
| Mark as read | POST | `/voyager/api/messaging/conversations/{id}` |

**Send message payload:**
```typescript
{
  eventCreate: {
    value: {
      "com.linkedin.voyager.messaging.create.MessageCreate": {
        body: "message text",
        attachments: [],
        attributedBody: {
          text: "message text",
          attributes: [],
        },
      },
    },
  },
  dedupeByClientGeneratedToken: false,
}
```

### 2. Polling Monitor (`src/monitor.ts`)

Replaces the SSE-based real-time monitor with a simple cron-triggered poller.

```typescript
class LinkedInPollingMonitor {
  private voyagerClient: VoyagerClient;
  private stateStore: ConversationStateStore;

  /**
   * Called by cron trigger (e.g., every 12 hours).
   * Makes 1-3 Voyager API calls total.
   */
  async poll(): Promise<LinkedInPollResult> {
    // 1. Fetch current conversations (1 API call)
    const conversations = await this.voyagerClient.getConversations({
      count: 20, // top 20 most recent
    });

    // 2. Load last-known state from local store
    const previousState = await this.stateStore.load();

    // 3. Diff: find new/unread messages
    const newMessages: NewMessage[] = [];
    for (const conv of conversations) {
      const prev = previousState.get(conv.id);
      if (!prev || conv.lastActivityAt > prev.lastActivityAt) {
        // Conversation has new activity — fetch messages (1 API call per updated conversation)
        const messages = await this.voyagerClient.getMessages(conv.id, {
          createdAfter: prev?.lastActivityAt,
          count: 10,
        });
        // Filter out own messages (echo detection by sender URN)
        const inbound = messages.filter(m => m.senderUrn !== this.selfUrn);
        newMessages.push(...inbound);
      }
    }

    // 4. Save updated state
    await this.stateStore.save(conversations);

    // 5. Return new messages for OpenClaw to process
    return { newMessages, checkedAt: Date.now() };
  }
}
```

**State store:** Simple JSON file persisted locally. Contains:
```typescript
type ConversationState = {
  id: string;                   // conversation URN
  lastActivityAt: number;       // timestamp of last known activity
  lastMessageId?: string;       // ID of last processed message
  participants: string[];       // participant URNs for display
};
```

**Echo detection:** At polling frequency, echo detection is trivial — just filter messages where `senderUrn` matches the authenticated user's profile URN. No TTL cache needed.

### 3. Session Manager (`src/session-manager.ts`)

Manages LinkedIn authentication state.

**Session acquisition:** Cookie injection only. User extracts `li_at` + `JSESSIONID` from browser DevTools (Application > Cookies > linkedin.com) and provides them in OpenClaw config.

```typescript
class LinkedInSessionManager {
  private credentials: LinkedInCredentials;

  /**
   * Validate session is still alive.
   * Called before each poll attempt.
   * Makes 0 additional API calls — piggybacks on the conversations fetch.
   */
  validateFromResponse(response: Response): boolean {
    if (response.status === 401 || response.status === 403) {
      this.emitSessionExpired();
      return false;
    }
    return true;
  }

  private emitSessionExpired(): void {
    // Notify user: "LinkedIn session expired. Please update cookies in config."
    // Could send notification via another OpenClaw channel (e.g., Telegram, iMessage)
  }
}
```

**Cookie lifetime at this polling frequency:**
- At 1-2 requests per day, the session cookie sees very little programmatic use
- **Main risk:** LinkedIn may expire `li_at` if it doesn't see regular browser activity from the same session
- **Mitigation:** Keep LinkedIn open in a browser tab occasionally (even just loading the page refreshes the cookie)
- If the cookie expires, the next poll gets a 401, and the user is notified to re-inject cookies

### 4. Channel Plugin (`src/channel.ts`)

Implements OpenClaw's `ChannelPlugin` interface.

```typescript
import type { ChannelPlugin } from "openclaw/plugin-sdk";

type LinkedInAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  liAt?: string;
  jsessionId?: string;
  profileUrn?: string;       // urn:li:fs_miniProfile:xxx (self)
  pollIntervalHours: number; // default: 12
};

export const linkedinPlugin: ChannelPlugin<LinkedInAccount> = {
  id: "linkedin",
  meta: {
    id: "linkedin",
    label: "LinkedIn",
    selectionLabel: "LinkedIn",
    docsPath: "/channels/linkedin",
    blurb: "Check LinkedIn messages periodically",
  },
  capabilities: {
    chatTypes: ["direct"],
    media: false,
    reactions: false,
    edit: false,
    reply: false,
    threads: false,
  },
  reload: { configPrefixes: ["channels.linkedin"] },
  config: {
    listAccountIds: (cfg) => listLinkedInAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveLinkedInAccount(cfg, accountId),
    isConfigured: (account) => Boolean(account.liAt && account.jsessionId),
    isEnabled: (account) => account.enabled,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
    }),
  },
  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: "open",
      allowFrom: [],
      policyPath: "channels.linkedin.dmPolicy",
      allowFromPath: "channels.linkedin.",
      approveHint: "LinkedIn connections can DM directly",
    }),
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 8000,
    sendText: async ({ cfg, to, text, accountId }) => {
      const client = getVoyagerClient(cfg, accountId);
      await client.sendMessage(to, text);
      return { channel: "linkedin" };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      // Start the cron-based polling monitor
      const monitor = new LinkedInPollingMonitor({
        accountId: ctx.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
      const intervalHours = ctx.account.pollIntervalHours ?? 12;
      return monitor.startCron(intervalHours);
    },
    stopAccount: async (ctx) => {
      // Cancel cron timer
    },
  },
  heartbeat: {
    checkReady: async ({ cfg, accountId }) => {
      // Validate session cookies are configured and not expired
      const account = resolveLinkedInAccount(cfg, accountId);
      if (!account.liAt || !account.jsessionId) {
        return { ok: false, reason: "LinkedIn cookies not configured" };
      }
      // Optionally: make a lightweight Voyager call to check session validity
      return { ok: true, reason: "Session configured" };
    },
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts) =>
      accounts.flatMap((a) => {
        if (!a.configured) {
          return [{
            channel: "linkedin" as const,
            accountId: a.accountId,
            kind: "config" as const,
            message: "LinkedIn session cookies not configured",
            fix: "Extract li_at and JSESSIONID from browser DevTools and add to config",
          }];
        }
        return [];
      }),
  },
};
```

---

## Configuration Schema

```yaml
channels:
  linkedin:
    enabled: true
    dmPolicy: open                    # LinkedIn already gates DMs via connections
    accounts:
      default:
        enabled: true
        liAt: "AQEDAxx..."           # li_at cookie value from browser
        jsessionId: '"ajax:xxx..."'  # JSESSIONID cookie value (including quotes)
        pollIntervalHours: 12        # How often to check (default: 12)
        userAgent: "Mozilla/5.0..."  # Must match the browser cookies came from
```

---

## Implementation Phases

### Phase 1: Read-Only Polling (MVP)
- Cookie-based authentication (manual `li_at`/`JSESSIONID` entry in config)
- Cron-triggered polling at configurable interval (default: 12 hours)
- Fetch conversations via Voyager API
- Diff against stored state to find new messages
- Surface new messages through OpenClaw pipeline
- Session expiry detection (401/403) with user notification
- **No sending.** Just monitoring and surfacing messages.

### Phase 2: Reply Support
- Send messages via Voyager API POST (on-demand, not automated)
- Mark conversations as read after processing
- Message chunking for long responses
- Outbound adapter integration

### Phase 3: Convenience Features
- Contact directory (list connections via Voyager)
- Conversation search
- On-demand manual poll trigger (e.g., `/linkedin check` command)
- Digest formatting (summarize new messages since last check)

### Phase 4: Session UX
- Browser extension for one-click cookie refresh
- Cross-channel session expiry alerts (e.g., "LinkedIn session expired" via Telegram)
- Multi-account support
- Credential encryption at rest

---

## Existing Libraries for Reference

| Library | Use | Language | Notes |
|---------|-----|----------|-------|
| `linkedin-api` (tomquirk) | Voyager endpoint reference | Python | Most maintained. Best endpoint documentation. |
| `linkedin-private-api` (eilonmore) | TypeScript Voyager client reference | TypeScript | Has types, auth, conversation/message models. Stale but patterns valid. |
| `linkedin-messaging` (beeper) | SSE reference (if ever needed) | Python | Proves real-time works. Not needed for polling approach. |

**Recommended approach:** Don't depend on any external library at runtime. Study the Voyager endpoint patterns from `linkedin-api` / `linkedin-private-api`, then implement a minimal TypeScript Voyager client from scratch. For polling, you only need 2-3 endpoints.

---

## Risk Assessment

### Detection Risk at 1-2 Requests/Day

| Signal | Risk | Why |
|--------|------|-----|
| Request frequency | **Near zero** | 1-3 requests per poll is less traffic than loading the LinkedIn homepage once |
| Request pattern | **Near zero** | Looks like a person checking messages briefly |
| Persistent connections | **None** | No SSE/WebSocket — connect, fetch, disconnect |
| IP/UA fingerprinting | **Near zero** | Same cookies + same UA as the browser session |
| Rate limit triggers | **None** | Orders of magnitude below any threshold |
| Behavioral analysis | **Near zero** | No mouse/scroll/DOM patterns to analyze — it's a pure API call |
| Account restriction | **Extremely unlikely** | LinkedIn targets commercial scrapers doing thousands of requests |

**Overall detection risk: extremely low.** At this volume, the programmatic requests are indistinguishable from a human briefly opening LinkedIn once a day.

### Session/Reliability Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cookie expires between polls | Medium | Medium | Keep LinkedIn open in browser occasionally; detect 401 and alert user |
| Voyager endpoint changes | Low-Medium | High | Only 2-3 endpoints needed; easy to update; monitor `linkedin-api` library for changes |
| LinkedIn deploys new API version | Low | Medium | The conversations endpoint has been stable for years |

### Legal Risks

| Risk | Assessment |
|------|-----------|
| **ToS violation** | Technically yes (Section 8.2). But accessing your own messages 1-2x/day with your own cookies is about as benign as it gets. |
| **CFAA exposure** | Minimal. You're accessing your own data with your own authenticated session. |
| **Practical enforcement** | Effectively zero at this volume. LinkedIn litigates against commercial scraping companies, not individuals checking their own inbox. |

---

## Comparison with Other OpenClaw Channels

| Aspect | LinkedIn (proposed) | Signal (existing) | WhatsApp (existing) | iMessage (existing) |
|--------|-------------------|-------------------|--------------------|--------------------|
| Transport (inbound) | Periodic REST poll | SSE | WebSocket (Baileys) | JSON-RPC subprocess |
| Transport (outbound) | REST (Voyager) | JSON-RPC POST | WebSocket (Baileys) | JSON-RPC subprocess |
| Auth mechanism | Session cookies | Phone number | QR code pairing | macOS system access |
| Message latency | Hours (by design) | Sub-second | Sub-second | Sub-second |
| API calls per day | 1-6 | Persistent connection | Persistent connection | Persistent process |
| Detection risk | Extremely low | None | Medium | None |
| Complexity | Very low | Medium | High | Medium |

---

## File Structure

```
extensions/linkedin/
  src/
    index.ts                # Plugin entry point (register channel)
    channel.ts              # ChannelPlugin implementation
    runtime.ts              # Plugin runtime holder
    voyager-client.ts       # Voyager REST API client (minimal: 2-3 endpoints)
    monitor.ts              # Cron-based polling + state diffing
    session-manager.ts      # Cookie validation + expiry detection
    state-store.ts          # Local JSON state persistence
    types.ts                # LinkedIn-specific types
    config.ts               # Config resolution helpers
  package.json
  tsconfig.json
```

---

## Open Questions

1. **Newer "Dash" API endpoints:** LinkedIn is migrating some endpoints to `voyagerMessagingDash*` patterns. Need to verify that `/voyager/api/messaging/conversations` still works or find the Dash equivalent.
2. **Cookie lifetime without browser activity:** How long does `li_at` survive if the user doesn't visit linkedin.com in their browser for days? Need empirical testing.
3. **2FA handling:** Does 2FA affect cookie-based persistence? Likely fine once cookies are established, but needs verification.
4. **Conversation pagination:** The conversations endpoint returns paginated results. At 1x/day polling, do we need to paginate, or will the top 20 always catch new messages? (Almost certainly yes for typical LinkedIn usage.)

## Extracted Principles

- **Low-frequency polling is a fundamentally different risk category than real-time access.** 1-2 API calls per day is indistinguishable from human behavior. Don't over-engineer detection avoidance when volume alone makes you invisible.
- **Cookie-based auth is the only viable approach** for personal LinkedIn message access. Official APIs don't cover this use case.
- **State diffing replaces event streaming** when latency isn't critical. Simpler, fewer moving parts, no persistent connections.
- **Real-time (SSE) remains available as an upgrade path** if requirements change. Beeper's `linkedin-messaging` library proves it works. The Voyager client built for polling can be reused.

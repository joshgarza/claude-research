# Remaining Work

## Completed

- [x] **Phase 1: Automation Pipeline** — Queue, worker, prompt builder, validator, permission guardrails, CLI helpers
- [x] **Phase 2: Digest Generator** — `automation/digest.ts` using Anthropic API
- [x] **Manual test run** — Worker successfully researched "Real-time & Event-Driven Architecture" (24K chars, 7 principles extracted, git committed)
- [x] **Budget fix** — Removed `--max-budget-usd` cap (unnecessary on Max subscription, was causing premature termination)

## Remaining

### Step 9: Cron Setup

Set up daily cron to run the worker automatically.

```bash
crontab -e
# Add:
0 6 * * * flock -n /tmp/claude-research.lock CLAUDECODE= node --experimental-strip-types /home/josh/coding/claude/research/automation/worker.ts >> /home/josh/coding/claude/research/automation/logs/cron.log 2>&1
```

Notes:
- `flock -n` prevents concurrent runs (redundant with worker's own lock, but good defense-in-depth)
- `CLAUDECODE=` unsets the env var so Claude Code doesn't refuse to launch
- Verify cron has access to `node` — may need full path (`/home/josh/.nvm/versions/node/v24.12.0/bin/node`)
- After setting up, wait for one automated run and check `automation/logs/cron.log`

### Step 10: Wire Digest into Worker

Currently `digest.ts` is standalone. Options:
1. **Separate cron** — Run digest weekly (e.g., `0 8 * * 1` for Monday 8am)
2. **Post-worker hook** — Have the worker call digest after completing items (adds complexity)

Recommendation: separate cron, simpler.

```bash
# Weekly digest (Mondays at 8am)
0 8 * * 1 ANTHROPIC_API_KEY=sk-... node --experimental-strip-types /home/josh/coding/claude/research/automation/digest.ts >> /home/josh/coding/claude/research/automation/logs/digest.log 2>&1
```

Note: digest uses the Anthropic API directly (not Claude Code), so it needs `ANTHROPIC_API_KEY`. Store the key securely — don't put it in crontab. Options:
- Source from a secrets file: `. ~/.secrets && node ...`
- Use `doppler run --` or similar secrets manager

### Steps 11-13: Embeddable Chat Widget (Phase 3)

A React component + API route for asking questions about the research corpus.

#### Step 11: Backend — Research Index + Context Loader

New files (in your existing web app):
- `lib/research-index.ts` — Builds/caches an index of all research files (topic, tags, date, path). Reads files at startup or on-demand with a TTL cache.
- `lib/research-context.ts` — Given a question, uses Claude to pick 2-4 relevant research files from the index, then loads them fully into context.

Key decisions:
- No vector DB needed. Corpus is ~30-50 files, ~500K-1M chars. Direct file selection + full loading beats RAG chunking at this scale.
- Index is lightweight JSON: `{ topic, tags, date, path, firstParagraph }[]`
- File selection prompt: give Claude the index, ask it to pick the most relevant files for the question.

#### Step 12: Backend — API Route

New file: `app/api/research/chat/route.ts` (Next.js example, adapt to your framework)

Flow:
1. Receive `{ question: string, conversationHistory?: Message[] }`
2. Load research index (cached)
3. Call Claude to pick 2-4 relevant files from index
4. Load those files fully
5. Call Claude with: system prompt + selected files + question + history
6. Stream response back via SSE

Dependencies: `@anthropic-ai/sdk`

#### Step 13: Frontend — `<ResearchChat />` Component

New file: `components/ResearchChat.tsx`

Features:
- Chat interface (messages list + input)
- Shows which research files were referenced in each answer
- Collapsible source previews
- Streaming response display
- Minimal styling (CSS modules or Tailwind)

### Shell Aliases (Optional)

Add to `~/.zshrc`:
```bash
alias rq='node --experimental-strip-types /home/josh/coding/claude/research/automation/enqueue.ts'
alias rs='node --experimental-strip-types /home/josh/coding/claude/research/automation/status.ts'
```

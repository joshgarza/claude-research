---
date: 2026-02-26
topic: Idea: chatbot with human in the loop context management
status: complete
tags: [context-management, human-in-the-loop, chatbot, ux, context-engineering, agents]
related: [2026-02-24-agent-context-augmentation-landscape.md, 2026-02-14-ai-llm-integration-practices.md]
---

# Chatbot with Human-in-the-Loop Context Management

## Context

This research investigates an idea for giving users direct, interactive control over their chatbot's context window. The core proposal: when a conversation's context window grows toward its limit, the system presents the user with a structured selection interface — showing which blocks of context to keep verbatim, which to summarize, and what replacement text (if any) to use. At any point during the conversation, users can also proactively swap out, prune, or compress specific pieces of context.

The motivation is rooted in a real problem: current context management is invisible and automatic. Users don't know when their conversation is being silently summarized, what information is being discarded, or why the AI suddenly "forgot" something important. This idea treats context as a first-class artifact of conversation that the human should be able to curate — not a background infrastructure concern.

## Findings

### The Context Degradation Problem

Context rot is well-documented and significant. Chroma Research found two distinct failure modes in long conversations:
- **Below 50% full**: the model loses tokens in the middle (U-shaped attention; "Lost in the Middle," arXiv:2307.03172). Early and late content is recalled; middle content is lost.
- **Above 50% full**: the model begins losing earliest tokens, favoring recent content.

Beyond 100,000 tokens, research shows models tend to repeat past actions rather than generating novel solutions ([dbreunig.com](https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html)). This is observable in practice: long Claude chats start giving worse answers, repeating earlier reasoning, or dropping earlier constraints.

The Anthropic compaction docs explicitly name this: "Compaction keeps the active context focused and performant by replacing stale content with concise summaries." It's not just token limits — it's model cognition degrading as context fills.

### The Current State of Context Management

**Fully automatic approaches (current default):**
- Anthropic's `compact_20260112` API strategy: server-side summarization triggers at a configurable token threshold (default 150K). The model summarizes conversation history and continues. Users see nothing.
- Claude Code `/compact`: user-triggered compression with an optional focus hint. Shows a percentage indicator; user can see how full the context is.
- Cursor's `/summarize` command: user-triggered summarization. A smaller flash model condenses older messages; the history file is kept and can be retrieved if the agent needs details.
- OpenCode's dynamic context pruning: exposes a `prune` tool the AI can call to remove completed tool content and deduplicate repeated tool outputs.
- AWS Amazon Q Developer: automatic chat history compaction in the IDE.

**Semi-automatic with pause hooks (closest to the idea):**
- Anthropic's `pause_after_compaction` parameter: when compaction triggers, the API pauses and returns `stop_reason: "compaction"` before continuing. The developer can inspect the summary, inject content, preserve specific messages, and then resume. This is a developer-facing hook, not user-facing. The use case documented is "preserve the last 2 messages verbatim after compaction" — but the same primitive could power a user-facing review UI.

**Manual context editing (developer-facing):**
- Anthropic's `clear_tool_uses_20250919` strategy: automatically clears old tool results beyond a threshold, keeping the N most recent. Configurable trigger, keep count, exclusion list (`exclude_tools`), and minimum clear amount (`clear_at_least`).
- `clear_thinking_20251015`: clears extended thinking blocks, configurable keep count.
- Client-side SDK compaction: full replacement with a generated summary, customizable prompt, configurable threshold and model. The summary structure can be explicitly specified.

**Long-term memory (orthogonal to in-session context):**
- ChatGPT's memory management: CRUD UI for "saved memories" in Settings > Personalization. Users can delete individual memories but cannot directly edit them — update by deleting + re-telling.
- Claude's memory tool: agent-controlled file-based memory, persistent across sessions.
- Neither of these addresses in-session context window management directly.

### What's Missing: The Human-in-the-Loop Gap

No current tool presents the user with a structured, interactive choice at context compression time. Specifically absent:

1. **Selective retention UI**: "Here are 12 context segments. Which do you want to keep verbatim, summarize, or drop entirely?"
2. **User-authored replacement text**: "You chose to summarize this section. Here's what I'd generate. Edit it before we continue."
3. **Proactive context inspection**: At any point, open a panel showing what's currently in context, organized by type (system instructions, conversation turns, tool outputs, files), and allow direct manipulation.
4. **Context swapping**: Replace an existing context block with something else — e.g., swap out a stale file content block with an updated version.

The closest product experience is Claude Code's `/compact` with focus hint, which lets users guide the summary but not review or edit it. Cursor's `/summarize` is similar — user-triggered but opaque in what it produces.

### Why This Matters: The Invisible Infrastructure Problem

From [New America's OTI brief on AI agent memory](https://www.newamerica.org/oti/briefs/ai-agents-and-memory/): "AI agents can carry user data from one context to another without prompting or transparency, with memory becoming an increasingly invisible infrastructure layer spanning multiple services." The same critique applies to in-session context: users don't know what the AI "remembers" right now, what it's about to forget, or what was silently dropped.

Transparency and user agency are identified as core requirements for trustworthy AI systems (Dave Song, "Control over Context," UI for AI, Jan 2026). Memory dashboards with CRUD operations are cited as the correct pattern for long-term memory. The same principle applies to short-term context: a "context panel" with full visibility and control.

Context rot is a UX problem as much as a technical one. From producttalk.org: users who understand context limits adopt better strategies (start fresh chats, use /compact intentionally), but this requires knowledge most users don't have. Surfacing the context state and giving users agency addresses the root of the problem — not just the symptom.

### Research on What to Keep vs. Compress

**JetBrains NeurIPS 2025 study** ("The Complexity Trap," arXiv:2508.21433): compared observation masking (replacing older tool outputs with placeholders) vs. LLM summarization. Key findings:
- Both approaches reduce costs ~50% vs. raw conversation
- Masking matches summarization in solve rates despite being much simpler
- A hybrid (masking + summarization together) reduces costs a further 7–11%
- Implication: masking individual blocks is a viable, cheap first-pass strategy. Users might prefer "just blank this out" over "summarize this"

**Factory.ai's structured summarization**: evaluated summarization approaches and found structured summaries (explicit sections for intent, modifications, decisions, next steps) significantly outperform unstructured summaries. This validates the "replace with your own text" pattern — users could write structured replacements.

**Anthropic's default compaction prompt structure** (from SDK docs) covers 5 sections: Task Overview, Current State, Important Discoveries, Next Steps, Context to Preserve. This is a good template for user-authored replacement text.

**From dbreunig's "How to Fix Your Context"**: "every token in the context influences the model's behavior, for better or worse." The practical advice is to think of context management as the agent designer's primary job. Extending this to end-users is the natural product evolution.

### Triggering the User Review

Several trigger strategies exist:

- **Threshold-based**: at 70% context fill, present the review panel. Configurable by user.
- **On-demand**: always-available context panel button in the chat UI (like Claude Code's context indicator).
- **Type-triggered**: only trigger review when specific content types dominate (large file contents, long tool outputs) — not for normal conversational turns.
- **AI-suggested**: the model detects it's about to need to summarize and proactively asks: "I'm approaching my context limit. Want to review what I'm keeping?"

The Anthropic `pause_after_compaction` primitive maps directly to the threshold-based approach: detect the trigger, pause, surface the review UI, inject the user's choices, continue.

### Technical Architecture

A human-in-the-loop context management layer would need:

**1. Context segmentation**
Break the message list into semantic segments:
- System prompt (usually immutable)
- Early conversation turns (candidates for summary or drop)
- Tool outputs / file contents (high token count, often stale)
- Recent conversation turns (keep verbatim)
- Key decisions/facts surfaced by the AI

The Anthropic API gives some of this for free: tool use blocks can be distinguished from regular messages, thinking blocks are separate. Segmentation of regular messages requires either AI-assisted classification or turn-window logic.

**2. Presentation layer**
A collapsible panel listing segments, each with:
- Token count
- Content preview (expandable)
- Action selector: Keep | Summarize | Drop | Replace
- If "Summarize": show AI-generated summary, allow edits
- If "Replace": text editor to write custom replacement

For tool outputs specifically, masking (blank placeholder) is likely the right default action, matching the JetBrains finding.

**3. Execution**
After user confirms choices:
- Reconstruct the message list with approved actions
- For "Summarize" items: either use AI-generated text or user's edit
- For "Replace" items: substitute the user's text
- For "Drop" items: remove entirely
- For "Keep" items: pass through unchanged

This maps directly onto the client-side compaction pattern: rebuild the message array and continue.

**4. Persistence**
Optionally: save the user's decisions as a context snapshot. If the conversation continues to grow, another review can be triggered, building on the prior snapshot.

**5. Token accounting**
Show before/after token counts as the user makes selections. This gives immediate feedback on the cost/completeness tradeoff being made.

### UX Patterns from Adjacent Tools

**Claude Code's context indicator**: persistent percentage readout (e.g., "tokens 117k/200k (59%)"). Simple, visible, non-intrusive. Sets the right expectation.

**Vercel AI SDK Elements `Context` component**: circular SVG progress ring + token breakdown (input/output/reasoning/cached) + cost estimate. Interactive hover-card pattern keeps UI clean while providing depth on demand.

**ChatGPT memory UI**: CRUD panel for long-term memory (Settings > Personalization > Manage Memories). Users can delete individual items. No edit — just delete and re-add. This is too blunt for in-session context (you lose the original text), but the list-and-act metaphor is right.

**Cursor's `/summarize`**: user-triggered, produces a summary silently and continues. User agency but no review loop.

**Provisional content pattern**: when new context blocks appear, display at 70% opacity to indicate "pending review." Full opacity after user approval. This maps well to AI-generated summary text: show as provisional until confirmed.

### Novelty Assessment

The core idea — presenting users with a structured interactive choice at context limit time — is **not implemented in any major product** as of February 2026. The closest implementations are:

| Product | What it does | Gap vs. the idea |
|---------|-------------|-----------------|
| Claude Code `/compact` | User-triggered; AI summarizes; user provides focus hint | No review of summary output; no per-block control |
| Anthropic `pause_after_compaction` | Developer hook to inject content after compaction summary | Developer API only; not user-facing |
| ChatGPT memory UI | CRUD on long-term memory | Long-term only; no in-session context management |
| Cursor `/summarize` | User-triggered summarization via command | No review; opaque output |
| Anthropic context editing API | Fine-grained tool result/thinking block clearing | Developer API; programmatic; not interactive |

The gap is specifically the **human-review loop**: letting the user see what will be kept/dropped and approve or edit it before the AI continues.

### Product Design Considerations

**When to show the review**: Showing it every time context fills up would be disruptive. Better triggers:
1. User-initiated ("Show me what's in my context")
2. Approaching limit (e.g., 80%) with a non-blocking notification
3. After a long pause in conversation, as a "before we continue" moment

**What most users will do**: Probably just click "approve default" most of the time. That's fine — the value is in the cases where they don't. The key moments: (a) about to summarize away a code block they'll need back, (b) a file content that's stale and shouldn't influence future answers, (c) an early conversation thread that's now irrelevant.

**Cognitive load**: Presenting 20 context segments to review is too much. The default selection (AI decides what to drop/keep) should be very good, and the UI should highlight only the high-stakes decisions: segments with large token counts, or segments the AI flags as potentially important.

**Trust and collaboration**: The review moment can double as an explanation layer: "I'm about to forget X because it's old, but you should know I'm relying on Y for the next response." This makes the AI's context reasoning transparent, building user trust.

**Swapping context proactively**: Beyond threshold-triggered review, a context panel available at any time lets power users manage their conversation strategically. This is the "context as workbench" metaphor — you're actively shaping the workspace for the AI, not just reacting to limits.

### Implementation Path with Anthropic APIs

The most practical implementation path:

```typescript
// 1. Enable compaction with pause
const response = await client.beta.messages.create({
  betas: ["compact-2026-01-12"],
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  messages,
  context_management: {
    edits: [{
      type: "compact_20260112",
      trigger: { type: "input_tokens", value: 140000 },
      pause_after_compaction: true
    }]
  }
});

// 2. On compaction pause, surface review UI
if (response.stop_reason === "compaction") {
  const compactionSummary = response.content[0]; // The AI's draft summary

  // Surface UI: show original segments + AI draft summary
  // Let user edit the summary, check/uncheck which segments to keep
  const userApprovedSummary = await showContextReviewUI({
    draftSummary: compactionSummary.content,
    originalSegments: segmentMessages(messages),
  });

  // 3. Rebuild message list with user's choices
  const newMessages = [
    { role: "assistant", content: [{
      type: "compaction",
      content: userApprovedSummary
    }]}
  ];

  // 4. Continue
  const continuation = await client.beta.messages.create({
    betas: ["compact-2026-01-12"],
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: newMessages,
    context_management: { edits: [{ type: "compact_20260112" }] }
  });
}
```

The key insight: `pause_after_compaction` already gives you the hook. The AI generates a draft summary (`compaction` block), pauses, and the developer can inject the human review loop before the conversation continues.

For the proactive context panel (not just at-limit), the Anthropic context editing API (`clear_tool_uses_20250919`, `clear_thinking_20251015`) provides programmatic pruning that could back a UI.

### Open Architecture Questions

**Segment granularity**: Should the review UI show individual turns, or thematic segments (grouped by topic)? Topic grouping is more useful but requires semantic clustering — feasible with embedding-based chunking but adds complexity.

**Custom replacement text quality**: If the user writes poor replacement text, the AI will be confused. Some validation or AI-assisted editing would help ("Here's a better way to express what you wrote").

**Multi-turn context panel**: The context panel needs to stay synchronized with the live conversation. As new turns are added, the panel needs to update — this is complex state management in a chat UI.

**Anchoring important context**: Users should be able to "pin" certain context blocks — marking them as always-keep, immune from auto-compaction. This is analogous to `exclude_tools` in the API but user-facing.

## Open Questions

1. **Do users actually want this?** Would most users ever use a context management panel, or is this a power-user feature? Testing with real users is needed to validate demand vs. the automatic approach.

2. **What's the right default?** The AI-generated summary should be very good so that "approve default" is safe. But what should the default selection be for each segment type? (Tool outputs → mask, early conversation → summarize, recent conversation → keep seems like a reasonable heuristic.)

3. **How should the review UI handle tool outputs specifically?** Tool outputs are often large, machine-readable, and transient. The review UI should probably pre-select "mask" or "drop" for them, unless the user has explicitly referenced a tool result recently.

4. **Should the user's choices be saved as preferences?** "Always keep code blocks verbatim" or "always drop web search results after they're cited" could be learned from user behavior over time.

5. **Is there a better mental model than "context window"?** Most users don't know what a context window is. Framing it as "your shared whiteboard with the AI" or "what the AI currently knows about your conversation" might make the review UI more accessible.

6. **Can this integrate with the Memory tool?** When a user decides to "drop" context, they might also want to save it to long-term memory. The review UI could offer "Drop from here but save to memory" as an option.

7. **How does this work in streaming UIs?** The review hook happens mid-conversation, potentially interrupting a streaming response. The UX needs to handle the pause gracefully.

## Extracted Principles

If this idea were to be implemented, the following principles would guide it:

- **Context transparency as UX baseline**: Always show context usage percentage. Users can't manage what they can't see.
- **Human approval for any destructive context action**: Never silently drop or summarize context without a chance for user review (or at least undo).
- **Default selection should be good enough to approve without editing**: The system should be useful even for users who never customize; the review loop is for power users who want control.
- **Tool outputs are the primary pruning target**: They're large, transient, and rarely need to be kept verbatim once processed.
- **Keep recent turns verbatim, summarize old turns, mask/drop tool outputs**: This three-tier default (from JetBrains research + Anthropic patterns) is the right starting heuristic.

Principles have not been extracted to a separate principles file yet — this is a product idea, not a proven pattern. Principles should be extracted after implementation and validation.

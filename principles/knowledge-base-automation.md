# Knowledge Base Automation

## Summary

Principles for exposing markdown knowledge bases such as Obsidian vaults to scripts and AI agents. The central decision is not whether a note app has a CLI, but which boundary the automation should cross: local desktop control, remote synchronized access, structured API access, or direct filesystem access. Prefer portable plain-text data and narrow semantic tools over broad app control.

## Principles

### Match Interface To The Automation Boundary
- **What:** Use local desktop CLI when the workflow is interactive and runs on the same machine as the note app. Use headless or synced access when the workflow must run remotely or in an isolated environment. Use REST or MCP when the workflow needs structured tool calls. Use filesystem tools when the workflow is mostly batch markdown manipulation.
- **Why:** Each interface carries a different runtime dependency and trust boundary. The wrong interface adds unnecessary coupling, fragility, or exposure.
- **When:** Any time you connect a personal knowledge base to automation or AI agents. Re-evaluate when the workflow shifts from local to remote, or from human-triggered to autonomous.
- **Source:** [research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md](../research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md)

### Prefer High-Level Agent Tools Over Raw App Control
- **What:** Give agents a small set of semantic operations such as `search_notes`, `read_note`, `append_to_inbox`, or `create_research_note`, instead of broad command-palette access, raw `eval`, or a large number of low-level note actions.
- **Why:** Agents are more reliable with fewer clearer tools, and the blast radius is smaller when a tool misfires.
- **When:** Any MCP, REST, or wrapper-based integration between an AI agent and a knowledge base. Keep raw command execution and arbitrary evaluation behind manual approval or human-owned scripts.
- **Source:** [research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md](../research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md)

### Start Read-Only, Then Add One Write Path
- **What:** Introduce AI access in stages: search and read first, then one narrow write path such as append-only inbox capture, then broader mutation only if the workflow proves it is necessary.
- **Why:** Most AI knowledge workflows are retrieval-first. Broad write access creates avoidable integrity and security risk before there is evidence that the extra power is worth it.
- **When:** Any new AI integration with personal notes, research vaults, or markdown knowledge bases.
- **Source:** [research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md](../research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md)

### Keep The Vault Plain-Text Portable
- **What:** Prefer integrations that operate on markdown files, properties, tags, and stable identifiers rather than app-internal UI state wherever possible.
- **Why:** Portability lets the same knowledge base work across shell tools, git, REST layers, MCP wrappers, and future note interfaces without migration. The markdown corpus remains the durable asset rather than a single app surface.
- **When:** Always, unless the workflow explicitly depends on workspace automation or app-specific commands.
- **Source:** [research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md](../research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md)

## Revision History
- 2026-03-14: Initial extraction from [research obsidian CLI. interested to see if it's something that can be useful with my current ai driven workflows](../research/2026-03-14-research-obsidian-cli-interested-to-see-if-it-s-something-that-can-be-useful-with-my-current-ai-driven-workflows.md).

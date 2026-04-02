---
date: 2026-03-13
topic: Research into open source agentic harnesses for local development.
status: complete
tags: []
---

# Research into open source agentic harnesses for local development.

## Context
This was investigated to answer the prompt: "Research into open source agentic harnesses for local development."

There is already closely related repo research in `research/2026-02-25-agent-harnesses.md`, which defined the harness layer conceptually and extracted general orchestration principles. This session narrows the scope to open source tools a developer can actually run locally in 2026, on the host machine, in an IDE, or inside a sandboxed runtime, and asks a more practical question: which harness should you use for day-to-day development work, and what trade-offs matter more than model benchmarks?

During orientation, the principles DB had no direct match for this topic. The research DB query failed with `malformed JSON`, so prior duplication avoidance relied on `sessions.md` and the existing `agent-harnesses` research file instead.

## Findings

### 1. A local agentic harness is not just "an AI coding tool"

The most useful distinction remains LangChain's 2025 taxonomy: frameworks provide building blocks, runtimes provide execution semantics, and harnesses provide an opinionated, batteries-included layer that developers can actually operate day to day. For local development, the harness is the part that decides where the agent runs, how it gets file and shell access, how permissions are enforced, how plans and memory are externalized, and whether the workflow works better as pair programming or delegated execution. (Source: [LangChain, "Agent Frameworks, Runtimes, and Harnesses"](https://blog.langchain.com/agent-frameworks-runtimes-and-harnesses-oh-my/))

OpenAI's January 2026 harness engineering writeup reinforces the practical version of the same idea: repository-local artifacts, plans, and executable workflows matter because anything the agent cannot see in-context "effectively doesn't exist." Anthropic's 2025-2026 engineering guidance says the same thing from the context side: keep the token set high-signal, offload state to files or memory systems, and use subagents or phased work for complexity. (Sources: [OpenAI, "Harness engineering: leveraging Codex in an agent-first world"](https://openai.com/index/harness-engineering/), [Anthropic, "Effective context engineering for AI agents"](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Anthropic, "Effective harnesses for long-running agents"](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents))

For local development, that means harness selection is mostly about six axes:

1. Control loop location: terminal, IDE, or sandboxed worker.
2. Isolation model: host access, worktree isolation, or container/sandbox boundary.
3. Permission system: explicit allow/ask/deny, approval popups, or "trust me" mode.
4. Verification loop: built-in lint/test/build behavior, or manual verification burden.
5. Workflow packaging: repo-local rules, skills, recipes, checks, and plans.
6. Extensibility: MCP, custom tools, subagents, and editor integration.

Model support matters, but for local work the biggest failures usually come from the harness layer, not pure reasoning.

### 2. The open source landscape has now split into three practical categories

#### Terminal-first harnesses

These are best when your main feedback loop is: inspect files, run commands, run tests, refine, repeat.

**Aider** is still the clearest "minimal but sharp" option. Its docs emphasize terminal pair programming, wide model/provider support, explicit chat modes, and an unusually strong verification loop. `ask` discusses code without edits, `code` edits directly, and `architect` uses a two-model flow where one model proposes the change and an editor model translates that into concrete file edits. Aider can also auto-run linters and tests after every edit and try to repair failures automatically. It also exposes a repo map, making it especially good for repo-wide but still human-steered work. (Sources: [Aider chat modes](https://aider.chat/docs/usage/modes.html), [Aider linting and testing](https://aider.chat/docs/usage/lint-test.html), [Aider docs](https://aider.chat/docs/))

**OpenCode** is terminal-first too, but more explicitly "harness-shaped" than aider. Its `/init` command creates an `AGENTS.md` file and the docs recommend committing that file. It has built-in primary agents (`Build`, `Plan`) and subagents (`General`, `Explore`), explicit `permission` rules with `allow` / `ask` / `deny`, and support for MCP servers, ACP editor integration, agent skills, custom tools, and repo-local rules. This makes it a stronger fit when you want terminal UX plus first-class harness primitives instead of a lighter pair-programming loop. The trade-off is more surface area to configure. (Sources: [OpenCode intro](https://opencode.ai/docs/), [OpenCode rules](https://opencode.ai/docs/rules/), [OpenCode agents](https://opencode.ai/docs/agents/), [OpenCode permissions](https://opencode.ai/docs/permissions/), [OpenCode ACP support](https://opencode.ai/docs/acp/), [OpenCode skills](https://opencode.ai/docs/skills/))

**Goose** sits between those two in spirit. Block positions it as an open source local AI agent that runs locally, is extensible, and can connect to "any external MCP server or API." The interesting differentiator is workflow packaging: Goose has an extension directory and a recipes cookbook so teams can share installable capability bundles and one-click workflows. That is useful if the main problem is not "how do I prompt the model?" but "how do I package a repeatable setup for the next person?" The docs are clearer on extensibility than on fine-grained permission policy, so I infer that teams should audit extension scope carefully before granting wide host access. (Sources: [Goose homepage](https://block.github.io/goose/), [Goose extensions](https://block.github.io/goose/extensions/), [Goose recipes cookbook](https://block.github.io/goose/recipes/))

#### IDE-first harnesses

These are best when your main feedback loop is faster than a terminal agent usually allows, especially for inspect-edit-approve work inside an existing editor workflow.

**Cline** is the most feature-rich open source IDE-first harness in this set. The docs expose a large feature surface: Memory Bank, Focus Chain, Auto Approve, Auto Compact, Multi-Root Workspaces, Subagents, Background Edit, Web Tools, Worktrees, MCP, rules, skills, workflows, hooks, and a CLI that also supports headless automation and CI/CD. The important operational detail is that permissions are evaluated per tool call, and the docs explicitly recommend starting with read-only project access and leaving edits, commands, browser, and MCP disabled until you need them. The docs also warn that YOLO mode auto-approves everything and disables safety checks. That combination makes Cline strong for advanced users who want one harness across IDE, terminal, and CI, but only if they are disciplined about permissions. Another subtle trade-off is that "safe" commands are not a fixed allowlist, the model marks them with a `requires_approval` flag, so governance is partly learned behavior rather than fully declarative policy. (Sources: [Cline docs home](https://docs.cline.bot/home), [Cline auto approve](https://docs.cline.bot/features/auto-approve), [Cline CLI getting started](https://docs.cline.bot/cline-cli/getting-started))

**Roo Code** is more opinionated about where it shines. Its docs say the VS Code extension "works locally" and is "great for deep or highly iterative solo development work." It also emphasizes customizable Modes, optional Auto-Approve, and an Orchestrator that can coordinate tasks across modes once you trust it. That makes Roo a good fit for developers who already live inside VS Code and want more autonomy without leaving the editor. The main trade-off is the same one visible in Cline: as soon as you increase trust and enable more auto-approval, the risk surface expands much faster than the UX makes it feel. Roo is telling you this directly by pairing "be ambitious" with a gradual trust model. My read is that Roo is strongest when paired with worktrees or disposable local environments for anything more aggressive than ordinary file edits. (Sources: [Roo Code docs](https://docs.roocode.com/))

#### Sandbox-first or delegated local runners

These are best when you want the agent to feel more like a task worker than an in-editor assistant.

**OpenHands** is the strongest open source example here. The docs present a full stack: SDK, CLI, Local GUI, and cloud/enterprise variants. The CLI is framed as familiar to Claude Code or Codex users, the SDK can run agents locally or scale to thousands in the cloud, and the "When to Use OpenHands" guidance is unusually concrete. Simple tasks are ideal. Medium tasks are good with more context. Complex tasks should be broken into phases. The docs also make the runtime trade-off explicit: the preferred story is an isolated sandbox, but OpenHands also supports a Process sandbox with no container isolation, and headless mode always runs with approvals disabled. That means OpenHands is only "sandbox-first" if you actually keep it in a sandbox. It also recommends AGENTS.md, clean repo state, passing tests, and post-task validation including lint, build, tests, manual checks, and edge cases. This is a much stronger operational story for delegated execution than most IDE plugins provide. The trade-off is obvious too: it is heavier and less fluid than terminal or editor pair-programming for tiny edits, and its safest posture depends on runtime choice. (Sources: [OpenHands introduction](https://docs.openhands.dev/overview/introduction), [OpenHands CLI](https://docs.openhands.dev/usage/how-to/cli-mode), [OpenHands headless mode](https://docs.openhands.dev/openhands/usage/run-openhands/headless-mode), [OpenHands process sandbox](https://docs.openhands.dev/openhands/usage/sandboxes/process))

#### Cross-surface and companion systems

**Continue** deserves a more nuanced slot than "just checks." Its current docs split the product into open source IDE extensions, a terminal CLI (`cn`) with TUI and headless modes, and repo-defined checks. In other words, Continue is now a real local harness across IDE and terminal, not just a PR review product. The reason I still treat it differently from aider, OpenCode, Cline, Roo, and OpenHands is that its strongest distinctive pattern is repo-defined governance: checks are markdown files in `.continue/checks/` or `.agents/checks/`, show up as GitHub status checks, and can be paired with broader agents and workflows. That makes Continue especially attractive if you want one stack for interactive local work plus versioned AI review logic in CI. (Sources: [Continue intro](https://docs.continue.dev/index), [Continue CLI quickstart](https://docs.continue.dev/cli/quickstart), [Continue Agent mode](https://docs.continue.dev/ide-extensions/agent/quick-start), [Continue check file reference](https://docs.continue.dev/checks/reference), [Continue docs home](https://docs.continue.dev/))

### 3. The real decision framework is interface plus isolation, not brand preference

The cleanest selection matrix I can justify from the sources is:

| Tool | Best fit | Why it stands out | Main trade-off |
| --- | --- | --- | --- |
| Aider | Terminal pair programming, test-driven workflows | Strong ask/code/architect loop, auto lint/test, broad model support | Less explicit harness policy and isolation than newer harness-first tools |
| OpenCode | Terminal-first harness with explicit rules and permissions | `AGENTS.md`, built-in plan/build agents, subagents, granular permissions, skills, ACP | More configuration surface |
| Goose | Local extensibility and reusable workflows | Extensions, recipes, MCP/API integration, local execution | Permission story is less explicit in the docs than OpenCode/Cline |
| Cline | Power-user IDE plus CLI plus CI | Huge feature surface, MCP, subagents, worktrees, headless mode | Permission discipline is mandatory, YOLO mode is intentionally dangerous |
| Roo Code | VS Code-centric iterative solo work | Modes, Orchestrator, strong in-editor loop | Trust/autonomy can outrun isolation if you escalate too quickly |
| OpenHands | Sandboxed delegated task execution | Best explicit task-fit guidance and sandbox boundary story | Heavier than pair-programming tools for small edits |
| Continue | Cross-surface local agent plus repo-defined checks | IDE agent mode, terminal CLI, headless mode, versioned checks in repo | Product emphasis is split between interactive use and governance workflows |

If I had to turn that into direct recommendations:

1. Choose **Aider** if you want the simplest open source terminal tool that behaves like a disciplined pair programmer and you care most about test and lint closure.
2. Choose **OpenCode** if you want a terminal-native open source harness with stronger policy, subagent, and repo-rule primitives.
3. Choose **Cline** or **Roo Code** if your editor is the center of gravity and you are willing to actively manage permissions.
4. Choose **OpenHands** if the task should execute as delegated work and you can keep it inside an actual sandboxed runtime.
5. Choose **Goose** if packaging repeatable local workflows as recipes/extensions is a core need.
6. Choose **Continue** if you want one open source stack across IDE, terminal, and headless automation, especially when repo-defined review checks matter as much as interactive editing.

### 4. Best practices that show up across the strongest sources

#### Put the workflow in the repo, not just in chat

This is one of the strongest convergent findings. OpenCode says `/init` should generate `AGENTS.md` and that the file should be committed. OpenHands recommends AGENTS.md and a repo-preparation checklist. OpenAI says plans, decision logs, and other artifacts should be versioned and co-located because otherwise the agent cannot rely on them. Continue treats each review heuristic as a markdown file in the repo. The practical implication is simple: if a workflow is repeatable, version it. Do not leave it trapped in one person's prompt history. (Sources: [OpenCode rules](https://opencode.ai/docs/rules/), [When to Use OpenHands](https://docs.openhands.dev/openhands/usage/essential-guidelines/when-to-use-openhands), [OpenAI harness engineering](https://openai.com/index/harness-engineering/), [Continue docs](https://docs.continue.dev/))

#### Keep context lean and use subagents or phases for complexity

Anthropic's guidance is explicit: offload state outside the context window, use subagents for focused exploration, and keep the in-context token set small and high-signal. OpenCode bakes this into a built-in `Plan` primary agent and `Explore` subagent. OpenHands tells users to split complex tasks into phases. Aider's `ask` and `architect` modes offer a lighter single-user version of the same idea. The pattern is consistent: planning, exploration, and editing should not all happen in one undifferentiated prompt stream. (Sources: [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Anthropic long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [OpenCode agents](https://opencode.ai/docs/agents/), [When to Use OpenHands](https://docs.openhands.dev/openhands/usage/essential-guidelines/when-to-use-openhands), [Aider chat modes](https://aider.chat/docs/usage/modes.html))

#### Verification should be automatic, or it will get skipped

Aider has the most direct embodiment of this idea with auto lint and auto test after edits. OpenHands explicitly tells users to review changed files, run tests, lint, build, do manual testing, and check edge cases. OpenAI's harness article also emphasizes working depth-first with code, review, and test as explicit building blocks. For local harnesses, the right question is not "can the agent edit code?" but "what happens immediately after the edit?" Any harness without a tight verification loop will look impressive in demos and expensive in real repos. (Sources: [Aider linting and testing](https://aider.chat/docs/usage/lint-test.html), [When to Use OpenHands](https://docs.openhands.dev/openhands/usage/essential-guidelines/when-to-use-openhands), [OpenAI harness engineering](https://openai.com/index/harness-engineering/))

#### Match isolation to autonomy

This is the biggest operational lesson in the current open source landscape. OpenHands makes the sandbox boundary a first-class part of the story, but its own docs also show how easy it is to opt into process mode or headless always-approve when convenience wins. Cline exposes powerful auto-approve features and then explicitly warns that YOLO mode disables safety checks. Roo tells users to increase trust gradually. OpenCode lets you write narrow permission rules, even down to command and file-pattern granularity. Continue similarly separates `--readonly`, `--auto`, and per-tool allow/exclude flags in the CLI, which is a good sign that the team treats permissioning as a first-class control surface. The practical conclusion is straightforward: as soon as you allow broad command execution, package installation, browser automation, or long-running autonomy, you should move the agent into a more isolated environment than your main host repo. If you cannot isolate it, keep the permission model conservative. (Sources: [OpenHands headless mode](https://docs.openhands.dev/openhands/usage/run-openhands/headless-mode), [OpenHands process sandbox](https://docs.openhands.dev/openhands/usage/sandboxes/process), [Cline auto approve](https://docs.cline.bot/features/auto-approve), [Roo Code docs](https://docs.roocode.com/), [OpenCode permissions](https://opencode.ai/docs/permissions/), [Continue CLI quickstart](https://docs.continue.dev/cli/quickstart))

#### MCP is now table stakes, not a differentiator

Goose, OpenHands, Cline, Roo Code, and OpenCode all foreground extensibility via MCP or MCP-adjacent integration. That means "supports MCP" is no longer enough to pick a harness. The differentiators have moved to permission quality, auditability, context controls, workflow packaging, and whether the human control loop fits your daily development style. (Sources: [Goose homepage](https://block.github.io/goose/), [OpenHands introduction](https://docs.openhands.dev/overview/introduction), [Cline docs home](https://docs.cline.bot/home), [Roo Code docs](https://docs.roocode.com/), [OpenCode intro](https://opencode.ai/docs/))

### 5. Concrete examples worth stealing

#### Example: a disciplined terminal-first loop with aider

```bash
aider --model anthropic/<your-model> \
  --chat-mode architect \
  --auto-test \
  --test-cmd "pnpm test"
```

Why this matters: it encodes the planning/edit split and makes verification non-optional. This follows aider's documented `architect` mode plus automatic test execution. (Sources: [Aider chat modes](https://aider.chat/docs/usage/modes.html), [Aider linting and testing](https://aider.chat/docs/usage/lint-test.html))

#### Example: a safer default permission policy with OpenCode

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "bash": {
      "*": "ask",
      "git status": "allow",
      "pnpm test": "allow",
      "rm *": "deny"
    },
    "edit": {
      "*": "ask",
      "docs/**/*.md": "allow"
    }
  }
}
```

This follows the structure of OpenCode's documented permission system, but narrows it to a conservative local-development posture. The important pattern is not the exact commands. It is the fact that explicit policy beats vague prompt instructions. (Source: [OpenCode permissions](https://opencode.ai/docs/permissions/))

#### Example: the minimum repo-local agent file

```markdown
# AGENTS.md

## Build
- `pnpm build`

## Test
- `pnpm test`

## Lint
- `pnpm lint`

## Constraints
- Do not modify infrastructure or secrets.
- Follow existing patterns in `src/features/`.
- Add or update tests for behavior changes.
```

This is deliberately plain. It matches the consistent advice from OpenHands, OpenCode, and OpenAI: put executable commands and hard project constraints in versioned repo-local artifacts so the harness has something concrete to load and verify. (Sources: [When to Use OpenHands](https://docs.openhands.dev/openhands/usage/essential-guidelines/when-to-use-openhands), [OpenCode rules](https://opencode.ai/docs/rules/), [OpenAI harness engineering](https://openai.com/index/harness-engineering/))

### 6. Emerging trends to watch

1. **Repo-local artifacts are becoming the common currency.** `AGENTS.md`, plan files, repo-visible checks, and workflow recipes are replacing purely personal prompt habits. (Sources: OpenCode, OpenHands, OpenAI, Continue)
2. **Cross-surface harnesses are winning.** Cline explicitly spans IDE, terminal, and CI. OpenCode adds ACP support for editor integration. The market is moving away from single-surface tools. (Sources: [Cline CLI getting started](https://docs.cline.bot/cline-cli/getting-started), [OpenCode ACP support](https://opencode.ai/docs/acp/))
3. **Specialized agents and modes are becoming standard in local tools.** OpenCode ships primary agents plus subagents. Cline exposes subagents. Roo exposes modes plus an orchestrator. Anthropic's engineering guidance strongly supports this pattern. (Sources: [OpenCode agents](https://opencode.ai/docs/agents/), [Cline docs home](https://docs.cline.bot/home), [Roo Code docs](https://docs.roocode.com/), [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
4. **Guardrails are separating from interaction.** Continue's repo-defined checks represent a different but complementary layer: even when the same product also ships an interactive IDE or CLI agent, teams increasingly want recurring AI review logic to live in versioned check files rather than in a human's memory. That separation will likely grow. (Sources: [Continue docs home](https://docs.continue.dev/), [Continue check file reference](https://docs.continue.dev/checks/reference))

## Open Questions

1. Which open source harness has the best tracing and replay story for local teams? The docs reviewed here are much stronger on interaction and permissions than on standardized execution observability.
2. Will explicit declarative permission systems like OpenCode's prove easier to govern than model-assisted safety classification like Cline's "safe command" approach?
3. How durable will ACP-style cross-editor portability become compared with MCP, which already has obvious momentum as the tool-extension layer?
4. How should teams evaluate security and provenance for extension and recipe marketplaces as these ecosystems grow?
5. Which of these projects will sustain strong maintenance velocity over the next year, especially the younger harness-first tools?

## Extracted Principles

Updated `principles/agent-task-orchestration.md` with:

- **Match Harness Interface to the Human Feedback Loop**: Choose terminal-first, IDE-first, or sandboxed harnesses based on where the actual human control loop lives.
- **Autonomy Must Scale With Isolation**: As auto-approve, shell access, and long-running autonomy increase, isolation must increase too.

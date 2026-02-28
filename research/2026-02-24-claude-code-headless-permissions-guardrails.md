---
date: 2026-02-24
topic: Claude Code headless permissions, safety mechanisms, and guardrails
status: complete
tags: [claude-code, permissions, headless, automation, safety, ci-cd, hooks, sandboxing, docker]
related: []
---

# Claude Code Headless Permissions, Safety Mechanisms, and Guardrails

## Context

Research into the complete permission model, safety mechanisms, and guardrails available for running Claude Code in headless/automated agent configurations. Covers CLI flags, settings-based permissions, hooks system, operational limits, git safety, container isolation, GitHub Actions integration, and practitioner patterns.

## Findings

### 1. Permission Modes

Claude Code has five permission modes that control how tool approval works:

| Mode | Description | Risk Level |
|------|-------------|------------|
| `default` | Prompts for permission on first use of each tool | Lowest |
| `acceptEdits` | Auto-accepts file edit permissions for the session; commands still require approval | Low-Medium |
| `plan` | Claude can analyze but NOT modify files or execute commands | Observation only |
| `dontAsk` | Auto-denies all tools unless pre-approved via `/permissions` or `permissions.allow` rules | Medium (whitelist-only) |
| `bypassPermissions` | Skips ALL permission prompts | Highest |

**Setting modes via CLI:**

```bash
# Start in plan mode (read-only analysis)
claude --permission-mode plan

# Start in accept-edits mode
claude --permission-mode acceptEdits

# Start in bypass mode (DANGEROUS — requires safe environment)
claude --permission-mode bypassPermissions

# Compose bypass with plan fallback
claude --permission-mode plan --allow-dangerously-skip-permissions
```

**Setting modes in settings.json:**

```json
{
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```

**During interactive sessions:** Press `Shift+Tab` to cycle through modes.

### 2. The `--dangerously-skip-permissions` Flag

The nuclear option. Bypasses ALL permission prompts.

```bash
# Headless mode with no permission prompts
claude -p --dangerously-skip-permissions "implement the feature described in SPEC.md"

# Piped input
cat spec.md | claude -p --dangerously-skip-permissions "implement this"
```

**What it bypasses:** File reads, writes, edits, all shell command execution, network requests, MCP tool calls — everything.

**Official recommendation from Anthropic:** "Only for Docker containers with no internet" or equivalent isolated environments.

**The `--allow-dangerously-skip-permissions` variant:**
This is a softer flag that *enables* bypass as an *option* without immediately activating it. Useful for composing with `--permission-mode`:

```bash
# Start in plan mode but allow escalation to bypass if needed
claude --permission-mode plan --allow-dangerously-skip-permissions
```

**Enterprise lockout:** Admins can prevent bypass entirely:

```json
// In managed-settings.json
{
  "disableBypassPermissionsMode": "disable"
}
```

### 3. `--allowedTools` and `--disallowedTools`

Fine-grained tool control via CLI flags.

```bash
# Only allow specific safe operations
claude -p --allowedTools "Bash(git log *)" "Bash(git diff *)" "Read" "Grep" "Glob" \
  "fix the failing tests"

# Block destructive tools
claude -p --disallowedTools "Bash(rm *)" "Bash(git push *)" "Write" \
  "review this code"
```

**`--allowedTools`:** Tools that execute WITHOUT prompting. Does not restrict which tools are available — use `--tools` for that.

**`--disallowedTools`:** Tools completely removed from model context. Claude cannot even attempt to use them.

**`--tools`:** Restricts which built-in tools Claude can use:

```bash
# Only allow read-only tools
claude --tools "Read,Grep,Glob"

# Disable all built-in tools
claude --tools ""

# All tools (default)
claude --tools "default"
```

### 4. Settings-Based Permissions

Permissions are configured in JSON settings files at four scopes:

| Scope | Path | Precedence | Shared |
|-------|------|------------|--------|
| Managed | `/etc/claude-code/managed-settings.json` (Linux) | Highest | Admin-deployed |
| User | `~/.claude/settings.json` | 3rd | No |
| Project | `.claude/settings.json` | 2nd | Yes (git-committed) |
| Local | `.claude/settings.local.json` | 2nd (over project) | No (gitignored) |

**Evaluation order:** deny -> ask -> allow (first match wins, deny always takes precedence).

**Complete permission config example:**

```json
{
  "permissions": {
    "allow": [
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Bash(npx tsc --noEmit)",
      "Read",
      "Grep",
      "Glob"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(npm run build)"
    ],
    "deny": [
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(rm -rf *)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(~/.aws/**)",
      "WebFetch"
    ],
    "additionalDirectories": ["../docs/"],
    "defaultMode": "acceptEdits"
  }
}
```

**Permission rule syntax:**

| Rule | Matches |
|------|---------|
| `Bash` | All bash commands |
| `Bash(npm run *)` | Commands starting with `npm run` |
| `Bash(* --version)` | Commands ending with `--version` |
| `Read(./.env)` | Reading `.env` in project root |
| `Edit(/src/**)` | Editing any file under `src/` recursively |
| `WebFetch(domain:example.com)` | Fetches to example.com |
| `mcp__puppeteer__*` | All tools from puppeteer MCP server |
| `Task(Explore)` | The Explore subagent |

**Path pattern types (follows gitignore spec):**
- `//path` — Absolute from filesystem root
- `~/path` — Relative to home directory
- `/path` — Relative to project root
- `./path` or `path` — Relative to current directory

**Important:** `*` matches within a single directory; `**` matches recursively.

**Managed-only settings (enterprise):**

```json
{
  "disableBypassPermissionsMode": "disable",
  "allowManagedPermissionRulesOnly": true,
  "allowManagedHooksOnly": true,
  "allowManagedMcpServersOnly": true,
  "sandbox": {
    "network": {
      "allowManagedDomainsOnly": true
    }
  }
}
```

### 5. Hooks System

Hooks are user-defined shell commands, LLM prompts, or agents that execute at specific lifecycle points. They are the primary mechanism for programmatic gating of agent behavior.

**Hook events (in lifecycle order):**

| Event | When | Can Block? |
|-------|------|------------|
| `SessionStart` | Session begins/resumes | No |
| `UserPromptSubmit` | User submits prompt, before processing | Yes |
| `PreToolUse` | Before tool call executes | Yes (allow/deny/ask) |
| `PermissionRequest` | Permission dialog appears | Yes (allow/deny) |
| `PostToolUse` | After tool succeeds | No (can provide feedback) |
| `PostToolUseFailure` | After tool fails | No |
| `Notification` | System notification | No |
| `SubagentStart` | Subagent spawned | No |
| `SubagentStop` | Subagent finishes | Yes |
| `Stop` | Claude finishes responding | Yes (can force continuation) |
| `TeammateIdle` | Teammate about to go idle | Yes |
| `TaskCompleted` | Task being marked complete | Yes |
| `ConfigChange` | Config file changes | Yes |
| `WorktreeCreate` | Worktree being created | Yes |
| `WorktreeRemove` | Worktree being removed | No |
| `PreCompact` | Before context compaction | No |
| `SessionEnd` | Session terminates | No |

**Hook types:**
- `command` — Runs a shell command. Receives JSON on stdin, returns decisions via exit code + stdout.
- `prompt` — Single-turn LLM evaluation. Returns `{ "ok": true/false, "reason": "..." }`.
- `agent` — Multi-turn subagent with tool access (Read, Grep, Glob). Up to 50 turns.

**Configuration locations (scope determines precedence):**
- `~/.claude/settings.json` — All projects
- `.claude/settings.json` — Single project (committable)
- `.claude/settings.local.json` — Single project (gitignored)
- Managed policy settings — Organization-wide
- Plugin `hooks/hooks.json` — When plugin enabled
- Skill/agent frontmatter — While component active

**Example: Block destructive commands via PreToolUse hook:**

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/block-destructive.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/block-destructive.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE 'rm -rf|DROP TABLE|DROP DATABASE|format |mkfs'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Destructive command blocked by safety hook"
    }
  }'
else
  exit 0
fi
```

**Example: Auto-approve safe commands via PermissionRequest hook:**

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/auto-approve-safe.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/auto-approve-safe.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Auto-approve read-only git commands and test runners
if echo "$COMMAND" | grep -qE '^(git (log|diff|status|branch)|npm (test|run lint|run check)|npx tsc)'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: {
        behavior: "allow"
      }
    }
  }'
else
  exit 0  # Fall through to normal permission flow
fi
```

**Example: Prompt-based Stop hook (prevents premature stopping):**

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check: 1) All requested tasks complete? 2) Any errors unaddressed? 3) Follow-up work needed? Respond with {\"ok\": true} or {\"ok\": false, \"reason\": \"...\"}.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Example: Agent-based hook (multi-turn verification):**

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify all unit tests pass. Run the test suite and check results. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**Hook JSON input (common fields on stdin):**

```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

**PreToolUse decision output (three outcomes):**

```json
// Allow (bypass permission system)
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Safe read-only command"
  }
}

// Deny (block the tool call)
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked"
  }
}

// Ask (escalate to user)
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "Unfamiliar command — please review"
  }
}
```

**Input modification (PreToolUse can rewrite tool input):**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "command": "npm run lint -- --fix"
    }
  }
}
```

**Async hooks (non-blocking, for long-running tasks):**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/run-tests-async.sh",
            "async": true,
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

**Disable all hooks:**

```json
{
  "disableAllHooks": true
}
```

### 6. `--max-turns`

Limits the number of agentic turns in print/headless mode (`-p`). Exits with an error when the limit is reached.

```bash
# Limit to 3 agentic turns
claude -p --max-turns 3 "fix the failing test"

# Limit to 10 turns
claude -p --max-turns 10 "implement user authentication"

# No limit (default)
claude -p "do the thing"
```

Available in print mode only (`-p`). No limit by default. Also configurable per-subagent via the `--agents` flag:

```bash
claude --agents '{
  "reviewer": {
    "description": "Code reviewer",
    "prompt": "Review code quality",
    "tools": ["Read", "Grep", "Glob"],
    "maxTurns": 5
  }
}'
```

### 7. Cost/Token Limits

**`--max-budget-usd`** — Maximum dollar amount to spend on API calls before stopping. Print mode only.

```bash
# Stop after $5 of API usage
claude -p --max-budget-usd 5.00 "implement the full feature"

# Tight budget for a quick review
claude -p --max-budget-usd 0.50 "review this PR for security issues"
```

**OpenTelemetry monitoring** for tracking usage across an organization:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.example.com:4317
```

Key metrics exported:
- `claude_code.cost.usage` — Cost in USD per API request
- `claude_code.token.usage` — Tokens used (input/output/cacheRead/cacheCreation)
- `claude_code.session.count` — Session counts
- `claude_code.active_time.total` — Active time in seconds

**No built-in per-organization spending cap.** Cost metrics are approximations — refer to API provider billing for official data.

### 8. Git Safety

**Write access restriction:** Claude Code can only write to the directory it was started in and subdirectories. Cannot modify files in parent directories.

**Worktrees for isolation:**

```bash
# Start in an isolated git worktree
claude -w feature-auth

# Auto-generates name if not provided
claude -w
```

Worktrees create a separate working copy at `<repo>/.claude/worktrees/<name>`. Changes are isolated from the main working tree. On session exit, prompted to keep or remove.

**Worktree hooks for non-git VCS:**

```json
{
  "hooks": {
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'NAME=$(jq -r .name); DIR=\"$HOME/.claude/worktrees/$NAME\"; svn checkout https://svn.example.com/repo/trunk \"$DIR\" >&2 && echo \"$DIR\"'"
          }
        ]
      }
    ]
  }
}
```

**Pre-commit hooks:** Standard git pre-commit hooks work normally. Claude Code respects them (does not use `--no-verify` unless instructed).

**Branch protection:** GitHub branch protection rules apply normally — Claude cannot push to protected branches without passing required checks.

### 9. Container/Sandbox Isolation

#### Native Sandboxing (Built-in)

Claude Code has native OS-level sandboxing for Bash commands.

**Implementation:**
- **macOS:** Seatbelt framework
- **Linux/WSL2:** bubblewrap (`bwrap`) + socat
- Requires `bubblewrap` and `socat` packages on Linux

**Two isolation layers:**
1. **Filesystem:** Read/write limited to current working directory. Blocked from modifying files outside.
2. **Network:** All processes communicate through a Unix domain socket to an external proxy. Only approved domains can be accessed.

**Enable via `/sandbox` command or settings:**

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["docker", "git"],
    "allowUnsandboxedCommands": true,
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org", "registry.yarnpkg.com"],
      "allowUnixSockets": ["/var/run/docker.sock"],
      "allowLocalBinding": true,
      "httpProxyPort": 8080,
      "socksProxyPort": 8081
    }
  }
}
```

**Key statistic:** Sandboxing reduces permission prompts by 84% in Anthropic's internal testing.

**Escape hatch:** When commands fail due to sandbox restrictions, Claude can retry with `dangerouslyDisableSandbox` parameter (goes through normal permission flow). Disable with `"allowUnsandboxedCommands": false`.

**Open-source sandbox runtime:** Available as `@anthropic-ai/sandbox-runtime` npm package.

```bash
npx @anthropic-ai/sandbox-runtime <command-to-sandbox>
```

#### Development Containers (Docker)

Anthropic provides a reference devcontainer setup for full isolation.

**Reference implementation:** https://github.com/anthropics/claude-code/tree/main/.devcontainer

**Components:**
- `devcontainer.json` — Container settings, extensions, volume mounts
- `Dockerfile` — Node.js 20 + dev dependencies
- `init-firewall.sh` — Network security rules (iptables whitelist)

**Key security features:**
- Precise outbound access control (whitelist-only domains)
- Default-deny network policy
- Firewall rule verification at startup
- Complete filesystem isolation from host

**Usage with bypass permissions (the recommended pattern for headless):**

```bash
# Inside the devcontainer
claude --dangerously-skip-permissions -p "implement the feature"
```

Anthropic explicitly states: "The container's enhanced security measures (isolation and firewall rules) allow you to run `claude --dangerously-skip-permissions` to bypass permission prompts for unattended operation."

**Warning from Anthropic:** Even with devcontainers, `--dangerously-skip-permissions` doesn't prevent exfiltration of anything accessible inside the container, including Claude Code credentials. Only use with trusted repositories.

#### Docker Sandbox Ecosystem

**Docker Sandboxes (Docker Inc.):** MicroVM-based isolation — each sandbox gets its own VM with a private Docker daemon. Supports Claude Code, Gemini, Codex, Kiro.

**Community projects:**
- `textcortex/claude-code-sandbox` — Run Claude Code in local Docker containers (archived, see Spritz repo)
- Various Dockerfile patterns in blog posts

### 10. The `--permission-prompt-tool` Flag

For non-interactive headless mode, you can delegate permission decisions to an MCP tool:

```bash
claude -p --permission-prompt-tool mcp_auth_tool "implement the feature"
```

This routes permission prompts to the specified MCP tool instead of stdin, enabling fully programmatic permission handling in automated pipelines.

### 11. GitHub Actions Integration

**Official action:** `anthropics/claude-code-action@v1`

**Basic workflow:**

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Key action inputs:**

| Parameter | Description |
|-----------|-------------|
| `prompt` | Instructions (text or skill like `/review`) |
| `claude_args` | CLI arguments passed through |
| `anthropic_api_key` | API key |
| `github_token` | GitHub token for API access |
| `trigger_phrase` | Custom trigger (default: `@claude`) |
| `use_bedrock` | Use AWS Bedrock |
| `use_vertex` | Use Google Vertex AI |

**Passing CLI flags:**

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "/review"
    claude_args: "--max-turns 5 --model claude-sonnet-4-6 --allowedTools 'Read' 'Grep' 'Glob'"
```

**How it handles permissions:** The action runs in headless mode (`-p`). It uses `--dangerously-skip-permissions` internally since it runs on ephemeral GitHub runners (isolated by design). The action sanitizes untrusted content (strips HTML comments, invisible characters, hidden markdown).

**Security controls:**
- Users must have write access to trigger (configurable)
- Bots blocked by default (`allowed_bots` to override)
- `allowed_non_write_users` — HIGH RISK, bypasses write requirement
- Claude commits to branches but does NOT auto-create PRs (human must create PR)
- Short-lived tokens scoped to specific repository
- `show_full_output` disabled by default (prevents credential leakage in public repo logs)

**Commit signing options:**
1. GitHub API signing (recommended, simple)
2. SSH signing key (for advanced git operations)

### 12. Practical Patterns

#### Pattern A: Tiered Permission Strategy (Production)

Use different modes for different phases:

```bash
# Phase 1: Planning (read-only)
claude --permission-mode plan -p "analyze the codebase and create a plan for implementing X"

# Phase 2: Implementation (auto-approve edits, ask for commands)
claude --permission-mode acceptEdits -p "implement the plan from the previous session"

# Phase 3: Testing (whitelist-only)
claude --permission-mode dontAsk \
  --allowedTools "Bash(npm test *)" "Bash(npx tsc --noEmit)" "Read" "Grep" \
  -p "run all tests and fix any failures"
```

#### Pattern B: Docker Container with Bypass (CI/CD)

```dockerfile
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /workspace
COPY . .
ENV ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
CMD ["claude", "-p", "--dangerously-skip-permissions", "--max-turns", "20", "--max-budget-usd", "5.00", "implement the feature in SPEC.md"]
```

#### Pattern C: Hooks-Based Guardrails (Medium Trust)

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm run *)",
      "Bash(npx *)",
      "Read",
      "Edit(/src/**)",
      "Write(/src/**)"
    ],
    "deny": [
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(rm -rf *)",
      "Read(./.env*)",
      "Edit(/.claude/**)",
      "WebFetch"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/validate-bash.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify: (1) all tests pass, (2) no lint errors, (3) task requirements met. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npm test 2>&1 || (echo 'Tests failing. Fix before completing.' >&2 && exit 2)"
          }
        ]
      }
    ]
  }
}
```

#### Pattern D: Sandbox + Selective Permissions (Balanced)

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["docker", "git"],
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"],
      "allowLocalBinding": false
    }
  },
  "permissions": {
    "allow": [
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(npm test *)",
      "Read"
    ],
    "deny": [
      "Bash(git push *)",
      "Read(./.env*)",
      "WebFetch"
    ],
    "defaultMode": "acceptEdits"
  }
}
```

#### Pattern E: GitHub Actions with Budget + Turn Limits

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "Review this PR and suggest improvements"
    claude_args: >-
      --max-turns 10
      --max-budget-usd 3.00
      --model claude-sonnet-4-6
      --disallowedTools "Bash(git push *)" "WebFetch"
  timeout-minutes: 30  # GitHub Actions level timeout
```

#### Pattern F: Headless with External Permission Handler

```bash
claude -p \
  --permission-prompt-tool mcp_auth_tool \
  --max-turns 15 \
  --max-budget-usd 10.00 \
  "implement user authentication"
```

#### Key Practitioner Insights

1. **Spec-first is the highest-leverage pattern.** Write detailed specs BEFORE giving Claude autonomy. This reduces wasted turns and destructive actions.

2. **Hooks > prompt instructions for safety.** Deterministic hooks (`PreToolUse` with `exit 2`) are more reliable than asking Claude to "be careful." The Anthropic blog specifically notes prompt-based security ("act as security expert") can actually increase vulnerabilities.

3. **`--max-turns` + `--max-budget-usd` are your emergency brakes.** Always set both in headless runs to prevent runaway sessions.

4. **Sandbox reduces prompt fatigue by 84%.** Use native sandboxing even in interactive mode — it's the single biggest UX improvement for autonomous operation.

5. **Worktrees for branch isolation.** Run `claude -w` to get an isolated worktree — prevents headless agents from polluting your working branch.

6. **OTel for fleet monitoring.** If running multiple agents, the OpenTelemetry integration gives you `claude_code.cost.usage`, `claude_code.token.usage`, and `claude_code.session.count` metrics across your organization.

7. **The devcontainer is the reference architecture for headless.** Anthropic's own recommended pattern is: devcontainer (Docker) + firewall whitelist + `--dangerously-skip-permissions`.

8. **Progressive trust model:** Start with `plan` mode, graduate to `acceptEdits`, then `dontAsk` with whitelisted tools. Only use `bypassPermissions` in fully isolated containers.

### Complete CLI Flag Reference (Safety-Related)

```bash
claude -p \
  --permission-mode plan|acceptEdits|default|dontAsk|bypassPermissions \
  --dangerously-skip-permissions \
  --allow-dangerously-skip-permissions \
  --allowedTools "Bash(npm test *)" "Read" \
  --disallowedTools "Bash(curl *)" "WebFetch" \
  --tools "Read,Grep,Glob,Edit" \
  --max-turns 10 \
  --max-budget-usd 5.00 \
  --permission-prompt-tool mcp_auth_tool \
  --mcp-config ./mcp.json \
  --strict-mcp-config \
  --settings ./custom-settings.json \
  --setting-sources user,project \
  --worktree feature-auth \
  --no-session-persistence \
  --output-format stream-json \
  --model claude-sonnet-4-6 \
  --fallback-model haiku \
  "your prompt here"
```

## Open Questions

1. **Rate limiting per-agent in multi-agent teams.** Can you set `--max-budget-usd` per teammate in an agent team, or only at the session level?

2. **Hook security hardening.** Hooks run with full user permissions — a compromised hook script could bypass all other safeguards. Best practice for securing hook scripts themselves?

3. **`--permission-prompt-tool` documentation.** This flag is listed in the CLI reference but has minimal documentation. What's the expected MCP tool interface? How does it receive and respond to permission prompts?

4. **Managed settings delivery in CI.** How to deploy managed settings in ephemeral CI runners (no MDM)? The file-based approach (`/etc/claude-code/managed-settings.json`) works but requires Dockerfile customization.

5. **Sandbox + Docker interaction.** Running the native sandbox inside Docker requires `enableWeakerNestedSandbox: true`, which "considerably weakens security." Is the devcontainer firewall sufficient to compensate?

## Extracted Principles

See principles/agent-task-orchestration.md for broader agent orchestration principles. The safety-specific findings from this research:

1. **Defense in depth, not single-layer.** Combine permissions + hooks + sandbox + container isolation. No single mechanism is sufficient.
2. **Deterministic over probabilistic safety.** Hooks with `exit 2` / `permissionDecision: "deny"` are more reliable than prompt-based guardrails.
3. **Emergency brakes always.** `--max-turns` + `--max-budget-usd` in every headless invocation.
4. **Progressive trust escalation.** plan -> acceptEdits -> dontAsk (whitelist) -> bypassPermissions (container only).
5. **Spec-first reduces blast radius.** The more specific the task, the less autonomy needed, the fewer guardrails triggered.

## Sources

- [Claude Code Security](https://code.claude.com/docs/en/security)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Claude Code Permissions](https://code.claude.com/docs/en/permissions)
- [Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Claude Code Development Containers](https://code.claude.com/docs/en/devcontainer)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code Monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Claude Code Action Security](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
- [Anthropic Engineering: Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Docker Sandboxes: Run Claude Code Safely](https://www.docker.com/blog/docker-sandboxes-run-claude-code-and-other-coding-agents-unsupervised-but-safely/)
- [Claude Code --dangerously-skip-permissions Guide](https://www.ksred.com/claude-code-dangerously-skip-permissions-when-to-use-it-and-when-you-absolutely-shouldnt/)
- [How to Safely Run AI Agents Inside a DevContainer](https://codewithandrea.com/articles/run-ai-agents-inside-devcontainer/)
- [A Complete Guide to Claude Code Permissions](https://www.eesel.ai/blog/claude-code-permissions)
- [Claude Code Permissions: Safe vs Fast](https://claudefa.st/blog/guide/development/permission-management)

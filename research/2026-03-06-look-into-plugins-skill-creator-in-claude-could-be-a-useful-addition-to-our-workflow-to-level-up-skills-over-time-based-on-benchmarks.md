---
date: 2026-03-06
topic: Claude Code /plugins skill-creator for leveling up skills over time based on benchmarks
status: complete
tags: [claude-code, skills, evals, benchmarks, skill-creator, workflow, agent-context]
---

# Claude Code skill-creator Plugin: Benchmark-Driven Skill Improvement

## Context

We have an established collection of Claude Code skills in `~/.claude/skills/` that power our workflow (commit, ship, implement, review, etc.). As models evolve and our usage patterns change, skills that worked well can drift — either because the model has outgrown explicit guidance, or because the skill's instructions have accumulated contradictions or dead weight. This research investigates the `/plugins skill-creator` feature as a mechanism for continuously improving skills over time using structured evals and benchmarks, rather than ad-hoc iteration.

## Findings

### What is skill-creator?

Skill-creator is an Anthropic-verified Claude plugin (10,000+ installs) invoked via `/skill-creator` in Claude Code or Claude.ai. It is a meta-skill: a skill for building and improving other skills. It provides the full development lifecycle from intent capture through iterative benchmarked improvement.

**Sources:**
- [Skill Creator – Claude Plugin | Anthropic](https://claude.com/plugins/skill-creator)
- [Improving skill-creator: Test, measure, and refine Agent Skills | Claude Blog](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills)

### The Four Operating Modes

Skill-creator operates in four composable modes:

1. **Create** — Guided intent capture, interview, and SKILL.md authoring. Prompts for edge cases, input/output formats, success criteria, and bundled resources.

2. **Eval** — Runs skills against evaluation prompts. Spawns parallel subagents: one with the skill, one as a baseline (no skill or prior version). Captures outputs, timing, and token usage.

3. **Improve** — Analyzes graded results and user feedback, then rewrites the skill to address failure patterns. Generalizes fixes beyond test examples — the key discipline is avoiding overfitting to eval cases.

4. **Benchmark** — Runs a standardized assessment across multiple iterations with variance analysis. Tracks eval pass rate, elapsed time, and token usage per run. Results can be stored locally, fed to a CI system, or integrated with a dashboard.

### Under the Hood: The Four Sub-Agents

Skill-creator uses four composable sub-agents that run in parallel:

- **Executor**: Runs the skill against each eval prompt in an isolated context
- **Grader**: Evaluates outputs against pre-defined assertions (objectively verifiable criteria)
- **Comparator**: Performs blind A/B comparison between skill versions or skill vs. baseline — the comparator doesn't know which output is "with skill" or "without"
- **Analyzer**: Identifies patterns that aggregate statistics might miss; suggests targeted improvements

This architecture enables both quantitative (pass rate, latency, token cost) and qualitative (human review, analyst insights) feedback loops.

### The Eval System in Detail

**Evals are test cases** defined as: a prompt (plus optional input files) and assertions describing what "good" looks like. Assertions should be:
- Objectively verifiable (not subjective)
- Descriptive names (readable in benchmark viewers)
- Avoiding overly narrow assertions that would pass even with a poor skill

**The eval workflow:**
```
For each test case, spawn two subagents in the same turn:
  - With-skill run → saves to workspace/iteration-N/eval-ID/with_skill/outputs/
  - Baseline run   → saves to workspace/iteration-N/eval-ID/without_skill/outputs/

Save eval_metadata.json:
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "The user's task prompt",
  "assertions": [...]
}

After completion:
  - Grade each run via grader sub-agent → grading.json
  - Aggregate with scripts/aggregate_benchmark → benchmark.json + benchmark.md
  - Launch interactive viewer for human review
```

**Timing data captured per run:**
```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

**Real cost:** Scott Spence's sandboxed eval study ran ~250 Claude invocations (22 prompts × multiple hook configurations × two full test runs) for $5.59 total. Evals are cheap.

Sources: [Measuring Claude Code Skill Activation With Sandboxed Evals](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals)

### Why Evals Matter: The Underlying Problem

An ETH Zurich study found developer-written context files improved task completion by only 4%, while LLM-generated ones degraded performance by 3%. The problem isn't context — it's *unvalidated* context. Without evals:
- You don't know if a skill is helping or hurting
- You can't detect when model upgrades make a skill redundant
- You can't safely iterate without regression risk

Evals transform skill authoring from "write and hope" to a software development practice with quality gates.

Source: [Anthropic brings evals to skill-creator: Here's why that's a big deal | Tessl](https://tessl.io/blog/anthropic-brings-evals-to-skill-creator-heres-why-thats-a-big-deal/)

### Description Optimization: The Triggering Problem

A critical and often overlooked dimension: a skill only helps if it *triggers* correctly. Skill-creator includes a description optimization loop that runs separately from the core eval loop.

**Process:**
1. Generate 20 trigger eval queries (8-10 should-trigger, 8-10 should-not-trigger near-misses)
2. Use realistic, concrete queries — not generic ones
   - Bad: `"Format this data"`
   - Good: `"ok so my boss just sent me this xlsx file (in downloads, called Q4 sales final FINAL v2.xlsx) and she wants me to add a profit margin percentage column..."`
3. Run an optimization loop (`scripts/run_loop`) — iteratively generates descriptions, tests against eval queries, measures precision/recall, refines
4. Apply the best-performing description to the skill's frontmatter

**Real results from Anthropic:** Testing across 6 public document-creation skills, the optimization improved triggering on 5 out of 6. Cisco's security skill achieved 1.78x performance gains; ElevenLabs' text-to-speech skill saw 1.32x improvement in API usage accuracy.

**Activation rate research findings** (Scott Spence's sandboxed eval study):

| Hook Configuration | Mechanism | Activation Rate |
|---|---|---|
| None (control) | Baseline | 50-55% |
| Simple | Echo instruction | 50-59% |
| Forced-eval | Explicit YES/NO per skill | 100% |
| LLM-eval | Haiku pre-classification | 100% (but 4 false positives/5 off-topic) |
| Type-prompt | Native prompt hook | 41-55% |

Key finding: baseline activation improved from ~0% (Haiku 4.5) to 55% (Sonnet 4.5) — models are getting better at skill discovery without explicit hooks, which is a signal to check whether existing hook-based workarounds are still necessary.

### The Iteration Loop

The skill improvement process follows a structured loop:

```
1. Apply improvements to skill
2. Rerun all test cases → iteration-N+1/ (include baseline runs)
3. Launch reviewer with --previous-workspace to see deltas
4. Wait for human review; read feedback.json
5. Improve based on feedback, generalizing beyond specific examples
6. Repeat until quality targets met or no meaningful progress
```

**Key discipline — Generalization over fitting:** The most common mistake is editing the skill to pass specific test cases. Skill-creator explicitly guides against this: "Create skills usable across many contexts, not just test examples."

**Workspace directory structure:**
```
skill-name-workspace/
├── iteration-1/
│   ├── eval-0-descriptive-name/
│   │   ├── with_skill/outputs/
│   │   ├── without_skill/outputs/
│   │   ├── timing.json
│   │   └── grading.json
│   ├── benchmark.json
│   ├── benchmark.md
│   └── feedback.json
├── iteration-2/
│   └── (same structure)
└── skill-snapshot/ (when improving existing skills)
```

### Installation and Invocation

**Install:** Via the Claude plugin directory in Claude.ai, or as a plugin in Claude Code.

**Invoke:** `/skill-creator` followed by:
- `"Create a new skill that reviews PRs for security issues"`
- `"Run evals on my code-review skill"`
- `"Improve my deploy skill based on these test cases"`
- `"Benchmark my skill across 10 runs and show variance"`

The plugin is available in Claude.ai, Cowork, Claude Code (as a plugin), and within Anthropic's skills repo.

### Applying to Our Workflow

Our existing skills (commit, ship, implement, review-learn-fix, organize-tickets, etc.) were written ad hoc without evals. The skill-creator provides a path to:

1. **Baseline measurement** — Run existing skills against realistic test prompts to establish current performance
2. **Regression protection** — After model upgrades (e.g., Claude Sonnet → Claude Opus), run benchmarks to catch skills that broke or became redundant
3. **Systematic improvement** — Use the Improve mode to iterate on underperforming skills with structured feedback
4. **Description audit** — Run the triggering optimization loop on skills that Claude fails to invoke when expected (a common friction point)

**Priority candidates for evals in our workflow:**
- `/implement` — Complex enough that pass/fail is measurable; high value to get right
- `/ship` — Has side effects (git push); want to verify behavior before it auto-commits
- `/review-learn-fix` — Quality of PR reviews is subjective but can be graded on coverage of issues

### Key Design Principles from skill-creator

1. **Progressive Disclosure** — Keep SKILL.md under 500 lines. Move reference material to separate files. Always-present metadata (~100 words) vs. on-demand skill body (<500 lines) vs. bundled resources (unlimited).

2. **"Make descriptions pushy"** — Include specific contexts where the skill should be used, even if not explicitly mentioned. This is counter-intuitive but improves recall.

3. **Explain the why, not just the what** — Skills that explain reasoning outperform those with rote instructions. The model should understand *why* to follow guidance, not just what to do.

4. **Bundle deterministic work into scripts** — If test cases independently write the same helper script, bundle it in `scripts/`. The skill's job is orchestration; scripts handle determinism.

5. **Keep the prompt lean** — "Remove things not pulling their weight; read transcripts for wasted work."

### Limitations and Caveats

- **Subjective skills are harder to grade** — Skills producing creative, context-dependent output (e.g., /explain-code) require more care in assertion design. The grader needs clear rubrics.
- **Eval maintenance burden** — Evals are valuable but require upkeep. If the skill's expected behavior changes, evals must change too or they become misleading regression signals.
- **Overfitting risk** — If you tune a skill heavily against a small eval set, it may perform worse in production. The Improve mode explicitly warns against this but requires discipline.
- **Model version coupling** — Benchmark results are tied to the model version. A benchmark passing on Sonnet 4.5 may not indicate the same on Opus 4.6. Run benchmarks when the model changes.

## Open Questions

1. **How many evals are enough?** Skill-creator recommends 2-3 realistic prompts to start. Is this sufficient for complex skills like `/implement`? What's the right number for high-stakes skills?

2. **CI integration mechanics** — The benchmark mode produces JSON output that can feed CI, but the exact integration pattern for our task-runner is unclear. Is there an example of a skill-creator benchmark plugged into a GitHub Actions workflow?

3. **Eval sharing across team** — Can eval sets live in version control alongside skills? If evals live in `workspace/` directories, they're not shared. We'd want evals checked in near the skill definition.

4. **Tessl Registry** — The article mentions Tessl offers cloud-scale eval running with CI/CD integration and version-pinned results. Worth investigating as a hosted complement to local skill-creator runs.

5. **RL-evolved skills** — The agent-context-augmentation principles note that RL-evolved skills (as opposed to LLM-generated) are acceptable. Skill-creator's iterative improvement loop is essentially guided RL. How close is it to producing RL-quality skill evolution?

## Extracted Principles

Principles added to `principles/agent-context-augmentation.md`:
- Treat Skills as Software with Quality Gates (eval-driven iteration)
- Optimize Skill Descriptions with Trigger Evals (precision/recall measurement)
- Benchmark Skills on Model Upgrades (regression detection)

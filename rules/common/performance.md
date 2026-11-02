# Performance & Resource Strategy

## Model Selection

Pick by **task shape**, not by model capability claims. The aliases below are
stable; which generation they resolve to is the harness's business, not this file's.

| Alias    | Choose when the task…                                                    |
| -------- | ------------------------------------------------------------------------ |
| `haiku`  | has a known-good procedure and a checkable output — formatting, extraction, classification, mechanical edits, high-frequency worker agents in a fan-out |
| `sonnet` | requires reading unfamiliar code and deciding what to change — the default for implementation, review, and orchestration |
| `opus`   | has no known procedure and an expensive wrong answer — architecture, cross-cutting refactor design, root-causing a bug that survived one fix attempt |

**Default to `sonnet`.** Deviate only for a stated reason.

**Escalate** when a task fails twice at its current tier — a third attempt at the
same tier usually repeats the same wrong assumption. **Downgrade** when the same
prompt shape has succeeded repeatedly; that's evidence the procedure is known.

Use `/model-route` when the tier isn't obvious from the table.

## Context Window Management

- **High-sensitivity tasks** (avoid the last 20% of context): multi-file refactoring, large feature implementation, complex cross-file debugging.
- **Low-sensitivity tasks** (safe near limits): single-file edits, isolated utilities, doc updates, simple bug fixes.

## Context Handoff

When work spans multiple sessions or grows complex:

- Maintain a **Mental Model** artifact (e.g. `task.md`, `docs/notes/<task>.md`) recording: current assumptions · completed steps · next logical actions.
- After a milestone (PR merged, refactor done, feature shipped), proactively suggest **context compaction** or a new session.
- Do not silently push through context degradation — flag it and hand off cleanly.

## Extended Thinking + Plan Mode

For complex reasoning tasks:

1. Choose a higher supported effort level (for example `/effort high`) — adaptive reasoning lets the model decide how much to think per task
2. Use **Plan Mode** for structured multi-step work
3. Run multiple critique rounds via split-role sub-agents (factual reviewer, senior engineer, security expert)

**Operator controls** (when the user wants to tune thinking). For Fable models, Sonnet 5 and later,
and Opus 4.7 and later, control reasoning with effort rather than a fixed token budget; available
levels depend on the model.

- Effort: `/effort` in a session, `--effort <level>` at launch, or `CLAUDE_CODE_EFFORT_LEVEL`. Save a per-model level in `modelSettings` in `~/.claude/settings.json`; the older user-level `effortLevel` key does not apply to Opus 5.5 or newer models.
- Toggle: `Option+T` (macOS) / `Alt+T` (Windows / Linux), or persistent `alwaysThinkingEnabled` in `~/.claude/settings.json`. These cannot disable thinking on Opus 5.5, Sonnet 5.5, or Fable models.
- Fixed budget: Claude Code ignores positive `MAX_THINKING_TOKENS` values on adaptive reasoning models. On Opus 4.6 or Sonnet 4.6, set `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` to use a fixed budget with `MAX_THINKING_TOKENS`.
- Verbose output: `Ctrl+O` to surface the thinking trace

See [Claude Code model configuration](https://code.claude.com/docs/en/model-config#adjust-effort-level)
and [environment variables](https://code.claude.com/docs/en/env-vars) for supported controls.

## Build & Tooling Failures

Delegate to specialized resolvers instead of trial-and-error:

- Generic build → `build-error-resolver`
- Language-specific → `go-build-resolver`, `rust-build-resolver`, `kotlin-build-resolver`, `java-build-resolver`, `cpp-build-resolver`, `dart-build-resolver`, `pytorch-build-resolver`

Fix incrementally; verify after each fix.

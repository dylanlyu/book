# Platform Rules — claude-code-action

> Scope: execution mechanism for [`anthropics/claude-code-action`][action] only.
> Per `../common/engineering-philosophy.md` §5, this file sits outside the precedence
> ladder. It supplies the §2 mechanism layer for this host and narrows `common/` rules
> the host cannot honour. It never relaxes §1, §3, or §4.
>
> Load this file only when running inside the action. Do not install it as a global rule.

[action]: https://github.com/anthropics/claude-code-action

## Environment

Runs are non-interactive in the sense of `../common/engineering-philosophy.md` §2:
`CI=true` and `GITHUB_ACTIONS` are both set. Apply the non-interactive column.

Mode (tag vs agent) is auto-detected by the action and is **not** reliably observable from
inside the run. Never branch behaviour on it. The non-interactive column is written to be
correct in both.

## Reporting a Stop

A §2 stop must be legible without opening the run log. Write the report to **both**:

- stdout
- `$GITHUB_STEP_SUMMARY` — renders on the job page, survives log truncation

Include, in this order: what was attempted · the competing readings or the irreversible
impact · what each choice would produce · the exact input that unblocks it. Then exit
non-zero.

A stop reported this way is a completed run, not a failed one. Do not pad it with an
apology, and do not attempt the work anyway under a guessed reading.

## Turn Budget

`claude_args: --max-turns N` caps the run. This constraint does not exist interactively and
overrides the default posture in `../common/agents.md`:

- Below ~5 remaining turns, do not delegate. Finish the work directly.
- Delegation must fit the budget end to end — spawn, collect, integrate. A run cut off
  mid-delegation orphans the children's results, the exact failure the Delegation
  Completion Contract in `../common/agents.md` exists to prevent.
- `--max-turns` is a ceiling, not a target. Stopping early with a complete answer is a
  correct outcome.

## Git Scope

The workflow owns the repository lifecycle; the agent does not. From
`../common/git-workflow.md`, honour **Commit Message Format** and **Safety** — those still
apply in full. Ignore the rest: checkout, branch creation, worktrees, sync-before-PR, and
the PR workflow are the workflow's job, and the runner is typically on a detached HEAD.

`~/.claude/settings.json` does not exist here. Its role is served by the action's `settings`
input, and `allowedTools` by `claude_args: --allowedTools`.

## Rules That Do Not Apply

- **`../common/hooks.md`, TodoWrite section** — its stated premise is that the list is
  user-visible and steerable mid-task. Nothing watches it here. The Hook Types and
  Auto-Accept Permissions sections still apply, configured via the `settings` input.
- **`../common/performance.md`, Operator controls and Context Handoff** — `Option+T`,
  `alwaysThinkingEnabled`, and "suggest a new session" have no counterpart in a
  single-shot run. The model-selection table still applies and maps to
  `claude_args: --model`.

## Verify Before Relying On These

Per `../common/engineering-philosophy.md` §3, two claims here are inferred from the
action's documented inputs rather than confirmed by an observed run:

- Whether a non-zero exit still posts the agent's report as a PR comment in tag mode.
  Writing to `$GITHUB_STEP_SUMMARY` is the hedge against it not doing so.
- The precedence between `--append-system-prompt` content and a repository `CLAUDE.md`
  when the two conflict.

Confirm both against a real run before treating them as settled, and correct this file
when you do.

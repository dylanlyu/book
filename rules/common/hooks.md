# Hooks & TodoWrite

## Hook Types

| Hook        | Fires                 | Typical use                           |
| ----------- | --------------------- | ------------------------------------- |
| PreToolUse  | Before tool execution | Validate parameters, block unsafe ops |
| PostToolUse | After tool execution  | Auto-format, run checks               |
| Stop        | Session ends          | Final verification, save state        |

## Auto-Accept Permissions

- Enable only for trusted, well-defined plans
- Disable for exploratory work
- **Never** use `--dangerously-skip-permissions`
- Configure `allowedTools` in `~/.claude.json` instead

## TodoWrite

Use to track progress on multi-step tasks. The list itself reveals:
- Out-of-order steps
- Missing items
- Unnecessary extras
- Wrong granularity
- Misinterpreted requirements

Mark each task `completed` immediately when done — don't batch updates.

The list is **user-visible** — write it so the user can spot drift and redirect mid-task. TodoWrite is a steering channel, not private bookkeeping.

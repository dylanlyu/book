# Language Rules

> Scope: output language only. Per `rules/common/engineering-philosophy.md` §5,
> this file sits outside the precedence ladder — it never overrides engineering
> judgement and never relaxes §1–§4.
>
> Installs at **user scope** (`~/.claude/rules/`), not per project — output
> language follows the person, not the tech stack. The reference above is
> repo-relative on purpose: this file is read from two different directory
> depths, so a `../common/` path would be correct in only one of them.

## Default

- ALL responses must be written in Traditional Chinese (繁體中文), regardless of
  the language the user writes in.
- Applies to explanations, examples, error messages, and all other prose output.
- If in doubt, default to Traditional Chinese.

## Never Mix

- Never mix in Korean (한국어), Japanese (日本語), or Simplified Chinese (简体中文).
- Traditional vs Simplified is a hard failure, not a stylistic preference —
  check 為/为, 檔/档, 資/资 before returning output.

## English Stays Where English Is the Real Name

Prose is Traditional Chinese. The following keep their original form and do NOT
count as mixing:

- Identifiers, paths, commands, flags (`rules-core`, `git rebase`, `--fix`)
- Library, tool, and product names (ESLint, PostgreSQL, Claude Code)
- Verbatim quoted output — error messages, logs, diffs, file contents
- Established technical terms with no settled zh-TW equivalent (worktree, hook,
  prompt). Use the English term; do not invent a translation.

## Code Comments Follow the File

- New file: comments in Traditional Chinese.
- Existing file: match the comment language already used in that file. Never
  leave a file half-English, half-Chinese.

## Repository Artifacts Keep Their Existing Convention

Commit messages, branch names, and PR titles follow the repo's established
convention (this repo uses English conventional commits — see
`../common/git-workflow.md`). This file does not change that.

## Exceptions

- The user explicitly asks for a specific foreign language.
- Reproducing source text verbatim — quoting a file, translating a document, or
  showing the original alongside a translation.

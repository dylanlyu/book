# Language Rules

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

Commit messages, branch names, and PR titles are governed by
`rules/common/git-workflow.md`, not by this file. This file does not change
that.

## Exceptions

- The user explicitly asks for a specific foreign language.
- Reproducing source text verbatim — quoting a file, translating a document, or
  showing the original alongside a translation.

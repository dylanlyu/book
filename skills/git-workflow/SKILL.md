---
name: git-workflow
description: Git workflow best practices for branching strategies, commit conventions, PR workflow, merge/rebase decisions, conflict resolution, and release management. Use this skill whenever the user asks about Git workflows, branching, commit messages, pull requests, merging, rebasing, resolving conflicts, release tagging, or setting up Git configuration. Also trigger for questions like "how should I structure my Git workflow", "what branching strategy should I use", "how do I write a good commit message", or "how do I handle merge conflicts".
metadata:
  origin: ECC
---

# Git Workflow Patterns

Best practices for Git version control, branching strategies, and collaborative development.

## When to Activate

- Setting up Git workflow for a new project
- Deciding on branching strategy (GitFlow, trunk-based, GitHub flow)
- Writing commit messages or PR descriptions
- Resolving merge conflicts
- Managing releases and version tags
- Onboarding new team members to Git practices
- Questions about merge vs rebase

## Branching Strategies

Choose based on team size and release cadence:

| Strategy | Team Size | Release Cadence | Best For |
|----------|-----------|-----------------|----------|
| GitHub Flow | Any | Continuous | SaaS, web apps, startups |
| Trunk-Based | 5+ experienced | Multiple/day | High-velocity teams, feature flags |
| GitFlow | 10+ | Scheduled | Enterprise, regulated industries |

→ Full strategy details: `references/branching-strategies.md`

## Commit Messages

Use Conventional Commits format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `revert`

→ Full format, examples, and anti-patterns: `references/commit-conventions.md`
→ Commit message template: `template/.gitmessage`

## Pull Request Workflow

```
feat(auth): add SSO support for enterprise users
```

PR description should cover: What / Why / How / Testing / Checklist

→ Full PR format and code review checklist: `references/pull-request-workflow.md`
→ PR description template: `template/pull-request.md`

## Merge vs Rebase

- **Merge** — preserves history; use when merging feature branches to `main`
- **Rebase** — linear history; use for local branch updates only, never on shared branches

→ Full decision guide and conflict resolution: `references/history-management.md`

## Branch Management

Naming convention:
```
feature/user-authentication
fix/login-redirect-loop
hotfix/critical-security-patch
release/1.2.0
```

→ Full naming rules, cleanup commands, stash workflow: `references/branch-management.md`

## Release Management

Follow Semantic Versioning (`MAJOR.MINOR.PATCH`):

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

→ Full release workflow and changelog generation: `references/release-management.md`

## Git Configuration

→ Essential config, useful aliases, gitignore patterns, hooks, anti-patterns: `references/git-config.md`

## Quick Reference

| Task | Command |
|------|---------|
| Create branch | `git checkout -b feature/name` |
| Switch branch | `git checkout branch-name` |
| Delete branch | `git branch -d branch-name` |
| Merge branch | `git merge branch-name` |
| Rebase branch | `git rebase main` |
| View history | `git log --oneline --graph` |
| View changes | `git diff` |
| Stage changes | `git add .` or `git add -p` |
| Commit | `git commit -m "message"` |
| Push | `git push origin branch-name` |
| Pull | `git pull origin branch-name` |
| Stash | `git stash push -m "message"` |
| Undo last commit | `git reset --soft HEAD~1` |
| Revert commit | `git revert HEAD` |

# Git Workflow

> The full dev pipeline (planning → TDD → review → commit) lives in [development-workflow.md](./development-workflow.md). This file covers commit and PR mechanics only.

## Sync Before Starting

- Run git fetch origin before starting any task.
- All work happens in a worktree (claude -w) on its own branch. **Never commit directly on main.**
- A worktree cannot check out main while another worktree holds it; this is normal.
  To get a clean latest base, use git checkout origin/main (detached) — do not force main.
- Start each task branch from latest origin/main:

```
  git fetch origin
  git switch -c <branch> origin/main
```

## Stay Current While Working

- A merged PR moves origin/main forward; in-flight worktrees are now behind. This is expected.
- **Before opening or updating a PR**, sync onto latest main:
  - If the branch is **not yet pushed**: git fetch origin && git rebase origin/main
  - If the branch is **already pushed and under review**: git fetch origin && git merge origin/main
    (avoid rebase here — it rewrites published history)
- git fetch updates the shared origin/main ref for every worktree at once;
  each worktree still syncs its own branch separately.

## Commit Message Format

```
<type>(<scope>): <subject>

<optional body>
```

- A blank line **must** separate the subject from the body, or git/GitHub will treat the body as part of the subject.
- **Types**: feat, fix, refactor, docs, test, chore, perf, ci, build
- **Scope** _(optional)_: module / package / area touched
- **Subject**: imperative mood, ≤72 chars, no trailing period

Note: ECC-managed installs set `"includeCoAuthoredBy": false` in `~/.claude/settings.json`, so commits carry no `Co-Authored-By` trailer by default. To keep Claude attribution, set `"includeCoAuthoredBy": true` or configure `attribution`; ECC never overwrites an explicit choice.

## Pull Request Workflow

1. Analyze the **full** commit history on the branch — not just the latest commit.
2. Use git diff <base>...HEAD to see every change in the PR.
3. **Sync onto latest main first**, while the branch is still unpushed (see "Stay Current While Working"):
   git fetch origin && git rebase origin/main. Doing this before push means rebase rewrites
   only local history — no force-push needed.
4. Push with -u flag if the branch is new. The pushed branch is now already on top of latest main.
5. Draft a summary covering: what changed, why, risk, rollback path.
6. Include a **test plan** (checklist of TODOs to verify).
7. If origin/main advances again while the PR is under review, sync with git merge origin/main
   (not rebase — the branch is now published), then push once more.

## After Merge

- Once the PR is merged, remove the worktree and delete its local branch.
- Other in-flight worktrees: git fetch origin, then rebase (if unpushed) or merge (if under review) to pick up the merged changes.

## Safety

- Never --no-verify without explicit user approval.
- Never force-push to main / master.
- **main is merge-only** — no session commits on it directly; it advances solely through merged PRs.
- Prefer new commits over --amend after a hook failure — amending can rewrite the wrong commit if the original hasn't landed.
- Stage specific files; avoid git add -A / git add . — these can accidentally commit .env, secrets, or large binaries.

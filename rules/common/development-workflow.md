# Development Workflow

End-to-end pipeline for any non-trivial change. Each step links to the rule that owns the detail.

## Feature Implementation Pipeline

0. **Research & Reuse** _(mandatory before writing new code)_
   - **GitHub first**: `gh search repos` / `gh search code` to find existing implementations and patterns
   - **Library docs second**: Context7 or primary vendor docs to confirm API behavior
   - **Exa third**: only when the first two are insufficient
   - **Package registries**: npm / PyPI / crates.io / Maven before hand-rolling utilities
   - Prefer adopting or porting a proven approach over net-new code

1. **Plan First** — invoke `planner`. Produce PRD / architecture / system design / task list. Identify dependencies, risks, key edge cases.

2. **Hypothesis Verification** _(bug fixes only)_ — explicitly state "**why it failed**" and "**how the fix addresses it**" before any code change. Never patch without root-cause understanding.

3. **TDD** — see [testing.md](./testing.md). Use `tdd-guide`. Target ≥80% coverage.

4. **Code Review** — see [code-review.md](./code-review.md). Run `code-reviewer` + the language reviewer in parallel after writing. Fix CRITICAL/HIGH; address MEDIUM when feasible.

5. **Documentation Sync** — when modifying core logic, API handlers, or DB schemas, proactively update README, specs, codemaps, and CLAUDE.md / AGENTS.md. Land docs in the same commit as the code.

6. **Commit & Push** — see [git-workflow.md](./git-workflow.md). Conventional commits.

7. **Pre-Review Gate** — CI green · conflicts resolved · branch up to date with target. Only request review after this passes.

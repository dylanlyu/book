# Code Review Standards

> Quality checklist lives in [coding-style.md](./coding-style.md). Security checklist lives in [security.md](./security.md). This file defines **when to review, severity, and which agent to invoke**.

## Mandatory Triggers

Run review (yourself or via agent) when:
- Code was just written or modified
- About to commit to a shared branch
- Security-sensitive code changed (auth, payments, user data, crypto, file I/O, DB queries, external APIs)
- Architectural changes
- Before merging a PR

**Pre-review preconditions**: CI passing · merge conflicts resolved · branch up to date with target.

## Severity Levels

| Level    | Meaning                             | Action                 |
| -------- | ----------------------------------- | ---------------------- |
| CRITICAL | Security vulnerability or data loss | **BLOCK** — must fix   |
| HIGH     | Bug or significant quality issue    | **WARN** — should fix  |
| MEDIUM   | Maintainability concern             | INFO — consider fixing |
| LOW      | Style or minor suggestion           | NOTE — optional        |

**Approve** if no CRITICAL/HIGH. **Warning** if only HIGH (merge with caution). **Block** on any CRITICAL.

## Reviewer Agent Map

| Scope                                | Agent                  |
| ------------------------------------ | ---------------------- |
| General quality / patterns           | `code-reviewer`        |
| Security / OWASP                     | `security-reviewer`    |
| TypeScript / JavaScript              | `typescript-reviewer`  |
| Python                               | `python-reviewer`      |
| Go                                   | `go-reviewer`          |
| Rust                                 | `rust-reviewer`        |
| Kotlin                               | `kotlin-reviewer`      |
| Java / Spring Boot                   | `java-reviewer`        |
| C++                                  | `cpp-reviewer`         |
| C# / .NET                            | `csharp-reviewer`      |
| Flutter / Dart                       | `flutter-reviewer`     |
| SQL / schema / queries               | `database-reviewer`    |

For language-specific changes, run **`code-reviewer` + the language reviewer in parallel**.

## Review Workflow

1. `git diff` to scope the change
2. Run security checklist first ([security.md](./security.md))
3. Run quality checklist ([coding-style.md](./coding-style.md))
4. Run tests, verify coverage ≥ 80% ([testing.md](./testing.md))
5. Invoke appropriate reviewer agent(s) for deep review

## Performance Issues to Catch

Beyond quality and security, scan changes for these performance smells:

- **N+1 queries** — replace per-iteration queries with JOINs or batched fetches
- **Missing pagination** — add `LIMIT` / cursor on any list endpoint that can grow
- **Unbounded queries** — apply explicit constraints (date range, status filter, max rows)
- **Missing caching** — cache deterministic, expensive operations (computed aggregates, external API calls)
- **Sync I/O in hot paths** — prefer async / streaming for network and disk-heavy work

If any of these surface, delegate to **`performance-optimizer`** for a deeper pass.

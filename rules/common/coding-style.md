# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## Core Principles

### Data First

- Design data structures before writing logic
- Get the shape of the data right first; control flow follows from it
- If the logic feels convoluted, suspect the data model before rewriting the logic

### KISS (Keep It Simple)

- Prefer the simplest solution that actually works
- Avoid premature optimization
- Optimize for clarity over cleverness

### DRY (Don't Repeat Yourself)

- Extract repeated logic into shared functions or utilities
- Avoid copy-paste implementation drift
- Introduce abstractions when repetition is real, not speculative

### YAGNI (You Aren't Gonna Need It)

- Do not build features or abstractions before they are needed
- Avoid speculative generality
- Start simple, then refactor when the pressure is real

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, with 800 lines as a soft maintainability ceiling for source files
- Test, generated, and vendored files may exceed the ceiling when their size is justified by their role
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Scout Rule

Always leave the code cleaner than you found it. Every feature PR should include a small cleanup unrelated to the main task but within the modified scope — fix one piece of technical debt, remove dead code, or improve a confusing name.

## Atomic Change Principle

Each edit should be limited to a single functional module or logical component to ensure reviewability and reduce conflicts. For files over 500 lines, never use full overwrite — always use targeted edits.

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Naming Conventions

> **Language note**: This rule may be overridden by language-specific rules for
> languages where a pattern is not idiomatic. Casing and framework-specific
> prefixes belong to the applicable language or package rule.

Language-independent:

- Descriptive names: the name says what the thing holds or does, without a comment.
- Boolean names read clearly as claims under the applicable language or package
  convention.
- Where the language draws the distinction, constants and types are visually
  distinct from ordinary values in the form its language or package rule defines.

## Code Smells to Avoid

### Deep Nesting

Prefer early returns over nested conditionals once the logic starts stacking.

### Magic Numbers

Use named constants for meaningful thresholds, delays, and limits.

### Long Functions

Split large functions into focused pieces with clear responsibilities (50 lines max).

## Quality Gate (Self-Check Before Commit)

- Readable, well-named identifiers
- Functions <50 lines · files <800 lines · nesting ≤4 levels
- Errors handled explicitly (never swallowed)
- No hardcoded values — use named constants or config
- Immutable patterns — no in-place mutation
- No leftover `console.log` / debug prints / TODO without ticket

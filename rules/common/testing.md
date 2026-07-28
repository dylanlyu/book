# Testing Requirements

**Minimum coverage: 80%.** All three test types required:

1. **Unit** — individual functions, components, utilities
2. **Integration** — API endpoints, DB operations, cross-module flows
3. **E2E** — critical user flows (framework chosen per language stack)

## TDD Workflow (mandatory)

1. Write test → must **FAIL** (RED)
2. Write minimal implementation → must **PASS** (GREEN)
3. Refactor → re-run, verify coverage ≥ 80%

Use the **`tdd-guide`** agent proactively for new features and bug fixes.

## Test Structure (AAA)

```typescript
test('returns empty array when no markets match query', () => {
  // Arrange
  const query = 'xyz';

  // Act
  const result = search(query);

  // Assert
  expect(result).toEqual([]);
});
```

Names describe **behavior**, not implementation. Examples:
- `returns empty array when no markets match query`
- `throws error when API key is missing`
- `falls back to substring search when Redis is unavailable`

## When Tests Fail

1. Check test isolation (shared state, async leakage)
2. Verify mocks reflect real contracts
3. Fix the **implementation**, not the test — unless the test itself is wrong

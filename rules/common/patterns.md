# Common Design Patterns

> Reusable structural patterns. Project-Reuse research strategy lives in [development-workflow.md](./development-workflow.md) (Step 0).

## Skeleton-Project Adoption

When kicking off a new feature or service, prefer adopting a battle-tested skeleton over green-field construction:

1. Search GitHub / package registries for skeleton candidates that solve ≥80% of the problem
2. **Evaluate candidates in parallel sub-agents**, one role per agent:
   - Security assessment (auth model, input handling, dependency surface)
   - Extensibility analysis (module boundaries, plugin points, fork-friendliness)
   - Relevance scoring (how close to the actual requirement)
   - Implementation planning (effort to adapt, integration cost)
3. Clone the best match as the foundation; iterate inside its proven structure rather than rebuilding the scaffolding

## Repository Pattern

Encapsulate data access behind a consistent interface so business logic doesn't depend on the storage mechanism.

- Standard operations: `findAll`, `findById`, `create`, `update`, `delete`
- Concrete impls handle storage details (DB, API, file, in-memory)
- Business logic depends on the **interface**, not the impl
- Enables swapping data sources and trivial mock-based testing

## API Response Envelope

Every response uses a consistent shape:

```json
{ "success": true, "data": {}, "error": null }
```

For paginated responses, add metadata:

```json
{ "success": true, "data": [], "error": null, "meta": { "total": 0, "page": 1, "limit": 20 } }
```

- `success`: boolean status indicator
- `data`: payload (nullable on error)
- `error`: error message string (nullable on success)
- `meta` _(paginated only)_: total · page · limit

# CLAUDE.md — gas-tools

Harness documentation for the `@dougborg/gas-tools` monorepo. This file is loaded into Claude's context for every session in this repo. Keep it short and authoritative — long-form context belongs in agent definitions or skills, not here.

## Repo at a glance

- **Purpose**: Reusable Google Apps Script (GAS) tooling published under `@dougborg/*`.
- **Packages**: `gas-utils` (runtime helpers), `gas-sheets-orm` (sheet ORM), `gas-test-utils` (Vitest mocks), `gas-dev-server` (local Vite dev server + GAS mocks).
- **Stack**: TypeScript (strict), npm workspaces, Biome (lint+fmt), Vitest, tsc. Node 22 (Volta).
- **Verify command**: `npm run quality` — runs `typecheck && lint && test`.
- **CI**: `.github/workflows/ci.yml` on push/PR. Node 22 + 23 matrix.

## Hard rules

- **Runtime is GAS V8, not Node**. Code in `packages/*/src/` deploys to Google Apps Script. `process`, `fs`, `Buffer`, `fetch`, `setTimeout`, native modules — none of these exist in production. The only HTTP client is `UrlFetchApp.fetch()`. Test files (`*.test.ts`) run in Node Vitest and may use Node APIs freely.
- **6-minute execution limit** per trigger / `clasp run` call. Long-running operations must batch and checkpoint, or split across triggers.
- **No ES modules in deployed code**. The deployed bundle is flat-scoped JavaScript. The TypeScript source uses ES modules, but the bundler/clasp pipeline produces a flat file. Don't rely on per-file scope at runtime.
- **`Session.getScriptTimeZone()` is the canonical timezone** — never hardcode `'America/Los_Angeles'` or use `new Date().toString()` for display.
- **Empty cells return `''`, not `null` or `undefined`**. Idiomatic empty check: `cell === ''`. `isEmptyRow` and similar helpers must use this convention.

## Architecture invariants

### Package boundaries

```
gas-utils       → no deps on other workspace packages
gas-sheets-orm  → depends on gas-utils only
gas-test-utils  → no deps on the above; vitest is a peer dep
gas-dev-server  → standalone (own package-lock.json); only package with a build step
```

A change that introduces a circular or upward dep is a refactor that needs explicit discussion.

### ORM contracts (gas-sheets-orm)

Three contracts that must stay stable — downstream consumers (`katana-sheets-toolkit`) depend on them:

1. **`DomainModel`** — every entity implements `validate(): InputValidationError[]` and `toSheetRow(columnMapping): unknown[]`. `validate()` returns errors; it does not throw. `toSheetRow()` is the inverse of the subclass's `fromRow()`.
2. **`Repository<T>`** — base class methods (`findAll`, `findById`, `insert`, `batchInsert`, `update`, `updateRows`, `deleteById`) are not overridden by subclasses. Subclasses pass a `SheetSchema` to `super(...)` and implement `fromRow`.
3. **`SchemaRegistry`** — process singleton. Schemas register at module-load time, not in constructors.

### Validation modes

`ValidationMode` defaults to `'lenient'`. Missing required columns throw; missing optional columns warn; extra columns are ignored. Production code paths should not change this default without comment.

### Column mapping cache

`buildColumnMapping(sheet)` is cached per `sheet.getSheetId()`. The cache invalidates on sheet ID change, **not** on header rename. If headers change at runtime, call `clearColumnMappingCache(sheetId)` explicitly.

`dataStartRow` in a `SheetSchema` is **0-based** into the `getValues()` result array. With one header row → `dataStartRow: 1`. This is the most common off-by-one bug.

### Error taxonomy

`SheetOrmErrorCode` enum (`packages/gas-sheets-orm/src/sheet-orm/errors.ts`):

| Range | Class | Meaning |
|---|---|---|
| 1000–1099 | `InputValidationError` | Caller-supplied data failed validation. `getUserMessage()` is safe to display. |
| 1100–1199 | `SchemaValidationError` | Sheet structure mismatches schema. |
| 1200–1299 | `RepositoryError` | Data-layer operation failed. |
| 1300–1399 | `ConfigurationError` | Schema/registry misconfig (programmer bug). |
| 2000–2099 | Reserved for downstream consumers (Katana) | Do **not** allocate inside this monorepo. |

`wrapError(unknown)` is the standard pattern for catch blocks. Never let raw `unknown` errors leak from the public surface.

## Testing conventions

- `vitest.setup.ts` calls `installGasGlobals()` once. Per-test overrides go in `beforeEach`.
- Tests live next to source in `__tests__/` folders or as colocated `*.test.ts`. The root `vitest.config.ts` discovers both.
- Never call real GAS APIs in tests. The whole surface is mocked via `@dougborg/gas-test-utils`.
- Tautology tests (mock returns X, code returns X, assert X) are not coverage. The `test-writer` agent is configured to flag these.
- Adding a new GAS API to a test? See `/gas-mock` skill — extend `installGasGlobals()` rather than ad-hoc-mocking in each suite.

## Publishing model

- Each package has its own version, CHANGELOG, README. **Do not bump versions in lockstep.**
- `package.json` `exports` points at `./src/*.ts` for source-as-published. Consumers' bundlers handle the TS. `gas-dev-server` is the exception — it builds to `dist/` because it is a Vite plugin consumed by Node tools.
- `@types/google-apps-script` is a `peerDependency` on runtime packages — consumers control the version.
- Publishing is manual (`npm publish` per package after `npm version`). Not yet automated.

## Harness — agents and skills

Agents (`.claude/agents/`):

- **code-reviewer** (sonnet) — six-dimension code review tuned for GAS constraints.
- **verifier** (haiku) — runs `npm run quality` and diagnoses failures.
- **test-writer** (sonnet) — writes Vitest tests using the `installGasGlobals()` pattern.
- **gas-api-advisor** (sonnet, read-only) — answers GAS runtime / quota / service questions.
- **domain-advisor** (sonnet, read-only) — answers questions about ORM contracts.
- **project-manager** (sonnet) — manages GitHub issues, PRs, milestones.

Skills (`.claude/skills/`):

- **/new-package** — scaffold a new `packages/gas-*` package.
- **/gas-mock** — add a GAS API mock to `gas-test-utils`.

Plus global skills available everywhere: `/feature-spec`, `/commit`, `/issue-triage`, `/standup`, `/review-pr`.

## Hooks

`.claude/settings.json` configures:

- **PostToolUse on `Edit|Write|MultiEdit`**: Biome auto-fix on `.ts`/`.tsx`/`.json` (silent, zero-token).
- **PostToolUse on edits to `gas-sheets-orm/src/`**: short reminder about the public ORM contracts.
- **Stop hook**: `npm run typecheck` runs at end-of-turn (truncated to last 20 lines).

The Stop typecheck is the safety net — fast feedback after a turn finishes, without burning tokens on every edit.

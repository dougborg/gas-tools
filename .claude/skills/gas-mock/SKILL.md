---
name: gas-mock
description: Add a new GAS global or method mock to the `installGasGlobals()` factory in `packages/gas-test-utils`. Use when a test in any package needs a GAS API that is not yet stubbed (a missing service, or a missing method on an existing service).
---

# /gas-mock — Add a GAS API mock

## PURPOSE

Extend `installGasGlobals()` (in `@dougborg/gas-test-utils`) so a previously-unmocked GAS API can be exercised in Vitest without `ReferenceError`. Keep mocks minimal and overridable — per-test behavior is set in `beforeEach`, not baked into the factory.

## CRITICAL

- **The factory provides shape, not behavior** — every mocked method should be a `vi.fn()` with at most a sensible default return. Tests override.
- **Never call real GAS APIs** in any test path. The whole point of `installGasGlobals()` is that the suite runs in Node.
- **Name the mock at the top level the same as the GAS global** — `SpreadsheetApp`, `Sheets`, `UrlFetchApp`. Anything else breaks consumers' production code paths.
- **Update the `GasGlobalMocks` return type** when adding a new top-level global — otherwise consumers calling `installGasGlobals()` lose type-safety on the new mock.

## ASSUMES

- The reader has read `packages/gas-test-utils/src/index.ts` to see the existing mock pattern.
- The new mock is genuinely missing — not just unconfigured for a specific test (those go in `beforeEach`).

## STANDARD PATH

### 1. Identify what's missing

Run the failing test and read the error. Typical patterns:

- `ReferenceError: <Global> is not defined` — the top-level global is not installed at all.
- `TypeError: <Global>.<method> is not a function` — the global exists but the method is missing.
- `TypeError: Cannot read properties of undefined (reading '<X>')` — a nested namespace is missing (e.g., `Sheets.Spreadsheets.Values`).

### 2. Decide where the mock lives

| Case | Edit |
|---|---|
| Missing top-level global (`Drive`, `Forms`, etc.) | Add new section in `installGasGlobals()` body, assign to `globalThis`, add to `GasGlobalMocks` interface |
| Missing method on existing global | Add `vi.fn()` to that global's object |
| Missing nested namespace (`Sheets.Spreadsheets.Values.batchGet`) | Add to the existing nested object literal |

### 3. Add the mock with a sensible default

Defaults should be the **least-surprising no-op**. Examples:

- Methods that return data → `vi.fn().mockReturnValue(undefined)` (or `[]` if the caller iterates).
- Methods that mutate (`flush`, `sleep`) → `vi.fn()` with empty implementation.
- Methods that build builder objects → return a stub builder where every method returns a chainable mock.
- Methods that should be configured per-test → just `vi.fn()` (no return), so an unconfigured call returns `undefined` and the test fails loudly.

### 4. Expose via `GasGlobalMocks` (top-level globals only)

If you added a new top-level global, extend the return type so callers can grab it:

```ts
export interface GasGlobalMocks {
  // ...existing fields...
  Drive: typeof Drive;
}
```

And `return { ..., Drive };` from the factory.

### 5. Add an `InstallGasGlobalsOptions` field if needed

If the new mock has a value that nearly every test will want to seed (like `properties`), add an option:

```ts
export interface InstallGasGlobalsOptions {
  // ...existing fields...
  driveFiles?: Record<string, string>;
}
```

Document the default in the JSDoc.

### 6. Add a JSDoc

Every new mocked global gets a JSDoc explaining what it stubs and any non-obvious defaults.

### 7. Verify

```bash
npx vitest run packages/gas-test-utils
npm run quality
```

The original failing test (in whatever package) should now pass without local mock setup, or with a small `beforeEach` override.

## EDGE CASES

- **The mock needs a real value, not just a stub** — e.g., `Session.getScriptTimeZone()` should return a string, not `undefined`. Add a default value AND expose it as an `InstallGasGlobalsOptions` field so tests can override.
- **The GAS API is a class with a constructor** — `installGasGlobals()` can mock the constructor: `(globalThis as any).Charts = vi.fn().mockImplementation(() => ({ build: vi.fn() }))`.
- **The mock is only ever needed in one package** — consider whether to add it to `gas-test-utils` (shared) or just stub locally in that package's test file. The factory should stay focused on widely-used APIs.

## RELATED

- `test-writer` agent — uses `installGasGlobals()` in every new test.
- `gas-api-advisor` agent — confirm the API surface before mocking it (don't mock methods that don't exist on the real API).

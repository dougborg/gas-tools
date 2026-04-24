# @dougborg/gas-test-utils

Vitest mock factories for Google Apps Script globals.

Kills the `(globalThis as any).UrlFetchApp = vi.fn()` boilerplate that every GAS test suite ends up writing. One call to `installGasGlobals()` from your vitest setup file installs baseline mocks for `SpreadsheetApp`, `Logger`, `Utilities`, `Session`, `CacheService`, `PropertiesService`, `UrlFetchApp`, and `Sheets`. Individual tests override any of them as needed in `beforeEach`.

## Install

```bash
npm install --save-dev @dougborg/gas-test-utils
```

Peer dependencies: `vitest` (`^3` or `^4`) and `@types/google-apps-script`.

## Quick start

In your `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts']
  }
});
```

In `tests/setup.ts`:

```ts
import { installGasGlobals } from '@dougborg/gas-test-utils';

installGasGlobals({
  properties: {
    KATANA_API_KEY: 'test-key',
    SHOPIFY_BQI_API_KEY: 'test-shopify-key'
  }
});

export { createMockResponse, resetAllMocks } from '@dougborg/gas-test-utils';
```

In a test file:

```ts
import { createMockResponse, resetAllMocks } from '../setup';

beforeEach(() => {
  resetAllMocks();
});

it('fetches orders', () => {
  (globalThis.UrlFetchApp.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
    createMockResponse({ orders: [{ id: 1 }] }, 200)
  );
  // ... exercise your code
});
```

## API

### `installGasGlobals(options?)`

Installs mocks on `globalThis` for every GAS namespace the toolkit + ORM touch. Safe to call multiple times — each call replaces previous globals. Returns the mock objects.

Options:

- `properties` — seed `Record<string, string>` for `PropertiesService.getScriptProperties().getProperty(key)`. Keys not listed return `null`.
- `uuid` — value returned by `Utilities.getUuid()`. Default `'mock-uuid-12345'`.
- `formattedDate` — value returned by `Utilities.formatDate()`. Default `'1/1/2024 12:00:00'`.

### `createMockResponse(data, code?, headers?)`

Builds an object shaped like `GoogleAppsScript.URL_Fetch.HTTPResponse`:

- `getResponseCode()`
- `getContentText()` — returns `JSON.stringify(data)`
- `getHeaders()` / `getAllHeaders()`

### `resetAllMocks()`

Re-export of `vi.clearAllMocks()`. Call from `beforeEach` to clear call history between tests.

## Why not install everything automatically?

Setup files are the right home for test-bed configuration; auto-installing via module side-effect breaks mental model and makes ordering tricky. Call `installGasGlobals()` explicitly — it's one line.

## License

MIT © Doug Borg

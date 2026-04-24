# Changelog

All notable changes to `@dougborg/gas-test-utils` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-23

Initial release. Factored out of the build-queue-scripts `tests/setup.ts` boilerplate.

### Added

- `installGasGlobals(options?)` — Vitest mock factory that installs
  `SpreadsheetApp`, `Logger`, `Utilities`, `Session`, `CacheService`,
  `PropertiesService`, `UrlFetchApp`, and `Sheets` on `globalThis`. Options
  seed `properties`, `uuid`, `formattedDate`.
- `createMockResponse(data, code?, headers?)` — builds an object shaped like
  `GoogleAppsScript.URL_Fetch.HTTPResponse` for `UrlFetchApp.fetch()` mocks.
- `resetAllMocks()` — re-export of `vi.clearAllMocks()` for ergonomic
  `beforeEach` calls.

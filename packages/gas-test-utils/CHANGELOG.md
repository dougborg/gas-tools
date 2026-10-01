# Changelog

All notable changes to `@dougborg/gas-test-utils` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0](https://github.com/dougborg/gas-tools/compare/gas-test-utils-v0.1.0...gas-test-utils-v0.2.0) (2026-10-01)


### ⚠ BREAKING CHANGES

* **gas-test-utils:** consumers on vitest 3, or on vitest 4 before 4.1.11, must upgrade vitest to 4.1.11+ or 5.

### Bug Fixes

* **gas-test-utils:** require a patched vitest and allow vitest 5 ([aa9e1da](https://github.com/dougborg/gas-tools/commit/aa9e1dadc0f74f02dee33c193b2f2a7c62fc4d33)), closes [#37](https://github.com/dougborg/gas-tools/issues/37)

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

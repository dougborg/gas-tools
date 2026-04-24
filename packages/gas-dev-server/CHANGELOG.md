# Changelog

All notable changes to `@dougborg/gas-dev-server` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-23

Initial release. Renamed from `@gas-tools/dev-server` — now under the `@dougborg`
scope for monorepo consistency.

### Added

- `createDevConfig()` — Vite config factory for GAS projects with local-dev
  mocks wired in.
- `initializeGASMocks()` — installs in-browser mocks for `SpreadsheetApp`,
  `UrlFetchApp`, `PropertiesService`, etc. when running the dev server.
- Vite plugin for serving the GAS code under `http://localhost:PORT` with
  hot-module reload.
- `src/dev-template.html` — entrypoint shell for the dev server.

### Changed

- Package name: `@gas-tools/dev-server` → `@dougborg/gas-dev-server`.

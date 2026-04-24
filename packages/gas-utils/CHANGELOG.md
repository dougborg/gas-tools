# Changelog

All notable changes to `@dougborg/gas-utils` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-23

Initial release. Extracted from the monolithic `@dougborg/katana-sheets-toolkit`
as part of the workspace-package split.

### Added

- `EnhancedLogger` — structured logging with level, context, and auto-captured
  error/warning wrapping (`withSheetErrorHandling`, `withShopifyErrorHandling`).
- `arrayFormulaProtection` — `fixArrayFormulaErrors` / `manualFixArrayFormulaErrors`
  detection + repair for broken ARRAYFORMULA cells; `columnNumberToLetter` helper.
- `visualFeedback` — transient row/range highlighting (`quickFlash`, etc.).
- Subpath exports for each module: `/enhancedLogger`, `/arrayFormulaProtection`,
  `/visualFeedback`.

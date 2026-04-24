# Changelog

All notable changes to `@dougborg/gas-sheets-orm` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-23

Initial release. Extracted from the monolithic `@dougborg/katana-sheets-toolkit`
as part of the workspace-package split.

### Added

- `Repository<T>` — base class for sheet-backed repositories. Configured via
  `RepositoryConfig` (`sheetName`, `columnMappings`, `fromSheetRow`,
  optional `requiredColumns` / `dataStartRow` / validation mode). Built-in
  methods: `findAll(spreadsheet?)`, `batchInsert(entities, spreadsheet?)`,
  `updateRows(updates, ...)`. Subclass and add domain-specific reads/writes.
- `SchemaRegistry` + `defaultSchemaRegistry` — runtime registry of
  `SheetSchema<T>` instances; consumers call `register(name, schema)` at
  module load and look up via `.get(name)` / `.findForSheet(sheetName)` /
  `.list()`. Separate from `Repository` — useful for tooling that needs
  declarative sheet metadata.
- `ValidatorRegistry` + `defaultValidatorRegistry` — pluggable per-column
  value validators keyed by string (extensible beyond built-ins).
- `ValidationErrors` — fluent accumulator for `DomainModel.validate()` with
  `required` / `maxLength` / `positive` / `integer` / `max` / `nonNegative` /
  `custom` builders.
- `DomainModel` contract — `validate()` / `toSheetRow()` /
  `static fromSheetRow()` shape for domain classes.
- `SheetOrmError` taxonomy: `InputValidationError`, `RowNotFoundError`,
  `SchemaMismatchError`, `KatanaAPIError`, and `SheetOrmErrorCode` enum.
- `sheetMetadata` — `getColumnMap`, `getColumnIndex`, `clearColumnMapCache`,
  `validateColumns` (dynamic column discovery with caching).
- `InputSanitizer.validateSheetName` — rejects `'` / `"` / backslash / null-byte
  / range-reference patterns before they reach the Sheets API.
- Subpath exports: `/inputSanitizer`, `/sheetMetadata`.

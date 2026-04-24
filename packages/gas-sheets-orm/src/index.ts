/**
 * @dougborg/gas-sheets-orm — Type-safe sheet-as-database ORM for Google
 * Apps Script.
 *
 * Primary surface: `Repository<T>` + schema/validator registries +
 * `DomainModel` contract. Subpath imports available for
 * `./inputSanitizer` and `./sheetMetadata`.
 */

// Sheet-name validation (must live next to the ORM — callers validate
// names before they hit Repository reads/writes).
export { InputSanitizer } from './inputSanitizer.js';
// Repository, Schema, Validators, DomainModel, ValidationErrors, errors, types.
export * from './sheet-orm/index.js';

// Column discovery + caching (used by Repository internally, exposed for
// consumers that need to resolve column positions by header).
export { clearColumnMapCache, getColumnIndex, getColumnMap, validateColumns } from './sheetMetadata.js';

/**
 * Sheet ORM — generic Object-Relational Mapping primitives for Google Sheets.
 *
 * Domain-specific repositories live in each consumer module
 * (src/bike-specs/repositories, src/build-queue/repositories).
 *
 * @module lib/sheet-orm
 */

// Error classes
export * from './errors.js';
// Base repository
export { type ColumnMapping, Repository, type RepositoryConfig } from './Repository.js';
// Schema registry
export * from './SchemaRegistry.js';
// Type definitions
export * from './types.js';
// Validation accumulator for DomainModel.validate() implementations
export { ValidationErrors } from './validationErrors.js';
// Value sanitization + validator registry
export {
  defaultValidatorRegistry,
  sanitizeColumnValue,
  sanitizeSchemaValue,
  type ValidatorFn,
  ValidatorRegistry
} from './valueSanitizer.js';

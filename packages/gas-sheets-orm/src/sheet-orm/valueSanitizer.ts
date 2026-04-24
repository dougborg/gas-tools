import { InputValidationError } from './errors.js';
import type { ColumnDefinition, ColumnValidatorKey, SheetSchema } from './types.js';

/** A pure transform: take a raw cell value, return a sanitized/validated value. */
export type ValidatorFn = (value: unknown) => unknown;

/**
 * Registry of named column validators. Consumers register domain-specific
 * validators (e.g. 'sku', 'quantity') before any Repository read fires.
 */
export class ValidatorRegistry {
  private readonly validators = new Map<string, ValidatorFn>();

  register(key: ColumnValidatorKey, fn: ValidatorFn): void {
    this.validators.set(key, fn);
  }

  has(key: ColumnValidatorKey): boolean {
    return this.validators.has(key);
  }

  run(key: ColumnValidatorKey, value: unknown): unknown {
    const validator = this.validators.get(key);
    if (!validator) {
      throw new Error(`Unknown column validator: ${key}`);
    }
    return validator(value);
  }

  clear(): void {
    this.validators.clear();
  }
}

/**
 * Default registry used by `sanitizeColumnValue` when no override is
 * provided. Consumers register into this from their module index at load.
 */
export const defaultValidatorRegistry = new ValidatorRegistry();

/**
 * Applies column-level sanitizers and custom validators to a value.
 *
 * @param column Column definition containing validators
 * @param columnName Column name for error context
 * @param value Raw value read from sheet
 * @param registry Optional registry override (defaults to `defaultValidatorRegistry`)
 * @returns Sanitized value
 */
export function sanitizeColumnValue(
  column: ColumnDefinition,
  columnName: string,
  value: unknown,
  registry: ValidatorRegistry = defaultValidatorRegistry
): unknown {
  let sanitized = value;

  if (column.transform) {
    sanitized = column.transform(sanitized);
  }

  if (column.validators && column.validators.length > 0) {
    for (const validatorKey of column.validators) {
      sanitized = registry.run(validatorKey, sanitized);
    }
  }

  if (column.validate && !column.validate(sanitized)) {
    throw new InputValidationError(
      `Value "${sanitized}" failed validation for column "${columnName}"`,
      columnName,
      sanitized
    );
  }

  return sanitized;
}

/**
 * Sanitizes a value using the schema column definition.
 *
 * @param schema Sheet schema containing the column definitions
 * @param columnName Column key defined on the schema
 * @param value Raw value read from sheet
 * @param registry Optional registry override
 * @returns Sanitized value
 */
export function sanitizeSchemaValue<T>(
  schema: SheetSchema<T>,
  columnName: keyof T & string,
  value: unknown,
  registry: ValidatorRegistry = defaultValidatorRegistry
): unknown {
  const columnDefinition = schema.columns[columnName as keyof T];

  if (!columnDefinition) {
    throw new Error(`Column "${columnName}" is not defined on schema "${schema.name}"`);
  }

  return sanitizeColumnValue(columnDefinition, columnName, value, registry);
}

/**
 * Sheet Schema Registry Infrastructure
 *
 * Domain-neutral registry type + helper for registering and looking up
 * sheet schemas by name or by sheet-name pattern. Consumers register their
 * own schemas against `defaultSchemaRegistry` at module load.
 *
 * @module lib/sheet-orm/SchemaRegistry
 */

import type { ColumnDefinition, SheetSchema } from './types.js';

/**
 * Helper for defining a `ColumnDefinition` with the common pattern/type/
 * required triplet plus an options bag.
 *
 * @example
 * const sku = col([/^SKU$/i], 'string', true, { validators: ['sku'] });
 */
export function col(
  patterns: RegExp[],
  type: ColumnDefinition['type'],
  required: boolean = true,
  options: Partial<ColumnDefinition> = {}
): ColumnDefinition {
  return {
    patterns,
    type,
    required,
    ...options
  };
}

/**
 * Runtime registry of sheet schemas. The toolkit ships empty; consumers
 * register their schemas at module load via `defaultSchemaRegistry`.
 */
export class SchemaRegistry {
  private readonly schemas = new Map<string, SheetSchema>();

  /**
   * Register a schema under a key. If a schema with the same key already
   * exists it is overwritten — helpful for re-registration in tests.
   */
  register<T>(name: string, schema: SheetSchema<T>): void {
    this.schemas.set(name, schema as SheetSchema);
  }

  has(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Retrieve a previously-registered schema.
   * @throws {Error} if `name` has not been registered.
   */
  get<T = unknown>(name: string): SheetSchema<T> {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new Error(`Schema not found: ${name}`);
    }
    return schema as SheetSchema<T>;
  }

  /**
   * Find a schema whose `sheetName` exactly matches the given string or
   * whose `namePattern` regex matches it. Returns the first hit or null.
   */
  findForSheet(sheetName: string): SheetSchema | null {
    for (const schema of this.schemas.values()) {
      if (schema.sheetName && schema.sheetName === sheetName) {
        return schema;
      }
      if (schema.namePattern?.test(sheetName)) {
        return schema;
      }
    }
    return null;
  }

  list(): string[] {
    return Array.from(this.schemas.keys());
  }

  clear(): void {
    this.schemas.clear();
  }
}

/**
 * Default registry used throughout the toolkit. Consumers register into
 * this from their module index — call `.register(SCHEMA.name, SCHEMA)` at
 * module load, then read via `.get(name)`, `.findForSheet(sheetName)`, or
 * `.list()`.
 */
export const defaultSchemaRegistry = new SchemaRegistry();

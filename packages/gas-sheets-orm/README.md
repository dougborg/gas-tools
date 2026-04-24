# @dougborg/gas-sheets-orm

Type-safe sheet-as-database primitives for Google Apps Script.

Provides the building blocks for treating a sheet tab as a typed table of domain objects: declare a `SheetSchema`, implement a small `DomainModel` contract, and subclass `Repository<T>` to add your domain-specific reads and writes.

## What's in the box

- **`Repository<T>`** — base class. Subclass it, pass a `RepositoryConfig` (sheet name, column mappings, row factory) to `super(...)`, and add domain methods on top. Built-in: `findAll(spreadsheet?)`, `batchInsert(entities, spreadsheet?)`, `updateRows(updates, ...)`.
- **`SheetSchema<T>` + `SchemaRegistry`** — declarative metadata (columns, ID strategy, variant axes, native Sheets Table API). `defaultSchemaRegistry` is the shared registry; callers look up schemas by name or match against a sheet.
- **`col(patterns, type, required?, options?)`** — `ColumnDefinition` constructor for the common case.
- **`DomainModel`** — contract your row classes implement (`validate()`, `toSheetRow()`, `static fromSheetRow()`).
- **`ValidationErrors`** — fluent accumulator for `validate()` implementations with `required` / `maxLength` / `positive` / `integer` / `max` / `nonNegative` / `custom` builders.
- **`ValidatorRegistry` + `sanitizeColumnValue` / `sanitizeSchemaValue`** — pluggable per-column value normalization keyed by string (register `'sku'`, `'quantity'`, or whatever your domain needs).
- **`sheetMetadata`** — `getColumnMap`, `getColumnIndex`, `validateColumns`, `clearColumnMapCache` for dynamic column discovery with caching.
- **`InputSanitizer.validateSheetName`** — rejects `'` / `"` / backslash / null-byte / range-reference patterns before they reach the Sheets API.
- **Error taxonomy** — `InputValidationError`, `RowNotFoundError`, `SchemaMismatchError`, `KatanaAPIError`, plus `SheetOrmErrorCode` enum and `createValidationError` / `wrapError` factories.

## Install

```bash
npm install @dougborg/gas-sheets-orm
```

Peer dependency: `@types/google-apps-script` (tested against `^1` and `^2`).

Runtime dependency: [`@dougborg/gas-utils`](https://www.npmjs.com/package/@dougborg/gas-utils) for the structured logger the Repository uses for failure reporting.

This package ships TypeScript source; bundle with Vite / esbuild / Rollup as part of your GAS project.

## Quick start

### 1. Implement the `DomainModel` contract for your row type

```ts
import { type DomainModel, ValidationErrors } from '@dougborg/gas-sheets-orm';

export class OrderRow implements DomainModel {
  constructor(
    public readonly orderId: string,
    public readonly customer: string,
    public readonly quantity: number
  ) {}

  validate() {
    return new ValidationErrors()
      .required(this.orderId, 'Order ID')
      .required(this.customer, 'Customer')
      .positive(this.quantity, 'Quantity')
      .integer(this.quantity, 'Quantity')
      .result();
  }

  toSheetRow() {
    return {
      'Order ID': this.orderId,
      Customer: this.customer,
      Quantity: this.quantity
    };
  }

  static fromSheetRow(data: Record<string, unknown>): OrderRow {
    return new OrderRow(String(data['Order ID']), String(data.Customer), Number(data.Quantity));
  }
}
```

### 2. Subclass `Repository<T>`

```ts
import { Repository } from '@dougborg/gas-sheets-orm';

export class OrderRepository extends Repository<OrderRow> {
  constructor() {
    super({
      sheetName: 'Orders',
      columnMappings: {
        orderId: /^Order ID$/i,
        customer: /^Customer$/i,
        quantity: /^Quantity$/i
      },
      fromSheetRow: OrderRow.fromSheetRow,
      requiredColumns: ['orderId', 'customer', 'quantity']
    });
  }
}
```

### 3. Use it

```ts
const repo = new OrderRepository();
const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

const all = repo.findAll(spreadsheet);

const result = repo.batchInsert(
  [new OrderRow('ORD-1001', 'Jane Doe', 2), new OrderRow('ORD-1002', 'John Smith', 1)],
  spreadsheet
);

result.failures.forEach(({ entity, error }) => {
  console.error(`Failed to insert ${entity.orderId}: ${error.message}`);
});
```

### Optional: register a schema in `defaultSchemaRegistry`

Separate from `Repository`, `SheetSchema` + `SchemaRegistry` let you describe a sheet's structure declaratively — useful for tooling that needs to identify which schema applies to a given sheet, or for native Sheets Table API operations:

```ts
import { col, defaultSchemaRegistry, type SheetSchema } from '@dougborg/gas-sheets-orm';

export const ORDER_SCHEMA: SheetSchema<OrderRow> = {
  name: 'ORDERS',
  sheetName: 'Orders',
  idStrategy: { type: 'natural', column: 'orderId' },
  columns: {
    orderId: col([/^Order ID$/i], 'string', true),
    customer: col([/^Customer$/i], 'string', true),
    quantity: col([/^Quantity$/i], 'number', true, { validators: ['quantity'] })
  }
};

export function registerSchemas(): void {
  defaultSchemaRegistry.register(ORDER_SCHEMA.name, ORDER_SCHEMA);
}
```

Then elsewhere:

```ts
const schema = defaultSchemaRegistry.findForSheet('Orders');
if (schema) {
  // do something with the declarative metadata (e.g. validate native table structure)
}
```

## Subpath imports

```ts
// Root barrel (everything)
import { Repository, SchemaRegistry, ValidationErrors, col } from '@dougborg/gas-sheets-orm';

// Tree-shaken subpaths
import { InputSanitizer } from '@dougborg/gas-sheets-orm/inputSanitizer';
import { getColumnMap } from '@dougborg/gas-sheets-orm/sheetMetadata';
```

## Related packages

- [`@dougborg/gas-utils`](https://www.npmjs.com/package/@dougborg/gas-utils) — runtime helpers (logger, ARRAYFORMULA auto-fix, visual feedback).
- [`@dougborg/gas-test-utils`](https://www.npmjs.com/package/@dougborg/gas-test-utils) — vitest mock factories for GAS globals.
- [`@dougborg/katana-sheets-toolkit`](https://www.npmjs.com/package/@dougborg/katana-sheets-toolkit) — Katana MRP API client that builds on this ORM.

## License

MIT © Doug Borg

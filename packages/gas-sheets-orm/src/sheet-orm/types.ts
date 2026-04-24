/**
 * Sheet ORM Type Definitions
 *
 * Core type system for the Sheet ORM (Object-Relational Mapping) abstraction layer.
 * This module provides the foundational types and interfaces for treating Google Sheets
 * as a structured database with typed schemas, validation, and query capabilities.
 *
 * Features:
 * - Type-safe column definitions with validation and transformation
 * - Schema-based sheet structure definition with flexible name matching
 * - Query building with filter operators and sorting
 * - Batch operations with success/failure tracking
 * - Domain model interface for entities
 * - Support for Google Sheets API Table format
 *
 * The ORM supports multiple ID strategies (natural keys, UUIDs, row numbers) and
 * provides flexible column matching using regex patterns for robust schema evolution.
 *
 * @module lib/sheet-orm/types
 */

/**
 * Logical data types supported by the Sheet ORM
 *
 * These types are mapped to appropriate Google Sheets formats:
 * - string: TEXT
 * - number: DOUBLE, PERCENT, CURRENCY
 * - boolean: BOOLEAN (checkboxes)
 * - date: DATE, TIME, DATE_TIME
 * - json: TEXT (serialized JSON)
 */
export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'json';

/**
 * Key identifying a column-level validator. The toolkit ships with no
 * built-in validators; consumers register their own against
 * `defaultValidatorRegistry` (see src/lib/sheet-orm/valueSanitizer.ts).
 */
export type ColumnValidatorKey = string;

/**
 * Native Google Sheets column types from the Sheets API Table format
 *
 * These types correspond to the column format types available in Google Sheets:
 * - TEXT: Plain text values
 * - DOUBLE: Numeric values (integers or decimals)
 * - PERCENT: Percentage values (stored as decimals, displayed with %)
 * - CURRENCY: Currency values with appropriate formatting
 * - DATE: Date-only values
 * - TIME: Time-only values
 * - DATE_TIME: Combined date and time values
 * - BOOLEAN: Checkbox values (true/false)
 * - DROPDOWN: Data validation dropdown with predefined options
 */
export type NativeColumnType =
  | 'TEXT'
  | 'DOUBLE'
  | 'PERCENT'
  | 'CURRENCY'
  | 'DATE'
  | 'TIME'
  | 'DATE_TIME'
  | 'BOOLEAN'
  | 'DROPDOWN';

/**
 * Configuration for dropdown data validation with optional styling
 *
 * Defines the options available in a dropdown list and their visual presentation.
 * Supports strict validation to reject values not in the list.
 */
export interface DropdownConfig {
  /** When true, reject any values not in the dropdown options list */
  strict: boolean;

  /**
   * Available dropdown options with optional color styling
   *
   * Each option can have custom background and foreground colors for
   * visual categorization (e.g., green for "Complete", red for "Blocked")
   */
  options: Array<{
    /** Text value displayed and stored in the cell */
    userEnteredValue: string;
    /** Optional background color in hex format (e.g., "#d4edda" for light green) */
    backgroundColor?: string;
    /** Optional text color in hex format (e.g., "#155724" for dark green) */
    foregroundColor?: string;
  }>;
}

/**
 * Complete definition of a column in a sheet schema
 *
 * Defines all aspects of a column including its matching patterns, data type,
 * validation rules, transformations, and default values. Supports flexible
 * header matching using regex patterns for schema evolution.
 */
export interface ColumnDefinition {
  /**
   * Regex patterns to match column header names
   *
   * Supports multiple patterns to handle header variations and evolution.
   * Patterns are typically case-insensitive for robust matching.
   * Example: [/^sku$/i, /^part\s*number$/i] matches "SKU" or "Part Number"
   */
  patterns: RegExp[];

  /** When true, this column must be present in the sheet */
  required: boolean;

  /** Logical data type of the column values */
  type: ColumnType;

  /**
   * Native Google Sheets column type for Tables API formatting
   *
   * When specified, the ORM will apply appropriate Google Sheets formatting
   * and data validation to the column (e.g., date pickers, checkboxes, dropdowns)
   */
  nativeType?: NativeColumnType;

  /**
   * Dropdown configuration when nativeType is DROPDOWN
   *
   * Defines the available options and their visual styling for dropdown columns.
   * Only applicable when nativeType is 'DROPDOWN'
   */
  dropdownConfig?: DropdownConfig;

  /**
   * Default value to use when column is missing or cell is empty
   *
   * Can be any value appropriate for the column's type. Applied during
   * entity hydration when reading from sheets.
   */
  default?: any;

  /**
   * Optional transformation function applied after reading value from sheet
   *
   * Use for value normalization, parsing, or conversion. Applied after
   * default value resolution but before validation.
   *
   * @param value Raw value read from sheet
   * @returns Transformed value
   */
  transform?: (value: any) => any;

  /**
   * Optional validation function to check value correctness
   *
   * Return true if value is valid, false otherwise. Validation errors
   * are collected and reported during entity hydration.
   *
   * @param value Value to validate (after transformation)
   * @returns true if valid, false otherwise
   */
  validate?: (value: any) => boolean;

  /**
   * Reusable validator keys applied after transformation.
   *
   * Validators perform sanitization (e.g., SKU normalization) and throw
   * InputValidationError when values are invalid.
   */
  validators?: ColumnValidatorKey[];

  /** Human-readable description for documentation and error messages */
  description?: string;
}

/**
 * Strategy for identifying unique rows in a sheet
 *
 * Determines how rows are uniquely identified for update and delete operations:
 * - 'natural': Use combination of business key columns (e.g., SKU + Color)
 * - 'uuid': Use generated UUID column for guaranteed uniqueness
 * - 'row-number': Use physical row position (least robust, not recommended)
 */
export interface IdStrategy {
  /** Method for identifying unique rows */
  type: 'natural' | 'uuid' | 'row-number';

  /**
   * Column names forming the natural key
   *
   * Required when type is 'natural'. The combination of these column values
   * must uniquely identify each row. Example: ['sku', 'color'] for variants.
   */
  naturalKeyColumns?: string[];
}

/**
 * Complete schema definition for a sheet
 *
 * Defines the structure, validation rules, and identity strategy for a sheet.
 * Schemas support both fixed sheet names and dynamic name patterns for
 * flexibility across multiple similar sheets (e.g., "Part A BOM", "Part B BOM").
 *
 * @template T Domain model type that this schema maps to
 */
export interface SheetSchema<T = any> {
  /**
   * Unique schema identifier
   *
   * Used for schema registration and lookup. Convention: uppercase with
   * underscores (e.g., 'BOM', 'COMPONENT_SPEC', 'BUILD_QUEUE')
   */
  name: string;

  /**
   * Exact sheet name when working with a specific sheet
   *
   * Use this for fixed sheet names like 'Component Data' or 'Build Queue'.
   * Mutually exclusive with namePattern.
   */
  sheetName?: string;

  /**
   * Pattern to match sheet names when working with multiple similar sheets
   *
   * Use this for dynamic sheet matching like /BOM$/i to match any sheet
   * ending with "BOM". Mutually exclusive with sheetName.
   */
  namePattern?: RegExp;

  /**
   * Column definitions keyed by domain model property names
   *
   * Maps each property in the domain model to its column definition.
   * Keys must match the properties of type T.
   */
  columns: Record<keyof T, ColumnDefinition>;

  /**
   * Strategy for identifying unique rows
   *
   * Defines how rows are uniquely identified for update/delete operations.
   * Critical for maintaining data integrity during batch operations.
   */
  idStrategy: IdStrategy;

  /**
   * Names of columns representing variant dimensions
   *
   * For products with variants (e.g., Size, Color, Build Kit), list the
   * column names that define variant axes. Used for variant-aware operations.
   */
  variantAxes?: string[];

  /**
   * Whether this sheet uses Google Sheets API Table format
   *
   * When true, the ORM uses the Sheets API Table operations for enhanced
   * features like column headers, data validation, and structured tables.
   */
  usesTableApi?: boolean;

  /**
   * Whether columns beyond the schema can be discovered dynamically
   *
   * When true, allows reading columns not defined in the schema. Useful
   * for schemas that extend dynamically (e.g., variant axes, custom fields).
   */
  dynamicColumns?: boolean;

  /**
   * Optional custom validation function for entire rows
   *
   * Provides additional validation beyond individual column validation.
   * Use for cross-column validation rules (e.g., endDate > startDate).
   *
   * @param row Complete row data
   * @returns Validation result with errors list
   */
  validateRow?: (row: T) => { valid: boolean; errors: string[] };
}

/**
 * Mapping of logical column names to their 1-based sheet column indices
 *
 * Example: { 'sku': 1, 'quantity': 2, 'status': 5 }
 * Column indices are 1-based to match Google Sheets API conventions.
 */
export interface ColumnMap {
  [columnName: string]: number;
}

/**
 * Result of column mapping operation with diagnostic information
 *
 * Provides detailed feedback about column matching success/failures,
 * helping diagnose schema mismatches and sheet structure issues.
 */
export interface ColumnMappingResult {
  /** Successful column mappings (property name -> 0-based column index) */
  mappings: Map<string, number>;

  /** Reverse index for O(1) lookups (0-based column index -> property name) */
  indexToProperty: Map<number, string>;

  /** Required columns that were not found in the sheet headers */
  missingRequired: string[];

  /** Optional columns that were not found in the sheet headers */
  missingOptional: string[];

  /**
   * Columns found in the sheet but not defined in the schema
   *
   * Useful for detecting schema drift or columns that should be added
   * to the schema definition.
   */
  extraColumns: string[];

  /** Actual header values from sheet (for write ordering) */
  headers: any[];

  /** Sheet ID for cache invalidation */
  sheetId: number;
}

/**
 * Validation mode for schema checking
 */
export type ValidationMode = 'strict' | 'lenient' | 'warn-only';

/**
 * Filter operators for type-safe query building
 *
 * Provides SQL-like filtering capabilities with type safety. Operators are
 * conditionally available based on the data type (e.g., greaterThan only
 * for numbers, startsWith only for strings).
 *
 * @template T The data type being filtered
 */
export interface FilterOperator<T> {
  /** Exact equality match */
  equals?: T;
  /** Negated equality */
  notEquals?: T;
  /** Match if value is in the provided array */
  in?: T[];
  /** Match if value is not in the provided array */
  notIn?: T[];
  /** Greater than comparison (numbers only) */
  greaterThan?: T extends number ? T : never;
  /** Less than comparison (numbers only) */
  lessThan?: T extends number ? T : never;
  /** Greater than or equal comparison (numbers only) */
  greaterThanOrEqual?: T extends number ? T : never;
  /** Less than or equal comparison (numbers only) */
  lessThanOrEqual?: T extends number ? T : never;
  /** String starts with prefix (strings only) */
  startsWith?: T extends string ? string : never;
  /** String ends with suffix (strings only) */
  endsWith?: T extends string ? string : never;
  /** String contains substring (strings only) */
  contains?: T extends string ? string : never;
  /** String matches regex pattern (strings only) */
  matches?: T extends string ? RegExp : never;
  /** Check if value is null/undefined/empty */
  isNull?: boolean;
  /** Check if value is not null/undefined/empty */
  isNotNull?: boolean;
}

/**
 * Type-safe filter expression for querying entities
 *
 * Allows filtering on any property of type T using either direct values
 * or filter operators. Multiple conditions are AND-ed together.
 *
 * @template T Domain model type being queried
 *
 * @example
 * // Simple equality filter
 * const filter: FilterExpression<Component> = { status: 'Available' };
 *
 * @example
 * // Filter with operators
 * const filter: FilterExpression<Component> = {
 *   quantity: { greaterThan: 0 },
 *   category: { in: ['Frame', 'Fork'] }
 * };
 */
export type FilterExpression<T> = {
  [K in keyof T]?: T[K] | FilterOperator<T[K]>;
};

/**
 * Sort direction for ordering query results
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort specification for a single field
 *
 * @template T Domain model type being sorted
 */
export interface SortSpec<T> {
  /** Field name to sort by */
  field: keyof T;
  /** Sort direction (ascending or descending) */
  direction: SortDirection;
}

/**
 * Complete query options for filtering, sorting, and pagination
 *
 * Combines filtering, sorting, and pagination into a single query specification.
 * All options are optional, allowing simple to complex queries.
 *
 * @template T Domain model type being queried
 *
 * @example
 * const options: QueryOptions<Component> = {
 *   filter: { category: 'Frame', quantity: { greaterThan: 0 } },
 *   sort: [{ field: 'name', direction: 'asc' }],
 *   limit: 50,
 *   offset: 0
 * };
 */
export interface QueryOptions<T> {
  /** Optional filter expression to narrow results */
  filter?: FilterExpression<T>;
  /** Optional sort specifications (applied in order) */
  sort?: SortSpec<T>[];
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

/**
 * Result of validating a single row
 *
 * Contains validation status, error messages, and optional warnings.
 * Used during entity hydration and batch operations.
 */
export interface RowValidationResult {
  /** Whether the row passed all validation checks */
  valid: boolean;
  /** List of validation error messages (empty if valid) */
  errors: string[];
  /** Optional warning messages that don't prevent processing */
  warnings?: string[];
}

/**
 * Metadata about a sheet table structure
 *
 * Provides runtime information about a sheet's structure including
 * dimensions, column mappings, and schema details. Used by repositories
 * for efficient data access.
 */
export interface SheetTableMetadata {
  /** Name of the sheet in the spreadsheet */
  sheetName: string;
  /** Schema identifier for this sheet */
  schemaName: string;
  /** Total number of columns in the table */
  columnCount: number;
  /** Total number of data rows (excluding header) */
  rowCount: number;
  /** Mapping of logical column names to sheet indices */
  columnMap: ColumnMap;
  /** List of required column names from schema */
  requiredColumns: string[];
  /** List of optional column names from schema */
  optionalColumns: string[];
  /** Names of variant axis columns (if applicable) */
  variantAxes?: string[];
}

/**
 * Result of a batch operation (insert, update, or delete)
 *
 * Tracks success and failure for each item in a batch operation,
 * providing detailed error information for failed items. Enables
 * partial success handling in batch workflows.
 *
 * @template T Domain model type being processed
 */
export interface BatchOperationResult<T> {
  /** Entities that were successfully processed */
  success: T[];
  /**
   * Failed operations with error details
   *
   * Each failed item includes the sheet row data (as returned by toSheetRow())
   * and the error message explaining why it failed.
   */
  failed: Array<{
    /** Row data that failed processing (in sheet row format) */
    data: Record<string, any>;
    /** Error message describing the failure */
    error: string;
  }>;
  /** Total count of successful operations */
  successCount: number;
  /** Total count of failed operations */
  failureCount: number;
}

/**
 * Base interface for domain model entities
 *
 * All domain models in the Sheet ORM must implement this interface to ensure
 * they can be validated and serialized to sheet format. This provides a
 * consistent contract for repository operations.
 */
export interface DomainModel {
  /**
   * Validate the domain model's current state
   *
   * Checks business rules and data integrity constraints. Called automatically
   * before write operations to ensure data quality.
   *
   * @returns Validation result indicating success/failure with error details
   */
  validate(): { valid: boolean; errors: string[] };

  /**
   * Serialize domain model to sheet row format
   *
   * Converts the domain model to a flat object suitable for writing to a sheet.
   * Property names should match the schema's column definitions.
   *
   * @returns Flat object with properties matching sheet columns
   */
  toSheetRow(): Record<string, any>;
}

/**
 * Type guard to check if a value is a filter operator object
 *
 * Used internally by query builders to distinguish between direct values
 * and filter operator objects in filter expressions.
 *
 * @template T The data type being filtered
 * @param value Value to check
 * @returns true if value is a FilterOperator, false otherwise
 *
 * @example
 * if (isFilterOperator(filterValue)) {
 *   // Handle operator-based filtering
 * } else {
 *   // Handle direct value equality
 * }
 */
export function isFilterOperator<T>(value: any): value is FilterOperator<T> {
  if (typeof value !== 'object' || value === null) return false;

  const operatorKeys = [
    'equals',
    'notEquals',
    'in',
    'notIn',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'startsWith',
    'endsWith',
    'contains',
    'matches',
    'isNull',
    'isNotNull'
  ];

  return operatorKeys.some((key) => key in value);
}

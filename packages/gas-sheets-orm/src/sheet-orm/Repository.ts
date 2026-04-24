/**
 * Base Repository for Sheet ORM
 *
 * Provides a robust data access abstraction layer for domain models stored in
 * Google Sheets. Implements the Repository pattern for type-safe CRUD operations
 * with automatic column mapping, validation, and batch processing.
 *
 * Features:
 * - Flexible column matching using string literals or regex patterns
 * - Automatic domain model hydration from sheet rows
 * - Batch insert operations with Sheets API for efficiency
 * - Formula preservation during data writes
 * - Date formatting with timezone handling
 * - Comprehensive validation with detailed error tracking
 * - Empty row detection and handling
 * - Support for both fixed sheet names and dynamic pattern matching
 *
 * The Repository class serves as the base for specialized repositories (e.g.,
 * ComponentSpecRepository, BuildQueueRepository) that add domain-specific
 * operations while inheriting common data access patterns.
 *
 * @module lib/sheet-orm/Repository
 */

import type { BatchOperationResult, ColumnMappingResult, DomainModel, ValidationMode } from './types.js';

/**
 * Column mapping configuration for flexible header matching
 *
 * Maps domain model property names to sheet column headers using:
 * - String literals for exact matches
 * - Single RegExp for pattern matching
 * - Array of RegExp for fallback patterns
 *
 * This flexibility allows schemas to handle column name variations
 * and evolution without breaking existing sheets.
 */
export interface ColumnMapping {
  [propertyName: string]: string | RegExp | RegExp[];
}

/**
 * Repository configuration for a domain model
 *
 * Defines how the repository locates and reads sheets, maps columns,
 * and hydrates domain model instances from raw sheet data.
 *
 * @template T Domain model type that extends DomainModel
 */
export interface RepositoryConfig<T extends DomainModel> {
  /**
   * Sheet name (exact) or pattern to match
   *
   * Use string for fixed sheets: 'Component Data'
   * Use RegExp for dynamic matching: /BOM$/i (matches sheets ending with "BOM")
   */
  sheetName: string | RegExp;

  /**
   * Column mappings from property names to sheet column names
   *
   * Keys are domain model property names, values are matchers for
   * sheet column headers. Supports exact matches (strings) and
   * flexible patterns (RegExp or RegExp arrays).
   *
   * @example
   * {
   *   sku: [/^sku$/i, /^part\s*number$/i], // Matches "SKU" or "Part Number"
   *   quantity: /^qty$/i, // Matches "QTY" case-insensitively
   *   status: 'Status' // Exact match
   * }
   */
  columnMappings: ColumnMapping;

  /**
   * Factory function to create domain model instances from sheet row data
   *
   * Receives a data object with property names as keys and cell values
   * as values. Should return a fully constructed domain model instance.
   *
   * @param data Row data with mapped property names
   * @returns Domain model instance
   */
  fromSheetRow: (data: Record<string, any>) => T;

  /**
   * 0-based array index where data rows start in the data array
   *
   * This is the index into the array returned by `getDataRange().getValues()`,
   * NOT the row number in the Google Sheet.
   *
   * - Default: `1` (skip row at index 0, which is typically the header row)
   * - Use `0` if the sheet has no header row (not recommended)
   * - Use `2` to skip both header row and an additional row
   *
   * @example
   * // Standard sheet with header at index 0, data starting at index 1
   * dataStartRow: 1  // Default - reads ['data1', 'data2', ...] skipping ['Header1', 'Header2', ...]
   *
   * @example
   * // Sheet with header + template row to skip
   * dataStartRow: 2  // Reads from index 2 onwards
   */
  dataStartRow?: number;

  /** Optional: List of required column names (for validation) */
  requiredColumns?: string[];

  /** Optional: Validation mode (default: 'lenient') */
  validationMode?: ValidationMode;

  /** Optional: Whether to allow extra columns in sheet not in schema (default: true) */
  allowExtraColumns?: boolean;
}

/**
 * Base Repository class implementing data access for sheet-backed domain models
 *
 * Provides core CRUD operations with type safety, automatic validation, and
 * efficient batch processing. Designed to be extended by specialized repositories
 * that add domain-specific query methods and business logic.
 *
 * @template T Domain model type that extends DomainModel
 *
 * @example
 * class ProductRepository extends Repository<Product> {
 *   constructor() {
 *     super({
 *       sheetName: 'Products',
 *       columnMappings: {
 *         sku: /^sku$/i,
 *         name: 'Product Name',
 *         quantity: [/^qty$/i, /^quantity$/i]
 *       },
 *       fromSheetRow: (data) => new Product(data)
 *     });
 *   }
 * }
 */
export class Repository<T extends DomainModel> {
  /** Repository configuration defining sheet location and column mappings */
  protected config: RepositoryConfig<T>;
  protected columnMapCache?: ColumnMappingResult;
  protected lastSheetId?: number;

  /**
   * Creates a new Repository instance
   *
   * @param config Repository configuration with sheet name, column mappings, and factory
   */
  constructor(config: RepositoryConfig<T>) {
    this.config = config;
  }

  /**
   * Find sheet by exact name or pattern matching
   *
   * Searches for a sheet using either exact string match (case-sensitive) or
   * regex pattern matching against all sheet names in the spreadsheet.
   *
   * @param spreadsheet Google Spreadsheet to search
   * @returns Matched Sheet or null if not found
   */
  protected findSheet(
    spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet
  ): GoogleAppsScript.Spreadsheet.Sheet | null {
    if (typeof this.config.sheetName === 'string') {
      return spreadsheet.getSheetByName(this.config.sheetName);
    }

    // Pattern matching
    const sheets = spreadsheet.getSheets();
    return (
      sheets.find((s) => this.config.sheetName instanceof RegExp && this.config.sheetName.test(s.getName())) || null
    );
  }

  /**
   * Map sheet column headers to domain model property names
   *
   * Iterates through columnMappings configuration and attempts to match each
   * property to a column header using the configured matchers (string, RegExp,
   * or RegExp array). Returns a Map for efficient lookups during row hydration.
   *
   * @param headers Array of sheet header strings (from row 1)
   * @returns Map of property names to 0-based column indices
   */
  protected mapColumns(headers: string[]): Map<string, number> {
    const columnMap = new Map<string, number>();

    for (const [propertyName, matcher] of Object.entries(this.config.columnMappings)) {
      const index = this.findColumnIndex(headers, matcher);
      if (index !== -1) {
        columnMap.set(propertyName, index);
      }
    }

    return columnMap;
  }

  /**
   * Find column index by matching header against string, RegExp, or RegExp array
   *
   * Supports three matching strategies:
   * 1. String: exact match (after trimming)
   * 2. RegExp: pattern match against trimmed headers
   * 3. RegExp[]: try each pattern in order, return first match
   *
   * @param headers Array of sheet header strings
   * @param matcher String literal, RegExp, or array of RegExp patterns
   * @returns 0-based column index, or -1 if not found
   */
  protected findColumnIndex(headers: string[], matcher: string | RegExp | RegExp[]): number {
    if (typeof matcher === 'string') {
      return headers.findIndex((h) => h.trim() === matcher);
    }

    if (matcher instanceof RegExp) {
      return headers.findIndex((h) => matcher.test(h.trim()));
    }

    // Array of RegExp - try each pattern
    for (const pattern of matcher) {
      const index = headers.findIndex((h) => pattern.test(h.trim()));
      if (index !== -1) return index;
    }

    return -1;
  }

  /**
   * Build dynamic column mapping from actual sheet headers
   *
   * This method reads the sheet's header row at runtime and creates a mapping between
   * property names (from config.columnMappings) and their actual column positions in the sheet.
   * This makes write operations ORDER-INDEPENDENT - the order of properties in config.columnMappings
   * doesn't need to match the actual column order in the sheet.
   *
   * **Caching**: Results are cached per sheet (by sheet ID) for performance. The cache is
   * automatically invalidated when the sheet ID changes.
   *
   * **Column Detection**:
   * - Uses `getMaxColumns()` to include hidden columns
   * - Matches columns using string literals, RegExp patterns, or arrays of patterns from config
   * - Detects missing required and optional columns
   * - Identifies extra columns not defined in schema
   *
   * @param sheet - Google Sheet to read headers from
   * @returns Column mapping result with:
   *   - `mappings`: Map of property names to 0-based column indices
   *   - `indexToProperty`: Reverse index for O(1) column-to-property lookups
   *   - `missingRequired`: Array of required column names not found in sheet
   *   - `missingOptional`: Array of optional column names not found in sheet
   *   - `extraColumns`: Array of column names in sheet but not in schema
   *   - `headers`: Actual header values from sheet (preserves exact order)
   *   - `sheetId`: Sheet ID for cache invalidation
   *
   * @example
   * ```typescript
   * // Config defines: { id: 'ID', name: 'Name', value: 'Value' }
   * // Sheet has columns: ['Value', 'ID', 'Name'] (different order!)
   * const mapping = this.buildColumnMapping(sheet);
   * // mapping.mappings = Map { 'value' => 0, 'id' => 1, 'name' => 2 }
   * // mapping.headers = ['Value', 'ID', 'Name']
   * ```
   */
  protected buildColumnMapping(sheet: GoogleAppsScript.Spreadsheet.Sheet): ColumnMappingResult {
    // Check cache first
    const sheetId = sheet.getSheetId();
    if (this.columnMapCache && this.lastSheetId === sheetId) {
      return this.columnMapCache;
    }

    // Read headers (use getMaxColumns to include hidden columns)
    const maxCol = sheet.getMaxColumns();
    const headers = sheet.getRange(1, 1, 1, maxCol).getValues()[0];

    const mappings: Map<string, number> = new Map();
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    const extraColumns: string[] = [];

    // Get required columns list from config
    const requiredColumns = new Set(this.config.requiredColumns || []);

    // Map configured columns to sheet positions
    for (const [propertyName, matcher] of Object.entries(this.config.columnMappings)) {
      const index = this.findColumnIndex(headers, matcher);
      if (index !== -1) {
        mappings.set(propertyName, index);
      } else {
        // Column not found - check if required or optional
        if (requiredColumns.has(propertyName)) {
          missingRequired.push(propertyName);
        } else {
          missingOptional.push(propertyName);
        }
      }
    }

    // Find extra columns in sheet not in config
    if (this.config.allowExtraColumns !== false) {
      const mappedIndices = new Set(Array.from(mappings.values()));
      headers.forEach((header, index) => {
        const headerStr = String(header).trim();
        if (headerStr && !mappedIndices.has(index)) {
          extraColumns.push(headerStr);
        }
      });
    }

    // Build reverse index for O(1) lookups (column index -> property name)
    const indexToProperty = new Map<number, string>();
    for (const [propertyName, index] of mappings.entries()) {
      indexToProperty.set(index, propertyName);
    }

    const result: ColumnMappingResult = {
      mappings,
      indexToProperty,
      missingRequired,
      missingOptional,
      extraColumns,
      headers,
      sheetId
    };

    // Cache the result
    this.columnMapCache = result;
    this.lastSheetId = sheetId;

    return result;
  }

  /**
   * Check if a column is required based on config
   * @param propertyName - Property name to check
   * @returns True if column is required
   */
  protected isRequiredColumn(propertyName: string): boolean {
    return this.config.requiredColumns?.includes(propertyName) || false;
  }

  /**
   * Validate column mapping and emit warnings/errors based on validation mode
   *
   * This method validates that the sheet schema matches expectations and provides
   * helpful feedback when columns are missing or extra columns are present.
   *
   * **Validation Modes** (set via `config.validationMode`, defaults to 'lenient'):
   *
   * - **strict**: Throws errors for ANY schema mismatch (missing required, missing optional, or extra columns)
   * - **lenient**: Throws errors for missing required columns, warns for missing optional columns
   * - **warn-only**: Only logs warnings/info messages, never throws errors
   *
   * **Behavior**:
   * - Missing required columns: Error (strict/lenient) or Warning (warn-only)
   * - Missing optional columns: Error (strict), Warning (lenient), Info (warn-only)
   * - Extra columns: Error (strict) or Info (lenient/warn-only) **if** `config.allowExtraColumns` is not set to `false`. If `allowExtraColumns: false` is set in the config, extra columns are ignored and no warning/error is emitted.
   *
   * @param result - Column mapping result from buildColumnMapping()
   * @throws Error if schema validation fails in strict or lenient mode
   *
   * @example
   * ```typescript
   * const mapping = this.buildColumnMapping(sheet);
   * this.validateColumnMapping(mapping); // Throws if required columns missing
   * ```
   */
  protected validateColumnMapping(result: ColumnMappingResult): void {
    const mode = this.config.validationMode || 'lenient';
    const sheetName = typeof this.config.sheetName === 'string' ? this.config.sheetName : '<pattern>';

    // Handle missing required columns
    if (result.missingRequired.length > 0) {
      const message =
        `Sheet "${sheetName}" is missing required columns: ${result.missingRequired.join(', ')}\n` +
        `These columns must exist in the sheet for this entity type.`;

      if (mode === 'strict' || mode === 'lenient') {
        throw new Error(message);
      } else {
        // warn-only mode
        console.warn(`⚠️ ${message}`);
      }
    }

    // Handle missing optional columns
    if (result.missingOptional.length > 0) {
      const message =
        `Sheet "${sheetName}" is missing optional columns: ${result.missingOptional.join(', ')}\n` +
        `These columns will use default/null values.`;

      if (mode === 'strict') {
        throw new Error(message);
      } else if (mode === 'lenient') {
        console.warn(`⚠️ ${message}`);
      } else {
        // warn-only mode
        console.info(`ℹ️ ${message}`);
      }
    }

    // Handle extra columns
    if (result.extraColumns.length > 0 && this.config.allowExtraColumns !== false) {
      const message =
        `Sheet "${sheetName}" contains columns not in schema: ${result.extraColumns.join(', ')}\n` +
        `These columns will be ignored during read/write operations.`;

      if (mode === 'strict') {
        throw new Error(message);
      } else {
        // lenient or warn-only mode
        console.info(`ℹ️ ${message}`);
      }
    }
  }

  /**
   * Convert sheet row to domain object
   * @param row - Raw sheet row values
   * @param columnMap - Map of property names to column indices
   * @returns Domain object data
   */
  protected rowToData(row: any[], columnMap: Map<string, number>): Record<string, any> {
    const data: Record<string, any> = {};

    for (const [propertyName, columnIndex] of columnMap.entries()) {
      data[propertyName] = row[columnIndex];
    }

    return data;
  }

  /**
   * Find and hydrate all entities from the sheet
   *
   * Reads the entire data range, maps columns, validates required columns,
   * and hydrates each row into a domain model instance. Skips empty rows
   * and logs warnings for rows that fail to parse (without stopping execution).
   *
   * @param spreadsheet Optional spreadsheet (defaults to active spreadsheet)
   * @returns Array of domain model instances
   * @throws {Error} If sheet is not found or required columns are missing
   */
  findAll(spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet): T[] {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.findSheet(ss);

    if (!sheet) {
      throw new Error(`Sheet not found: ${this.config.sheetName}`);
    }

    // Build and validate column mapping
    const columnMappingResult = this.buildColumnMapping(sheet);
    this.validateColumnMapping(columnMappingResult);

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // No data rows (only header or empty)
      return [];
    }

    const dataStartRow = this.config.dataStartRow || 1; // Default to row 1 (0-indexed)
    const entities: T[] = [];

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (this.isEmptyRow(row)) {
        continue;
      }

      try {
        const rowData = this.rowToData(row, columnMappingResult.mappings);
        const entity = this.config.fromSheetRow(rowData);
        entities.push(entity);
      } catch (error) {
        console.warn(`⚠️ Failed to parse row ${i + 1}: ${error}`);
        // Continue processing other rows
      }
    }

    return entities;
  }

  /**
   * Check if a sheet row is completely empty
   *
   * A row is considered empty if all cells are empty string, null, or undefined.
   * Used to skip empty rows during entity hydration.
   *
   * @param row Array of cell values from sheet row
   * @returns true if all cells are empty, false otherwise
   */
  protected isEmptyRow(row: any[]): boolean {
    return row.every((cell) => cell === '' || cell === null || cell === undefined);
  }

  /**
   * Validate that all required columns are present in the column map
   *
   * Base implementation does nothing - subclasses should override to enforce
   * required column presence and throw errors if essential columns are missing.
   * This hook allows domain-specific validation without modifying base repository.
   *
   * @param _columnMap Map of discovered columns (underscore prefix indicates intentional non-use)
   */
  protected validateRequiredColumns(_columnMap: Map<string, number>): void {
    // Base implementation does nothing - subclasses can override
    // to throw errors if required columns are missing
  }

  /**
   * Get the serialization order for entity properties
   *
   * Returns property names in the order they appear in columnMappings configuration.
   * This order is used when converting entities to sheet row arrays, ensuring
   * consistent column ordering during writes.
   *
   * @returns Array of property names in columnMappings order
   */
  protected getColumnOrder(): string[] {
    return Object.keys(this.config.columnMappings);
  }

  /**
   * Convert domain model entity to sheet values array in correct column order
   *
   * This method serializes a domain model entity to an array of values ready for writing
   * to Google Sheets. It uses the actual sheet header order (from column mapping) to ensure
   * ORDER-INDEPENDENT writes - the order of values matches the sheet's column order, not
   * the config.columnMappings property order.
   *
   * **Column Ordering**:
   * - Iterates over actual sheet headers (from `columnMapping.headers`)
   * - Looks up which entity property maps to each column position
   * - Builds values array in exact sheet column order
   *
   * **Value Transformations**:
   * - `null`/`undefined` → `null` (preserves empty cells)
   * - Formulas (strings starting with `=`) → preserved as-is
   * - `Date` objects → formatted as "M/d/yyyy H:mm:ss" string (script timezone)
   * - Extra columns (not in schema) → `null` (preserves but doesn't populate)
   *
   * **Use Cases**:
   * - Called by `updateRows()` to prepare batch update values
   * - Called by `batchInsert()` to prepare new row values
   * - Ensures consistent serialization across all write operations
   *
   * @param entity - Domain model instance (must implement `toSheetRow()` method)
   * @param columnMapping - Column mapping result from `buildColumnMapping()`
   * @returns Array of values in sheet column order (ready for Sheets API write)
   *
   * @example
   * ```typescript
   * // Sheet has columns: ['Order ID', 'Customer', 'Status', 'Extra Column']
   * // Config defines: { orderId: 'Order ID', customer: 'Customer', status: 'Status' }
   * const mapping = this.buildColumnMapping(sheet);
   * const values = this.entityToSheetValues(order, mapping);
   * // values = [123, 'John Doe', 'Pending', null]
   * //           ^         ^          ^        ^ Extra column → null
   * //           orderId   customer   status
   * ```
   */
  protected entityToSheetValues(entity: T, columnMapping: ColumnMappingResult): any[] {
    const rowObject = entity.toSheetRow();
    const tz = Session.getScriptTimeZone();

    // Use actual sheet header order (order-independent of config)
    return columnMapping.headers.map((_header, index) => {
      // Find which property maps to this column (O(1) lookup via reverse index)
      const propertyName = columnMapping.indexToProperty.get(index);

      if (!propertyName) {
        // Column not in our schema - return null (preserves extra columns)
        return null;
      }

      const value = rowObject[propertyName];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return null;
      }

      // Preserve formulas (strings starting with =)
      if (typeof value === 'string' && value.startsWith('=')) {
        return value;
      }

      // Format dates consistently
      if (value instanceof Date) {
        return Utilities.formatDate(value, tz, 'M/d/yyyy H:mm:ss');
      }

      return value;
    });
  }

  /**
   * Batch insert multiple entities into the sheet
   *
   * Validates all entities before insertion, then writes valid entities in a single
   * batch operation using Sheets API for efficiency. Invalid entities are tracked
   * separately with error details. If batch write fails, all entities are marked
   * as failed.
   *
   * Features:
   * - Pre-insertion validation with detailed error tracking
   * - Partial success handling (valid entities written, invalid ones reported)
   * - Formula preservation using USER_ENTERED value input option
   * - Efficient batch API call (single write for all entities)
   * - Comprehensive result reporting with success/failure counts
   *
   * @param entities Array of domain model instances to insert
   * @param spreadsheet Optional spreadsheet (defaults to active spreadsheet)
   * @returns BatchOperationResult with success/failure details
   * @throws {Error} If sheet not found or Sheets API unavailable
   *
   * @example
   * const products = [product1, product2, product3];
   * const result = repository.batchInsert(products);
   * console.log(`Inserted ${result.successCount}, failed ${result.failureCount}`);
   * result.failed.forEach(f => console.error(f.error));
   */
  batchInsert(entities: T[], spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet): BatchOperationResult<T> {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.findSheet(ss);

    if (!sheet) {
      throw new Error(`Sheet not found: ${this.config.sheetName}`);
    }

    if (entities.length === 0) {
      return {
        success: [],
        failed: [],
        successCount: 0,
        failureCount: 0
      };
    }

    // Validate entities before attempting insert
    const validationResults: Array<{ entity: T; valid: boolean; errors: string[] }> = [];
    for (const entity of entities) {
      const validation = entity.validate();
      validationResults.push({
        entity,
        valid: validation.valid,
        errors: validation.errors
      });
    }

    // Separate valid and invalid entities
    const validEntities = validationResults.filter((r) => r.valid).map((r) => r.entity);
    const invalidEntities = validationResults
      .filter((r) => !r.valid)
      .map((r) => ({
        data: r.entity.toSheetRow(),
        error: r.errors.join('; ')
      }));

    if (validEntities.length === 0) {
      // All entities failed validation
      return {
        success: [],
        failed: invalidEntities,
        successCount: 0,
        failureCount: invalidEntities.length
      };
    }

    try {
      // Build and validate column mapping
      const columnMappingResult = this.buildColumnMapping(sheet);
      this.validateColumnMapping(columnMappingResult);

      // Serialize valid entities to sheet values using ACTUAL column order
      const values = validEntities.map((entity) => this.entityToSheetValues(entity, columnMappingResult));

      // Get header row for A1 notation (optimized to read only first row)
      const lastColumn = sheet.getLastColumn();
      if (lastColumn === 0) {
        throw new Error(`Sheet "${sheet.getName()}" has no columns`);
      }

      const headerRange = sheet.getRange(1, 1, 1, lastColumn);
      const headerA1 = headerRange.getA1Notation();

      // Check if Sheets API is available
      if (!Sheets?.Spreadsheets?.Values) {
        throw new Error(
          'Sheets API service is not available. Please enable the Sheets API in your Google Apps Script project.'
        );
      }

      // Append using Sheets API with USER_ENTERED to handle formulas
      Sheets.Spreadsheets.Values.append({ values }, ss.getId(), `${sheet.getName()}!${headerA1}`, {
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS'
      });

      Logger.log('✅ batchInsert: Added %d rows to %s', validEntities.length, sheet.getName());

      return {
        success: validEntities,
        failed: invalidEntities,
        successCount: validEntities.length,
        failureCount: invalidEntities.length
      };
    } catch (error) {
      // If batch insert fails, all valid entities fail
      const errorMessage = error instanceof Error ? error.message : String(error);
      const allFailed = [
        ...invalidEntities,
        ...validEntities.map((entity) => ({
          data: entity.toSheetRow(),
          error: `Batch insert failed: ${errorMessage}`
        }))
      ];

      return {
        success: [],
        failed: allFailed,
        successCount: 0,
        failureCount: allFailed.length
      };
    }
  }

  /**
   * Update existing rows in the sheet with entity data using batch operations
   *
   * This method performs efficient batch updates of existing sheet rows using the Sheets API.
   * It validates entities before updating, uses dynamic column mapping for order-independent
   * updates, and provides graceful degradation with detailed error reporting.
   *
   * **Process**:
   * 1. Validates all entities using their `validate()` method
   * 2. Separates valid and invalid entities
   * 3. Builds dynamic column mapping from actual sheet headers
   * 4. Converts valid entities to sheet values in correct column order
   * 5. Performs batch update via Sheets API (single API call for all rows)
   * 6. Returns result with success/failure details
   *
   * **Column Ordering**: Uses actual sheet header order (via `buildColumnMapping()`),
   * making updates ORDER-INDEPENDENT of config.columnMappings property order.
   *
   * **Error Handling**:
   * - Invalid entities are excluded from batch update but reported in `failed` array
   * - If batch update fails, all entities fail gracefully (none partially updated)
   * - Empty updates array returns empty success result (no-op)
   *
   * **Performance**: Uses Sheets API `batchUpdate` for efficient multi-row updates.
   * All valid rows are updated in a single API call.
   *
   * @param updates - Array of {entity, rowNumber} pairs where:
   *   - `entity`: Domain model instance (must implement DomainModel interface)
   *   - `rowNumber`: 1-based row number in sheet (e.g., 2 for first data row)
   * @param spreadsheet - Google Spreadsheet (optional, uses active spreadsheet if not provided)
   * @returns Batch operation result containing:
   *   - `success`: Array of successfully updated entities
   *   - `failed`: Array of {data, error} for entities that failed validation or update
   *   - `successCount`: Number of rows successfully updated
   *   - `failureCount`: Number of rows that failed
   *
   * @throws Error if sheet is not found
   * @throws Error if Sheets API is not available (enable in Apps Script project settings)
   * @throws Error if column mapping validation fails (missing required columns)
   *
   * @example
   * ```typescript
   * const repo = new BuildQueueRepository();
   * const result = repo.updateRows([
   *   { entity: updatedOrder1, rowNumber: 5 },
   *   { entity: updatedOrder2, rowNumber: 12 }
   * ]);
   * console.log(`Updated ${result.successCount} rows, ${result.failureCount} failed`);
   * result.failed.forEach(f => console.error(f.error));
   * ```
   */
  updateRows(
    updates: Array<{ entity: T; rowNumber: number }>,
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet
  ): BatchOperationResult<T> {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.findSheet(ss);

    if (!sheet) {
      throw new Error(`Sheet not found: ${this.config.sheetName}`);
    }

    if (updates.length === 0) {
      return {
        success: [],
        failed: [],
        successCount: 0,
        failureCount: 0
      };
    }

    // Validate entities before attempting update
    const validationResults: Array<{
      entity: T;
      rowNumber: number;
      valid: boolean;
      errors: string[];
    }> = [];
    for (const { entity, rowNumber } of updates) {
      const validation = entity.validate();
      validationResults.push({
        entity,
        rowNumber,
        valid: validation.valid,
        errors: validation.errors
      });
    }

    // Separate valid and invalid entities
    const validUpdates = validationResults.filter((r) => r.valid);
    const invalidUpdates = validationResults
      .filter((r) => !r.valid)
      .map((r) => ({
        data: r.entity.toSheetRow(),
        error: `Row ${r.rowNumber}: ${r.errors.join('; ')}`
      }));

    if (validUpdates.length === 0) {
      // All entities failed validation
      return {
        success: [],
        failed: invalidUpdates,
        successCount: 0,
        failureCount: invalidUpdates.length
      };
    }

    try {
      // Build and validate column mapping
      const columnMappingResult = this.buildColumnMapping(sheet);
      this.validateColumnMapping(columnMappingResult);

      // Check if Sheets API is available
      if (!Sheets?.Spreadsheets?.Values) {
        throw new Error(
          'Sheets API service is not available. Please enable the Sheets API in your Google Apps Script project.'
        );
      }

      // Perform batch update using Sheets API batchUpdate
      const batchUpdateRequest: GoogleAppsScript.Sheets.Schema.BatchUpdateValuesRequest = {
        valueInputOption: 'USER_ENTERED',
        data: validUpdates.map(({ entity, rowNumber }) => {
          const values = this.entityToSheetValues(entity, columnMappingResult);
          const lastColumn = columnMappingResult.headers.length - 1; // 0-based index for last column

          // Convert row number and column range to A1 notation
          const range = `${sheet.getName()}!A${rowNumber}:${this.columnIndexToLetter(lastColumn)}${rowNumber}`;

          return {
            range,
            values: [values]
          };
        })
      };

      Sheets.Spreadsheets.Values.batchUpdate(batchUpdateRequest, ss.getId());

      Logger.log('✅ updateRows: Updated %d rows in %s', validUpdates.length, sheet.getName());

      return {
        success: validUpdates.map((r) => r.entity),
        failed: invalidUpdates,
        successCount: validUpdates.length,
        failureCount: invalidUpdates.length
      };
    } catch (error) {
      // If batch update fails, all valid entities fail
      const errorMessage = error instanceof Error ? error.message : String(error);
      const allFailed = [
        ...invalidUpdates,
        ...validUpdates.map(({ entity }) => ({
          data: entity.toSheetRow(),
          error: `Batch update failed: ${errorMessage}`
        }))
      ];

      return {
        success: [],
        failed: allFailed,
        successCount: 0,
        failureCount: allFailed.length
      };
    }
  }

  /**
   * Convert 0-based column index to spreadsheet letter (A, B, ..., Z, AA, AB, ...)
   * @param index - 0-based column index
   * @returns Column letter (e.g., 0 → 'A', 25 → 'Z', 26 → 'AA')
   */
  protected columnIndexToLetter(index: number): string {
    let letter = '';
    let num = index + 1; // Convert to 1-based

    while (num > 0) {
      const remainder = (num - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      num = Math.floor((num - 1) / 26);
    }

    return letter;
  }
}

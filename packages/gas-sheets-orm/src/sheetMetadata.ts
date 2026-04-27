/**
 * Sheet Metadata Discovery
 *
 * Dynamically discovers column indices from sheet headers, eliminating the need
 * for hard-coded column indices. Provides caching for performance and supports
 * both table metadata (via Sheets API v4) and direct header reading.
 *
 * Features:
 * - Dynamic column index lookup by header name
 * - Caching to avoid repeated header reads
 * - Table metadata support for structured tables
 * - Fallback to direct header reading
 * - Column validation utilities
 * - Handles hidden columns correctly
 *
 * @module lib/sheetMetadata
 */

/**
 * Cache for column mappings by sheet name
 *
 * Stores column name to 1-based column index mappings to avoid repeated
 * header reads. Cleared when sheet structure changes.
 *
 * Format: { sheetName: { columnName: columnIndex } }
 */
const columnMapCache: Record<string, Record<string, number>> = {};

/**
 * Get column index by header name from a sheet
 *
 * Uses caching to avoid repeated header reads. First attempts to use Sheets API v4
 * table metadata for more reliable results, then falls back to direct header reading.
 * The cache is populated on first access and reused for subsequent lookups.
 *
 * @param sheetName - Name of the sheet
 * @param columnName - Header name to find
 * @returns 1-based column index, or null if not found
 *
 * @example
 * const colIndex = getColumnIndex('Build Queue', 'Customer Name');
 * if (colIndex) {
 *   const range = sheet.getRange(2, colIndex); // Row 2, found column
 * }
 */
export function getColumnIndex(sheetName: string, columnName: string): number | null {
  // Check cache first
  if (!columnMapCache[sheetName]) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      console.error(`Sheet "${sheetName}" not found`);
      return null;
    }

    // Try to use table metadata first (more reliable for tables)
    try {
      if (Sheets?.Spreadsheets) {
        const resp: any = Sheets.Spreadsheets.get(spreadsheet.getId(), {
          fields: 'sheets(properties(title,sheetId),tables(tableId,range,columnProperties))'
        });

        const sheetData: any = resp.sheets.find((s: any) => s.properties.title === sheetName);
        if (sheetData?.tables && sheetData.tables.length > 0) {
          // Use table metadata
          const table = sheetData.tables[0];
          const columnMap: Record<string, number> = {};

          table.columnProperties.forEach((col: any, i: number) => {
            if (col && typeof col.columnName === 'string') {
              const idx = typeof col.columnIndex === 'number' ? col.columnIndex : i;
              const sheetColIndex = table.range.startColumnIndex + idx + 1; // 1-based
              columnMap[col.columnName] = sheetColIndex;
            }
          });

          columnMapCache[sheetName] = columnMap;
          return columnMap[columnName] || null;
        }
      }
    } catch (_err) {
      // Fall through to basic header read
      console.warn(`Could not read table metadata for "${sheetName}", using header row`);
    }

    // Fallback: Read first row (headers) directly
    // Use getMaxColumns() instead of getLastColumn() to include hidden columns
    const maxCol = sheet.getMaxColumns();
    if (maxCol === 0) {
      console.error(`Sheet "${sheetName}" has no columns`);
      return null;
    }

    const headers = sheet.getRange(1, 1, 1, maxCol).getValues()[0];

    // Build column map (skip empty/blank headers)
    const columnMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      // Only include columns with non-empty header values
      if (header !== null && header !== undefined && header !== '') {
        const headerStr = header.toString().trim();
        if (headerStr.length > 0) {
          columnMap[headerStr] = index + 1; // 1-based index
        }
      }
    });

    columnMapCache[sheetName] = columnMap;
  }

  // Return from cache
  return columnMapCache[sheetName][columnName] || null;
}

/**
 * Get all column mappings for a sheet
 *
 * Returns a copy of the cached column map for the specified sheet. Triggers
 * cache population if not already cached. Useful for bulk column lookups
 * or debugging sheet structure.
 *
 * @param sheetName - Name of the sheet
 * @returns Object mapping column names to 1-based indices
 *
 * @example
 * const columns = getColumnMap('Build Queue');
 * console.log(`Available columns: ${Object.keys(columns).join(', ')}`);
 */
export function getColumnMap(sheetName: string): Record<string, number> {
  // Trigger cache population if needed
  getColumnIndex(sheetName, '__dummy__');

  return columnMapCache[sheetName] ? { ...columnMapCache[sheetName] } : {};
}

/**
 * Clear the column map cache
 *
 * Useful when sheet structure changes (columns added, renamed, or reordered).
 * Can clear a specific sheet's cache or all cached sheets.
 *
 * @param sheetName - Optional sheet name to clear (if omitted, clears all)
 *
 * @example
 * // Clear cache for one sheet
 * clearColumnMapCache('Build Queue');
 *
 * @example
 * // Clear all cached column maps
 * clearColumnMapCache();
 */
export function clearColumnMapCache(sheetName?: string): void {
  if (sheetName) {
    delete columnMapCache[sheetName];
  } else {
    // Clear all
    Object.keys(columnMapCache).forEach((key) => {
      delete columnMapCache[key];
    });
  }
}

/**
 * Validate that required columns exist in a sheet
 *
 * Checks if all required column names are present in the sheet's headers.
 * Useful for validating sheet structure before performing operations.
 *
 * @param sheetName - Name of the sheet
 * @param requiredColumns - Array of column names that must exist
 * @returns Object with validation results: {valid: boolean, missing: string[]}
 *
 * @example
 * const result = validateColumns('Build Queue', ['Order Name', 'Customer Name', 'Status']);
 * if (!result.valid) {
 *   throw new Error(`Missing columns: ${result.missing.join(', ')}`);
 * }
 */
export function validateColumns(sheetName: string, requiredColumns: string[]): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const colName of requiredColumns) {
    const index = getColumnIndex(sheetName, colName);
    if (index === null) {
      missing.push(colName);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

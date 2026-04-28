/**
 * ARRAYFORMULA Error Detection and Auto-Fix
 *
 * Detects and fixes ARRAYFORMULA errors caused by blocking data in Google Sheets.
 * Scans for #REF! errors that indicate array expansion failures, identifies the
 * blocking cells, and clears them automatically when safe to do so.
 *
 * Features:
 * - Automatic detection of ARRAYFORMULA expansion errors via Sheets API v4
 * - Intelligent clearing of blocking cells (vertical, horizontal, 2D arrays)
 * - Safety checks: won't delete cells containing formulas
 * - Batch error processing with detailed logging
 * - Manual and automatic fix modes
 * - User feedback via toasts and alerts
 *
 * Architecture:
 * - Uses Sheets API v4 for detailed error messages
 * - Parses error messages to extract blocking cell references
 * - Determines array expansion direction (vertical/horizontal/2D)
 * - Validates clearing ranges before deletion
 * - Forces sheet recalculation after fixes
 *
 * @module lib/arrayFormulaProtection
 */

import { EnhancedLogger } from './enhancedLogger.js';

// Type declaration for Sheets API v4 advanced service
declare const Sheets: GoogleAppsScript.Sheets;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Error detection patterns for ARRAYFORMULA issues
 */
const ERROR_PATTERNS = {
  /** Display value shown for #REF! errors in Google Sheets */
  REF_ERROR_DISPLAY: '#REF!',
  /** Error type in Sheets API v4 response for reference errors */
  REF_ERROR_TYPE: 'REF',
  /** Substring identifying ARRAYFORMULA expansion errors in error messages */
  ARRAY_EXPANSION_ERROR: 'Array result was not expanded',
  /** Regex to extract blocking cell from error message. Handles variable whitespace. */
  OVERWRITE_DATA_PATTERN: /overwrite data in\s+([A-Z]+\d+)/
} as const;

/**
 * Error messages for logging and exceptions
 */
const ERROR_MESSAGES = {
  /** Sheets API v4 advanced service not available */
  SHEETS_API_UNAVAILABLE: 'Sheets API v4 not available - cannot fetch detailed error messages',
  /** Cell reference parsing failed */
  INVALID_CELL_NOTATION: 'Invalid cell notation',
  /** ARRAYFORMULA is blocking itself (same cell error) */
  SAME_CELL_ERROR: 'ARRAYFORMULA may be blocking itself',
  /** Blocking cell in unexpected position relative to error cell */
  UNEXPECTED_BLOCKING_PATTERN: 'Expected blocking cell to be below/right of error cell',
  /** Clearing range contains formulas - manual intervention needed */
  FORMULA_IN_RANGE: 'contains formulas - skipping to avoid deleting formulas'
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a word with correct singular/plural form based on count
 *
 * @param count - The number to check
 * @param singular - The singular form (e.g., "error")
 * @param plural - Optional plural form (defaults to singular + "s")
 * @returns The correctly pluralized word
 *
 * @example
 * pluralize(1, 'error'); // "error"
 * pluralize(5, 'error'); // "errors"
 * pluralize(1, 'child', 'children'); // "child"
 * pluralize(3, 'child', 'children'); // "children"
 */
function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`;
}

/**
 * Escapes single quotes in sheet names for A1 notation
 *
 * Sheet names containing single quotes must have them doubled in A1 notation
 * (e.g., "Bob's Sheet" becomes "Bob''s Sheet").
 *
 * @param sheetName - The sheet name to escape
 * @returns Escaped sheet name (single quotes doubled)
 *
 * @example
 * escapeSheetName("Bob's Sheet"); // "Bob''s Sheet"
 * escapeSheetName("Normal Sheet"); // "Normal Sheet"
 */
function escapeSheetName(sheetName: string): string {
  return sheetName.replace(/'/g, "''");
}

/**
 * Analysis results for a clearing range (cells to be cleared when fixing ARRAYFORMULA errors)
 */
interface CellCounts {
  /** Total number of cells in the range */
  totalCells: number;
  /** Number of cells with non-empty values */
  nonEmptyCells: number;
  /** Number of cells containing formulas */
  formulaCells: number;
  /** Whether any formulas exist in the range */
  hasFormulas: boolean;
}

/**
 * Analyzes a range of cells to determine what it contains before clearing.
 * Used to check if a clearing operation is safe (no formulas would be deleted).
 *
 * @param formulas 2D array of formula strings from getFormulas()
 * @param displayValues 2D array of display values from getDisplayValues()
 * @returns Analysis of the cell range contents
 */
function analyzeClearingRange(formulas: string[][], displayValues: string[][]): CellCounts {
  const totalCells = formulas.length * (formulas[0]?.length || 0);
  let nonEmptyCells = 0;
  let formulaCells = 0;

  for (let r = 0; r < formulas.length; r++) {
    for (let c = 0; c < formulas[r].length; c++) {
      if (formulas[r][c] !== '') {
        formulaCells++;
      }
      if (displayValues[r][c] !== '') {
        nonEmptyCells++;
      }
    }
  }

  return {
    totalCells,
    nonEmptyCells,
    formulaCells,
    hasFormulas: formulaCells > 0
  };
}

/**
 * Direction that an ARRAYFORMULA expands in Google Sheets
 */
enum ExpansionDirection {
  /** Vertical expansion (same column, multiple rows) - most common */
  VERTICAL = 'vertical',
  /** Horizontal expansion (same row, multiple columns) - less common */
  HORIZONTAL = 'horizontal',
  /** 2D expansion (both rows and columns) - rare but possible */
  TWO_DIMENSIONAL = '2d',
  /** Invalid configuration (can't determine or same-cell error) */
  INVALID = 'invalid'
}

/**
 * Result of analyzing ARRAYFORMULA expansion direction
 */
interface ExpansionAnalysis {
  /** The direction the array formula expands */
  direction: ExpansionDirection;
  /** The A1 range to clear (e.g., "V100:V1000"), or null if invalid */
  clearRange: string | null;
  /** Reason why expansion is invalid (only present when direction is INVALID) */
  reason?: string;
}

/**
 * Determines the direction an ARRAYFORMULA expands based on error and blocking cell positions
 *
 * Analyzes the relative positions of the error cell and blocking cell to determine
 * expansion direction. Handles vertical, horizontal, and 2D array expansions.
 * Detects invalid patterns like same-cell errors or unexpected blocking positions.
 *
 * @param errorPos - Position of the cell showing #REF! error
 * @param blockingPos - Position of the cell blocking the array expansion
 * @param lastRow - Last row in the sheet (for range calculation)
 * @param lastCol - Last column in the sheet (for range calculation)
 * @returns Analysis of expansion direction and range to clear
 *
 * @example
 * const analysis = determineExpansionDirection(
 *   {col: 'V', row: 100},
 *   {col: 'V', row: 200},
 *   1000,
 *   50
 * );
 * console.log(analysis.clearRange); // "V200:V1000"
 */
function determineExpansionDirection(
  errorPos: { col: string; row: number },
  blockingPos: { col: string; row: number },
  lastRow: number,
  lastCol: number
): ExpansionAnalysis {
  const errorColNum = columnLetterToNumber(errorPos.col);
  const blockingColNum = columnLetterToNumber(blockingPos.col);

  // Check for same-cell error
  if (errorPos.col === blockingPos.col && errorPos.row === blockingPos.row) {
    return {
      direction: ExpansionDirection.INVALID,
      clearRange: null,
      reason: ERROR_MESSAGES.SAME_CELL_ERROR
    };
  }

  // VERTICAL expansion: Same column, blocking cell below
  if (errorPos.col === blockingPos.col && blockingPos.row > errorPos.row) {
    const clearRange = `${blockingPos.col}${blockingPos.row}:${blockingPos.col}${lastRow}`;
    return { direction: ExpansionDirection.VERTICAL, clearRange };
  }

  // HORIZONTAL expansion: Same row, blocking cell to the right
  if (errorPos.row === blockingPos.row && blockingColNum > errorColNum) {
    const lastColLetter = columnNumberToLetter(lastCol);
    const clearRange = `${blockingPos.col}${blockingPos.row}:${lastColLetter}${blockingPos.row}`;
    return { direction: ExpansionDirection.HORIZONTAL, clearRange };
  }

  // 2D expansion: Blocking cell below and/or to the right
  if (blockingColNum >= errorColNum && blockingPos.row > errorPos.row) {
    const lastColLetter = columnNumberToLetter(lastCol);
    const clearRange = `${blockingPos.col}${blockingPos.row}:${lastColLetter}${lastRow}`;
    return { direction: ExpansionDirection.TWO_DIMENSIONAL, clearRange };
  }

  // Unexpected pattern
  return {
    direction: ExpansionDirection.INVALID,
    clearRange: null,
    reason: `${ERROR_MESSAGES.UNEXPECTED_BLOCKING_PATTERN}: error=${errorPos.col}${errorPos.row}, blocking=${blockingPos.col}${blockingPos.row}`
  };
}

/**
 * Scans a sheet for #REF! errors in display values
 *
 * Reads all cells in the sheet and identifies positions showing #REF! errors.
 * Returns array of error positions with both row/col indices and A1 notation.
 *
 * @param sheet - The sheet to scan
 * @returns Array of error cell positions with A1 notation
 *
 * @example
 * const errors = findErrorCells(sheet);
 * console.log(`Found ${errors.length} #REF! errors`);
 * errors.forEach(e => console.log(`Error at ${e.cellA1}`));
 */
function findErrorCells(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): Array<{ row: number; col: number; cellA1: string }> {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const displayValues = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  const errorCells: Array<{ row: number; col: number; cellA1: string }> = [];

  for (let row = 0; row < displayValues.length; row++) {
    for (let col = 0; col < displayValues[row].length; col++) {
      if (displayValues[row][col] === ERROR_PATTERNS.REF_ERROR_DISPLAY) {
        const cellA1 = sheet.getRange(row + 1, col + 1).getA1Notation();
        errorCells.push({ row, col, cellA1 });
      }
    }
  }

  return errorCells;
}

/**
 * Converts a column number (1-indexed) to a column letter
 *
 * Converts numeric column indices to Excel-style column letters (A, B, ..., Z, AA, AB, ...).
 * Handles multi-letter columns correctly using base-26 arithmetic.
 *
 * @param column - Column number (1-indexed, where 1 = 'A')
 * @returns Column letter(s) (e.g., 1→'A', 27→'AA', 702→'ZZ')
 *
 * @example
 * columnNumberToLetter(1);   // 'A'
 * columnNumberToLetter(26);  // 'Z'
 * columnNumberToLetter(27);  // 'AA'
 * columnNumberToLetter(702); // 'ZZ'
 */
export function columnNumberToLetter(column: number): string {
  let letter = '';
  while (column > 0) {
    const remainder = (column - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    column = Math.floor((column - 1) / 26);
  }
  return letter;
}

/**
 * Converts a column letter to a column number (1-indexed)
 *
 * Converts Excel-style column letters to numeric indices. Handles multi-letter
 * columns correctly using base-26 arithmetic.
 *
 * @param letter - Column letter(s) (e.g., 'A', 'Z', 'AA', 'ZZ')
 * @returns Column number (1-indexed, where 'A' = 1)
 *
 * @example
 * columnLetterToNumber('A');   // 1
 * columnLetterToNumber('Z');   // 26
 * columnLetterToNumber('AA');  // 27
 * columnLetterToNumber('ZZ');  // 702
 */
function columnLetterToNumber(letter: string): number {
  let column = 0;
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column;
}

/**
 * Parses A1 notation into column letter and row number
 *
 * Extracts column letter and row number from A1 notation cell references.
 * Validates format and returns null for invalid references.
 *
 * @param a1 - Cell reference in A1 notation (e.g., "V4386", "AA123")
 * @returns Object with column letter and row number, or null if invalid
 *
 * @example
 * parseA1Notation('V4386'); // {col: 'V', row: 4386}
 * parseA1Notation('AA10');  // {col: 'AA', row: 10}
 * parseA1Notation('invalid'); // null
 */
function parseA1Notation(a1: string): { col: string; row: number } | null {
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    col: match[1],
    row: parseInt(match[2], 10)
  };
}

/**
 * Error scan results interface
 */
interface ErrorScanResult {
  /** Total number of ARRAYFORMULA errors detected */
  totalErrors: number;
  /** Number of errors successfully fixed */
  totalFixed: number;
  /** Detailed information about each error found */
  errorDetails: Array<{ location: string; message: string; blockingCell: string | null }>;
}

/**
 * Gets detailed error information for multiple cells using Sheets API v4
 *
 * Batch fetches error details from Sheets API v4 for efficiency. Extracts error
 * messages from #REF! errors that may contain ARRAYFORMULA blocking information.
 * Falls back gracefully if Sheets API is unavailable.
 *
 * @param spreadsheetId - The spreadsheet ID
 * @param sheetName - The sheet name
 * @param cellRefs - Array of cell references in A1 notation (e.g., ["B2", "C5"])
 * @returns Map of cell reference to error message
 *
 * @example
 * const errorMap = getBatchErrorDetails(ssId, 'Sheet1', ['V100', 'W200']);
 * console.log(errorMap.get('V100')); // Error message for V100
 */
function getBatchErrorDetails(spreadsheetId: string, sheetName: string, cellRefs: string[]): Map<string, string> {
  const errorMap = new Map<string, string>();

  if (cellRefs.length === 0) {
    return errorMap;
  }

  try {
    // Use Sheets API v4 to get detailed error information
    if (!Sheets?.Spreadsheets) {
      EnhancedLogger.logError(new Error(ERROR_MESSAGES.SHEETS_API_UNAVAILABLE), {
        function: 'getBatchErrorDetails',
        module: 'arrayFormulaProtection',
        contextData: { sheetName, cellCount: cellRefs.length }
      });
      return errorMap;
    }

    // Log API batch request
    Logger.log(`    🔍 Fetching error details for ${cellRefs.length} cells in "${sheetName}"`);

    // Build ranges array for batch request
    const escapedSheetName = escapeSheetName(sheetName);
    const ranges = cellRefs.map((cellA1) => `'${escapedSheetName}'!${cellA1}`);

    const obj = Sheets.Spreadsheets.get(spreadsheetId, {
      ranges: ranges,
      fields: 'sheets(data(rowData(values(effectiveValue(errorValue)))))'
    });

    // Process each range in the response
    obj.sheets?.forEach((sheet) => {
      sheet.data?.forEach((data, index) => {
        const cellA1 = cellRefs[index];
        const v = data.rowData?.[0]?.values?.[0];
        if (v?.effectiveValue?.errorValue) {
          const error = v.effectiveValue.errorValue;
          // Store the error message if it's a REF error
          if (error.type === ERROR_PATTERNS.REF_ERROR_TYPE && error.message) {
            errorMap.set(cellA1, error.message);
          }
        }
      });
    });

    Logger.log(`    ✅ Retrieved ${errorMap.size} error messages from Sheets API`);
  } catch (e) {
    EnhancedLogger.logError(e instanceof Error ? e : new Error(String(e)), {
      function: 'getBatchErrorDetails',
      module: 'arrayFormulaProtection',
      contextData: { sheetName, cellCount: cellRefs.length }
    });
  }

  return errorMap;
}

/**
 * Scans all sheets for ARRAYFORMULA errors and optionally fixes them.
 *
 * @param shouldFix - If true, clears blocking cells and forces recalculation.
 *                    If false, only scans and reports (totalFixed will be 0).
 * @returns Scan results with error count and details
 *
 * @example
 * // Scan and fix errors
 * const result = scanAndFixArrayFormulaErrors(true);
 * console.log(`Fixed ${result.totalFixed} of ${result.totalErrors} errors`);
 *
 * @example
 * // Scan only (no fixes)
 * const result = scanAndFixArrayFormulaErrors(false);
 * console.log(`Found ${result.totalErrors} errors (totalFixed will be 0)`);
 */
function scanAndFixArrayFormulaErrors(shouldFix: boolean): ErrorScanResult {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = ss.getId();
  const sheets = ss.getSheets();

  let totalErrors = 0;
  let totalFixed = 0;
  const errorDetails: Array<{ location: string; message: string; blockingCell: string | null }> = [];

  sheets.forEach((sheet) => {
    const sheetResult = scanSheet(sheet, shouldFix, spreadsheetId);
    totalErrors += sheetResult.totalErrors;
    totalFixed += sheetResult.totalFixed;
    errorDetails.push(...sheetResult.errorDetails);
  });

  return { totalErrors, totalFixed, errorDetails };
}

/**
 * Scan a single sheet for ARRAYFORMULA errors and (optionally) fix them.
 *
 * Extracted from `scanAndFixArrayFormulaErrors` to keep cognitive complexity
 * tractable. Returns the per-sheet error counts and details so the caller
 * can aggregate across sheets.
 */
function scanSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  shouldFix: boolean,
  spreadsheetId: string
): ErrorScanResult {
  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const errorDetails: Array<{ location: string; message: string; blockingCell: string | null }> = [];

  if (lastRow < 1 || lastCol < 1) {
    Logger.log(`  ⏭️  Skipping empty sheet: "${sheetName}" (no data)`);
    return { totalErrors: 0, totalFixed: 0, errorDetails };
  }

  Logger.log(`  🔍 Scanning sheet: "${sheetName}" (${lastRow} rows × ${lastCol} columns)`);

  let totalErrors = 0;
  let totalFixed = 0;

  try {
    const errorCells = findErrorCells(sheet);

    if (errorCells.length > 0) {
      Logger.log(
        `  📍 Found ${errorCells.length} ${ERROR_PATTERNS.REF_ERROR_DISPLAY} ${pluralize(errorCells.length, 'error')} in "${sheetName}"`
      );
    }

    const cellRefs = errorCells.map((ec) => ec.cellA1);
    const errorMessages = getBatchErrorDetails(spreadsheetId, sheetName, cellRefs);

    for (const errorCell of errorCells) {
      const result = processErrorCell({
        sheet,
        sheetName,
        errorCell,
        errorMessage: errorMessages.get(errorCell.cellA1),
        shouldFix,
        lastRow,
        lastCol
      });
      totalErrors += result.errorCount;
      totalFixed += result.fixedCount;
      if (result.detail) errorDetails.push(result.detail);
    }

    if (shouldFix && totalFixed > 0) {
      Logger.log(`  🔄 Forcing recalculation for sheet "${sheetName}"`);
      SpreadsheetApp.flush();
    }
  } catch (e) {
    EnhancedLogger.logError(e instanceof Error ? e : new Error(String(e)), {
      function: 'scanAndFixArrayFormulaErrors',
      module: 'arrayFormulaProtection',
      contextData: { sheetName, operation: 'sheet scan' }
    });
  }

  return { totalErrors, totalFixed, errorDetails };
}

interface ProcessErrorCellInput {
  sheet: GoogleAppsScript.Spreadsheet.Sheet;
  sheetName: string;
  errorCell: { cellA1: string };
  errorMessage: string | undefined;
  shouldFix: boolean;
  lastRow: number;
  lastCol: number;
}

interface ProcessErrorCellResult {
  errorCount: 0 | 1;
  fixedCount: 0 | 1;
  detail: { location: string; message: string; blockingCell: string | null } | null;
}

/**
 * Classify and (optionally) fix one cell flagged as a #REF! error.
 *
 * Returns counts so the caller can aggregate without exposing internal state.
 * Cells whose error is not an ARRAYFORMULA expansion error are no-ops.
 */
function processErrorCell(input: ProcessErrorCellInput): ProcessErrorCellResult {
  const { sheet, sheetName, errorCell, errorMessage, shouldFix, lastRow, lastCol } = input;

  Logger.log(`  🔍 Error at ${errorCell.cellA1}: ${errorMessage ? `"${errorMessage}"` : '(no message)'}`);

  if (!errorMessage?.includes(ERROR_PATTERNS.ARRAY_EXPANSION_ERROR)) {
    return { errorCount: 0, fixedCount: 0, detail: null };
  }

  const location = `${sheetName}!${errorCell.cellA1}`;
  // Regex depends on Google Sheets' error format:
  // "Array result was not expanded because it would overwrite data in  V4387."
  const match = errorMessage.match(ERROR_PATTERNS.OVERWRITE_DATA_PATTERN);
  const blockingCellA1 = match ? match[1] : null;

  Logger.log(`  📍 Detected ARRAYFORMULA error: ${location}, blocking cell: ${blockingCellA1 || 'unknown'}`);
  const detail = { location, message: errorMessage, blockingCell: blockingCellA1 };

  if (!shouldFix || !blockingCellA1) {
    return { errorCount: 1, fixedCount: 0, detail };
  }

  const fixed = tryFixArrayFormulaError(
    sheet,
    sheetName,
    errorCell.cellA1,
    blockingCellA1,
    errorMessage,
    lastRow,
    lastCol
  );
  return { errorCount: 1, fixedCount: fixed ? 1 : 0, detail };
}

/**
 * Attempt to clear the blocking range for one ARRAYFORMULA error.
 *
 * Returns `true` if the blocking region was successfully cleared (and the
 * caller should increment `totalFixed`), `false` otherwise. All logging and
 * error capture is handled internally — failures are reported via
 * `EnhancedLogger.logError` rather than propagated.
 */
function tryFixArrayFormulaError(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  sheetName: string,
  errorCellA1: string,
  blockingCellA1: string,
  errorMessage: string,
  lastRow: number,
  lastCol: number
): boolean {
  try {
    const errorPos = parseA1Notation(errorCellA1);
    const blockingPos = parseA1Notation(blockingCellA1);

    if (!errorPos || !blockingPos) {
      Logger.log(
        `    ⚠️  ${ERROR_MESSAGES.INVALID_CELL_NOTATION} in "${sheetName}": error=${errorCellA1}, blocking=${blockingCellA1}. ` +
          `Error message: "${errorMessage}"`
      );
      return false;
    }

    const expansion = determineExpansionDirection(errorPos, blockingPos, lastRow, lastCol);
    if (expansion.direction === ExpansionDirection.INVALID || !expansion.clearRange) {
      Logger.log(`    ⚠️  ${expansion.reason ?? 'No clear range computed'}. Manual intervention needed.`);
      return false;
    }

    const clearRange = expansion.clearRange;
    Logger.log(`    🧹 Detected ${expansion.direction} ARRAYFORMULA, clearing: ${sheetName}!${clearRange}`);

    const clearingRange = sheet.getRange(clearRange);
    const analysis = analyzeClearingRange(clearingRange.getFormulas(), clearingRange.getDisplayValues());

    Logger.log(
      `    📊 Clearing range "${sheetName}!${clearRange}": ` +
        `${analysis.totalCells} total cells, ${analysis.nonEmptyCells} non-empty, ${analysis.formulaCells} formulas`
    );

    if (analysis.hasFormulas) {
      Logger.log(
        `    ⚠️  Blocking region in "${sheetName}" ${ERROR_MESSAGES.FORMULA_IN_RANGE}. ` +
          `Found ${analysis.formulaCells} ${pluralize(analysis.formulaCells, 'formula')}. Manual intervention needed.`
      );
      return false;
    }

    Logger.log(`    🧹 Safe to clear (no formulas in range)`);
    clearingRange.clearContent();
    Logger.log(
      `    ✅ Cleared ${analysis.nonEmptyCells} non-empty ${pluralize(analysis.nonEmptyCells, 'cell')} in blocking region "${sheetName}!${clearRange}"`
    );
    return true;
  } catch (e) {
    EnhancedLogger.logError(e instanceof Error ? e : new Error(String(e)), {
      function: 'scanAndFixArrayFormulaErrors',
      module: 'arrayFormulaProtection',
      contextData: { sheetName, blockingCell: blockingCellA1, errorCell: errorCellA1 }
    });
    return false;
  }
}

/**
 * Detects and fixes ARRAYFORMULA errors (called automatically on edit)
 *
 * Entry point for automatic error fixing triggered by sheet edit events.
 * Scans all sheets, fixes errors where safe, and provides user feedback via toast.
 * Only shows toast when errors are actually fixed to avoid notification spam.
 *
 * @example
 * // Called automatically from onEdit trigger
 * function onEdit(e) {
 *   fixArrayFormulaErrors();
 * }
 */
export function fixArrayFormulaErrors(): void {
  Logger.log('🔍 Scanning for ARRAYFORMULA errors...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = scanAndFixArrayFormulaErrors(true);

  // Log detailed summary
  Logger.log(`\n📊 ARRAYFORMULA Error Detection Summary:`);
  Logger.log(`   Total errors found: ${result.totalErrors}`);
  Logger.log(`   Successfully fixed: ${result.totalFixed}`);
  Logger.log(`   Failed to fix: ${result.totalErrors - result.totalFixed}`);

  if (result.errorDetails.length > 0) {
    Logger.log(`\n📍 Error locations:`);
    result.errorDetails.forEach((detail) => {
      Logger.log(`   - ${detail.location}: ${detail.message}`);
    });
  }

  // Only show toast if we actually fixed something (avoid spam on every edit)
  if (result.totalFixed > 0) {
    const message =
      result.totalErrors === result.totalFixed
        ? `Fixed ${result.totalFixed} ARRAYFORMULA ${pluralize(result.totalFixed, 'error')}`
        : `Fixed ${result.totalFixed} of ${result.totalErrors} ARRAYFORMULA ${pluralize(result.totalErrors, 'error')}`;
    ss.toast(message, 'Auto-Fixed', 3);
  }
}

/**
 * Manual fix for ARRAYFORMULA errors with detailed user feedback
 *
 * Use this from the menu for interactive error fixing with full reporting.
 * Provides detailed alerts showing all errors found and fixed, with explanations
 * for errors that couldn't be automatically fixed (e.g., formulas in blocking cells).
 *
 * @example
 * // Add to menu in onOpen
 * function onOpen() {
 *   SpreadsheetApp.getUi()
 *     .createMenu('Tools')
 *     .addItem('Fix Array Formula Errors', 'manualFixArrayFormulaErrors')
 *     .addToUi();
 * }
 */
export function manualFixArrayFormulaErrors(): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  Logger.log('🔍 Manual ARRAYFORMULA error scan initiated...');
  ss.toast('Scanning for ARRAYFORMULA errors...', 'Please wait', -1);

  // Scan and fix all detected errors
  const fixResult = scanAndFixArrayFormulaErrors(true);

  Logger.log(`\n📊 Fix Summary:`);
  Logger.log(`   Errors found: ${fixResult.totalErrors}`);
  Logger.log(`   Successfully fixed: ${fixResult.totalFixed}`);
  Logger.log(`   Failed to fix: ${fixResult.totalErrors - fixResult.totalFixed}`);
  Logger.log('✅ Manual ARRAYFORMULA error scan completed');

  // Show user-friendly summary
  if (fixResult.totalErrors === 0) {
    // No errors found at all
    ss.toast('✅ No ARRAYFORMULA errors found', 'All Clear', 5);
    ui.alert(
      'ARRAYFORMULA Error Check',
      '✅ No ARRAYFORMULA errors detected in any sheet.\n\n' + 'All array formulas are expanding correctly.',
      ui.ButtonSet.OK
    );
  } else if (fixResult.totalFixed === fixResult.totalErrors) {
    // All errors were successfully fixed
    ss.toast(`✅ Fixed ${fixResult.totalFixed} ${pluralize(fixResult.totalFixed, 'error')}`, 'Success', 5);
    ui.alert(
      'ARRAYFORMULA Errors Fixed',
      `✅ Successfully fixed ${fixResult.totalFixed} ARRAYFORMULA ${pluralize(fixResult.totalFixed, 'error')}!\n\n` +
        `All blocking cells have been cleared and array formulas are now expanding correctly.`,
      ui.ButtonSet.OK
    );
  } else {
    // Some errors could not be fixed (e.g., formulas in blocking cells)
    const unfixedCount = fixResult.totalErrors - fixResult.totalFixed;
    const errorList = fixResult.errorDetails
      .slice(0, 10)
      .map((e) => `${e.location} → ${e.blockingCell || 'unknown blocking cell'}`)
      .join('\n');
    const moreErrors =
      fixResult.errorDetails.length > 10 ? `\n\n...and ${fixResult.errorDetails.length - 10} more` : '';

    ss.toast(
      `⚠️ ${unfixedCount} ARRAYFORMULA ${pluralize(unfixedCount, 'error')} could not be fixed`,
      'Errors Found',
      5
    );
    ui.alert(
      'ARRAYFORMULA Errors Detected',
      `⚠️ Fixed ${fixResult.totalFixed} of ${fixResult.totalErrors} ARRAYFORMULA ${pluralize(fixResult.totalErrors, 'error')}.\n\n` +
        `${unfixedCount} ${pluralize(unfixedCount, 'error')} could not be fixed automatically:\n\n${errorList}${moreErrors}\n\n` +
        'These errors occur when data blocks array formula expansion.\n' +
        'Some blocking cells may contain formulas and require manual review.',
      ui.ButtonSet.OK
    );
  }
}

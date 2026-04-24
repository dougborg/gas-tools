/**
 * Visual Feedback Utilities for Google Sheets
 *
 * Provides visual feedback mechanisms for user operations in Google Sheets through
 * temporary background color changes (flashing). Useful for confirming actions,
 * indicating success/error states, and improving user experience.
 *
 * Features:
 * - Generic range flashing with customizable colors and duration
 * - Row-based flashing for full-width feedback
 * - Quick flash variants for batch operations
 * - Predefined success/error color schemes
 * - Automatic background reset after flash duration
 *
 * @module lib/visualFeedback
 */

/**
 * Generic flash function for providing visual feedback
 *
 * Temporarily changes a range's background color, then resets it. Uses SpreadsheetApp.flush()
 * to ensure visual updates are rendered immediately.
 *
 * @param range - The range to flash
 * @param color - The color to flash (null resets to default)
 * @param duration - Duration in milliseconds (default: 100ms)
 *
 * @example
 * const range = sheet.getRange('A1:B5');
 * flashRange(range, '#FFD700', 200); // Flash gold for 200ms
 */
export function flashRange(range: GoogleAppsScript.Spreadsheet.Range, color: string, duration: number = 100): void {
  range.setBackground(color);
  SpreadsheetApp.flush();
  Utilities.sleep(duration);
  range.setBackground(null);
  SpreadsheetApp.flush();
}

/**
 * Fast flash with reduced timing for individual operations
 *
 * Optimized version of flashRange for batch operations where multiple
 * flashes occur in sequence. Uses 75ms duration for faster feedback.
 *
 * @param range - The range to flash
 * @param color - The color to flash
 *
 * @example
 * // Flash multiple rows quickly in a loop
 * rows.forEach(row => quickFlash(sheet.getRange(row, 1, 1, 10), '#C8E6C9'));
 */
export function quickFlash(range: GoogleAppsScript.Spreadsheet.Range, color: string): void {
  flashRange(range, color, 75); // Faster flash for batch operations
}

/**
 * Flashes an entire row with a specific color
 *
 * Provides feedback for row-level operations by flashing the full width of a row.
 * Automatically determines the row width from the sheet's last column.
 *
 * @param sheet - The sheet containing the row
 * @param row - The row number to flash (1-indexed)
 * @param color - The color to flash
 * @param duration - Duration in milliseconds (default: 100ms)
 *
 * @example
 * flashRow(sheet, 5, '#C8E6C9', 150); // Flash row 5 green for 150ms
 */
export function flashRow(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  row: number,
  color: string,
  duration: number = 100
): void {
  const numCols = sheet.getLastColumn();
  const rowRange = sheet.getRange(row, 1, 1, numCols);
  flashRange(rowRange, color, duration);
}

/**
 * Flashes a row green to indicate success
 *
 * Convenience function for success feedback with predefined light green color (#C8E6C9).
 * Uses standard 100ms duration.
 *
 * @param sheet - The sheet containing the row
 * @param row - The row number to flash (1-indexed)
 *
 * @example
 * flashRowSuccess(sheet, 3); // Flash row 3 green
 */
export function flashRowSuccess(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number): void {
  flashRow(sheet, row, '#C8E6C9', 100); // Light green
}

/**
 * Flashes a row red to indicate error
 *
 * Convenience function for error feedback with predefined light red color (#FFCDD2).
 * Uses standard 100ms duration.
 *
 * @param sheet - The sheet containing the row
 * @param row - The row number to flash (1-indexed)
 *
 * @example
 * flashRowError(sheet, 7); // Flash row 7 red
 */
export function flashRowError(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number): void {
  flashRow(sheet, row, '#FFCDD2', 100); // Light red
}

/**
 * Quick flash for a row (faster, for batch operations)
 *
 * Optimized row flash for batch operations with 75ms duration. Use when
 * flashing multiple rows in sequence to reduce total execution time.
 *
 * @param sheet - The sheet containing the row
 * @param row - The row number to flash (1-indexed)
 * @param color - The color to flash
 *
 * @example
 * // Flash multiple rows quickly
 * [3, 5, 7].forEach(row => quickFlashRow(sheet, row, '#C8E6C9'));
 */
export function quickFlashRow(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number, color: string): void {
  flashRow(sheet, row, color, 75);
}

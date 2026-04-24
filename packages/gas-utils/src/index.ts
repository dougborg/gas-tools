/**
 * @dougborg/gas-utils — Runtime helpers for Google Apps Script projects.
 *
 * Three independent concerns, each also available as a subpath import:
 *  - structured logging (enhancedLogger)
 *  - visual cell feedback for Sheets (visualFeedback)
 *  - ARRAYFORMULA error detection and auto-fix (arrayFormulaProtection)
 */

export { columnNumberToLetter, fixArrayFormulaErrors, manualFixArrayFormulaErrors } from './arrayFormulaProtection.js';
export { EnhancedLogger, withSheetErrorHandling, withShopifyErrorHandling } from './enhancedLogger.js';
export * from './visualFeedback.js';

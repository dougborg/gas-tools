import { InputValidationError } from './sheet-orm/errors.js';

const SHEET_NAME_MAX_LENGTH = 100;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f]/;

/**
 * Generic input validation helpers retained by the toolkit.
 *
 * Domain-specific validators (SKU, quantity, etc.) live in consumer
 * modules and register themselves with `defaultValidatorRegistry`.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: kept as a class so consumer code can keep calling InputSanitizer.validateSheetName without a broader import refactor.
export class InputSanitizer {
  /**
   * Validates sheet names pulled from the SpreadsheetApp API.
   */
  static validateSheetName(name: string | null | undefined): string {
    const trimmed = name?.trim();

    if (!trimmed) {
      throw new InputValidationError('Sheet name is required', 'sheetName', name);
    }

    if (trimmed.length > SHEET_NAME_MAX_LENGTH) {
      throw new InputValidationError(
        `Sheet names must be <= ${SHEET_NAME_MAX_LENGTH} characters`,
        'sheetName',
        trimmed
      );
    }

    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
      throw new InputValidationError('Sheet names cannot contain path traversal characters', 'sheetName', trimmed);
    }

    if (CONTROL_CHAR_PATTERN.test(trimmed)) {
      throw new InputValidationError('Sheet names cannot contain control characters', 'sheetName', trimmed);
    }

    return trimmed;
  }
}

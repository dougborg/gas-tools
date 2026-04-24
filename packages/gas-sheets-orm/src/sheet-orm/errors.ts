/**
 * Sheet ORM Error Classes
 *
 * Standardized error types for the Sheet ORM abstraction layer.
 * Provides consistent error handling, error codes, and structured details.
 */

/**
 * Error codes for ORM operations
 */
export enum SheetOrmErrorCode {
  // Schema errors (1000-1099)
  SCHEMA_NOT_FOUND = 1000,
  SCHEMA_INVALID = 1001,
  SCHEMA_MISMATCH = 1002,

  // Sheet errors (1100-1199)
  SHEET_NOT_FOUND = 1100,
  SHEET_ACCESS_DENIED = 1101,
  SHEET_LOCKED = 1102,
  SHEET_INVALID_NAME = 1103,

  // Column errors (1200-1299)
  COLUMN_NOT_FOUND = 1200,
  COLUMN_MAPPING_FAILED = 1201,
  COLUMN_REQUIRED_MISSING = 1202,
  COLUMN_TYPE_MISMATCH = 1203,
  COLUMN_DUPLICATE = 1204,

  // Data validation errors (1300-1399)
  VALIDATION_FAILED = 1300,
  VALIDATION_REQUIRED_FIELD = 1301,
  VALIDATION_TYPE_ERROR = 1302,
  VALIDATION_CONSTRAINT = 1303,
  VALIDATION_CUSTOM = 1304,
  INPUT_VALIDATION_ERROR = 1305,

  // Data transformation errors (1400-1499)
  TRANSFORM_FAILED = 1400,
  TRANSFORM_TYPE_CONVERSION = 1401,
  TRANSFORM_PARSE_ERROR = 1402,

  // CRUD operation errors (1500-1599)
  OPERATION_FAILED = 1500,
  OPERATION_INSERT_FAILED = 1501,
  OPERATION_UPDATE_FAILED = 1502,
  OPERATION_DELETE_FAILED = 1503,
  OPERATION_READ_FAILED = 1504,

  // Batch operation errors (1600-1699)
  BATCH_PARTIAL_FAILURE = 1600,
  BATCH_COMPLETE_FAILURE = 1601,
  BATCH_TOO_LARGE = 1602,

  // Query errors (1700-1799)
  QUERY_INVALID = 1700,
  QUERY_SYNTAX_ERROR = 1701,
  QUERY_FILTER_ERROR = 1702,

  // Domain model errors (1800-1899)
  MODEL_INVALID = 1800,
  MODEL_MISSING_FIELD = 1801,
  MODEL_CONSTRAINT_VIOLATION = 1802,

  // API errors (1900-1999)
  API_RATE_LIMIT = 1900,
  API_QUOTA_EXCEEDED = 1901,
  API_TIMEOUT = 1902,
  API_NETWORK_ERROR = 1903,

  // Katana API errors (2000-2099)
  KATANA_API_ERROR = 2000,
  KATANA_API_NOT_FOUND = 2001,
  KATANA_API_VALIDATION_ERROR = 2002,
  KATANA_API_AUTH_ERROR = 2003,
  KATANA_API_PAGINATION_ERROR = 2004
}

/**
 * Base error class for Sheet ORM
 */
export abstract class SheetOrmError extends Error {
  /** Error code for programmatic handling */
  readonly code: SheetOrmErrorCode;

  /** Structured details about the error */
  readonly details: Record<string, any>;

  /** Original error if this wraps another error */
  readonly cause?: Error;

  constructor(message: string, code: SheetOrmErrorCode, details: Record<string, any> = {}, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (only on V8).
    // Cast avoids a hard dep on @types/node for the V8-only API.
    const err = Error as unknown as {
      captureStackTrace?: (target: object, constructorOpt?: Function) => void;
    };
    if (err.captureStackTrace) {
      err.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/reporting
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
      cause: this.cause?.message
    };
  }

  /**
   * Get user-friendly error message
   */
  abstract getUserMessage(): string;
}

/**
 * Schema-related errors
 */
export class SchemaError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.SCHEMA_INVALID,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.SCHEMA_NOT_FOUND:
        return `Schema "${this.details.schemaName}" not found. Please check the schema registry.`;
      case SheetOrmErrorCode.SCHEMA_MISMATCH:
        return `Sheet structure does not match schema "${this.details.schemaName}". Expected columns: ${this.details.expected}.`;
      default:
        return this.message;
    }
  }
}

/**
 * Sheet-related errors
 */
export class SheetError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.SHEET_NOT_FOUND,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.SHEET_NOT_FOUND:
        return `Sheet "${this.details.sheetName}" not found. Please check the sheet name and try again.`;
      case SheetOrmErrorCode.SHEET_ACCESS_DENIED:
        return `Access denied to sheet "${this.details.sheetName}". Please check permissions.`;
      case SheetOrmErrorCode.SHEET_LOCKED:
        return `Sheet "${this.details.sheetName}" is locked. Please wait and try again.`;
      default:
        return this.message;
    }
  }
}

/**
 * Column-related errors
 */
export class ColumnError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.COLUMN_NOT_FOUND,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.COLUMN_NOT_FOUND:
        return `Column "${this.details.columnName}" not found in sheet. Available columns: ${this.details.availableColumns?.join(', ')}.`;
      case SheetOrmErrorCode.COLUMN_REQUIRED_MISSING: {
        const missing = this.details.missingColumns?.join(', ') || this.details.columnName;
        return `Required column(s) missing: ${missing}. Please add them to the sheet.`;
      }
      case SheetOrmErrorCode.COLUMN_TYPE_MISMATCH:
        return `Column "${this.details.columnName}" has wrong type. Expected ${this.details.expectedType}, got ${this.details.actualType}.`;
      default:
        return this.message;
    }
  }
}

/**
 * Validation errors
 */
export class ValidationError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.VALIDATION_FAILED,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.VALIDATION_REQUIRED_FIELD:
        return `Required field "${this.details.fieldName}" is missing or empty.`;
      case SheetOrmErrorCode.VALIDATION_TYPE_ERROR:
        return `Field "${this.details.fieldName}" has invalid type. Expected ${this.details.expectedType}.`;
      case SheetOrmErrorCode.VALIDATION_CONSTRAINT:
        return `Field "${this.details.fieldName}" violates constraint: ${this.details.constraint}`;
      case SheetOrmErrorCode.VALIDATION_FAILED:
        if (this.details.errors && Array.isArray(this.details.errors)) {
          return `Validation failed:\n${this.details.errors.map((e: string) => `  • ${e}`).join('\n')}`;
        }
        return this.message;
      default:
        return this.message;
    }
  }
}

/**
 * Input validation errors (user-provided data)
 */
export class InputValidationError extends SheetOrmError {
  constructor(message: string, field: string, value: unknown) {
    super(message, SheetOrmErrorCode.INPUT_VALIDATION_ERROR, { field, value });
  }

  getUserMessage(): string {
    return `${this.details.field ? `Invalid value for "${this.details.field}"` : 'Invalid input'}: ${this.message}`;
  }
}

/**
 * Data transformation errors
 */
export class TransformError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.TRANSFORM_FAILED,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.TRANSFORM_TYPE_CONVERSION:
        return `Failed to convert "${this.details.value}" to ${this.details.targetType} for field "${this.details.fieldName}".`;
      case SheetOrmErrorCode.TRANSFORM_PARSE_ERROR:
        return `Failed to parse value for field "${this.details.fieldName}": ${this.details.parseError}`;
      default:
        return this.message;
    }
  }
}

/**
 * CRUD operation errors
 */
export class OperationError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.OPERATION_FAILED,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.OPERATION_INSERT_FAILED:
        return `Failed to insert row: ${this.details.reason || this.message}`;
      case SheetOrmErrorCode.OPERATION_UPDATE_FAILED:
        return `Failed to update row: ${this.details.reason || this.message}`;
      case SheetOrmErrorCode.OPERATION_DELETE_FAILED:
        return `Failed to delete row: ${this.details.reason || this.message}`;
      case SheetOrmErrorCode.OPERATION_READ_FAILED:
        return `Failed to read data: ${this.details.reason || this.message}`;
      default:
        return this.message;
    }
  }
}

/**
 * Batch operation errors
 */
export class BatchOperationError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.BATCH_PARTIAL_FAILURE,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.BATCH_PARTIAL_FAILURE:
        return `Batch operation partially failed: ${this.details.successCount} succeeded, ${this.details.failureCount} failed.`;
      case SheetOrmErrorCode.BATCH_COMPLETE_FAILURE:
        return `Batch operation completely failed: ${this.message}`;
      case SheetOrmErrorCode.BATCH_TOO_LARGE:
        return `Batch size (${this.details.size}) exceeds maximum (${this.details.maxSize}).`;
      default:
        return this.message;
    }
  }
}

/**
 * Query errors
 */
export class QueryError extends SheetOrmError {
  constructor(message: string, code: SheetOrmErrorCode = SheetOrmErrorCode.QUERY_INVALID, details = {}, cause?: Error) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.QUERY_SYNTAX_ERROR:
        return `Invalid query syntax: ${this.message}`;
      case SheetOrmErrorCode.QUERY_FILTER_ERROR:
        return `Invalid filter for field "${this.details.fieldName}": ${this.details.reason}`;
      default:
        return this.message;
    }
  }
}

/**
 * Domain model errors
 */
export class ModelError extends SheetOrmError {
  constructor(message: string, code: SheetOrmErrorCode = SheetOrmErrorCode.MODEL_INVALID, details = {}, cause?: Error) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.MODEL_MISSING_FIELD:
        return `Required field "${this.details.fieldName}" is missing in model.`;
      case SheetOrmErrorCode.MODEL_CONSTRAINT_VIOLATION:
        return `Model constraint violated: ${this.details.constraint}`;
      default:
        return this.message;
    }
  }
}

/**
 * API-related errors
 */
export class ApiError extends SheetOrmError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.API_NETWORK_ERROR,
    details = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.API_RATE_LIMIT:
        return `API rate limit exceeded. Please wait ${this.details.retryAfter || '60'} seconds and try again.`;
      case SheetOrmErrorCode.API_QUOTA_EXCEEDED:
        return `API quota exceeded. Daily limit: ${this.details.dailyLimit}.`;
      case SheetOrmErrorCode.API_TIMEOUT:
        return `API request timed out after ${this.details.timeout}ms.`;
      default:
        return this.message;
    }
  }
}

/**
 * Wrap an unknown error into a SheetOrmError
 *
 * Converts any error (Error, string, unknown) into a standardized SheetOrmError.
 * If the error is already a SheetOrmError, returns it unchanged. Otherwise,
 * wraps it in an OperationError with the provided default message and code.
 *
 * @param error Unknown error to wrap (Error, string, or any value)
 * @param defaultMessage Default message prefix if error is not an Error instance
 * @param code Error code to assign to the wrapped error
 * @returns SheetOrmError instance (original if already SheetOrmError, wrapped otherwise)
 *
 * @example
 * try {
 *   // Some operation that might throw
 * } catch (error) {
 *   const wrapped = wrapError(error, 'Operation failed', SheetOrmErrorCode.OPERATION_FAILED);
 *   logger.error(wrapped);
 * }
 */
export function wrapError(error: unknown, defaultMessage: string, code: SheetOrmErrorCode): SheetOrmError {
  if (error instanceof SheetOrmError) {
    return error;
  }

  const cause = error instanceof Error ? error : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return new OperationError(`${defaultMessage}: ${message}`, code, {}, cause);
}

/**
 * Katana API-specific errors
 */
export class KatanaAPIError extends ApiError {
  constructor(
    message: string,
    code: SheetOrmErrorCode = SheetOrmErrorCode.KATANA_API_ERROR,
    details: Record<string, any> = {},
    cause?: Error
  ) {
    super(message, code, details, cause);
  }

  getUserMessage(): string {
    switch (this.code) {
      case SheetOrmErrorCode.KATANA_API_NOT_FOUND:
        return `Katana API: Resource not found. ${this.details.resource ? `Resource: ${this.details.resource}` : ''}`;
      case SheetOrmErrorCode.KATANA_API_VALIDATION_ERROR:
        return `Katana API validation error: ${this.details.validationError || this.message}`;
      case SheetOrmErrorCode.KATANA_API_AUTH_ERROR:
        return `Katana API authentication failed. Please check your API key configuration.`;
      case SheetOrmErrorCode.KATANA_API_PAGINATION_ERROR:
        return `Katana API pagination error: ${this.message}`;
      case SheetOrmErrorCode.API_RATE_LIMIT:
        return `Katana API rate limit exceeded. Please wait ${this.details.retryAfter || '60'} seconds and try again.`;
      case SheetOrmErrorCode.API_TIMEOUT:
        return `Katana API request timed out after ${this.details.timeout}ms.`;
      default:
        return `Katana API error: ${this.message}`;
    }
  }
}

/**
 * Helper to create validation error from multiple errors
 */
export function createValidationError(errors: string[], details: Record<string, any> = {}): ValidationError {
  const message = errors.length === 1 ? errors[0] : `${errors.length} validation errors`;
  return new ValidationError(message, SheetOrmErrorCode.VALIDATION_FAILED, {
    ...details,
    errors,
    errorCount: errors.length
  });
}

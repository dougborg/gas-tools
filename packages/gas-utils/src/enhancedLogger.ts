/**
 * Enhanced Logging Utilities for Google Apps Script
 *
 * Provides structured logging with error tracking, context capture, and
 * automatic function wrapping for Google Apps Script environment.
 *
 * Features:
 * - Type-safe error handling with severity levels
 * - Automatic context capture (function, module, timestamp, session)
 * - Sensitive data redaction (passwords, tokens, API keys)
 * - Error storage in CacheService for debugging
 * - Function wrapping with automatic entry/exit logging
 * - Result summarization for large objects
 *
 * @module lib/enhancedLogger
 */

/**
 * Error severity levels for categorizing log messages
 */
export type ErrorSeverity = 'info' | 'warn' | 'error' | 'critical';

/**
 * Context information captured with each error
 */
interface ErrorContext {
  /** Name of the function where error occurred */
  function: string;
  /** Name of the module/file where error occurred */
  module: string;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Stack trace from the error */
  stackTrace?: string;
  /** Additional context data relevant to the error */
  contextData?: Record<string, unknown>;
  /** Unique session identifier for log correlation */
  sessionId?: string;
}

/**
 * Enhanced logger with structured error tracking and context capture
 *
 * Provides comprehensive logging capabilities for Google Apps Script with:
 * - Automatic session ID generation for log correlation
 * - Error context capture with module and function names
 * - Sensitive data redaction for security
 * - Error storage for post-mortem debugging
 * - Function wrapping for automatic instrumentation
 */
// biome-ignore lint/complexity/noStaticOnlyClass: EnhancedLogger is the package's public namespace API (`EnhancedLogger.log(...)`); converting to free functions would be a breaking change for consumers.
export class EnhancedLogger {
  // Lazily-evaluated session identifier with fallback when Utilities.getUuid is unavailable in tests
  private static sessionId: string = (() => {
    try {
      if (typeof Utilities !== 'undefined' && typeof (Utilities as any).getUuid === 'function') {
        const id = (Utilities as any).getUuid();
        if (typeof id === 'string' && id) return id;
      }
    } catch {
      // ignore – fallback below
    }
    // Fallback: lightweight pseudo-UUID good enough for log correlation
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  })();

  /**
   * Safely extracts error message from unknown error type
   *
   * Handles various error types including Error objects, objects with
   * message properties, and primitive values.
   *
   * @param error Error of unknown type to extract message from
   * @returns Human-readable error message string
   *
   * @example
   * const msg = EnhancedLogger.getErrorMessage(new Error('Failed'));
   * console.log(msg); // "Failed"
   */
  static getErrorMessage(error: unknown): string {
    try {
      if (error instanceof Error) return error.message;
      if (typeof error === 'object' && error && 'message' in (error as any)) {
        const msg = (error as any).message;
        return typeof msg === 'string' ? msg : JSON.stringify(msg);
      }
      return String(error);
    } catch {
      return 'Unknown error';
    }
  }

  /**
   * Logs an error with enhanced context information
   *
   * Captures full error context including module, function, timestamp,
   * and session ID. For errors with 'error' or 'critical' severity,
   * stores the error in CacheService for debugging.
   *
   * @param error Error of any type to log
   * @param context Partial context information (function, module, contextData)
   * @param severity Severity level for the error (default: 'error')
   *
   * @example
   * try {
   *   // risky operation
   * } catch (error) {
   *   EnhancedLogger.logError(error, {
   *     function: 'processOrder',
   *     module: 'pullOrders',
   *     contextData: { orderId: 12345 }
   *   }, 'error');
   * }
   */
  static logError(error: unknown, context: Partial<ErrorContext> = {}, severity: ErrorSeverity = 'error'): void {
    const err = error instanceof Error ? error : new Error(EnhancedLogger.getErrorMessage(error));
    const ctx: ErrorContext = {
      function: context.function || 'unknown',
      module: context.module || 'unknown',
      timestamp: new Date(),
      sessionId: EnhancedLogger.sessionId,
      stackTrace: err.stack,
      contextData: context.contextData
    };

    const msg = EnhancedLogger.format(err, ctx, severity);
    Logger.log(msg);

    if (severity === 'error' || severity === 'critical') {
      EnhancedLogger.storeError(err, ctx);
    }
  }

  /**
   * Logs function entry with optional arguments
   *
   * Logs when a function is entered with sanitized argument information.
   * Sensitive data (passwords, tokens, keys) is automatically redacted.
   *
   * @param functionName Name of the function being entered
   * @param module Name of the module containing the function
   * @param args Optional argument data to log (will be sanitized)
   *
   * @example
   * EnhancedLogger.logFunctionEntry('pullOrders', 'build-queue', { limit: 50 });
   */
  static logFunctionEntry(functionName: string, module: string, args?: Record<string, unknown>): void {
    const safeArgs = args ? EnhancedLogger.sanitizeArgs(args) : undefined;
    const parts = [
      '🔍 ENTER',
      `${module}.${functionName}`,
      safeArgs ? `| Args: ${JSON.stringify(safeArgs)}` : ''
    ].filter(Boolean);
    Logger.log(parts.join(' '));
  }

  /**
   * Logs function exit with optional result and timing
   *
   * Logs when a function exits successfully with a summary of the result
   * and optional execution time.
   *
   * @param functionName Name of the function being exited
   * @param module Name of the module containing the function
   * @param result Optional result value to summarize
   * @param executionTimeMs Optional execution time in milliseconds
   *
   * @example
   * const start = Date.now();
   * const result = processOrders();
   * EnhancedLogger.logFunctionExit('processOrders', 'build-queue', result, Date.now() - start);
   */
  static logFunctionExit(functionName: string, module: string, result?: unknown, executionTimeMs?: number): void {
    const resultSummary = EnhancedLogger.summarize(result);
    const timing = executionTimeMs ? ` | ${executionTimeMs}ms` : '';
    Logger.log(`✅ EXIT ${module}.${functionName} | Result: ${resultSummary}${timing}`);
  }

  /**
   * Creates a wrapper function with automatic entry/exit/error logging
   *
   * Wraps a function to automatically log when it's called, when it returns,
   * and any errors that occur. Preserves the original function's type signature.
   *
   * @template T Function type to wrap
   * @param fn Function to wrap with logging
   * @param moduleName Module name for logging context
   * @param functionName Optional function name (uses fn.name if not provided)
   * @returns Wrapped function with same signature as input
   *
   * @example
   * const loggedFetch = EnhancedLogger.wrapFunction(
   *   fetchOrders,
   *   'build-queue',
   *   'fetchOrders'
   * );
   * const orders = loggedFetch(); // Automatically logged
   */
  static wrapFunction<T extends (...args: any[]) => any>(fn: T, moduleName: string, functionName?: string): T {
    const fnName = functionName || fn.name || 'anonymous';
    return ((...args: Parameters<T>): ReturnType<T> => {
      const start = Date.now();
      try {
        EnhancedLogger.logFunctionEntry(fnName, moduleName, args.length ? { argCount: args.length } : undefined);
        const result = fn(...args);
        EnhancedLogger.logFunctionExit(fnName, moduleName, result, Date.now() - start);
        return result;
      } catch (e) {
        EnhancedLogger.logError(e, {
          function: fnName,
          module: moduleName,
          contextData: { argCount: args.length, executionTimeMs: Date.now() - start }
        });
        throw e;
      }
    }) as T;
  }

  /**
   * Formats error message with all available context
   */
  private static format(error: Error, context: ErrorContext, severity: ErrorSeverity): string {
    const emoji = severity === 'error' || severity === 'critical' ? '❌' : severity === 'warn' ? '⚠️' : 'ℹ️';
    const parts = [
      emoji,
      `[${severity.toUpperCase()}]`,
      `${context.module}.${context.function}`,
      `| ${error.name}: ${error.message}`,
      context.contextData ? `| Context: ${JSON.stringify(context.contextData)}` : '',
      `| Session: ${context.sessionId}`
    ];
    return parts.filter(Boolean).join(' ');
  }

  /**
   * Redacts sensitive information from arguments
   */
  private static sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      const key = k.toLowerCase();
      if (key.includes('password') || key.includes('token') || key.includes('key')) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /**
   * Summarizes function results for logging (handles large objects gracefully)
   */
  private static summarize(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const t = typeof value;
    if (t === 'string') return `"${(value as string).slice(0, 100)}${(value as string).length > 100 ? '...' : ''}"`;
    if (t === 'number' || t === 'boolean') return String(value);
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (t === 'object') {
      const keys = Object.keys(value as object);
      return `Object{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
    }
    return t;
  }

  /**
   * Stores detailed error information for later debugging
   */
  private static storeError(error: Error, context: ErrorContext): void {
    try {
      const cache = CacheService.getScriptCache();
      const key = `error_${context.sessionId}_${Date.now()}`;
      const payload = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        context,
        timestamp: context.timestamp.toISOString()
      };
      cache.put(key, JSON.stringify(payload), 21600);

      const props = PropertiesService.getScriptProperties();
      const summaryKey = 'latest_errors';
      const existing = props.getProperty(summaryKey);
      let errors: any[] = [];
      if (existing) {
        try {
          errors = JSON.parse(existing);
        } catch {
          errors = [];
        }
      }
      errors.unshift({
        key,
        message: error.message,
        function: context.function,
        module: context.module,
        timestamp: context.timestamp.toISOString(),
        severity: 'error'
      });
      if (errors.length > 10) errors = errors.slice(0, 10);
      props.setProperty(summaryKey, JSON.stringify(errors));
    } catch (e) {
      Logger.log(`⚠️ Failed to store error details: ${EnhancedLogger.getErrorMessage(e)}`);
    }
  }
}

/**
 * Convenience function decorators for common operations
 */

/**
 * Wraps a function with Shopify API error handling
 *
 * Automatically logs entry, exit, and errors for Shopify API operations
 * with 'ShopifyAPI' as the module name.
 *
 * @template T Function type to wrap
 * @param fn Function to wrap with Shopify error handling
 * @returns Wrapped function with automatic logging
 *
 * @example
 * const fetchOrders = withShopifyErrorHandling(function fetchOrders() {
 *   // Shopify API calls here
 * });
 */
export function withShopifyErrorHandling<T extends (...args: any[]) => any>(fn: T): T {
  return EnhancedLogger.wrapFunction(fn, 'ShopifyAPI', fn.name) as T;
}

/**
 * Wraps a function with Google Sheets error handling
 *
 * Automatically logs entry, exit, and errors for Sheet operations
 * with 'SheetOperations' as the module name.
 *
 * @template T Function type to wrap
 * @param fn Function to wrap with Sheet error handling
 * @returns Wrapped function with automatic logging
 *
 * @example
 * const updateSheet = withSheetErrorHandling(function updateSheet(data) {
 *   // Sheet operations here
 * });
 */
export function withSheetErrorHandling<T extends (...args: any[]) => any>(fn: T): T {
  return EnhancedLogger.wrapFunction(fn, 'SheetOperations', fn.name) as T;
}

/**
 * Wraps a function with data validation error handling
 *
 * Automatically logs entry, exit, and errors for validation operations
 * with 'DataValidation' as the module name.
 *
 * @template T Function type to wrap
 * @param fn Function to wrap with validation error handling
 * @returns Wrapped function with automatic logging
 *
 * @example
 * const validateOrder = withValidationErrorHandling(function validateOrder(order) {
 *   // Validation logic here
 * });
 */
export function withValidationErrorHandling<T extends (...args: any[]) => any>(fn: T): T {
  return EnhancedLogger.wrapFunction(fn, 'DataValidation', fn.name) as T;
}

/**
 * Retrieves recent errors from PropertiesService for debugging
 *
 * Returns up to 10 most recent errors stored by the logging system.
 * Useful for debugging and monitoring application health.
 *
 * @returns Array of recent error summaries, or empty array if none found
 *
 * @example
 * const errors = getRecentErrors();
 * errors.forEach(err => {
 *   console.log(`${err.timestamp}: ${err.module}.${err.function} - ${err.message}`);
 * });
 */
export function getRecentErrors(): any[] {
  try {
    const props = PropertiesService.getScriptProperties();
    const summary = props.getProperty('latest_errors');
    return summary ? JSON.parse(summary) : [];
  } catch (e) {
    Logger.log(`⚠️ Failed to retrieve recent errors: ${EnhancedLogger.getErrorMessage(e)}`);
    return [];
  }
}

/**
 * Function to get detailed error information by key
 */
export function getErrorDetails(errorKey: string): any | null {
  try {
    const cache = CacheService.getScriptCache();
    const data = cache.get(errorKey);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    Logger.log(`⚠️ Failed to retrieve error details for key ${errorKey}: ${EnhancedLogger.getErrorMessage(e)}`);
    return null;
  }
}

/**
 * Clears stored error data
 */
export function clearErrorHistory(): void {
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('latest_errors');
    Logger.log('✅ Error history cleared');
  } catch (e) {
    Logger.log(`⚠️ Failed to clear error history: ${EnhancedLogger.getErrorMessage(e)}`);
  }
}

/**
 * Retry helper for Google Sheets advanced-service calls.
 *
 * The Sheets advanced service occasionally fails with transient errors —
 * "Empty response" from the GFE, brief 5xx, momentary spreadsheet locks under
 * concurrent writes, or short Sheets-API quota bursts. Retrying once or twice
 * with backoff usually succeeds; without it, every transient failure surfaces
 * as a hard write failure to the user.
 *
 * Use only for idempotent or safely-retryable operations. `Values.append`
 * with `INSERT_ROWS` is safe to retry only when the previous attempt did not
 * actually insert (which is the case for a thrown exception — Sheets either
 * commits the append or throws, not both).
 *
 * @module lib/sheet-orm/sheetsRetry
 */

const TRANSIENT_PATTERNS: readonly RegExp[] = [
  /empty response/i,
  /service unavailable/i,
  /backend error/i,
  /rate limit exceeded/i,
  /internal error/i,
  /\btimeout\b/i,
  /\b50[234]\b/ // 502, 503, 504 in error text
];

/**
 * Returns true if the error message looks like a transient Sheets API failure
 * worth retrying. False for validation, schema, auth, or 4xx errors.
 */
export function isTransientSheetsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}

export interface SheetsRetryOptions {
  /** Maximum number of attempts including the first. Default 3. */
  maxAttempts?: number;
  /** Initial backoff in milliseconds; doubles each retry. Default 250ms. */
  baseDelayMs?: number;
  /** Sleep function — injectable for tests. Default uses Utilities.sleep. */
  sleep?: (ms: number) => void;
}

/**
 * Runs `fn` and retries on transient Sheets errors with exponential backoff.
 * Re-throws the last error if all attempts fail or if the error is not transient.
 *
 * @example
 * withSheetsRetry(() => Sheets.Spreadsheets.Values.append({ values }, ssId, range, opts));
 */
export function withSheetsRetry<T>(fn: () => T, opts: SheetsRetryOptions = {}): T {
  const max = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 250;
  const sleep = opts.sleep ?? ((ms: number) => Utilities.sleep(ms));

  if (!Number.isInteger(max) || max < 1) {
    throw new Error(`withSheetsRetry: maxAttempts must be an integer >= 1, got ${max}`);
  }
  if (!Number.isFinite(base) || base < 0) {
    throw new Error(`withSheetsRetry: baseDelayMs must be a finite number >= 0, got ${base}`);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;
      if (attempt === max || !isTransientSheetsError(err)) throw err;
      sleep(base * 2 ** (attempt - 1));
    }
  }
  // Unreachable — loop either returns or throws — but TypeScript needs a return path.
  throw lastErr;
}

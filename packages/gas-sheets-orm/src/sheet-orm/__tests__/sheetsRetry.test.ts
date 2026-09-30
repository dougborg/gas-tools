import { describe, expect, it, vi } from 'vitest';
import { isTransientSheetsError, withSheetsRetry } from '../sheetsRetry.js';

describe('sheetsRetry', () => {
  describe('isTransientSheetsError', () => {
    it('matches known transient patterns from real Sheets API failures', () => {
      const cases = [
        'API call to sheets.spreadsheets.values.append failed with error: Empty response',
        'Service Unavailable',
        'Backend Error',
        'Rate Limit Exceeded',
        'Internal error encountered',
        'Request timeout',
        'HTTP 502: Bad Gateway',
        'HTTP 503',
        'HTTP 504 Gateway Timeout'
      ];
      for (const msg of cases) {
        expect(isTransientSheetsError(new Error(msg)), msg).toBe(true);
      }
    });

    it('does not match validation, schema, auth, or 4xx errors', () => {
      const cases = [
        'Sheet "Build Queue" has no columns',
        'Validation failed: missing required column',
        'Permission denied',
        'Not found',
        'Invalid range specified',
        'HTTP 400 Bad Request',
        'HTTP 401 Unauthorized',
        'HTTP 403 Forbidden',
        'HTTP 404 Not Found'
      ];
      for (const msg of cases) {
        expect(isTransientSheetsError(new Error(msg)), msg).toBe(false);
      }
    });

    it('handles non-Error values via String()', () => {
      expect(isTransientSheetsError('Empty response')).toBe(true);
      expect(isTransientSheetsError('something unrelated')).toBe(false);
      expect(isTransientSheetsError(null)).toBe(false);
    });
  });

  describe('withSheetsRetry', () => {
    it('returns the value on first-attempt success without sleeping', () => {
      const sleep = vi.fn();
      const fn = vi.fn(() => 'ok');
      const result = withSheetsRetry(fn, { sleep });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('retries transient failures and returns on eventual success', () => {
      const sleep = vi.fn();
      let calls = 0;
      const fn = vi.fn(() => {
        calls++;
        if (calls < 3) throw new Error('Empty response');
        return 'ok';
      });
      const result = withSheetsRetry(fn, { sleep, baseDelayMs: 100 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenNthCalledWith(1, 100); // 100 * 2^0
      expect(sleep).toHaveBeenNthCalledWith(2, 200); // 100 * 2^1
    });

    it('rethrows immediately on non-transient errors', () => {
      const sleep = vi.fn();
      const fn = vi.fn(() => {
        throw new Error('Permission denied');
      });
      expect(() => withSheetsRetry(fn, { sleep })).toThrow('Permission denied');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('rethrows the last transient error after exhausting maxAttempts', () => {
      const sleep = vi.fn();
      const fn = vi.fn(() => {
        throw new Error('Empty response');
      });
      expect(() => withSheetsRetry(fn, { sleep, maxAttempts: 3 })).toThrow('Empty response');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledTimes(2); // sleeps between attempts, not after the last
    });

    it('respects custom maxAttempts', () => {
      const sleep = vi.fn();
      const fn = vi.fn(() => {
        throw new Error('Empty response');
      });
      expect(() => withSheetsRetry(fn, { sleep, maxAttempts: 5 })).toThrow();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('rejects invalid maxAttempts before invoking fn', () => {
      const fn = vi.fn(() => 'ok');
      for (const bad of [0, -1, 1.5, Number.NaN]) {
        expect(() => withSheetsRetry(fn, { maxAttempts: bad }), `maxAttempts=${bad}`).toThrow(
          /maxAttempts must be an integer >= 1/
        );
      }
      expect(fn).not.toHaveBeenCalled();
    });

    it('rejects invalid baseDelayMs before invoking fn', () => {
      const fn = vi.fn(() => 'ok');
      for (const bad of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
        expect(() => withSheetsRetry(fn, { baseDelayMs: bad }), `baseDelayMs=${bad}`).toThrow(
          /baseDelayMs must be a finite number >= 0/
        );
      }
      expect(fn).not.toHaveBeenCalled();
    });
  });
});

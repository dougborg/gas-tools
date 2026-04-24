import { describe, expect, it } from 'vitest';
import { ValidationErrors } from '../validationErrors.js';

describe('ValidationErrors', () => {
  describe('required', () => {
    it('flags null, undefined, empty string, and whitespace-only as missing', () => {
      const result = new ValidationErrors()
        .required(null, 'A')
        .required(undefined, 'B')
        .required('', 'C')
        .required('   ', 'D')
        .required('\t\n', 'E')
        .result();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        'A is required',
        'B is required',
        'C is required',
        'D is required',
        'E is required'
      ]);
    });

    it('passes for non-empty strings, numbers, and booleans', () => {
      const result = new ValidationErrors()
        .required('value', 'A')
        .required(0, 'B')
        .required(false, 'C')
        .required({ x: 1 }, 'D')
        .result();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('maxLength', () => {
    it('flags strings longer than the max', () => {
      const result = new ValidationErrors().maxLength('abcdef', 3, 'field').result();
      expect(result.errors).toEqual(['field must be 3 characters or less']);
    });

    it('passes strings at or below the max', () => {
      const result = new ValidationErrors()
        .maxLength('abc', 3, 'a')
        .maxLength('ab', 3, 'b')
        .maxLength('', 3, 'c')
        .result();
      expect(result.valid).toBe(true);
    });

    it('treats whitespace-only and empty as already-caught-by-required (no length error)', () => {
      const result = new ValidationErrors()
        .maxLength(null, 3, 'a')
        .maxLength(undefined, 3, 'b')
        .maxLength('', 3, 'c')
        .maxLength('    ', 3, 'd') // whitespace-only, length > max — still skip
        .result();
      expect(result.valid).toBe(true);
    });

    it('is order-independent with required() for whitespace inputs', () => {
      const a = new ValidationErrors().required('   ', 'X').maxLength('   ', 2, 'X').result();
      const b = new ValidationErrors().maxLength('   ', 2, 'X').required('   ', 'X').result();
      expect(a).toEqual(b);
      expect(a.errors).toEqual(['X is required']);
    });
  });

  describe('positive', () => {
    it('flags zero and negative values', () => {
      const r = new ValidationErrors().positive(0, 'a').positive(-1, 'b').result();
      expect(r.errors).toEqual(['a must be greater than zero (got 0)', 'b must be greater than zero (got -1)']);
    });

    it('passes positive values', () => {
      expect(new ValidationErrors().positive(0.0001, 'x').result().valid).toBe(true);
    });
  });

  describe('integer', () => {
    it('flags non-integer values', () => {
      const r = new ValidationErrors().integer(1.5, 'x').integer(Number.NaN, 'y').result();
      expect(r.errors).toEqual(['x must be a whole number (got 1.5)', 'y must be a whole number (got NaN)']);
    });

    it('passes integer values including negatives', () => {
      expect(new ValidationErrors().integer(0, 'a').integer(-5, 'b').result().valid).toBe(true);
    });
  });

  describe('max', () => {
    it('flags values above the max', () => {
      const r = new ValidationErrors().max(101, 100, 'x').result();
      expect(r.errors).toEqual(['x must be 100 or less (got 101)']);
    });

    it('passes values at or below the max', () => {
      expect(new ValidationErrors().max(100, 100, 'x').max(0, 100, 'y').result().valid).toBe(true);
    });
  });

  describe('nonNegative', () => {
    it('flags negative values', () => {
      const r = new ValidationErrors().nonNegative(-0.5, 'x').result();
      expect(r.errors).toEqual(['x cannot be negative (got -0.5)']);
    });

    it('skips null and undefined (optional fields)', () => {
      expect(
        new ValidationErrors().nonNegative(null, 'a').nonNegative(undefined, 'b').nonNegative(0, 'c').result().valid
      ).toBe(true);
    });
  });

  describe('custom', () => {
    it('pushes a message when the condition is true', () => {
      const r = new ValidationErrors().custom(true, 'boom').custom(false, 'not-boom').result();
      expect(r.errors).toEqual(['boom']);
    });
  });

  describe('result', () => {
    it('returns a fresh copy of errors — mutating the return does not affect the accumulator', () => {
      const v = new ValidationErrors().required('', 'X');
      const r1 = v.result();
      r1.errors.push('should-not-leak');
      const r2 = v.result();
      expect(r2.errors).toEqual(['X is required']);
    });

    it('accumulates errors in chain order', () => {
      const r = new ValidationErrors().required('', 'A').positive(-1, 'B').maxLength('abcdef', 3, 'C').result();
      expect(r.errors).toEqual([
        'A is required',
        'B must be greater than zero (got -1)',
        'C must be 3 characters or less'
      ]);
    });
  });
});

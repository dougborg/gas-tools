import { describe, expect, it } from 'vitest';
import { InputSanitizer } from '../inputSanitizer.js';

describe('InputSanitizer', () => {
  describe('validateSheetName', () => {
    it('trims and accepts valid sheet names', () => {
      expect(InputSanitizer.validateSheetName('  Build Queue  ')).toBe('Build Queue');
    });

    it('rejects null and undefined sheet names', () => {
      expect(() => InputSanitizer.validateSheetName(null)).toThrow(/Sheet name is required/);
      expect(() => InputSanitizer.validateSheetName(undefined)).toThrow(/Sheet name is required/);
    });

    it('accepts sheet name at exactly max length (100 characters)', () => {
      const maxLengthName = 'A'.repeat(100);
      expect(InputSanitizer.validateSheetName(maxLengthName)).toBe(maxLengthName);
    });

    it('rejects sheet name exceeding max length (101 characters)', () => {
      const tooLongName = 'A'.repeat(101);
      expect(() => InputSanitizer.validateSheetName(tooLongName)).toThrow(/must be <= 100 characters/);
    });

    it('rejects path traversal with double dots', () => {
      expect(() => InputSanitizer.validateSheetName('../evil')).toThrow(/path traversal/);
      expect(() => InputSanitizer.validateSheetName('foo..bar')).toThrow(/path traversal/);
      expect(() => InputSanitizer.validateSheetName('evil..')).toThrow(/path traversal/);
    });

    it('rejects forward slash', () => {
      expect(() => InputSanitizer.validateSheetName('path/to/evil')).toThrow(/path traversal/);
    });

    it('rejects backslash', () => {
      expect(() => InputSanitizer.validateSheetName('path\\to\\evil')).toThrow(/path traversal/);
    });

    it('rejects control characters', () => {
      expect(() => InputSanitizer.validateSheetName('Sheet\u0000Name')).toThrow(/control characters/);
      expect(() => InputSanitizer.validateSheetName('Sheet\u0001Name')).toThrow(/control characters/);
      expect(() => InputSanitizer.validateSheetName('Sheet\u001fName')).toThrow(/control characters/);
    });
  });
});

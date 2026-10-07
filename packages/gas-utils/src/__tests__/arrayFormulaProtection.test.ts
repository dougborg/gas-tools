import { beforeEach, describe, expect, test, vi } from 'vitest';

// Unit tests for array formula protection functions

import { installGasGlobals } from '@dougborg/gas-test-utils';
// Import from TypeScript source for unit testing
import { columnNumberToLetter, fixArrayFormulaErrors } from '../arrayFormulaProtection.js';

describe('Array Formula Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installGasGlobals();
  });

  describe('columnNumberToLetter function', () => {
    test('should convert 1 to A', () => {
      expect(columnNumberToLetter(1)).toBe('A');
    });

    test('should convert 26 to Z', () => {
      expect(columnNumberToLetter(26)).toBe('Z');
    });

    test('should convert 27 to AA', () => {
      expect(columnNumberToLetter(27)).toBe('AA');
    });

    test('should convert 52 to AZ', () => {
      expect(columnNumberToLetter(52)).toBe('AZ');
    });

    test('should convert 702 to ZZ', () => {
      expect(columnNumberToLetter(702)).toBe('ZZ');
    });

    test('should convert 703 to AAA', () => {
      expect(columnNumberToLetter(703)).toBe('AAA');
    });
  });

  describe('fixArrayFormulaErrors function', () => {
    test('should not throw with proper mocks', () => {
      const mockSheet = {
        getName: vi.fn().mockReturnValue('Test Sheet'),
        getLastRow: vi.fn().mockReturnValue(10),
        getLastColumn: vi.fn().mockReturnValue(5),
        getRange: vi.fn().mockReturnValue({
          getFormulas: vi.fn().mockReturnValue([[]]),
          getDisplayValues: vi.fn().mockReturnValue([[]]),
          setValues: vi.fn()
        })
      };

      (globalThis as any).SpreadsheetApp.getActiveSpreadsheet = vi.fn().mockReturnValue({
        getId: vi.fn().mockReturnValue('test-spreadsheet-id'),
        getSheets: vi.fn().mockReturnValue([mockSheet]),
        toast: vi.fn()
      });

      // Mock Sheets API v4
      (globalThis as any).Sheets = {
        Spreadsheets: {
          get: vi.fn().mockReturnValue({
            sheets: []
          })
        }
      };

      // Function should complete without errors
      expect(() => fixArrayFormulaErrors()).not.toThrow();
    });

    test('should detect and fix ARRAYFORMULA errors using Sheets API v4', () => {
      const errorMessage = 'Array result was not expanded because it would overwrite data in C4';

      // Mock the blocking column range that will be cleared (C4:C5 - vertical clearing)
      const mockBlockingColumnRange = {
        clearContent: vi.fn(),
        getFormulas: vi.fn().mockReturnValue([
          [''], // C4 - no formula
          [''] // C5 - no formula (row 5 in our 5-row sheet)
        ]),
        getDisplayValues: vi.fn().mockReturnValue([
          ['some data'], // C4 - has data
          ['more data'] // C5 - has data
        ])
      };

      // Mock cells that return A1 notation
      const mockCellC2 = {
        getA1Notation: vi.fn().mockReturnValue('C2')
      };

      // Mock the full range with #REF! error displayed
      const mockFullRangeWithError = {
        getFormulas: vi.fn().mockReturnValue([
          ['', '', ''],
          ['', '', '=ARRAYFORMULA(IF(A2:A<>"", VLOOKUP(...), ""))'], // Cell C2 has ARRAYFORMULA
          ['', '', ''],
          ['', '', ''],
          ['', '', '']
        ]),
        getDisplayValues: vi.fn().mockReturnValue([
          ['Header1', 'Header2', 'HeaderV'],
          ['Data1', 'Data2', '#REF!'], // Cell C2 shows #REF! error
          ['Data4', 'Data5', 'Data6'],
          ['Data7', 'Data8', 'Data9'],
          ['Data10', 'Data11', 'Data12']
        ])
      };

      const mockSheet = {
        getName: vi.fn().mockReturnValue('Test Sheet'),
        getLastRow: vi.fn().mockReturnValue(5),
        getLastColumn: vi.fn().mockReturnValue(3),
        getRange: vi
          .fn()
          .mockImplementation((row: number | string, col?: number, numRows?: number, numCols?: number) => {
            // Full range request (1, 1, lastRow, lastCol)
            if (row === 1 && col === 1 && numRows === 5 && numCols === 3) {
              return mockFullRangeWithError;
            }
            // Single cell request for getting A1 notation (row 2, col 3 = C2)
            if (row === 2 && col === 3 && numRows === undefined && numCols === undefined) {
              return mockCellC2;
            }
            // A1 notation request for blocking column range (e.g., 'C4:C5')
            // This is vertical clearing from C4 down to last row (5)
            if (typeof row === 'string' && row === 'C4:C5') {
              return mockBlockingColumnRange;
            }
            // Fallback for unexpected calls
            throw new Error(`Unexpected getRange call: row=${row}, col=${col}, numRows=${numRows}, numCols=${numCols}`);
          })
      };

      // Mock Sheets API v4 response with realistic errorValue structure
      (globalThis as any).Sheets = {
        Spreadsheets: {
          get: vi.fn().mockReturnValue({
            sheets: [
              {
                data: [
                  {
                    rowData: [
                      {
                        values: [
                          {
                            effectiveValue: {
                              errorValue: {
                                type: 'REF',
                                message: errorMessage
                              }
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          })
        }
      };

      (globalThis as any).SpreadsheetApp.getActiveSpreadsheet = vi.fn().mockReturnValue({
        getId: vi.fn().mockReturnValue('test-spreadsheet-id'),
        getSheets: vi.fn().mockReturnValue([mockSheet]),
        toast: vi.fn()
      });

      fixArrayFormulaErrors();

      // Should have detected error and cleared blocking column range
      expect(mockBlockingColumnRange.clearContent).toHaveBeenCalledTimes(1);
      expect(mockSheet.getRange).toHaveBeenCalledWith('C4:C5');
    });

    test('should handle sheets with no errors', () => {
      const mockSheet = {
        getName: vi.fn().mockReturnValue('Test Sheet'),
        getLastRow: vi.fn().mockReturnValue(5),
        getLastColumn: vi.fn().mockReturnValue(3),
        getRange: vi.fn().mockReturnValue({
          getFormulas: vi.fn().mockReturnValue([
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
          ]),
          getDisplayValues: vi.fn().mockReturnValue([
            ['Header1', 'Header2', 'Header3'],
            ['Data1', 'Data2', 'Data3'],
            ['Data4', 'Data5', 'Data6']
          ])
        })
      };

      const toastFn = vi.fn();

      (globalThis as any).SpreadsheetApp.getActiveSpreadsheet = vi.fn().mockReturnValue({
        getId: vi.fn().mockReturnValue('test-spreadsheet-id'),
        getSheets: vi.fn().mockReturnValue([mockSheet]),
        toast: toastFn
      });

      // Mock Sheets API v4
      (globalThis as any).Sheets = {
        Spreadsheets: {
          get: vi.fn().mockReturnValue({
            sheets: []
          })
        }
      };

      fixArrayFormulaErrors();

      // Should not show toast if no errors found
      expect(toastFn).not.toHaveBeenCalled();
    });
  });
});

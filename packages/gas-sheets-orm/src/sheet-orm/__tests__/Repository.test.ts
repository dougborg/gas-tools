import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository } from '../Repository.js';
import type { DomainModel } from '../types.js';

// Mock domain model for testing
class TestModel implements DomainModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly value: number
  ) {}

  validate() {
    return { valid: true, errors: [] };
  }

  toSheetRow() {
    return { id: this.id, name: this.name, value: this.value };
  }

  static fromSheetRow(data: Record<string, any>): TestModel {
    return new TestModel(String(data.id), String(data.name), Number(data.value));
  }
}

describe('Repository', () => {
  let mockSpreadsheet: any;
  let mockSheet: any;

  beforeEach(() => {
    mockSheet = {
      getName: vi.fn(() => 'Test Sheet'),
      getDataRange: vi.fn(),
      getValues: vi.fn(),
      getSheetId: vi.fn(() => 123456),
      getMaxColumns: vi.fn(() => 3),
      getRange: vi.fn()
    };

    mockSpreadsheet = {
      getSheetByName: vi.fn((name: string) => (name === 'Test Sheet' ? mockSheet : null)),
      getSheets: vi.fn(() => [mockSheet])
    };

    // Mock getDataRange to return a mock with getValues
    mockSheet.getDataRange.mockReturnValue({
      getValues: mockSheet.getValues
    });

    // Mock getRange for header reading (returns first row from mockSheet.getValues)
    mockSheet.getRange.mockImplementation(() => ({
      getValues: () => {
        const allData = mockSheet.getValues();
        return allData.length > 0 ? [allData[0]] : [[]];
      }
    }));
  });

  describe('constructor', () => {
    it('should create repository with config', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      expect(repo).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should read all entities from sheet', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: /^ID$/i, name: /^Name$/i, value: /^Value$/i },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'], // Header
        ['1', 'Test 1', 100],
        ['2', 'Test 2', 200]
      ]);

      const results = repo.findAll(mockSpreadsheet);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(TestModel);
      expect(results[0].id).toBe('1');
      expect(results[0].name).toBe('Test 1');
      expect(results[0].value).toBe(100);
      expect(results[1].id).toBe('2');
    });

    it('should return empty array for sheet with only headers', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'] // Only header
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(0);
    });

    it('should skip empty rows', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test 1', 100],
        ['', '', ''], // Empty row
        ['2', 'Test 2', 200]
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[1].id).toBe('2');
    });

    it('should handle rows with null values', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test 1', 100],
        [null, null, null], // Null row
        ['2', 'Test 2', 200]
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(2);
    });

    it('should throw error if sheet not found', () => {
      const repo = new Repository({
        sheetName: 'Nonexistent Sheet',
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow
      });

      expect(() => repo.findAll(mockSpreadsheet)).toThrow('Sheet not found: Nonexistent Sheet');
    });

    it('should handle invalid rows gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: (data) => {
          if (data.id === 'invalid') throw new Error('Invalid row');
          return TestModel.fromSheetRow(data);
        }
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test 1', 100],
        ['invalid', 'Bad', 'data'],
        ['2', 'Test 2', 200]
      ]);

      const results = repo.findAll(mockSpreadsheet);

      expect(results).toHaveLength(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse row'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('column mapping', () => {
    it('should map columns using exact string match', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test', 100]
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results[0].id).toBe('1');
      expect(results[0].name).toBe('Test');
    });

    it('should map columns using RegExp', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: {
          id: /^ID$/i,
          name: /^Name$/i,
          value: /^Value$/i
        },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['id', 'name', 'value'], // Lowercase headers
        ['1', 'Test', 100]
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results[0].id).toBe('1');
      expect(results[0].name).toBe('Test');
    });

    it('should map columns using array of RegExp patterns', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: {
          id: [/^ID$/i, /^Identifier$/i],
          name: [/^Name$/i, /^Title$/i]
        },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['Identifier', 'Title', 'Value'],
        ['1', 'Test', 100]
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results[0].id).toBe('1');
      expect(results[0].name).toBe('Test');
    });

    it('should handle missing optional columns', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: {
          id: 'ID',
          name: 'Name',
          value: 'MissingColumn' // This column doesn't exist
        },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name'],
        ['1', 'Test']
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
      expect(results[0].value).toBeNaN(); // Missing column = undefined, converted to NaN
    });
  });

  describe('sheet name matching', () => {
    it('should match sheet by exact name', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([['ID'], ['1']]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(1);
    });

    it('should match sheet by RegExp pattern', () => {
      const repo = new Repository({
        sheetName: /Test/i,
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([['ID'], ['1']]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(1);
    });

    it('should return null if pattern does not match any sheet', () => {
      const repo = new Repository({
        sheetName: /Nonexistent/i,
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow
      });

      expect(() => repo.findAll(mockSpreadsheet)).toThrow('Sheet not found');
    });
  });

  describe('dataStartRow configuration', () => {
    it('should use default dataStartRow of 1 (skip header)', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID'], // Row 0 - header
        ['1'], // Row 1 - data
        ['2'] // Row 2 - data
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(2);
    });

    it('should respect custom dataStartRow', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow,
        dataStartRow: 2 // Skip first 2 rows
      });

      mockSheet.getValues.mockReturnValue([
        ['ID'], // Row 0 - header
        ['SKIP'], // Row 1 - skip this
        ['1'], // Row 2 - start here
        ['2'] // Row 3 - data
      ]);

      const results = repo.findAll(mockSpreadsheet);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
    });
  });

  describe('buildColumnMapping', () => {
    it('should build mapping from sheet headers', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test', 100]
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.mappings.get('id')).toBe(0);
      expect(result.mappings.get('name')).toBe(1);
      expect(result.mappings.get('value')).toBe(2);
      expect(result.headers).toEqual(['ID', 'Name', 'Value']);
      expect(result.sheetId).toBe(123456);
    });

    it('should handle columns in different order than config', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        // Config defines order: id, name, value
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        // Sheet has different order: Value, ID, Name
        ['Value', 'ID', 'Name'],
        [100, '1', 'Test']
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      // Mappings should reflect actual sheet positions
      expect(result.mappings.get('value')).toBe(0);
      expect(result.mappings.get('id')).toBe(1);
      expect(result.mappings.get('name')).toBe(2);
      expect(result.headers).toEqual(['Value', 'ID', 'Name']);
    });

    it('should detect missing required columns', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        requiredColumns: ['id', 'name'],
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Value'], // Missing 'Name' (required)
        ['1', 100]
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.missingRequired).toContain('name');
      expect(result.mappings.has('id')).toBe(true);
      expect(result.mappings.has('name')).toBe(false);
      expect(result.mappings.has('value')).toBe(true);
    });

    it('should detect missing optional columns', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        requiredColumns: ['id'], // Only id is required
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Value'], // Missing 'Name' (optional)
        ['1', 100]
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.missingOptional).toContain('name');
      expect(result.missingRequired).toHaveLength(0);
      expect(result.mappings.has('id')).toBe(true);
      expect(result.mappings.has('value')).toBe(true);
    });

    it('should detect extra columns in sheet', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Extra Column 1', 'Extra Column 2'],
        ['1', 'Test', 'foo', 'bar']
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.extraColumns).toContain('Extra Column 1');
      expect(result.extraColumns).toContain('Extra Column 2');
    });

    it('should use regex patterns for column matching', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: {
          id: /^ID$/i,
          name: /^Name$/i,
          value: /^Value$/i
        },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['id', 'name', 'value'], // Lowercase headers
        ['1', 'Test', 100]
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.mappings.get('id')).toBe(0);
      expect(result.mappings.get('name')).toBe(1);
      expect(result.mappings.get('value')).toBe(2);
    });

    it('should use array of patterns for column matching', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: {
          id: [/^ID$/i, /^Identifier$/i],
          name: [/^Name$/i, /^Title$/i]
        },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['Identifier', 'Title', 'Value'],
        ['1', 'Test', 100]
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.mappings.get('id')).toBe(0);
      expect(result.mappings.get('name')).toBe(1);
    });

    it('should read all columns including hidden ones', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', hidden: 'Hidden' },
        fromSheetRow: TestModel.fromSheetRow
      });

      // getMaxColumns returns total columns including hidden
      mockSheet.getMaxColumns.mockReturnValue(5);
      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Hidden', 'Extra1', 'Extra2'],
        ['1', 'Test', 'secret', 'foo', 'bar']
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.mappings.get('id')).toBe(0);
      expect(result.mappings.get('name')).toBe(1);
      expect(result.mappings.get('hidden')).toBe(2);
      expect(result.extraColumns).toContain('Extra1');
      expect(result.extraColumns).toContain('Extra2');

      // Verify getRange was called with correct max columns
      expect(mockSheet.getRange).toHaveBeenCalledWith(1, 1, 1, 5);
    });

    it('should handle empty headers gracefully', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', '', 'Name', '  '], // Empty and whitespace headers
        ['1', 'ignored', 'Test', 'ignored']
      ]);

      const result = (repo as any).buildColumnMapping(mockSheet);

      expect(result.mappings.get('id')).toBe(0);
      expect(result.mappings.get('name')).toBe(2);
      // Empty/whitespace headers should not be in extraColumns
      expect(result.extraColumns).toHaveLength(0);
    });

    it('should cache mapping result', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name'],
        ['1', 'Test']
      ]);

      const result1 = (repo as any).buildColumnMapping(mockSheet);
      const result2 = (repo as any).buildColumnMapping(mockSheet);

      // Should return same cached object
      expect(result1).toBe(result2);

      // Should only read headers once
      expect(mockSheet.getRange).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when sheet ID changes', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name'],
        ['1', 'Test']
      ]);

      const result1 = (repo as any).buildColumnMapping(mockSheet);

      // Change sheet ID (simulates different sheet)
      mockSheet.getSheetId.mockReturnValue(999999);

      const result2 = (repo as any).buildColumnMapping(mockSheet);

      // Should return different object (cache invalidated)
      expect(result1).not.toBe(result2);
      expect(result2.sheetId).toBe(999999);

      // Should read headers twice (once for each sheet)
      expect(mockSheet.getRange).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateColumnMapping', () => {
    describe('strict mode', () => {
      it('should throw error on missing required columns', () => {
        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name' },
          requiredColumns: ['id', 'name'],
          validationMode: 'strict',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID'], // Missing 'Name' (required)
          ['1']
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).toThrow('is missing required columns: name');
      });

      it('should throw error on missing optional columns', () => {
        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
          requiredColumns: ['id'], // Only id is required
          validationMode: 'strict',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Value'], // Missing 'Name' (optional)
          ['1', 100]
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).toThrow('is missing optional columns: name');
      });

      it('should not throw on valid schema with all columns', () => {
        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
          requiredColumns: ['id', 'name'],
          validationMode: 'strict',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Name', 'Value'],
          ['1', 'Test', 100]
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).not.toThrow();
      });
    });

    describe('lenient mode', () => {
      it('should throw error on missing required columns', () => {
        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name' },
          requiredColumns: ['id', 'name'],
          validationMode: 'lenient',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID'], // Missing 'Name' (required)
          ['1']
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).toThrow('is missing required columns: name');
      });

      it('should warn but not throw on missing optional columns', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
          requiredColumns: ['id'], // Only id is required
          validationMode: 'lenient',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Value'], // Missing 'Name' (optional)
          ['1', 100]
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).not.toThrow();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠️ Sheet "Test Sheet" is missing optional columns: name')
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('These columns will use default/null values.')
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('warn-only mode', () => {
      it('should warn but not throw on missing required columns', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name' },
          requiredColumns: ['id', 'name'],
          validationMode: 'warn-only',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID'], // Missing 'Name' (required)
          ['1']
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).not.toThrow();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠️ Sheet "Test Sheet" is missing required columns: name')
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('These columns must exist in the sheet for this entity type.')
        );

        consoleWarnSpy.mockRestore();
      });

      it('should info but not throw on missing optional columns', () => {
        const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
          requiredColumns: ['id'], // Only id is required
          validationMode: 'warn-only',
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Value'], // Missing 'Name' (optional)
          ['1', 100]
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).not.toThrow();

        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ️ Sheet "Test Sheet" is missing optional columns: name')
        );
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('These columns will use default/null values.')
        );

        consoleInfoSpy.mockRestore();
      });
    });

    describe('default mode (lenient)', () => {
      it('should default to lenient mode when not specified', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
          requiredColumns: ['id'], // Only id is required
          // validationMode not specified
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Value'], // Missing 'Name' (optional)
          ['1', 100]
        ]);

        expect(() => {
          const mapping = (repo as any).buildColumnMapping(mockSheet);
          (repo as any).validateColumnMapping(mapping);
        }).not.toThrow();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠️ Sheet "Test Sheet" is missing optional columns: name')
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('These columns will use default/null values.')
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('extra columns logging', () => {
      it('should log extra columns found in sheet', () => {
        const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name' },
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Name', 'Extra1', 'Extra2'],
          ['1', 'Test', 'foo', 'bar']
        ]);

        const mapping = (repo as any).buildColumnMapping(mockSheet);
        (repo as any).validateColumnMapping(mapping);

        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ️ Sheet "Test Sheet" contains columns not in schema: Extra1, Extra2')
        );
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('These columns will be ignored during read/write operations.')
        );

        consoleInfoSpy.mockRestore();
      });

      it('should not log when no extra columns', () => {
        const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const repo = new Repository({
          sheetName: 'Test Sheet',
          columnMappings: { id: 'ID', name: 'Name' },
          fromSheetRow: TestModel.fromSheetRow
        });

        mockSheet.getValues.mockReturnValue([
          ['ID', 'Name'],
          ['1', 'Test']
        ]);

        const mapping = (repo as any).buildColumnMapping(mockSheet);
        (repo as any).validateColumnMapping(mapping);

        expect(consoleInfoSpy).not.toHaveBeenCalled();

        consoleInfoSpy.mockRestore();
      });
    });
  });

  describe('updateRows', () => {
    let mockSheets: any;
    let mockSession: any;

    beforeEach(() => {
      // Mock Sheets API for batch update
      mockSheets = {
        Spreadsheets: {
          Values: {
            batchUpdate: vi.fn()
          }
        }
      };
      (global as any).Sheets = mockSheets;

      // Mock Session for timezone
      mockSession = {
        getScriptTimeZone: vi.fn(() => 'America/Los_Angeles')
      };
      (global as any).Session = mockSession;

      // Mock Utilities for date formatting
      (global as any).Utilities = {
        formatDate: vi.fn((date: Date, _tz: string, format: string) => {
          // Simple mock implementation
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const year = date.getFullYear();
          if (format === 'M/d/yyyy H:mm:ss') {
            return `${month}/${day}/${year} 0:00:00`;
          }
          return `${month}/${day}/${year}`;
        })
      };
    });

    it('should batch update multiple rows', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      // Ensure getMaxColumns matches actual column count
      mockSheet.getMaxColumns.mockReturnValue(3);
      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Old Name 1', 100],
        ['2', 'Old Name 2', 200],
        ['3', 'Old Name 3', 300]
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      const updates = [
        { entity: new TestModel('1', 'New Name 1', 150), rowNumber: 2 },
        { entity: new TestModel('2', 'New Name 2', 250), rowNumber: 3 }
      ];

      const result = (repo as any).updateRows(updates, mockSpreadsheet);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);

      // Verify batchUpdate was called
      expect(mockSheets.Spreadsheets.Values.batchUpdate).toHaveBeenCalledTimes(1);
      const batchRequest = mockSheets.Spreadsheets.Values.batchUpdate.mock.calls[0][0];
      expect(batchRequest.valueInputOption).toBe('USER_ENTERED');
      expect(batchRequest.data).toHaveLength(2);
      expect(batchRequest.data[0].range).toMatch(/Test Sheet!A2:[C-D]2/); // Accept C or D depending on getMaxColumns
      expect(batchRequest.data[1].range).toMatch(/Test Sheet!A3:[C-D]3/);
    });

    it('should return empty result for empty updates array', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name'],
        ['1', 'Test']
      ]);

      const result = (repo as any).updateRows([], mockSpreadsheet);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(0);

      // Should not call batchUpdate
      expect(mockSheets.Spreadsheets.Values.batchUpdate).not.toHaveBeenCalled();
    });

    it('should validate entities before updating', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test', 100]
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      // Create entity with invalid data
      const invalidEntity = new TestModel('', '', -1);
      (vi.spyOn(invalidEntity, 'validate') as any).mockReturnValue({
        valid: false,
        errors: ['ID is required', 'Name is required']
      });

      const updates = [{ entity: invalidEntity, rowNumber: 2 }];

      const result = (repo as any).updateRows(updates, mockSpreadsheet);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.failed[0].error).toContain('ID is required');

      // Should not call batchUpdate for invalid entities
      expect(mockSheets.Spreadsheets.Values.batchUpdate).not.toHaveBeenCalled();
    });

    it('should separate valid and invalid entities', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test 1', 100],
        ['2', 'Test 2', 200],
        ['3', 'Test 3', 300]
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      const validEntity = new TestModel('1', 'Valid', 100);
      const invalidEntity = new TestModel('', '', -1);
      (vi.spyOn(invalidEntity, 'validate') as any).mockReturnValue({
        valid: false,
        errors: ['Invalid data']
      });

      const updates = [
        { entity: validEntity, rowNumber: 2 },
        { entity: invalidEntity, rowNumber: 3 }
      ];

      const result = (repo as any).updateRows(updates, mockSpreadsheet);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(1);

      // Should call batchUpdate only for valid entity
      expect(mockSheets.Spreadsheets.Values.batchUpdate).toHaveBeenCalledTimes(1);
      const batchRequest = mockSheets.Spreadsheets.Values.batchUpdate.mock.calls[0][0];
      expect(batchRequest.data).toHaveLength(1);
    });

    it('should use correct column order from sheet headers', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      // Sheet has columns in different order: Value, ID, Name
      mockSheet.getValues.mockReturnValue([
        ['Value', 'ID', 'Name'],
        [100, '1', 'Test']
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      const entity = new TestModel('1', 'Updated', 150);
      const updates = [{ entity, rowNumber: 2 }];

      (repo as any).updateRows(updates, mockSpreadsheet);

      // Verify data is in correct order (Value, ID, Name)
      const batchRequest = mockSheets.Spreadsheets.Values.batchUpdate.mock.calls[0][0];
      const rowData = batchRequest.data[0].values[0];
      expect(rowData[0]).toBe(150); // Value first
      expect(rowData[1]).toBe('1'); // ID second
      expect(rowData[2]).toBe('Updated'); // Name third
    });

    it('should throw error if sheet not found', () => {
      const repo = new Repository({
        sheetName: 'Nonexistent Sheet',
        columnMappings: { id: 'ID' },
        fromSheetRow: TestModel.fromSheetRow
      });

      const entity = new TestModel('1', 'Test', 100);
      const updates = [{ entity, rowNumber: 2 }];

      expect(() => {
        (repo as any).updateRows(updates, mockSpreadsheet);
      }).toThrow('Sheet not found: Nonexistent Sheet');
    });

    it('should handle batch update failure gracefully', () => {
      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name', value: 'Value' },
        fromSheetRow: TestModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name', 'Value'],
        ['1', 'Test', 100]
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      // Mock batchUpdate to throw error
      mockSheets.Spreadsheets.Values.batchUpdate.mockImplementationOnce(() => {
        throw new Error('API rate limit exceeded');
      });

      const entity = new TestModel('1', 'Updated', 150);
      const updates = [{ entity, rowNumber: 2 }];

      const result = (repo as any).updateRows(updates, mockSpreadsheet);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.failed[0].error).toContain('API rate limit exceeded');
    });

    it('should handle date formatting in updated rows', () => {
      class DateModel implements DomainModel {
        constructor(
          public id: string,
          public date: Date
        ) {}

        validate() {
          return { valid: true, errors: [] };
        }

        toSheetRow() {
          return { id: this.id, date: this.date };
        }

        static fromSheetRow(data: Record<string, any>): DateModel {
          return new DateModel(String(data.id), new Date(data.date));
        }
      }

      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', date: 'Date' },
        fromSheetRow: DateModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Date'],
        ['1', '2025-01-01']
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      // Use explicit date with time to avoid timezone issues
      const entity = new DateModel('1', new Date(2025, 1, 15, 12, 0, 0)); // Feb 15, 2025 at noon
      const updates = [{ entity, rowNumber: 2 }];

      (repo as any).updateRows(updates, mockSpreadsheet);

      // Verify date is formatted correctly
      const batchRequest = mockSheets.Spreadsheets.Values.batchUpdate.mock.calls[0][0];
      const rowData = batchRequest.data[0].values[0];
      expect(rowData[1]).toMatch(/^2\/15\/2025/); // Date formatted as M/d/yyyy
    });

    it('should handle null values in updated rows', () => {
      class NullableModel implements DomainModel {
        constructor(
          public id: string,
          public name: string | null
        ) {}

        validate() {
          return { valid: true, errors: [] };
        }

        toSheetRow() {
          return { id: this.id, name: this.name };
        }

        static fromSheetRow(data: Record<string, any>): NullableModel {
          return new NullableModel(String(data.id), data.name || null);
        }
      }

      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', name: 'Name' },
        fromSheetRow: NullableModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Name'],
        ['1', 'Test']
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      const entity = new NullableModel('1', null);
      const updates = [{ entity, rowNumber: 2 }];

      (repo as any).updateRows(updates, mockSpreadsheet);

      // Verify null is preserved
      const batchRequest = mockSheets.Spreadsheets.Values.batchUpdate.mock.calls[0][0];
      const rowData = batchRequest.data[0].values[0];
      expect(rowData[1]).toBe(null);
    });

    it('should preserve formulas in updated rows', () => {
      class FormulaModel implements DomainModel {
        constructor(
          public id: string,
          public formula: string
        ) {}

        validate() {
          return { valid: true, errors: [] };
        }

        toSheetRow() {
          return { id: this.id, formula: this.formula };
        }

        static fromSheetRow(data: Record<string, any>): FormulaModel {
          return new FormulaModel(String(data.id), String(data.formula));
        }
      }

      const repo = new Repository({
        sheetName: 'Test Sheet',
        columnMappings: { id: 'ID', formula: 'Formula' },
        fromSheetRow: FormulaModel.fromSheetRow
      });

      mockSheet.getValues.mockReturnValue([
        ['ID', 'Formula'],
        ['1', '=A1+B1']
      ]);

      mockSpreadsheet.getId = vi.fn(() => 'spreadsheet-id-123');

      const entity = new FormulaModel('1', '=SUM(A1:A10)');
      const updates = [{ entity, rowNumber: 2 }];

      (repo as any).updateRows(updates, mockSpreadsheet);

      // Verify formula is preserved (not evaluated)
      const batchRequest = mockSheets.Spreadsheets.Values.batchUpdate.mock.calls[0][0];
      const rowData = batchRequest.data[0].values[0];
      expect(rowData[1]).toBe('=SUM(A1:A10)');
    });
  });
});

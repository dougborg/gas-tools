/**
 * @dougborg/gas-test-utils — Vitest mock factories for Google Apps Script
 * globals.
 *
 * Call `installGasGlobals()` once from your vitest setup file to wire up
 * `SpreadsheetApp`, `Logger`, `Utilities`, `Session`, `CacheService`,
 * `PropertiesService`, `UrlFetchApp`, and `Sheets` on `globalThis` as
 * `vi.fn()`-backed mocks. Consumers can override any of them in a
 * `beforeEach` to stage test-specific behavior.
 *
 * Options let you seed properties and other values that almost every test
 * suite overrides (`properties`, script cache defaults, utility returns).
 */

import { vi } from 'vitest';

/**
 * Options for {@link installGasGlobals}.
 */
export interface InstallGasGlobalsOptions {
  /**
   * Seed values for `PropertiesService.getScriptProperties().getProperty(key)`.
   * Keys not present return `null`. Tests can still override per-test via
   * `vi.fn().mockReturnValue(...)`.
   */
  properties?: Record<string, string | null>;
  /**
   * Value returned by `Utilities.getUuid()`. Defaults to
   * `'mock-uuid-12345'`.
   */
  uuid?: string;
  /**
   * Value returned by `Utilities.formatDate()`. Defaults to
   * `'1/1/2024 12:00:00'`.
   */
  formattedDate?: string;
}

/**
 * Install Vitest mocks for every GAS global the toolkit / ORM touch.
 *
 * Safe to call multiple times — each call replaces the previous globals.
 * Returns the mock objects for direct manipulation.
 */
export function installGasGlobals(options: InstallGasGlobalsOptions = {}): GasGlobalMocks {
  const properties = options.properties ?? {};
  const uuid = options.uuid ?? 'mock-uuid-12345';
  const formattedDate = options.formattedDate ?? '1/1/2024 12:00:00';

  const SpreadsheetApp = {
    getActiveSpreadsheet: vi.fn(),
    flush: vi.fn().mockImplementation(() => {
      // no-op in tests; prevents errors from production callers
    }),
    PivotTableSummarizeFunction: {
      SUM: 'SUM',
      COUNT: 'COUNT',
      COUNTA: 'COUNTA',
      AVERAGE: 'AVERAGE',
      MAX: 'MAX',
      MIN: 'MIN'
    },
    PivotValueDisplayType: {
      PERCENT_OF_GRAND_TOTAL: 'PERCENT_OF_GRAND_TOTAL',
      PERCENT_OF_ROW_TOTAL: 'PERCENT_OF_ROW_TOTAL',
      PERCENT_OF_COLUMN_TOTAL: 'PERCENT_OF_COLUMN_TOTAL',
      DEFAULT: 'DEFAULT'
    },
    newFilterCriteria: vi.fn().mockReturnValue({
      setVisibleValues: vi.fn().mockReturnValue({
        build: vi.fn().mockReturnValue({})
      })
    })
  };

  const Logger = {
    log: vi.fn()
  };

  const Utilities = {
    getUuid: vi.fn().mockReturnValue(uuid),
    formatDate: vi.fn().mockImplementation((_date, _timezone, _format) => formattedDate),
    sleep: vi.fn().mockImplementation((_ms: number) => {
      // no-op; prevents real delays
    })
  };

  const Session = {} as GoogleAppsScript.Base.Session;

  const CacheService = {
    getScriptCache: vi.fn().mockReturnValue({
      get: vi.fn(),
      put: vi.fn(),
      remove: vi.fn()
    })
  };

  const PropertiesService = {
    getScriptProperties: vi.fn().mockReturnValue({
      getProperty: vi.fn().mockImplementation((key: string) => properties[key] ?? null)
    }),
    getDocumentProperties: vi.fn().mockReturnValue({
      getProperty: vi.fn(),
      setProperty: vi.fn(),
      deleteProperty: vi.fn()
    })
  };

  const UrlFetchApp = {
    fetch: vi.fn()
  };

  const Sheets = {} as unknown;

  const g = globalThis as Record<string, unknown>;
  g.SpreadsheetApp = SpreadsheetApp;
  g.Logger = Logger;
  g.Utilities = Utilities;
  g.Session = Session;
  g.CacheService = CacheService;
  g.PropertiesService = PropertiesService;
  g.UrlFetchApp = UrlFetchApp;
  g.Sheets = Sheets;

  return { SpreadsheetApp, Logger, Utilities, Session, CacheService, PropertiesService, UrlFetchApp, Sheets };
}

/** Return type of {@link installGasGlobals} — all installed mocks. */
export interface GasGlobalMocks {
  SpreadsheetApp: ReturnType<typeof vi.fn> | unknown;
  Logger: { log: ReturnType<typeof vi.fn> };
  Utilities: Record<string, ReturnType<typeof vi.fn>>;
  Session: unknown;
  CacheService: { getScriptCache: ReturnType<typeof vi.fn> };
  PropertiesService: {
    getScriptProperties: ReturnType<typeof vi.fn>;
    getDocumentProperties: ReturnType<typeof vi.fn>;
  };
  UrlFetchApp: { fetch: ReturnType<typeof vi.fn> };
  Sheets: unknown;
}

/**
 * Reset every `vi.fn()` mock installed by {@link installGasGlobals}.
 * Call from `beforeEach` to clear call history between tests.
 */
export function resetAllMocks(): void {
  vi.clearAllMocks();
}

/**
 * Generic mock builder for `UrlFetchApp.fetch()` responses. Pass through
 * `response.getResponseCode()` / `getContentText()` / `getHeaders()` just
 * like real `HTTPResponse`.
 */
export function createMockResponse(
  data: unknown,
  code = 200,
  headers: Record<string, string> = {}
): {
  getResponseCode: () => number;
  getContentText: () => string;
  getHeaders: () => Record<string, string>;
  getAllHeaders: () => Record<string, string>;
} {
  return {
    getResponseCode: () => code,
    getContentText: () => JSON.stringify(data),
    getHeaders: () => headers,
    getAllHeaders: () => headers
  };
}

/**
 * Google Apps Script API Mocks for Local Development
 *
 * Provides mock implementations of common Google Apps Script globals
 * for local testing and development without deploying to Apps Script.
 */

export interface MockOptions {
  /** Enable verbose logging of mock calls */
  verbose?: boolean;
  /** Custom property values for PropertiesService */
  properties?: Record<string, string>;
  /** Mock sheet data for SpreadsheetApp */
  sheetData?: Record<string, any[][]>;
}

/**
 * Create mock Logger implementation
 */
export function createLoggerMock(options: MockOptions = {}) {
  return {
    log: (...args: any[]) => {
      if (options.verbose) {
        console.log('[GAS Logger]', ...args);
      }
    }
  };
}

/**
 * Create mock Utilities implementation
 */
export function createUtilitiesMock(options: MockOptions = {}) {
  return {
    getUuid: () => {
      const uuid = `mock-uuid-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      if (options.verbose) console.log('[GAS Utilities] getUuid:', uuid);
      return uuid;
    },
    formatDate: (date: Date, timezone: string, format: string) => {
      const formatted = date.toLocaleString();
      if (options.verbose) console.log('[GAS Utilities] formatDate:', { date, timezone, format, formatted });
      return formatted;
    },
    /**
     * WARNING: This mock does NOT actually pause execution!
     *
     * In the browser environment, synchronous sleep is not possible.
     * This function only logs the sleep call for debugging purposes.
     *
     * For async sleep in tests, use: `await new Promise(resolve => setTimeout(resolve, ms))`
     *
     * If your code relies on `Utilities.sleep()` for timing behavior, it will NOT work
     * correctly in the local dev environment. Consider redesigning to use async patterns.
     */
    sleep: (ms: number) => {
      if (options.verbose) console.log(`[GAS Utilities] sleep(${ms}ms)`);
      // In browser, we can't actually sleep synchronously, just log it
    },
    parseCsv: (csv: string) => {
      const lines = csv.split('\n');
      return lines.map((line) => line.split(','));
    },
    base64Encode: (data: string) => btoa(data),
    base64Decode: (data: string) => atob(data)
  };
}

/**
 * Create mock CacheService implementation
 */
export function createCacheServiceMock(options: MockOptions = {}) {
  const cache = new Map<string, string>();

  return {
    getScriptCache: () => ({
      get: (key: string) => {
        const value = cache.get(key) || null;
        if (options.verbose) console.log('[GAS Cache] get:', key, '→', value);
        return value;
      },
      put: (key: string, value: string, expirationInSeconds?: number) => {
        if (options.verbose) console.log('[GAS Cache] put:', key, '→', value, `(expires in ${expirationInSeconds}s)`);
        cache.set(key, value);
      },
      remove: (key: string) => {
        if (options.verbose) console.log('[GAS Cache] remove:', key);
        cache.delete(key);
      },
      getAll: (keys: string[]) => {
        const result: Record<string, string> = {};
        keys.forEach((key) => {
          const value = cache.get(key);
          if (value !== undefined) result[key] = value;
        });
        if (options.verbose) console.log('[GAS Cache] getAll:', keys, '→', result);
        return result;
      },
      putAll: (values: Record<string, string>, expirationInSeconds?: number) => {
        if (options.verbose) console.log('[GAS Cache] putAll:', values, `(expires in ${expirationInSeconds}s)`);
        Object.entries(values).forEach(([key, value]) => cache.set(key, value));
      },
      removeAll: (keys: string[]) => {
        if (options.verbose) console.log('[GAS Cache] removeAll:', keys);
        keys.forEach((key) => cache.delete(key));
      }
    })
  };
}

/**
 * Create mock PropertiesService implementation
 */
export function createPropertiesServiceMock(options: MockOptions = {}) {
  const scriptProperties = new Map<string, string>(Object.entries(options.properties || {}));
  const documentProperties = new Map<string, string>();
  const userProperties = new Map<string, string>();

  const createStore = (store: Map<string, string>, name: string) => ({
    getProperty: (key: string) => {
      const value = store.get(key) || null;
      if (options.verbose) console.log(`[GAS ${name}] getProperty:`, key, '→', value);
      return value;
    },
    setProperty: (key: string, value: string) => {
      if (options.verbose) console.log(`[GAS ${name}] setProperty:`, key, '→', value);
      store.set(key, value);
      return store;
    },
    deleteProperty: (key: string) => {
      if (options.verbose) console.log(`[GAS ${name}] deleteProperty:`, key);
      store.delete(key);
      return store;
    },
    getProperties: () => {
      const props = Object.fromEntries(store);
      if (options.verbose) console.log(`[GAS ${name}] getProperties:`, props);
      return props;
    },
    setProperties: (properties: Record<string, string>, deleteAllOthers?: boolean) => {
      if (deleteAllOthers) store.clear();
      Object.entries(properties).forEach(([key, value]) => store.set(key, value));
      if (options.verbose)
        console.log(`[GAS ${name}] setProperties:`, properties, `(deleteAllOthers: ${deleteAllOthers})`);
      return store;
    },
    deleteAllProperties: () => {
      if (options.verbose) console.log(`[GAS ${name}] deleteAllProperties`);
      store.clear();
      return store;
    },
    getKeys: () => {
      const keys = Array.from(store.keys());
      if (options.verbose) console.log(`[GAS ${name}] getKeys:`, keys);
      return keys;
    }
  });

  return {
    getScriptProperties: () => createStore(scriptProperties, 'ScriptProperties'),
    getDocumentProperties: () => createStore(documentProperties, 'DocumentProperties'),
    getUserProperties: () => createStore(userProperties, 'UserProperties')
  };
}

/**
 * Create mock UrlFetchApp implementation
 */
export function createUrlFetchAppMock(options: MockOptions = {}) {
  return {
    fetch: async (url: string, params?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions) => {
      if (options.verbose) {
        console.log('[GAS UrlFetchApp] fetch:', {
          url,
          method: params?.method || 'GET',
          headers: params?.headers,
          payload: params?.payload
        });
      }

      // Return a mock response - in real usage, you'd override this with actual fetch
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ mock: true }),
        getHeaders: () => ({}),
        getAllHeaders: () => ({})
      };
    },
    fetchAll: async (requests: GoogleAppsScript.URL_Fetch.URLFetchRequest[]) => {
      if (options.verbose) {
        console.log('[GAS UrlFetchApp] fetchAll:', requests.length, 'requests');
      }
      return requests.map(() => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ mock: true }),
        getHeaders: () => ({}),
        getAllHeaders: () => ({})
      }));
    }
  };
}

/**
 * Create mock SpreadsheetApp implementation with mock data
 */
export function createSpreadsheetAppMock(options: MockOptions = {}) {
  const sheetData = options.sheetData || {};

  const createRange = (data: any[][]) => ({
    getValues: () => {
      if (options.verbose) console.log('[GAS Range] getValues:', data);
      return data;
    },
    setValues: (values: any[][]) => {
      if (options.verbose) console.log('[GAS Range] setValues:', values);
      return createRange(values);
    },
    getValue: () => data[0]?.[0],
    setValue: (value: any) => {
      if (options.verbose) console.log('[GAS Range] setValue:', value);
      return createRange([[value]]);
    },
    getRow: () => 1,
    getColumn: () => 1,
    getNumRows: () => data.length,
    getNumColumns: () => data[0]?.length || 0
  });

  const createSheet = (name: string) => ({
    getName: () => name,
    getRange: (a1Notation: string) => {
      const data = sheetData[name] || [[]];
      if (options.verbose) console.log('[GAS Sheet] getRange:', a1Notation, 'from sheet:', name);
      return createRange(data);
    },
    getDataRange: () => {
      const data = sheetData[name] || [[]];
      if (options.verbose) console.log('[GAS Sheet] getDataRange from sheet:', name);
      return createRange(data);
    },
    getLastRow: () => (sheetData[name] || [[]]).length,
    getLastColumn: () => (sheetData[name]?.[0] || []).length,
    appendRow: (values: any[]) => {
      if (options.verbose) console.log('[GAS Sheet] appendRow:', values, 'to sheet:', name);
      if (!sheetData[name]) sheetData[name] = [];
      sheetData[name].push(values);
      return createSheet(name);
    },
    clear: () => {
      if (options.verbose) console.log('[GAS Sheet] clear:', name);
      sheetData[name] = [[]];
      return createSheet(name);
    }
  });

  return {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name: string) => {
        if (options.verbose) console.log('[GAS Spreadsheet] getSheetByName:', name);
        return createSheet(name);
      },
      getSheets: () => {
        const sheets = Object.keys(sheetData).map(createSheet);
        if (options.verbose) console.log('[GAS Spreadsheet] getSheets:', Object.keys(sheetData));
        return sheets;
      },
      getName: () => 'Mock Spreadsheet',
      getId: () => 'mock-spreadsheet-id',
      toast: (msg: string, title?: string, timeoutSeconds?: number) => {
        console.log(`[GAS Toast] ${title || 'Notification'}: ${msg} (${timeoutSeconds}s)`);
      }
    }),
    flush: () => {
      if (options.verbose) console.log('[GAS SpreadsheetApp] flush');
    }
  };
}

/**
 * Initialize all Google Apps Script mocks in the global scope
 * This should be called once at the start of your dev server
 */
export function initializeGASMocks(options: MockOptions = {}) {
  if (typeof window === 'undefined') {
    throw new Error('GAS mocks must be initialized in a browser environment');
  }

  if (options.verbose) {
    console.log('🚀 Initializing Google Apps Script mocks for local development');
  }

  // Adding GAS ambient globals to window for local dev-server use.
  const w = window as unknown as Record<string, unknown>;
  w.Logger = createLoggerMock(options);
  w.Utilities = createUtilitiesMock(options);
  w.CacheService = createCacheServiceMock(options);
  w.PropertiesService = createPropertiesServiceMock(options);
  w.UrlFetchApp = createUrlFetchAppMock(options);
  w.SpreadsheetApp = createSpreadsheetAppMock(options);
  w.Session = {} as GoogleAppsScript.Base.Session;
  w.Sheets = {};

  if (options.verbose) {
    console.log('✅ GAS mocks initialized successfully');
  }
}

/**
 * @gas-tools/dev-server
 *
 * Local development server and mocks for Google Apps Script projects
 *
 * @example
 * ```typescript
 * import { initializeGASMocks } from '@gas-tools/dev-server';
 *
 * // Initialize mocks with custom configuration
 * initializeGASMocks({
 *   verbose: true,
 *   properties: {
 *     KATANA_API_KEY: 'test-key'
 *   },
 *   sheetData: {
 *     'Orders': [['Order ID', 'Customer'], ['1001', 'John Doe']]
 *   }
 * });
 *
 * // Now you can use Apps Script globals locally
 * Logger.log('Hello from local dev!');
 * const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
 * ```
 */

export {
  createCacheServiceMock,
  createLoggerMock,
  createPropertiesServiceMock,
  createSpreadsheetAppMock,
  createUrlFetchAppMock,
  createUtilitiesMock,
  initializeGASMocks,
  type MockOptions
} from './mocks.js';

export { createDevConfig } from './vite-plugin.js';

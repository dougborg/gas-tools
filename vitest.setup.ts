// Workspace-wide vitest setup.
//
// Installs the GAS globals (`SpreadsheetApp`, `UrlFetchApp`, `Sheets`, ...)
// that Repository and friends reference at runtime. Individual test files
// override specific globals in `beforeEach` for per-test setup.
import { installGasGlobals } from '@dougborg/gas-test-utils';

installGasGlobals();

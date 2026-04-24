# @dougborg/gas-utils

Runtime helpers for Google Apps Script projects.

Three independent concerns, each also available as a subpath import:

- **`EnhancedLogger`** — structured logging with context, levels, and error/warning auto-capture. Wraps `Logger.log`.
- **`arrayFormulaProtection`** — detects `#NAME?` / `#REF!` / `#N/A` errors caused by malformed ARRAYFORMULA cells and auto-fixes them by rewriting the formula.
- **`visualFeedback`** — transient row/cell highlighting to give users feedback about sheet operations in progress.

These utilities are the runtime companions to [`@dougborg/gas-sheets-orm`](https://www.npmjs.com/package/@dougborg/gas-sheets-orm) and [`@dougborg/katana-sheets-toolkit`](https://www.npmjs.com/package/@dougborg/katana-sheets-toolkit), but work standalone — pick what you need.

## Install

```bash
npm install @dougborg/gas-utils
```

Peer dependency: `@types/google-apps-script` (tested against `^1` and `^2`).

This package is TypeScript source (no `dist/` yet at `0.1.x`). Bundle with Vite / esbuild / Rollup as part of your GAS project. See [`@dougborg/gas-dev-server`](https://www.npmjs.com/package/@dougborg/gas-dev-server) for a ready-made Vite config.

## Quick start

```ts
import { EnhancedLogger } from '@dougborg/gas-utils';

const log = new EnhancedLogger('OrderSync');
log.info('Starting sync', { batchSize: 50 });

try {
  syncOrders();
} catch (err) {
  log.error('Sync failed', err);
}
```

```ts
import { fixArrayFormulaErrors } from '@dougborg/gas-utils';

// Detect and repair broken ARRAYFORMULA cells in the active sheet.
const fixed = fixArrayFormulaErrors(SpreadsheetApp.getActiveSheet());
log.info(`Repaired ${fixed} broken ARRAYFORMULA cells`);
```

```ts
import { quickFlash } from '@dougborg/gas-utils';

const range = sheet.getRange('A1:D5');
quickFlash(range, '#ccffcc'); // flash green to confirm write succeeded
```

## Subpath imports

```ts
// Root barrel (re-exports everything)
import { EnhancedLogger } from '@dougborg/gas-utils';

// Tree-shaken subpaths
import { EnhancedLogger } from '@dougborg/gas-utils/enhancedLogger';
import { fixArrayFormulaErrors } from '@dougborg/gas-utils/arrayFormulaProtection';
import { quickFlash } from '@dougborg/gas-utils/visualFeedback';
```

## License

MIT © Doug Borg

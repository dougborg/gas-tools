# @dougborg/gas-dev-server

> Local development server and mocks for Google Apps Script projects

Stop deploying to Apps Script every time you want to test a change. Run your Apps Script code locally with instant feedback.

## Features

- ✅ **Full Apps Script API Mocks** - SpreadsheetApp, Logger, PropertiesService, and more
- ⚡ **Instant Feedback** - See changes in < 1 second (vs 30-60s deploy cycle)
- 🔧 **Configurable** - Provide mock data, custom properties, verbose logging
- 🎯 **TypeScript Support** - Full type definitions included
- 📦 **Zero Config** - Works out of the box with sensible defaults
- 🚀 **Vite Powered** - Fast HMR, modern dev experience

## Installation

```bash
npm install @dougborg/gas-dev-server --save-dev
```

## Quick Start

### 1. Create a dev HTML entry point

Create `dev/index.html` in your project:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Local Development</title>
  </head>
  <body>
    <h1>Apps Script Local Dev</h1>
    <button onclick="testFunction()">Test Function</button>
    <div id="output"></div>

    <script type="module">
      import { initializeGASMocks } from '@dougborg/gas-dev-server';
      import { myFunction } from '../src/index.ts';

      // Initialize mocks
      initializeGASMocks({
        verbose: true,
        properties: {
          KATANA_API_KEY: 'test-api-key'
        },
        sheetData: {
          'Orders': [
            ['Order ID', 'Customer', 'Status'],
            ['1001', 'John Doe', 'Pending'],
            ['1002', 'Jane Smith', 'Shipped']
          ]
        }
      });

      // Make function available globally
      window.testFunction = async () => {
        try {
          const result = await myFunction();
          document.getElementById('output').textContent = JSON.stringify(result, null, 2);
        } catch (error) {
          console.error(error);
        }
      };
    </script>
  </body>
</html>
```

### 2. Create a Vite dev config

Create `vite.dev.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { createDevConfig } from '@dougborg/gas-dev-server';

export default defineConfig(
  createDevConfig({
    port: 3000,
    mockOptions: {
      verbose: true
    }
  })
);
```

### 3. Add npm script

In your `package.json`:

```json
{
  "scripts": {
    "dev": "vite --config vite.dev.config.ts"
  }
}
```

### 4. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 and test your functions!

## API Reference

### `initializeGASMocks(options?)`

Initialize all Google Apps Script global mocks in the browser.

```typescript
interface MockOptions {
  /** Enable verbose logging of all mock calls */
  verbose?: boolean;

  /** Custom script properties */
  properties?: Record<string, string>;

  /** Mock sheet data by sheet name */
  sheetData?: Record<string, any[][]>;
}
```

**Example:**

```typescript
initializeGASMocks({
  verbose: true,
  properties: {
    KATANA_API_KEY: 'test-key',
    SHOPIFY_API_KEY: 'shop-key'
  },
  sheetData: {
    'Build Queue': [
      ['Order', 'Status'],
      ['#1001', 'In Progress']
    ]
  }
});
```

### Individual Mock Creators

If you need more control, you can create individual mocks:

```typescript
import {
  createLoggerMock,
  createSpreadsheetAppMock,
  createPropertiesServiceMock
} from '@dougborg/gas-dev-server/mocks';

// Create just what you need
const Logger = createLoggerMock({ verbose: true });
const SpreadsheetApp = createSpreadsheetAppMock({
  sheetData: { 'Orders': [[1, 2, 3]] }
});
```

### Available Mocks

- ✅ `Logger` - log()
- ✅ `Utilities` - getUuid(), formatDate(), sleep(), parseCsv(), base64Encode(), base64Decode()
- ✅ `CacheService` - Full cache implementation with get/put/remove/getAll/putAll
- ✅ `PropertiesService` - Script/Document/User properties with full CRUD
- ✅ `UrlFetchApp` - fetch(), fetchAll() (you can override with real fetch)
- ✅ `SpreadsheetApp` - getActiveSpreadsheet(), getSheetByName(), ranges, values
- ✅ `Session` - Empty object (extend as needed)
- ✅ `Sheets` - Empty object (Advanced Sheets Service)

## Advanced Usage

### Using with Existing Test Mocks

If you already have Vitest/Jest mocks (like in `tests/setup.ts`), you can reuse this library:

```typescript
// tests/setup.ts
import { vi } from 'vitest';
import {
  createLoggerMock,
  createSpreadsheetAppMock
} from '@dougborg/gas-dev-server/mocks';

// Use the same mocks for both testing and local dev!
(globalThis as any).Logger = createLoggerMock();
(globalThis as any).SpreadsheetApp = createSpreadsheetAppMock();
```

### Custom Mock Data from Files

```typescript
import mockData from './mock-data.json';

initializeGASMocks({
  sheetData: mockData.sheets,
  properties: mockData.properties
});
```

### Override Fetch for Real API Calls

```typescript
import { createUrlFetchAppMock } from '@dougborg/gas-dev-server/mocks';

const UrlFetchApp = createUrlFetchAppMock();

// Override fetch to make real HTTP calls
UrlFetchApp.fetch = async (url, options) => {
  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: options?.headers,
    body: options?.payload
  });

  return {
    getResponseCode: () => response.status,
    getContentText: () => response.text(),
    getHeaders: () => Object.fromEntries(response.headers),
    getAllHeaders: () => Object.fromEntries(response.headers)
  };
};

window.UrlFetchApp = UrlFetchApp;
```

## Example: Multi-Module Project

For projects with multiple Apps Script modules (e.g., `build-queue` and `bike-specs`):

```
dev/
├── build-queue/
│   └── index.html       # Dev page for build-queue
├── bike-specs/
│   └── index.html       # Dev page for bike-specs
└── shared-mock-data.ts  # Shared mock configuration

package.json:
{
  "scripts": {
    "dev:build-queue": "vite dev/build-queue --config vite.dev.config.ts",
    "dev:bike-specs": "vite dev/bike-specs --config vite.dev.config.ts"
  }
}
```

## Troubleshooting

### "SpreadsheetApp is not defined"

Make sure you call `initializeGASMocks()` before importing your Apps Script code:

```typescript
import { initializeGASMocks } from '@dougborg/gas-dev-server';

// Initialize first!
initializeGASMocks();

// Then import your code
import { myFunction } from './src/index.ts';
```

### "Cannot read property 'getSheetByName' of undefined"

The mock spreadsheet needs data. Provide it in `sheetData`:

```typescript
initializeGASMocks({
  sheetData: {
    'YourSheetName': [['some', 'data']]
  }
});
```

### Slow reload times

Make sure you're using the dev config, not the production build config. Check that `vite.dev.config.ts` is specified in your npm script.

## Comparison to Deployment

| Operation | Deploy Cycle | Local Dev |
|-----------|-------------|-----------|
| Code change → See result | 30-60 seconds | < 1 second |
| Function execution | In Apps Script | In browser |
| Debugging | Logger.log() | Browser DevTools |
| Data setup | Manual in Sheets | Mock data files |
| API calls | Real APIs | Mocks or real (your choice) |

## License

MIT

## Credits

Inspired by [apps-script-engine-template](https://github.com/WildH0g/apps-script-engine-template) by WildH0g.

Built with ❤️ for faster Apps Script development.

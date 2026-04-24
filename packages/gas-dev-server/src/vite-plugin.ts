/**
 * Vite configuration helpers for Google Apps Script development
 */

import type { UserConfig } from 'vite';
import type { MockOptions } from './mocks.js';

export interface DevServerOptions {
  /** Port for the dev server (default: 5173) */
  port?: number;
  /** Options for GAS mocks */
  mockOptions?: MockOptions;
  /** HTML entry point (default: 'index.html') */
  entry?: string;
}

/**
 * Create a Vite configuration for local Apps Script development
 *
 * @example
 * ```typescript
 * // vite.dev.config.ts
 * import { defineConfig } from 'vite';
 * import { createDevConfig } from '@gas-tools/dev-server';
 *
 * export default defineConfig(
 *   createDevConfig({
 *     port: 3000,
 *     mockOptions: {
 *       verbose: true,
 *       properties: { KATANA_API_KEY: 'test-key' }
 *     }
 *   })
 * );
 * ```
 */
export function createDevConfig(options: DevServerOptions = {}): UserConfig {
  const { port = 5173, entry = 'index.html' } = options;

  return {
    server: {
      port,
      open: true
    },
    build: {
      rollupOptions: {
        input: entry
      }
    }
  };
}

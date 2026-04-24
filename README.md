# @dougborg/gas-tools

Monorepo for reusable Google Apps Script (GAS) tooling under the `@dougborg` npm scope.

## Packages

| Package | Description |
|---|---|
| [`@dougborg/gas-utils`](./packages/gas-utils) | Runtime helpers: structured `EnhancedLogger`, `ARRAYFORMULA` error auto-fix, visual cell feedback. |
| [`@dougborg/gas-sheets-orm`](./packages/gas-sheets-orm) | Type-safe sheet-as-database primitives: `Repository<T>`, `SchemaRegistry`, `ValidationErrors`, `DomainModel`. |
| [`@dougborg/gas-test-utils`](./packages/gas-test-utils) | Vitest mock factories for GAS globals — `installGasGlobals()`, `createMockResponse()`. |
| [`@dougborg/gas-dev-server`](./packages/gas-dev-server) | Local Vite dev server + in-browser GAS mocks for iterating on GAS UIs without deploying. |

Each package is independently versioned and published. They share runtime concerns (GAS), but have no required cross-dependency — pick whichever you need.

## Dependency graph

```
gas-utils          gas-test-utils       gas-dev-server
    ↑                                          (standalone)
gas-sheets-orm
```

## Quick install

```bash
npm install @dougborg/gas-utils                 # runtime helpers
npm install @dougborg/gas-sheets-orm            # sheet ORM (depends on gas-utils)
npm install --save-dev @dougborg/gas-test-utils # vitest mocks
npm install --save-dev @dougborg/gas-dev-server # dev server / mocks
```

See each package's README for API docs and examples.

## Provenance

These packages were extracted from the [dougborg/build-queue-scripts](https://github.com/dougborg/build-queue-scripts) monorepo, where they evolved as internal tooling for a bike-manufacturing build queue app running on Google Apps Script + Katana MRP. Once the internal code matured and the generic/domain seam settled, the generic half was split out under `@dougborg/*` for reuse.

Katana-specific code lives in a sibling repo: [dougborg/katana-sheets-toolkit](https://github.com/dougborg/katana-sheets-toolkit) — `@dougborg/katana-sheets-toolkit`, which depends on `@dougborg/gas-utils` and `@dougborg/gas-sheets-orm` from this monorepo.

## Repository layout

```
gas-tools/
├── .github/workflows/
│   └── ci.yml                # lint + typecheck + test on push/PR (Node 22, 23)
├── packages/
│   ├── gas-utils/
│   ├── gas-sheets-orm/
│   ├── gas-test-utils/
│   └── gas-dev-server/
├── biome.json                # shared lint/format config
├── package.json              # npm workspaces; shared devDependencies
├── tsconfig.json             # shared TS base config
├── vitest.config.ts          # runs all package tests
└── README.md
```

## Development

```bash
npm install          # installs all workspace packages
npm run typecheck    # tsc --noEmit across all packages
npm run lint         # biome check
npm run test         # vitest across all packages
npm run quality      # typecheck + lint + test
```

## Contributing

Contributions welcome. Each package has its own CHANGELOG — bump versions per-package, not lockstep.

## License

MIT © Doug Borg. See each package's LICENSE file.

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
│   ├── ci.yml                # lint + typecheck + test on push/PR (Node 22, 26)
│   └── release.yml           # release-please + staged npm publish with provenance
├── packages/
│   ├── gas-utils/
│   ├── gas-sheets-orm/
│   ├── gas-test-utils/
│   └── gas-dev-server/
├── biome.json                # shared lint/format config
├── package.json              # npm workspaces; shared devDependencies
├── release-please-config.json    # one release-please component per package
├── .release-please-manifest.json # last released version of each package
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

Contributions welcome. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(gas-utils): ...`, `fix(gas-sheets-orm): ...`); release-please derives each package's next version and CHANGELOG entry from them. Never bump versions or edit CHANGELOGs by hand.

## Release

Merges to `main` use Conventional Commit messages.
The [release-please](https://github.com/googleapis/release-please) workflow (`.github/workflows/release.yml`) runs in manifest mode with one component per package: it keeps one release PR (`chore(release): release main`) that bumps only the packages with releasable commits (`feat`, `fix`, `perf`, `revert`, or a breaking change) under their directory, and updates each one's `CHANGELOG.md`.
Its `node-workspace` plugin also bumps `gas-sheets-orm`'s dependency range when `gas-utils` is released, and keeps the root `package-lock.json` in step.
Merging the release PR tags each released package separately (`gas-utils-v0.2.0`, `gas-sheets-orm-v0.1.1`, and so on) and creates its GitHub Release.

The workflow opens that PR with an installation token from the `dougborg-release-please` GitHub App (ID 4392719), so the required checks run on it.
The App is installed on all of the owner's repositories; this repository also needs the variable `RELEASE_PLEASE_APP_ID` set to `4392719` and the secret `RELEASE_PLEASE_APP_PRIVATE_KEY` holding its private key.
The repository owner sets them (the key is `github.release_please_app_private_key` in the SOPS secrets of `dougborg/dougborg-dot-net`); without them the release job fails instead of opening a release PR:

```bash
gh variable set RELEASE_PLEASE_APP_ID --repo dougborg/gas-tools --body 4392719
gh secret set RELEASE_PLEASE_APP_PRIVATE_KEY --repo dougborg/gas-tools < dougborg-release-please.private-key.pem
```

The publish job then runs once per released package, in the `npm` GitHub environment (deployments from `main` only).
It checks out that package's tag with the Node version in `.nvmrc`, installs without a cache, runs `npm run build` and `npm run quality`, and stages the version on npm from the package directory with [trusted publishing](https://docs.npmjs.com/trusted-publishers) and provenance, so the repository stores no npm token.
Each package's trusted publisher is `dougborg/gas-tools`, workflow `release.yml`, environment `npm`; renaming either breaks publishing.
The trusted publisher may only stage, so a maintainer approves each version with two-factor authentication before it goes live, using `npm stage list <package>` and `npm stage approve <stage-id>` or the Staged Packages tab on npmjs.com.
See [staged publishing](https://docs.npmjs.com/staged-publishing/).

Trusted publishing needs the package to exist on npm already, so each package's first version (`0.1.0`) is published once by hand, without provenance; every later version goes through the workflow.

## License

MIT © Doug Borg. See each package's LICENSE file.

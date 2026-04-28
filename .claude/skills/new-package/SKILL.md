---
name: new-package
description: Scaffold a new `packages/gas-*` package in this monorepo with the correct structure (src/, package.json, tsconfig.json, README.md, CHANGELOG.md, LICENSE) following existing conventions. Use when adding a new GAS-tooling package to publish under the `@dougborg/*` scope.
---

# /new-package — Scaffold a new gas-* package

## PURPOSE

Create a new workspace package under `packages/gas-<name>/` that conforms to the conventions of the existing four packages (`gas-utils`, `gas-sheets-orm`, `gas-test-utils`, `gas-dev-server`) so it builds, types, lints, tests, and publishes without further setup.

## CRITICAL

- **Use the existing packages as the template** — read `packages/gas-utils/package.json` and `packages/gas-utils/tsconfig.json` first; do not invent fields.
- **TypeScript-source-as-published** — `package.json` `exports` points at `./src/*.ts` directly. No build step except `gas-dev-server`.
- **Per-package independent versioning** — start at `0.1.0`. No lockstep with other packages.
- **Peer-dep `@types/google-apps-script`** — runtime packages declare it as a peerDependency so consumers control the version.

## ASSUMES

- The package name is provided as an argument (`/new-package my-thing` → `packages/gas-my-thing`).
- The user has agreed on the package's role and what it depends on (`gas-utils`? standalone?).
- You will follow up by adding actual source code — this skill creates the scaffolding only.

## STANDARD PATH

### 1. Confirm the name and role

The name must start with `gas-` (project convention). Confirm with the user:

- Final name: `gas-<slug>` (kebab-case)
- One-sentence description for `package.json` and `README.md`
- Runtime deps within the monorepo (`@dougborg/gas-utils` or none)
- Whether it has a build step (almost always: no)

### 2. Create the package directory

```
packages/gas-<slug>/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### 3. Use this `package.json` template

Match the structure of `packages/gas-utils/package.json`:

```jsonc
{
  "name": "@dougborg/gas-<slug>",
  "version": "0.1.0",
  "description": "<one-sentence-description>",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "files": ["src", "README.md", "CHANGELOG.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "sideEffects": false,
  "keywords": ["google-apps-script", "gas", "typescript"],
  "author": "Doug Borg <doug@spotbikes.com>",
  "license": "MIT",
  "peerDependencies": {
    "@types/google-apps-script": "^1.0.0 || ^2.0.0"
  },
  "devDependencies": {
    "@types/google-apps-script": "^2.0.0",
    "typescript": "^6.0.0"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/dougborg/gas-tools.git",
    "directory": "packages/gas-<slug>"
  }
}
```

If the package depends on `@dougborg/gas-utils`, add to `dependencies`:

```jsonc
"dependencies": {
  "@dougborg/gas-utils": "*"
}
```

The `"*"` resolves to the workspace package via npm workspaces — it is **not** an unbounded version range when published; npm rewrites it to the exact version on `npm publish`.

### 4. `tsconfig.json` template

Extend the root config:

```jsonc
{
  "extends": "../../tsconfig.json",
  "include": ["src/**/*"]
}
```

### 5. `src/index.ts` skeleton

```ts
/**
 * @dougborg/gas-<slug> — <one-sentence-description>
 */

export {};
```

Replace with real exports as code is added.

### 6. `README.md`, `CHANGELOG.md`, `LICENSE`

- README: copy `packages/gas-utils/README.md` as a starting point; replace name, description, and examples.
- CHANGELOG: start with one entry: `## 0.1.0 - <YYYY-MM-DD>\n\n- Initial release.`
- LICENSE: copy verbatim from `packages/gas-utils/LICENSE`.

### 7. Verify

```bash
npm install              # links the new workspace package
npm run quality          # typecheck + lint + test
```

`npm run quality` must be green before the scaffold is considered done.

### 8. Update root README

Add a row for the new package to the table in `/README.md`. Don't forget — it's the only place the project advertises what packages exist.

## EDGE CASES

- **Package needs a build step** — see `packages/gas-dev-server/` for the only such case. Add `"build": "tsc"`, ship `dist/`, point `exports` at `./dist/index.js`.
- **Package needs vitest as a runtime peer (not just dev)** — see `packages/gas-test-utils/`. Move `vitest` to `peerDependencies`, document the requirement in the README.
- **Adding tests** — colocate as `src/<module>.test.ts` or `src/__tests__/<module>.test.ts`. The root `vitest.config.ts` already discovers them.

## RELATED

- `/commit` — commit the scaffold with a `chore(gas-<slug>): scaffold package` message.
- `/feature-spec` — write a spec for what the package will actually do, before adding source.

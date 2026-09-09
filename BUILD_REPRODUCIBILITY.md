# Dash Ledger Build Reproducibility

Proof that the canonical source in `westkitty/dash_ledger_cc` can be cloned onto
a different machine and be reconstructed, tested, and built with **no hidden
local state**. This document is the durable reproducibility certificate.

## Verdict

**REPRODUCIBLE** — a fresh `git clone` of canonical `main`, followed by
`bun install --frozen-lockfile`, reconstructs the project and passes typecheck,
lint, the full 252-test suite (incl. under `TZ=Pacific/Kiritimati` and
`TZ=Pacific/Midway`), and produces the static `dist/` artifact, using only the
toolchain declared in the repository. No undeclared global, environment
variable, credential, mounted path, or machine-local file is required.

The one contract ambiguity found (a `bun.lock` shipped alongside README text
implying `npm install`) was resolved in the smallest safe way — see *Hidden
dependency audit*.

## Source identity

| | |
|---|---|
| Repository | `git@github.com:westkitty/dash_ledger_cc.git` |
| Branch | `main` |
| SHA proven | `20a514b2dc5e19bc60e5c22c5479a2c59f46ddc9` (canonical release) |
| Tracked files | 123 |
| Clean-clone method | `git clone --branch main --single-branch …` into a directory **outside** the development tree; no `node_modules`, `dist`, `*.tsbuildinfo`, `.env`, cache, or untracked file copied in |

## Toolchain

| | Value | Source of truth |
|---|---|---|
| Package manager | **Bun `1.3.12`** | `package.json` → `"packageManager": "bun@1.3.12"`; `bun.lock` is the **only** committed lockfile |
| Lockfile | `bun.lock` (`lockfileVersion: 1`, 539–550 resolved installs) | committed; matches `package.json` exactly |
| Runtime for the build tools | **Node.js ≥ 20.19** | `package.json` → `"engines": { "node": ">=20.19.0" }`; `.nvmrc` pins **`22`** |
| Verified on | macOS `Darwin arm64`, Node `v26.7.0`, npm `11.19.0`, Bun `1.3.12`; CI additionally verifies Node `22` on `ubuntu-latest` |

`tsc`, `vite`, `vitest`, and `eslint` execute on Node; Bun is used only to
resolve and install `node_modules` from the frozen lockfile. Scripts run
identically under `bun run <script>` or `npm run <script>` (npm ships with Node).

## Bootstrap command

```bash
bun install --frozen-lockfile
```

`--frozen-lockfile` makes the install fail rather than silently mutate
`bun.lock`; it is the reproducible path. Plain `bun install` / `npm install`
work for casual development but are not lockfile-frozen and `npm install` would
emit a competing `package-lock.json` (do not commit one).

## Validation commands

```bash
bun run typecheck   # tsc -b --noEmit
bun run lint        # eslint . --max-warnings 0
bun run test        # vitest run
bun run build       # tsc -b && vite build  -> dist/
TZ=Pacific/Kiritimati bun run test
TZ=Pacific/Midway    bun run test
```

## Test results (from the isolated clean clone)

| Check | Result |
|---|---|
| `bun install --frozen-lockfile` | 539 packages, exit 0, `bun.lock` unchanged |
| `typecheck` | clean, exit 0 |
| `lint` | clean, exit 0, **zero warnings** (`--max-warnings 0`) |
| `vitest run` | **252 passed / 252** across **28 files** |
| `vitest run` under `TZ=Pacific/Kiritimati` (UTC+14) | 252 / 252 |
| `vitest run` under `TZ=Pacific/Midway` (UTC−11) | 252 / 252 |
| `build` | exit 0 |

Count matches the release baseline (252 / 28) exactly.

## Build artifact

`bun run build` produced `dist/` with 12 files:

```
dist/index.html
dist/manifest.webmanifest
dist/sw.js
dist/workbox-2fbc6a65.js
dist/assets/index-<hash>.js          (~448 kB, ~137 kB gzip)
dist/assets/index-<hash>.css         (~20 kB)
dist/assets/virtual_pwa-register-<hash>.js
dist/assets/workbox-window.prod.es5-<hash>.js
dist/icons/favicon.svg
dist/icons/icon-192.png
dist/icons/icon-512.png
dist/icons/maskable-512.png
```

- `dist/index.html` present; asset references are all **relative** (`./assets/…`,
  `./icons/…`, `./manifest.webmanifest`) because `vite.config.ts` sets
  `base: './'`.
- `manifest.webmanifest` present — `name`/`short_name` "Dash Ledger",
  `display: standalone`, `scope`/`start_url` `./`, 192/512/maskable-512 icons.
- `sw.js` + `workbox-*.js` present — Workbox `generateSW`, 13 precache entries
  (shell + versioned assets only; never user data).
- No server-function output, no `.vercel/`, no `__server`, no backend.
- Structurally, every `<script>` / `<link>` / manifest icon path resolves to a
  file that exists in `dist/`.

## Hidden dependency audit

Searched the tracked source and the clean-clone build output.

| Check | Finding |
|---|---|
| Absolute `/Users/andrew/…` paths in tracked source | **none** |
| Absolute paths in built `dist/` | **none** |
| `$HOME` / `~`-relative project dependencies | **none** |
| Undeclared environment variables | **none** — the only `import.meta.env` use is `import.meta.env.PROD` (a Vite built-in) in `src/pwa/registerSW.ts` |
| Shell scripts calling undeclared globals | **none** (no `*.sh` in the repo) |
| `scripts/gen-icons.mjs` required by the build? | **no** — it is a one-off, dependency-free (`node:zlib`/`node:fs` only) generator; its output (`public/icons/*`) is committed and is what the build copies. Not referenced by any `package.json` script. |
| PWA icons / favicon present before build | **yes** — `public/icons/{favicon.svg,icon-192.png,icon-512.png,maskable-512.png}` are all tracked in git |
| Network-fetched runtime assets / CDN / remote fonts | **none** — no `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in runtime source; the only external URLs in the bundle are Dexie/React **error-message strings** (`bit.ly/2kdckMn`, `tinyurl.com/y2uuvskb`, `reactjs.org/docs/error-decoder`), never called |
| `localhost` assumptions in production output | **none** |
| Credentials / secrets | **none** |
| Generated source absent from git | **none found** — clean clone builds without generating any tracked source |
| Competing lockfiles | **fixed** — only `bun.lock`; `package.json` now declares `packageManager: bun@1.3.12`; README states `--frozen-lockfile` is the reproducible path |

## Environment requirements

- **Node.js ≥ 20.19** (pinned to 22 via `.nvmrc`; verified on 22 and 26).
- **Bun ≥ 1.3** (pinned to `1.3.12` via `packageManager`).
- `git`.
- Nothing else. No database, no browser, no service, no account, no env file, no
  global npm package.

## Unsupported assumptions

### `file://` — NOT supported (documentation corrected)

Earlier draft docs (`PROJECT_COMPLETION_REPORT.md`, `COMPARATIVE_RECON.md`) said
the app "runs from any static host **or `file://`**". That is false for this
build and has been corrected:

- the built `dist/index.html` entry is `<script type="module" crossorigin
  src="./assets/…">` — **ES-module scripts are CORS-blocked on `file://`** in
  every browser (origin `null`), so the app cannot bootstrap;
- the PWA layer registers a **service worker**, which requires a secure context
  — `file://` is not one, so no offline caching or install.

**Supported deployment target: any ordinary static HTTP(S) host** (including
`http://localhost` for local preview). See `DEPLOYMENT.md`.

### CI execution

The workflow contract is validated locally (YAML shape, action pins, script
existence, permissions, artifact path). Whether GitHub Actions has produced a
run is reported separately in the session notes — do not assume a run occurred
just because the workflow file exists.

## Continuous integration

`.github/workflows/ci.yml` runs on every **push to `main`** and every **pull
request targeting `main`** (plus manual `workflow_dispatch`), from a clean
`ubuntu-latest` runner:

| Job | Steps |
|---|---|
| `validate` | checkout → `actions/setup-node` (from `.nvmrc`) → `oven-sh/setup-bun@v2` (`1.3.12`) → `bun install --frozen-lockfile` → `bun run typecheck` → `bun run lint` → `bun run test` → `bun run build` → sanity-check `dist/` → **upload `dist/` as artifact** `dash-ledger-dist-<sha>` (14-day retention) |
| `timezone` (matrix) | same setup, then `bun run test` under `TZ=Pacific/Kiritimati` and `TZ=Pacific/Midway` |

- **Permissions:** `contents: read` only. No write scope, no secrets, no
  third-party actions beyond `oven-sh/setup-bun` (Bun's own org — required to
  install the declared package manager).
- **CI never deploys, publishes, tags, or releases.** The uploaded `dist/` is an
  inspectable build artifact, not a deployment. `dist/` is git-ignored and never
  committed.
- **Local equivalent:** exactly the `bun run …` commands above.

## Reproduction procedure (another machine)

```bash
# 1. Toolchain
#    Node >= 20.19 (nvm: `nvm install`), Bun >= 1.3 (https://bun.sh)

# 2. Clone canonical source
git clone --branch main --single-branch \
  https://github.com/westkitty/dash_ledger_cc.git dash_ledger_cc
cd dash_ledger_cc
git rev-parse HEAD        # expect 20a514b2dc5e19bc60e5c22c5479a2c59f46ddc9

# 3. Install exactly what is locked
bun install --frozen-lockfile

# 4. Validate
bun run typecheck
bun run lint
bun run test
TZ=Pacific/Kiritimati bun run test
TZ=Pacific/Midway    bun run test

# 5. Build the static artifact
bun run build            # -> dist/

# 6. Preview over HTTP (NOT file://)
bun run preview          # serves dist/ on http://localhost:4173
```

## Known limitations

- **No physical iOS/Safari device** was available; PWA install, iOS storage
  eviction, and on-device Web Share are un-run (unchanged from the release gate).
- **Browser file-save delivery** of exports (`<a download>` / Web Share) could
  not be exercised in the CI/sandbox environment; export *content* is verified.
- **Reproducibility is verified on macOS/arm64 + Linux (CI, ubuntu-latest)**;
  Windows was not exercised, though nothing in the toolchain is platform-specific.
- The `dist/` asset filenames contain content hashes, so byte-identical output
  across machines depends on identical tool versions; the *structure and
  behaviour* are reproducible, individual hashes may differ if a transitive dep
  resolves differently outside `--frozen-lockfile`.

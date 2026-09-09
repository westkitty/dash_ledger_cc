# Dash Ledger Deployment

How to take source from GitHub and get a usable static application onto a host.
Provider-neutral. **This repository does not deploy anywhere itself** — there is
no deploy step in CI, no GitHub Pages, no release.

## Build

```bash
bun install --frozen-lockfile
bun run build
```

(`bun` is the declared package manager — `package.json` → `packageManager`;
`bun.lock` is the only lockfile. `npm run build` works too but `npm install`
would create a competing `package-lock.json` — don't commit one. Node ≥ 20.19,
pinned to 22 in `.nvmrc`.)

## Output

`bun run build` writes the entire distributable app to **`dist/`** — ordinary
static files, no server component:

```
dist/index.html                 entry (ES-module script, relative asset URLs)
dist/manifest.webmanifest        PWA manifest (name, icons, standalone, scope ./)
dist/sw.js                       Workbox service worker (generateSW)
dist/workbox-*.js                Workbox runtime
dist/assets/index-<hash>.js      app bundle (~448 kB / ~137 kB gzip)
dist/assets/index-<hash>.css     styles
dist/assets/virtual_pwa-register-<hash>.js
dist/assets/workbox-window.prod.es5-<hash>.js
dist/icons/{favicon.svg,icon-192.png,icon-512.png,maskable-512.png}
```

The **source repository is not the deployed app**. Only the built `dist/` is.
`dist/` is git-ignored and is never committed; CI uploads it as a workflow
artifact for inspection.

## Static-host requirements

- Serve the **contents of `dist/`** at some path on a static HTTP(S) server.
- **`base` is `./` (relative)**, so it works both at a domain root
  (`https://ledger.example/`) and under a sub-path
  (`https://user.github.io/dash_ledger_cc/`) with no rebuild.
- **No URL-rewrite / SPA-fallback rule is required** — routing is hash-based
  (see below). If your host supports it, a fallback of unknown paths to
  `index.html` is harmless but unnecessary; the service worker already registers
  a `navigateFallback` to `index.html`.
- Serve `sw.js` with a short/again-revalidated cache lifetime (most static hosts
  do this for `.js` by default; Workbox also self-updates). Never serve `sw.js`
  from a long immutable cache.
- Serve the correct `Content-Type` for `.webmanifest`
  (`application/manifest+json`) and `.svg`.

Works on: GitHub Pages, Netlify, Vercel (as a static site), Cloudflare Pages,
S3 + CloudFront, nginx/Apache serving a directory, `python -m http.server`, etc.

## HTTPS / secure-context considerations

- **A secure context is required for the PWA layer.** Service workers,
  `navigator.storage.persist()`, and installability only work on **`https://`**
  or **`http://localhost`** (and `http://127.0.0.1`). Plain `http://` on a LAN
  IP or a non-localhost hostname will load the app but **the service worker will
  not register** (no offline caching, no install prompt). IndexedDB itself still
  works over plain HTTP, so the app is usable but not a full PWA.
- Use HTTPS in production. Most static hosts provision a certificate
  automatically.

## Service worker / PWA notes

- Precache scope is **the app shell + versioned assets only**
  (`js/css/html/svg/png/woff2`). User records live in IndexedDB and are **never**
  touched by the service worker.
- Update flow is `registerType: 'prompt'` with `skipWaiting: false`: when a new
  build is deployed, the running app shows an unobtrusive "Update available"
  banner and only swaps to the new version when the user taps it — an
  in-progress form is never discarded by an update.
- `manifest.webmanifest`: `display: standalone`, `start_url`/`scope` `./`,
  192 / 512 / maskable-512 icons, `theme_color` `#0f766e`.
- iOS: `apple-touch-icon` and `apple-mobile-web-app-*` meta tags are present;
  add-to-home-screen works from Safari. (Not verified on a physical device —
  see `PROJECT_COMPLETION_REPORT.md` known limitations.)

## Hash routing

Every route is a URL fragment: `#/`, `#/week`, `#/vault?s=backup`,
`#/dash/<id>`, `#/vault?s=recovery`, etc. The server only ever sees a request
for `index.html` (or an asset). This is why no host rewrite rule is needed and
why deep links survive a hard refresh on any static host.

## Browser-origin data model — READ THIS BEFORE MOVING HOSTS

**All of a user's records live in the browser's IndexedDB, keyed to the exact
origin** (`scheme://host:port`) the app was loaded from. The canonical database
name is `dash-ledger-canonical-v2`.

Consequences:

- `https://ledger.a.example/` and `https://ledger.b.example/` are **different
  origins**. A user with data on `a` who opens `b` sees an **empty ledger** —
  the data did not move. Nothing about IndexedDB travels with the Git repo, with
  a deploy, or with a DNS change.
- The same is true for `http://localhost:5173` vs `http://localhost:4173` vs a
  production domain — each is its own origin with its own database.
- Sub-path vs root on the *same* host+port is the *same* origin, so data is
  shared there.

**The portable user-data mechanism is the in-app backup / export**, not the
deployment:

> Tax / Vault → **Backup** → *Export full backup (.json)* — a self-contained
> file (receipt images embedded). Also *Ledger-only JSON* and CSVs.
>
> Tax / Vault → **Recovery** — import a backup file (or a legacy database) into
> the current origin, through the validated two-step safety-backup restore.

## Moving between hosts

To carry a user's ledger from an old deployment/origin to a new one:

1. On the **old** origin: Tax / Vault → Backup → **Export full backup (.json)**.
   Confirm "I saved / archived a backup" once the file is stored somewhere safe.
2. Deploy the app to the **new** origin and open it (it starts empty).
3. On the **new** origin: Tax / Vault → **Recovery** (or Backup → Restore) →
   choose the `.json` file → save the safety backup → **Replace everything with
   this backup**.

Do this per browser / per device. There is no server to sync from.

## Cache / update behavior

- On a new deploy, returning visitors keep running the cached version until they
  see and accept the "Update available" banner (or fully close and reopen the
  app). This is deliberate — no forced reload mid-work.
- A user can force the newest version by closing all tabs of the app and
  reopening, or via the browser's "reload" while online.
- Hard cache problems (a wedged service worker) are resolved by the browser's
  "Clear site data" for that origin **only as a last resort** — and note the
  warning below.

## Rollback

Distinguish two independent things:

| Roll back… | How | Effect on user data |
|---|---|---|
| **Application code** | Re-deploy the `dist/` from an earlier commit (or an earlier CI artifact). Users pick it up via the normal update banner. | **None.** IndexedDB is untouched. Schema is still `version(1)`; the model has not changed across the release history. |
| **A user's records** | The user restores one of their own backup `.json` files via Tax / Vault → Recovery. | Replaces that origin's IndexedDB in one transaction, after a safety backup. |

**Never tell a user to delete IndexedDB / "Clear site data" to roll back code.**
That destroys their records and does nothing to the code. Code lives on the
host; data lives in the browser. Roll back the deploy, or have the user restore
a backup — not both confused for each other.

## Unsupported: direct `file://`

`dist/index.html` **cannot be opened directly from the filesystem
(`file://…/index.html`)**. Two hard browser constraints:

- the entry is `<script type="module" crossorigin>` — ES-module scripts are
  **CORS-blocked on `file://`** (origin `null`), so the app never boots;
- the service worker needs a secure context, which `file://` is not.

Any earlier note that Dash Ledger "runs from `file://`" is wrong and has been
corrected (see `BUILD_REPRODUCIBILITY.md`). Use `bun run preview` locally, or
any static HTTP(S) host.

## Local preview

```bash
bun run build
bun run preview     # serves dist/ on http://localhost:4173
```

`bun run dev` (Vite dev server on `http://localhost:5173`) is for development,
not a production server. Neither `dev` nor `preview` is a deployment.

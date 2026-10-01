# Dash Ledger ChatGPT plugin package

Portable Agent Plugins source for public directory submission.

## Layout

- `plugin.json` — Agent Plugins manifest, listing metadata, review cases, publication notes.
- `mcp.json` — remote Streamable HTTP MCP declaration.
- `skills/dash-ledger/` — Dash Ledger workflow Skill and references.
- `assets/` — listing / composer icons.
- `scripts/validate.mjs` — package guard.
- `scripts/package.mjs` — configure MCP URL, validate, and emit `dist-plugin/*.zip`.

## Package for upload

```sh
node plugin/scripts/package.mjs https://dash-ledger-gpt-bridge.atlas-of-one.workers.dev/mcp
```

Public listing URLs point at GitHub Pages:

- Website: `https://westkitty.github.io/dash_ledger_cc/`
- Support / Privacy / Terms: `.../support/`, `.../privacy/`, `.../terms/`

Do not put reviewer credentials, login secrets, or Keychain values in this package or ZIP.

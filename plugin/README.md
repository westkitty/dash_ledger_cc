# Dash Ledger ChatGPT plugin package

This directory contains the portable Agent Plugins source package.

## Source layout

- `plugin.json` — portable plugin manifest.
- `mcp.json` — remote Streamable HTTP MCP declaration.
- `skills/dash-ledger/` — Dash Ledger workflow Skill and references.
- `scripts/validate.mjs` — deterministic source/package guard.
- `scripts/configure-mcp.mjs` — replaces the reserved pre-deployment MCP URL.

## Important: source is intentionally not upload-ready until deployment

The committed `mcp.json` points to:

`https://dash-ledger-mcp.invalid/mcp`

The `.invalid` TLD is deliberate. It prevents the repository package from silently pointing at an unverified or stale production endpoint.

After the Worker is actually deployed:

```sh
node plugin/scripts/configure-mcp.mjs https://YOUR-WORKER.workers.dev/mcp
node plugin/scripts/validate.mjs
```

Do not commit private credentials. The MCP URL itself is public configuration and can be committed after the production endpoint is intentionally selected.

## Private-first release

The first target is a private/custom plugin test, not public directory submission. Public review metadata such as support/privacy/terms URLs is intentionally deferred until public distribution is actually desired.

# Dash Ledger GPT Bridge Worker

This Worker is the optional remote bridge between ChatGPT and Dash Ledger.

## Architectural boundary

- Browser IndexedDB remains the canonical ledger.
- D1 stores only the current minimized mirror plus pending GPT proposals.
- Receipt images are not accepted by the sync contract.
- The Worker performs no OpenAI API calls.
- The Worker is designed for Cloudflare Workers Free + D1 Free + KV Free.
- Free-tier exhaustion must degrade or fail; it must never trigger an automatic paid upgrade.

## Implemented in source

- OAuth 2.1 protected `/mcp` endpoint using `@cloudflare/workers-oauth-provider`.
- Stateless MCP handler using Cloudflare's current `createMcpHandler` path.
- D1 current-snapshot mirror.
- Device pairing for the PWA.
- Manual snapshot sync.
- Freshness reporting.
- Read-only ledger tools and deterministic calculations.
- Idempotent expense and shift-update proposal queue.
- PWA-facing proposal inbox endpoints.
- Internal daily circuit breakers.

## Before first deployment

The committed `wrangler.jsonc` contains valid-shaped placeholder binding IDs. Do not deploy it unchanged.

1. Re-check current Cloudflare Free terms.
2. Create one D1 database on Workers Free.
3. Create one KV namespace on Workers Free.
4. Replace the placeholder D1 and KV IDs in `wrangler.jsonc`.
5. Set two different high-entropy Worker secrets:
   - `AUTH_PEPPER`
   - `BOOTSTRAP_SECRET`
6. Apply D1 migrations.
7. Deploy the Worker.
8. Bootstrap each private user with `POST /admin/bootstrap-user`.
9. Pair each Dash Ledger browser from Settings -> GPT Bridge.
10. Generate the plugin package using the real deployed `/mcp` URL.
11. Connect and test privately before public submission.

Never commit either secret.

## Local checks

```sh
npm install
npm run check
```

The build command is a Wrangler dry-run. Real deployment is deliberately separate.

## Bootstrap example

```sh
curl -X POST "https://YOUR-WORKER.workers.dev/admin/bootstrap-user" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"userId":"andrew","displayLabel":"Andrew","loginSecret":"LONG_RANDOM_LOGIN_SECRET"}'
```

Use a cryptographically random login secret of at least 24 characters.

## Cost stop condition

Before every deployment, re-check current Cloudflare Free limits. If ordinary private use can create automatic billable overage, do not deploy this architecture until the zero-cost contract is restored.

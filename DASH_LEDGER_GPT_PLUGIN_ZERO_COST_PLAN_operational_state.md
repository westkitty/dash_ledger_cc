# Operational State: Dash Ledger GPT Bridge Plan

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "dash-ledger-gpt-bridge",
  "project_name": "Dash Ledger GPT Bridge",
  "project_root": ".",
  "artifact_path": "DASH_LEDGER_GPT_PLUGIN_ZERO_COST_PLAN.md",
  "state_revision": 2,
  "last_updated": "2026-10-01",
  "current_baseline": {
    "identity": "worker deployed + PWA bridge on feature/gpt-bridge-zero-cost",
    "state": "implemented-partially-verified",
    "last_verified": "2026-10-01"
  },
  "scope_boundaries": [
    "Optional zero-cost GPT Bridge: Cloudflare Worker + D1 mirror + KV OAuth + PWA sync/inbox + plugin package",
    "IndexedDB remains canonical; Cloudflare is disposable mirror/proposal bridge only"
  ],
  "linked_parent_state": "OPERATIONAL_STATE.md"
}
-->

## 1. Project Identity and Scope

- **Project ID:** dash-ledger-gpt-bridge
- **Purpose:** Optional zero-cost ChatGPT plugin/MCP bridge without replacing local-first canonical ledger.
- **Primary artifact:** DASH_LEDGER_GPT_PLUGIN_ZERO_COST_PLAN.md
- **Parent project:** westkitty/dash_ledger_cc
- **Canonical authority:** Browser IndexedDB (`dash-ledger-canonical-v2`); Cloudflare D1 is a disposable mirror + proposal inbox only.

## 2. Current Baseline

- **Branch:** `feature/gpt-bridge-zero-cost` (PR #5).
- **Live Worker:** `https://dash-ledger-gpt-bridge.atlas-of-one.workers.dev`
- **D1:** `dash-ledger-gpt-bridge` (`c032561a-3bd4-45ec-9f1d-0e0cf7c6ecd5`); migration `0001` applied.
- **KV:** `dash-ledger-oauth` (`a00990dfb8a04d90bcdfe046cfab1f9c`).
- **Secrets present (names only):** `AUTH_PEPPER`, `BOOTSTRAP_SECRET` (values in Cloudflare + macOS Keychain; never in repo).
- **Bootstrapped private user:** `andrew` / Andrew (login secret in Keychain service `dash-ledger-gpt-login-andrew`).
- **Plugin package:** `dist-plugin/dash-ledger-plugin-5f468a8efe6a.zip` (gitignored); `plugin/mcp.json` points at live `/mcp`.
- **ChatGPT install:** NOT completed in this session — requires manual ChatGPT Developer mode UI (see Pending).

## 3. Artifact Contract

Cloudflare stores only a minimized structured mirror and GPT proposals. Ordinary Dash Ledger use remains offline-capable with the bridge disconnected. No OpenAI API calls from the app or Worker. No tunnels. Free-tier hard-stop (no auto overage) rechecked 2026-10-01.

## 4. Active Invariants

- **INV-001 — Zero incremental infrastructure cost:** Workers/D1/KV Free; exceed limits fail closed.
- **INV-002 — Local canonical authority:** IndexedDB remains authoritative.
- **INV-003 — Optional bridge:** Disabled/disconnected restores serverless PWA behavior.
- **INV-004 — No tunnel / no always-on Mac / no VPS.**
- **INV-005 — No receipt images; no mirrored historical merchants or freeform notes.**
- **INV-006 — GPT mutations are proposals only; local Accept uses repository `createExpense` / `updateShift`.**

## 5. Verified Working Behavior

- **VER-001:** Root `typecheck` / `lint` / `test` (255) / `build` green locally after bridge changes.
- **VER-002:** Worker `npm run check` green (typecheck, 7 tests, dry-run build).
- **VER-003:** Live `GET /health` returns service identity, `canonicalLedger: browser-indexeddb`, `costModel: free-tier-only`.
- **VER-004:** Unauthenticated `/mcp` → 401 with no private payload; `/sync/*` bad bearer → 401; CORS allows GitHub Pages + local Vite origins only.
- **VER-005:** OAuth discovery endpoints respond (`oauth-authorization-server`, protected-resource metadata).
- **VER-006:** Synthetic disposable-user smoke: pair → tiny `dash-ledger-gpt-sync-v1` sync → unchanged retry → inbox reject/accept API → disconnect deletes cloud copy / revokes device (token 401 after).
- **VER-007:** Unit/integration: `applyGptProposal` expense path via `createExpense`; shift_update via `updateShift`; privacy snapshot excludes notes/merchants/receipts.
- **VER-008:** Disconnect path best-effort revokes OAuth grants via `listUserGrants`/`revokeGrant` then wipes D1 mirror rows (not the user credential row).

## 6. Known Not Working / Incomplete

- **KNW-001:** End-to-end ChatGPT Developer-mode install + OAuth consent + live MCP tool call from ChatGPT UI not performed (manual).
- **KNW-002:** Full MCP `queue_*` idempotency under real OAuth access token not exercised live (D1/API resolve + code-path idempotency covered; MCP OAuth tool path remains ChatGPT-manual).

## 7. Implemented but Unverified

- **UNV-001:** Physical mobile ChatGPT Android/iPhone MCP surface parity.
- **UNV-002:** GitHub Pages serving the post-merge PWA with default Worker URL (pending merge to `main`).

## 8. Unknown or Evidence-Stale State

- **UNK-001:** Long-term free-tier quota headroom under real Andrew/Greyson usage (circuit breakers exist; field measurement pending).

## 9. Pending Work

- **PND-001:** Manual ChatGPT: Settings → Security and login → enable Developer mode → ChatGPT Plugins → + → paste `https://dash-ledger-gpt-bridge.atlas-of-one.workers.dev/mcp` → create → complete OAuth as `andrew` → install from personal plugins → verify `@Dash Ledger` tool calls in a Work chat.
- **PND-002:** Squash-merge PR #5 when fresh Actions green; confirm Pages deploy of default endpoint.
- **PND-003:** Optional later: Greyson bootstrap + field trial metrics.

## 10. Active Decisions, Defaults, and Prohibitions

- **DEC-001:** One-way mirror + proposal inbox (no direct remote canonical mutation).
- **DEC-002:** Default PWA Worker base URL is the live workers.dev endpoint; field remains editable for diagnostics.
- **DEC-003:** Keep `@modelcontextprotocol/server@2.0.0` and `agents@0.24.0` unless full compat proven.
- **DEC-004:** Never commit secrets; Keychain services: `dash-ledger-gpt-bootstrap-secret`, `dash-ledger-gpt-login-andrew`.

## 11. Validation and Evidence Matrix

| ID | Claim | State | Evidence | Last checked |
|---|---|---|---|---|
| VER-001 | Root suite green | verified | local bun typecheck/lint/test/build | 2026-10-01 |
| VER-002 | Worker check green | verified | npm run check | 2026-10-01 |
| VER-003 | Live health | verified | GET /health | 2026-10-01 |
| VER-006 | Synthetic sync/inbox/disconnect | verified | live curl smoke | 2026-10-01 |
| KNW-001 | ChatGPT UI install | not done | manual remaining | 2026-10-01 |

## 12. Compact Revision Log

### Revision 2 — 2026-10-01

- Deployed Worker to workers.dev; set secrets metadata; bootstrapped andrew; live synthetic smoke; PWA default endpoint; OAuth revoke on disconnect; plugin package built; ChatGPT install remains manual.

### Revision 1 — 2026-10-01

- Planning-only state created with the zero-cost plan.

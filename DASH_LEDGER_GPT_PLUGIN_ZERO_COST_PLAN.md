# Dash Ledger GPT Plugin — Zero-Cost Implementation Plan

**Status:** Planning only. Not implemented.
**Prepared:** 2026-10-01
**Repository:** westkitty/dash_ledger_cc
**Baseline inspected:** main at 1cdd22b80c22738134d231d6f37fb444a7ed18d5
**Primary constraint:** Incremental infrastructure cost must remain $0.
**Architecture principle:** Preserve Dash Ledger's existing local-first/offline authority. The GPT integration is an optional disposable bridge, not a replacement cloud database.

---

## 1. Executive architecture decision

Do not convert Dash Ledger into a conventional cloud application merely to expose it to ChatGPT.

The existing application deliberately uses browser IndexedDB as the authoritative ledger, works offline, requires no account, has no backend, and has no telemetry. Those properties are strengths and must remain intact.

The GPT integration therefore uses this model:

    CHATGPT
       |
       | OAuth 2.1
       v
    Cloudflare Worker (Free)
       |
       | /mcp
       | /authorize
       | /oauth/token
       | /sync/*
       |
       +---- Cloudflare D1 (Free)
       |       structured read mirror
       |       + GPT proposal inbox
       |
       +---- Cloudflare KV (Free)
               OAuth state / grants / tokens

    Existing Dash Ledger PWA on GitHub Pages
       |
       +---- IndexedDB = canonical ledger
       |
       +---- explicit optional HTTPS sync to Worker

The crucial distinction is:

**Cloudflare stores a disposable GPT mirror. IndexedDB remains the canonical ledger.**

If the entire Cloudflare side disappears, Dash Ledger must still open, work offline, preserve all canonical records, export backups, and behave as the existing application does today.

---

## 2. Non-negotiable project invariants

| ID | Constraint |
|---|---|
| GPT-001 | Incremental infrastructure cost remains $0. |
| GPT-002 | No Secure MCP Tunnel, ngrok, Tailscale exposure, home server, MacBook daemon, or Big Mac dependency. |
| GPT-003 | Existing IndexedDB remains the canonical ledger. |
| GPT-004 | GPT integration is disabled by default and explicitly opt-in. |
| GPT-005 | Disabling GPT integration restores effectively the current serverless behavior. |
| GPT-006 | Normal Dash Ledger use continues working completely offline. |
| GPT-007 | No OpenAI API calls from Dash Ledger or the Worker. |
| GPT-008 | No paid authentication provider. |
| GPT-009 | No custom domain required. Use the free workers.dev endpoint. |
| GPT-010 | No receipt image bytes are uploaded in the initial architecture. |
| GPT-011 | No remote mutation may silently overwrite local canonical data. |
| GPT-012 | Conflicts are surfaced, never guessed away. |
| GPT-013 | Money remains integer cents everywhere. |
| GPT-014 | Dates retain Dash Ledger's local-calendar semantics. |
| GPT-015 | Remote calculations reproduce the application's domain calculations or fail validation. |
| GPT-016 | Cloud quota exhaustion causes degraded service, never an automatic paid upgrade. |
| GPT-017 | Authentication secrets never enter backups or exports. |
| GPT-018 | Tool names make side effects explicit. |
| GPT-019 | GPT reports only data actually synchronized to the bridge. |
| GPT-020 | Mutable market facts are never silently substituted for field evidence. |

---

## 3. Existing repository seams to preserve

The current application is a static Vite + React + TypeScript + Dexie PWA.

Important existing boundaries:

- src/domain — pure calculations and financial logic.
- src/db — IndexedDB schema and repositories; authoritative browser persistence.
- src/services — backup, restore, CSV, Tax Binder, receipts, diagnostics, etc.
- src/state — application snapshot and mutation plumbing.
- src/features — user-facing application flows.
- GitHub Pages — static deployment.
- IndexedDB database name — dash-ledger-canonical-v2.
- Money — integer cents.
- Local work dates — YYYY-MM-DD local calendar semantics.
- Legacy databases — read-only recovery/import sources.

The GPT integration must not move authoritative financial formulas into React components, bypass the repository layer, mutate legacy databases, or repurpose backup formats as synchronization protocols.

Recommended new top-level layout:

    dash_ledger_cc/
    ├── src/                         # existing PWA
    ├── worker/
    │   ├── package.json
    │   ├── wrangler.jsonc
    │   ├── migrations/
    │   │   ├── 0001_users.sql
    │   │   ├── 0002_ledger_mirror.sql
    │   │   ├── 0003_remote_inbox.sql
    │   │   └── 0004_audit.sql
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── auth/
    │   │   ├── mcp/
    │   │   ├── sync/
    │   │   ├── db/
    │   │   ├── calculations/
    │   │   └── contracts/
    │   └── tests/
    ├── plugin/
    │   ├── plugin.json
    │   ├── mcp.json
    │   ├── skills/
    │   │   └── dash-ledger/
    │   │       ├── SKILL.md
    │   │       └── references/
    │   │           ├── operating-rules.md
    │   │           ├── evidence-rules.md
    │   │           ├── formulas.md
    │   │           └── tool-contracts.md
    │   └── assets/
    └── ...

Cloudflare/OpenAI dependencies stay isolated from the PWA production bundle.

---

## 4. Synchronization strategy: mirror + proposal inbox

Do not begin with general bidirectional cloud synchronization.

A naive two-way IndexedDB/D1 model immediately creates distributed-state problems around:

- conflicting edits;
- offline writes;
- active shifts;
- reversed odometers;
- replayed requests;
- deletions;
- old devices;
- partial uploads;
- version drift;
- retry duplication;
- conflict resolution.

The first production architecture is deliberately asymmetric:

    LOCAL CANONICAL LEDGER
            |
            | one-way structured snapshot
            v
       GPT READ MIRROR

       GPT WRITES
            |
            v
      REMOTE PROPOSAL INBOX
            |
            | user review / local application
            v
    LOCAL CANONICAL LEDGER

ChatGPT reads synchronized ledger data.

ChatGPT may create proposals.

The browser ledger remains the only authority that applies canonical changes.

Direct remote canonical mutation is a later optional phase and requires a separate evidence gate.

---

## 5. Remote D1 data model

### users

Purpose: one row per authorized Dash Ledger identity.

Suggested fields:

- id UUID primary key
- display_label
- credential_digest
- status
- created_at
- updated_at

No email address is inherently required for the private implementation.

### devices

Purpose: identify PWA installations authorized to synchronize.

Suggested fields:

- id UUID
- user_id
- token_hash
- created_at
- revoked_at
- last_sync_at
- label

The raw device token stays on the device only.

### sync_state

Purpose: freshness, schema, and snapshot integrity.

Suggested fields:

- user_id
- device_id
- latest_snapshot_version
- source_generated_at
- server_received_at
- schema_version
- format_version
- snapshot_hash
- vehicle_count
- shift_count
- expense_count
- status

### vehicles

Mirror only fields needed for interpretation:

- user_id
- id
- label
- archived
- created_at
- updated_at
- snapshot_version

### shifts

Mirror the native Shift entity except freeform notes by default:

- user_id
- id
- status
- date
- week_key
- vehicle_id
- vehicle_label
- start_time
- end_time
- start_odometer
- end_odometer
- app_earnings_cents
- cash_tips_cents
- purpose
- created_at
- updated_at
- snapshot_version

Do not upload notes by default.

A future explicit privacy toggle may allow freeform notes.

### expenses

Initial mirror:

- user_id
- id
- date
- amount_cents
- category
- tax_class
- shift_id
- created_at
- updated_at
- snapshot_version

Merchant may be independently configurable because merchant history can reveal more information than is required for aggregate analysis.

### mileage_rates

Mirror the exact rate periods necessary to reproduce calculations.

### weekly_closures

Optional in early read-only versions. Useful later for review-state questions.

### remote_inbox

Controlled GPT-to-ledger proposal surface.

Suggested fields:

- id
- user_id
- kind
- payload_json
- idempotency_key
- status
- created_at
- resolved_at
- source_client

Statuses:

- pending
- accepted
- rejected
- superseded
- expired

### audit_events

Minimal operational audit only:

- user_id
- tool_name
- proposal_id
- outcome
- timestamp
- payload_hash
- request_id

Do not store prompts, complete request bodies, access tokens, device tokens, or personal notes in audit logging.

---

## 6. Data excluded from the initial remote bridge

Do not upload:

- receipt image blobs;
- receipt thumbnails;
- diagnostic logs;
- legacy import reports;
- browser storage information;
- full backup files;
- authentication secrets;
- device tokens;
- unrelated UI settings;
- theme;
- PWA metadata;
- raw recovery databases.

Receipt metadata is also unnecessary for the first useful plugin release.

The bridge exists to analyze work and economics, not to become a cloud receipt archive.

---

## 7. Dedicated synchronization format

Do not use the existing backup format as a sync payload.

Existing canonical backup identities remain:

- dash-ledger-backup-v2
- dash-ledger-ledger-only-v2

Create a separate explicit synchronization identity:

**dash-ledger-gpt-sync-v1**

Suggested envelope:

    {
      "format": "dash-ledger-gpt-sync-v1",
      "formatVersion": 1,
      "schemaVersion": 1,
      "generatedAt": "...",
      "deviceId": "...",
      "snapshotHash": "...",
      "vehicles": [],
      "shifts": [],
      "expenses": [],
      "mileageRates": []
    }

Recommended PWA service module:

    src/services/gptSync.ts

Functions:

- buildGptSyncSnapshot()
- validateGptSyncSnapshot()
- hashGptSyncSnapshot()
- pushGptSyncSnapshot()
- pullGptInbox()

The Worker validates the complete payload before altering the promoted remote snapshot.

Snapshot promotion must be transactional.

A failed upload must leave the previous complete snapshot available to GPT.

Never expose a partially uploaded ledger.

---

## 8. Initial synchronization behavior

Start with manual synchronization.

Suggested UI:

    GPT Bridge

    Status: Connected
    Last synchronized: 6:13 AM
    Records shared: 88 shifts · 42 expenses

    [ Sync now ]

    Automatic sync while Dash Ledger is open: OFF

Only after manual synchronization is proven should optional automatic synchronization be introduced.

Automatic synchronization should:

1. run only while the PWA is open;
2. debounce multiple record changes;
3. avoid one HTTP request per keystroke/mutation;
4. compare snapshot hashes and skip unchanged uploads;
5. never depend on background execution guarantees.

Recommended debounce target: 15–30 seconds after the last canonical record change.

Do not design around unreliable mobile background service-worker execution.

---

## 9. Freshness is part of every operational answer

The remote mirror is not automatically current.

Every relevant MCP response should include:

- sourceGeneratedAt
- serverReceivedAt
- ageSeconds
- freshnessStatus

Suggested freshness states:

- fresh
- aging
- stale
- unknown

The Dash Ledger Skill should call get_sync_status before answering questions whose truth depends on current data, including:

- How am I doing today?
- How much have I earned?
- Should I move?
- What is my current hourly rate?
- Compare today's performance.
- What is my active shift status?

Stale data must be disclosed directly, not hidden in a footnote.

---

## 10. Authentication architecture

Do not use a static API key exposed to ChatGPT.

Use OAuth 2.1 for the MCP resource server.

Cloudflare Worker responsibilities:

- OAuth authorization endpoint;
- token endpoint;
- MCP resource server;
- simple private Dash Ledger login screen;
- device-sync authentication.

Use Cloudflare's Workers OAuth Provider library and Workers KV for OAuth state, grants, authorization codes, and tokens.

### ChatGPT OAuth scopes

Initial scopes:

- ledger.read
- ledger.propose
- offline_access where appropriate

Do not define direct canonical mutation scope in v1 because direct canonical mutation does not exist in v1.

### PWA device authentication

The PWA uses an independent long-lived random device token for /sync/*.

Request form:

    Authorization: Bearer <device-token>

ChatGPT never receives the device token.

### Private user credentials

For a private Andrew/Greyson-scale deployment, use pre-provisioned high-entropy login secrets rather than a paid identity provider.

Generate cryptographically random secrets.

Store only a digest/derived verifier server-side.

Keep a server-side pepper in Cloudflare secrets.

Include:

- login throttling;
- secure session cookies;
- CSRF protection;
- explicit OAuth consent;
- revocation.

If the plugin becomes a general public product, revisit identity architecture.

---

## 11. Local secret storage

Do not store GPT bridge secrets inside normal Settings because Settings are included in backup/export paths.

Introduce a Dexie migration with a dedicated secret store excluded from backups.

Conceptually:

    version(2)
    syncSecrets: '&key'

Possible keys:

- deviceToken
- deviceId

Rules:

- excluded from full backups;
- excluded from ledger-only backups;
- excluded from CSVs;
- excluded from Tax Binder;
- excluded from GPT sync payloads;
- cleared by Disconnect GPT Bridge.

Migration requirements:

- existing v1 database upgrades without modifying canonical records;
- migration is covered by tests;
- uninstalling/disconnecting the bridge never deletes ledger records.

---

## 12. MCP server implementation

Use the current stateless Streamable HTTP MCP handler architecture.

Do not build new work on deprecated/frozen stateful McpAgent patterns.

Recommended Worker dependencies should stay minimal and pinned:

- agents/current Cloudflare MCP handler package as applicable;
- @modelcontextprotocol/server;
- zod;
- @cloudflare/workers-oauth-provider.

Remote endpoint:

    https://<worker-name>.<account>.workers.dev/mcp

No tunnel.

No Mac.

No VPN.

No custom domain.

---

## 13. Initial MCP tool contract

Keep v1 intentionally small.

| Tool | Purpose | Side effect |
|---|---|---|
| get_sync_status | Report mirror freshness and version | None |
| get_ledger_summary | Aggregate a requested period | None |
| get_recent_shifts | Return bounded shift history | None |
| get_shift | Inspect one synchronized shift | None |
| compare_periods | Deterministically compare two periods | None |
| get_pending_review_summary | Surface incomplete/questionable records | None |
| calculate_commute_hurdle | Run commute-premium / relocation arithmetic | None |
| calculate_offer_threshold | Apply contribution/hour + mileage model | None |
| queue_expense_proposal | Add an expense proposal to GPT Inbox | Creates proposal |
| queue_shift_update_proposal | Add a shift-change proposal | Creates proposal |

Tool names must describe side effects honestly.

Use "queue" and "proposal" rather than pretending the canonical ledger changed.

GPT should say:

"I queued the $14.82 fuel expense for Dash Ledger review."

It should not say:

"Done. I changed your ledger."

---

## 14. Idempotency

Every mutating MCP request requires a caller-generated idempotency key, for example:

- clientRequestId

The server stores the idempotency key with the proposal.

If the same request is retried, return the original proposal.

Never create duplicate expenses or edits merely because a transport retry occurred.

Idempotency is mandatory before proposal tools are considered production-ready.

---

## 15. GPT Inbox inside the PWA

Reuse Dash Ledger's existing "Needs review" concept.

Suggested Desk presentation:

    Needs review
    4 items

    2 ledger issues
    2 GPT proposals

Selecting GPT proposals opens a GPT Inbox.

Each proposal shows:

- proposed action;
- origin;
- timestamp;
- exact proposed values;
- Accept;
- Reject.

Accepting a proposal must call the same repository-layer operations used by ordinary local UI flows.

Never write raw IndexedDB rows directly from the GPT bridge UI.

Rejecting a proposal alters no canonical ledger data.

---

## 16. Proposal acceptance sequence

Canonical flow:

    GPT creates proposal
            |
            v
    Remote inbox stores proposal
            |
            v
    Dash Ledger fetches inbox
            |
            v
    User reviews
            |
            v
    User accepts
            |
            v
    Existing repository function applies local change
            |
            v
    Proposal marked accepted
            |
            v
    New local snapshot generated
            |
            v
    Remote mirror updated

This provides controlled consistency without building a general distributed transaction engine.

---

## 17. Dash Ledger Skill responsibilities

MCP supplies data and deterministic functions.

The Skill supplies procedure and operating judgment.

The Skill should encode stable Dash Ledger principles, including:

- count the whole day rather than only active time;
- preserve active, online/dash, and door-to-door denominator distinctions;
- keep Niles as the zero-deliberate-commute control where applicable;
- switch apps before switching cities unless evidence clears the movement hurdle;
- include recovery mileage and deliberate repositioning;
- distinguish gross from modeled contribution;
- separate recorded facts, assumptions, proxies, anecdotes, and unresolved unknowns;
- never treat store coverage/density as earnings evidence;
- report stale synchronization before making current-session claims.

The Skill should not present research hypotheses as immutable market truths.

---

## 18. Skill packaging strategy

Do not paste the entire long research corpus into SKILL.md.

Use a compact procedural Skill plus references:

    plugin/skills/dash-ledger/
    ├── SKILL.md
    └── references/
        ├── operating-rules.md
        ├── evidence-rules.md
        ├── formulas.md
        └── tool-contracts.md

SKILL.md should own:

- trigger boundaries;
- procedure;
- tool ordering;
- stale-data rules;
- answer shape;
- mutation language.

Reference files should own:

- stable operating rules;
- evidence taxonomy;
- formulas;
- tool semantics.

The long master research source remains the deeper project authority.

---

## 19. Deterministic financial calculations

GPT should not perform authoritative financial arithmetic in natural-language reasoning when the server can calculate deterministically.

Core modeled values should include exact inputs and exact results.

Example formulas:

    modeled_vehicle_cost =
      total_miles × selected_cost_per_mile

    operating_contribution =
      gross
      - modeled_vehicle_cost
      - tolls
      - parking
      - other_direct_operating_costs

    contribution_per_door_to_door_hour =
      operating_contribution / door_to_door_hours

Tool responses should expose their inputs.

Example response shape:

    {
      "grossCents": 12452,
      "totalMiles": 63.4,
      "vehicleCostPerMile": 0.45,
      "modeledVehicleCostCents": 2853,
      "operatingContributionCents": 9599,
      "doorToDoorMinutes": 347,
      "contributionPerHourCents": 1660
    }

ChatGPT explains the result; it does not silently own the arithmetic.

---

## 20. Multi-platform scope boundary

Do not force DoorDash, Instacart, and Uber Eats into the current single appEarningsCents field merely because plugin work is underway.

Multi-platform earnings/session modeling is a separate application-domain change.

Plugin v1 should understand current Dash Ledger records exactly as they exist.

A later dedicated schema phase can introduce concepts such as:

- WorkSession
- PlatformActivity
- OfferEvent
- OrderEvent
- MarketPosition

That later model can represent DoorDash, Instacart, and Uber Eats without flattening their distinct work cycles.

Do not create MCP-only entities that the PWA itself cannot represent.

---

## 21. Order-level intelligence is a later phase

The research architecture eventually wants one row per offer/order/batch with fields such as:

- platform;
- offer time;
- gross;
- base;
- tip;
- items/units;
- active minutes;
- delivery miles;
- recovery miles;
- repositioning;
- market context.

That data would support:

- Should I take this?
- Should I move?
- Which store am I fastest at?
- Which zones strand me?
- What is my actual contribution per order?
- What is my idle-time threshold?

The current production app does not yet own this entity.

Therefore do not add it only to D1.

Build order-level logging later as a real Dash Ledger feature first, then expose it through synchronization/MCP.

---

## 22. Zero-cost infrastructure contract

Target providers:

### GitHub Pages

Purpose: existing static PWA hosting.

Cost target: $0.

No custom domain required.

### GitHub Actions

Purpose: validation and Pages deployment.

Cost target: $0 under public-repository allowances/current plan.

### Cloudflare Workers Free

Purpose:

- MCP endpoint;
- OAuth server;
- sync API;
- deterministic request handling.

Current plan assumption verified 2026-10-01:

- Free plan;
- hard free-tier request/CPU constraints;
- architecture must remain within them.

### Cloudflare D1 Free

Purpose:

- structured mirror;
- proposal inbox;
- minimal audit state.

Current plan assumption verified 2026-10-01:

- free daily row-read/write limits;
- free storage allowance;
- exceeding free daily limits should fail rather than silently create paid overage in the chosen free setup.

### Cloudflare KV Free

Purpose:

- OAuth state;
- grants;
- authorization codes;
- tokens.

Keep use minimal.

### Explicitly excluded paid infrastructure

- ngrok paid plans;
- VPS hosting;
- AWS/Azure compute;
- Supabase paid plans;
- Firebase paid plans;
- Auth0/Clerk/Stytch/WorkOS paid identity;
- Datadog/Sentry paid observability;
- OpenAI API usage;
- paid custom domain;
- R2 unless later proven necessary and separately approved;
- Redis;
- generic hosted analytics.

Before implementation or release, re-check current provider free-tier terms because pricing and limits are mutable external facts.

---

## 23. Internal cost circuit breakers

Do not rely solely on provider limits.

Add tighter application-level caps.

Suggested starting soft limits:

- MCP tool calls/user/day: 2,000
- snapshot uploads/device/day: 100
- snapshot payload maximum: 2 MB
- GPT proposals/user/day: 1,000
- failed auth attempts/IP/15 minutes: 10

On internal limit:

- return controlled 429;
- do not retry aggressively;
- do not enable a paid tier;
- do not ask the user to add billing merely to keep operating.

These numbers can be tuned downward after real usage measurements.

---

## 24. Logging and privacy policy

Production logging must not contain:

- OAuth access tokens;
- OAuth refresh tokens;
- device tokens;
- login secrets;
- full shift objects;
- expense notes;
- receipt data;
- merchant history unless strictly necessary;
- GPT prompts;
- entire MCP request bodies.

Allowed operational logging:

- request ID;
- tool name;
- outcome;
- latency;
- pseudonymous user ID;
- D1 error category;
- quota state.

Do not add a separate paid telemetry provider.

---

## 25. Failure behavior

The Worker is optional infrastructure.

If Cloudflare:

- is unavailable;
- returns 500;
- returns 429;
- hits free-tier quota;
- loses D1;
- has expired authentication;
- has temporary network failure;

then the PWA must still:

- open;
- work offline;
- start shifts;
- end shifts;
- write expenses;
- retain receipts locally;
- display reports;
- export backups;
- restore backups;
- preserve all canonical data.

The bridge UI should show a bounded message such as:

    GPT Bridge
    Sync unavailable.
    Your local ledger is unaffected.

Cloud failure must never be a ledger failure.

---

## 26. Remote data must be disposable

Provide a destructive bridge-only action:

**Delete GPT cloud copy**

Required behavior:

1. revoke ChatGPT OAuth grants;
2. revoke device tokens;
3. delete mirrored D1 rows;
4. delete GPT proposals;
5. remove remote audit rows as appropriate;
6. clear local bridge credentials;
7. disable synchronization.

Do not delete, modify, or reset local canonical ledger data.

This action should be independently tested.

---

## 27. Portable plugin package

Target package:

    plugin/
    ├── plugin.json
    ├── mcp.json
    ├── skills/
    │   └── dash-ledger/
    │       ├── SKILL.md
    │       └── references/
    │           ├── evidence-rules.md
    │           ├── formulas.md
    │           ├── operating-rules.md
    │           └── tool-contracts.md
    └── assets/
        ├── icon.png
        └── logo.png

mcp.json points to the workers.dev MCP endpoint.

The plugin package must contain no:

- Cloudflare API token;
- OAuth secret;
- device credential;
- user credential;
- environment secret.

---

## 28. Deployment sequence: private first

Do not begin with public Plugin Directory publication.

Recommended order:

1. MCP Inspector;
2. ChatGPT developer/custom app connection;
3. private Dash Ledger plugin;
4. Andrew test;
5. Greyson test;
6. field trial;
7. public-distribution decision only if genuine value is demonstrated.

This keeps compatibility and onboarding obligations small while the tool contract is still evolving.

---

## 29. Mobile is an independent acceptance target

Do not assume web behavior proves Android/iPhone behavior.

Test separately:

- ChatGPT web;
- ChatGPT Android;
- PWA Android/browser;
- PWA iPhone/Safari/Home Screen as appropriate.

If a ChatGPT mobile surface temporarily lacks a capability during rollout, degrade that surface gracefully rather than redesigning the backend around a temporary client limitation.

---

## 30. Implementation phases

### Phase 0 — Freeze the contract

Tasks:

- reconcile current repository baseline before any code mutation;
- record this plan as the architecture source for GPT Bridge work;
- preserve current local-first invariants;
- make GPT Bridge an explicit optional boundary rather than silently superseding existing privacy constraints;
- freeze a current regression baseline;
- create a dedicated implementation branch when implementation actually begins.

Acceptance:

- planning artifact exists;
- no runtime code changed;
- no backend exists yet;
- no user data moved;
- current app regression evidence remains applicable.

### Phase 1 — Worker feasibility spike

Build only an isolated Worker package.

Expose:

- ping;
- get_server_info.

Deploy to Workers Free.

Validate:

- public HTTPS endpoint works;
- Streamable HTTP MCP works;
- MCP Inspector can call tools;
- ChatGPT can connect without a tunnel;
- Worker stays inside Free CPU constraints;
- no ledger data exists remotely.

Stop if zero-cost remote MCP cannot be maintained.

### Phase 2 — OAuth

Add:

- OAuth Provider;
- KV binding;
- private credential login;
- consent flow;
- CSRF protection;
- refresh tokens;
- revocation;
- ledger.read scope.

Validation:

- unauthenticated /mcp is rejected;
- tokens cannot cross users;
- revoked grants stop working;
- no paid identity provider is involved.

### Phase 3 — D1 mirror schema

Create migrations for:

- users;
- devices;
- sync state;
- vehicles;
- shifts;
- expenses;
- mileage rates;
- audit events.

Add indexes based on actual query patterns, especially:

- user/date;
- user/status;
- user/snapshot;
- user/id.

Validation:

- migrations are repeatable;
- row ownership is enforced;
- query plans avoid needless full-table scans.

### Phase 4 — PWA bridge pairing

Add:

- GPT Bridge settings UI;
- device pairing;
- secret-store Dexie migration;
- Disconnect GPT Bridge;
- privacy disclosure.

Validation:

- schema migration preserves all existing ledger rows;
- secret table is excluded from exports/backups;
- disconnected app remains current Dash Ledger behavior;
- no network request occurs during ordinary use with bridge disabled.

### Phase 5 — One-way synchronization

Implement:

- dash-ledger-gpt-sync-v1;
- manual Sync Now;
- complete payload validation;
- transactional promotion;
- data minimization;
- payload limit;
- snapshot hash;
- unchanged-snapshot skip;
- staleness metadata.

Validation:

- interrupted upload leaves prior snapshot intact;
- invalid payload changes nothing;
- receipt image fields are rejected;
- Worker outage leaves PWA unaffected.

### Phase 6 — Read-only ledger MCP tools

Implement:

- get_sync_status;
- get_ledger_summary;
- get_recent_shifts;
- get_shift;
- compare_periods;
- get_pending_review_summary;
- deterministic financial calculators.

Validation:

- result sizes are bounded;
- all user-owned rows are scoped by authenticated user;
- parity fixtures match PWA calculations exactly.

### Phase 7 — Dash Ledger Skill

Package:

- denominator discipline;
- evidence rules;
- Niles control logic;
- stale-data behavior;
- app-switch-before-city-switch procedure;
- movement hurdle logic;
- exact tool language.

Validation:

- trigger cases;
- non-trigger cases;
- stale-data fixtures;
- denominator fixtures;
- unsupported-evidence fixtures;
- side-effect language fixtures.

### Phase 8 — Private ChatGPT install

Install privately.

Test:

- OAuth connection;
- tool discovery;
- read queries;
- stale sync;
- summaries;
- period comparisons;
- Android/web differences.

Do not enable proposal tools yet if read-only behavior is not clean.

### Phase 9 — GPT proposal inbox

Add:

- remote_inbox migration;
- queue_expense_proposal;
- queue_shift_update_proposal;
- idempotency;
- PWA GPT Inbox;
- Accept/Reject.

Validation:

- retry creates one proposal;
- rejection changes nothing;
- acceptance uses repository layer;
- accepted mutation triggers normal local metadata/update behavior;
- accepted state reaches remote mirror only through a later normal sync.

### Phase 10 — Real field trial

Measure actual utility.

Suggested metrics:

- percentage of plugin questions answered using sufficiently fresh data;
- stale-sync frequency;
- MCP error rate;
- proposal acceptance/rejection rate;
- duplicate-proposal rate;
- number of manual app interactions saved;
- average bridge requests per workday;
- whether movement/market answers are genuinely more useful than opening the app;
- whether the user keeps using the plugin after novelty wears off.

Do not expand architecture merely because the prototype is technically interesting.

### Phase 11 — Multi-platform domain design

Only after bridge value is established, design first-class:

- DoorDash;
- Instacart;
- Uber Eats;
- overlapping online periods;
- work sessions;
- platform activities;
- order/batch events;
- app-specific timing.

This is an application-domain upgrade first and an MCP exposure second.

### Phase 12 — Optional direct-mutation decision gate

Evaluate whether direct remote mutation materially improves the workflow beyond the proposal inbox.

If yes, require:

- versioned records;
- optimistic concurrency;
- explicit conflict responses;
- idempotent mutations;
- stale-snapshot rejection;
- rollback/recovery proof;
- conflict UI;
- separate authorization scope.

If the value is marginal, do not implement it.

### Phase 13 — Optional public distribution

Only if public distribution is genuinely desired:

- generalized onboarding;
- public privacy documentation;
- reviewer/demo account;
- abuse/rate-limit design;
- public MCP review requirements;
- Plugin Directory submission;
- support expectations.

This phase is not required for Andrew/Greyson private use.

---

## 31. Hard validation gates

A phase does not graduate until its user-path requirement is proven.

Examples:

- Worker spike: remote MCP works over HTTPS with no tunnel.
- OAuth: unauthenticated access fails closed.
- D1: account isolation is proven.
- PWA migration: existing local ledger survives intact.
- Sync: interrupted sync cannot expose partial snapshot.
- Read MCP: financial calculations match PWA fixtures.
- Skill: stale mirrors are never presented as current truth.
- Proposals: replay creates exactly one proposal.
- Local failure boundary: Worker can be offline while normal ledger operation continues.
- Cost gate: no required recurring paid infrastructure exists.

No release proceeds with failing existing Dash Ledger tests/typecheck/lint/build.

---

## 32. Security validation matrix

| Test | Required outcome |
|---|---|
| Anonymous /mcp call | 401 |
| Expired OAuth token | 401 |
| Revoked OAuth grant | 401 |
| User A token requesting User B rows | No data |
| Invalid device token | 401 |
| Revoked device token | 401 |
| Malformed snapshot | Entire upload rejected |
| Oversized snapshot | Controlled rejection |
| Replayed proposal | Original proposal returned |
| SQL injection strings | Treated as data |
| Arbitrary user ID supplied by client | Ignored; identity comes from auth |
| Receipt image included accidentally | Validation rejects it |
| OAuth/device token appears in logs | Test failure |
| Secret appears in backup | Test failure |
| Unknown browser origin hits sync endpoint | Rejected where origin controls apply |
| Worker outage | Local PWA unaffected |

---

## 33. Financial parity tests

Create golden fixtures shared conceptually between local and remote implementations.

For identical input data, PWA domain code and MCP calculators must produce identical:

- gross;
- business miles;
- selected mileage rate;
- standard-mileage estimate;
- modeled vehicle cost;
- operating contribution;
- gross/hour;
- contribution/hour;
- gross/mile;
- contribution/mile.

If money differs by one cent, release stops.

If mileage differs materially because of unit/rounding semantics, release stops.

If a local-date boundary changes a session's week/day unexpectedly, release stops.

---

## 34. Research/behavior regression fixtures

Create semantic tests for the Skill.

Examples:

### Active vs online denominator

Input:

"South Bend made $250 in eight active hours and fifteen dash hours."

Expected:

- active-rate calculation uses 8;
- dash/online-rate calculation uses 15;
- the two are not conflated.

### Coverage is not earnings

Input:

"Mishawaka has more stores, so should I drive there?"

Expected:

- store density alone is not accepted as proof of higher earnings;
- movement hurdle remains required.

### Stale mirror

Input:

"I haven't synced Dash Ledger since yesterday. How much have I made today?"

Expected:

- GPT states the mirror cannot establish today's complete earnings;
- does not invent live totals.

### Proposal language

Input:

"Record $20 gas."

Expected v1 write behavior:

- queue proposal;
- say it was queued for review;
- do not claim canonical ledger mutation.

These become durable regression fixtures.

---

## 35. Performance constraints

Keep the Worker small enough for Free-plan CPU/request limits.

Avoid:

- OCR;
- AI inference;
- PDF generation;
- arbitrary webpage fetching;
- giant JSON transformations;
- giant unbounded yearly scans;
- large dependency graphs;
- remote receipt processing;
- general reporting engines.

Use indexed D1 queries.

Bound all list tools.

Example:

- get_recent_shifts(max <= 100)

Do not expose unbounded "give me everything" tools.

---

## 36. Remote retention policy

The remote mirror is not a backup archive.

Default:

- retain only the current promoted mirror;
- do not accumulate historical snapshots;
- retain pending proposals until resolved/expired;
- retain accepted/rejected proposal metadata only as long as needed for operational confidence;
- keep audit events minimal and bounded.

Canonical historical data remains in IndexedDB and normal Dash Ledger backups.

---

## 37. Target high-value interaction

Long-term target:

"@DashLedger I'm at University Park. DoorDash has been dead for 17 minutes. I've made $46.50 in 2h12m and driven 31 miles. Should I move?"

A mature plugin could combine:

- synchronized current session state;
- prior matched sessions;
- current mileage burden;
- configured cost assumptions;
- contribution target;
- relocation formula;
- Niles control comparison;
- field evidence status.

Response should separate:

- recorded personal data;
- deterministic calculations;
- model assumptions;
- historical evidence;
- unknown current demand.

The plugin should never claim knowledge of live demand merely because historical data or static research exist.

---

## 38. Explicit v1 exclusions

Do not implement in v1:

- automatic GPS tracking;
- DoorDash credential scraping;
- Instacart credential scraping;
- Uber credential scraping;
- receipt OCR;
- bank linking;
- remote receipt storage;
- AI calls from Cloudflare;
- generic bidirectional sync;
- direct remote canonical edits;
- custom domain;
- public signup system;
- subscriptions/paywalls;
- realtime websocket infrastructure;
- vector database;
- hosted analytics stack;
- Redis;
- Supabase;
- Firebase;
- R2 unless a later evidence-backed phase requires it.

These are not required to solve the initial problem.

---

## 39. Definition of done — GPT Bridge v1

Dash Ledger GPT Bridge v1 is complete only when all of the following are true:

- existing PWA works identically with GPT integration disabled;
- user explicitly enables GPT Bridge;
- UI clearly shows which data leave the device;
- PWA synchronizes a minimized structured mirror to a free Cloudflare endpoint;
- no receipt images leave the device;
- ChatGPT authenticates with OAuth;
- ChatGPT retrieves only the correct user's synchronized ledger;
- ChatGPT can report mirror age/freshness;
- deterministic metrics match local calculations;
- ChatGPT can compare sessions/history;
- the Skill applies established evidence rules without upgrading hypotheses into facts;
- GPT can queue a proposed ledger change;
- PWA can accept/reject that proposal;
- accepted proposals use existing repository logic;
- rejected proposals alter nothing;
- Worker/D1/KV quota exhaustion produces degraded service rather than a charge;
- Cloudflare can disappear without losing canonical ledger data;
- no tunnel exists anywhere in the architecture;
- no required service introduces recurring infrastructure cost;
- the entire GPT cloud copy can be deleted without deleting a single canonical local record.

---

## 40. Stop conditions

Stop or redesign before further investment if any of the following becomes true:

1. ChatGPT requires a paid hosting/tunnel layer for this architecture.
2. A required provider changes its free tier such that normal private use can incur automatic billable overage.
3. The MCP Worker cannot stay comfortably inside free CPU/request limits.
4. Secure user isolation cannot be achieved without paid identity infrastructure.
5. The bridge requires making D1 authoritative.
6. Existing offline/local-first behavior must be weakened to support GPT.
7. Financial parity cannot be made deterministic.
8. Sync conflicts require a general two-way distributed database before the plugin provides meaningful value.
9. Mobile ChatGPT surfaces make the intended workflow impractical and no useful read-only fallback exists.
10. Real field use shows the plugin saves negligible effort or produces no meaningful decision value.

Stopping is an acceptable outcome. The goal is measurable usefulness at zero incremental infrastructure cost, not merely proving that an MCP server can exist.

---

## 41. External implementation references

These are mutable external sources and must be freshness-checked again immediately before implementation.

- OpenAI Plugins overview: https://developers.openai.com/plugins/
- OpenAI plugin build/package guidance: https://developers.openai.com/plugins/build/plugins
- OpenAI MCP/auth guidance: https://developers.openai.com/plugins/build/auth
- OpenAI app/plugin guidelines: https://developers.openai.com/plugins/app-guidelines
- Cloudflare remote MCP guide: https://developers.cloudflare.com/agents/model-context-protocol/
- Cloudflare MCP handler API: https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/
- Cloudflare Workers pricing/limits: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare KV limits: https://developers.cloudflare.com/kv/platform/limits/
- Workers OAuth Provider repository: https://github.com/cloudflare/workers-oauth-provider
- GitHub Pages documentation: https://docs.github.com/en/pages

---

## 42. Planning-state warning

**Nothing in this document proves that GPT Bridge has been implemented, deployed, connected, authenticated, synchronized, tested, or released.**

This document is the implementation plan and architecture contract only.

Before implementation:

1. re-read current OPERATIONAL_STATE.md;
2. rebaseline current main;
3. re-check current OpenAI plugin/MCP requirements;
4. re-check current Cloudflare free-tier pricing and limits;
5. create a bounded implementation branch;
6. protect all currently verified Dash Ledger behavior;
7. implement Phase 1 first;
8. stop immediately if the zero-cost constraint fails.

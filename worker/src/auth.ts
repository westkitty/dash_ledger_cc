import type { ExportedHandler } from '@cloudflare/workers-types';
import type { Env } from './env';
import { LIMITS } from './env';
import {
  bearerToken,
  digestCredential,
  digestDeviceToken,
  randomToken,
  timingSafeStringEqual,
} from './crypto';
import {
  BootstrapUserSchema,
  GptSyncSnapshotSchema,
  PairRequestSchema,
} from './schemas';
import {
  createDevice,
  deleteRemoteUserData,
  getDeviceByDigest,
  getUser,
  incrementUsage,
  listPendingProposals,
  publicProposal,
  replaceMirror,
  resolveProposal,
  upsertUser,
} from './db';

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function htmlResponse(value: string, status = 200): Response {
  return new Response(value, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    },
  });
}

function escapeHtml(value: string): string {
  const chars: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (ch) => chars[ch] ?? ch);
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  corsHeaders(request, env).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function verifyUser(env: Env, userId: string, loginSecret: string) {
  const user = await getUser(env, userId);
  if (!user || user.status !== 'active') return null;
  const digest = await digestCredential(env, loginSecret);
  return timingSafeStringEqual(digest, user.credential_digest) ? user : null;
}

async function authorizedDevice(request: Request, env: Env) {
  const token = bearerToken(request);
  if (!token) return null;
  return getDeviceByDigest(env, await digestDeviceToken(env, token));
}

async function handleBootstrapUser(request: Request, env: Env): Promise<Response> {
  const token = bearerToken(request);
  if (
    !token ||
    !env.BOOTSTRAP_SECRET ||
    !timingSafeStringEqual(token, env.BOOTSTRAP_SECRET)
  ) {
    return jsonResponse({ error: 'not_found' }, 404);
  }
  const parsed = BootstrapUserSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_request', issues: parsed.error.issues },
      400,
    );
  }
  const credentialDigest = await digestCredential(
    env,
    parsed.data.loginSecret,
  );
  await upsertUser(env, {
    userId: parsed.data.userId,
    displayLabel: parsed.data.displayLabel,
    credentialDigest,
  });
  return jsonResponse({ ok: true, userId: parsed.data.userId });
}

async function handlePair(request: Request, env: Env): Promise<Response> {
  const parsed = PairRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_request', issues: parsed.error.issues },
      400,
    );
  }
  const user = await verifyUser(
    env,
    parsed.data.userId,
    parsed.data.loginSecret,
  );
  if (!user) return jsonResponse({ error: 'invalid_credentials' }, 401);

  const deviceToken = randomToken();
  const deviceId = await createDevice(env, {
    userId: user.id,
    label: parsed.data.deviceLabel,
    tokenDigest: await digestDeviceToken(env, deviceToken),
  });
  return jsonResponse({
    deviceId,
    deviceToken,
    userId: user.id,
    displayLabel: user.display_label,
  });
}

async function handleSnapshot(request: Request, env: Env): Promise<Response> {
  const device = await authorizedDevice(request, env);
  if (!device) return jsonResponse({ error: 'unauthorized' }, 401);

  await incrementUsage(env, device.user_id, 'sync_uploads');

  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (contentLength > LIMITS.snapshotBytes) {
    return jsonResponse({ error: 'payload_too_large' }, 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > LIMITS.snapshotBytes) {
    return jsonResponse({ error: 'payload_too_large' }, 413);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const parsed = GptSyncSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_snapshot', issues: parsed.error.issues },
      400,
    );
  }
  if (parsed.data.deviceId !== device.id) {
    return jsonResponse({ error: 'device_mismatch' }, 403);
  }

  const result = await replaceMirror(env, device.user_id, parsed.data);
  return jsonResponse({
    ok: true,
    ...result,
    receivedAt: new Date().toISOString(),
  });
}

async function handleDisconnect(request: Request, env: Env): Promise<Response> {
  const device = await authorizedDevice(request, env);
  if (!device) return jsonResponse({ error: 'unauthorized' }, 401);
  await deleteRemoteUserData(env, device.user_id);
  return jsonResponse({ ok: true, localLedgerDeleted: false });
}

async function handleInbox(request: Request, env: Env): Promise<Response> {
  const device = await authorizedDevice(request, env);
  if (!device) return jsonResponse({ error: 'unauthorized' }, 401);
  const rows = await listPendingProposals(env, device.user_id);
  return jsonResponse({ proposals: rows.map(publicProposal) });
}

async function handleResolve(
  request: Request,
  env: Env,
  proposalId: string,
): Promise<Response> {
  const device = await authorizedDevice(request, env);
  if (!device) return jsonResponse({ error: 'unauthorized' }, 401);
  const raw = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  if (!raw || (raw.status !== 'accepted' && raw.status !== 'rejected')) {
    return jsonResponse({ error: 'invalid_status' }, 400);
  }
  const changed = await resolveProposal(
    env,
    device.user_id,
    proposalId,
    raw.status,
  );
  return changed
    ? jsonResponse({ ok: true })
    : jsonResponse({ error: 'proposal_not_pending' }, 409);
}

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const oauthRequest = await oauth.parseAuthRequest(request);
  const client = await oauth.lookupClient(oauthRequest.clientId);
  const clientName = client?.clientName || 'ChatGPT';
  const scopes = oauthRequest.scope.filter((scope) =>
    ['ledger.read', 'ledger.propose', 'offline_access'].includes(scope),
  );
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const scopeText = scopes.length ? scopes.join(', ') : 'ledger.read';
    const action = escapeHtml(url.pathname + url.search);
    return htmlResponse(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width">' +
        '<title>Authorize Dash Ledger</title>' +
        '<style>body{font-family:system-ui;max-width:560px;margin:48px auto;padding:0 20px;' +
        'background:#0b1020;color:#f3f4f6}label{display:block;margin:14px 0 5px}' +
        'input{width:100%;box-sizing:border-box;padding:11px;border-radius:8px;' +
        'border:1px solid #475569;background:#111827;color:#fff}' +
        'button{margin-top:18px;padding:11px 16px;border:0;border-radius:8px;' +
        'background:#0f766e;color:#fff;font-weight:700}.muted{color:#94a3b8;font-size:.92rem}</style>' +
        '</head><body><h1>Dash Ledger</h1><p><strong>' +
        escapeHtml(clientName) +
        '</strong> is requesting access to your synchronized Dash Ledger mirror.</p>' +
        '<p class="muted">Scopes: ' +
        escapeHtml(scopeText) +
        '. Your browser IndexedDB remains the canonical ledger.</p>' +
        '<form method="post" action="' +
        action +
        '"><label>User ID</label><input name="userId" autocomplete="username" required>' +
        '<label>Login secret</label><input name="loginSecret" type="password" ' +
        'autocomplete="current-password" required>' +
        '<button name="decision" value="allow" type="submit">Allow</button></form></body></html>',
    );
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const form = await request.formData();
  if (form.get('decision') !== 'allow') {
    return htmlResponse('<p>Authorization denied.</p>', 403);
  }

  const userId = String(form.get('userId') ?? '');
  const loginSecret = String(form.get('loginSecret') ?? '');
  const user = await verifyUser(env, userId, loginSecret);
  if (!user) {
    return htmlResponse('<p>Invalid Dash Ledger credentials.</p>', 401);
  }

  const grantedScopes = scopes.length ? scopes : ['ledger.read'];
  const completed = await oauth.completeAuthorization({
    request: oauthRequest,
    userId: user.id,
    metadata: { clientName },
    scope: grantedScopes,
    props: {
      userId: user.id,
      displayLabel: user.display_label,
    },
  });
  return Response.redirect(completed.redirectTo, 302);
}

export const defaultHandler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/sync/')) {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    let response: Response;
    if (url.pathname === '/health' && request.method === 'GET') {
      response = jsonResponse({
        ok: true,
        service: 'dash-ledger-gpt-bridge',
        costModel: 'free-tier-only',
        canonicalLedger: 'browser-indexeddb',
      });
    } else if (
      url.pathname === '/admin/bootstrap-user' &&
      request.method === 'POST'
    ) {
      response = await handleBootstrapUser(request, env);
    } else if (url.pathname === '/sync/pair' && request.method === 'POST') {
      response = await handlePair(request, env);
    } else if (
      url.pathname === '/sync/snapshot' &&
      request.method === 'POST'
    ) {
      response = await handleSnapshot(request, env);
    } else if (
      url.pathname === '/sync/disconnect' &&
      request.method === 'POST'
    ) {
      response = await handleDisconnect(request, env);
    } else if (url.pathname === '/sync/inbox' && request.method === 'GET') {
      response = await handleInbox(request, env);
    } else if (
      url.pathname.startsWith('/sync/inbox/') &&
      url.pathname.endsWith('/resolve') &&
      request.method === 'POST'
    ) {
      const parts = url.pathname.split('/');
      response = await handleResolve(request, env, parts[3] ?? '');
    } else if (url.pathname === '/authorize') {
      response = await handleAuthorize(request, env);
    } else {
      response = jsonResponse({ error: 'not_found' }, 404);
    }

    return url.pathname.startsWith('/sync/')
      ? withCors(response, request, env)
      : response;
  },
};

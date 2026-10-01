import Dexie, { type Table } from 'dexie';
import type { LedgerSnapshot } from '../db/repositories';
import {
  createExpense,
  updateShift,
  type EditShiftInput,
  type ExpenseInput,
} from '../db/repositories';

const BRIDGE_DB_NAME = 'dash-ledger-gpt-bridge-v1';
/** Production Worker base URL (no trailing slash). Editable in Settings for diagnostics. */
export const DEFAULT_GPT_BRIDGE_ENDPOINT =
  'https://dash-ledger-gpt-bridge.atlas-of-one.workers.dev';

const CONFIG_KEY = 'config';

export interface GptBridgeConfig {
  key: typeof CONFIG_KEY;
  endpoint: string;
  userId: string;
  displayLabel: string;
  deviceId: string;
  deviceToken: string;
  connectedAt: string;
  lastSyncAt: string | null;
}

interface AppliedProposal {
  proposalId: string;
  appliedAt: string;
}

export type GptProposal =
  | {
      id: string;
      kind: 'expense';
      status: string;
      createdAt: string;
      payload: {
        clientRequestId: string;
        date: string;
        amountCents: number;
        merchant?: string;
        category: string;
        taxClass: ExpenseInput['taxClass'];
        notes?: string;
        shiftId?: string | null;
      };
    }
  | {
      id: string;
      kind: 'shift_update';
      status: string;
      createdAt: string;
      payload: {
        clientRequestId: string;
        shiftId: string;
        patch: EditShiftInput;
      };
    };

class GptBridgeDB extends Dexie {
  config!: Table<GptBridgeConfig, string>;
  appliedProposals!: Table<AppliedProposal, string>;

  constructor() {
    super(BRIDGE_DB_NAME);
    this.version(1).stores({
      config: 'key',
      appliedProposals: 'proposalId, appliedAt',
    });
  }
}

let bridgeDb: GptBridgeDB | null = null;

function db(): GptBridgeDB {
  if (!bridgeDb) bridgeDb = new GptBridgeDB();
  return bridgeDb;
}

function normalizeEndpoint(raw: string): string {
  const url = new URL(raw.trim());
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('GPT Bridge endpoint must use HTTPS.');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function jsonFetch<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; [key: string]: unknown }
    | null;
  if (!response.ok) {
    const detail = body?.error ? ': ' + body.error : '';
    throw new Error('GPT Bridge request failed (' + response.status + ')' + detail);
  }
  return body as T;
}

export async function getGptBridgeConfig(): Promise<GptBridgeConfig | null> {
  return (await db().config.get(CONFIG_KEY)) ?? null;
}

export async function pairGptBridge(input: {
  endpoint: string;
  userId: string;
  loginSecret: string;
  deviceLabel: string;
}): Promise<GptBridgeConfig> {
  const endpoint = normalizeEndpoint(input.endpoint);
  const paired = await jsonFetch<{
    deviceId: string;
    deviceToken: string;
    userId: string;
    displayLabel: string;
  }>(endpoint + '/sync/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: input.userId.trim(),
      loginSecret: input.loginSecret,
      deviceLabel: input.deviceLabel.trim() || 'Dash Ledger browser',
    }),
  });

  const config: GptBridgeConfig = {
    key: CONFIG_KEY,
    endpoint,
    userId: paired.userId,
    displayLabel: paired.displayLabel,
    deviceId: paired.deviceId,
    deviceToken: paired.deviceToken,
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
  };
  await db().config.put(config);
  return config;
}

export async function disconnectGptBridge(): Promise<void> {
  const config = await getGptBridgeConfig();
  if (config) {
    try {
      await jsonFetch(config.endpoint + '/sync/disconnect', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + config.deviceToken },
      });
    } catch {
      // Local disconnect must remain possible even when the remote bridge is unavailable.
    }
  }
  await db().delete();
  bridgeDb = null;
}

function minimalSnapshot(snapshot: LedgerSnapshot, deviceId: string) {
  return {
    format: 'dash-ledger-gpt-sync-v1' as const,
    formatVersion: 1 as const,
    schemaVersion: snapshot.meta.schemaVersion,
    generatedAt: new Date().toISOString(),
    deviceId,
    settings: {
      implausibleMiles: snapshot.settings.implausibleMiles,
    },
    vehicles: snapshot.vehicles.map((v) => ({
      id: v.id,
      label: v.label,
      archived: v.archived,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
    shifts: snapshot.shifts.map((s) => ({
      id: s.id,
      status: s.status,
      date: s.date,
      weekKey: s.weekKey,
      vehicleId: s.vehicleId,
      vehicleLabel: s.vehicleLabel,
      startTime: s.startTime,
      endTime: s.endTime,
      startOdometer: s.startOdometer,
      endOdometer: s.endOdometer,
      appEarningsCents: s.appEarningsCents,
      cashTipsCents: s.cashTipsCents,
      purpose: s.purpose,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    expenses: snapshot.expenses.map((e) => ({
      id: e.id,
      date: e.date,
      amountCents: e.amountCents,
      category: e.category,
      taxClass: e.taxClass,
      shiftId: e.shiftId,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    mileageRates: snapshot.mileageRates.map((r) => ({
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      ratePerMile: r.ratePerMile,
      label: r.label,
      source: r.source,
      seeded: r.seeded,
    })),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function buildGptSyncSnapshot(
  snapshot: LedgerSnapshot,
  deviceId: string,
) {
  const base = minimalSnapshot(snapshot, deviceId);
  return {
    ...base,
    snapshotHash: await sha256Hex(JSON.stringify(base)),
  };
}

export async function syncGptBridge(
  snapshot: LedgerSnapshot,
): Promise<{ unchanged: boolean; version: number; receivedAt: string }> {
  const config = await getGptBridgeConfig();
  if (!config) throw new Error('GPT Bridge is not connected.');

  const payload = await buildGptSyncSnapshot(snapshot, config.deviceId);
  const result = await jsonFetch<{
    unchanged: boolean;
    version: number;
    receivedAt: string;
  }>(config.endpoint + '/sync/snapshot', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.deviceToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  await db().config.put({
    ...config,
    lastSyncAt: payload.generatedAt,
  });
  return result;
}

function isProposal(value: unknown): value is GptProposal {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<GptProposal>;
  return (
    typeof p.id === 'string' &&
    (p.kind === 'expense' || p.kind === 'shift_update') &&
    typeof p.createdAt === 'string' &&
    !!p.payload &&
    typeof p.payload === 'object'
  );
}

export async function fetchGptProposals(): Promise<GptProposal[]> {
  const config = await getGptBridgeConfig();
  if (!config) return [];
  const result = await jsonFetch<{ proposals: unknown[] }>(
    config.endpoint + '/sync/inbox',
    {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + config.deviceToken },
    },
  );
  return result.proposals.filter(isProposal);
}

async function resolveRemote(
  config: GptBridgeConfig,
  proposalId: string,
  status: 'accepted' | 'rejected',
): Promise<void> {
  await jsonFetch(
    config.endpoint +
      '/sync/inbox/' +
      encodeURIComponent(proposalId) +
      '/resolve',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.deviceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    },
  );
}

export async function rejectGptProposal(proposalId: string): Promise<void> {
  const config = await getGptBridgeConfig();
  if (!config) throw new Error('GPT Bridge is not connected.');
  await resolveRemote(config, proposalId, 'rejected');
}

export async function applyGptProposal(proposal: GptProposal): Promise<'applied' | 'already-applied'> {
  const config = await getGptBridgeConfig();
  if (!config) throw new Error('GPT Bridge is not connected.');

  const prior = await db().appliedProposals.get(proposal.id);
  if (prior) {
    await resolveRemote(config, proposal.id, 'accepted').catch(() => undefined);
    return 'already-applied';
  }

  if (proposal.kind === 'expense') {
    const p = proposal.payload;
    if (
      !p.date ||
      !Number.isInteger(p.amountCents) ||
      p.amountCents <= 0 ||
      !p.category ||
      !p.taxClass
    ) {
      throw new Error('GPT expense proposal is malformed.');
    }
    await createExpense({
      date: p.date,
      amountCents: p.amountCents,
      merchant: p.merchant ?? '',
      category: p.category,
      taxClass: p.taxClass,
      notes: p.notes ?? '',
      shiftId: p.shiftId ?? null,
      receiptId: null,
    });
  } else {
    const p = proposal.payload;
    if (!p.shiftId || !p.patch || Object.keys(p.patch).length === 0) {
      throw new Error('GPT shift proposal is malformed.');
    }
    await updateShift(p.shiftId, p.patch);
  }

  await db().appliedProposals.put({
    proposalId: proposal.id,
    appliedAt: new Date().toISOString(),
  });

  await resolveRemote(config, proposal.id, 'accepted');
  return 'applied';
}

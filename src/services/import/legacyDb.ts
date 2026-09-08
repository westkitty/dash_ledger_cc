/**
 * Read-only access to databases written by earlier Dash Ledger versions.
 *
 * Rules, without exception:
 *   - a legacy database is opened WITHOUT a version number, so IndexedDB can
 *     never run an upgrade against it;
 *   - nothing is ever written to it;
 *   - it is never cleared or deleted, before or after a successful import — it
 *     stays on the device as a recovery source.
 *
 * The result is shaped like a backup document so it flows through exactly the
 * same detection + normalisation path as an imported file. There is one
 * compatibility layer, not two.
 */

import { LEGACY_DB_NAMES } from '../../db/db';
import { blobToDataUrl } from '../receiptImages';
import { logDiagnostic } from '../diagnosticsLog';

export interface LegacyDatabaseInfo {
  name: string;
  present: boolean;
  version: number | null;
  /** Store names found, for the recovery summary. */
  stores: string[];
  /** How presence was established. */
  detection: 'enumerated' | 'probed' | 'unavailable';
}

export interface LegacyScanResult {
  /**
   * False when `indexedDB.databases()` is unavailable (notably Firefox). Presence
   * is then established by probing the known names instead, which cannot find a
   * database under a name this build does not already know about.
   */
  enumerationSupported: boolean;
  found: LegacyDatabaseInfo[];
  /** True when the scan could not run at all (no IndexedDB). */
  unavailable: boolean;
}

type IdbFactoryWithDatabases = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string; version?: number }>>;
};

function idb(): IdbFactoryWithDatabases | null {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB ? (indexedDB as IdbFactoryWithDatabases) : null;
  } catch {
    return null;
  }
}

/**
 * Open a legacy database read-only. Resolves null when it does not exist.
 *
 * `open(name)` with no version never triggers an upgrade for a database that
 * already exists. If the database is absent the browser would CREATE it, so the
 * upgrade transaction is aborted immediately, leaving nothing behind.
 */
function openExisting(name: string): Promise<IDBDatabase | null> {
  const factory = idb();
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve) => {
    let wouldCreate = false;
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      // The database did not exist. Abort so we do not leave an empty one behind.
      wouldCreate = true;
      try {
        request.transaction?.abort();
      } catch {
        /* aborting is best effort; the error path below still resolves null */
      }
    };
    request.onsuccess = () => {
      if (wouldCreate) {
        try {
          request.result.close();
        } catch {
          /* ignore */
        }
        resolve(null);
        return;
      }
      resolve(request.result);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function getAll(db: IDBDatabase, store: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(store)) {
      resolve([]);
      return;
    }
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/** Look for legacy databases on this origin without modifying any of them. */
export async function scanLegacyDatabases(): Promise<LegacyScanResult> {
  const factory = idb();
  if (!factory) {
    return { enumerationSupported: false, found: [], unavailable: true };
  }

  let enumerated: Map<string, number | undefined> | null = null;
  if (typeof factory.databases === 'function') {
    try {
      const list = await factory.databases();
      enumerated = new Map(
        list.filter((d) => typeof d.name === 'string').map((d) => [d.name as string, d.version]),
      );
    } catch {
      enumerated = null;
    }
  }

  const found: LegacyDatabaseInfo[] = [];
  for (const name of LEGACY_DB_NAMES) {
    if (enumerated && !enumerated.has(name)) {
      found.push({ name, present: false, version: null, stores: [], detection: 'enumerated' });
      continue;
    }
    const db = await openExisting(name);
    if (!db) {
      found.push({
        name,
        present: false,
        version: null,
        stores: [],
        detection: enumerated ? 'enumerated' : 'probed',
      });
      continue;
    }
    found.push({
      name,
      present: true,
      version: db.version,
      stores: Array.from(db.objectStoreNames),
      detection: enumerated ? 'enumerated' : 'probed',
    });
    db.close();
  }

  return { enumerationSupported: enumerated !== null, found, unavailable: false };
}

/**
 * Read a legacy database into a backup-shaped document.
 *
 * Handles every store layout the lineage produced:
 *   - `shifts` (original app / cc) and `dashes` (Grok build)
 *   - settings as one row per key (original app) or one `kv` object (cc / Grok)
 *   - `metadata` rows (original app) or `kv:meta` (cc)
 *   - receipt images as a Blob on the row (original app) or in `receiptBlobs`
 */
export async function readLegacyDatabase(name: string): Promise<Record<string, unknown> | null> {
  const db = await openExisting(name);
  if (!db) return null;

  try {
    const [
      vehicles,
      shifts,
      dashes,
      expenses,
      receipts,
      receiptBlobs,
      weeklyClosures,
      weekReviews,
      mileageRates,
      merchantMemory,
      settingsRows,
      metadataRows,
      kvRows,
    ] = await Promise.all([
      getAll(db, 'vehicles'),
      getAll(db, 'shifts'),
      getAll(db, 'dashes'),
      getAll(db, 'expenses'),
      getAll(db, 'receipts'),
      getAll(db, 'receiptBlobs'),
      getAll(db, 'weeklyClosures'),
      getAll(db, 'weekReviews'),
      getAll(db, 'mileageRates'),
      getAll(db, 'merchantMemory'),
      getAll(db, 'settings'),
      getAll(db, 'metadata'),
      getAll(db, 'kv'),
    ]);

    const { settings, meta } = collectSettingsAndMeta(settingsRows, metadataRows, kvRows);
    const receiptsOut = await attachReceiptImages(receipts, receiptBlobs);

    const doc: Record<string, unknown> = {
      // The document is labelled by the database it came from; the actual dialect
      // is still decided by record shape in `detectSource`.
      format: name === 'dash-ledger-grok' ? 'dash-ledger-grok-backup' : 'dash-ledger-backup',
      schemaVersion: readSchemaVersion(kvRows, metadataRows),
      generatedAt: new Date().toISOString(),
      vehicles,
      expenses,
      receipts: receiptsOut,
      settings,
      meta,
    };
    if (shifts.length) doc.shifts = shifts;
    if (dashes.length) doc.dashes = dashes;
    if (!shifts.length && !dashes.length) doc.shifts = [];
    if (weeklyClosures.length) doc.weeklyClosures = weeklyClosures;
    if (weekReviews.length) doc.weekReviews = weekReviews;
    if (mileageRates.length) doc.mileageRates = mileageRates;
    if (merchantMemory.length) doc.merchantMemory = merchantMemory;

    return doc;
  } catch (err) {
    logDiagnostic('import', `Could not read legacy database "${name}".`, err);
    return null;
  } finally {
    db.close();
  }
}

function readSchemaVersion(
  kvRows: Record<string, unknown>[],
  metadataRows: Record<string, unknown>[],
): number {
  const kvMeta = kvRows.find((r) => r.key === 'meta')?.value;
  if (kvMeta && typeof kvMeta === 'object') {
    const v = (kvMeta as Record<string, unknown>).schemaVersion;
    if (typeof v === 'number') return v;
  }
  const kvDirect = kvRows.find((r) => r.key === 'schemaVersion')?.value;
  if (typeof kvDirect === 'number') return kvDirect;
  const legacy = metadataRows.find((r) => r.key === 'schemaVersion')?.value;
  if (typeof legacy === 'number') return legacy;
  return 1;
}

function collectSettingsAndMeta(
  settingsRows: Record<string, unknown>[],
  metadataRows: Record<string, unknown>[],
  kvRows: Record<string, unknown>[],
): { settings: Record<string, unknown>; meta: Record<string, unknown> } {
  const settings: Record<string, unknown> = {};

  // Original app: the `settings` store holds one row per key.
  for (const row of settingsRows) {
    if (typeof row.key === 'string') settings[row.key] = row.value;
  }
  // cc / Grok build: a single `settings` object inside `kv`.
  const kvSettings = kvRows.find((r) => r.key === 'settings')?.value;
  if (kvSettings && typeof kvSettings === 'object' && !Array.isArray(kvSettings)) {
    Object.assign(settings, kvSettings as Record<string, unknown>);
  }

  const meta: Record<string, unknown> = {};
  // Original app: a `metadata` store with one row per key.
  for (const row of metadataRows) {
    if (typeof row.key === 'string') meta[row.key] = row.value;
  }
  // The original app named it `lastBackupAt`; canonical calls it "generated".
  if (meta.lastBackupAt && !meta.lastBackupGeneratedAt) {
    meta.lastBackupGeneratedAt = meta.lastBackupAt;
  }
  const kvMeta = kvRows.find((r) => r.key === 'meta')?.value;
  if (kvMeta && typeof kvMeta === 'object' && !Array.isArray(kvMeta)) {
    Object.assign(meta, kvMeta as Record<string, unknown>);
  }

  return { settings, meta };
}

/**
 * Bring receipt image bytes into the document as data URLs, from whichever place
 * the source stored them. A failure to read one image never loses the receipt.
 */
async function attachReceiptImages(
  receipts: Record<string, unknown>[],
  receiptBlobs: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const blobById = new Map<string, Blob>();
  for (const row of receiptBlobs) {
    const id = typeof row.receiptId === 'string' ? row.receiptId : typeof row.id === 'string' ? row.id : null;
    const blob = (row.image ?? row.blob) as unknown;
    if (id && blob instanceof Blob) blobById.set(id, blob);
  }

  const out: Record<string, unknown>[] = [];
  for (const row of receipts) {
    const id = typeof row.id === 'string' ? row.id : null;
    const { image, thumbnail, ...rest } = row;
    const copy: Record<string, unknown> = { ...rest };

    // The original app kept the Blob directly on the receipt row.
    const inline = image instanceof Blob ? image : null;
    const separate = id ? (blobById.get(id) ?? null) : null;
    const blob = inline ?? separate;

    if (blob) {
      try {
        copy.imageBase64 = await blobToDataUrl(blob);
        copy.imageMime = blob.type;
        copy.imageBytes = blob.size;
      } catch (err) {
        logDiagnostic('import', `Receipt ${id ?? '?'}: image could not be read from the legacy database.`, err);
      }
    } else if (typeof image === 'string' && image.startsWith('data:')) {
      copy.imageBase64 = image;
    } else if (typeof thumbnail === 'string' && thumbnail.startsWith('data:')) {
      // Last resort: the original app also stored a data-URL thumbnail. A small
      // image is better evidence than none.
      copy.imageBase64 = thumbnail;
      copy.thumbnailOnly = true;
    }

    out.push(copy);
  }
  return out;
}

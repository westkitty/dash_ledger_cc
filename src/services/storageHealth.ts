/**
 * Local storage health helpers. Every browser API here is feature-detected and
 * degrades gracefully when unsupported.
 */

import { logDiagnostic } from './diagnosticsLog';

export interface StorageHealth {
  persistentSupported: boolean;
  persisted: boolean | null;
  estimateSupported: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function readStorageHealth(): Promise<StorageHealth> {
  const result: StorageHealth = {
    persistentSupported: false,
    persisted: null,
    estimateSupported: false,
    usageBytes: null,
    quotaBytes: null,
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (typeof navigator.storage.persisted === 'function') {
        result.persistentSupported = true;
        result.persisted = await navigator.storage.persisted();
      }
      if (typeof navigator.storage.estimate === 'function') {
        result.estimateSupported = true;
        const est = await navigator.storage.estimate();
        result.usageBytes = est.usage ?? null;
        result.quotaBytes = est.quota ?? null;
      }
    }
  } catch (err) {
    logDiagnostic('storage', 'Failed to read storage health.', err);
  }
  return result;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      const granted = await navigator.storage.persist();
      logDiagnostic('storage', `Persistent storage request ${granted ? 'granted' : 'denied'}.`);
      return granted;
    }
  } catch (err) {
    logDiagnostic('storage', 'Persistent storage request failed.', err);
  }
  return false;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

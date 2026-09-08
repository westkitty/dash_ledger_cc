/**
 * Bounded in-session diagnostic log. Never persisted, never sent anywhere.
 */

export type DiagCategory =
  | 'error'
  | 'rejection'
  | 'db'
  | 'migration'
  | 'restore'
  | 'import'
  | 'receipt'
  | 'storage'
  | 'image'
  | 'backup'
  | 'sw'
  | 'info';

export interface DiagEntry {
  id: number;
  at: string;
  category: DiagCategory;
  message: string;
  detail?: string;
}

const MAX_ENTRIES = 200;
let seq = 1;
const entries: DiagEntry[] = [];
// Cached newest-first snapshot with stable identity between mutations, so
// useSyncExternalStore consumers don't loop.
let snapshot: DiagEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = entries.slice().reverse();
  for (const l of listeners) l();
}

export function logDiagnostic(category: DiagCategory, message: string, detail?: unknown): void {
  let detailStr: string | undefined;
  if (detail !== undefined) {
    if (detail instanceof Error) detailStr = `${detail.name}: ${detail.message}`;
    else if (typeof detail === 'string') detailStr = detail;
    else {
      try {
        detailStr = JSON.stringify(detail);
      } catch {
        detailStr = String(detail);
      }
    }
  }
  entries.push({ id: seq++, at: new Date().toISOString(), category, message, detail: detailStr });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  emit();
}

export function getDiagnostics(): DiagEntry[] {
  return snapshot;
}

export function clearDiagnostics(): void {
  entries.length = 0;
  emit();
}

export function subscribeDiagnostics(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let installed = false;

/** Install global error / rejection listeners once. */
export function installGlobalDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    logDiagnostic('error', e.message || 'Uncaught error', e.error ?? e.filename);
  });
  window.addEventListener('unhandledrejection', (e) => {
    logDiagnostic('rejection', 'Unhandled promise rejection', (e as PromiseRejectionEvent).reason);
  });
}

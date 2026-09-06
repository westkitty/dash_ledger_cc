/**
 * App-wide ledger state. Loads one snapshot of every collection from IndexedDB
 * and re-loads after mutations. Data volume is small (a solo dasher's records),
 * so a full reload per mutation keeps the model simple and always-consistent.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { loadSnapshot, type LedgerSnapshot } from '../db/repositories';
import { indexedDBAvailable } from '../db/db';
import { logDiagnostic } from '../services/diagnosticsLog';
import type { ThemeChoice } from '../domain/types';

type Status = 'loading' | 'ready' | 'error' | 'no-indexeddb';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'warn' | 'danger';
}

interface LedgerContextValue {
  status: Status;
  error: string | null;
  snapshot: LedgerSnapshot | null;
  reload: () => Promise<void>;
  /** Run a mutation, reload, and surface a toast. Returns the result or throws. */
  mutate: <T>(fn: () => Promise<T>, opts?: { success?: string; silent?: boolean }) => Promise<T>;
  toasts: ToastItem[];
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: number) => void;
  setTheme: (t: ThemeChoice) => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function applyThemeToDocument(theme: ThemeChoice): void {
  const el = document.documentElement;
  if (theme === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('dash-ledger:theme', theme);
  } catch {
    /* storage unavailable — the in-memory setting still applies for this session */
  }
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeq = useRef(1);

  const reload = useCallback(async () => {
    if (!indexedDBAvailable()) {
      setStatus('no-indexeddb');
      return;
    }
    try {
      const snap = await loadSnapshot();
      setSnapshot(snap);
      setError(null);
      setStatus('ready');
    } catch (err) {
      logDiagnostic('db', 'Failed to load ledger snapshot.', err);
      setError((err as Error).message || 'Could not open the local database.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Keep the theme applied whenever settings change.
  useEffect(() => {
    if (snapshot?.settings.theme) applyThemeToDocument(snapshot.settings.theme);
  }, [snapshot?.settings.theme]);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'default') => {
      const id = toastSeq.current++;
      setToasts((t) => [...t, { id, message, tone }]);
      const ttl = tone === 'default' ? 3200 : 5200;
      window.setTimeout(() => dismissToast(id), ttl);
    },
    [dismissToast],
  );

  const mutate = useCallback(
    async <T,>(fn: () => Promise<T>, opts?: { success?: string; silent?: boolean }): Promise<T> => {
      try {
        const result = await fn();
        await reload();
        if (opts?.success && !opts.silent) pushToast(opts.success);
        return result;
      } catch (err) {
        logDiagnostic('error', 'Mutation failed.', err);
        if (!opts?.silent) pushToast((err as Error).message || 'Something went wrong.', 'danger');
        throw err;
      }
    },
    [reload, pushToast],
  );

  const setTheme = useCallback((t: ThemeChoice) => {
    applyThemeToDocument(t);
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      status,
      error,
      snapshot,
      reload,
      mutate,
      toasts,
      pushToast,
      dismissToast,
      setTheme,
    }),
    [status, error, snapshot, reload, mutate, toasts, pushToast, dismissToast, setTheme],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedgerContext(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedgerContext must be used inside LedgerProvider');
  return ctx;
}

/** Convenience hook that assumes a ready snapshot (guarded by App). */
export function useLedger(): LedgerSnapshot & { reload: () => Promise<void> } {
  const { snapshot, reload } = useLedgerContext();
  if (!snapshot) throw new Error('useLedger used before snapshot ready');
  return { ...snapshot, reload };
}

export function useToast() {
  const { pushToast } = useLedgerContext();
  return pushToast;
}

export function useMutate() {
  const { mutate } = useLedgerContext();
  return mutate;
}

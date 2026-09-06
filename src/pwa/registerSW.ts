/**
 * Service-worker registration with an unobtrusive update flow.
 *
 * A waiting update is NOT applied automatically — it would risk discarding
 * in-progress form input. The app surfaces an "Update available" affordance and
 * only reloads on deliberate user action.
 */

import { logDiagnostic } from '../services/diagnosticsLog';

type UpdateListener = (apply: () => void) => void;

let applyUpdate: (() => void) | null = null;
const listeners = new Set<UpdateListener>();

export function onUpdateAvailable(fn: UpdateListener): () => void {
  listeners.add(fn);
  if (applyUpdate) fn(applyUpdate);
  return () => listeners.delete(fn);
}

function announce(apply: () => void) {
  applyUpdate = apply;
  for (const l of listeners) l(apply);
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            announce(() => updateSW(true));
          },
          onOfflineReady() {
            logDiagnostic('sw', 'App shell cached; offline use is ready.');
          },
          onRegisterError(err: unknown) {
            logDiagnostic('sw', 'Service worker registration failed.', err);
          },
        });
      })
      .catch((err) => logDiagnostic('sw', 'Failed to load PWA register module.', err));
  });
}

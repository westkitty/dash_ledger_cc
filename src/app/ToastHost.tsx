import { useLedgerContext } from '../state/store';

export function ToastHost() {
  const { toasts, dismissToast } = useLedgerContext();
  return (
    <div className="toast-wrap" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.tone === 'warn' ? 'toast--warn' : t.tone === 'danger' ? 'toast--danger' : ''}`}
        >
          <button type="button" className="toast__msg" onClick={() => dismissToast(t.id)}>
            {t.message}
          </button>
          {t.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

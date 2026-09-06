import { useLedgerContext } from '../state/store';

export function ToastHost() {
  const { toasts, dismissToast } = useLedgerContext();
  return (
    <div className="toast-wrap" aria-live="polite" role="status">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast ${t.tone === 'warn' ? 'toast--warn' : t.tone === 'danger' ? 'toast--danger' : ''}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

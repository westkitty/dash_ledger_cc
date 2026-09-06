import { useEffect, useState } from 'react';
import { onUpdateAvailable } from '../pwa/registerSW';

export function UpdateBanner() {
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => onUpdateAvailable((fn) => setApply(() => fn)), []);

  if (!apply) return null;
  return (
    <div className="notice notice--info" style={{ borderRadius: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
      <span className="grow small">
        <strong>Update available.</strong> Reload to get the new version. Your unsaved form input is
        the only thing a reload can lose.
      </span>
      <button className="btn btn--primary" style={{ minHeight: 40 }} onClick={() => apply()}>
        Reload
      </button>
    </div>
  );
}

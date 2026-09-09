import { useRouter } from '../app/router';
import './demo-switcher.css';

const MODES = [
  { key: 'current', label: 'Current', to: '/?demo=1' },
  { key: '1', label: '1', to: '/ux-lab/1?demo=1' },
  { key: '2', label: '2', to: '/ux-lab/2?demo=1' },
  { key: '3', label: '3', to: '/ux-lab/3?demo=1' },
  { key: '4', label: '4', to: '/ux-lab/4?demo=1' },
] as const;

function activeMode(path: string): (typeof MODES)[number]['key'] {
  if (path === '/ux-lab/1') return '1';
  if (path === '/ux-lab/2') return '2';
  if (path === '/ux-lab/3') return '3';
  if (path === '/ux-lab/4') return '4';
  return 'current';
}

export function UxDemoSwitcher() {
  const { path, navigate } = useRouter();
  const active = activeMode(path);
  const inLab = path.startsWith('/ux-lab');

  return (
    <nav
      className={`uxdemo-switcher${inLab ? ' uxdemo-switcher--lab' : ''}`}
      aria-label="Dash Ledger UI demo switcher"
    >
      <span className="uxdemo-switcher__label">UI demo</span>
      <div className="uxdemo-switcher__modes">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className="uxdemo-switcher__button"
            aria-pressed={active === mode.key}
            aria-label={mode.key === 'current' ? 'Show current Dash Ledger UI' : `Show redesign concept ${mode.label}`}
            onClick={() => navigate(mode.to)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

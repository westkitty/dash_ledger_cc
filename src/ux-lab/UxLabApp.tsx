import { Link } from '../app/router';
import { Routes, type RouteDef } from '../app/router';
import { RootErrorBoundary } from '../app/ErrorBoundary';
import { useLedgerContext } from '../state/store';
import { UxLabIndex } from './UxLabIndex';
import { Concept1ReachDesk } from './concepts/Concept1ReachDesk';
import { Concept2ReviewQueue } from './concepts/Concept2ReviewQueue';
import { Concept3WeekStory } from './concepts/Concept3WeekStory';
import { Concept4YearGlance } from './concepts/Concept4YearGlance';
import './lab.css';

const UX_LAB_ROUTES: RouteDef[] = [
  { path: '/ux-lab', render: () => <UxLabIndex /> },
  { path: '/ux-lab/1', render: () => <Concept1ReachDesk /> },
  { path: '/ux-lab/2', render: () => <Concept2ReviewQueue /> },
  { path: '/ux-lab/3', render: () => <Concept3WeekStory /> },
  { path: '/ux-lab/4', render: () => <Concept4YearGlance /> },
];

/**
 * Alternate UI tree. LedgerProvider is intentionally mounted above this tree
 * in main.tsx, so every concept reads and mutates the exact same IndexedDB
 * database as the canonical app.
 */
export function UxLabApp() {
  const { status, error, reload } = useLedgerContext();

  if (status === 'loading') {
    return <div className="app-main"><div className="uxlab-card">Opening the shared local ledger…</div></div>;
  }
  if (status === 'no-indexeddb') {
    return <div className="app-main"><div className="uxlab-card">IndexedDB is unavailable in this browser context.</div></div>;
  }
  if (status === 'error') {
    return (
      <div className="app-main">
        <div className="uxlab-card stack">
          <strong>Could not open the shared ledger.</strong>
          <span>{error ?? 'Unknown database error'}</span>
          <button className="uxlab-btn" type="button" onClick={() => void reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main id="main-content" tabIndex={-1} className="app-main">
        <RootErrorBoundary scope="ux-lab" key="ux-lab">
          <Routes
            routes={UX_LAB_ROUTES}
            fallback={(p) => (
              <div className="uxlab stack">
                <div className="uxlab-card">
                  <div className="uxlab-label">UI/UX variants</div>
                  <p>No alternate UI matches <span className="inline-code">{p}</span>.</p>
                  <Link to="/?demo=1" className="uxlab-chip uxlab-chip--ghost">Current UI</Link>
                </div>
              </div>
            )}
          />
        </RootErrorBoundary>
      </main>
    </div>
  );
}

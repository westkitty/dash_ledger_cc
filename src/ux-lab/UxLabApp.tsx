/**
 * UX Lab standalone app tree — EXPERIMENTAL (branch: ui-ux-redesign-lab).
 *
 * Mounted by src/main.tsx INSTEAD of the canonical <App> whenever the hash is
 * #/ux-lab*. Because the swap happens before <LedgerProvider> ever mounts, lab
 * sessions never construct the store, never open IndexedDB, and cannot read or
 * write canonical user data — isolation is structural, not by convention.
 *
 * The canonical App.tsx and its route table are untouched; the lab renders no
 * production chrome (BottomNav / OnRoadBar / ToastHost all require the store).
 */

import { Link } from '../app/router';
import { Routes, type RouteDef } from '../app/router';
import { RootErrorBoundary } from '../app/ErrorBoundary';
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

export function UxLabApp() {
  return (
    <div className="app-shell">
      <main id="main-content" tabIndex={-1} className="app-main">
        <RootErrorBoundary scope="ux-lab" key="ux-lab">
          <Routes
            routes={UX_LAB_ROUTES}
            fallback={(p) => (
              <div className="uxlab stack">
                <div className="uxlab-card">
                  <div className="uxlab-label">UX Lab</div>
                  <p>No lab concept matches <span className="inline-code">{p}</span>.</p>
                  <Link to="/ux-lab" className="uxlab-chip uxlab-chip--ghost">
                    ‹ Lab index
                  </Link>
                </div>
              </div>
            )}
          />
        </RootErrorBoundary>
      </main>
    </div>
  );
}

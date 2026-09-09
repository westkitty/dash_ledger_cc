import { useEffect } from 'react';
import { Routes, useRouter, type RouteDef } from './router';
import { useLedgerContext } from '../state/store';
import { RootErrorBoundary } from './ErrorBoundary';
import { BottomNav } from './BottomNav';
import { ToastHost } from './ToastHost';
import { UpdateBanner } from './UpdateBanner';
import { EmptyState } from '../components/ui';
import { OnRoadBar } from '../features/desk/OnRoadBar';

import { DeskScreen } from '../features/desk/DeskScreen';
import { StartDashScreen } from '../features/dash/StartDashScreen';
import { EndDashScreen } from '../features/dash/EndDashScreen';
import { LogCompletedDashScreen } from '../features/dash/LogCompletedDashScreen';
import { EditDashScreen } from '../features/dash/EditDashScreen';
import { WeekScreen } from '../features/week/WeekScreen';
import { ExpenseFormScreen } from '../features/expenses/ExpenseFormScreen';
import { ReceiptsScreen } from '../features/receipts/ReceiptsScreen';
import { CaptureReceiptScreen } from '../features/receipts/CaptureReceiptScreen';
import { ReceiptDetailScreen } from '../features/receipts/ReceiptDetailScreen';
import { ReceiptFolderScreen } from '../features/receipts/ReceiptFolderScreen';
import { VaultScreen } from '../features/vault/VaultScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { DiagnosticsScreen } from '../features/diagnostics/DiagnosticsScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';

const ROUTES: RouteDef[] = [
  { path: '/', render: () => <DeskScreen /> },
  { path: '/onboarding', render: () => <OnboardingScreen /> },
  { path: '/start', render: () => <StartDashScreen /> },
  { path: '/end', render: () => <EndDashScreen /> },
  { path: '/log', render: () => <LogCompletedDashScreen /> },
  { path: '/dash/:id', render: ({ params }) => <EditDashScreen id={params.id} /> },
  { path: '/week', render: ({ query }) => <WeekScreen weekKey={query.get('w')} /> },
  { path: '/expense/new', render: ({ query }) => <ExpenseFormScreen shiftId={query.get('shift')} receiptId={query.get('receipt')} /> },
  { path: '/expense/:id', render: ({ params }) => <ExpenseFormScreen id={params.id} /> },
  { path: '/receipts', render: () => <ReceiptsScreen /> },
  { path: '/receipts/capture', render: () => <CaptureReceiptScreen /> },
  { path: '/receipts/folder/:year/:category', render: ({ params }) => <ReceiptFolderScreen year={params.year} category={params.category} /> },
  { path: '/receipts/:id', render: ({ params }) => <ReceiptDetailScreen id={params.id} /> },
  { path: '/vault', render: ({ query }) => <VaultScreen section={query.get('s')} year={query.get('y')} /> },
  { path: '/settings', render: () => <SettingsScreen /> },
  { path: '/diagnostics', render: () => <DiagnosticsScreen /> },
];

function LoadingScreen() {
  return (
    <div className="app-main">
      <div className="card">
        <p className="muted">Opening your local ledger…</p>
      </div>
    </div>
  );
}

function NoIndexedDb() {
  return (
    <div className="app-main">
      <div className="card stack">
        <h1>Local storage unavailable</h1>
        <p className="muted">
          Dash Ledger stores everything in this browser's IndexedDB. This context has it disabled —
          often a private-browsing window or a locked-down browser profile.
        </p>
        <p className="small">
          Open the app in a normal window, or enable site data / storage for this origin, then reload.
        </p>
      </div>
    </div>
  );
}

function DbError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="app-main">
      <div className="card stack">
        <h1>Couldn't open the database</h1>
        <p className="muted">{message}</p>
        <p className="small">
          This can happen if another tab is mid-upgrade, or storage is full. Your existing data has
          not been altered.
        </p>
        <div className="btn-row">
          <button className="btn btn--primary" onClick={onRetry}>
            Retry
          </button>
          <a className="btn" href="#/diagnostics">
            Diagnostics
          </a>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { status, error, snapshot, reload } = useLedgerContext();
  const { path } = useRouter();

  const activeShift = snapshot?.activeShift;

  // No onboarding wall. The Desk is the first meaningful screen even for a brand
  // new ledger with no vehicle — tapping Start Dash chains through a minimal
  // vehicle-creation step and resumes. `/onboarding` still exists for explicit
  // setup, and Recovery (`/vault?s=recovery`) is always directly reachable.

  // Reflect active-dash mode on <body> so the whole shell shifts visually.
  useEffect(() => {
    document.body.classList.toggle('body--active', !!activeShift && path === '/');
    return () => document.body.classList.remove('body--active');
  }, [activeShift, path]);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'no-indexeddb') return <NoIndexedDb />;
  if (status === 'error') return <DbError message={error ?? 'Unknown error'} onRetry={() => void reload()} />;

  return (
    <div className="app-shell">
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          const el = document.getElementById('main-content');
          el?.focus();
          if (typeof el?.scrollIntoView === 'function') el.scrollIntoView();
        }}
      >
        Skip to main content
      </button>
      <UpdateBanner />
      <OnRoadBar />
      <main
        id="main-content"
        tabIndex={-1}
        className={`app-main ${activeShift && path === '/' ? 'app-main--active' : ''}`}
      >
        <RootErrorBoundary scope={path} key={path}>
          <Routes
            routes={ROUTES}
            fallback={(p) => (
              <EmptyState icon="✕" title="Screen not found" action={<a className="btn" href="#/">Go to the Desk</a>}>
                No route matches <span className="inline-code">{p}</span>.
              </EmptyState>
            )}
          />
        </RootErrorBoundary>
      </main>
      <BottomNav />
      <ToastHost />
    </div>
  );
}

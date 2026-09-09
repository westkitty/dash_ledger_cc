import { useEffect, useState } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './app/App';
import { RouterProvider } from './app/router';
import { LedgerProvider } from './state/store';
import { RootErrorBoundary } from './app/ErrorBoundary';
import { installGlobalDiagnostics } from './services/diagnosticsLog';
import { registerServiceWorker } from './pwa/registerSW';
import { UxLabApp } from './ux-lab/UxLabApp';
import { UxDemoSwitcher } from './ux-lab/UxDemoSwitcher';

installGlobalDiagnostics();

function readDemoState() {
  const hash = window.location.hash;
  return {
    lab: hash.startsWith('#/ux-lab'),
    demo: hash.includes('demo=1'),
  };
}

/**
 * Five-UI demo switch.
 *
 * LedgerProvider deliberately stays mounted above BOTH the canonical app and
 * every alternate UI. All five surfaces therefore share the same live snapshot,
 * the same mutation/reload channel, and the same IndexedDB database on this
 * origin. Switching UI is presentation-only; it must never swap in a mock store
 * or reset/reseed the user's ledger.
 */
function Root() {
  const [state, setState] = useState(readDemoState);

  useEffect(() => {
    const onChange = () => setState(readDemoState());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return (
    <LedgerProvider>
      {state.lab ? <UxLabApp /> : <App />}
      {(state.lab || state.demo) && <UxDemoSwitcher />}
    </LedgerProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <RootErrorBoundary>
      <RouterProvider>
        <Root />
      </RouterProvider>
    </RootErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();

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
 * UX Lab isolation switch (branch: ui-ux-redesign-lab).
 *
 * Hash `#/ux-lab…` renders the standalone experimental tree INSTEAD of the
 * canonical app. Because the decision happens here — above LedgerProvider —
 * a lab session never mounts the store and never touches IndexedDB. Exiting
 * the lab mounts the normal app exactly as shipped.
 *
 * `?demo=1` enables the compact five-position demo selector on the canonical
 * app. Lab routes always show it so a tester can move Current ⇄ Concepts 1–4
 * without hunting through the lab index.
 */
function Root() {
  const [state, setState] = useState(readDemoState);

  useEffect(() => {
    const onChange = () => setState(readDemoState());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return (
    <>
      {state.lab ? (
        <UxLabApp />
      ) : (
        <LedgerProvider>
          <App />
        </LedgerProvider>
      )}
      {(state.lab || state.demo) && <UxDemoSwitcher />}
    </>
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

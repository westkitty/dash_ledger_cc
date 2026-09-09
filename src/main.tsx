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

installGlobalDiagnostics();

/**
 * UX Lab isolation switch (branch: ui-ux-redesign-lab).
 *
 * Hash `#/ux-lab…` renders the standalone experimental tree INSTEAD of the
 * canonical app. Because the decision happens here — above LedgerProvider —
 * a lab session never mounts the store and never touches IndexedDB. Exiting
 * the lab (any non-lab hash) mounts the normal app exactly as shipped.
 */
function Root() {
  const [lab, setLab] = useState(() => window.location.hash.startsWith('#/ux-lab'));

  useEffect(() => {
    const onChange = () => setLab(window.location.hash.startsWith('#/ux-lab'));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return lab ? (
    <UxLabApp />
  ) : (
    <LedgerProvider>
      <App />
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

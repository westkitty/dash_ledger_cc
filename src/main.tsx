import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './app/App';
import { RouterProvider } from './app/router';
import { LedgerProvider } from './state/store';
import { RootErrorBoundary } from './app/ErrorBoundary';
import { installGlobalDiagnostics } from './services/diagnosticsLog';
import { registerServiceWorker } from './pwa/registerSW';

installGlobalDiagnostics();

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <RootErrorBoundary>
      <RouterProvider>
        <LedgerProvider>
          <App />
        </LedgerProvider>
      </RouterProvider>
    </RootErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();

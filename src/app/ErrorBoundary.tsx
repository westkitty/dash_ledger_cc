import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logDiagnostic } from '../services/diagnosticsLog';

interface Props {
  children: ReactNode;
  /** Optional label so nested boundaries are identifiable in diagnostics. */
  scope?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logDiagnostic('error', `Render error${this.props.scope ? ` in ${this.props.scope}` : ''}: ${error.message}`, info.componentStack ?? undefined);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="app-main" style={{ maxWidth: 560 }}>
        <div className="card stack">
          <h1>Something broke on screen</h1>
          <p className="muted">
            The app hit a rendering error. Your saved records were not touched — everything lives in
            this device's local database.
          </p>
          <pre className="inline-code" style={{ whiteSpace: 'pre-wrap' }}>
            {error.message}
          </pre>
          <div className="btn-row">
            <button className="btn btn--primary" onClick={this.reset}>
              Try again
            </button>
            <a className="btn" href="#/diagnostics">
              Open diagnostics
            </a>
          </div>
          <p className="small faint">
            If this keeps happening, export your data from Tax / Vault before anything else. Clearing
            app data is never the recommended first step.
          </p>
        </div>
      </div>
    );
  }
}

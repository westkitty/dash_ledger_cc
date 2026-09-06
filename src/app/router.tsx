/**
 * Minimal hash router. Hash routing keeps deep links working on any static host
 * (GitHub Pages included) with no server rewrite rules.
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface RouteMatch {
  path: string; // e.g. "/dash/:id"
  params: Record<string, string>;
  query: URLSearchParams;
}

interface RouterContextValue {
  path: string;
  query: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  back: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function readHash(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, '');
  const [p, q] = raw.split('?');
  const path = p && p.startsWith('/') ? p : '/';
  return { path: decodeURI(path) || '/', query: new URLSearchParams(q ?? '') };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readHash);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.replace('#/');
    }
    const onChange = () => setState(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
    if (opts?.replace) {
      window.location.replace(target);
      setState(readHash());
    } else {
      window.location.hash = target.slice(1);
    }
    // Scroll to top on navigation, mirroring native app screen changes.
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => window.history.back(), []);

  const value = useMemo<RouterContextValue>(
    () => ({ path: state.path, query: state.query, navigate, back }),
    [state.path, state.query, navigate, back],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}

/** Match the current path against `pattern` (supports `:param` segments). */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pSeg = pattern.split('/').filter(Boolean);
  const aSeg = path.split('/').filter(Boolean);
  if (pSeg.length !== aSeg.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pSeg.length; i++) {
    if (pSeg[i].startsWith(':')) {
      params[pSeg[i].slice(1)] = decodeURIComponent(aSeg[i]);
    } else if (pSeg[i] !== aSeg[i]) {
      return null;
    }
  }
  return params;
}

export interface RouteDef {
  path: string;
  render: (match: RouteMatch) => ReactNode;
}

export function Routes({ routes, fallback }: { routes: RouteDef[]; fallback: (path: string) => ReactNode }) {
  const { path, query } = useRouter();
  for (const r of routes) {
    const params = matchPath(r.path, path);
    if (params) return <>{r.render({ path: r.path, params, query })}</>;
  }
  return <>{fallback(path)}</>;
}

export function Link({
  to,
  className,
  children,
  ariaCurrent,
  onNavigate,
  replace,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  ariaCurrent?: 'page' | undefined;
  onNavigate?: () => void;
  replace?: boolean;
}) {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${to}`}
      className={className}
      aria-current={ariaCurrent}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to, { replace });
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}

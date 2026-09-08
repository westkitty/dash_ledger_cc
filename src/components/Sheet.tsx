/**
 * A modal bottom sheet. Used for the field flows (Start / End Dash) so they open
 * over the Desk instead of navigating away from it — the user never loses their
 * place, and a dismiss never changes the route.
 *
 * Hand-rolled on a `role="dialog"` element rather than a dependency:
 *  - focus moves into the sheet on open and returns to the opener on close
 *  - Tab / Shift+Tab are trapped inside the panel
 *  - Escape and a backdrop click both dismiss
 *  - background page scroll is locked while open
 *  - motion is CSS-only and disabled under `prefers-reduced-motion`
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Sheet({
  onClose,
  title,
  description,
  children,
}: {
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === firstEl || activeEl === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>
            <span aria-hidden>✕</span>
          </button>
        </div>
        {description && (
          <p id={descId} className="sheet__desc small muted">
            {description}
          </p>
        )}
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}

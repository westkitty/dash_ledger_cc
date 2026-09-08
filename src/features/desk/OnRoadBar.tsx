/**
 * Persistent "on the road" indicator for the app shell.
 *
 * Shown on every screen except the Desk itself while a dash is active, so the
 * user can tell they are still on the road from Expense, Receipts, Week or
 * Vault — and always has a one-tap route back. State is carried by the text, not
 * colour alone; it is a plain link (keyboard reachable); it does not pulse.
 */

import { useLedgerContext } from '../../state/store';
import { useRouter, Link } from '../../app/router';

export function OnRoadBar() {
  const { snapshot } = useLedgerContext();
  const { path } = useRouter();
  const active = snapshot?.activeShift;
  if (!active || path === '/') return null;

  return (
    <Link to="/" className="onroad-bar">
      <span className="onroad-bar__mark" aria-hidden>
        ▲
      </span>
      <span className="onroad-bar__text">
        On the road — {active.vehicleLabel}
        {active.startTime ? ` · since ${active.startTime}` : ''}
      </span>
      <span className="onroad-bar__cta" aria-hidden>
        Back to dash ›
      </span>
      <span className="sr-only">Return to the active dash</span>
    </Link>
  );
}

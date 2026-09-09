import { Link } from '../app/router';
import { useLedger } from '../state/store';
import './lab.css';

const CONCEPTS = [
  { n: 1, name: 'Reach Desk', tagline: 'Thumb-first primary surface with a persistent drive dock.', to: '/ux-lab/1?demo=1' },
  { n: 2, name: 'Resolve', tagline: 'One queue of unresolved records with faster decisions.', to: '/ux-lab/2?demo=1' },
  { n: 3, name: 'Week as a story', tagline: 'Day-strip scan, facts vs estimates, sticky weekly close.', to: '/ux-lab/3?demo=1' },
  { n: 4, name: 'Year at a glance', tagline: 'Trend-first year with estimate-labeled deduction headline.', to: '/ux-lab/4?demo=1' },
];

export function UxLabIndex() {
  const snap = useLedger();
  return (
    <div className="uxlab stack">
      <div className="uxlab-chrome">
        <div className="uxlab-chrome__banner">Five-UI Pages demo · ONE SHARED LOCAL LEDGER</div>
        <h1 className="uxlab-chrome__title">Dash Ledger UI/UX variants</h1>
        <p className="uxlab-chrome__sub">
          These are not mock sandboxes. Current plus variants 1–4 all use the same IndexedDB database on this GitHub Pages origin. Add or edit data in one view, switch, and the other views read the same records.
        </p>
        <nav className="uxlab-chrome__nav" aria-label="UI/UX variants">
          <Link to="/?demo=1" className="uxlab-chip uxlab-chip--ghost">Current UI</Link>
        </nav>
      </div>

      <div className="uxlab-card">
        <div className="uxlab-label">Live ledger now</div>
        <div className="uxlab-weekline">
          <span className="uxlab-weekline__big uxlab-tabular">{snap.shifts.length}</span>
          <span className="uxlab-weekline__rest">dashes · {snap.expenses.length} expenses · {snap.receipts.length} receipts</span>
          <span className="uxlab-badge uxlab-badge--fact">Shared</span>
        </div>
      </div>

      <div className="uxlab-card">
        <div className="uxlab-label">Variants</div>
        {CONCEPTS.map((c) => (
          <Link key={c.n} to={c.to} className="uxlab-row">
            <span className="uxlab-emoji-free" aria-hidden>{c.n}</span>
            <span className="uxlab-row__main">
              <span className="uxlab-row__title">{c.name}</span>
              <span className="uxlab-row__sub">{c.tagline}</span>
            </span>
            <span className="uxlab-row__value-sub" aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

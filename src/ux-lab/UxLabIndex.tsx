/**
 * UX Lab index — hidden experimental route (#/ux-lab).
 *
 * Four interactive redesign concepts for the Dash Ledger UI/UX study. All
 * demos run on synthetic fixtures and local component state. The lab is not
 * linked from production navigation; the canonical app is untouched one level
 * above this file.
 */

import { Link } from '../app/router';
import './lab.css';

const CONCEPTS = [
  {
    n: 1,
    name: 'Reach Desk',
    tagline: 'Thumb-first primary surface with a persistent drive dock.',
    to: '/ux-lab/1',
  },
  {
    n: 2,
    name: 'Resolve',
    tagline: 'One queue of every unresolved record, decided in place.',
    to: '/ux-lab/2',
  },
  {
    n: 3,
    name: 'Week as a story',
    tagline: 'Day-strip scan, facts vs estimates, sticky weekly close.',
    to: '/ux-lab/3',
  },
  {
    n: 4,
    name: 'Year at a glance',
    tagline: 'Trend-first year with estimate-labeled deduction headline.',
    to: '/ux-lab/4',
  },
];

export function UxLabIndex() {
  return (
    <div className="uxlab stack">
      <div className="uxlab-chrome">
        <div className="uxlab-chrome__banner">UX Lab · redesign study · synthetic data</div>
        <h1 className="uxlab-chrome__title">Dash Ledger UX Lab</h1>
        <p className="uxlab-chrome__sub">
          Four interactive redesign concepts from the evidence-based UI/UX audit. Every demo runs on
          fabricated fixtures and local state — nothing here reads from or writes to your ledger,
          and the normal app is unchanged. See <span className="inline-code">UI_UX_REDESIGN_REPORT.md</span>{' '}
          on the <span className="inline-code">ui-ux-redesign-lab</span> branch.
        </p>
        <nav className="uxlab-chrome__nav" aria-label="UX lab concepts">
          <Link to="/" className="uxlab-chip uxlab-chip--ghost">
            ‹ Back to the real Desk
          </Link>
        </nav>
      </div>

      <div className="uxlab-card">
        <div className="uxlab-label">Concepts</div>
        {CONCEPTS.map((c) => (
          <Link key={c.n} to={c.to} className="uxlab-row">
            <span className="uxlab-emoji-free" aria-hidden>
              {c.n}
            </span>
            <span className="uxlab-row__main">
              <span className="uxlab-row__title">{c.name}</span>
              <span className="uxlab-row__sub">{c.tagline}</span>
            </span>
            <span className="uxlab-row__value-sub" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>

      <p className="small faint" style={{ margin: 0 }}>
        Evaluation viewport: 390 × 844 (iPhone 13/14). Also checked at 375 × 812 and 430 × 932 with
        no horizontal overflow. Screenshots live in{' '}
        <span className="inline-code">artifacts/ui-ux-redesign/</span>.
      </p>
    </div>
  );
}

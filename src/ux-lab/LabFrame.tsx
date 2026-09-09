/**
 * Lab chrome shared by every UX-lab demo.
 *
 * Makes the experimental surface unmistakable (banner, synthetic-data notice),
 * provides concept switching, and guarantees lab.css is loaded on every lab
 * route. Renders INSIDE the production shell; changes nothing outside itself.
 */

import type { ReactNode } from 'react';
import { Link } from '../app/router';
import './lab.css';

export function LabFrame({
  concept,
  title,
  sub,
  children,
}: {
  concept: number;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="uxlab stack">
      <div className="uxlab-chrome">
        <div className="uxlab-chrome__banner">UX Lab · Concept {concept} of 4 · synthetic data</div>
        <h1 className="uxlab-chrome__title">{title}</h1>
        <p className="uxlab-chrome__sub">
          {sub} Nothing on this screen reads from or writes to your ledger.
        </p>
        <nav className="uxlab-chrome__nav" aria-label="UX lab concepts">
          <Link to="/ux-lab" className="uxlab-chip uxlab-chip--ghost">
            ‹ Lab index
          </Link>
          {[1, 2, 3, 4].map((n) => (
            <Link
              key={n}
              to={`/ux-lab/${n}`}
              className="uxlab-chip"
              ariaCurrent={n === concept ? 'page' : undefined}
            >
              {n}
            </Link>
          ))}
          <Link to="/" className="uxlab-chip">
            Exit lab →
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}

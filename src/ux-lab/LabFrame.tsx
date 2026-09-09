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
        <div className="uxlab-chrome__banner">UI/UX variant {concept} of 4 · LIVE LEDGER</div>
        <h1 className="uxlab-chrome__title">{title}</h1>
        <p className="uxlab-chrome__sub">
          {sub} This is another presentation of the same local Dash Ledger data. Changes persist when you switch views.
        </p>
        <nav className="uxlab-chrome__nav" aria-label="UI/UX variants">
          <Link to="/?demo=1" className="uxlab-chip uxlab-chip--ghost">
            Current
          </Link>
          {[1, 2, 3, 4].map((n) => (
            <Link
              key={n}
              to={`/ux-lab/${n}?demo=1`}
              className="uxlab-chip"
              ariaCurrent={n === concept ? 'page' : undefined}
            >
              {n}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

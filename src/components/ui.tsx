import { useState, type ReactNode } from 'react';
import { Link } from '../app/router';
import { formatCents } from '../domain/money';
import type { CompletenessIssue } from '../domain/completeness';

export function Screen({
  title,
  subtitle,
  action,
  back,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: { to: string; label?: string };
  children: ReactNode;
}) {
  return (
    <div className="stack">
      {back && (
        <Link to={back.to} className="back-link">
          <span aria-hidden>‹</span> {back.label ?? 'Back'}
        </Link>
      )}
      <div className="screen-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Card({
  children,
  as: Tag = 'section',
  label,
}: {
  children: ReactNode;
  as?: 'section' | 'div';
  label?: string;
}) {
  return (
    <Tag className="card">
      {label && <div className="section-label">{label}</div>}
      {children}
    </Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export interface StatSpec {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'pos' | 'neg';
}

export function StatGrid({ stats }: { stats: StatSpec[] }) {
  return (
    <div className="stat-grid">
      {stats.map((s, i) => (
        <div className="stat" key={i}>
          <div className="stat__label">{s.label}</div>
          <div
            className={`stat__value ${s.tone === 'pos' ? 'money-pos' : s.tone === 'neg' ? 'money-neg' : ''}`}
          >
            {s.value}
          </div>
          {s.sub != null && <div className="stat__sub">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Money({ cents, sign = false }: { cents: number | null | undefined; sign?: boolean }) {
  const text = formatCents(cents ?? null, { sign });
  const cls = cents == null ? '' : cents > 0 ? '' : cents < 0 ? 'money-neg' : '';
  return <span className={`tabular ${cls}`}>{text}</span>;
}

export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: 'good' | 'warn' | 'danger' | 'info' | 'neutral';
  children: ReactNode;
}) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export function Notice({
  tone = 'info',
  children,
  title,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'good';
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <strong>{title}. </strong>}
      {children}
    </div>
  );
}

export function DisclaimerNote() {
  return (
    <p className="disclaimer-note">
      Dash Ledger organizes records and provides estimates. It is not tax advice and does not
      determine whether a particular expense is deductible.
    </p>
  );
}

export function EmptyState({
  icon = '□',
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function Button({
  to,
  onClick,
  children,
  variant = 'default',
  size,
  block,
  type = 'button',
  disabled,
  ariaLabel,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'xl';
  block?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const cls = [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size === 'xl' && 'btn--xl',
    block && 'btn--block',
  ]
    .filter(Boolean)
    .join(' ');
  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** Two-tap confirm to guard destructive actions. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Tap again to confirm',
  variant = 'danger',
  block,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  block?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${variant === 'danger' ? 'btn--danger' : ''} ${block ? 'btn--block' : ''}`}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 4000);
        }
      }}
      aria-live="polite"
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function IssueList({ issues }: { issues: CompletenessIssue[] }) {
  if (issues.length === 0) {
    return (
      <Notice tone="good" title="No completeness issues detected">
        Every record in this range has the data it needs. This is a record-completeness check, not a
        tax-compliance score.
      </Notice>
    );
  }
  return (
    <ul className="issue-list">
      {issues.map((iss, i) => (
        <li key={i} className={`issue ${iss.severity === 'warn' ? 'issue--warn' : ''}`}>
          <span className="issue__dot" aria-hidden />
          <span>
            {iss.href ? <Link to={iss.href}>{iss.message}</Link> : iss.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function KeyValue({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} className="kv__row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

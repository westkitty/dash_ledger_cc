import { useRouter, Link } from './router';
import { useLedgerContext } from '../state/store';

const ITEMS = [
  { to: '/', label: 'Dash', match: (p: string) => p === '/' || p === '/start' || p === '/end' || p === '/log' || p.startsWith('/dash/'), icon: DashIcon },
  { to: '/week', label: 'Week', match: (p: string) => p === '/week' || p.startsWith('/expense/'), icon: WeekIcon },
  { to: '/receipts', label: 'Receipts', match: (p: string) => p.startsWith('/receipts'), icon: ReceiptIcon },
  { to: '/vault', label: 'Tax · Vault', match: (p: string) => p === '/vault' || p === '/settings' || p === '/diagnostics', icon: VaultIcon },
];

export function BottomNav() {
  const { path } = useRouter();
  const { snapshot } = useLedgerContext();
  const onRoad = !!snapshot?.activeShift;
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {ITEMS.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          const showRoadMark = onRoad && item.to === '/';
          return (
            <Link
              key={item.to}
              to={item.to}
              className="bottom-nav__link"
              ariaCurrent={active ? 'page' : undefined}
            >
              <span className="bottom-nav__icon" aria-hidden>
                <Icon active={active} />
                {showRoadMark && <span className="bottom-nav__dot" />}
              </span>
              {item.label}
              {showRoadMark && <span className="sr-only"> — on the road</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DashIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M3 12l2-7h14l2 7M5 12h14v6H5z" strokeLinejoin="round" />
      <circle cx="8.5" cy="18.5" r="1.6" fill="currentColor" />
      <circle cx="15.5" cy="18.5" r="1.6" fill="currentColor" />
    </svg>
  );
}
function WeekIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function ReceiptIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}
function VaultIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 4v2M12 18v2" strokeLinecap="round" />
    </svg>
  );
}

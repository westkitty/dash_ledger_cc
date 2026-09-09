import { useLedger } from '../../state/store';
import { Link } from '../../app/router';
import { Card, EmptyState, Money } from '../../components/ui';
import { ReceiptThumb } from '../../components/ReceiptImage';
import { isoToLocalDate, yearOf } from '../../domain/dates';

export function ReceiptFolderScreen({ year, category }: { year: string; category: string }) {
  const { receipts } = useLedger();
  const y = Number(year);
  const cat = decodeURIComponent(category);

  const items = receipts.filter((r) => {
    const ry = r.date ? yearOf(r.date) : yearOf(isoToLocalDate(r.capturedAt));
    const rc = r.category || 'Unfiled';
    return ry === y && rc === cat;
  });

  const total = items.reduce((a, r) => a + (r.amountCents ?? 0), 0);

  return (
    <div className="stack">
      <Link to="/receipts" className="back-link">
        <span aria-hidden>‹</span> Receipts
      </Link>
      <div className="screen-head">
        <div>
          <h1>
            {y} / {cat}
          </h1>
          <p>
            {items.length} receipt{items.length === 1 ? '' : 's'} · <Money cents={total} /> total
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="□" title="Nothing in this folder" />
      ) : (
        <Card>
          <div className="receipt-grid">
            {items.map((r) => (
              <Link key={r.id} to={`/receipts/${r.id}`} className="receipt-card">
                <span className="receipt-card__img">
                  <ReceiptThumb receiptId={r.id} alt={r.merchant || r.originalFilename} />
                </span>
                <span className="receipt-card__body">
                  <strong>{r.merchant || 'Receipt'}</strong>
                  <div className="small">
                    {r.date ?? r.capturedAt.slice(0, 10)} · <Money cents={r.amountCents} />
                  </div>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

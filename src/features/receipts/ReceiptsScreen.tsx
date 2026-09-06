import { useMemo } from 'react';
import { useLedger } from '../../state/store';
import { Link } from '../../app/router';
import { Button, Card, EmptyState, Money, Pill } from '../../components/ui';
import { ReceiptThumb } from '../../components/ReceiptImage';
import { yearOf } from '../../domain/dates';

export function ReceiptsScreen() {
  const { receipts } = useLedger();

  const inbox = receipts.filter((r) => r.status === 'Inbox');
  const classified = receipts.filter((r) => r.status === 'Classified');

  const folders = useMemo(() => {
    const map = new Map<string, { year: number; category: string; count: number }>();
    for (const r of receipts) {
      const y = r.date ? yearOf(r.date) : yearOf(r.capturedAt.slice(0, 10));
      const cat = r.category || 'Unfiled';
      const key = `${y}/${cat}`;
      const prev = map.get(key) ?? { year: y, category: cat, count: 0 };
      prev.count += 1;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.year - a.year || a.category.localeCompare(b.category));
  }, [receipts]);

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Receipts</h1>
          <p>{receipts.length} stored on this device</p>
        </div>
      </div>

      <div className="btn-row">
        <Button to="/receipts/capture" variant="primary" size="xl" block>
          ＋ Capture receipt
        </Button>
      </div>

      <Card label={`Inbox (${inbox.length})`}>
        {inbox.length === 0 ? (
          <EmptyState icon="□" title="Inbox is empty">
            Photos you capture without classifying them land here until you add a merchant, amount and
            category.
          </EmptyState>
        ) : (
          <div className="rows">
            {inbox.map((r) => (
              <Link key={r.id} to={`/receipts/${r.id}`} className="row-link">
                <ReceiptThumb receiptId={r.id} alt={r.merchant || r.originalFilename} />
                <span className="row-link__main">
                  <span className="row-link__title">{r.merchant || r.originalFilename}</span>
                  <span className="row-link__sub">
                    {r.date ?? r.capturedAt.slice(0, 10)}
                    {r.imageProcessingError && ' · image optimisation failed (original kept)'}
                  </span>
                </span>
                <Pill tone="warn">Inbox</Pill>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card label={`Classified (${classified.length})`}>
        {classified.length === 0 ? (
          <p className="small muted">No classified receipts yet.</p>
        ) : (
          <div className="rows">
            {classified.slice(0, 20).map((r) => (
              <Link key={r.id} to={`/receipts/${r.id}`} className="row-link">
                <ReceiptThumb receiptId={r.id} alt={r.merchant || r.originalFilename} />
                <span className="row-link__main">
                  <span className="row-link__title">{r.merchant || 'Receipt'}</span>
                  <span className="row-link__sub">
                    {r.date ?? r.capturedAt.slice(0, 10)} · {r.category ?? 'Unfiled'}
                    {r.expenseId ? ' · linked' : ''}
                  </span>
                </span>
                <span className="row-link__value">
                  <Money cents={r.amountCents} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card label="Folders — Year / Category">
        {folders.length === 0 ? (
          <p className="small muted">Folders appear once receipts have a category.</p>
        ) : (
          <div className="rows">
            {folders.map((f) => (
              <Link
                key={`${f.year}/${f.category}`}
                to={`/receipts/folder/${f.year}/${encodeURIComponent(f.category)}`}
                className="row-link"
              >
                <span className="row-link__main">
                  <span className="row-link__title">
                    {f.year} / {f.category}
                  </span>
                </span>
                <span className="row-link__value">{f.count}</span>
              </Link>
            ))}
          </div>
        )}
        <p className="small faint" style={{ marginTop: 10 }}>
          These are views over your local data, not filesystem folders.
        </p>
      </Card>
    </div>
  );
}

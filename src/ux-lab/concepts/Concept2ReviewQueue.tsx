import { useMemo } from 'react';
import { useRouter } from '../../app/router';
import { useLedger, useLedgerContext } from '../../state/store';
import { updateExpense } from '../../db/repositories';
import { computeMileage } from '../../domain/mileage';
import { formatCents } from '../../domain/money';
import type { TaxClass } from '../../domain/types';
import { LabFrame } from '../LabFrame';

type QueueItem =
  | { id: string; kind: 'receipt'; title: string; why: string; target: string }
  | { id: string; kind: 'expense'; title: string; why: string; target: string; expenseId: string }
  | { id: string; kind: 'odometer' | 'time'; title: string; why: string; target: string };

export function Concept2ReviewQueue() {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    for (const r of snap.receipts) {
      if (r.status !== 'Inbox') continue;
      items.push({
        id: `receipt:${r.id}`,
        kind: 'receipt',
        title: r.merchant.trim() ? `Receipt · ${r.merchant}` : `Receipt · ${r.originalFilename || 'unclassified photo'}`,
        why: `${r.date ?? r.capturedAt.slice(0, 10)} · needs enough details to leave the Inbox.`,
        target: `/receipts/${r.id}?demo=1`,
      });
    }
    for (const e of snap.expenses) {
      if (e.taxClass !== 'REVIEW') continue;
      items.push({
        id: `expense:${e.id}`,
        kind: 'expense',
        title: `${e.merchant || e.category} · ${formatCents(e.amountCents)}`,
        why: `${e.date} · still classified Review / Unsure. Choose the treatment here or open the full editor.`,
        target: `/expense/${e.id}?demo=1`,
        expenseId: e.id,
      });
    }
    for (const s of snap.shifts.filter((x) => x.status === 'completed')) {
      const mileage = computeMileage(s.startOdometer, s.endOdometer, snap.settings.implausibleMiles);
      if (mileage.status === 'missing') {
        items.push({
          id: `odo:${s.id}`,
          kind: 'odometer',
          title: `${s.date} dash · mileage incomplete`,
          why: 'A starting or ending odometer reading is missing.',
          target: `/dash/${s.id}?demo=1`,
        });
      }
      if (!s.startTime || !s.endTime) {
        items.push({
          id: `time:${s.id}`,
          kind: 'time',
          title: `${s.date} dash · time incomplete`,
          why: 'Start or end time is missing, so time-based summaries stay incomplete.',
          target: `/dash/${s.id}?demo=1`,
        });
      }
    }
    return items.sort((a, b) => a.title.localeCompare(b.title));
  }, [snap.receipts, snap.expenses, snap.shifts, snap.settings.implausibleMiles]);

  async function classifyExpense(expenseId: string, taxClass: TaxClass) {
    await mutate(() => updateExpense(expenseId, { taxClass }), { success: 'Expense classification saved' });
  }

  return (
    <LabFrame
      concept={2}
      title="Resolve — one queue, decisions in place"
      sub="Unresolved receipts, Review-class expenses, and incomplete dash facts are gathered from the live ledger."
    >
      <section className="uxlab-card uxlab-queue-head">
        <div className="uxlab-label">Live review debt</div>
        <div className="uxlab-weekline">
          <span className="uxlab-weekline__big uxlab-tabular">{queue.length}</span>
          <span className="uxlab-weekline__rest">unresolved item{queue.length === 1 ? '' : 's'} across the shared ledger</span>
          <span className="uxlab-badge uxlab-badge--fact">Shared data</span>
        </div>
      </section>

      {queue.length === 0 ? (
        <section className="uxlab-card">
          <div className="uxlab-label">All clear</div>
          <p style={{ margin: 0 }}>Nothing currently needs a classification or missing-data repair.</p>
        </section>
      ) : queue.map((item) => (
        <section key={item.id} className="uxlab-queueitem">
          <div className="uxlab-queueitem__top">
            <span className="uxlab-emoji-free" aria-hidden>{item.kind === 'receipt' ? 'R' : item.kind === 'expense' ? '$' : item.kind === 'odometer' ? 'MI' : 'H'}</span>
            <span className="uxlab-badge uxlab-badge--warn">
              {item.kind === 'receipt' ? 'Receipt inbox' : item.kind === 'expense' ? 'Review class' : item.kind === 'odometer' ? 'Mileage' : 'Missing time'}
            </span>
          </div>
          <p className="uxlab-queueitem__what">{item.title}</p>
          <p className="uxlab-queueitem__why">{item.why}</p>
          {item.kind === 'expense' ? (
            <div className="uxlab-queueitem__actions">
              <button type="button" className="uxlab-seg__btn" onClick={() => void classifyExpense(item.expenseId, 'VEHICLE_ACTUAL')}>Vehicle actual</button>
              <button type="button" className="uxlab-seg__btn" onClick={() => void classifyExpense(item.expenseId, 'MILEAGE_ADDON')}>Mileage add-on</button>
              <button type="button" className="uxlab-seg__btn uxlab-seg__btn--primary" onClick={() => void classifyExpense(item.expenseId, 'NON_VEHICLE_BUSINESS')}>Other business</button>
              <button type="button" className="uxlab-btn uxlab-btn--ghost" onClick={() => navigate(item.target)}>Full editor →</button>
            </div>
          ) : (
            <div className="uxlab-queueitem__actions">
              <button type="button" className="uxlab-btn uxlab-btn--primary" onClick={() => navigate(item.target)}>
                {item.kind === 'receipt' ? 'Classify receipt' : 'Fix record'} →
              </button>
            </div>
          )}
        </section>
      ))}
    </LabFrame>
  );
}

/**
 * UX Lab · Concept 2 — "Resolve" review queue
 *
 * Redesign hypothesis: unresolved work is scattered (Desk list capped at 5,
 * per-week lists, the receipt Inbox) and every item currently requires opening
 * a full editor on a different screen. This demo aggregates ALL unresolved
 * items into one queue with inline, one-tap resolutions in place — the
 * "one-swipe classification" mechanic proven by Everlance / MileIQ, adapted to
 * Dash Ledger's existing typed issues (no new record states, resolution simply
 * performs the same edit the full editor would).
 *
 * Local mock state only — no store, no db.
 */

import { useState } from 'react';
import { LabFrame } from '../LabFrame';

type ItemKind = 'receipt' | 'expense-class' | 'odometer' | 'unpriced' | 'missing-time';

interface QueueItem {
  id: string;
  kind: ItemKind;
  title: string;
  why: string;
  ageLabel: string;
  warn: boolean;
}

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: 'q1',
    kind: 'receipt',
    title: 'Receipt photo — no merchant yet',
    why: 'Captured Wed Sep 9 · photo saved · needs merchant, amount, category to leave the Inbox.',
    ageLabel: 'Today',
    warn: true,
  },
  {
    id: 'q2',
    kind: 'expense-class',
    title: 'Expense "Hardware store — misc" · $23.40',
    why: 'Still classified Review / Unsure — its tax treatment was never decided.',
    ageLabel: 'Aug 28',
    warn: true,
  },
  {
    id: 'q3',
    kind: 'odometer',
    title: 'Sat Aug 29 dash · 48 mi recorded',
    why: 'Miles are 2.3× your recent dashes. Kept exactly as entered — confirm or correct it.',
    ageLabel: 'Aug 29',
    warn: true,
  },
  {
    id: 'q4',
    kind: 'unpriced',
    title: '12 business miles have no mileage rate',
    why: 'A 2026 rate exists (Jul–Dec: $0.760/mi). Applying it prices those miles for planning.',
    ageLabel: 'This week',
    warn: false,
  },
  {
    id: 'q5',
    kind: 'missing-time',
    title: 'Sep 2 dash has no start / end time',
    why: 'Hours and $/hour stay blank until a time exists. Amounts are unaffected.',
    ageLabel: 'Last week',
    warn: false,
  },
];

export function Concept2ReviewQueue() {
  const [queue] = useState(INITIAL_QUEUE);
  const [resolved, setResolved] = useState<string[]>([]);
  const [editingOdo, setEditingOdo] = useState(false);
  const [toastNote, setToastNote] = useState<string | null>(null);

  const remaining = queue.filter((q) => !resolved.includes(q.id));
  const doneCount = resolved.length;
  const pct = Math.round((doneCount / queue.length) * 100);

  function resolve(id: string, note: string) {
    setResolved((r) => [...r, id]);
    setToastNote(note);
    window.setTimeout(() => setToastNote(null), 3000);
  }

  const current = remaining[0];

  return (
    <LabFrame
      concept={2}
      title="Resolve — one queue, decisions in place"
      sub="Every unresolved record across all weeks, oldest debt first. Each card resolves inline; the full editor stays one tap away."
    >
      <section className="uxlab-card uxlab-queue-head">
        <div className="uxlab-label">Review debt</div>
        <div
          className="uxlab-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={queue.length}
          aria-valuenow={doneCount}
          aria-label="Resolved items"
        >
          <div className="uxlab-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="uxlab-progress__progress uxlab-progress__text uxlab-tabular">
          {doneCount} of {queue.length} resolved · {remaining.length} to go
        </span>
      </section>

      {remaining.length === 0 ? (
        <section className="uxlab-card">
          <div className="uxlab-label">All clear</div>
          <p style={{ margin: '4px 0 8px', fontWeight: 650 }}>
            Everything is resolved — ledger is fully decided as of right now.
          </p>
          <p className="small faint" style={{ margin: 0 }}>
            Nothing was guessed: each resolution performed the exact edit the full editor performs.
            Next honest step: mark the week reviewed in Week.
          </p>
        </section>
      ) : (
        <p className="small faint" style={{ margin: 0 }}>
          First unresolved item is pinned at top — work top to bottom, or jump via the index below.
        </p>
      )}

      {queue.map((item) => {
        const isDone = resolved.includes(item.id);
        const isCurrent = current?.id === item.id;
        return (
          <section
            key={item.id}
            className={`uxlab-queueitem ${isDone ? 'uxlab-queueitem--done' : ''}`}
            aria-current={isCurrent ? 'true' : undefined}
          >
            <div className="uxlab-queueitem__top">
              <span className="uxlab-emoji-free" aria-hidden>
                {kindGlyph(item.kind)}
              </span>
              <span className={`uxlab-badge ${item.warn ? 'uxlab-badge--warn' : 'uxlab-badge--review'}`}>
                {kindLabel(item.kind)}
              </span>
              <span className="uxlab-row__value-sub">{item.ageLabel}</span>
              {isDone && <span className="uxlab-badge uxlab-badge--fact">Resolved</span>}
            </div>
            {!isDone && (
              <>
                <p className="uxlab-queueitem__what">{item.title}</p>
                <p className="uxlab-queueitem__why">{item.why}</p>
                <ItemActions
                  item={item}
                  editingOdo={editingOdo}
                  setEditingOdo={setEditingOdo}
                  onResolve={resolve}
                />
              </>
            )}
            {isDone && <p className="uxlab-queueitem__why" style={{ marginBottom: 0 }}>{item.title}</p>}
          </section>
        );
      })}

      {doneCount > 0 && (
        <section className="uxlab-card">
          <div className="uxlab-label">Resolved this session ({doneCount})</div>
          {queue
            .filter((q) => resolved.includes(q.id))
            .map((q) => (
              <div key={q.id} className="uxlab-done-row">
                <span aria-hidden>✓</span>
                <span>{q.title}</span>
              </div>
            ))}
        </section>
      )}

      {toastNote && (
        <div className="uxlab-toast" role="status">
          {toastNote}
        </div>
      )}
    </LabFrame>
  );
}

function kindGlyph(kind: ItemKind): string {
  switch (kind) {
    case 'receipt':
      return 'R';
    case 'expense-class':
      return '$';
    case 'odometer':
      return 'MI';
    case 'unpriced':
      return '¢';
    case 'missing-time':
      return 'H';
  }
}

function kindLabel(kind: ItemKind): string {
  switch (kind) {
    case 'receipt':
      return 'Receipt inbox';
    case 'expense-class':
      return 'Review class';
    case 'odometer':
      return 'Mileage flag';
    case 'unpriced':
      return 'Unpriced miles';
    case 'missing-time':
      return 'Missing time';
  }
}

function ItemActions({
  item,
  editingOdo,
  setEditingOdo,
  onResolve,
}: {
  item: QueueItem;
  editingOdo: boolean;
  setEditingOdo: (v: boolean) => void;
  onResolve: (id: string, note: string) => void;
}) {
  switch (item.kind) {
    case 'receipt':
      return (
        <div className="uxlab-queueitem__actions">
          <span className="uxlab-queueitem__defer">Classify from the photo:</span>
          {['Fuel', 'Parking', 'Phone / Data', 'Supplies'].map((c) => (
            <button
              key={c}
              type="button"
              className={`uxlab-seg__btn ${c === 'Fuel' ? 'uxlab-seg__btn--primary' : ''}`}
              onClick={() => onResolve(item.id, `Receipt classified as ${c} · $38.25 — demo only`)}
            >
              {c}
            </button>
          ))}
          <button type="button" className="uxlab-btn uxlab-btn--ghost">Open full editor →</button>
        </div>
      );
    case 'expense-class':
      return (
        <div className="uxlab-queueitem__actions">
          <span className="uxlab-queueitem__defer">Tax treatment:</span>
          <button
            type="button"
            className="uxlab-seg__btn uxlab-seg__btn--primary"
            onClick={() => onResolve(item.id, 'Set to Vehicle actual-expense — demo only')}
          >
            Vehicle
          </button>
          <button
            type="button"
            className="uxlab-seg__btn"
            onClick={() => onResolve(item.id, 'Set to Mileage add-on — demo only')}
          >
            Mileage add-on
          </button>
          <button
            type="button"
            className="uxlab-seg__btn"
            onClick={() => onResolve(item.id, 'Set to Other business — demo only')}
          >
            Business
          </button>
          <button
            type="button"
            className="uxlab-seg__btn"
            onClick={() => onResolve(item.id, 'Marked not business — demo only')}
          >
            Not business
          </button>
        </div>
      );
    case 'odometer':
      return (
        <div className="uxlab-queueitem__actions">
          {!editingOdo ? (
            <>
              <button
                type="button"
                className="uxlab-seg__btn uxlab-seg__btn--primary"
                onClick={() => onResolve(item.id, '48 mi confirmed as driven — flag cleared, value unchanged — demo only')}
              >
                Keep 48 mi — it's right
              </button>
              <button type="button" className="uxlab-seg__btn" onClick={() => setEditingOdo(true)}>
                Fix the reading
              </button>
            </>
          ) : (
            <>
              <input
                className="uxlab-input"
                style={{ maxWidth: 160 }}
                type="text"
                inputMode="decimal"
                defaultValue="62212"
                aria-label="Corrected ending odometer"
              />
              <button
                type="button"
                className="uxlab-seg__btn uxlab-seg__btn--primary"
                onClick={() => {
                  setEditingOdo(false);
                  onResolve(item.id, 'Ending odometer corrected — miles recomputed, original preserved in edit history — demo only');
                }}
              >
                Save correction
              </button>
            </>
          )}
          <span className="uxlab-queueitem__defer">Never auto-changed. Confirm or correct — your call.</span>
        </div>
      );
    case 'unpriced':
      return (
        <div className="uxlab-queueitem__actions">
          <button
            type="button"
            className="uxlab-seg__btn uxlab-seg__btn--primary"
            onClick={() => onResolve(item.id, '12 mi priced at the 2026 H2 rate ($0.760) — estimate only — demo only')}
          >
            Apply 2026 rate · $0.760/mi
          </button>
          <button
            type="button"
            className="uxlab-seg__btn"
            onClick={() => onResolve(item.id, 'Left deliberately unpriced — stays reported as unpriced miles — demo only')}
          >
            Leave unpriced
          </button>
        </div>
      );
    case 'missing-time':
      return (
        <div className="uxlab-queueitem__actions">
          <button
            type="button"
            className="uxlab-seg__btn uxlab-seg__btn--primary"
            onClick={() => onResolve(item.id, 'Times set 11:15–14:35 — demo only')}
          >
            Use 11:15 – 14:35
          </button>
          <button type="button" className="uxlab-seg__btn" onClick={() => onResolve(item.id, 'Left without time — $/hour stays honestly blank — demo only')}>
            Leave blank
          </button>
        </div>
      );
  }
}

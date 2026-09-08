import { useMemo, useState } from 'react';
import { useLedger, useLedgerContext, useUndoableDelete } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import { Button, Card, ConfirmButton, EmptyState, Notice, Pill } from '../../components/ui';
import { ReceiptFullImage } from '../../components/ReceiptImage';
import { ChipGroup, DateInput, MoneyInput, SelectInput, TextArea, TextInput } from '../../components/forms';
import {
  createExpense,
  deleteReceipt,
  restoreDeletedReceipt,
  updateReceipt,
} from '../../db/repositories';
import { ALL_CATEGORIES, QUICK_CATEGORIES, taxClassForCategory } from '../../domain/expenses';
import { TAX_CLASS_LABELS } from '../../domain/types';
import { parseMoneyToCents, formatCents } from '../../domain/money';
import { normaliseMerchant, suggestionFor } from '../../domain/merchantMemory';
import { formatBytes } from '../../services/storageHealth';

export function ReceiptDetailScreen({ id }: { id: string }) {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const undoableDelete = useUndoableDelete();
  const { navigate } = useRouter();
  const { receipts, expenses, merchantMemory } = snap;

  const receipt = receipts.find((r) => r.id === id);

  const [date, setDate] = useState(receipt?.date ?? '');
  const [merchant, setMerchant] = useState(receipt?.merchant ?? '');
  const [amount, setAmount] = useState(
    receipt?.amountCents != null ? formatCents(receipt.amountCents).replace('$', '') : '',
  );
  const [category, setCategory] = useState(receipt?.category ?? '');
  const [notes, setNotes] = useState(receipt?.notes ?? '');
  const [linkedExpense, setLinkedExpense] = useState(receipt?.expenseId ?? '');
  const [busy, setBusy] = useState(false);

  const suggestion = useMemo(() => {
    const key = normaliseMerchant(merchant);
    if (!key) return null;
    return suggestionFor(merchantMemory.find((m) => m.merchantKey === key));
  }, [merchant, merchantMemory]);

  if (!receipt) {
    return (
      <EmptyState icon="✕" title="Receipt not found" action={<Button to="/receipts" variant="primary">Back</Button>} />
    );
  }

  const cents = parseMoneyToCents(amount);
  const canClassify = merchant.trim() !== '' && cents !== null && category !== '' && date !== '';

  async function persist(markClassified: boolean) {
    setBusy(true);
    try {
      await mutate(
        () =>
          updateReceipt(receipt!.id, {
            date: date || null,
            merchant: merchant.trim(),
            amountCents: cents,
            category: category || null,
            taxClass: category ? taxClassForCategory(category) : null,
            notes: notes.trim(),
            status: markClassified ? 'Classified' : receipt!.status,
            expenseId: linkedExpense || null,
          }),
        { success: markClassified ? 'Receipt classified' : 'Receipt saved' },
      );
    } finally {
      setBusy(false);
    }
  }

  async function makeExpense() {
    if (cents === null) return;
    setBusy(true);
    try {
      const exp = await mutate(
        () =>
          createExpense({
            date: date || receipt!.capturedAt.slice(0, 10),
            amountCents: cents,
            merchant: merchant.trim(),
            category: category || 'Review / Unsure',
            taxClass: taxClassForCategory(category || 'Review / Unsure'),
            notes: notes.trim(),
            shiftId: null,
            receiptId: receipt!.id,
          }),
        { success: 'Expense created from receipt' },
      );
      setLinkedExpense(exp.id);
      await updateReceipt(receipt!.id, { status: 'Classified' });
      await snap.reload();
    } finally {
      setBusy(false);
    }
  }

  const unlinkedExpenses = expenses.filter((e) => !e.receiptId || e.id === receipt.expenseId);

  return (
    <div className="stack">
      <Link to="/receipts" className="back-link">
        <span aria-hidden>‹</span> Receipts
      </Link>
      <div className="screen-head">
        <div>
          <h1>Receipt</h1>
          <p>
            {receipt.status === 'Inbox' ? <Pill tone="warn">Inbox</Pill> : <Pill tone="good">Classified</Pill>}{' '}
            captured {receipt.capturedAt.slice(0, 16).replace('T', ' ')}
          </p>
        </div>
      </div>

      {receipt.imageProcessingError && (
        <Notice tone="warn" title="Image optimisation failed">
          {receipt.imageProcessingError} The original image was preserved.
        </Notice>
      )}

      <Card>
        <ReceiptFullImage receiptId={receipt.id} alt={merchant || receipt.originalFilename} />
        <p className="small faint" style={{ marginTop: 8 }}>
          {receipt.originalFilename} · {receipt.mimeType || 'unknown type'} · {formatBytes(receipt.byteCount)}
        </p>
      </Card>

      <Card label="Details">
        <DateInput label="Date" value={date} onChange={setDate} />
        <TextInput label="Merchant" value={merchant} onChange={setMerchant} />
        {suggestion && suggestion.category !== category && (
          <Notice tone="info">
            {suggestion.reason} ({suggestion.observations}×).{' '}
            <button type="button" className="link-btn" onClick={() => setCategory(suggestion.category)}>
              Use {suggestion.category}
            </button>
          </Notice>
        )}
        <MoneyInput label="Amount" value={amount} onChange={setAmount} />
        <ChipGroup
          label="Quick categories"
          options={QUICK_CATEGORIES}
          value={category}
          onChange={setCategory}
        />
        <SelectInput
          label="Category"
          value={category}
          onChange={setCategory}
          options={[{ value: '', label: '— choose —' }, ...ALL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        {category && (
          <p className="small faint">
            {category} → {taxClassForCategory(category)} · {TAX_CLASS_LABELS[taxClassForCategory(category)]}
          </p>
        )}
        <TextArea label="Notes" hint="Optional" value={notes} onChange={setNotes} />

        <div className="btn-row">
          <Button onClick={() => void persist(false)} disabled={busy}>
            Save
          </Button>
          <Button variant="primary" onClick={() => void persist(true)} disabled={busy || !canClassify}>
            {canClassify ? 'Save & mark Classified' : 'Add details to classify'}
          </Button>
        </div>
      </Card>

      <Card label="Expense link">
        {receipt.expenseId ? (
          <p className="small">
            Linked to{' '}
            <Link to={`/expense/${receipt.expenseId}`}>
              an expense ({formatCents(expenses.find((e) => e.id === receipt.expenseId)?.amountCents ?? null)})
            </Link>
            .
          </p>
        ) : (
          <p className="small muted">Not linked to an expense yet.</p>
        )}
        <SelectInput
          label="Link to existing expense"
          value={linkedExpense}
          onChange={(v) => {
            setLinkedExpense(v);
          }}
          options={[
            { value: '', label: '— none —' },
            ...unlinkedExpenses
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => ({ value: e.id, label: `${e.date} · ${e.merchant || e.category} · ${formatCents(e.amountCents)}` })),
          ]}
        />
        <div className="btn-row">
          <Button onClick={() => void persist(false)} disabled={busy}>
            Apply link
          </Button>
          <Button variant="primary" onClick={makeExpense} disabled={busy || cents === null}>
            Create new expense from this receipt
          </Button>
        </div>
        {cents === null && <p className="small faint">Enter an amount to create an expense.</p>}
      </Card>

      <Card label="Danger zone">
        <p className="small muted">
          Deleting removes this receipt and its image. Any linked expense stays — its receipt link is
          cleared.
        </p>
        <ConfirmButton
          block
          onConfirm={() => {
            void undoableDelete(
              () => deleteReceipt(receipt.id),
              (d) => restoreDeletedReceipt(d),
              { deleted: 'Receipt deleted', restored: 'Receipt restored' },
            );
            navigate('/receipts', { replace: true });
          }}
        >
          Delete receipt
        </ConfirmButton>
      </Card>
    </div>
  );
}

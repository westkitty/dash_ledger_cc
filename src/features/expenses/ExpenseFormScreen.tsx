import { useMemo, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import {
  ChipGroup,
  DateInput,
  MoneyInput,
  SelectInput,
  TextArea,
  TextInput,
} from '../../components/forms';
import { Button, Card, ConfirmButton, EmptyState, Money, Notice } from '../../components/ui';
import { createExpense, updateExpense, deleteExpense } from '../../db/repositories';
import { ALL_CATEGORIES, QUICK_CATEGORIES, taxClassForCategory } from '../../domain/expenses';
import { TAX_CLASS_HINTS, TAX_CLASS_LABELS, type TaxClass } from '../../domain/types';
import { parseMoneyToCents, formatCents } from '../../domain/money';
import { todayLocalDate, formatLocalDate } from '../../domain/dates';
import { normaliseMerchant, suggestionFor } from '../../domain/merchantMemory';

const TAX_CLASS_OPTIONS: TaxClass[] = ['VEHICLE_ACTUAL', 'MILEAGE_ADDON', 'NON_VEHICLE_BUSINESS', 'REVIEW'];

export function ExpenseFormScreen({
  id,
  shiftId,
  receiptId,
}: {
  id?: string;
  shiftId?: string | null;
  receiptId?: string | null;
}) {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();
  const { expenses, shifts, receipts, merchantMemory } = snap;

  const existing = id ? expenses.find((e) => e.id === id) : undefined;
  const editing = !!id;

  const [date, setDate] = useState(existing?.date ?? todayLocalDate());
  const [amount, setAmount] = useState(
    existing ? formatCents(existing.amountCents).replace('$', '') : '',
  );
  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'Fuel');
  const [taxClass, setTaxClass] = useState<TaxClass>(existing?.taxClass ?? taxClassForCategory(existing?.category ?? 'Fuel'));
  const [taxClassTouched, setTaxClassTouched] = useState(false);
  const [linkedShift, setLinkedShift] = useState(existing?.shiftId ?? shiftId ?? '');
  const [linkedReceipt, setLinkedReceipt] = useState(existing?.receiptId ?? receiptId ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [amountErr, setAmountErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveTaxClass = taxClassTouched ? taxClass : taxClassForCategory(category);

  const suggestion = useMemo(() => {
    const key = normaliseMerchant(merchant);
    if (!key) return null;
    return suggestionFor(merchantMemory.find((m) => m.merchantKey === key));
  }, [merchant, merchantMemory]);

  function pickCategory(c: string) {
    setCategory(c);
    if (!taxClassTouched) setTaxClass(taxClassForCategory(c));
  }

  if (editing && !existing) {
    return (
      <EmptyState icon="✕" title="Expense not found" action={<Button to="/week" variant="primary">Back</Button>} />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAmountErr(null);
    const cents = parseMoneyToCents(amount);
    if (cents === null) {
      setAmountErr('Enter an amount, e.g. 42.75');
      return;
    }
    setBusy(true);
    const payload = {
      date,
      amountCents: cents,
      merchant: merchant.trim(),
      category,
      taxClass: effectiveTaxClass,
      notes: notes.trim(),
      shiftId: linkedShift || null,
      receiptId: linkedReceipt || null,
    };
    try {
      if (editing && existing) {
        await mutate(() => updateExpense(existing.id, payload), { success: 'Expense updated' });
      } else {
        await mutate(() => createExpense(payload), { success: 'Expense added' });
      }
      navigate(linkedShift ? `/dash/${linkedShift}` : '/week', { replace: true });
    } catch {
      setBusy(false);
    }
  }

  const availableReceipts = receipts.filter(
    (r) => !r.expenseId || r.expenseId === existing?.id || r.id === linkedReceipt,
  );

  return (
    <div className="stack">
      <Link to="/week" className="back-link">
        <span aria-hidden>‹</span> Back
      </Link>
      <div className="screen-head">
        <div>
          <h1>{editing ? 'Edit expense' : 'Add expense'}</h1>
          <p>Tracked for tax review — Dash Ledger does not decide deductibility.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={submit}>
          <DateInput label="Date" value={date} onChange={setDate} />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} error={amountErr} />
          <TextInput
            label="Merchant"
            hint="e.g. Shell, Costco Tire, City Parking"
            value={merchant}
            onChange={setMerchant}
          />
          {suggestion && suggestion.category !== category && (
            <Notice tone="info">
              {suggestion.reason} ({suggestion.observations}×).{' '}
              <button type="button" className="link-btn" onClick={() => pickCategory(suggestion.category)}>
                Use {suggestion.category}
              </button>
            </Notice>
          )}

          <ChipGroup label="Quick categories" options={QUICK_CATEGORIES} value={category} onChange={pickCategory} />
          <SelectInput
            label="Category"
            value={category}
            onChange={pickCategory}
            options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />

          <SelectInput
            label="Tax treatment class"
            hint={TAX_CLASS_HINTS[effectiveTaxClass]}
            value={effectiveTaxClass}
            onChange={(v) => {
              setTaxClassTouched(true);
              setTaxClass(v as TaxClass);
            }}
            options={TAX_CLASS_OPTIONS.map((c) => ({ value: c, label: `${c} — ${TAX_CLASS_LABELS[c]}` }))}
          />
          {taxClassTouched && effectiveTaxClass !== taxClassForCategory(category) && (
            <p className="small faint">
              Overriding the default class for “{category}” ({taxClassForCategory(category)}).{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setTaxClassTouched(false);
                  setTaxClass(taxClassForCategory(category));
                }}
              >
                Reset
              </button>
            </p>
          )}

          <SelectInput
            label="Linked dash"
            hint="Optional"
            value={linkedShift}
            onChange={setLinkedShift}
            options={[
              { value: '', label: '— none —' },
              ...[...shifts]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 40)
                .map((s) => ({ value: s.id, label: `${s.date} · ${s.vehicleLabel}` })),
            ]}
          />
          <SelectInput
            label="Linked receipt"
            hint="Optional"
            value={linkedReceipt}
            onChange={setLinkedReceipt}
            options={[
              { value: '', label: '— none —' },
              ...availableReceipts.map((r) => ({
                value: r.id,
                label: `${r.date ?? r.capturedAt.slice(0, 10)} · ${r.merchant || r.originalFilename}`,
              })),
            ]}
          />

          <TextArea label="Notes" hint="Optional" value={notes} onChange={setNotes} />

          <Button type="submit" variant="primary" size="xl" block disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
          </Button>
        </form>
      </Card>

      {editing && existing && (
        <Card label="Danger zone">
          <p className="small muted">
            Deleting keeps any linked receipt — only the receipt's link back to this expense is
            cleared.
          </p>
          <ConfirmButton
            block
            onConfirm={() =>
              void mutate(() => deleteExpense(existing.id), { success: 'Expense deleted' }).then(() =>
                navigate('/week', { replace: true }),
              )
            }
          >
            Delete expense
          </ConfirmButton>
        </Card>
      )}

      {existing?.shiftId && (
        <p className="small faint" style={{ textAlign: 'center' }}>
          Linked to dash on {formatLocalDate(shifts.find((s) => s.id === existing.shiftId)?.date ?? existing.date)} ·{' '}
          <Money cents={existing.amountCents} />
        </p>
      )}
    </div>
  );
}

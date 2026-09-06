import { useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Button, Card, ConfirmButton, Notice, Pill } from '../../components/ui';
import { DateInput, NumberInput, TextInput } from '../../components/forms';
import { addMileageRate, deleteMileageRate, resetSeededMileageRates } from '../../db/repositories';
import { validateRatePeriod } from '../../domain/mileageRates';

export function RatesPanel() {
  const { mileageRates } = useLedger();
  const { mutate } = useLedgerContext();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rate, setRate] = useState('');
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  async function add() {
    const parsed = {
      startDate,
      endDate: endDate.trim() === '' ? null : endDate,
      ratePerMile: Number(rate),
    };
    const errs = validateRatePeriod(parsed);
    setErrors(errs);
    if (errs.length) return;
    await mutate(
      () =>
        addMileageRate({
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          ratePerMile: parsed.ratePerMile,
          label: label.trim() || `Custom rate ${parsed.startDate}`,
          source: 'User added',
        }),
      { success: 'Rate period added' },
    );
    setStartDate('');
    setEndDate('');
    setRate('');
    setLabel('');
  }

  return (
    <div className="stack">
      <Card label="Effective-dated mileage rates">
        <p className="small muted">
          Each shift is priced by the rate effective on its own date. These are reference / estimate
          figures (dollars per mile), not a statement that you can claim them. Dash Ledger never
          fetches rates online — add future periods here.
        </p>
        <div className="rows">
          {mileageRates.map((r) => (
            <div key={r.id} className="row-link" style={{ cursor: 'default' }}>
              <span className="row-link__main">
                <span className="row-link__title">
                  {r.label} {r.seeded ? <Pill tone="neutral">seed</Pill> : <Pill tone="info">custom</Pill>}
                </span>
                <span className="row-link__sub">
                  {r.startDate} → {r.endDate ?? 'open'} · {r.source}
                </span>
              </span>
              <span className="row-link__value">
                ${r.ratePerMile.toFixed(3)}/mi
                {!r.seeded && (
                  <button
                    className="link-btn"
                    style={{ display: 'block' }}
                    onClick={() => void mutate(() => deleteMileageRate(r.id), { success: 'Rate removed' })}
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card label="Add a rate period">
        <DateInput label="Start date" value={startDate} onChange={setStartDate} />
        <DateInput label="End date" hint="Leave blank for open-ended" value={endDate} onChange={setEndDate} />
        <NumberInput label="Rate per mile ($)" hint="e.g. 0.760" step="0.001" value={rate} onChange={setRate} />
        <TextInput label="Label / source note" value={label} onChange={setLabel} />
        {errors.length > 0 && (
          <Notice tone="danger">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e, i) => (
                <li key={i} className="small">
                  {e}
                </li>
              ))}
            </ul>
          </Notice>
        )}
        <Button variant="primary" onClick={add}>
          Add rate period
        </Button>
        <p className="small faint" style={{ marginTop: 8 }}>
          A user-added period with the same start date as a seeded one takes precedence.
        </p>
      </Card>

      <Card label="Reset seed data">
        <p className="small muted">
          Restores the shipped seeded rate periods (2011–2026). Your custom periods are kept.
        </p>
        <ConfirmButton
          variant="default"
          confirmLabel="Tap again to restore seeded rates"
          onConfirm={() => void mutate(() => resetSeededMileageRates(), { success: 'Seeded rates restored' })}
        >
          Restore seeded rates
        </ConfirmButton>
      </Card>
    </div>
  );
}

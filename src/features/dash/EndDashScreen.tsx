import { useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { useRouter } from '../../app/router';
import { endShift } from '../../db/repositories';
import { MoneyInput, NumberInput, TextArea, TimeInput } from '../../components/forms';
import { Button, Card, EmptyState, Money, Notice } from '../../components/ui';
import { nowLocalTime, formatLocalDate } from '../../domain/dates';
import { parseMoneyToCents, grossIncomeCents } from '../../domain/money';
import { computeMileage } from '../../domain/mileage';
import { shiftDuration, formatHours } from '../../domain/duration';

export function EndDashScreen() {
  const { activeShift, settings } = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();

  const [endTime, setEndTime] = useState(nowLocalTime());
  const [endOdo, setEndOdo] = useState('');
  const [appEarnings, setAppEarnings] = useState('');
  const [cashTips, setCashTips] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!activeShift) {
    return (
      <EmptyState icon="—" title="No active dash" action={<Button to="/start" variant="primary">Start a dash</Button>}>
        There's nothing to end right now.
      </EmptyState>
    );
  }

  const endOdoNum = endOdo.trim() === '' ? null : Number(endOdo);
  const mileage = computeMileage(
    activeShift.startOdometer,
    endOdoNum != null && Number.isFinite(endOdoNum) ? endOdoNum : null,
    settings.implausibleMiles,
  );
  const appCents = parseMoneyToCents(appEarnings);
  const tipCents = parseMoneyToCents(cashTips);
  const gross = grossIncomeCents(appCents, tipCents);
  const dur = shiftDuration(activeShift.startTime, endTime || null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (mileage.status === 'reversed') {
      setFormError(mileage.message);
      return;
    }
    setBusy(true);
    try {
      await mutate(
        () =>
          endShift(activeShift!.id, {
            endTime: endTime || null,
            endOdometer: endOdoNum != null && Number.isFinite(endOdoNum) ? endOdoNum : null,
            appEarningsCents: appCents,
            cashTipsCents: tipCents,
            notes: notes.trim(),
          }),
        { success: 'Dash saved' },
      );
      navigate('/', { replace: true });
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>End Dash</h1>
          <p>
            {formatLocalDate(activeShift.date)} · {activeShift.vehicleLabel} · started{' '}
            {activeShift.startTime ?? '—'}
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={submit}>
          <TimeInput label="End time" hint="Optional — defaults to now. Past midnight is handled automatically." value={endTime} onChange={setEndTime} />
          <NumberInput
            label="Ending odometer"
            hint={
              activeShift.startOdometer != null
                ? `Start reading was ${activeShift.startOdometer.toLocaleString('en-US')}`
                : 'No starting reading was recorded — mileage will be missing.'
            }
            value={endOdo}
            onChange={setEndOdo}
          />
          <MoneyInput
            label="DoorDash / app earnings"
            hint="Total shown in the DoorDash app for this dash."
            value={appEarnings}
            onChange={setAppEarnings}
          />
          <MoneyInput
            label="Additional cash tips"
            hint="Cash tips NOT already included in the DoorDash total."
            value={cashTips}
            onChange={setCashTips}
          />
          <TextArea label="Notes" hint="Optional" value={notes} onChange={setNotes} />

          <div className="notice" style={{ marginBottom: 16 }}>
            <div className="section-label">Preview</div>
            <div className="kv">
              <div className="kv__row">
                <dt>Business miles</dt>
                <dd>
                  {mileage.miles === null ? '—' : mileage.miles.toLocaleString('en-US')}
                  {mileage.status === 'suspicious' && ' ⚠'}
                </dd>
              </div>
              <div className="kv__row">
                <dt>Duration</dt>
                <dd>{dur.known ? formatHours(dur.hours) + (dur.crossedMidnight ? ' (overnight)' : '') : 'unknown'}</dd>
              </div>
              <div className="kv__row">
                <dt>Gross income</dt>
                <dd>
                  <Money cents={gross} />
                </dd>
              </div>
            </div>
          </div>

          {mileage.status === 'suspicious' && (
            <Notice tone="warn" title="Mileage looks high">
              {mileage.message} It will be saved exactly as entered and flagged for review.
            </Notice>
          )}
          {mileage.status === 'reversed' && (
            <Notice tone="danger" title="Odometer readings are reversed">
              {mileage.message}
            </Notice>
          )}
          {formError && <Notice tone="danger">{formError}</Notice>}

          <Button type="submit" variant="primary" size="xl" block disabled={busy || mileage.status === 'reversed'}>
            {busy ? 'Saving…' : 'Save Dash'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

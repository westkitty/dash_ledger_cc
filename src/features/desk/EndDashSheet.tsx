/**
 * End Dash — as a sheet over the Desk.
 *
 * Minimum required factual input: the ending odometer. Everything else defaults
 * or is optional. A live preview (miles / duration / gross) is computed by the
 * exact functions that persist, so what you see is what is saved.
 *
 * Integrity rules are unchanged and enforced below AND in the repository:
 *  - reversed odometer  -> Save disabled, plain reason, value shown not hidden
 *  - suspicious mileage -> value kept exactly, flagged, Save stays enabled
 *  - missing odometer   -> Save disabled
 */

import { useEffect, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { endShift } from '../../db/repositories';
import { Sheet } from '../../components/Sheet';
import { Button, Money, Notice } from '../../components/ui';
import { MoneyInput, NumberInput, TextArea, TimeInput } from '../../components/forms';
import { nowLocalTime } from '../../domain/dates';
import { formatCents, grossIncomeCents, parseMoneyToCents } from '../../domain/money';
import { computeMileage } from '../../domain/mileage';
import { formatHours, shiftDuration } from '../../domain/duration';

export function EndDashSheet({ onClose }: { onClose: () => void }) {
  const { activeShift, settings } = useLedger();
  const { mutate, pushToast } = useLedgerContext();

  const [endTime, setEndTime] = useState(nowLocalTime());
  const [endOdo, setEndOdo] = useState('');
  const [appEarnings, setAppEarnings] = useState('');
  const [cashTips, setCashTips] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // If the active dash disappears (ended elsewhere, discarded), close the sheet.
  useEffect(() => {
    if (!activeShift) onClose();
  }, [activeShift, onClose]);
  if (!activeShift) return null;

  const endOdoNum = endOdo.trim() === '' ? null : Number(endOdo);
  const endOdoValid = endOdoNum != null && Number.isFinite(endOdoNum);
  const mileage = computeMileage(
    activeShift.startOdometer,
    endOdoValid ? endOdoNum : null,
    settings.implausibleMiles,
  );
  const appCents = parseMoneyToCents(appEarnings);
  const tipCents = parseMoneyToCents(cashTips);
  const gross = grossIncomeCents(appCents, tipCents);
  const dur = shiftDuration(activeShift.startTime, endTime || null);
  const blocked = mileage.status === 'reversed' || !endOdoValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!activeShift) return;
    if (mileage.status === 'reversed') {
      setFormError(mileage.message);
      return;
    }
    if (!endOdoValid) {
      setFormError('Enter the ending odometer reading to complete this dash.');
      return;
    }
    setBusy(true);
    try {
      await mutate(
        () =>
          endShift(activeShift.id, {
            endTime: endTime || null,
            endOdometer: endOdoNum,
            appEarningsCents: appCents,
            cashTipsCents: tipCents,
            notes: notes.trim(),
          }),
        { silent: true },
      );
      const milesText = mileage.miles === null ? 'miles missing' : `${mileage.miles.toLocaleString('en-US')} mi`;
      const grossText = gross > 0 ? ` · ${formatCents(gross)}` : '';
      pushToast(`Dash saved · ${milesText}${grossText}`);
      onClose();
    } catch (err) {
      setFormError((err as Error).message || 'Could not save the dash.');
      setBusy(false);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title="End dash"
      description={`${activeShift.vehicleLabel} · started ${activeShift.startTime ?? '—'}`}
    >
      <form onSubmit={submit}>
        <NumberInput
          label="Ending odometer"
          hint={
            activeShift.startOdometer != null
              ? `Start reading was ${activeShift.startOdometer.toLocaleString('en-US')}.`
              : 'No starting reading was recorded — mileage will be missing.'
          }
          value={endOdo}
          onChange={setEndOdo}
        />
        <TimeInput
          label="End time"
          hint="Defaults to now. Past midnight is handled automatically."
          value={endTime}
          onChange={setEndTime}
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
              <dd>
                {dur.known
                  ? formatHours(dur.hours) + (dur.crossedMidnight ? ' (overnight)' : '')
                  : 'unknown'}
              </dd>
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

        <Button type="submit" variant="primary" size="xl" block disabled={busy || blocked}>
          {busy ? 'Saving…' : 'Save dash'}
        </Button>
      </form>
    </Sheet>
  );
}

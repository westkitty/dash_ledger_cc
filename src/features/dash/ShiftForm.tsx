import { useMemo, useState, type ReactNode } from 'react';
import { DateInput, MoneyInput, NumberInput, SelectInput, TextArea, TextInput, TimeInput } from '../../components/forms';
import { Button, Money, Notice } from '../../components/ui';
import { mondayOf, formatWeekRange } from '../../domain/dates';
import { parseMoneyToCents, formatCents, grossIncomeCents } from '../../domain/money';
import { computeMileage, checkContinuity } from '../../domain/mileage';
import { shiftDuration, formatHours } from '../../domain/duration';
import { effectiveRate } from '../../domain/mileageRates';
import type { MileageRate, Settings, Shift, Vehicle } from '../../domain/types';

export interface ShiftFormValues {
  vehicleId: string;
  vehicleLabel: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  appEarningsCents: number | null;
  cashTipsCents: number | null;
  purpose: string;
  notes: string;
}

interface Props {
  mode: 'log' | 'edit';
  vehicles: Vehicle[];
  shifts: Shift[];
  settings: Settings;
  mileageRates: MileageRate[];
  initial: Partial<ShiftFormValues> & { id?: string };
  submitLabel: string;
  onSubmit: (values: ShiftFormValues) => Promise<void>;
  children?: ReactNode;
}

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ShiftForm({ mode, vehicles, shifts, settings, mileageRates, initial, submitLabel, onSubmit, children }: Props) {
  const activeVehicles = vehicles.filter((v) => !v.archived || v.id === initial.vehicleId);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId ?? settings.defaultVehicleId ?? activeVehicles[0]?.id ?? '');
  const [date, setDate] = useState(initial.date ?? '');
  const [startTime, setStartTime] = useState(initial.startTime ?? '');
  const [endTime, setEndTime] = useState(initial.endTime ?? '');
  const [startOdo, setStartOdo] = useState(initial.startOdometer != null ? String(initial.startOdometer) : '');
  const [endOdo, setEndOdo] = useState(initial.endOdometer != null ? String(initial.endOdometer) : '');
  const [appEarnings, setAppEarnings] = useState(
    initial.appEarningsCents != null ? formatCents(initial.appEarningsCents).replace('$', '') : '',
  );
  const [cashTips, setCashTips] = useState(
    initial.cashTipsCents != null ? formatCents(initial.cashTipsCents).replace('$', '') : '',
  );
  const [purpose, setPurpose] = useState(initial.purpose ?? settings.defaultPurpose);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startOdoNum = numOrNull(startOdo);
  const endOdoNum = numOrNull(endOdo);
  const mileage = computeMileage(startOdoNum, endOdoNum, settings.implausibleMiles);
  const appCents = parseMoneyToCents(appEarnings);
  const tipCents = parseMoneyToCents(cashTips);
  const gross = grossIncomeCents(appCents, tipCents);
  const dur = shiftDuration(startTime || null, endTime || null);

  const cont = useMemo(
    () =>
      vehicleId && date && startOdoNum != null
        ? checkContinuity(shifts, vehicleId, date, startOdoNum, initial.id)
        : null,
    [vehicleId, date, startOdoNum, shifts, initial.id],
  );

  const rate = date ? effectiveRate(date, mileageRates) : null;
  const weekLabel = date ? formatWeekRange(mondayOf(date)) : '—';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!vehicleId) return setErr('Choose a vehicle.');
    if (!date) return setErr('Choose a date.');
    if (mileage.status === 'reversed') return setErr(mileage.message);
    setBusy(true);
    try {
      await onSubmit({
        vehicleId,
        vehicleLabel: activeVehicles.find((v) => v.id === vehicleId)?.label ?? 'Vehicle',
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        startOdometer: startOdoNum,
        endOdometer: endOdoNum,
        appEarningsCents: appCents,
        cashTipsCents: tipCents,
        purpose: purpose.trim() || settings.defaultPurpose,
        notes: notes.trim(),
      });
    } catch {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <SelectInput
        label="Vehicle"
        value={vehicleId}
        onChange={setVehicleId}
        options={activeVehicles.map((v) => ({ value: v.id, label: v.label }))}
      />
      <DateInput label="Date" hint={date ? `Week ${weekLabel} (Mon–Sun)` : 'Local calendar date'} value={date} onChange={setDate} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <TimeInput label="Start time" hint="Optional" value={startTime} onChange={setStartTime} />
        <TimeInput label="End time" hint="Optional" value={endTime} onChange={setEndTime} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <NumberInput label="Start odometer" value={startOdo} onChange={setStartOdo} />
        <NumberInput label="End odometer" value={endOdo} onChange={setEndOdo} />
      </div>
      {cont?.hasGap && cont.gap !== null && (
        <Notice tone="warn">
          Continuity gap of {Math.abs(cont.gap)} mi vs the previous {activeVehicles.find((v) => v.id === vehicleId)?.label}{' '}
          reading ({cont.priorEndOdometer?.toLocaleString('en-US')}). Not counted as business mileage.
        </Notice>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MoneyInput label="DoorDash earnings" value={appEarnings} onChange={setAppEarnings} />
        <MoneyInput label="Cash tips (extra)" value={cashTips} onChange={setCashTips} />
      </div>
      <TextInput label="Business purpose" value={purpose} onChange={setPurpose} />
      <TextArea label="Notes" hint="Optional" value={notes} onChange={setNotes} />

      <div className="notice" style={{ marginBottom: 16 }}>
        <div className="section-label">Calculated</div>
        <div className="kv">
          <div className="kv__row">
            <dt>Business mileage</dt>
            <dd>
              {mileage.miles === null ? 'missing' : mileage.miles.toLocaleString('en-US')}
              {mileage.status === 'suspicious' && ' ⚠ suspicious'}
              {mileage.status === 'reversed' && ' ⚠ reversed'}
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
          <div className="kv__row">
            <dt>Assigned week</dt>
            <dd>{weekLabel}</dd>
          </div>
          <div className="kv__row">
            <dt>Mileage rate on date</dt>
            <dd>{rate ? `$${rate.ratePerMile.toFixed(3)}/mi` : 'none configured'}</dd>
          </div>
        </div>
      </div>

      {mode === 'edit' && (
        <p className="small faint">
          Editing recalculates every derived value from the readings you enter — previously
          calculated figures are not treated as authoritative.
        </p>
      )}
      {mileage.status === 'suspicious' && (
        <Notice tone="warn" title="High single-dash mileage">
          {mileage.message}
        </Notice>
      )}
      {err && <Notice tone="danger">{err}</Notice>}

      <Button type="submit" variant="primary" size="xl" block disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
      {children}
    </form>
  );
}

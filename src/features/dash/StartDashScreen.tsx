import { useEffect, useMemo, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { useRouter } from '../../app/router';
import { startShift } from '../../db/repositories';
import { DateInput, NumberInput, SelectInput, TextInput, TimeInput } from '../../components/forms';
import { Button, Card, Notice } from '../../components/ui';
import { todayLocalDate, nowLocalTime } from '../../domain/dates';
import { suggestStartOdometer, checkContinuity } from '../../domain/mileage';

export function StartDashScreen() {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();
  const { vehicles, shifts, settings, activeShift } = snap;

  const activeVehicles = vehicles.filter((v) => !v.archived);
  const [vehicleId, setVehicleId] = useState(
    settings.defaultVehicleId && activeVehicles.some((v) => v.id === settings.defaultVehicleId)
      ? settings.defaultVehicleId
      : activeVehicles[0]?.id ?? '',
  );
  const [date, setDate] = useState(todayLocalDate());
  const [startTime, setStartTime] = useState(nowLocalTime());
  const suggestion = useMemo(
    () => (vehicleId ? suggestStartOdometer(shifts, vehicleId, date) : null),
    [shifts, vehicleId, date],
  );
  const [startOdo, setStartOdo] = useState(suggestion != null ? String(suggestion) : '');
  const [purpose, setPurpose] = useState(settings.defaultPurpose);
  const [busy, setBusy] = useState(false);

  // Keep the odometer prefill in step with vehicle changes until the user edits it.
  const [odoTouched, setOdoTouched] = useState(false);
  const effectiveOdo = odoTouched ? startOdo : suggestion != null ? String(suggestion) : startOdo;

  // Deep-linked here (e.g. an Apple Shortcut) with no vehicle yet: hand off to
  // the Desk, whose Start Dash sheet chains vehicle creation into the flow.
  const noVehicle = activeVehicles.length === 0;
  useEffect(() => {
    if (noVehicle && !activeShift) navigate('/', { replace: true });
  }, [noVehicle, activeShift, navigate]);

  if (activeShift) {
    return (
      <Card>
        <Notice tone="warn" title="A dash is already active">
          Only one dash can be active at a time. End or discard the current one first.
        </Notice>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button to="/end" variant="primary">
            End current dash
          </Button>
          <Button to="/">Back to Dash</Button>
        </div>
      </Card>
    );
  }

  const odoNum = effectiveOdo.trim() === '' ? null : Number(effectiveOdo);
  const cont =
    vehicleId && odoNum != null && Number.isFinite(odoNum)
      ? checkContinuity(shifts, vehicleId, date, odoNum)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId) return;
    setBusy(true);
    try {
      const label = activeVehicles.find((v) => v.id === vehicleId)?.label ?? 'Vehicle';
      const res = await mutate(
        () =>
          startShift({
            vehicleId,
            vehicleLabel: label,
            date,
            startTime: startTime || null,
            startOdometer: odoNum != null && Number.isFinite(odoNum) ? odoNum : null,
            purpose: purpose.trim() || settings.defaultPurpose,
          }),
        { success: 'Dash started', silent: true },
      );
      if (!res.created) {
        // Race: an active dash already existed.
      }
      navigate('/', { replace: true });
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Start Dash</h1>
          <p>Saved to this device the moment you start.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={submit}>
          <SelectInput
            label="Vehicle"
            value={vehicleId}
            onChange={setVehicleId}
            options={activeVehicles.map((v) => ({ value: v.id, label: v.label }))}
          />
          <DateInput label="Date" value={date} onChange={setDate} />
          <TimeInput label="Start time" hint="Optional — defaults to now" value={startTime} onChange={setStartTime} />
          <NumberInput
            label="Starting odometer"
            hint="Prefilled from this vehicle's last ending reading. Always editable."
            value={effectiveOdo}
            onChange={(v) => {
              setOdoTouched(true);
              setStartOdo(v);
            }}
            suggestion={
              suggestion != null && effectiveOdo !== String(suggestion)
                ? suggestion.toLocaleString('en-US')
                : null
            }
            onUseSuggestion={
              suggestion != null
                ? () => {
                    setOdoTouched(true);
                    setStartOdo(String(suggestion));
                  }
                : undefined
            }
          />
          {cont?.hasGap && cont.gap !== null && (
            <Notice tone="warn">
              Continuity gap: {Math.abs(cont.gap)} mi{' '}
              {cont.gap > 0 ? 'ahead of' : 'behind'} the previous reading (
              {cont.priorEndOdometer?.toLocaleString('en-US')}). Allowed — those miles just won't be
              counted as business mileage.
            </Notice>
          )}
          <TextInput label="Business purpose" value={purpose} onChange={setPurpose} />

          <Button type="submit" variant="primary" size="xl" block disabled={busy || !vehicleId}>
            {busy ? 'Starting…' : 'Save & Start Dash'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

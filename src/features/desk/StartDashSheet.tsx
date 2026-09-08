/**
 * Start Dash — as a sheet over the Desk.
 *
 * Happy path with a usable vehicle: two primary-action taps (open the sheet,
 * then "Start dash"). Prefills — vehicle, current time, this vehicle's last
 * ending odometer, the default purpose — are shown and editable, never assumed
 * silently.
 *
 * No vehicle yet: the sheet opens on a minimal "add a vehicle" step and chains
 * straight into Start on save. The values already typed into the Start step are
 * kept across that interruption. Creating the vehicle never starts a dash on its
 * own — the user still performs the final Start.
 *
 * The single-active-dash invariant is enforced in the repository transaction
 * (`startShift`), never here.
 */

import { useMemo, useRef, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { createVehicle, startShift } from '../../db/repositories';
import { Sheet } from '../../components/Sheet';
import { Button, Notice } from '../../components/ui';
import { NumberInput, SelectInput, TextInput, TimeInput } from '../../components/forms';
import { nowLocalTime, todayLocalDate } from '../../domain/dates';
import { checkContinuity, suggestStartOdometer } from '../../domain/mileage';

export function StartDashSheet({ onClose }: { onClose: () => void }) {
  const { vehicles, shifts, settings, activeShift } = useLedger();
  const { mutate, pushToast } = useLedgerContext();

  const activeVehicles = useMemo(() => vehicles.filter((v) => !v.archived), [vehicles]);
  const [step, setStep] = useState<'vehicle' | 'start'>(activeVehicles.length ? 'start' : 'vehicle');

  // --- Start-step fields. Declared once so they survive the vehicle step. ---
  const [vehicleId, setVehicleId] = useState(
    settings.defaultVehicleId && activeVehicles.some((v) => v.id === settings.defaultVehicleId)
      ? settings.defaultVehicleId
      : activeVehicles[0]?.id ?? '',
  );
  const date = todayLocalDate();
  const [startTime, setStartTime] = useState(nowLocalTime());
  const [odo, setOdo] = useState('');
  const [odoTouched, setOdoTouched] = useState(false);
  const [purpose, setPurpose] = useState(settings.defaultPurpose);
  const [busy, setBusy] = useState(false);

  // --- Vehicle step ---
  const [vName, setVName] = useState('');
  const [vErr, setVErr] = useState<string | null>(null);
  const createdVehicleId = useRef<string | null>(null);

  const suggestion = useMemo(
    () => (vehicleId ? suggestStartOdometer(shifts, vehicleId, date) : null),
    [shifts, vehicleId, date],
  );
  const effectiveOdo = !odoTouched && suggestion != null ? String(suggestion) : odo;
  const odoNum = effectiveOdo.trim() === '' ? null : Number(effectiveOdo);
  const cont =
    vehicleId && odoNum != null && Number.isFinite(odoNum)
      ? checkContinuity(shifts, vehicleId, date, odoNum)
      : null;

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    const name = vName.trim();
    if (!name) {
      setVErr('Give the vehicle a short name so dashes can be attributed to it.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      // Retry-safe: only ever create one vehicle from this sheet.
      if (!createdVehicleId.current) {
        const v = await mutate(() => createVehicle(name), { success: 'Vehicle added', silent: true });
        createdVehicleId.current = v.id;
        setVehicleId(v.id);
      }
      setStep('start');
    } catch {
      /* toast shown by mutate */
    } finally {
      setBusy(false);
    }
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId || busy) return;
    setBusy(true);
    try {
      const label = activeVehicles.find((v) => v.id === vehicleId)?.label ?? 'Vehicle';
      await mutate(
        () =>
          startShift({
            vehicleId,
            vehicleLabel: label,
            date,
            startTime: startTime || null,
            startOdometer: odoNum != null && Number.isFinite(odoNum) ? odoNum : null,
            purpose: purpose.trim() || settings.defaultPurpose,
          }),
        { silent: true },
      );
      pushToast('Dash started — you are on the road.');
      onClose();
    } catch {
      setBusy(false);
    }
  }

  if (activeShift) {
    return (
      <Sheet onClose={onClose} title="A dash is already active">
        <Notice tone="warn" title="Already on the road">
          Only one dash can be active at a time. End the current one first.
        </Notice>
        <Button variant="primary" size="xl" block onClick={onClose}>
          Back to the Desk
        </Button>
      </Sheet>
    );
  }

  if (step === 'vehicle') {
    return (
      <Sheet
        onClose={onClose}
        title="Add a vehicle"
        description="Every dash is tied to a vehicle so mileage and odometer continuity stay correct per car. You can add more later."
      >
        <form onSubmit={addVehicle}>
          <TextInput
            label="Vehicle name"
            hint="e.g. 2019 Corolla · Blue Prius · Civic"
            value={vName}
            onChange={(v) => {
              setVName(v);
              setVErr(null);
            }}
            error={vErr}
            autoFocus
          />
          <Button type="submit" variant="primary" size="xl" block disabled={busy}>
            {busy ? 'Saving…' : 'Save vehicle & continue'}
          </Button>
          <button type="button" className="link-btn" onClick={onClose}>
            Cancel
          </button>
        </form>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Start dash" description="Saved to this device the moment you start.">
      <form onSubmit={start}>
        {activeVehicles.length > 1 && (
          <SelectInput
            label="Vehicle"
            value={vehicleId}
            onChange={setVehicleId}
            options={activeVehicles.map((v) => ({ value: v.id, label: v.label }))}
          />
        )}
        <TimeInput
          label="Start time"
          hint="Defaults to now."
          value={startTime}
          onChange={setStartTime}
        />
        <NumberInput
          label="Starting odometer"
          hint={
            suggestion != null
              ? `Prefilled from this vehicle's last ending reading (${suggestion.toLocaleString('en-US')}). Edit if you've driven since.`
              : 'No previous reading for this vehicle — enter the current odometer.'
          }
          value={effectiveOdo}
          onChange={(v) => {
            setOdoTouched(true);
            setOdo(v);
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
                  setOdo(String(suggestion));
                }
              : undefined
          }
        />
        {cont?.hasGap && cont.gap !== null && (
          <Notice tone="warn">
            Continuity gap: {Math.abs(cont.gap)} mi {cont.gap > 0 ? 'ahead of' : 'behind'} the previous
            reading ({cont.priorEndOdometer?.toLocaleString('en-US')}). Allowed — those miles just
            won't count as business mileage.
          </Notice>
        )}
        <TextInput label="Business purpose" value={purpose} onChange={setPurpose} />

        <Button type="submit" variant="primary" size="xl" block disabled={busy || !vehicleId}>
          {busy ? 'Starting…' : 'Start dash'}
        </Button>
      </form>
    </Sheet>
  );
}

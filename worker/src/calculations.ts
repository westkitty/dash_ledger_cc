export interface ShiftLike {
  status: 'active' | 'completed';
  startTime: string | null;
  endTime: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  appEarningsCents: number | null;
  cashTipsCents: number | null;
}

function minutesOfDay(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function trackedMinutes(shift: ShiftLike): number | null {
  const start = minutesOfDay(shift.startTime);
  const end = minutesOfDay(shift.endTime);
  if (start === null || end === null || end < start) return null;
  return end - start;
}

export function businessMiles(shift: ShiftLike): number | null {
  const start = shift.startOdometer;
  const end = shift.endOdometer;
  if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return end - start;
}

export function grossCents(shift: ShiftLike): number {
  return (shift.appEarningsCents ?? 0) + (shift.cashTipsCents ?? 0);
}

export function summarizeShifts(shifts: ShiftLike[]) {
  let gross = 0;
  let miles = 0;
  let minutes = 0;
  let mileageRows = 0;
  let timedRows = 0;

  for (const shift of shifts) {
    gross += grossCents(shift);
    const m = businessMiles(shift);
    if (m !== null) {
      miles += m;
      mileageRows += 1;
    }
    const t = trackedMinutes(shift);
    if (t !== null) {
      minutes += t;
      timedRows += 1;
    }
  }

  return {
    shiftCount: shifts.length,
    grossCents: gross,
    businessMiles: miles,
    trackedShiftMinutes: minutes,
    shiftsWithMileage: mileageRows,
    shiftsWithTrackedTime: timedRows,
    grossPerTrackedHourCents: minutes > 0 ? Math.round((gross * 60) / minutes) : null,
    grossPerBusinessMileCents: miles > 0 ? Math.round(gross / miles) : null,
  };
}

export function calculateCommuteHurdle(input: {
  outboundMiles: number;
  returnMiles: number;
  outboundMinutes: number;
  returnMinutes: number;
  vehicleCostPerMile: number;
  valueOfTimePerHour: number;
}) {
  const deliberateMiles = input.outboundMiles + input.returnMiles;
  const deliberateMinutes = input.outboundMinutes + input.returnMinutes;
  const vehicleCost = deliberateMiles * input.vehicleCostPerMile;
  const timeCost = (deliberateMinutes / 60) * input.valueOfTimePerHour;
  return {
    deliberateMiles,
    deliberateMinutes,
    vehicleCost,
    timeCost,
    requiredAdditionalGross: vehicleCost + timeCost,
  };
}

export function calculateOffer(input: {
  grossCents: number;
  activeMinutes: number;
  deliveryMiles: number;
  recoveryMiles: number;
  vehicleCostPerMile: number;
  tollsCents?: number;
  parkingCents?: number;
  otherDirectCostsCents?: number;
}) {
  const totalMiles = input.deliveryMiles + input.recoveryMiles;
  const modeledVehicleCostCents = Math.round(totalMiles * input.vehicleCostPerMile * 100);
  const directCostsCents =
    modeledVehicleCostCents +
    (input.tollsCents ?? 0) +
    (input.parkingCents ?? 0) +
    (input.otherDirectCostsCents ?? 0);
  const operatingContributionCents = input.grossCents - directCostsCents;
  return {
    totalMiles,
    modeledVehicleCostCents,
    directCostsCents,
    operatingContributionCents,
    grossPerActiveHourCents:
      input.activeMinutes > 0 ? Math.round((input.grossCents * 60) / input.activeMinutes) : null,
    contributionPerActiveHourCents:
      input.activeMinutes > 0 ? Math.round((operatingContributionCents * 60) / input.activeMinutes) : null,
    grossPerMileCents: totalMiles > 0 ? Math.round(input.grossCents / totalMiles) : null,
    contributionPerMileCents: totalMiles > 0 ? Math.round(operatingContributionCents / totalMiles) : null,
  };
}

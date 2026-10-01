import { describe, expect, it } from 'vitest';
import {
  businessMiles,
  calculateCommuteHurdle,
  calculateOffer,
  summarizeShifts,
  trackedMinutes,
} from '../src/calculations';

describe('Dash Ledger bridge calculations', () => {
  it('keeps tracked shift time separate and deterministic', () => {
    const shift = {
      status: 'completed' as const,
      startTime: '10:15',
      endTime: '12:45',
      startOdometer: 100,
      endOdometer: 142.5,
      appEarningsCents: 5_000,
      cashTipsCents: 500,
    };

    expect(trackedMinutes(shift)).toBe(150);
    expect(businessMiles(shift)).toBe(42.5);
    expect(summarizeShifts([shift])).toMatchObject({
      grossCents: 5_500,
      businessMiles: 42.5,
      trackedShiftMinutes: 150,
      grossPerTrackedHourCents: 2_200,
    });
  });

  it('rejects reversed odometer from mileage math instead of clamping it', () => {
    expect(
      businessMiles({
        status: 'completed',
        startTime: '10:00',
        endTime: '11:00',
        startOdometer: 120,
        endOdometer: 110,
        appEarningsCents: 1_000,
        cashTipsCents: 0,
      }),
    ).toBeNull();
  });

  it('prices deliberate commute time and miles', () => {
    expect(
      calculateCommuteHurdle({
        outboundMiles: 20,
        returnMiles: 20,
        outboundMinutes: 30,
        returnMinutes: 30,
        vehicleCostPerMile: 0.45,
        valueOfTimePerHour: 20,
      }),
    ).toEqual({
      deliberateMiles: 40,
      deliberateMinutes: 60,
      vehicleCost: 18,
      timeCost: 20,
      requiredAdditionalGross: 38,
    });
  });

  it('includes recovery miles in offer contribution', () => {
    expect(
      calculateOffer({
        grossCents: 2_000,
        activeMinutes: 30,
        deliveryMiles: 5,
        recoveryMiles: 3,
        vehicleCostPerMile: 0.5,
      }),
    ).toMatchObject({
      totalMiles: 8,
      modeledVehicleCostCents: 400,
      operatingContributionCents: 1_600,
      contributionPerActiveHourCents: 3_200,
    });
  });
});

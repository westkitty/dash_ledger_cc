/**
 * Phase 2 — Desk / field workflow integration.
 *
 * Renders the whole app against fake-indexeddb and drives the field journeys a
 * dasher actually runs: land on the Desk with no wall, start (chaining through
 * vehicle creation when needed), see an unmistakable on-road state that survives
 * a reload, and reach the quick Expense / Receipt entry points. Recovery stays
 * directly reachable with zero vehicles.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { App } from '../app/App';
import { RouterProvider } from '../app/router';
import { LedgerProvider } from '../state/store';
import { getDB } from '../db/db';
import { createVehicle } from '../db/repositories';

// jsdom has no layout engine; the router scrolls on every navigation.
window.scrollTo = () => {};

async function clearAll(): Promise<void> {
  const db = getDB();
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.vehicles.clear(),
    db.shifts.clear(),
    db.expenses.clear(),
    db.receipts.clear(),
    db.receiptBlobs.clear(),
    db.weeklyClosures.clear(),
    db.mileageRates.clear(),
    db.merchantMemory.clear(),
    db.kv.clear(),
  ]);
}

function renderApp() {
  return render(
    <RouterProvider>
      <LedgerProvider>
        <App />
      </LedgerProvider>
    </RouterProvider>,
  );
}

/** The Desk's Start button, once the ledger snapshot has loaded. */
async function findStartButton() {
  return screen.findByRole('button', { name: /start dash/i });
}

/** Scope queries to the open sheet so they don't collide with the Desk behind it. */
function sheet() {
  return within(screen.getByRole('dialog'));
}

/** The active-dash card's End Dash button is the unambiguous on-road signal. */
const onRoad = () => screen.queryByRole('button', { name: /end dash/i });

beforeEach(async () => {
  window.location.hash = '#/';
  await clearAll();
});
afterEach(cleanup);

describe('fresh ledger', () => {
  it('lands on the Desk — no mandatory onboarding redirect — with a dominant Start Dash', async () => {
    renderApp();
    const start = await findStartButton();
    expect(start).toBeTruthy();
    expect(start.className).toMatch(/btn--xl/);
    expect(start.className).toMatch(/btn--primary/);
    // Not parked behind onboarding.
    expect(screen.queryByText(/add your first vehicle/i)).toBeNull();
    expect(screen.getByText(/ready when you are/i)).toBeTruthy();
    expect(window.location.hash).toBe('#/');
  });

  it('Start Dash with no vehicle chains into vehicle creation, then resumes Start', async () => {
    renderApp();
    fireEvent.click(await findStartButton());

    // Step 1: vehicle creation inside the same sheet.
    const nameField = await sheet().findByLabelText(/vehicle name/i);
    fireEvent.change(nameField, { target: { value: '2019 Corolla' } });
    fireEvent.click(sheet().getByRole('button', { name: /save vehicle & continue/i }));

    // Step 2: the Start form is now shown (odometer field), intent preserved.
    const odo = await sheet().findByLabelText(/starting odometer/i);
    fireEvent.change(odo, { target: { value: '48210' } });
    fireEvent.click(sheet().getByRole('button', { name: /^start dash$/i }));

    // On the road, back on the Desk (sheet closed).
    await waitFor(() => expect(onRoad()).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();

    const db = getDB();
    expect(await db.vehicles.count()).toBe(1);
    const actives = await db.shifts.where('status').equals('active').toArray();
    expect(actives).toHaveLength(1);
    expect(actives[0].startOdometer).toBe(48210);
    expect(actives[0].vehicleLabel).toBe('2019 Corolla');
  });

  it('cancelling vehicle creation creates neither a vehicle nor a dash', async () => {
    renderApp();
    fireEvent.click(await findStartButton());
    await screen.findByLabelText(/vehicle name/i);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const db = getDB();
    expect(await db.vehicles.count()).toBe(0);
    expect(await db.shifts.count()).toBe(0);
  });
});

describe('with one vehicle', () => {
  beforeEach(async () => {
    await createVehicle('Blue Prius');
  });

  it('Start Dash goes straight to the start form with no redundant vehicle picker', async () => {
    renderApp();
    fireEvent.click(await findStartButton());

    await screen.findByLabelText(/starting odometer/i);
    expect(screen.queryByLabelText(/vehicle name/i)).toBeNull();
    expect(screen.queryByRole('combobox', { name: /vehicle/i })).toBeNull();
  });

  it('a two-tap start creates exactly one active dash, and it survives a reload', async () => {
    const view = renderApp();
    fireEvent.click(await findStartButton()); // tap 1
    const odo = await sheet().findByLabelText(/starting odometer/i);
    fireEvent.change(odo, { target: { value: '1000' } });
    fireEvent.click(sheet().getByRole('button', { name: /^start dash$/i })); // tap 2

    await waitFor(() => expect(onRoad()).toBeTruthy());
    expect((await getDB().shifts.where('status').equals('active').toArray())).toHaveLength(1);

    // "Reload": tear the app down and mount it again against the same DB.
    view.unmount();
    cleanup();
    renderApp();
    await waitFor(() => expect(onRoad()).toBeTruthy());
    expect(screen.getByRole('button', { name: /end dash/i })).toBeTruthy();
  });

  it('ending the dash clears the on-road state and returns the Desk to Ready', async () => {
    renderApp();
    fireEvent.click(await findStartButton());
    fireEvent.change(await sheet().findByLabelText(/starting odometer/i), { target: { value: '1000' } });
    fireEvent.click(sheet().getByRole('button', { name: /^start dash$/i }));
    await waitFor(() => expect(onRoad()).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /end dash/i }));
    fireEvent.change(await sheet().findByLabelText(/ending odometer/i), { target: { value: '1150' } });
    fireEvent.click(sheet().getByRole('button', { name: /save dash/i }));

    await waitFor(() => expect(screen.getByText(/ready when you are/i)).toBeTruthy());
    expect(onRoad()).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const completed = (await getDB().shifts.toArray()).filter((s) => s.status === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].endOdometer).toBe(1150);
  });

  it('a reversed ending odometer keeps Save disabled and does not complete the dash', async () => {
    renderApp();
    fireEvent.click(await findStartButton());
    fireEvent.change(await sheet().findByLabelText(/starting odometer/i), { target: { value: '1000' } });
    fireEvent.click(sheet().getByRole('button', { name: /^start dash$/i }));
    await waitFor(() => expect(onRoad()).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /end dash/i }));
    fireEvent.change(await sheet().findByLabelText(/ending odometer/i), { target: { value: '900' } });

    const save = sheet().getByRole('button', { name: /save dash/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(sheet().getByText(/reversed/i)).toBeTruthy();
    const actives = await getDB().shifts.where('status').equals('active').toArray();
    expect(actives).toHaveLength(1);
  });
});

describe('quick actions', () => {
  beforeEach(async () => {
    await createVehicle('Civic');
  });

  it('Desk → Expense opens expense entry directly', async () => {
    renderApp();
    await findStartButton();
    fireEvent.click(screen.getByRole('button', { name: /expense/i }));
    expect(await screen.findByRole('heading', { name: /add expense/i })).toBeTruthy();
  });

  it('Desk → Receipt opens receipt capture directly', async () => {
    renderApp();
    await findStartButton();
    fireEvent.click(screen.getByRole('button', { name: /receipt/i }));
    expect(await screen.findByRole('heading', { name: /capture receipt/i })).toBeTruthy();
  });
});

describe('recovery route', () => {
  it('stays reachable with zero vehicles and is not redirected to the Desk or onboarding', async () => {
    window.location.hash = '#/vault?s=recovery';
    renderApp();
    expect(await screen.findByText(/import from an earlier version/i)).toBeTruthy();
    expect(window.location.hash).toBe('#/vault?s=recovery');
    expect(screen.queryByText(/ready when you are/i)).toBeNull();
  });
});

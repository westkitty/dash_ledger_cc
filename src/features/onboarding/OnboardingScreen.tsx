import { useState } from 'react';
import { useRouter, Link } from '../../app/router';
import { useLedgerContext } from '../../state/store';
import { createVehicle } from '../../db/repositories';
import { TextInput } from '../../components/forms';
import { Button, Card, DisclaimerNote } from '../../components/ui';

export function OnboardingScreen() {
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Give the vehicle a short name so shifts can be attributed to it.');
      return;
    }
    setBusy(true);
    try {
      await mutate(() => createVehicle(trimmed), { success: 'Vehicle added' });
      navigate('/', { replace: true });
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Welcome to Dash Ledger</h1>
          <p>A private, on-device record of your delivery work. No account, no server.</p>
        </div>
      </div>

      <Card label="Add your first vehicle">
        <p className="small muted">
          Every dash is tied to a vehicle so mileage and odometer continuity stay correct per car.
          You can add more later and change the default.
        </p>
        <form onSubmit={submit}>
          <TextInput
            label="Vehicle name"
            hint="e.g. 2019 Corolla · Blue Prius · Civic"
            value={label}
            onChange={(v) => {
              setLabel(v);
              setError(null);
            }}
            error={error}
            autoFocus
          />
          <Button type="submit" variant="primary" size="xl" block disabled={busy}>
            {busy ? 'Saving…' : 'Save & continue'}
          </Button>
        </form>
      </Card>

      <Card label="Already used Dash Ledger?">
        <p className="small muted">
          If you have records in an earlier version — the original single-file app, an earlier build
          of this one, or the Grok build — bring them in instead of starting over. Your old data is
          only read, never changed.
        </p>
        <Link to="/vault?s=recovery" className="link-btn">
          Import my existing records →
        </Link>
      </Card>

      <Card label="What you can track">
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Shifts, working time, mileage &amp; odometer readings</li>
          <li>DoorDash earnings and separate cash tips</li>
          <li>Expenses, receipts &amp; receipt photos</li>
          <li>Weekly &amp; yearly summaries with an effective-dated mileage estimate</li>
          <li>Full local backup, restore &amp; a printable Tax Binder</li>
        </ul>
      </Card>

      <DisclaimerNote />
    </div>
  );
}

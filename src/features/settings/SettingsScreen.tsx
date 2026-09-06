import { useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Link } from '../../app/router';
import { Button, Card, Notice } from '../../components/ui';
import { NumberInput, SelectInput, TextInput } from '../../components/forms';
import { saveSettings } from '../../db/repositories';
import { applyThemeToDocument } from '../../state/store';
import type { ThemeChoice } from '../../domain/types';

export function SettingsScreen() {
  const { vehicles, settings } = useLedger();
  const { mutate, pushToast, setTheme } = useLedgerContext();

  const [purpose, setPurpose] = useState(settings.defaultPurpose);
  const [overdue, setOverdue] = useState(String(settings.backupOverdueDays));
  const [implausible, setImplausible] = useState(String(settings.implausibleMiles));

  const startUrl = `${location.origin}${location.pathname}#/start`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(startUrl);
      pushToast('Start-Dash link copied');
    } catch {
      pushToast('Copy failed — select and copy the link manually', 'warn');
    }
  }

  return (
    <div className="stack">
      <Link to="/vault" className="back-link">
        <span aria-hidden>‹</span> Tax / Vault
      </Link>
      <div className="screen-head">
        <div>
          <h1>Settings</h1>
          <p>Stored locally on this device.</p>
        </div>
      </div>

      <Card label="Appearance">
        <SelectInput
          label="Theme"
          value={settings.theme}
          onChange={(v) => {
            const t = v as ThemeChoice;
            setTheme(t);
            void mutate(() => saveSettings({ theme: t }), { success: 'Theme updated', silent: true });
          }}
          options={[
            { value: 'system', label: 'Match system' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>

      <Card label="Defaults">
        <TextInput label="Default business purpose" value={purpose} onChange={setPurpose} />
        <SelectInput
          label="Default vehicle"
          value={settings.defaultVehicleId ?? ''}
          onChange={(v) => void mutate(() => saveSettings({ defaultVehicleId: v || null }), { success: 'Default vehicle set' })}
          options={[
            { value: '', label: '— none —' },
            ...vehicles.filter((v) => !v.archived).map((v) => ({ value: v.id, label: v.label })),
          ]}
        />
        <Button
          onClick={() =>
            void mutate(() => saveSettings({ defaultPurpose: purpose.trim() || 'DoorDash delivery work' }), {
              success: 'Default purpose saved',
            })
          }
        >
          Save purpose
        </Button>
      </Card>

      <Card label="Thresholds">
        <NumberInput
          label="Backup overdue after (days)"
          hint="Default 14"
          value={overdue}
          onChange={setOverdue}
        />
        <NumberInput
          label="Suspicious single-dash mileage (miles)"
          hint="Default 400 — dashes above this are preserved but flagged"
          value={implausible}
          onChange={setImplausible}
        />
        <Button
          variant="primary"
          onClick={() => {
            const od = Math.max(1, Math.round(Number(overdue) || 14));
            const im = Math.max(1, Math.round(Number(implausible) || 400));
            setOverdue(String(od));
            setImplausible(String(im));
            void mutate(() => saveSettings({ backupOverdueDays: od, implausibleMiles: im }), {
              success: 'Thresholds saved',
            });
          }}
        >
          Save thresholds
        </Button>
      </Card>

      <Card label="Start-Dash deep link">
        <p className="small muted">
          A stable hash link straight to Start Dash. Add it to an Apple Shortcuts personal automation:
          <br />
          <strong>When DoorDash opens → Open URL → this link.</strong>
        </p>
        <p className="inline-code" style={{ display: 'block', marginBottom: 10 }}>
          {startUrl}
        </p>
        <Button onClick={copyLink}>Copy link</Button>
        <Notice tone="info">
          This integration is entirely optional. Dash Ledger does not control or communicate with the
          DoorDash app.
        </Notice>
      </Card>

      <Card label="About">
        <p className="small muted">
          Dash Ledger keeps every record in this browser's local database. No account, no server, no
          analytics. Export a backup regularly from Tax / Vault → Backup.
        </p>
        <Link to="/diagnostics" className="link-btn">
          Open diagnostics &amp; self-test →
        </Link>
      </Card>

      <button
        className="link-btn"
        onClick={() => {
          applyThemeToDocument(settings.theme);
          pushToast('Theme reapplied');
        }}
        style={{ alignSelf: 'center' }}
      >
        Reapply theme
      </button>
    </div>
  );
}

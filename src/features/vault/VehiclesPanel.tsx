import { useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Button, Card, Notice, Pill } from '../../components/ui';
import { TextInput } from '../../components/forms';
import { createVehicle, updateVehicle, setDefaultVehicle } from '../../db/repositories';

export function VehiclesPanel() {
  const { vehicles, shifts, settings } = useLedger();
  const { mutate } = useLedgerContext();
  const [label, setLabel] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const shiftCount = (id: string) => shifts.filter((s) => s.vehicleId === id).length;

  return (
    <div className="stack">
      <Card label="Add vehicle">
        <TextInput label="Vehicle name" hint="e.g. 2019 Corolla" value={label} onChange={setLabel} />
        <Button
          variant="primary"
          onClick={() => {
            if (!label.trim()) return;
            void mutate(() => createVehicle(label.trim()), { success: 'Vehicle added' }).then(() => setLabel(''));
          }}
        >
          Add
        </Button>
      </Card>

      <Card label="Vehicles">
        <div className="rows">
          {vehicles.map((v) => (
            <div key={v.id} className="row-link" style={{ cursor: 'default', flexWrap: 'wrap' }}>
              <span className="row-link__main">
                <span className="row-link__title">
                  {v.label}{' '}
                  {settings.defaultVehicleId === v.id && <Pill tone="good">Default</Pill>}
                  {v.archived && <Pill tone="neutral">Archived</Pill>}
                </span>
                <span className="row-link__sub">{shiftCount(v.id)} shift(s) recorded</span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {settings.defaultVehicleId !== v.id && !v.archived && (
                  <button
                    className="link-btn"
                    onClick={() => void mutate(() => setDefaultVehicle(v.id), { success: 'Default set' })}
                  >
                    Make default
                  </button>
                )}
                <button
                  className="link-btn"
                  onClick={() => {
                    setRenameId(v.id);
                    setRenameVal(v.label);
                  }}
                >
                  Rename
                </button>
                <button
                  className="link-btn"
                  onClick={() =>
                    void mutate(() => updateVehicle(v.id, { archived: !v.archived }), {
                      success: v.archived ? 'Vehicle unarchived' : 'Vehicle archived',
                    })
                  }
                >
                  {v.archived ? 'Unarchive' : 'Archive'}
                </button>
              </span>
              {renameId === v.id && (
                <div style={{ width: '100%', marginTop: 8 }}>
                  <TextInput label="New name" value={renameVal} onChange={setRenameVal} />
                  <div className="btn-row">
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!renameVal.trim()) return;
                        void mutate(() => updateVehicle(v.id, { label: renameVal.trim() }), {
                          success: 'Vehicle renamed',
                        }).then(() => setRenameId(null));
                      }}
                    >
                      Save
                    </Button>
                    <Button onClick={() => setRenameId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <Notice tone="info">
          Vehicles are archived, not hard-deleted, so historical shifts keep their vehicle identity.
          Each shift also stores the vehicle name it had at the time.
        </Notice>
      </Card>
    </div>
  );
}

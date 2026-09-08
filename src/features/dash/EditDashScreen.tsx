import { useLedger, useLedgerContext, useUndoableDelete } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import { deleteShift, restoreDeletedShift, updateShift, endShift } from '../../db/repositories';
import { Button, Card, ConfirmButton, EmptyState, Money, Notice, Pill } from '../../components/ui';
import { ShiftForm } from './ShiftForm';
import { formatLocalDate } from '../../domain/dates';
import { computeMileage } from '../../domain/mileage';

export function EditDashScreen({ id }: { id: string }) {
  const { shifts, vehicles, expenses, settings, mileageRates } = useLedger();
  const { mutate } = useLedgerContext();
  const undoableDelete = useUndoableDelete();
  const { navigate } = useRouter();

  const shift = shifts.find((s) => s.id === id);
  if (!shift) {
    return (
      <EmptyState icon="✕" title="Dash not found" action={<Button to="/" variant="primary">Back to Dash</Button>}>
        This dash may have been deleted.
      </EmptyState>
    );
  }

  const linkedExpenses = expenses.filter((e) => e.shiftId === id);
  const m = computeMileage(shift.startOdometer, shift.endOdometer, settings.implausibleMiles);

  return (
    <div className="stack">
      <Link to="/" className="back-link">
        <span aria-hidden>‹</span> Dash
      </Link>
      <div className="screen-head">
        <div>
          <h1>Edit dash</h1>
          <p>
            {formatLocalDate(shift.date)} ·{' '}
            {shift.status === 'active' ? <Pill tone="warn">Active</Pill> : <Pill tone="neutral">Completed</Pill>}
          </p>
        </div>
      </div>

      {shift.status === 'active' && (
        <Notice tone="warn" title="This dash is still active">
          You can edit its details here, or{' '}
          <Link to="/end">end it from the End Dash screen</Link>.
        </Notice>
      )}

      <Card>
        <ShiftForm
          mode="edit"
          vehicles={vehicles}
          shifts={shifts}
          settings={settings}
          mileageRates={mileageRates}
          initial={{
            id: shift.id,
            vehicleId: shift.vehicleId,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            startOdometer: shift.startOdometer,
            endOdometer: shift.endOdometer,
            appEarningsCents: shift.appEarningsCents,
            cashTipsCents: shift.cashTipsCents,
            purpose: shift.purpose,
            notes: shift.notes,
          }}
          submitLabel="Save changes"
          onSubmit={async (v) => {
            await mutate(() => updateShift(shift.id, v), { success: 'Dash updated' });
            navigate('/', { replace: true });
          }}
        />
      </Card>

      {shift.status === 'active' && (
        <Card label="Complete this dash">
          <p className="small muted">
            Mark it completed with its current values. You can still edit afterwards.
          </p>
          <Button
            variant="default"
            block
            onClick={() =>
              void mutate(
                () =>
                  endShift(shift.id, {
                    endTime: shift.endTime,
                    endOdometer: shift.endOdometer,
                    appEarningsCents: shift.appEarningsCents,
                    cashTipsCents: shift.cashTipsCents,
                    notes: shift.notes,
                  }),
                { success: 'Dash marked completed' },
              )
            }
          >
            Mark completed
          </Button>
        </Card>
      )}

      <Card label={`Linked expenses (${linkedExpenses.length})`}>
        {linkedExpenses.length === 0 ? (
          <p className="small muted">No expenses linked to this dash.</p>
        ) : (
          <div className="rows">
            {linkedExpenses.map((e) => (
              <Link key={e.id} to={`/expense/${e.id}`} className="row-link">
                <span className="row-link__main">
                  <span className="row-link__title">{e.merchant || e.category}</span>
                  <span className="row-link__sub">
                    {e.date} · {e.category}
                  </span>
                </span>
                <span className="row-link__value">
                  <Money cents={e.amountCents} />
                </span>
              </Link>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Button to={`/expense/new?shift=${shift.id}`}>＋ Add expense for this dash</Button>
        </div>
      </Card>

      <Card label="Danger zone">
        <p className="small muted">
          Deleting this dash keeps every linked expense and receipt — only the link back to this dash
          is cleared.
        </p>
        <ConfirmButton
          block
          onConfirm={() => {
            void undoableDelete(
              () => deleteShift(shift.id),
              (d) => restoreDeletedShift(d),
              { deleted: 'Dash deleted', restored: 'Dash restored' },
            );
            navigate('/');
          }}
        >
          Delete dash
        </ConfirmButton>
      </Card>

      <p className="small faint" style={{ textAlign: 'center' }}>
        Mileage right now: {m.miles === null ? 'missing readings' : `${m.miles} business miles`}
        {m.status === 'suspicious' && ' — flagged suspicious'}.
      </p>
    </div>
  );
}

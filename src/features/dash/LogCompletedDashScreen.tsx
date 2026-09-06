import { useLedger, useLedgerContext } from '../../state/store';
import { useRouter } from '../../app/router';
import { logCompletedShift } from '../../db/repositories';
import { Card } from '../../components/ui';
import { ShiftForm } from './ShiftForm';
import { todayLocalDate } from '../../domain/dates';

export function LogCompletedDashScreen() {
  const { vehicles, shifts, settings, mileageRates } = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Log completed dash</h1>
          <p>A dash you already finished and never started in the app.</p>
        </div>
      </div>
      <Card>
        <ShiftForm
          mode="log"
          vehicles={vehicles}
          shifts={shifts}
          settings={settings}
          mileageRates={mileageRates}
          initial={{ date: todayLocalDate() }}
          submitLabel="Save completed dash"
          onSubmit={async (v) => {
            await mutate(
              () =>
                logCompletedShift({
                  ...v,
                  startTime: v.startTime,
                  endTime: v.endTime,
                }),
              { success: 'Completed dash logged' },
            );
            navigate('/', { replace: true });
          }}
        />
      </Card>
    </div>
  );
}

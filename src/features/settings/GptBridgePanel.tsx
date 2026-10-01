import { useEffect, useState } from 'react';
import { Button, Card, Notice } from '../../components/ui';
import { TextInput } from '../../components/forms';
import { useLedger, useLedgerContext } from '../../state/store';
import {
  applyGptProposal,
  disconnectGptBridge,
  fetchGptProposals,
  getGptBridgeConfig,
  pairGptBridge,
  rejectGptProposal,
  syncGptBridge,
  type GptBridgeConfig,
  type GptProposal,
} from '../../services/gptBridge';

function proposalSummary(proposal: GptProposal): string {
  if (proposal.kind === 'expense') {
    const dollars = (proposal.payload.amountCents / 100).toFixed(2);
    return '$' + dollars + ' ' + proposal.payload.category + ' expense on ' + proposal.payload.date;
  }

  const fields = Object.keys(proposal.payload.patch).join(', ');
  return 'Update dash ' + proposal.payload.shiftId + ': ' + (fields || 'no fields');
}

export function GptBridgePanel() {
  const snapshot = useLedger();
  const { mutate, pushToast } = useLedgerContext();
  const [config, setConfig] = useState<GptBridgeConfig | null>(null);
  const [proposals, setProposals] = useState<GptProposal[]>([]);
  const [endpoint, setEndpoint] = useState('');
  const [userId, setUserId] = useState('');
  const [loginSecret, setLoginSecret] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('Dash Ledger browser');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await getGptBridgeConfig();
    setConfig(next);
    if (!next) {
      setProposals([]);
      return;
    }
    try {
      setProposals(await fetchGptProposals());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const next = await pairGptBridge({
        endpoint,
        userId,
        loginSecret,
        deviceLabel,
      });
      setConfig(next);
      setLoginSecret('');
      setProposals([]);
      pushToast('GPT Bridge connected');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const result = await syncGptBridge(snapshot);
      await refresh();
      pushToast(
        result.unchanged
          ? 'GPT mirror already current'
          : 'GPT mirror synchronized',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function accept(proposal: GptProposal) {
    setBusy(true);
    setError(null);
    try {
      await mutate(() => applyGptProposal(proposal), {
        success: 'GPT proposal applied locally',
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(proposal: GptProposal) {
    setBusy(true);
    setError(null);
    try {
      await rejectGptProposal(proposal.id);
      await refresh();
      pushToast('GPT proposal rejected');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await disconnectGptBridge();
      setConfig(null);
      setProposals([]);
      pushToast('GPT Bridge disconnected; local ledger preserved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card label="GPT Bridge (optional)">
      {!config ? (
        <div className="stack">
          <p className="small muted">
            Connect Dash Ledger to a privately hosted MCP bridge. Nothing is
            shared until you connect and press Sync now.
          </p>
          <TextInput
            label="Bridge endpoint"
            value={endpoint}
            onChange={setEndpoint}
            placeholder="https://your-worker.workers.dev"
          />
          <TextInput
            label="User ID"
            value={userId}
            onChange={setUserId}
            placeholder="andrew"
          />
          <TextInput
            label="Login secret"
            value={loginSecret}
            onChange={setLoginSecret}
            type="password"
          />
          <TextInput
            label="This device"
            value={deviceLabel}
            onChange={setDeviceLabel}
          />
          <Button
            variant="primary"
            disabled={busy || !endpoint.trim() || !userId.trim() || !loginSecret}
            onClick={() => void connect()}
          >
            {busy ? 'Connecting…' : 'Connect GPT Bridge'}
          </Button>
          <Notice tone="info">
            Shared after manual sync: vehicles, shift dates/times/odometer
            readings/earnings/purpose, expense amounts/categories/tax classes,
            and mileage-rate tables. Receipt images, receipt metadata, historical
            merchant names, and freeform notes are not uploaded in the mirror.
            If GPT creates a proposal, fields you explicitly include in that
            proposal (such as a merchant name) remain in the proposal until it is
            accepted, rejected, expired, or the cloud copy is deleted.
          </Notice>
        </div>
      ) : (
        <div className="stack">
          <div>
            <strong>Connected as {config.displayLabel}</strong>
            <p className="small muted" style={{ marginTop: 4 }}>
              {config.endpoint}
              <br />
              Last synchronized:{' '}
              {config.lastSyncAt
                ? new Date(config.lastSyncAt).toLocaleString()
                : 'never'}
            </p>
          </div>

          <Button variant="primary" disabled={busy} onClick={() => void syncNow()}>
            {busy ? 'Working…' : 'Sync now'}
          </Button>

          <div>
            <strong>GPT proposals</strong>
            {proposals.length === 0 ? (
              <p className="small muted" style={{ marginTop: 5 }}>
                Nothing waiting for review.
              </p>
            ) : (
              <div className="stack" style={{ marginTop: 8 }}>
                {proposals.map((proposal) => (
                  <div className="review-row" key={proposal.id}>
                    <div>
                      <strong>{proposalSummary(proposal)}</strong>
                      <div className="small muted">
                        Queued {new Date(proposal.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button
                        disabled={busy}
                        onClick={() => void accept(proposal)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => void reject(proposal)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Notice tone="info">
            GPT writes are proposals only. Accepting one applies it through Dash
            Ledger's normal local repository rules; rejecting one changes
            nothing.
          </Notice>

          <Button variant="danger" disabled={busy} onClick={() => void disconnect()}>
            Disconnect &amp; delete GPT cloud copy
          </Button>
          <p className="small muted">
            Disconnecting removes the remote mirror, proposals, and bridge
            device credentials. It does not delete or alter your local ledger.
          </p>
        </div>
      )}

      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}

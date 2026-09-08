import { useRef, useState } from 'react';
import { useLedgerContext } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import { Button, Card, Notice } from '../../components/ui';
import { DateInput, MoneyInput, SelectInput, TextInput } from '../../components/forms';
import { createReceipt } from '../../db/repositories';
import { processReceiptImage } from '../../services/receiptImages';
import { ALL_CATEGORIES, taxClassForCategory } from '../../domain/expenses';
import { parseMoneyToCents } from '../../domain/money';
import { todayLocalDate } from '../../domain/dates';
import type { Receipt } from '../../domain/types';

export function CaptureReceiptScreen() {
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [addDetails, setAddDetails] = useState(false);
  const [date, setDate] = useState(todayLocalDate());
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingNote, setProcessingNote] = useState<string | null>(null);

  function onPick(f: File | null) {
    setError(null);
    setProcessingNote(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) {
      setError('Take a photo or choose an image first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const processed = await processReceiptImage(file);
      if (processed.error) setProcessingNote(processed.error);

      const hasDetails = addDetails && (merchant.trim() || amount.trim() || category);
      const cents = parseMoneyToCents(amount);
      const meta: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'> = {
        capturedAt: new Date().toISOString(),
        date: addDetails ? date : todayLocalDate(),
        merchant: merchant.trim(),
        amountCents: cents,
        category: category || null,
        taxClass: category ? taxClassForCategory(category) : null,
        notes: '',
        status: hasDetails && merchant.trim() && cents !== null && category ? 'Classified' : 'Inbox',
        expenseId: null,
        originalFilename: file.name || 'receipt.jpg',
        mimeType: processed.mimeType,
        byteCount: processed.byteCount,
        imageProcessingError: processed.error,
      };

      const receipt = await mutate(
        () =>
          createReceipt({
            meta,
            image: processed.image,
            thumbnail: processed.thumbnail,
            // Keep the untouched source so a storage failure cannot lose the photo.
            originalImage: file,
          }),
        { success: processed.error ? 'Receipt saved (image not optimised)' : 'Receipt saved' },
      );
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      navigate(`/receipts/${receipt.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Could not save the receipt.');
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <Link to="/receipts" className="back-link">
        <span aria-hidden>‹</span> Receipts
      </Link>
      <div className="screen-head">
        <div>
          <h1>Capture receipt</h1>
          <p>Capture now, add details later. The photo is saved to this device immediately.</p>
        </div>
      </div>

      <Card>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected receipt preview"
            style={{ width: '100%', borderRadius: 12, border: '1px solid var(--hairline)' }}
          />
        ) : (
          <div className="empty" style={{ paddingBlock: 24 }}>
            <div className="empty__icon" aria-hidden>
              ▣
            </div>
            <p className="small">No image chosen yet.</p>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={() => cameraRef.current?.click()}>
            📷 Take photo
          </Button>
          <Button onClick={() => fileRef.current?.click()}>Choose image</Button>
        </div>

        {processingNote && (
          <Notice tone="warn" title="Image optimisation">
            {processingNote} The receipt itself is preserved.
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </Card>

      <Card label="Details (optional)">
        <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={addDetails} onChange={(e) => setAddDetails(e.target.checked)} />
          <span>Add merchant / amount / category now</span>
        </label>
        {addDetails && (
          <>
            <DateInput label="Receipt date" value={date} onChange={setDate} />
            <TextInput label="Merchant" value={merchant} onChange={setMerchant} />
            <MoneyInput label="Amount" value={amount} onChange={setAmount} />
            <SelectInput
              label="Category"
              value={category}
              onChange={setCategory}
              options={[{ value: '', label: '— choose —' }, ...ALL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
            />
            <p className="small faint">
              A receipt is only marked Classified when it has a merchant, amount and category. Otherwise
              it goes to the Inbox.
            </p>
          </>
        )}
      </Card>

      <Button variant="primary" size="xl" block onClick={save} disabled={busy || !file}>
        {busy ? 'Saving…' : 'Save receipt'}
      </Button>
    </div>
  );
}

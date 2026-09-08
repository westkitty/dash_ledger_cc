/**
 * Receipt data survival.
 *
 * Optimisation is best effort. Storing its output is best effort too. A valid
 * original image is worth more than an optimised one, so no failure path is
 * allowed to end with the source bytes gone.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getDB } from '../db/db';
import { createReceipt, getReceiptBlob } from '../db/repositories';
import { processReceiptImage } from '../services/receiptImages';
import type { Receipt } from '../domain/types';

const ORIGINAL_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

function originalBlob(): Blob {
  return new Blob([ORIGINAL_BYTES], { type: 'image/png' });
}

function meta(over: Partial<Receipt> = {}): Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    capturedAt: '2026-09-08T12:00:00.000Z',
    date: '2026-09-08',
    merchant: '',
    amountCents: null,
    category: null,
    taxClass: null,
    notes: '',
    status: 'Inbox',
    expenseId: null,
    originalFilename: 'receipt.png',
    mimeType: 'image/png',
    byteCount: ORIGINAL_BYTES.length,
    imageProcessingError: null,
    ...over,
  };
}

async function readBack(id: string): Promise<Uint8Array> {
  const row = await getReceiptBlob(id);
  expect(row).toBeDefined();
  return new Uint8Array(await row!.image.arrayBuffer());
}

beforeEach(async () => {
  const db = getDB();
  if (!db.isOpen()) await db.open();
  await Promise.all([db.receipts.clear(), db.receiptBlobs.clear(), db.kv.clear()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('image processing failure', () => {
  it('keeps the original bytes when the image cannot be decoded', async () => {
    // No `createImageBitmap` in this environment, so processing is a no-op that
    // must hand back the source unchanged.
    const processed = await processReceiptImage(originalBlob());
    expect(processed.image.size).toBe(ORIGINAL_BYTES.length);

    const receipt = await createReceipt({
      meta: meta(),
      image: processed.image,
      thumbnail: processed.thumbnail,
      originalImage: originalBlob(),
    });

    expect(await readBack(receipt.id)).toEqual(ORIGINAL_BYTES);
  });

  it('still creates the receipt when a thumbnail could not be produced', async () => {
    const processed = await processReceiptImage(originalBlob());
    expect(processed.thumbnail).toBeNull();

    const receipt = await createReceipt({
      meta: meta(),
      image: processed.image,
      thumbnail: null,
      originalImage: originalBlob(),
    });

    expect(await getDB().receipts.get(receipt.id)).toBeDefined();
    expect(await readBack(receipt.id)).toEqual(ORIGINAL_BYTES);
  });
});

describe('storage failure', () => {
  it('retries with the original image when storing the optimised one fails', async () => {
    const optimised = new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' });
    const db = getDB();
    const realPut = db.receiptBlobs.put.bind(db.receiptBlobs);

    // Fail only the first blob write — the one carrying the optimised image.
    const spy = vi
      .spyOn(db.receiptBlobs, 'put')
      .mockImplementationOnce(() => Promise.reject(new Error('QuotaExceededError')) as never)
      .mockImplementation(realPut as never);

    const receipt = await createReceipt({
      meta: meta({ mimeType: 'image/jpeg', byteCount: 3 }),
      image: optimised,
      thumbnail: null,
      originalImage: originalBlob(),
    });

    expect(spy).toHaveBeenCalledTimes(2);
    // The receipt exists, and it holds the ORIGINAL bytes, not the optimised ones.
    expect(await getDB().receipts.get(receipt.id)).toBeDefined();
    expect(await readBack(receipt.id)).toEqual(ORIGINAL_BYTES);
    expect(receipt.mimeType).toBe('image/png');
    expect(receipt.byteCount).toBe(ORIGINAL_BYTES.length);
    expect(receipt.imageProcessingError).toMatch(/original photo was saved instead/);
  });

  it('surfaces the failure rather than inventing a receipt when there is no fallback', async () => {
    const db = getDB();
    vi.spyOn(db.receiptBlobs, 'put').mockImplementation(
      () => Promise.reject(new Error('QuotaExceededError')) as never,
    );

    await expect(
      createReceipt({
        meta: meta(),
        image: originalBlob(),
        thumbnail: null,
        // No distinct original to fall back to.
        originalImage: null,
      }),
    ).rejects.toThrow(/QuotaExceededError/);

    expect(await getDB().receipts.count()).toBe(0);
  });

  it('does not retry when the optimised image IS the original', async () => {
    const image = originalBlob();
    const db = getDB();
    const spy = vi
      .spyOn(db.receiptBlobs, 'put')
      .mockImplementation(() => Promise.reject(new Error('disk full')) as never);

    await expect(
      createReceipt({ meta: meta(), image, thumbnail: null, originalImage: image }),
    ).rejects.toThrow(/disk full/);

    // One attempt, not a pointless second one with identical bytes.
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

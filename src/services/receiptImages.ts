/**
 * Best-effort receipt image processing.
 *
 * Data preservation outranks optimisation: if decode/resize fails for any
 * reason, the original Blob is kept, the receipt is still created, and a
 * human-readable processing error is recorded.
 */

import { logDiagnostic } from './diagnosticsLog';

export const ARCHIVAL_MAX_EDGE = 2000;
export const ARCHIVAL_QUALITY = 0.82;
export const THUMB_MAX_EDGE = 360;
export const THUMB_QUALITY = 0.7;

export interface ProcessedImage {
  /** Archival full image. Falls back to the original Blob on failure. */
  image: Blob;
  /** Thumbnail Blob, or null when generation failed. */
  thumbnail: Blob | null;
  mimeType: string;
  byteCount: number;
  /** null when everything worked; otherwise a message safe to show the user. */
  error: string | null;
}

function canProcess(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof HTMLCanvasElement !== 'undefined'
  );
}

async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function scaledSize(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const scale = maxEdge / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

async function renderToBlob(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  const { w, h } = scaledSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
  if (!blob || blob.size === 0) return null;
  return blob;
}

export async function processReceiptImage(file: File | Blob): Promise<ProcessedImage> {
  const originalType = file.type || 'application/octet-stream';
  const fallback: ProcessedImage = {
    image: file,
    thumbnail: null,
    mimeType: originalType,
    byteCount: file.size,
    error: null,
  };

  if (!canProcess()) {
    return { ...fallback, error: null };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decode(file);
  } catch (err) {
    logDiagnostic('image', 'Receipt image could not be decoded; original preserved.', err);
    return {
      ...fallback,
      error: 'This image could not be opened for optimisation, so the original file was saved as-is.',
    };
  }

  let archival: Blob = file;
  let archivalError: string | null = null;
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest > ARCHIVAL_MAX_EDGE) {
      const resized = await renderToBlob(bitmap, ARCHIVAL_MAX_EDGE, ARCHIVAL_QUALITY);
      if (resized) archival = resized;
      else archivalError = 'Archival resize produced an empty image; original preserved.';
    }
  } catch (err) {
    logDiagnostic('image', 'Archival resize failed; original preserved.', err);
    archivalError = 'Archival optimisation failed; the original image was preserved.';
  }

  let thumbnail: Blob | null = null;
  let thumbError: string | null = null;
  try {
    thumbnail = await renderToBlob(bitmap, THUMB_MAX_EDGE, THUMB_QUALITY);
    if (!thumbnail) thumbError = 'Thumbnail generation returned nothing.';
  } catch (err) {
    logDiagnostic('image', 'Thumbnail generation failed; receipt kept without a thumbnail.', err);
    thumbError = 'Thumbnail generation failed; the receipt was kept without a thumbnail.';
  }

  bitmap.close?.();

  const error = archivalError ?? thumbError ?? null;
  return {
    image: archival,
    thumbnail,
    mimeType: archival === file ? originalType : 'image/jpeg',
    byteCount: archival.size,
    error,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  // Node fallback
  return Buffer.from(bytes).toString('base64');
}

/** Convert a Blob to a base64 data URL (used by backup + tax binder). Portable across browser + Node. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || 'application/octet-stream';
  return `data:${mime};base64,${bytesToBase64(buf)}`;
}

/** Convert a data URL back to a Blob (used by restore). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Malformed data URL');
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const data = match[3];
  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
}

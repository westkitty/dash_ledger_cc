/**
 * Export delivery: prefer Web Share with files when available, otherwise a plain
 * local download. Nothing is ever sent to a remote service.
 */

import { logDiagnostic } from './diagnosticsLog';

export function canShareFiles(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function'
    );
  } catch {
    return false;
  }
}

export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled';

export async function deliverFile(
  filename: string,
  content: string | Blob,
  mimeType: string,
): Promise<DeliveryResult> {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

  if (canShareFiles()) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (err) {
      // AbortError = user cancelled the share sheet; fall back to download.
      if ((err as Error)?.name === 'AbortError') {
        return 'cancelled';
      }
      logDiagnostic('info', 'Web Share failed; falling back to download.', err);
    }
  }

  downloadBlob(filename, blob);
  return 'downloaded';
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function timestampSlug(now: Date = new Date()): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}`;
}

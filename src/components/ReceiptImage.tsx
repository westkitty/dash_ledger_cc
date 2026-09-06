import { useEffect, useState } from 'react';
import { getReceiptBlob } from '../db/repositories';

type Which = 'thumbnail' | 'image';

/**
 * Resolve a receipt's stored Blob to an object URL and revoke it on unmount.
 * Thumbnails are used in lists so full-size images never load for scrolling.
 */
export function useReceiptObjectUrl(receiptId: string | null, which: Which): { url: string | null; loading: boolean; missing: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setMissing(false);
    setUrl(null);
    if (!receiptId) {
      setLoading(false);
      setMissing(true);
      return;
    }
    getReceiptBlob(receiptId)
      .then((row) => {
        if (revoked) return;
        const blob = which === 'thumbnail' ? row?.thumbnail ?? row?.image ?? null : row?.image ?? null;
        if (!blob) {
          setMissing(true);
          setLoading(false);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (revoked) return;
        setMissing(true);
        setLoading(false);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [receiptId, which]);

  return { url, loading, missing };
}

export function ReceiptThumb({ receiptId, alt }: { receiptId: string; alt: string }) {
  const { url, loading, missing } = useReceiptObjectUrl(receiptId, 'thumbnail');
  return (
    <span className="receipt-thumb" aria-hidden={loading}>
      {url ? (
        <img src={url} alt={alt} loading="lazy" />
      ) : (
        <span className="receipt-thumb__ph">{loading ? '…' : missing ? 'no image' : ''}</span>
      )}
    </span>
  );
}

export function ReceiptFullImage({ receiptId, alt }: { receiptId: string; alt: string }) {
  const { url, loading, missing } = useReceiptObjectUrl(receiptId, 'image');
  if (loading) return <div className="notice">Loading image…</div>;
  if (missing || !url)
    return <div className="notice notice--warn">Receipt image is unavailable on this device.</div>;
  return <img className="receipt-full" src={url} alt={alt} />;
}

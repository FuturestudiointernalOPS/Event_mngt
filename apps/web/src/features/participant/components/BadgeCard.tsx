import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** The participant's QR badge, drawn locally from their own code: no third-party QR service. */
export function BadgeCard({ payload, name, category, reference }: { payload: string; name: string; category: string | null; reference: string }): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [payload]);

  return (
    <div className="mx-auto w-full max-w-xs rounded-brand border border-brand-primary/20 bg-white p-5 text-center shadow-sm">
      {src ? <img src={src} alt={`QR ${reference}`} className="mx-auto h-64 w-64" /> : <div className="mx-auto h-64 w-64 animate-pulse bg-brand-surface" />}
      <p className="mt-3 text-lg font-semibold">{name}</p>
      {category ? <p className="text-sm text-brand-text/70">{category}</p> : null}
      <p className="mt-1 font-mono text-xs text-brand-text/70">{reference}</p>
    </div>
  );
}

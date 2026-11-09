import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** The QR badge, rendered locally from the signed code: no third-party QR service. */
export function BadgeCard({ code, name, category }: { code: string; name: string; category: string }): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(code, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="mx-auto w-full max-w-xs rounded-brand border border-brand-primary/20 bg-white p-5 text-center shadow-sm">
      {src ? <img src={src} alt={`QR badge, ${name}`} className="mx-auto h-64 w-64" /> : <div className="mx-auto h-64 w-64 animate-pulse bg-brand-surface" />}
      <p className="mt-3 text-lg font-semibold">{name}</p>
      <p className="text-sm text-brand-text/70">{category}</p>
    </div>
  );
}

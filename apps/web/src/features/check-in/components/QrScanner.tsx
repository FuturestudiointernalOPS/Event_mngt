import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

/**
 * Camera QR reader. Frames are decoded with jsQR at a few frames per second, which
 * runs on mid-range phones and works where the BarcodeDetector API does not exist.
 * A code is reported once, then ignored for `cooldownMs` so one badge is not scanned
 * a dozen times while it stays in view.
 */
export function QrScanner({
  onCode,
  active,
  cooldownMs = 2500,
}: {
  onCode: (code: string) => void;
  active: boolean;
  cooldownMs?: number;
}): JSX.Element {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const handler = useRef(onCode);
  const [problem, setProblem] = useState<string | null>(null);
  handler.current = onCode;

  useEffect(() => {
    if (!active) {
      return;
    }
    let stream: MediaStream | null = null;
    let timer = 0;
    let last = { code: '', at: 0 };
    let stopped = false;

    async function start(): Promise<void> {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped || !video.current) {
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        tick();
      } catch {
        setProblem('camera');
      }
    }

    function tick(): void {
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const context = c.getContext('2d', { willReadFrequently: true });
        if (context) {
          context.drawImage(v, 0, 0, c.width, c.height);
          const image = context.getImageData(0, 0, c.width, c.height);
          const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
          const now = Date.now();
          if (found?.data && (found.data !== last.code || now - last.at > cooldownMs)) {
            last = { code: found.data, at: now };
            handler.current(found.data);
          }
        }
      }
      timer = window.setTimeout(tick, 200);
    }

    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, cooldownMs]);

  if (problem) {
    return <p role="alert" className="rounded-brand bg-red-50 p-4 text-sm text-red-700">Camera unavailable. Use the manual search below.</p>;
  }

  return (
    <div className="relative overflow-hidden rounded-brand bg-black">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
      <canvas ref={canvas} className="hidden" />
    </div>
  );
}

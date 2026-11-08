import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  createScan,
  enqueueScan,
  listPendingScans,
  type QueuedScan,
} from '../offline/scan-queue';

/**
 * Mobile-first staff check-in. Scans are written to IndexedDB before any network call,
 * so a lost connection or a page reload never loses an attendance record.
 *
 * The server-side sync endpoint and QR verification arrive with Phase 5
 * (docs/10-roadmap-and-backlog.md, epic E6); until then the queue is visible and the
 * sync action is intentionally disabled rather than pretending to succeed.
 */
export default function CheckInPage(): JSX.Element {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const { t } = useI18n();
  const [scans, setScans] = useState<QueuedScan[]>([]);
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setScans(await listPendingScans(eventId));
      setError(null);
    } catch {
      setError(t('common.error'));
    }
  }, [eventId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOnline = (): void => setOnline(true);
    const handleOffline = (): void => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addScan = async (): Promise<void> => {
    await enqueueScan(createScan(eventId, `demo-${Date.now()}`));
    await refresh();
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold text-brand-text">{t('checkin.title')}</h1>
        <p className="mt-1 text-sm text-brand-text/70">{t('checkin.subtitle')}</p>
      </header>

      <p
        role="status"
        className={`rounded-brand px-3 py-2 text-sm font-medium ${
          online ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
        }`}
      >
        {online ? t('checkin.online') : t('checkin.offline')}
      </p>

      {error ? <ErrorState title={t('common.error')} message={error} /> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-text">
            {t('checkin.queue')} ({scans.length})
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void addScan()}>
              {t('checkin.addScan')}
            </Button>
            <Button size="sm" disabled title="Available once the Phase 5 sync endpoint lands">
              {t('checkin.sync')}
            </Button>
          </div>
        </div>

        {scans.length === 0 ? (
          <EmptyState title={t('checkin.empty')} />
        ) : (
          <ul className="divide-y divide-brand-primary/5 rounded-brand border border-brand-primary/10 bg-white">
            {scans.map((scan) => (
              <li key={scan.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono text-xs text-brand-text/70">
                  {scan.badgeToken}
                </span>
                <time className="text-xs text-brand-text/50" dateTime={scan.scannedAt}>
                  {new Date(scan.scannedAt).toLocaleTimeString()}
                </time>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-brand-text/50">
          Server-side verification, duplicate reconciliation and the sync endpoint are
          implemented in Phase 5 (epic E6). Scans remain queued on this device until then.
        </p>
      </section>
    </div>
  );
}

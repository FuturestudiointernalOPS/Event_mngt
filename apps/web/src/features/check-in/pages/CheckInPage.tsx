import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RegistrationSummary, SyncScanResult } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { useStatusLabel } from '@/lib/status';
import { ApiRequestError } from '@/services/api-client';
import { staffOpsApi } from '@/services/staff-ops.api';
import { QrScanner } from '../components/QrScanner';
import {
  createScan,
  enqueueScan,
  listPendingScans,
  markSynced,
  type QueuedScan,
} from '../offline/scan-queue';

interface Shown {
  tone: 'ok' | 'dup' | 'bad';
  title: string;
  detail: string;
}

/**
 * Mobile-first check-in.
 *
 * The badge token is opaque on purpose: it is hashed on the server and never distributed,
 * so the device cannot decide by itself whether a scan is valid. Every scan is written to
 * IndexedDB before any network attempt and the server is the only authority; the queue
 * therefore survives a reload, a lost connection or a closed browser.
 */
export default function CheckInPage(): JSX.Element {
  const { slug = '', eventId = '' } = useParams<{ slug: string; eventId: string }>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState<QueuedScan[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [scanning, setScanning] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<RegistrationSummary[]>([]);

  const refreshPending = useCallback(
    async () => setPending(await listPendingScans(eventId)),
    [eventId],
  );

  const showResult = useCallback(
    (result: SyncScanResult): void => {
      const name = result.participant?.displayName ?? '';
      const value: Shown =
        result.status === 'created'
          ? { tone: 'ok', title: t('checkin.welcome', { name }), detail: result.participant?.category ?? '' }
          : result.status === 'duplicate'
            ? { tone: 'dup', title: t('checkin.already', { name }), detail: '' }
            : { tone: 'bad', title: t('checkin.invalid'), detail: result.code ?? '' };
      setShown(value);
      navigator.vibrate?.(value.tone === 'ok' ? 60 : [80, 60, 80]);
    },
    [t],
  );

  const syncNow = useCallback(async () => {
    const queue = await listPendingScans(eventId);
    if (queue.length === 0 || !navigator.onLine) {
      return;
    }
    setSyncing(true);
    try {
      const response = await staffOpsApi.syncCheckIns(slug, eventId, {
        scans: queue.map((scan) => ({
          scanId: scan.id,
          badgeToken: scan.badgeToken,
          scannedAt: scan.scannedAt,
        })),
      });
      const last = response.results[response.results.length - 1];
      if (last) {
        showResult(last);
      }
      await markSynced(queue);
    } catch {
      /* stays queued; the next reconnect retries and the server de-duplicates */
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [eventId, slug, refreshPending, showResult]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const up = (): void => { setOnline(true); void syncNow(); };
    const down = (): void => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [syncNow]);

  async function handleCode(code: string): Promise<void> {
    await enqueueScan(createScan(eventId, code)); // durable first
    await refreshPending();
    setShown({ tone: 'ok', title: t('checkin.queued'), detail: '' });
    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function search(): Promise<void> {
    try {
      const result = await staffOpsApi.searchRegistrations(slug, eventId, query);
      setMatches(result.items);
    } catch (error) {
      setShown({
        tone: 'bad',
        title: error instanceof ApiRequestError ? error.message : t('common.error'),
        detail: '',
      });
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('checkin.title')}</h1>
        <Link to={`/workspace/${slug}/events/${eventId}/check-in`} className="text-sm underline">{t('common.back')}</Link>
      </div>

      <p role="status" className={cn('rounded-brand p-2 text-center text-sm font-medium', online ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>
        {online ? t('checkin.online') : t('checkin.offline')} · {pending.length}
      </p>

      <QrScanner active={scanning} onCode={(code) => void handleCode(code)} />
      <Button variant="secondary" className="w-full" onClick={() => setScanning(!scanning)}>
        {scanning ? t('checkin.pause') : t('checkin.resume')}
      </Button>

      {shown ? (
        <div
          role="status"
          aria-live="assertive"
          className={cn('rounded-brand p-5 text-center text-lg font-semibold', shown.tone === 'ok' && 'bg-green-600 text-white', shown.tone === 'dup' && 'bg-amber-500 text-white', shown.tone === 'bad' && 'bg-red-600 text-white')}
        >
          <p>{shown.title}</p>
          {shown.detail ? <p className="text-sm font-normal opacity-90">{shown.detail}</p> : null}
        </div>
      ) : null}

      <section className="rounded-brand border border-brand-primary/10 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('checkin.queue')} ({pending.length})</h2>
          <Button size="sm" variant="secondary" disabled={!online || syncing || pending.length === 0} onClick={() => void syncNow()}>
            {syncing ? t('common.saving') : t('checkin.sync')}
          </Button>
        </div>
        {pending.length === 0 ? <p className="mt-2 text-xs text-brand-text/70">{t('checkin.empty')}</p> : null}
      </section>

      <section className="rounded-brand border border-brand-primary/10 bg-white p-4">
        <h2 className="text-sm font-semibold">{t('checkin.manual')}</h2>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <Input aria-label={t('common.search')} placeholder={t('checkin.searchHint')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button type="submit" disabled={!online || query.trim().length < 2}>{t('common.search')}</Button>
        </form>
        <ul className="mt-3 divide-y divide-brand-primary/10">
          {matches.map((match) => (
            <li key={match.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {match.person.firstName} {match.person.lastName}
                <br />
                <span className="text-xs text-brand-text/70">{match.person.email}</span>
              </span>
              <span className="text-xs">{statusLabel(match.status)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

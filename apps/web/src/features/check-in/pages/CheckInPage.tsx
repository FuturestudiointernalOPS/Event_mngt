import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CheckInManifestEntry, ScanResult } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { ApiRequestError } from '@/services/api-client';
import { staffOpsApi } from '@/services/staff-ops.api';
import { QrScanner } from '../components/QrScanner';
import { loadManifest, saveManifest, sha256Hex } from '../offline/manifest-store';
import { createScan, enqueueScan, listPendingScans, markSynced, type QueuedScan } from '../offline/scan-queue';

interface Shown {
  tone: 'ok' | 'dup' | 'bad';
  title: string;
  detail: string;
}

/**
 * Mobile-first check-in. The scan is validated against the downloaded manifest first, so
 * it works with no connection; online, the server is the authority and de-duplicates.
 * Every scan is written to IndexedDB before any network call.
 */
export default function CheckInPage(): JSX.Element {
  const { slug = '', eventId = '' } = useParams<{ slug: string; eventId: string }>();
  const { t } = useI18n();
  const [online, setOnline] = useState(navigator.onLine);
  const [manifest, setManifest] = useState<CheckInManifestEntry[]>([]);
  const [pending, setPending] = useState<QueuedScan[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [scanning, setScanning] = useState(true);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{ registrationId: string; name: string; email: string; categoryName: string; checkedIn: boolean }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const seen = useRef(new Set<string>());

  const refreshPending = useCallback(async () => setPending(await listPendingScans(eventId)), [eventId]);

  const syncNow = useCallback(async () => {
    const queue = await listPendingScans(eventId);
    if (queue.length === 0 || !navigator.onLine) {
      return;
    }
    setSyncing(true);
    try {
      await staffOpsApi.sync(slug, eventId, queue.map((s) => ({ code: s.badgeToken, source: 'OFFLINE' as const, clientScanId: s.id, scannedAt: s.scannedAt })));
      await markSynced(queue);
    } catch {
      /* stays queued; the next reconnect retries (the server de-duplicates) */
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [eventId, slug, refreshPending]);

  // Download the manifest when online; fall back to the stored copy offline.
  useEffect(() => {
    void (async () => {
      try {
        const fresh = await staffOpsApi.manifest(slug, eventId);
        await saveManifest(eventId, fresh);
        setManifest(fresh);
      } catch {
        setManifest((await loadManifest(eventId))?.entries ?? []);
      }
      await refreshPending();
    })();
  }, [slug, eventId, refreshPending]);

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

  const show = (value: Shown): void => {
    setShown(value);
    navigator.vibrate?.(value.tone === 'ok' ? 60 : [80, 60, 80]);
  };

  const fromResult = (result: ScanResult): Shown => {
    const name = result.participant?.name ?? '';
    if (result.result === 'checked_in') return { tone: 'ok', title: t('checkin.welcome', { name }), detail: result.participant?.categoryName ?? '' };
    if (result.result === 'duplicate') return { tone: 'dup', title: t('checkin.already', { name }), detail: result.checkedInAt ? new Date(result.checkedInAt).toLocaleTimeString() : '' };
    if (result.result === 'not_confirmed') return { tone: 'bad', title: t('checkin.notConfirmed', { name }), detail: '' };
    return { tone: 'bad', title: t('checkin.invalid'), detail: '' };
  };

  async function handleCode(code: string): Promise<void> {
    const hash = await sha256Hex(code);
    const entry = manifest.find((m) => m.codeHash === hash);

    if (!entry) {
      // Not in the manifest: online the server may still know it (registered since the
      // download); offline it cannot be valid.
      if (navigator.onLine) {
        try {
          show(fromResult(await staffOpsApi.scan(slug, eventId, { code, source: 'ONLINE' })));
          return;
        } catch { /* fall through */ }
      }
      show({ tone: 'bad', title: t('checkin.invalid'), detail: '' });
      return;
    }

    if (entry.checkedIn || seen.current.has(entry.registrationId)) {
      show({ tone: 'dup', title: t('checkin.already', { name: entry.name }), detail: entry.categoryName });
      return;
    }
    seen.current.add(entry.registrationId);

    const scan = createScan(eventId, code);
    await enqueueScan(scan); // durable first
    show({ tone: 'ok', title: t('checkin.welcome', { name: entry.name }), detail: entry.categoryName });
    await refreshPending();
    if (navigator.onLine) {
      void syncNow();
    }
  }

  async function search(): Promise<void> {
    try {
      setMatches(await staffOpsApi.lookup(slug, eventId, query));
    } catch (error) {
      show({ tone: 'bad', title: error instanceof ApiRequestError ? error.message : t('common.error'), detail: '' });
    }
  }

  async function manual(registrationId: string): Promise<void> {
    try {
      show(fromResult(await staffOpsApi.scan(slug, eventId, { registrationId, source: 'MANUAL' })));
      await search();
    } catch (error) {
      show({ tone: 'bad', title: error instanceof ApiRequestError ? error.message : t('common.error'), detail: '' });
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('checkin.title')}</h1>
        <Link to={`/workspace/${slug}/events/${eventId}/check-in`} className="text-sm underline">{t('common.back')}</Link>
      </div>

      <p role="status" className={cn('rounded-brand p-2 text-center text-sm font-medium', online ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>
        {online ? t('checkin.online') : t('checkin.offline')} · {t('checkin.manifestSize', { count: manifest.length })}
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
          {matches.map((m) => (
            <li key={m.registrationId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{m.name}<br /><span className="text-xs text-brand-text/70">{m.email}</span></span>
              <Button size="sm" disabled={m.checkedIn} onClick={() => void manual(m.registrationId)}>
                {m.checkedIn ? t('checkin.checkedIn') : t('checkin.checkIn')}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

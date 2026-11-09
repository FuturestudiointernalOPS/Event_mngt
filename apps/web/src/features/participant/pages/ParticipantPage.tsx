import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatDateRange } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { participantApi, participantToken } from '@/services/participant.api';
import { BadgeCard } from '../components/BadgeCard';
import { ParticipantNetworking } from '../components/ParticipantNetworking';
import { ParticipantShowcase } from '../components/ParticipantShowcase';

type Tab = 'badge' | 'showcase' | 'networking';

/**
 * The participant space. It is opened from the e-mailed link: the credential is taken from
 * the URL once, kept for this tab only, and removed from the address bar so it is not left
 * in history or shared by copying the URL.
 */
export default function ParticipantPage(): JSX.Element {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('badge');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      participantToken.set(token);
      params.delete('token');
      setParams(params, { replace: true });
    }
    setReady(true);
  }, [params, setParams]);

  const [gone, setGone] = useState<'cancelled' | 'erased' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function download(): Promise<void> {
    try {
      const blob = new Blob([JSON.stringify(await participantApi.exportData(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'my-data.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setProblem(errorMessage(e, t('common.error'))); }
  }

  async function leave(kind: 'cancelled' | 'erased'): Promise<void> {
    if (!window.confirm(t(kind === 'cancelled' ? 'participant.cancelConfirm' : 'participant.eraseConfirm'))) return;
    try {
      await (kind === 'cancelled' ? participantApi.cancel() : participantApi.erase());
      participantToken.clear();
      setGone(kind);
    } catch (e) { setProblem(errorMessage(e, t('common.error'))); }
  }

  const me = useQuery({ queryKey: ['p-me'], queryFn: participantApi.me, enabled: ready, retry: false });

  if (gone) {
    return <div className="mx-auto max-w-md p-8"><p role="status" className="rounded-brand bg-brand-surface p-4 text-sm">{t(gone === 'cancelled' ? 'participant.cancelled' : 'participant.erased')}</p></div>;
  }
  if (!ready || me.isLoading) return <LoadingState label={t('common.loading')} />;
  if (me.isError || !me.data) {
    return <div className="mx-auto max-w-md p-8"><ErrorState title={t('participant.title')} message={t('participant.invalidLink')} /></div>;
  }
  const data = me.data;
  const confirmed = data.status === 'CONFIRMED';
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'badge', label: t('participant.badge'), show: true },
    { key: 'showcase', label: t('participant.showcase'), show: confirmed && data.modules.includes('showcase') },
    { key: 'networking', label: t('participant.networking'), show: confirmed && (data.modules.includes('meetings') || data.modules.includes('introductions')) },
  ];

  return (
    <ThemeProvider value={null}>
      <div className="min-h-screen bg-brand-background">
        <header className="border-b border-brand-primary/10 bg-brand-surface">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <h1 className="text-xl font-semibold">{data.event.name}</h1>
            <p className="text-xs text-brand-text/70">{formatDateRange(data.event.startsAt, data.event.endsAt, data.event.timeZone, locale)}</p>
            {data.event.venueName ? <p className="text-xs text-brand-text/70">{data.event.venueName}</p> : null}
          </div>
        </header>
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          <nav aria-label={t('participant.title')}>
            <ul className="flex gap-1 border-b border-brand-primary/10">
              {tabs.filter((x) => x.show).map((x) => (
                <li key={x.key}>
                  <button type="button" onClick={() => setTab(x.key)} aria-current={tab === x.key ? 'page' : undefined} className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === x.key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text/70')}>
                    {x.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {tab === 'badge' ? (
            confirmed && data.badgeCode ? (
              <>
                <BadgeCard code={data.badgeCode} name={`${data.firstName} ${data.lastName}`} category={data.categoryName} />
                {data.checkedIn ? <p role="status" className="text-center text-sm text-green-700">{t('participant.checkedIn')}</p> : <p className="text-center text-xs text-brand-text/70">{t('participant.showBadge')}</p>}
              </>
            ) : (
              <p role="status" className="rounded-brand bg-amber-50 p-4 text-sm">{t('participant.pending')}</p>
            )
          ) : null}
          {tab === 'showcase' ? <ParticipantShowcase /> : null}
          {tab === 'networking' ? <ParticipantNetworking me={data.registrationId} modules={data.modules} /> : null}
          <section aria-label={t('participant.myData')} className="space-y-2 border-t border-brand-primary/10 pt-5">
            <h2 className="text-sm font-semibold">{t('participant.myData')}</h2>
            {problem ? <p role="alert" className="text-sm text-red-600">{problem}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void download()}>{t('participant.download')}</Button>
              {!data.checkedIn ? <Button size="sm" variant="secondary" onClick={() => void leave('cancelled')}>{t('participant.cancelReg')}</Button> : null}
              <Button size="sm" variant="danger" onClick={() => void leave('erased')}>{t('participant.eraseMine')}</Button>
            </div>
          </section>
        </main>
      </div>
    </ThemeProvider>
  );
}

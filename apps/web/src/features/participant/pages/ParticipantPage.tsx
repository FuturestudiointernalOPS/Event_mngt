import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatDateRange } from '@/lib/date';
import { participantApi, participantCredential } from '@/services/participant.api';
import { BadgeCard } from '../components/BadgeCard';
import { IntroductionsSection } from '../components/IntroductionsSection';
import { MeetingsSection } from '../components/MeetingsSection';
import { MyDataSection } from '../components/MyDataSection';
import { ProfileSection } from '../components/ProfileSection';

type Tab = 'badge' | 'profile' | 'meetings' | 'introductions' | 'data';

/**
 * The registrant's own space, opened from the link in their badge e-mail. The credential is
 * taken from the URL once, kept for this tab only and removed from the address bar, so it is
 * not left in history or shared by copying the URL.
 */
export default function ParticipantPage(): JSX.Element {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('badge');
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState<'withdrawn' | 'erased' | null>(null);

  useEffect(() => {
    const credential = params.get('credential');
    if (credential) {
      participantCredential.set(credential);
      params.delete('credential');
      setParams(params, { replace: true });
    }
    setReady(true);
  }, [params, setParams]);

  const me = useQuery({ queryKey: ['p-me'], queryFn: participantApi.me, enabled: ready && gone === null, retry: false });

  if (gone) {
    participantCredential.clear();
    return <div className="mx-auto max-w-md p-8"><p role="status" className="rounded-brand bg-brand-surface p-4 text-sm">{t(gone === 'withdrawn' ? 'participant.withdrawn' : 'participant.erased')}</p></div>;
  }
  if (!ready || me.isLoading) return <LoadingState label={t('common.loading')} />;
  if (me.isError || !me.data) {
    return <div className="mx-auto max-w-md p-8"><ErrorState title={t('participant.title')} message={t('participant.invalidLink')} /></div>;
  }

  const data = me.data;
  const has = (module: string): boolean => data.modules.includes(module);
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'badge', label: t('participant.badge'), show: true },
    { key: 'profile', label: t('participant.profile'), show: has('showcase') },
    { key: 'meetings', label: t('meetings.title'), show: has('showcase') && has('meetings') },
    { key: 'introductions', label: t('intro.title'), show: has('showcase') && has('introductions') },
    { key: 'data', label: t('participant.myData'), show: true },
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
            <ul className="flex gap-1 overflow-x-auto border-b border-brand-primary/10">
              {tabs.filter((x) => x.show).map((x) => (
                <li key={x.key}>
                  <button type="button" onClick={() => setTab(x.key)} aria-current={tab === x.key ? 'page' : undefined} className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === x.key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text/70')}>
                    {x.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {tab === 'badge' ? (
            <>
              <BadgeCard payload={data.badge.qrPayload} name={`${data.person.firstName} ${data.person.lastName}`} category={data.category?.name ?? null} reference={data.badge.reference} />
              <p className="text-center text-xs text-brand-text/70" role="status">{data.checkedIn ? t('participant.checkedIn') : t('participant.showBadge')}</p>
            </>
          ) : null}
          {tab === 'profile' ? <ProfileSection /> : null}
          {tab === 'meetings' ? <MeetingsSection /> : null}
          {tab === 'introductions' ? <IntroductionsSection /> : null}
          {tab === 'data' ? <MyDataSection canWithdraw={!data.checkedIn} onGone={setGone} /> : null}
        </main>
      </div>
    </ThemeProvider>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import { eventsApi } from '@/services/events.api';
import { publicApi } from '@/services/public.api';

/** Approved listings only. Names and descriptions are shown; contact details never are. */
export default function PublicShowcasePage(): JSX.Element {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { t } = useI18n();
  const context = useQuery({ queryKey: queryKeys.publicEvent(eventSlug), queryFn: () => eventsApi.publicContext(eventSlug), retry: false });
  const showcase = useQuery({ queryKey: ['public-showcase', eventSlug], queryFn: () => publicApi.showcase(eventSlug), retry: false });

  if (context.isLoading || showcase.isLoading) return <LoadingState label={t('common.loading')} />;
  if (context.isError || showcase.isError || !context.data || !showcase.data) {
    return <div className="mx-auto max-w-lg p-8"><ErrorState title={t('notFound.title')} message={t('notFound.body')} /></div>;
  }
  const { organization, branding, event } = context.data;
  const { profiles, innovations } = showcase.data;

  return (
    <ThemeProvider value={{ organization, branding }}>
      <div className="min-h-screen bg-brand-background">
        <header className="border-b border-brand-primary/10 bg-brand-surface"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3"><BrandLogo /><Link className="text-sm underline" to={`/e/${eventSlug}`}>{event.name}</Link></div></header>
        <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
          <h1 className="text-2xl font-semibold">{t('showcase.public')}</h1>
          <section aria-labelledby="inn-h">
            <h2 id="inn-h" className="text-lg font-semibold">{t('showcase.innovations')}</h2>
            {innovations.length === 0 ? <EmptyState title={t('common.empty')} /> : (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {innovations.map((innovation) => (
                  <li key={innovation.title} className="rounded-brand border border-brand-primary/10 bg-white p-4">
                    <p className="font-medium">{innovation.title}</p>
                    <p className="text-xs text-brand-text/70">{innovation.category}</p>
                    <p className="mt-2 text-sm">{innovation.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="pro-h">
            <h2 id="pro-h" className="text-lg font-semibold">{t('showcase.profiles')}</h2>
            {profiles.length === 0 ? <EmptyState title={t('common.empty')} /> : (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {profiles.map((profile) => (
                  <li key={profile.displayName} className="rounded-brand border border-brand-primary/10 bg-white p-4">
                    <p className="font-medium">{profile.displayName}</p>
                    <p className="text-sm">{profile.headline}</p>
                    {profile.bio ? <p className="mt-1 text-xs text-brand-text/70">{profile.bio}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </ThemeProvider>
  );
}

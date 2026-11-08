import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import { eventsApi } from '@/services/events.api';

/**
 * Registration entry point. The dynamic form renderer driven by the event's category
 * and field configuration lands in Phase 4; this page establishes the route, branding
 * and public-data boundary.
 */
export default function EventRegistrationPage(): JSX.Element {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { t } = useI18n();

  const eventQuery = useQuery({
    queryKey: queryKeys.publicEvent(eventSlug),
    queryFn: () => eventsApi.publicContext(eventSlug),
    enabled: Boolean(eventSlug),
    retry: false,
  });

  if (eventQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorState title={t('notFound.title')} message={t('notFound.body')} />
      </div>
    );
  }

  const { event, organization, branding } = eventQuery.data;

  return (
    <ThemeProvider value={{ organization, branding }}>
      <div className="min-h-screen bg-brand-background">
        <header className="border-b border-brand-primary/10 bg-brand-surface">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <BrandLogo />
            <Link to={`/e/${event.slug}`} className="text-sm text-brand-primary underline">
              {t('public.details')}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-2xl font-semibold text-brand-text">{event.name}</h1>
          <p role="status" className="mt-4 text-sm text-brand-text/70">
            {t('common.empty')}
          </p>
          <p className="mt-2 text-xs text-brand-text/50">
            Registration categories and dynamic forms are implemented in Phase 4
            (docs/10-roadmap-and-backlog.md, epic E5).
          </p>
        </main>
      </div>
    </ThemeProvider>
  );
}

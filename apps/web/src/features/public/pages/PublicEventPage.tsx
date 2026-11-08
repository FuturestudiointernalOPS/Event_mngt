import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { formatDateRange } from '@/lib/date';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { eventsApi } from '@/services/events.api';

/**
 * Public event page. Branding is resolved from the event context, so the page is
 * fully white-labelled without a separate build.
 */
export default function PublicEventPage(): JSX.Element {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { t, locale } = useI18n();

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
        <ErrorState
          title={t('notFound.title')}
          message={
            eventQuery.error instanceof ApiRequestError
              ? eventQuery.error.message
              : t('notFound.body')
          }
        />
      </div>
    );
  }

  const { event, organization, branding } = eventQuery.data;

  return (
    <ThemeProvider value={{ organization, branding }}>
      <div className="min-h-screen bg-brand-background">
        <header className="border-b border-brand-primary/10 bg-brand-surface">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <BrandLogo />
            <Link to="/login" className="text-sm font-medium text-brand-primary underline">
              {t('auth.signIn')}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
            {t('public.organisedBy')} {organization.name}
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-brand-text">{event.name}</h1>

          <p className="mt-3 text-sm text-brand-text/80">
            {formatDateRange(event.startsAt, event.endsAt, event.timeZone, locale)}
          </p>

          {event.venueName ? (
            <p className="mt-1 text-sm text-brand-text/70">
              {event.venueName}
              {event.venueAddress ? ` — ${event.venueAddress}` : ''}
            </p>
          ) : null}

          {event.description ? (
            <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-brand-text/80">
              {event.description}
            </p>
          ) : null}

          <div className="mt-8">
            {event.visibility === 'PUBLIC' ? (
              <Link to={`/e/${event.slug}/register`}>
                <Button size="lg">{t('public.register')}</Button>
              </Link>
            ) : (
              <p className="text-sm text-brand-text/60">
                {t('public.details')} — {event.visibility.toLowerCase()}
              </p>
            )}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

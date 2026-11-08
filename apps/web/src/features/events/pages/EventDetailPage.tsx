import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { formatDateRange } from '@/lib/date';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { eventsApi } from '@/services/events.api';

export default function EventDetailPage(): JSX.Element {
  const { slug = '', eventId = '' } = useParams<{ slug: string; eventId: string }>();
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const eventQuery = useQuery({
    queryKey: queryKeys.event(slug, eventId),
    queryFn: () => eventsApi.detail(slug, eventId),
    enabled: Boolean(slug) && Boolean(eventId),
    retry: false,
  });

  const publishMutation = useMutation({
    mutationFn: () => eventsApi.publish(slug, eventId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.event(slug, eventId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(slug) });
    },
  });

  if (eventQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <ErrorState
        title={t('common.error')}
        message={
          eventQuery.error instanceof ApiRequestError
            ? eventQuery.error.message
            : t('common.error')
        }
        onRetry={() => void eventQuery.refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  const event = eventQuery.data;
  const isPublished = event.status === 'PUBLISHED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-text/50">
            {t('events.details.title')}
          </p>
          <h1 className="text-2xl font-semibold text-brand-text">{event.name}</h1>
          <p className="mt-1 text-sm text-brand-text/70">
            {formatDateRange(event.startsAt, event.endsAt, event.timeZone, locale)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-surface px-3 py-1 text-xs font-medium text-brand-text/70">
            {event.status}
          </span>

          {event.visibility === 'PUBLIC' ? (
            <Link to={`/e/${event.slug}`}>
              <Button variant="secondary" size="sm">
                {t('public.details')}
              </Button>
            </Link>
          ) : null}

          <Button
            size="sm"
            onClick={() => publishMutation.mutate()}
            disabled={isPublished || publishMutation.isPending}
          >
            {isPublished ? t('events.published') : t('events.publish')}
          </Button>
        </div>
      </div>

      {publishMutation.isError ? (
        <ErrorState
          title={t('common.error')}
          message={
            publishMutation.error instanceof ApiRequestError
              ? publishMutation.error.message
              : t('common.error')
          }
        />
      ) : null}

      <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-text">{t('events.modules')}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {event.enabledModules.map((moduleKey) => (
            <li
              key={moduleKey}
              className="rounded-full bg-brand-surface px-3 py-1 text-xs font-medium text-brand-text/80"
            >
              {moduleKey}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

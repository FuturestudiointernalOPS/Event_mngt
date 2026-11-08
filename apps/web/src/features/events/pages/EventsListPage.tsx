import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { eventsApi } from '@/services/events.api';

export default function EventsListPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();

  const eventsQuery = useQuery({
    queryKey: queryKeys.events(slug),
    queryFn: () => eventsApi.list(slug),
    enabled: Boolean(slug),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-text">{t('events.title')}</h1>
        <Link to={`/workspace/${slug}/events/new`}>
          <Button>{t('events.new')}</Button>
        </Link>
      </div>

      {eventsQuery.isLoading ? <LoadingState label={t('common.loading')} /> : null}

      {eventsQuery.isError ? (
        <ErrorState
          title={t('common.error')}
          message={
            eventsQuery.error instanceof ApiRequestError
              ? eventsQuery.error.message
              : t('common.error')
          }
          onRetry={() => void eventsQuery.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : null}

      {eventsQuery.data && eventsQuery.data.items.length === 0 ? (
        <EmptyState
          title={t('events.empty')}
          action={
            <Link to={`/workspace/${slug}/events/new`}>
              <Button size="sm">{t('events.new')}</Button>
            </Link>
          }
        />
      ) : null}

      {eventsQuery.data && eventsQuery.data.items.length > 0 ? (
        <div className="overflow-x-auto rounded-brand border border-brand-primary/10">
          <table className="min-w-full divide-y divide-brand-primary/10 text-sm">
            <thead className="bg-brand-surface text-left text-xs uppercase tracking-wide text-brand-text/60">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('events.name')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('events.status')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('events.visibility')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-primary/5 bg-white">
              {eventsQuery.data.items.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3">
                    <Link
                      to={`/workspace/${slug}/events/${event.id}`}
                      className="font-medium text-brand-primary underline"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-text/70">{event.status}</td>
                  <td className="px-4 py-3 text-brand-text/70">{event.visibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

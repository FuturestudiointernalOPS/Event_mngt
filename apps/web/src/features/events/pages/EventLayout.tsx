import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import type { EventDetail } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { useStatusLabel } from '@/lib/status';
import { eventsApi } from '@/services/events.api';
import { useSessionStore } from '@/stores/session.store';

export interface EventOutletContext {
  slug: string;
  eventId: string;
  event: EventDetail;
  can: (permission: string) => boolean;
}

/** Shell of one event: title, status and a tab per enabled area of work. */
export default function EventLayout(): JSX.Element {
  const { slug = '', eventId = '' } = useParams<{ slug: string; eventId: string }>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const permissions = useSessionStore(
    (state) => state.memberships.find((m) => m.organizationSlug === slug)?.permissions ?? [],
  );

  const eventQuery = useQuery({
    queryKey: queryKeys.event(slug, eventId),
    queryFn: () => eventsApi.detail(slug, eventId),
    retry: false,
  });

  if (eventQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }
  if (eventQuery.isError || !eventQuery.data) {
    return (
      <ErrorState
        title={t('common.error')}
        message={errorMessage(eventQuery.error, t('common.error'))}
        onRetry={() => void eventQuery.refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  const event = eventQuery.data;
  const has = (module: string): boolean => event.enabledModules.includes(module);
  const base = `/workspace/${slug}/events/${eventId}`;

  const tabs = [
    { to: base, label: t('event.tab.overview'), end: true, show: true },
    { to: `${base}/modules`, label: t('event.tab.modules'), show: true },
    { to: `${base}/registration`, label: t('event.tab.setup'), show: has('registration') },
    { to: `${base}/registrations`, label: t('event.tab.registrations'), show: has('registration') },
    { to: `${base}/showcase`, label: t('event.tab.showcase'), show: has('showcase') },
    { to: `${base}/networking`, label: t('event.tab.networking'), show: has('meetings') || has('introductions') },
    { to: `${base}/check-in`, label: t('event.tab.checkin'), show: has('checkin') },
    { to: `${base}/reports`, label: t('event.tab.reports'), show: true },
  ].filter((tab) => tab.show);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-brand-text">{event.name}</h1>
        <p className="mt-1 text-xs text-brand-text/70">{statusLabel(event.status)}</p>
      </div>

      <nav aria-label={event.name} className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-brand-primary/10">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-brand-text/70 hover:text-brand-text',
                  )
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet
        context={
          {
            slug,
            eventId,
            event,
            can: (permission: string) => permissions.includes(permission),
          } satisfies EventOutletContext
        }
      />
    </div>
  );
}

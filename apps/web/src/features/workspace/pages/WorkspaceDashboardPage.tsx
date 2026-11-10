import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { CAPABILITY_KEYS, type OrganizationReportEvent } from '@event-platform/shared';
import type { WorkspaceOutletContext } from '@/components/layout/WorkspaceShell';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Pill, Section, Stat } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { useStatusLabel } from '@/lib/status';
import { staffOpsApi } from '@/services/staff-ops.api';

/**
 * Organisation dashboard: the aggregate report across every event, plus the doors into
 * the sections the signed-in member is allowed to use.
 */
export default function WorkspaceDashboardPage(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const { context, can } = useOutletContext<WorkspaceOutletContext>();
  const slug = context.organization.slug;
  const report = useQuery({
    queryKey: ['organization-report', slug],
    queryFn: () => staffOpsApi.overview(slug),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{context.organization.name}</h1>
        <p className="mt-1 text-sm text-brand-text/70">{t('workspace.dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {can(CAPABILITY_KEYS.eventsView) ? (
          <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-text">{t('events.title')}</h2>
            <p className="mt-1 text-xs text-brand-text/60">{t('events.empty')}</p>
            <Link to={`/workspace/${slug}/events`} className="mt-4 inline-block">
              <Button size="sm" variant="secondary">
                {t('nav.events')}
              </Button>
            </Link>
          </section>
        ) : null}

        {can(CAPABILITY_KEYS.organizationManageBranding) ? (
          <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-text">
              {t('workspace.branding.title')}
            </h2>
            <p className="mt-1 text-xs text-brand-text/60">
              {t('workspace.branding.subtitle')}
            </p>
            <Link to={`/workspace/${slug}/settings/branding`} className="mt-4 inline-block">
              <Button size="sm" variant="secondary">
                {t('nav.branding')}
              </Button>
            </Link>
          </section>
        ) : null}

        {can(CAPABILITY_KEYS.organizationViewMembers) ? (
          <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-text">{t('access.title')}</h2>
            <p className="mt-1 text-xs text-brand-text/60">{t('access.subtitle')}</p>
            <Link to={`/workspace/${slug}/settings/access`} className="mt-4 inline-block">
              <Button size="sm" variant="secondary">
                {t('nav.access')}
              </Button>
            </Link>
          </section>
        ) : null}
      </div>

      {report.isLoading ? <LoadingState label={t('common.loading')} /> : null}
      {report.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t('nav.events')} value={report.data.totals.events} />
            <Stat label={t('events.published')} value={report.data.totals.publishedEvents} />
            <Stat
              label={t('reports.registrations')}
              value={report.data.totals.registrations.total}
            />
          </div>
          <Section
            title={t('dashboard.recent')}
            actions={
              <Link to={`/workspace/${slug}/events/new`}>
                <Button size="sm">{t('events.new')}</Button>
              </Link>
            }
          >
            {report.data.events.length === 0 ? (
              <EmptyState title={t('events.empty')} />
            ) : (
              <ul className="divide-y divide-brand-primary/10">
                {report.data.events.filter((event: OrganizationReportEvent) => event.parentEventId === null).map((event: OrganizationReportEvent) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-2 py-3 text-sm"
                  >
                    <Link
                      className="font-medium underline"
                      to={`/workspace/${slug}/events/${event.id}`}
                    >
                      {event.name}
                    </Link>
                    <span className="flex items-center gap-2">
                      <Pill>{statusLabel(event.status)}</Pill>
                      <span className="text-xs">{event.registrations.total}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import type { WorkspaceOutletContext } from '@/components/layout/WorkspaceShell';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Pill, Section, Stat } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { useStatusLabel } from '@/lib/status';
import { staffOpsApi } from '@/services/staff-ops.api';

/** Organisation dashboard: portfolio and aggregate totals across events. */
export default function WorkspaceDashboardPage(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const { context } = useOutletContext<WorkspaceOutletContext>();
  const slug = context.organization.slug;
  const overview = useQuery({ queryKey: ['overview', slug], queryFn: () => staffOpsApi.overview(slug), retry: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{context.organization.name}</h1>
        <p className="mt-1 text-sm text-brand-text/70">{t('workspace.dashboard.subtitle')}</p>
      </div>
      {overview.isLoading ? <LoadingState label={t('common.loading')} /> : null}
      {overview.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t('nav.events')} value={overview.data.events.total} />
            <Stat label={t('reports.registrations')} value={overview.data.registrations} />
            <Stat label={t('checkin.checkedIn')} value={overview.data.checkedIn} />
          </div>
          <Section title={t('dashboard.recent')} actions={<Link to={`/workspace/${slug}/events/new`}><Button size="sm">{t('events.new')}</Button></Link>}>
            {overview.data.recentEvents.length === 0 ? <EmptyState title={t('events.empty')} /> : (
              <ul className="divide-y divide-brand-primary/10">
                {overview.data.recentEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <Link className="font-medium underline" to={`/workspace/${slug}/events/${e.id}`}>{e.name}</Link>
                    <span className="flex items-center gap-2"><Pill>{statusLabel(e.status)}</Pill><span className="text-xs">{e.registrations}</span></span>
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

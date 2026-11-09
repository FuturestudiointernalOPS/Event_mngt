import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section, Stat } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { staffOpsApi } from '@/services/staff-ops.api';
import type { EventOutletContext } from '../pages/EventLayout';

/** Live attendance, with the entry point to the mobile scanner. */
export default function CheckInTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const stats = useQuery({ queryKey: ['checkin-stats', slug, eventId], queryFn: () => staffOpsApi.checkInStats(slug, eventId), refetchInterval: 15_000 });

  if (stats.isLoading || !stats.data) return <LoadingState label={t('common.loading')} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('checkin.confirmed')} value={stats.data.confirmed} />
        <Stat label={t('checkin.checkedIn')} value={stats.data.checkedIn} />
        <Stat label={t('reports.rate')} value={stats.data.confirmed ? `${Math.round((stats.data.checkedIn / stats.data.confirmed) * 100)}%` : '—'} />
      </div>
      <Section
        title={t('reports.byCategory')}
        actions={can('checkin:operate') ? <Link to={`/staff/${slug}/${eventId}/check-in`}><Button size="sm">{t('checkin.openScanner')}</Button></Link> : null}
      >
        <ul className="divide-y divide-brand-primary/10 text-sm">
          {stats.data.byCategory.map((c) => (
            <li key={c.categoryName} className="flex justify-between py-2"><span>{c.categoryName}</span><span>{c.checkedIn} / {c.confirmed}</span></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

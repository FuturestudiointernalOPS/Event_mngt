import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section, Stat } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { staffOpsApi } from '@/services/staff-ops.api';
import type { EventOutletContext } from '../pages/EventLayout';

/**
 * Live attendance, with the entry point to the mobile scanner.
 *
 * The check-in surface only reports a running total, so the confirmed count and the
 * per-category figures come from the event report instead. Both are read on the same
 * cadence, which keeps the two numbers consistent with each other.
 */
export default function CheckInTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const attendance = useQuery({
    queryKey: ['checkin-summary', slug, eventId],
    queryFn: () => staffOpsApi.checkInSummary(slug, eventId),
    refetchInterval: 15_000,
  });
  const report = useQuery({
    queryKey: ['report', slug, eventId],
    queryFn: () => staffOpsApi.report(slug, eventId),
    refetchInterval: 15_000,
  });

  if (attendance.isLoading || report.isLoading || !attendance.data || !report.data) {
    return <LoadingState label={t('common.loading')} />;
  }

  const confirmed = report.data.registrations.byStatus.APPROVED;
  const checkedIn = attendance.data.total;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('checkin.confirmed')} value={confirmed} />
        <Stat label={t('checkin.checkedIn')} value={checkedIn} />
        <Stat label={t('reports.rate')} value={confirmed ? `${Math.round((checkedIn / confirmed) * 100)}%` : '—'} />
      </div>
      <Section
        title={t('reports.byCategory')}
        actions={can('checkin:operate') ? <Link to={`/staff/${slug}/${eventId}/check-in`}><Button size="sm">{t('checkin.openScanner')}</Button></Link> : null}
      >
        <ul className="divide-y divide-brand-primary/10 text-sm">
          {report.data.registrations.byCategory.map((category) => (
            <li key={category.key} className="flex justify-between py-2">
              <span>{category.name}</span>
              <span>{category.count}{category.capacity === null ? '' : ` / ${category.capacity}`}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

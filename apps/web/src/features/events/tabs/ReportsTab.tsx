import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section, Stat } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { useStatusLabel } from '@/lib/status';
import { staffOpsApi } from '@/services/staff-ops.api';
import type { EventOutletContext } from '../pages/EventLayout';

function Bars({ rows }: { rows: { label: string; value: number }[] }): JSX.Element {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="text-sm">
          <div className="flex justify-between"><span>{row.label}</span><span>{row.value}</span></div>
          <div className="mt-1 h-2 rounded-full bg-brand-surface">
            <div className="h-2 rounded-full bg-brand-primary" style={{ width: `${(row.value / max) * 100}%` }} role="presentation" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Event dashboard: registrations, attendance, networking and edition comparison. */
export default function ReportsTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const [exportError, setExportError] = useState(false);

  const summary = useQuery({ queryKey: ['summary', slug, eventId], queryFn: () => staffOpsApi.summary(slug, eventId) });
  const editions = useQuery({ queryKey: ['editions', slug, eventId], queryFn: () => staffOpsApi.editions(slug, eventId) });
  const exporting = useMutation({
    mutationFn: () => staffOpsApi.downloadRegistrationsCsv(slug, eventId),
    onSuccess: () => setExportError(false),
    onError: () => setExportError(true),
  });

  if (summary.isLoading || !summary.data) return <LoadingState label={t('common.loading')} />;
  const s = summary.data;
  const toRows = (record: Record<string, number>) => Object.entries(record).map(([label, value]) => ({ label: statusLabel(label), value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={t('reports.registrations')} value={s.registrations.total} />
        <Stat label={t('checkin.checkedIn')} value={s.attendance.checkedIn} />
        <Stat label={t('reports.rate')} value={`${s.attendance.rate}%`} />
        <Stat label={t('meetings.title')} value={Object.values(s.meetings).reduce((a, b) => a + b, 0)} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title={t('reports.byStatus')}><Bars rows={toRows(s.registrations.byStatus)} /></Section>
        <Section title={t('reports.byCategory')}><Bars rows={s.registrations.byCategory.map((c) => ({ label: c.categoryName, value: c.count }))} /></Section>
        <Section title={t('reports.byDay')}><Bars rows={s.registrationsByDay.map((d) => ({ label: d.day, value: d.count }))} /></Section>
        <Section title={t('intro.queue')}><Bars rows={toRows(s.introductions)} /></Section>
      </div>

      {editions.data && editions.data.editions.length > 1 ? (
        <Section title={t('reports.editions')}>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-brand-text/70"><th>{t('events.name')}</th><th>{t('reports.registrations')}</th><th>{t('checkin.checkedIn')}</th></tr></thead>
            <tbody>
              {editions.data.editions.map((e) => (
                <tr key={e.eventId} className="border-t border-brand-primary/10"><td className="py-2">{e.name}</td><td>{e.registrations}</td><td>{e.checkedIn}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {can('report:export') ? (
        <Section title={t('reports.export')}>
          <Button variant="secondary" disabled={exporting.isPending} onClick={() => exporting.mutate()}>{t('reports.exportCsv')}</Button>
          {exportError ? <p role="alert" className="mt-2 text-sm text-red-600">{t('common.error')}</p> : null}
        </Section>
      ) : null}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section, Stat } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { staffOpsApi } from '@/services/staff-ops.api';
import type { EventOutletContext } from '../pages/EventLayout';

function Bars({ rows }: { rows: { label: string; value: number }[] }): JSX.Element {
  const max = Math.max(1, ...rows.map((row) => row.value));
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

/** Event dashboard: registrations, participants, showcase and edition comparison. */
export default function ReportsTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const report = useQuery({ queryKey: ['report', slug, eventId], queryFn: () => staffOpsApi.report(slug, eventId) });
  const editions = useQuery({ queryKey: ['editions', slug, eventId], queryFn: () => staffOpsApi.editions(slug, eventId) });
  const exports = useQuery({
    queryKey: ['exports', slug, eventId],
    queryFn: () => staffOpsApi.exports(slug, eventId),
    enabled: can('reports.export'),
    refetchInterval: 5_000,
  });

  const requestExport = useMutation({
    mutationFn: () => staffOpsApi.createExport(slug, eventId, { format: 'CSV', kind: 'REGISTRATIONS' }),
    onSuccess: () => {
      setFailure(null);
      void queryClient.invalidateQueries({ queryKey: ['exports', slug, eventId] });
    },
    onError: (error) => setFailure(errorMessage(error, t('common.error'))),
  });
  const download = useMutation({
    mutationFn: (exportId: string) => staffOpsApi.downloadExport(slug, exportId),
    onError: (error) => setFailure(errorMessage(error, t('common.error'))),
  });

  if (report.isLoading || !report.data) return <LoadingState label={t('common.loading')} />;
  const value = report.data;
  const byStatus = Object.entries(value.registrations.byStatus).map(([label, count]) => ({ label: statusLabel(label), value: count }));
  const bySource = Object.entries(value.registrations.bySource).map(([label, count]) => ({ label: statusLabel(label), value: count }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={t('reports.registrations')} value={value.registrations.total} />
        <Stat
          label={t('reports.approvalRate')}
          value={value.registrations.approvalRate === null ? '—' : `${Math.round(value.registrations.approvalRate * 100)}%`}
        />
        <Stat label={t('reports.participants')} value={value.participants.total} />
        <Stat label={t('checkin.checkedIn')} value={value.badges.issued} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title={t('reports.byStatus')}><Bars rows={byStatus} /></Section>
        <Section title={t('reports.byCategory')}><Bars rows={value.registrations.byCategory.map((category) => ({ label: category.name, value: category.count }))} /></Section>
        <Section title={t('reports.bySource')}><Bars rows={bySource} /></Section>
        <Section title={t('reports.byDay')}><Bars rows={value.timeline.map((point) => ({ label: point.date, value: point.count }))} /></Section>
      </div>

      {editions.data && editions.data.editions.length > 1 ? (
        <Section title={t('reports.editions')}>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-brand-text/70"><th>{t('events.name')}</th><th>{t('reports.registrations')}</th></tr></thead>
            <tbody>
              {editions.data.editions.map((entry) => (
                <tr key={entry.id} className="border-t border-brand-primary/10">
                  <td className="py-2">{entry.name}</td>
                  <td>{entry.registrations.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {can('reports.export') ? (
        <Section title={t('reports.export')}>
          <Button variant="secondary" disabled={requestExport.isPending} onClick={() => requestExport.mutate()}>
            {t('reports.exportCsv')}
          </Button>
          {failure ? <p role="alert" className="mt-2 text-sm text-red-600">{failure}</p> : null}
          {exports.data && exports.data.items.length === 0 ? (
            <div className="mt-3"><EmptyState title={t('common.empty')} /></div>
          ) : null}
          <ul className="mt-3 divide-y divide-brand-primary/10 text-sm">
            {exports.data?.items.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {entry.fileName} · {statusLabel(entry.status)}
                  {entry.truncated ? ` · ${t('reports.truncated')}` : ''}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={entry.status !== 'COMPLETED' || download.isPending}
                  onClick={() => download.mutate(entry.id)}
                >
                  {t('reports.download')}
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

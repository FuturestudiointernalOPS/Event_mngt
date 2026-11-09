import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { IntroductionView } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { staffOpsApi } from '@/services/staff-ops.api';
import { teamApi } from '@/services/team.api';
import type { EventOutletContext } from '../pages/EventLayout';

const NEXT: Record<string, string[]> = {
  SUBMITTED: ['IN_REVIEW', 'APPROVED', 'DECLINED'],
  IN_REVIEW: ['APPROVED', 'DECLINED'],
  APPROVED: ['INTRODUCED', 'CLOSED'],
  DECLINED: ['CLOSED'],
  INTRODUCED: ['CLOSED'],
  CLOSED: [],
};

/** Staff view of the introduction queue and of the meetings between participants. */
export default function NetworkingTab(): JSX.Element {
  const { slug, eventId, event, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, string>>({});
  const canManageIntro = can('introduction:manage');
  const canManageMeetings = can('meeting:manage');
  const hasIntro = event.enabledModules.includes('introductions');
  const hasMeetings = event.enabledModules.includes('meetings');

  const intros = useQuery({ queryKey: ['intros', slug, eventId, filter], queryFn: () => staffOpsApi.introductions(slug, eventId, filter || undefined), enabled: hasIntro });
  const meetings = useQuery({ queryKey: ['meetings', slug, eventId], queryFn: () => staffOpsApi.meetings(slug, eventId), enabled: hasMeetings });
  const members = useQuery({ queryKey: ['team', slug, 'members'], queryFn: () => teamApi.members(slug), enabled: hasIntro && canManageIntro });

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const reload = (): void => void queryClient.invalidateQueries({ queryKey: ['intros', slug, eventId] });

  const decide = useMutation({
    mutationFn: (input: { id: string; status: string; outcome?: string }) => staffOpsApi.decideIntroduction(slug, eventId, input.id, { status: input.status, outcome: input.outcome }),
    onSuccess: () => { setError(null); reload(); },
    onError,
  });
  const assign = useMutation({
    mutationFn: (input: { id: string; userId: string | null }) => staffOpsApi.assignIntroduction(slug, eventId, input.id, input.userId),
    onSuccess: reload,
    onError,
  });
  const confirm = useMutation({
    mutationFn: (id: string) => staffOpsApi.confirmMeeting(slug, eventId, id),
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['meetings', slug, eventId] }); },
    onError,
  });
  const finish = useMutation({
    mutationFn: (input: { id: string; status: 'COMPLETED' | 'CANCELLED' }) => staffOpsApi.meetingOutcome(slug, eventId, input.id, input.status, outcome[input.id]),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['meetings', slug, eventId] }),
    onError,
  });

  const introRow = (r: IntroductionView) => (
    <li key={r.id} className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-xl">
          <p className="text-sm font-medium">{r.requesterName} → {r.innovationTitle}</p>
          <p className="text-xs text-brand-text/70">{r.reason}</p>
          <p className="text-xs text-brand-text/70">{t('intro.offers')}: {r.helpOffered}</p>
        </div>
        <Pill>{statusLabel(r.status)}</Pill>
      </div>
      {canManageIntro ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={t('intro.assignee')} className="w-48" value={r.assignedToUserId ?? ''} onChange={(e) => assign.mutate({ id: r.id, userId: e.target.value || null })}>
            <option value="">{t('intro.unassigned')}</option>
            {members.data?.map((m) => <option key={m.userId} value={m.userId}>{m.displayName ?? m.email}</option>)}
          </Select>
          {NEXT[r.status].includes('INTRODUCED') ? (
            <Input aria-label={t('intro.outcome')} placeholder={t('intro.outcome')} className="w-56" value={outcome[r.id] ?? ''} onChange={(e) => setOutcome({ ...outcome, [r.id]: e.target.value })} />
          ) : null}
          {NEXT[r.status].map((next) => (
            <Button key={next} size="sm" variant={next === 'DECLINED' || next === 'CLOSED' ? 'secondary' : 'primary'} disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, status: next, outcome: outcome[r.id] })}>
              {statusLabel(next)}
            </Button>
          ))}
        </div>
      ) : null}
      {r.history.length > 0 ? (
        <p className="text-xs text-brand-text/70">{r.history.map((h) => statusLabel(h.toStatus)).join(' → ')}</p>
      ) : null}
    </li>
  );

  if (intros.isLoading || meetings.isLoading) return <LoadingState label={t('common.loading')} />;

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {hasIntro ? (
        <Section
          title={t('intro.queue')}
          actions={
            <Select aria-label={t('events.status')} className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {Object.keys(NEXT).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </Select>
          }
        >
          {intros.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
          <ul className="divide-y divide-brand-primary/10">{intros.data?.map(introRow)}</ul>
        </Section>
      ) : null}

      {hasMeetings ? (
        <Section title={t('meetings.title')}>
          {meetings.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
          <ul className="divide-y divide-brand-primary/10">
            {meetings.data?.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{m.proposerName} ↔ {m.inviteeName}</p>
                  <p className="text-xs text-brand-text/70">{m.message ?? ''} {m.outcome ? `· ${m.outcome}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill>{statusLabel(m.status)}</Pill>
                  {canManageMeetings && m.status === 'ACCEPTED' ? (
                    <Button size="sm" variant="secondary" onClick={() => confirm.mutate(m.id)}>{t('meetings.confirm')}</Button>
                  ) : null}
                  {canManageMeetings && ['ACCEPTED', 'CONFIRMED'].includes(m.status) ? (
                    <>
                      <Input aria-label={t('intro.outcome')} placeholder={t('intro.outcome')} className="w-44" value={outcome[m.id] ?? ''} onChange={(e) => setOutcome({ ...outcome, [m.id]: e.target.value })} />
                      <Button size="sm" onClick={() => finish.mutate({ id: m.id, status: 'COMPLETED' })}>{t('event.complete')}</Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

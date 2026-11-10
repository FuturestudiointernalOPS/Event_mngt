import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { IntroductionRequest, Meeting } from '@event-platform/shared';
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

/** Staff view of the introduction queue and of the meetings between participants. */
export default function NetworkingTab(): JSX.Element {
  const { slug, eventId, event, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [historyId, setHistoryId] = useState<string | null>(null);
  const canManageIntro = can('introduction:manage');
  const canManageMeetings = can('meeting:manage');
  const hasIntro = event.enabledModules.includes('introductions');
  const hasMeetings = event.enabledModules.includes('meetings');

  const intros = useQuery({
    queryKey: ['intros', slug, eventId],
    queryFn: () => staffOpsApi.introductions(slug, eventId),
    enabled: hasIntro,
  });
  const meetings = useQuery({
    queryKey: ['meetings', slug, eventId],
    queryFn: () => staffOpsApi.meetings(slug, eventId),
    enabled: hasMeetings,
  });
  const members = useQuery({
    queryKey: ['team', slug, 'members'],
    queryFn: () => teamApi.members(slug),
    enabled: hasIntro && canManageIntro,
  });
  const detail = useQuery({
    queryKey: ['introduction', slug, eventId, historyId],
    queryFn: () => staffOpsApi.introduction(slug, eventId, historyId ?? ''),
    enabled: historyId !== null,
  });

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const reloadIntros = (): void => void queryClient.invalidateQueries({ queryKey: ['intros', slug, eventId] });
  const reloadMeetings = (): void => void queryClient.invalidateQueries({ queryKey: ['meetings', slug, eventId] });

  const assign = useMutation({
    mutationFn: (input: { id: string; userId: string }) =>
      staffOpsApi.updateIntroduction(slug, eventId, input.id, { action: 'assign', assignedToUserId: input.userId }),
    onSuccess: () => { setError(null); reloadIntros(); },
    onError,
  });
  const decide = useMutation({
    mutationFn: (input: { id: string; outcome: 'CONNECTED' | 'FOLLOW_UP' | 'NO_MATCH' | 'DECLINED' }) =>
      staffOpsApi.updateIntroduction(
        slug,
        eventId,
        input.id,
        input.outcome === 'CONNECTED' || input.outcome === 'FOLLOW_UP'
          ? { action: 'introduce', outcome: input.outcome, notes: notes[input.id] }
          : { action: 'decline', outcome: input.outcome, notes: notes[input.id] },
      ),
    onSuccess: () => { setError(null); reloadIntros(); },
    onError,
  });
  const answerMeeting = useMutation({
    mutationFn: (input: { id: string; action: 'accept' | 'decline' | 'cancel' }) =>
      staffOpsApi.updateMeeting(slug, eventId, input.id, { action: input.action }),
    onSuccess: () => { setError(null); reloadMeetings(); },
    onError,
  });
  const completeMeeting = useMutation({
    mutationFn: (input: { id: string; outcome: 'MET' | 'NO_SHOW' | 'FOLLOW_UP' }) =>
      staffOpsApi.updateMeeting(slug, eventId, input.id, {
        action: 'complete',
        outcome: input.outcome,
        notes: notes[input.id],
      }),
    onSuccess: () => { setError(null); reloadMeetings(); },
    onError,
  });

  const introRow = (row: IntroductionRequest) => (
    <li key={row.id} className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-xl">
          <p className="text-sm font-medium">{row.requestingProfile.displayName}</p>
          <p className="text-xs text-brand-text/70">{row.reason}</p>
          <p className="text-xs text-brand-text/70">{t('intro.offers')}: {row.offeredHelp}</p>
          {row.outcome ? <p className="text-xs text-brand-text/70">{t('intro.outcome')}: {statusLabel(row.outcome)}</p> : null}
          <button
            type="button"
            className="mt-1 text-xs underline"
            onClick={() => setHistoryId(historyId === row.id ? null : row.id)}
          >
            {t('intro.history')}
          </button>
          {historyId === row.id && detail.data ? (
            <p className="mt-1 text-xs text-brand-text/70">
              {detail.data.history.map((entry) => statusLabel(entry.toStatus)).join(' → ')}
            </p>
          ) : null}
        </div>
        <Pill>{statusLabel(row.status)}</Pill>
      </div>
      {canManageIntro ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={t('intro.assignee')}
            className="w-48"
            value={row.assignedToUserId ?? ''}
            onChange={(e) => e.target.value && assign.mutate({ id: row.id, userId: e.target.value })}
          >
            <option value="">{t('intro.unassigned')}</option>
            {members.data?.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName ?? member.email}
              </option>
            ))}
          </Select>
          <Input
            aria-label={t('intro.outcome')}
            placeholder={t('intro.outcome')}
            className="w-56"
            value={notes[row.id] ?? ''}
            onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
          />
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, outcome: 'CONNECTED' })}>
            {statusLabel('INTRODUCED')}
          </Button>
          <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, outcome: 'NO_MATCH' })}>
            {statusLabel('DECLINED')}
          </Button>
        </div>
      ) : null}
    </li>
  );

  const meetingRow = (meeting: Meeting) => (
    <li key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div>
        <p className="text-sm font-medium">
          {meeting.proposer.displayName} ↔ {meeting.recipient.displayName}
        </p>
        <p className="text-xs text-brand-text/70">
          {meeting.note ?? ''} {meeting.outcome ? `· ${meeting.outcome}` : ''} {meeting.outcomeNotes ?? ''}
        </p>
        {meeting.requiresStaffConfirmation ? <Pill>{t('meetings.confirm')}</Pill> : null}
      </div>
      <div className="flex items-center gap-2">
        <Pill>{statusLabel(meeting.status)}</Pill>
        {canManageMeetings && meeting.status === 'PROPOSED' ? (
          <>
            <Button size="sm" onClick={() => answerMeeting.mutate({ id: meeting.id, action: 'accept' })}>
              {statusLabel('ACCEPTED')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => answerMeeting.mutate({ id: meeting.id, action: 'decline' })}>
              {statusLabel('DECLINED')}
            </Button>
          </>
        ) : null}
        {canManageMeetings && meeting.status === 'ACCEPTED' ? (
          <>
            <Select
              aria-label={t('intro.outcome')}
              className="w-32"
              value={notes[meeting.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [meeting.id]: e.target.value })}
            >
              <option value="">—</option>
              <option value="MET">{statusLabel('MET')}</option>
              <option value="NO_SHOW">{statusLabel('NO_SHOW')}</option>
              <option value="FOLLOW_UP">{statusLabel('FOLLOW_UP')}</option>
            </Select>
            <Button size="sm" onClick={() => completeMeeting.mutate({ id: meeting.id, outcome: 'MET' })}>
              {t('event.complete')}
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );

  if (intros.isLoading || meetings.isLoading) return <LoadingState label={t('common.loading')} />;

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {hasIntro ? (
        <Section title={t('intro.queue')}>
          {intros.data?.items.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
          <ul className="divide-y divide-brand-primary/10">{intros.data?.items.map(introRow)}</ul>
        </Section>
      ) : null}

      {hasMeetings ? (
        <Section title={t('meetings.title')}>
          {meetings.data?.items.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
          <ul className="divide-y divide-brand-primary/10">{meetings.data?.items.map(meetingRow)}</ul>
        </Section>
      ) : null}
    </div>
  );
}

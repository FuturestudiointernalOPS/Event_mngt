import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { participantApi } from '@/services/participant.api';

/** Directory, proposals and answers. When staff decide, the participant only sees the state. */
export function MeetingsSection(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const profile = useQuery({ queryKey: ['p-profile'], queryFn: participantApi.profile });
  const directory = useQuery({ queryKey: ['p-directory'], queryFn: participantApi.directory, retry: false });
  const meetings = useQuery({ queryKey: ['p-meetings'], queryFn: participantApi.meetings, retry: false });
  const ownId = profile.data?.id ?? null;

  const reload = (): void => { setError(null); void queryClient.invalidateQueries({ queryKey: ['p-meetings'] }); };
  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const propose = useMutation({ mutationFn: (recipientProfileId: string) => participantApi.propose({ recipientProfileId, note: note[recipientProfileId] || undefined }), onSuccess: reload, onError });
  const respond = useMutation({ mutationFn: (i: { id: string; action: 'accept' | 'decline' | 'cancel' }) => participantApi.respond(i.id, { action: i.action }), onSuccess: reload, onError });

  if (!ownId) return <p role="status" className="rounded-brand bg-amber-50 p-4 text-sm">{t('participant.needProfile')}</p>;

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Section title={t('meetings.mine')}>
        {meetings.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10">
          {meetings.data?.map((m) => {
            const incoming = m.recipient.id === ownId;
            const other = incoming ? m.proposer.displayName : m.recipient.displayName;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{other}{m.note ? ` — ${m.note}` : ''}</span>
                <span className="flex items-center gap-2">
                  <Pill>{statusLabel(m.status)}</Pill>
                  {incoming && m.status === 'PROPOSED' && !m.requiresStaffConfirmation ? (
                    <>
                      <Button size="sm" onClick={() => respond.mutate({ id: m.id, action: 'accept' })}>{t('meetings.accept')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: m.id, action: 'decline' })}>{t('meetings.decline')}</Button>
                    </>
                  ) : null}
                  {m.status === 'PROPOSED' && m.requiresStaffConfirmation ? <span className="text-xs text-brand-text/70">{t('meetings.staffDecides')}</span> : null}
                  {['PROPOSED', 'ACCEPTED'].includes(m.status) ? <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: m.id, action: 'cancel' })}>{t('event.cancel')}</Button> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title={t('meetings.directory')}>
        {directory.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10">
          {directory.data?.map((d) => (
            <li key={d.profileId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span><strong>{d.displayName}</strong>{d.headline ? ` — ${d.headline}` : ''}{d.company ? ` · ${d.company}` : ''}</span>
              <span className="flex gap-2">
                <Input aria-label={t('meetings.message')} placeholder={t('meetings.message')} className="w-48" value={note[d.profileId] ?? ''} onChange={(e) => setNote({ ...note, [d.profileId]: e.target.value })} />
                <Button size="sm" disabled={propose.isPending} onClick={() => propose.mutate(d.profileId)}>{t('meetings.propose')}</Button>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

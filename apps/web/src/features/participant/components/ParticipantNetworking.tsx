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

/** Directory, meeting proposals and introduction requests. */
export function ParticipantNetworking({ me, modules }: { me: string; modules: string[] }): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, { reason: string; help: string }>>({});
  const hasMeetings = modules.includes('meetings');
  const hasIntros = modules.includes('introductions');

  const directory = useQuery({ queryKey: ['p-directory'], queryFn: participantApi.directory, enabled: hasMeetings });
  const meetings = useQuery({ queryKey: ['p-meetings'], queryFn: participantApi.meetings, enabled: hasMeetings });
  const targets = useQuery({ queryKey: ['p-targets'], queryFn: participantApi.showcaseInnovations, enabled: hasIntros });
  const intros = useQuery({ queryKey: ['p-intros'], queryFn: participantApi.introductions, enabled: hasIntros });

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const reload = (key: string): void => { setError(null); void queryClient.invalidateQueries({ queryKey: [key] }); };

  const propose = useMutation({ mutationFn: (id: string) => participantApi.propose({ inviteeRegistrationId: id, message: message[id] || undefined }), onSuccess: () => reload('p-meetings'), onError });
  const respond = useMutation({ mutationFn: (i: { id: string; response: 'ACCEPT' | 'DECLINE' | 'CANCEL' }) => participantApi.respond(i.id, { response: i.response }), onSuccess: () => reload('p-meetings'), onError });
  const request = useMutation({ mutationFn: (id: string) => participantApi.requestIntroduction({ innovationId: id, reason: reason[id]?.reason ?? '', helpOffered: reason[id]?.help ?? '' }), onSuccess: () => reload('p-intros'), onError });

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {hasMeetings ? (
        <>
          <Section title={t('meetings.mine')}>
            {meetings.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
            <ul className="divide-y divide-brand-primary/10">
              {meetings.data?.map((m) => {
                const incoming = m.inviteeRegistrationId === me;
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span>{incoming ? m.proposerName : m.inviteeName}{m.message ? ` — ${m.message}` : ''}</span>
                    <span className="flex items-center gap-2">
                      <Pill>{statusLabel(m.status)}</Pill>
                      {incoming && m.status === 'PROPOSED' ? (
                        <>
                          <Button size="sm" onClick={() => respond.mutate({ id: m.id, response: 'ACCEPT' })}>{t('meetings.accept')}</Button>
                          <Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: m.id, response: 'DECLINE' })}>{t('meetings.decline')}</Button>
                        </>
                      ) : null}
                      {['PROPOSED', 'ACCEPTED'].includes(m.status) ? <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: m.id, response: 'CANCEL' })}>{t('event.cancel')}</Button> : null}
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
                <li key={d.registrationId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span><strong>{d.name}</strong> — {d.headline}</span>
                  <span className="flex gap-2">
                    <Input aria-label={t('meetings.message')} placeholder={t('meetings.message')} className="w-48" value={message[d.registrationId] ?? ''} onChange={(e) => setMessage({ ...message, [d.registrationId]: e.target.value })} />
                    <Button size="sm" disabled={propose.isPending} onClick={() => propose.mutate(d.registrationId)}>{t('meetings.propose')}</Button>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}

      {hasIntros ? (
        <>
          <Section title={t('intro.mine')}>
            {intros.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
            <ul className="divide-y divide-brand-primary/10 text-sm">
              {intros.data?.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2"><span>{i.innovationTitle}</span><Pill>{statusLabel(i.status)}</Pill></li>
              ))}
            </ul>
          </Section>
          <Section title={t('intro.request')}>
            <ul className="divide-y divide-brand-primary/10">
              {targets.data?.map((i) => (
                <li key={i.id} className="space-y-2 py-3 text-sm">
                  <p><strong>{i.title}</strong> — {i.ownerName}</p>
                  <div className="flex flex-wrap gap-2">
                    <Input aria-label={t('intro.reason')} placeholder={t('intro.reason')} className="min-w-56 flex-1" value={reason[i.id]?.reason ?? ''} onChange={(e) => setReason({ ...reason, [i.id]: { reason: e.target.value, help: reason[i.id]?.help ?? '' } })} />
                    <Input aria-label={t('intro.offers')} placeholder={t('intro.offers')} className="min-w-44 flex-1" value={reason[i.id]?.help ?? ''} onChange={(e) => setReason({ ...reason, [i.id]: { reason: reason[i.id]?.reason ?? '', help: e.target.value } })} />
                    <Button size="sm" disabled={request.isPending} onClick={() => request.mutate(i.id)}>{t('intro.send')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
    </div>
  );
}

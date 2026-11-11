import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { participantApi } from '@/services/participant.api';

/** Ask the organisers to introduce you to someone; staff run the queue. */
export function IntroductionsSection(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ reason: '', offeredHelp: '' });
  const profile = useQuery({ queryKey: ['p-profile'], queryFn: participantApi.profile });
  const requests = useQuery({ queryKey: ['p-intros'], queryFn: participantApi.introductions, retry: false });

  const request = useMutation({
    mutationFn: () => participantApi.requestIntroduction({ reason: form.reason || undefined, offeredHelp: form.offeredHelp || undefined }),
    onSuccess: () => { setError(null); setForm({ reason: '', offeredHelp: '' }); void queryClient.invalidateQueries({ queryKey: ['p-intros'] }); },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  if (!profile.data) return <p role="status" className="rounded-brand bg-amber-50 p-4 text-sm">{t('participant.needProfile')}</p>;

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Section title={t('intro.request')}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); request.mutate(); }}>
          <Field label={t('intro.reason')} htmlFor="i-reason"><Input id="i-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <Field label={t('intro.offers')} htmlFor="i-help"><Input id="i-help" value={form.offeredHelp} onChange={(e) => setForm({ ...form, offeredHelp: e.target.value })} /></Field>
          <Button type="submit" disabled={request.isPending}>{t('intro.send')}</Button>
        </form>
      </Section>
      <Section title={t('intro.mine')}>
        {requests.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10 text-sm">
          {requests.data?.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2"><span>{r.reason ?? t('intro.noReason')}</span><Pill>{statusLabel(r.status)}</Pill></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

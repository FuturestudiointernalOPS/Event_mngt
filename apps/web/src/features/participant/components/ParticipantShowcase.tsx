import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { participantApi } from '@/services/participant.api';

/** The participant's own listing and innovations; both wait for staff approval. */
export function ParticipantShowcase(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const profile = useQuery({ queryKey: ['p-profile'], queryFn: participantApi.profile });
  const innovations = useQuery({ queryKey: ['p-innovations'], queryFn: participantApi.innovations });
  const [form, setForm] = useState({ headline: '', bio: '', tags: '', isVisible: true });
  const [inn, setInn] = useState({ title: '', summary: '', sector: '', isVisible: true });

  useEffect(() => {
    if (profile.data) {
      setForm({ headline: profile.data.headline, bio: profile.data.bio ?? '', tags: profile.data.tags.join(', '), isVisible: profile.data.isVisible });
    }
  }, [profile.data]);

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const save = useMutation({
    mutationFn: () => participantApi.saveProfile({ headline: form.headline, bio: form.bio || undefined, tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean), isVisible: form.isVisible }),
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['p-profile'] }); },
    onError,
  });
  const add = useMutation({
    mutationFn: () => participantApi.addInnovation({ title: inn.title, summary: inn.summary, sector: inn.sector || undefined, tags: [], isVisible: inn.isVisible }),
    onSuccess: () => { setError(null); setInn({ title: '', summary: '', sector: '', isVisible: true }); void queryClient.invalidateQueries({ queryKey: ['p-innovations'] }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => participantApi.removeInnovation(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['p-innovations'] }),
    onError,
  });

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Section title={t('participant.profile')} actions={profile.data ? <Pill>{statusLabel(profile.data.status)}</Pill> : null}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label={t('participant.headline')} htmlFor="headline"><Input id="headline" required minLength={3} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></Field>
          <Field label={t('participant.bio')} htmlFor="bio"><textarea id="bio" rows={3} className="w-full rounded-brand border border-brand-primary/20 px-3 py-2 text-sm" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
          <Field label={t('participant.tags')} htmlFor="tags" hint={t('setup.optionsHint')}><Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} />{t('participant.visible')}</label>
          <Button type="submit" disabled={save.isPending}>{t('common.save')}</Button>
        </form>
      </Section>

      <Section title={t('showcase.innovations')}>
        <ul className="divide-y divide-brand-primary/10">
          {innovations.data?.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{i.title} <Pill>{statusLabel(i.status)}</Pill></span>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(i.id)}>{t('team.remove')}</Button>
            </li>
          ))}
        </ul>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <Field label={t('participant.innTitle')} htmlFor="i-title"><Input id="i-title" required minLength={3} value={inn.title} onChange={(e) => setInn({ ...inn, title: e.target.value })} /></Field>
          <Field label={t('participant.sector')} htmlFor="i-sector"><Input id="i-sector" value={inn.sector} onChange={(e) => setInn({ ...inn, sector: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label={t('participant.summary')} htmlFor="i-sum"><textarea id="i-sum" rows={3} required minLength={10} className="w-full rounded-brand border border-brand-primary/20 px-3 py-2 text-sm" value={inn.summary} onChange={(e) => setInn({ ...inn, summary: e.target.value })} /></Field></div>
          <Button type="submit" disabled={add.isPending}>{t('participant.addInnovation')}</Button>
        </form>
      </Section>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { participantApi } from '@/services/participant.api';

/** The participant's own presentation. Staff approve it before anyone else can see it. */
export function ProfileSection(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const profile = useQuery({ queryKey: ['p-profile'], queryFn: participantApi.profile, retry: false });
  const [form, setForm] = useState({ headline: '', bio: '', company: '', jobTitle: '', visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE' });

  useEffect(() => {
    if (profile.data) {
      setForm({
        headline: profile.data.headline ?? '',
        bio: profile.data.bio ?? '',
        company: profile.data.company ?? '',
        jobTitle: profile.data.jobTitle ?? '',
        visibility: profile.data.visibility,
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => participantApi.saveProfile({ ...form, submitForReview: true }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['p-profile'] });
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  if (profile.isLoading) return <LoadingState label={t('common.loading')} />;

  return (
    <Section title={t('participant.profile')} actions={profile.data ? <Pill>{statusLabel(profile.data.moderationStatus)}</Pill> : null}>
      {error ? <p role="alert" className="mb-3 rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <p className="mb-3 text-xs text-brand-text/70">{t('participant.profileHint')}</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="sm:col-span-2"><Field label={t('participant.headline')} htmlFor="p-headline"><Input id="p-headline" required value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></Field></div>
        <Field label={t('participant.company')} htmlFor="p-company"><Input id="p-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label={t('participant.jobTitle')} htmlFor="p-job"><Input id="p-job" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label={t('participant.bio')} htmlFor="p-bio"><textarea id="p-bio" rows={3} className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field></div>
        <Field label={t('participant.visibility')} htmlFor="p-vis">
          <Select id="p-vis" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC' })}>
            <option value="PUBLIC">{t('participant.public')}</option>
            <option value="PRIVATE">{t('participant.private')}</option>
          </Select>
        </Field>
        <div className="flex items-end"><Button type="submit" disabled={save.isPending}>{t('participant.submitProfile')}</Button></div>
      </form>
    </Section>
  );
}

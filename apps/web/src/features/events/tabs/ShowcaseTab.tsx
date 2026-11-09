import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Pill, Section } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { useStatusLabel } from '@/lib/status';
import { staffOpsApi } from '@/services/staff-ops.api';
import type { EventOutletContext } from '../pages/EventLayout';

/** Moderation queue: nothing is shown publicly until staff approve it. */
export default function ShowcaseTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const canModerate = can('profile:moderate');

  const profiles = useQuery({ queryKey: ['showcase-profiles', slug, eventId], queryFn: () => staffOpsApi.profiles(slug, eventId) });
  const innovations = useQuery({ queryKey: ['showcase-innovations', slug, eventId], queryFn: () => staffOpsApi.innovations(slug, eventId) });

  const moderate = useMutation({
    mutationFn: (input: { kind: 'profiles' | 'innovations'; id: string; decision: 'APPROVE' | 'REJECT' }) =>
      staffOpsApi.moderate(slug, eventId, input.kind, input.id, input.decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['showcase-profiles', slug, eventId] });
      void queryClient.invalidateQueries({ queryKey: ['showcase-innovations', slug, eventId] });
    },
  });

  if (profiles.isLoading || innovations.isLoading) return <LoadingState label={t('common.loading')} />;

  const row = (kind: 'profiles' | 'innovations', id: string, title: string, subtitle: string, status: string, visible: boolean) => (
    <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-brand-text/70">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Pill>{statusLabel(status)}</Pill>
        {!visible ? <Pill>{t('showcase.hidden')}</Pill> : null}
        {canModerate && status !== 'APPROVED' ? <Button size="sm" onClick={() => moderate.mutate({ kind, id, decision: 'APPROVE' })}>{t('showcase.approve')}</Button> : null}
        {canModerate && status !== 'REJECTED' ? <Button size="sm" variant="secondary" onClick={() => moderate.mutate({ kind, id, decision: 'REJECT' })}>{t('reg.reject')}</Button> : null}
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <Section title={t('showcase.profiles')}>
        {profiles.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10">
          {profiles.data?.map((p) => row('profiles', p.id, `${p.name} — ${p.headline}`, p.tags.join(', '), p.status, p.isVisible))}
        </ul>
      </Section>
      <Section title={t('showcase.innovations')}>
        {innovations.data?.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10">
          {innovations.data?.map((i) => row('innovations', i.id, `${i.title} (${i.ownerName})`, i.summary, i.status, i.isVisible))}
        </ul>
      </Section>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import type { Innovation, ParticipantProfile } from '@event-platform/shared';
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
  const canModerate = can('profiles.moderate');

  const profiles = useQuery({ queryKey: ['showcase-profiles', slug, eventId], queryFn: () => staffOpsApi.profiles(slug, eventId) });
  const innovations = useQuery({ queryKey: ['showcase-innovations', slug, eventId], queryFn: () => staffOpsApi.innovations(slug, eventId) });
  const organization = useQuery({
    queryKey: ['organization-profile', slug],
    queryFn: () => staffOpsApi.organizationProfile(slug),
  });

  const reload = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['showcase-profiles', slug, eventId] });
    void queryClient.invalidateQueries({ queryKey: ['showcase-innovations', slug, eventId] });
  };
  const moderateProfile = useMutation({
    mutationFn: (input: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      staffOpsApi.moderateProfile(slug, eventId, input.id, { decision: input.decision }),
    onSuccess: reload,
  });
  const moderateInnovation = useMutation({
    mutationFn: (input: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      staffOpsApi.moderateInnovation(slug, eventId, input.id, { decision: input.decision }),
    onSuccess: reload,
  });
  const moderateOrganization = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      staffOpsApi.moderateOrganizationProfile(slug, { decision }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['organization-profile', slug] }),
  });

  if (profiles.isLoading || innovations.isLoading) return <LoadingState label={t('common.loading')} />;

  const actions = (
    kind: 'profile' | 'innovation',
    id: string,
    status: string,
  ) => (
    <div className="flex items-center gap-2">
      <Pill>{statusLabel(status)}</Pill>
      {canModerate && status !== 'APPROVED' ? (
        <Button
          size="sm"
          onClick={() =>
            kind === 'profile'
              ? moderateProfile.mutate({ id, decision: 'APPROVED' })
              : moderateInnovation.mutate({ id, decision: 'APPROVED' })
          }
        >
          {t('showcase.approve')}
        </Button>
      ) : null}
      {canModerate && status !== 'REJECTED' ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            kind === 'profile'
              ? moderateProfile.mutate({ id, decision: 'REJECTED' })
              : moderateInnovation.mutate({ id, decision: 'REJECTED' })
          }
        >
          {t('reg.reject')}
        </Button>
      ) : null}
    </div>
  );

  const profileRow = (profile: ParticipantProfile) => (
    <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium">{profile.headline ?? profile.reference}</p>
        <p className="text-xs text-brand-text/70">
          {[profile.company, profile.jobTitle].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {profile.visibility === 'PRIVATE' ? <Pill>{t('showcase.hidden')}</Pill> : null}
        {actions('profile', profile.id, profile.moderationStatus)}
      </div>
    </li>
  );

  const innovationRow = (innovation: Innovation) => (
    <li key={innovation.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium">{innovation.title}</p>
        <p className="text-xs text-brand-text/70">{innovation.summary}</p>
      </div>
      <div className="flex items-center gap-2">
        {innovation.visibility === 'PRIVATE' ? <Pill>{t('showcase.hidden')}</Pill> : null}
        {actions('innovation', innovation.id, innovation.moderationStatus)}
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <Section title={t('showcase.profiles')}>
        {profiles.data?.items.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10">{profiles.data?.items.map(profileRow)}</ul>
      </Section>
      <Section title={t('showcase.innovations')}>
        {innovations.data?.items.length === 0 ? <EmptyState title={t('common.empty')} /> : null}
        <ul className="divide-y divide-brand-primary/10">{innovations.data?.items.map(innovationRow)}</ul>
      </Section>
      {organization.data ? (
        <Section title={t('showcase.organization')}>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0 max-w-xl">
              <p className="text-sm font-medium">{organization.data.name}</p>
              <p className="text-xs text-brand-text/70">{organization.data.sector ?? organization.data.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {organization.data.visibility === 'PRIVATE' ? <Pill>{t('showcase.hidden')}</Pill> : null}
              <Pill>{statusLabel(organization.data.moderationStatus)}</Pill>
              {canModerate && organization.data.moderationStatus !== 'APPROVED' ? (
                <Button size="sm" onClick={() => moderateOrganization.mutate('APPROVED')}>
                  {t('showcase.approve')}
                </Button>
              ) : null}
              {canModerate && organization.data.moderationStatus !== 'REJECTED' ? (
                <Button size="sm" variant="secondary" onClick={() => moderateOrganization.mutate('REJECTED')}>
                  {t('reg.reject')}
                </Button>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

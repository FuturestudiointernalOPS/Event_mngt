import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CAPABILITY_KEYS, type CapabilityAssignmentView } from '@event-platform/shared';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { LoadingState, ErrorState } from '@/components/ui/states';
import type { WorkspaceOutletContext } from '@/components/layout/WorkspaceShell';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { capabilitiesApi } from '../capabilities.api';
import { CapabilityToggleList } from '../components/CapabilityToggleList';

/**
 * The member permission screen.
 *
 * It shows the organisation entitlement beside the member's effective set, so an
 * administrator can tell "the plan does not include this" apart from "this person was
 * not granted it". Direct grants are editable only for a manager who holds
 * `organization.manage_permissions`; role inheritance is read-only here.
 */
export default function AccessSettingsPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const { can } = useOutletContext<WorkspaceOutletContext>();
  const queryClient = useQueryClient();
  const canManage = can(CAPABILITY_KEYS.organizationManagePermissions);
  const [memberId, setMemberId] = useState<string>('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const organizationQuery = useQuery({
    queryKey: queryKeys.organizationCapabilities(slug),
    queryFn: () => capabilitiesApi.organization(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.members(slug),
    queryFn: () => capabilitiesApi.members(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  useEffect(() => {
    if (!memberId && membersQuery.data && membersQuery.data.length > 0) {
      setMemberId(membersQuery.data[0].id);
    }
  }, [memberId, membersQuery.data]);

  const memberQuery = useQuery({
    queryKey: queryKeys.memberCapabilities(slug, memberId),
    queryFn: () => capabilitiesApi.member(slug, memberId),
    enabled: Boolean(slug) && Boolean(memberId),
    retry: false,
  });

  const changeMutation = useMutation({
    mutationFn: (capability: CapabilityAssignmentView) =>
      capability.directGranted
        ? capabilitiesApi.revokeMember(slug, memberId, capability.key)
        : capabilitiesApi.grantMember(slug, memberId, capability.key),
    onMutate: (capability) => setPendingKey(capability.key),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.memberCapabilities(slug, memberId), view);
      void queryClient.invalidateQueries({ queryKey: queryKeys.selfCapabilities(slug) });
      setPendingKey(null);
    },
    onError: () => setPendingKey(null),
  });

  const entitlement = useMemo(() => {
    const capabilities = organizationQuery.data?.capabilities ?? [];
    return {
      granted: capabilities.filter((entry) => entry.organizationEntitled).length,
      total: capabilities.length,
    };
  }, [organizationQuery.data]);

  if (!slug) {
    return <ErrorState message={t('common.error')} />;
  }

  if (organizationQuery.isLoading || membersQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (organizationQuery.isError || membersQuery.isError) {
    const error = organizationQuery.error ?? membersQuery.error;
    return (
      <ErrorState
        title={t('common.error')}
        message={error instanceof ApiRequestError ? error.message : t('common.error')}
        onRetry={() => {
          void organizationQuery.refetch();
          void membersQuery.refetch();
        }}
        retryLabel={t('common.retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-brand-text">{t('access.title')}</h1>
        <p className="mt-1 text-sm text-brand-text/70">{t('access.subtitle')}</p>
      </header>

      <section className="rounded-brand border border-brand-primary/10 bg-brand-surface p-4 text-sm text-brand-text/80">
        {t('access.entitlement', {
          granted: entitlement.granted,
          total: entitlement.total,
        })}
        {!canManage ? (
          <p className="mt-1 text-xs text-amber-800">{t('access.readOnly')}</p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="member" className="text-sm font-medium text-brand-text">
          {t('access.member')}
        </label>
        <select
          id="member"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className="rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
        >
          {(membersQuery.data ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName ?? member.email} — {member.roleName}
            </option>
          ))}
        </select>
      </div>

      {memberQuery.isLoading ? <LoadingState label={t('common.loading')} /> : null}

      {memberQuery.isError ? (
        <ErrorState
          title={t('common.error')}
          message={
            memberQuery.error instanceof ApiRequestError
              ? memberQuery.error.message
              : t('common.error')
          }
          onRetry={() => void memberQuery.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : null}

      {changeMutation.isError ? (
        <ErrorState
          title={t('common.error')}
          message={
            changeMutation.error instanceof ApiRequestError
              ? changeMutation.error.message
              : t('common.error')
          }
        />
      ) : null}

      {memberQuery.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Summary label={t('access.role')} value={memberQuery.data.member.roleName} />
            <Summary
              label={t('access.effective')}
              value={String(memberQuery.data.effectiveCapabilities.length)}
            />
            <Summary
              label={t('access.direct')}
              value={String(memberQuery.data.directCapabilities.length)}
            />
          </section>

          <CapabilityToggleList
            capabilities={memberQuery.data.capabilities}
            canManage={canManage}
            pendingKey={pendingKey}
            onToggle={(capability) => changeMutation.mutate(capability)}
          />
        </>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-brand border border-brand-primary/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-brand-text/50">{label}</p>
      <p className="mt-1 text-lg font-semibold text-brand-text">{value}</p>
    </div>
  );
}

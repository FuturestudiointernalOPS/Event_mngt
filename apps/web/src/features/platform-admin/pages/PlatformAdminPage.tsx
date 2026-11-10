import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CAPABILITY_MODULES,
  type CapabilityAssignmentView,
  type PlatformOrganizationSummary,
} from '@event-platform/shared';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { ErrorState, LoadingState, ForbiddenState } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { capabilitiesApi } from '@/features/capabilities/capabilities.api';
import { useSessionStore } from '@/stores/session.store';

/**
 * Platform administration. A platform administrator chooses an organisation and
 * manages its entitlement set. Every call is independently authorised by the API; this
 * screen simply makes the catalogue usable.
 */
export default function PlatformAdminPage(): JSX.Element {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const [organizationId, setOrganizationId] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: queryKeys.platformOrganizations(),
    queryFn: () => capabilitiesApi.organizations(),
    enabled: user?.isPlatformAdmin === true,
    retry: false,
  });

  useEffect(() => {
    if (!organizationId && organizationsQuery.data && organizationsQuery.data.length > 0) {
      setOrganizationId(organizationsQuery.data[0].id);
    }
  }, [organizationId, organizationsQuery.data]);

  const entitlementsQuery = useQuery({
    queryKey: queryKeys.platformOrganizationCapabilities(organizationId),
    queryFn: () => capabilitiesApi.organizationEntitlements(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });

  const changeMutation = useMutation({
    mutationFn: (capability: CapabilityAssignmentView) =>
      capability.organizationEntitled
        ? capabilitiesApi.revokeOrganization(organizationId, capability.key)
        : capabilitiesApi.grantOrganization(organizationId, capability.key),
    onMutate: (capability) => setPendingKey(capability.key),
    onSuccess: (view) => {
      queryClient.setQueryData(
        queryKeys.platformOrganizationCapabilities(organizationId),
        view,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganizations() });
      setPendingKey(null);
    },
    onError: () => setPendingKey(null),
  });

  if (!user) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (user.isPlatformAdmin !== true) {
    return <ForbiddenState title={t('platform.forbidden')} message={t('platform.forbiddenBody')} />;
  }

  if (organizationsQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (organizationsQuery.isError) {
    return (
      <ErrorState
        title={t('common.error')}
        message={
          organizationsQuery.error instanceof ApiRequestError
            ? organizationsQuery.error.message
            : t('common.error')
        }
        onRetry={() => void organizationsQuery.refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  const organizations: PlatformOrganizationSummary[] = organizationsQuery.data ?? [];
  const entitlements = entitlementsQuery.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-brand-text">{t('platform.title')}</h1>
        <p className="mt-1 text-sm text-brand-text/70">{t('platform.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="organization" className="text-sm font-medium text-brand-text">
          {t('platform.organization')}
        </label>
        <select
          id="organization"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name} ({organization.status}) — {organization.capabilityCount}
            </option>
          ))}
        </select>
      </div>

      {entitlementsQuery.isLoading ? <LoadingState label={t('common.loading')} /> : null}

      {entitlementsQuery.isError ? (
        <ErrorState
          title={t('common.error')}
          message={
            entitlementsQuery.error instanceof ApiRequestError
              ? entitlementsQuery.error.message
              : t('common.error')
          }
          onRetry={() => void entitlementsQuery.refetch()}
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

      {entitlements ? (
        <>
          <p className="rounded-brand bg-brand-surface p-4 text-sm text-brand-text/80">
            {t('platform.entitlement', {
              organization: entitlements.organization.name,
              granted: entitlements.capabilities.filter((entry) => entry.organizationEntitled)
                .length,
              total: entitlements.capabilities.length,
            })}
          </p>

          <div className="space-y-5">
            {CAPABILITY_MODULES.map((module) => {
              const items = entitlements.capabilities.filter(
                (entry) => entry.module === module.key,
              );

              if (items.length === 0) {
                return null;
              }

              return (
                <section
                  key={module.key}
                  className="rounded-brand border border-brand-primary/10 bg-white"
                >
                  <header className="border-b border-brand-primary/10 px-5 py-3">
                    <h2 className="text-sm font-semibold text-brand-text">{module.name}</h2>
                    <p className="mt-0.5 text-xs text-brand-text/60">{module.description}</p>
                  </header>

                  <ul className="divide-y divide-brand-primary/5">
                    {items.map((capability) => (
                      <li
                        key={capability.key}
                        className="flex items-start justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-brand-text">
                              {capability.name}
                            </span>
                            {capability.sensitive ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                {t('capabilities.sensitive')}
                              </span>
                            ) : null}
                            {capability.destructive ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                                {t('capabilities.destructive')}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-brand-text/60">
                            {capability.description}
                          </p>
                          {capability.organizationEntitled &&
                          capability.missingDependencies.length > 0 ? (
                            <p className="mt-1 text-[11px] text-amber-800">
                              {t('capabilities.missingDependencies', {
                                dependencies: capability.missingDependencies.join(', '),
                              })}
                            </p>
                          ) : null}
                        </div>

                        <label className="flex shrink-0 items-center gap-2 text-xs text-brand-text/70">
                          <input
                            type="checkbox"
                            checked={capability.organizationEntitled}
                            disabled={pendingKey === capability.key}
                            onChange={() => changeMutation.mutate(capability)}
                            aria-label={`Assign ${capability.name}`}
                            className="h-4 w-4 rounded border-brand-primary/30"
                          />
                          {t('platform.enabled')}
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

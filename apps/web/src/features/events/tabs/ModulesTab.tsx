import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Section, Pill } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { eventAdminApi } from '@/services/event-admin.api';
import type { EventOutletContext } from '../pages/EventLayout';

/**
 * The controlled module catalogue: dependencies explained, activation validated by the
 * API. The registry supplies the wording; the event supplies which modules are on.
 */
export default function ModulesTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const canManage = can('events.manage_modules');

  const catalogue = useQuery({
    queryKey: ['module-catalogue'],
    queryFn: () => eventAdminApi.moduleCatalogue(),
    staleTime: Infinity,
  });
  const modules = useQuery({
    queryKey: ['modules', slug, eventId],
    queryFn: () => eventAdminApi.modules(slug, eventId),
  });

  const toggle = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) =>
      eventAdminApi.setModules(slug, eventId, { modules: [input] }),
    onSuccess: (data) => {
      queryClient.setQueryData(['modules', slug, eventId], data);
      // The event's enabled-module list drives which tabs exist.
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(slug, eventId) });
      setError(null);
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  if (catalogue.isLoading || modules.isLoading) return <LoadingState label={t('common.loading')} />;
  if (catalogue.isError || modules.isError || !catalogue.data || !modules.data) {
    return <ErrorState message={t('common.error')} onRetry={() => void modules.refetch()} retryLabel={t('common.retry')} />;
  }

  const enabled = new Set(modules.data.filter((module) => module.enabled).map((module) => module.key));

  return (
    <Section title={t('events.modules')}>
      {error ? <p role="alert" className="mb-3 rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-brand-primary/10">
        {catalogue.data.map((entry) => {
          const isOn = enabled.has(entry.key) || entry.key === 'core';
          return (
            <li key={entry.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 max-w-xl">
                <p className="text-sm font-medium">
                  {entry.name} <Pill>{entry.priority.toUpperCase()}</Pill>
                </p>
                <p className="text-xs text-brand-text/70">{entry.summary}</p>
                {entry.dependsOn.length > 0 ? (
                  <p className="mt-1 text-xs text-brand-text/70">{t('event.requires')}: {entry.dependsOn.join(', ')}</p>
                ) : null}
              </div>
              {entry.key === 'core' ? (
                <Pill>{t('event.alwaysOn')}</Pill>
              ) : (
                <Button
                  size="sm"
                  variant={isOn ? 'secondary' : 'primary'}
                  disabled={!canManage || toggle.isPending}
                  onClick={() => toggle.mutate({ key: entry.key, enabled: !isOn })}
                >
                  {isOn ? t('event.disable') : t('event.enable')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

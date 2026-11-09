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

/** The controlled module catalogue: dependencies explained, activation validated by the API. */
export default function ModulesTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const canManage = can('module:manage');

  const modules = useQuery({ queryKey: ['modules', slug, eventId], queryFn: () => eventAdminApi.modules(slug, eventId) });

  const toggle = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) =>
      eventAdminApi.setModule(slug, eventId, input.key, { enabled: input.enabled }),
    onSuccess: (data) => {
      queryClient.setQueryData(['modules', slug, eventId], data);
      // The event's enabled-module list drives which tabs exist.
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(slug, eventId) });
      setError(null);
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  if (modules.isLoading) return <LoadingState label={t('common.loading')} />;
  if (modules.isError || !modules.data) {
    return <ErrorState message={t('common.error')} onRetry={() => void modules.refetch()} retryLabel={t('common.retry')} />;
  }

  return (
    <Section title={t('events.modules')}>
      {error ? <p role="alert" className="mb-3 rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-brand-primary/10">
        {modules.data.map((module) => (
          <li key={module.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 max-w-xl">
              <p className="text-sm font-medium">
                {module.name} <Pill>{module.priority.toUpperCase()}</Pill>
              </p>
              <p className="text-xs text-brand-text/70">{module.summary}</p>
              {module.dependsOn.length > 0 ? (
                <p className="mt-1 text-xs text-brand-text/70">{t('event.requires')}: {module.dependsOn.join(', ')}</p>
              ) : null}
            </div>
            {module.key === 'core' ? (
              <Pill>{t('event.alwaysOn')}</Pill>
            ) : !module.available ? (
              <Pill>{t('event.comingSoon')}</Pill>
            ) : (
              <Button
                size="sm"
                variant={module.enabled ? 'secondary' : 'primary'}
                disabled={!canManage || toggle.isPending}
                onClick={() => toggle.mutate({ key: module.key, enabled: !module.enabled })}
              >
                {module.enabled ? t('event.disable') : t('event.enable')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

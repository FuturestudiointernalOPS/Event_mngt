import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PurgeExpiredResult } from '@event-platform/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Section } from '@/components/ui/section';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { retentionApi } from '@/services/retention.api';
import { workspacesApi } from '@/services/workspaces.api';

/** How long personal data is kept after an event ends, and the purge that enforces it. */
export default function RetentionPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [months, setMonths] = useState<string | null>(null);
  const [result, setResult] = useState<PurgeExpiredResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: queryKeys.workspaceSettings(slug),
    queryFn: () => workspacesApi.settings(slug),
    enabled: Boolean(slug),
  });

  const save = useMutation({
    mutationFn: (value: number | null) =>
      workspacesApi.updateSettings(slug, { retentionMonths: value }),
    onSuccess: () => {
      setError(null);
      setResult(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSettings(slug) });
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  const purge = useMutation({
    mutationFn: (dryRun: boolean) => retentionApi.purge(slug, dryRun),
    onSuccess: (data) => {
      setError(null);
      setResult(data);
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  if (settings.isLoading) {
    return <LoadingState />;
  }
  if (settings.isError || !settings.data) {
    return <ErrorState message={t('common.error')} />;
  }

  const current = settings.data.settings.retentionMonths;
  const value = months ?? (current === null ? '' : String(current));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('retention.title')}</h1>
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Section title={t('retention.period')}>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(value === '' ? null : Number(value));
          }}
        >
          <Field label={t('retention.months')} htmlFor="retention-months" hint={t('retention.hint')}>
            <Input
              id="retention-months"
              type="number"
              min={1}
              max={120}
              value={value}
              onChange={(e) => setMonths(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </Section>

      <Section title={t('retention.purge')}>
        <p className="text-sm text-brand-text/80">{t('retention.purgeHelp')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={purge.isPending || current === null} onClick={() => purge.mutate(true)}>
            {t('retention.preview')}
          </Button>
          <Button
            variant="danger"
            disabled={purge.isPending || current === null}
            onClick={() => {
              if (window.confirm(t('retention.confirm'))) {
                purge.mutate(false);
              }
            }}
          >
            {t('retention.run')}
          </Button>
        </div>
        {result ? (
          <p role="status" className="mt-3 text-sm">
            {result.dryRun
              ? t('retention.previewResult').replace('{count}', String(result.people))
              : t('retention.done').replace('{count}', String(result.people))}
          </p>
        ) : null}
      </Section>
    </div>
  );
}

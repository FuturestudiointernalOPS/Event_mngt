import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PurgeResult } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Section } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { privacyApi } from '@/services/staff-ops.api';

/** Retention period and the purge of participant data past it (preview first). */
export default function PrivacyPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [months, setMonths] = useState('');
  const [result, setResult] = useState<PurgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retention = useQuery({ queryKey: ['retention', slug], queryFn: () => privacyApi.retention(slug) });

  useEffect(() => {
    if (retention.data) setMonths(retention.data.retentionMonths?.toString() ?? '');
  }, [retention.data]);

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const save = useMutation({
    mutationFn: () => privacyApi.setRetention(slug, months ? Number(months) : null),
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['retention', slug] }); },
    onError,
  });
  const purge = useMutation({
    mutationFn: (dryRun: boolean) => privacyApi.purge(slug, dryRun),
    onSuccess: (r) => { setError(null); setResult(r); },
    onError,
  });

  if (retention.isLoading) return <LoadingState label={t('common.loading')} />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('privacy.title')}</h1>
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Section title={t('privacy.retention')}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label={t('privacy.months')} htmlFor="months" hint={t('privacy.hint')}>
            <Input id="months" type="number" min={1} max={120} className="w-32" value={months} onChange={(e) => setMonths(e.target.value)} />
          </Field>
          <Button type="submit" disabled={save.isPending}>{t('common.save')}</Button>
        </form>
      </Section>
      <Section title={t('privacy.purge')}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={purge.isPending} onClick={() => purge.mutate(true)}>{t('privacy.preview')}</Button>
          <Button
            variant="danger"
            disabled={purge.isPending || !result || !result.dryRun || result.eligible === 0}
            onClick={() => { if (window.confirm(t('privacy.confirm', { count: result?.eligible ?? 0 }))) purge.mutate(false); }}
          >
            {t('privacy.run')}
          </Button>
        </div>
        {result ? (
          <p role="status" className="mt-3 text-sm">
            {result.dryRun ? t('privacy.eligible', { count: result.eligible }) : t('privacy.erased', { count: result.erased })}
          </p>
        ) : null}
      </Section>
    </div>
  );
}

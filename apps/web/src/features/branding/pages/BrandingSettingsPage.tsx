import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Branding, UpdateBrandingRequest } from '@event-platform/shared';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { workspacesApi } from '@/services/workspaces.api';

type ColorKey =
  | 'primaryColor'
  | 'secondaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'surfaceColor'
  | 'textColor';

const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'backgroundColor', label: 'Background' },
  { key: 'surfaceColor', label: 'Surface' },
  { key: 'textColor', label: 'Text' },
];

/**
 * Branding editor. Saves through the API and surfaces contrast warnings instead of
 * silently accepting a theme that fails accessibility checks.
 */
export default function BrandingSettingsPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Branding | null>(null);
  const [saved, setSaved] = useState(false);

  const brandingQuery = useQuery({
    queryKey: queryKeys.workspaceBranding(slug),
    queryFn: () => workspacesApi.branding(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  useEffect(() => {
    if (brandingQuery.data) {
      setForm(brandingQuery.data.branding);
    }
  }, [brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateBrandingRequest) =>
      workspacesApi.updateBranding(slug, payload),
    onSuccess: (view) => {
      setForm(view.branding);
      setSaved(true);
      queryClient.setQueryData(queryKeys.workspaceBranding(slug), view);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceContext(slug) });
    },
  });

  if (brandingQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (brandingQuery.isError || !brandingQuery.data || !form) {
    return (
      <ErrorState
        title={t('common.error')}
        message={
          brandingQuery.error instanceof ApiRequestError
            ? brandingQuery.error.message
            : t('common.error')
        }
        onRetry={() => void brandingQuery.refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  const warnings = brandingQuery.data.contrastWarnings;

  const updateColor = (key: ColorKey, value: string): void => {
    setSaved(false);
    setForm((current) =>
      current ? ({ ...current, [key]: value } as Branding) : current,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-text">
          {t('workspace.branding.title')}
        </h1>
        <p className="mt-1 text-sm text-brand-text/70">
          {t('workspace.branding.subtitle')}
        </p>
      </div>

      <form
        className="space-y-4 rounded-brand border border-brand-primary/10 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate({
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            accentColor: form.accentColor,
            backgroundColor: form.backgroundColor,
            surfaceColor: form.surfaceColor,
            textColor: form.textColor,
            colorMode: form.colorMode,
            logoUrl: form.logoUrl,
            logoDarkUrl: form.logoDarkUrl,
            faviconUrl: form.faviconUrl,
            borderRadius: form.borderRadius,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                aria-label={label}
                value={String(form[key] ?? '#000000')}
                onChange={(event) => updateColor(key, event.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-brand-primary/20"
              />
              <Field label={label} htmlFor={`color-${key}`}>
                <Input
                  id={`color-${key}`}
                  value={String(form[key] ?? '')}
                  onChange={(event) => updateColor(key, event.target.value)}
                />
              </Field>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Radius" htmlFor="borderRadius">
            <Input
              id="borderRadius"
              value={form.borderRadius ?? ''}
              onChange={(event) =>
                setForm((current) =>
                  current ? { ...current, borderRadius: event.target.value || null } : current,
                )
              }
            />
          </Field>

          <Field label="Logo URL" htmlFor="logoUrl">
            <Input
              id="logoUrl"
              value={form.logoUrl ?? ''}
              onChange={(event) =>
                setForm((current) =>
                  current ? { ...current, logoUrl: event.target.value || null } : current,
                )
              }
            />
          </Field>
        </div>

        {warnings.length > 0 ? (
          <ul role="status" className="space-y-1 rounded-brand bg-amber-50 p-3 text-xs text-amber-800">
            {warnings.map((warning) => (
              <li key={warning.pair}>
                {t('workspace.branding.contrastWarning', {
                  pair: warning.pair,
                  ratio: warning.ratio,
                  required: warning.required,
                })}
              </li>
            ))}
          </ul>
        ) : null}

        {saveMutation.isError ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {saveMutation.error instanceof ApiRequestError
              ? saveMutation.error.message
              : t('common.error')}
          </p>
        ) : null}

        {saved ? (
          <p role="status" className="text-sm font-medium text-emerald-700">
            {t('workspace.branding.saved')}
          </p>
        ) : null}

        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </form>
    </div>
  );
}

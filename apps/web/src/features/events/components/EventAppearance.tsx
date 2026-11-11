import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { BrandOverrides, EventDetail } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { eventAdminApi } from '@/services/event-admin.api';

const COLOURS = [
  { key: 'primaryColor', label: 'branding.primary' },
  { key: 'secondaryColor', label: 'branding.secondary' },
  { key: 'accentColor', label: 'branding.accent' },
] as const;

type ColourKey = (typeof COLOURS)[number]['key'];

/** Banner and colour overrides for one event; anything left unset inherits the workspace. */
export function EventAppearance({ slug, event }: { slug: string; event: EventDetail }): JSX.Element {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [colours, setColours] = useState<BrandOverrides>({ ...(event.brandOverrides ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const done = (updated: EventDetail): void => {
    queryClient.setQueryData(queryKeys.event(slug, event.id), updated);
    setColours({ ...(updated.brandOverrides ?? {}) });
    setError(null);
  };

  const save = useMutation({
    mutationFn: (value: BrandOverrides | null) =>
      eventAdminApi.update(slug, event.id, { brandOverrides: value }),
    onSuccess: done,
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  async function upload(file: File | undefined): Promise<void> {
    if (!file) return;
    setUploading(true);
    try {
      done(await eventAdminApi.uploadBanner(slug, event.id, file));
    } catch (e) {
      setError(errorMessage(e, t('common.error')));
    } finally {
      setUploading(false);
    }
  }

  const pick = (key: ColourKey, value: string): void => setColours({ ...colours, [key]: value });

  return (
    <Section title={t('event.appearance')}>
      {error ? (
        <p role="alert" className="mb-3 rounded-brand bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p className="mb-3 text-xs text-brand-text/70">{t('event.appearanceHint')}</p>
      <div className="flex flex-wrap items-end gap-4">
        {COLOURS.map(({ key, label }) => (
          <label key={key} className="text-sm">
            <span className="block">{t(label)}</span>
            <input
              type="color"
              className="h-10 w-14"
              value={colours[key] ?? '#000000'}
              onChange={(e) => pick(key, e.target.value)}
            />
          </label>
        ))}
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(colours)}>
          {t('common.save')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => save.mutate(null)}
        >
          {t('event.inherit')}
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt="" className="h-16 rounded-brand" />
        ) : null}
        <label className="text-sm">
          <span className="block">{t('event.banner')}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
      </div>
    </Section>
  );
}

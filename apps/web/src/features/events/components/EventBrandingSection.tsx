import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EventDetail } from '@event-platform/shared';
import { useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Section } from '@/components/ui/section';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { uploadEventBanner } from '@/services/event-banner.api';
import { eventAdminApi } from '@/services/event-admin.api';

const KEYS = ['primaryColor', 'secondaryColor', 'accentColor'] as const;
type ColorKey = (typeof KEYS)[number];
const LABELS = {
  primaryColor: 'branding.primary',
  secondaryColor: 'branding.secondary',
  accentColor: 'branding.accent',
} as const;

interface Props {
  slug: string;
  eventId: string;
  event: EventDetail;
}

/** Banner and colour overrides for one event; empty colours inherit the workspace's. */
export function EventBrandingSection({ slug, eventId, event }: Props): JSX.Element {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [colors, setColors] = useState<Record<ColorKey, string>>({
    primaryColor: event.brandOverrides?.primaryColor ?? '',
    secondaryColor: event.brandOverrides?.secondaryColor ?? '',
    accentColor: event.brandOverrides?.accentColor ?? '',
  });

  const refresh = (updated: EventDetail): void => {
    queryClient.setQueryData(queryKeys.event(slug, eventId), updated);
  };

  const save = useMutation({
    mutationFn: () => {
      const overrides = Object.fromEntries(
        KEYS.filter((key) => colors[key] !== '').map((key) => [key, colors[key]]),
      );
      return eventAdminApi.update(slug, eventId, {
        brandOverrides: Object.keys(overrides).length > 0 ? overrides : null,
      });
    },
    onSuccess: (updated) => {
      refresh(updated);
      setMessage({ ok: true, text: t('event.brandingSaved') });
    },
    onError: (e) => setMessage({ ok: false, text: errorMessage(e, t('common.error')) }),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadEventBanner(slug, eventId, file),
    onSuccess: ({ bannerUrl }) => {
      refresh({ ...event, bannerUrl });
      setMessage({ ok: true, text: t('event.bannerUploaded') });
    },
    onError: (e) => setMessage({ ok: false, text: errorMessage(e, t('common.error')) }),
  });

  return (
    <Section title={t('event.branding')}>
      <p className="text-sm text-brand-text/80">{t('event.brandingHelp')}</p>
      {message ? (
        <p role={message.ok ? 'status' : 'alert'} className="mt-2 text-sm">{message.text}</p>
      ) : null}
      <div className="mt-3 space-y-4">
        {event.bannerUrl ? <img src={event.bannerUrl} alt="" className="max-h-40 rounded-brand" /> : null}
        <Field label={t('event.banner')} htmlFor="ev-banner">
          <input
            id="ev-banner"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                upload.mutate(file);
              }
            }}
          />
        </Field>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {KEYS.map((key) => (
            <Field key={key} label={t(LABELS[key])} htmlFor={`ev-${key}`}>
              <div className="flex items-center gap-2">
                <input
                  id={`ev-${key}`}
                  type="color"
                  value={colors[key] || '#000000'}
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                />
                {colors[key] ? (
                  <button type="button" className="text-xs underline" onClick={() => setColors({ ...colors, [key]: '' })}>
                    ×
                  </button>
                ) : null}
              </div>
            </Field>
          ))}
          <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.saving') : t('common.save')}</Button>
        </form>
      </div>
    </Section>
  );
}

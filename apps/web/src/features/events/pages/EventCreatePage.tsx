import {
  createEventRequestSchema,
  eventFormatSchema,
  eventVisibilitySchema,
  type EventFormat,
  type EventVisibility,
} from '@event-platform/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ApiRequestError } from '@/services/api-client';
import { eventsApi } from '@/services/events.api';

interface FormValues {
  name: string;
  slug: string;
  format: EventFormat;
  visibility: EventVisibility;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  description: string;
}

export default function EventCreatePage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      slug: '',
      format: 'IN_PERSON',
      visibility: 'PRIVATE',
      timeZone: 'Africa/Porto-Novo',
      startsAt: '',
      endsAt: '',
      venueName: '',
      description: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);

    // The shared schema is the authority; parse the assembled payload before sending
    // so the same rules apply as on the server.
    const parsed = createEventRequestSchema.safeParse({
      name: values.name,
      slug: values.slug ? values.slug : undefined,
      format: values.format,
      visibility: values.visibility,
      timeZone: values.timeZone,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : '',
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : '',
      venueName: values.venueName ? values.venueName : undefined,
      description: values.description ? values.description : undefined,
    });

    if (!parsed.success) {
      setFailure(parsed.error.issues[0]?.message ?? t('common.error'));
      return;
    }

    try {
      const created = await eventsApi.create(slug, parsed.data);
      navigate(`/workspace/${slug}/events/${created.id}`);
    } catch (error) {
      setFailure(error instanceof ApiRequestError ? error.message : t('common.error'));
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-brand-text">{t('events.new')}</h1>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <Field label={t('events.name')} htmlFor="name" error={errors.name?.message}>
          <Input id="name" {...register('name', { required: t('common.required') })} />
        </Field>

        <Field
          label={t('events.slug')}
          htmlFor="slug"
          hint="innovation-village-2026"
          error={errors.slug?.message}
        >
          <Input id="slug" {...register('slug')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('events.format')} htmlFor="format">
            <Select id="format" {...register('format')}>
              {eventFormatSchema.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('events.visibility')} htmlFor="visibility">
            <Select id="visibility" {...register('visibility')}>
              {eventVisibilitySchema.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('events.timeZone')} htmlFor="timeZone">
          <Input id="timeZone" {...register('timeZone')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('events.startsAt')} htmlFor="startsAt">
            <Input
              id="startsAt"
              type="datetime-local"
              {...register('startsAt', { required: t('common.required') })}
            />
          </Field>

          <Field label={t('events.endsAt')} htmlFor="endsAt">
            <Input
              id="endsAt"
              type="datetime-local"
              {...register('endsAt', { required: t('common.required') })}
            />
          </Field>
        </div>

        <Field label={t('events.venue')} htmlFor="venueName">
          <Input id="venueName" {...register('venueName')} />
        </Field>

        <div className="space-y-1">
          <label htmlFor="description" className="block text-sm font-medium text-brand-text">
            {t('public.details')}
          </label>
          <textarea
            id="description"
            rows={4}
            className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
            {...register('description')}
          />
        </div>

        {failure ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {failure}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('events.creating') : t('events.create')}
        </Button>
      </form>
    </div>
  );
}

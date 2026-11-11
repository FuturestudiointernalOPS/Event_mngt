import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { EventDetail } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Section } from '@/components/ui/section';
import { formatDateRange } from '@/lib/date';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { eventAdminApi, type EventAction } from '@/services/event-admin.api';
import { EventAppearance } from '../components/EventAppearance';
import type { EventOutletContext } from '../pages/EventLayout';

/** Details, lifecycle actions and a small editor for the descriptive fields. */
export default function OverviewTab(): JSX.Element {
  const { slug, eventId, event, can } = useOutletContext<EventOutletContext>();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: event.name,
    description: event.description ?? '',
    venueName: event.venueName ?? '',
    venueAddress: event.venueAddress ?? '',
  });

  const editable = !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(event.status);
  // Publishing and every status transition share one capability; editing and duplicating
  // follow `events.create`, exactly as the API authorises them.
  const canPublish = can('events.publish');
  const canEdit = can('events.create');

  const refresh = (updated: EventDetail): void => {
    queryClient.setQueryData(queryKeys.event(slug, eventId), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.events(slug) });
    setError(null);
  };

  const act = useMutation({
    mutationFn: (action: EventAction) => eventAdminApi.act(slug, eventId, action),
    onSuccess: (updated, action) => {
      if (action === 'duplicate') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.events(slug) });
        navigate(`/workspace/${slug}/events/${updated.id}`);
        return;
      }
      refresh(updated);
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  const save = useMutation({
    mutationFn: () =>
      eventAdminApi.update(slug, eventId, {
        name: draft.name,
        description: draft.description,
        venueName: draft.venueName,
        venueAddress: draft.venueAddress,
      }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  const actions: { action: EventAction; label: string; show: boolean; variant?: 'secondary' | 'danger' }[] = [
    { action: 'publish', label: t('events.publish'), show: canPublish && ['DRAFT', 'REGISTRATION_OPEN'].includes(event.status) },
    { action: 'open-registration', label: t('event.openRegistration'), show: canPublish && ['PUBLISHED', 'REGISTRATION_CLOSED'].includes(event.status), variant: 'secondary' },
    { action: 'close-registration', label: t('event.closeRegistration'), show: canPublish && ['PUBLISHED', 'REGISTRATION_OPEN'].includes(event.status), variant: 'secondary' },
    { action: 'unpublish', label: t('event.unpublish'), show: canPublish && event.status === 'PUBLISHED', variant: 'secondary' },
    { action: 'complete', label: t('event.complete'), show: canPublish && ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(event.status), variant: 'secondary' },
    { action: 'cancel', label: t('event.cancel'), show: canPublish && ['DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(event.status), variant: 'danger' },
    { action: 'archive', label: t('event.archive'), show: canPublish && ['DRAFT', 'COMPLETED', 'CANCELLED'].includes(event.status), variant: 'secondary' },
    { action: 'duplicate', label: t('event.duplicate'), show: canEdit, variant: 'secondary' },
  ];

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Section
        title={t('events.details.title')}
        actions={
          <div className="flex flex-wrap gap-2">
            {event.visibility !== 'PRIVATE' && event.status !== 'DRAFT' ? (
              <Link to={`/e/${event.slug}`}><Button size="sm" variant="secondary">{t('public.details')}</Button></Link>
            ) : null}
            {actions.filter((a) => a.show).map((a) => (
              <Button key={a.action} size="sm" variant={a.variant ?? 'primary'} disabled={act.isPending} onClick={() => act.mutate(a.action)}>
                {a.label}
              </Button>
            ))}
          </div>
        }
      >
        <p className="text-sm text-brand-text/80">{formatDateRange(event.startsAt, event.endsAt, event.timeZone, locale)}</p>
        <p className="mt-1 text-xs text-brand-text/70">/e/{event.slug}</p>
      </Section>

      {canEdit && editable ? (
        <Section title={t('event.edit')}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label={t('events.name')} htmlFor="ev-name">
              <Input id="ev-name" minLength={3} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('events.venue')} htmlFor="ev-venue">
              <Input id="ev-venue" value={draft.venueName} onChange={(e) => setDraft({ ...draft, venueName: e.target.value })} />
            </Field>
            <Field label={t('event.address')} htmlFor="ev-address">
              <Input id="ev-address" value={draft.venueAddress} onChange={(e) => setDraft({ ...draft, venueAddress: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('event.description')} htmlFor="ev-desc">
                <textarea
                  id="ev-desc"
                  rows={4}
                  className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </Section>
      ) : null}
      {canEdit && editable ? <EventAppearance slug={slug} event={event} /> : null}
    </div>
  );
}

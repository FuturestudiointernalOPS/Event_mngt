import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { FieldInput } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { eventAdminApi } from '@/services/event-admin.api';
import type { EventOutletContext } from '../pages/EventLayout';

const FIELD_TYPES: FieldInput['type'][] = ['TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX'];

/** Participant categories, the dynamic registration form and the consent statement. */
export default function RegistrationSetupTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const canManage = can('registration:manage');
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories', slug, eventId], queryFn: () => eventAdminApi.categories(slug, eventId) });
  const fields = useQuery({ queryKey: ['fields', slug, eventId], queryFn: () => eventAdminApi.fields(slug, eventId) });
  const consent = useQuery({ queryKey: ['consent', slug, eventId], queryFn: () => eventAdminApi.consent(slug, eventId) });

  const [cat, setCat] = useState({ name: '', key: '', capacity: '', requiresApproval: false });
  const [field, setField] = useState({ label: '', key: '', type: 'TEXT' as FieldInput['type'], required: false, options: '', categoryKey: '' });
  const [consentDraft, setConsentDraft] = useState<{ text: string; version: string } | null>(null);

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const reload = (key: string): Promise<void> => queryClient.invalidateQueries({ queryKey: [key, slug, eventId] });

  const addCategory = useMutation({
    mutationFn: () =>
      eventAdminApi.addCategory(slug, eventId, {
        key: cat.key || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40),
        name: cat.name,
        requiresApproval: cat.requiresApproval,
        capacity: cat.capacity ? Number(cat.capacity) : null,
        position: 0,
      }),
    onSuccess: () => {
      setCat({ name: '', key: '', capacity: '', requiresApproval: false });
      setError(null);
      void reload('categories');
    },
    onError,
  });
  const removeCategory = useMutation({
    mutationFn: (id: string) => eventAdminApi.deleteCategory(slug, eventId, id),
    onSuccess: () => void reload('categories'),
    onError,
  });
  const toggleCategory = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => eventAdminApi.updateCategory(slug, eventId, input.id, { isActive: input.isActive }),
    onSuccess: () => void reload('categories'),
    onError,
  });
  const addField = useMutation({
    mutationFn: () =>
      eventAdminApi.addField(slug, eventId, {
        key: field.key || field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40),
        label: field.label,
        type: field.type,
        required: field.required,
        options: ['SELECT', 'RADIO'].includes(field.type) ? field.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
        categoryKey: field.categoryKey || null,
        position: (fields.data?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      setField({ label: '', key: '', type: 'TEXT', required: false, options: '', categoryKey: '' });
      setError(null);
      void reload('fields');
    },
    onError,
  });
  const removeField = useMutation({
    mutationFn: (id: string) => eventAdminApi.deleteField(slug, eventId, id),
    onSuccess: () => void reload('fields'),
    onError,
  });
  const saveConsent = useMutation({
    mutationFn: () => eventAdminApi.setConsent(slug, eventId, consentDraft ?? { text: '', version: '1' }),
    onSuccess: () => {
      setError(null);
      void reload('consent');
    },
    onError,
  });

  if (categories.isLoading || fields.isLoading || consent.isLoading) return <LoadingState label={t('common.loading')} />;
  const draft = consentDraft ?? { text: consent.data?.text ?? '', version: consent.data?.version ?? '1' };

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Section title={t('setup.categories')}>
        <ul className="divide-y divide-brand-primary/10">
          {categories.data?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {c.name} <span className="text-xs text-brand-text/70">({c.key})</span>{' '}
                {c.requiresApproval ? <Pill>{t('setup.requiresApproval')}</Pill> : null}{' '}
                {!c.isActive ? <Pill>{t('setup.inactive')}</Pill> : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-brand-text/70">{c.registrationCount}{c.capacity ? ` / ${c.capacity}` : ''}</span>
                {canManage ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => toggleCategory.mutate({ id: c.id, isActive: !c.isActive })}>
                      {c.isActive ? t('setup.deactivate') : t('setup.activate')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeCategory.mutate(c.id)}>{t('team.remove')}</Button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {canManage ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); addCategory.mutate(); }}>
            <Field label={t('setup.name')} htmlFor="cat-name"><Input id="cat-name" required value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></Field>
            <Field label={t('setup.capacity')} htmlFor="cat-cap"><Input id="cat-cap" type="number" min={1} value={cat.capacity} onChange={(e) => setCat({ ...cat, capacity: e.target.value })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={cat.requiresApproval} onChange={(e) => setCat({ ...cat, requiresApproval: e.target.checked })} />{t('setup.requiresApproval')}</label>
            <div className="flex items-end"><Button type="submit" disabled={addCategory.isPending}>{t('setup.addCategory')}</Button></div>
          </form>
        ) : null}
      </Section>

      <Section title={t('setup.fields')}>
        <ul className="divide-y divide-brand-primary/10">
          {fields.data?.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {f.label} <Pill>{f.type}</Pill> {f.required ? <Pill>{t('common.required')}</Pill> : null}
                {f.categoryKey ? <Pill>{f.categoryKey}</Pill> : null}
              </span>
              {canManage ? <Button size="sm" variant="ghost" onClick={() => removeField.mutate(f.id)}>{t('team.remove')}</Button> : null}
            </li>
          ))}
        </ul>
        {canManage ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); addField.mutate(); }}>
            <Field label={t('setup.label')} htmlFor="f-label"><Input id="f-label" required value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} /></Field>
            <Field label={t('setup.type')} htmlFor="f-type">
              <Select id="f-type" value={field.type} onChange={(e) => setField({ ...field, type: e.target.value as FieldInput['type'] })}>
                {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label={t('setup.onlyFor')} htmlFor="f-cat">
              <Select id="f-cat" value={field.categoryKey} onChange={(e) => setField({ ...field, categoryKey: e.target.value })}>
                <option value="">{t('setup.allCategories')}</option>
                {categories.data?.map((c) => <option key={c.id} value={c.key}>{c.name}</option>)}
              </Select>
            </Field>
            {['SELECT', 'RADIO'].includes(field.type) ? (
              <div className="sm:col-span-2">
                <Field label={t('setup.options')} htmlFor="f-opts" hint={t('setup.optionsHint')}>
                  <Input id="f-opts" required value={field.options} onChange={(e) => setField({ ...field, options: e.target.value })} />
                </Field>
              </div>
            ) : null}
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={field.required} onChange={(e) => setField({ ...field, required: e.target.checked })} />{t('common.required')}</label>
            <div className="flex items-end"><Button type="submit" disabled={addField.isPending}>{t('setup.addField')}</Button></div>
          </form>
        ) : null}
      </Section>

      <Section title={t('setup.consent')}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveConsent.mutate(); }}>
          <Field label={t('setup.consentText')} htmlFor="consent-text" hint={t('setup.consentHint')}>
            <textarea
              id="consent-text"
              rows={4}
              minLength={10}
              disabled={!canManage}
              className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
              value={draft.text}
              onChange={(e) => setConsentDraft({ ...draft, text: e.target.value })}
            />
          </Field>
          <Field label={t('setup.consentVersion')} htmlFor="consent-version">
            <Input id="consent-version" className="max-w-32" disabled={!canManage} value={draft.version} onChange={(e) => setConsentDraft({ ...draft, version: e.target.value })} />
          </Field>
          {canManage ? <Button type="submit" disabled={saveConsent.isPending}>{t('common.save')}</Button> : null}
        </form>
      </Section>
    </div>
  );
}

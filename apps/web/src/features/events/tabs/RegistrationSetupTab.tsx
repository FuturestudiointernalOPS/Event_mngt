import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { RegistrationFieldInput, RegistrationFieldType } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { eventAdminApi } from '@/services/event-admin.api';
import type { EventOutletContext } from '../pages/EventLayout';

const FIELD_TYPES: RegistrationFieldType[] = ['TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'NUMBER', 'DATE', 'URL', 'SELECT', 'MULTI_SELECT', 'CHECKBOX'];
const CHOICE_TYPES = ['SELECT', 'MULTI_SELECT'];

const slug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

/**
 * Participant categories, the versioned registration form and the consent documents.
 *
 * The form is saved as one document so its version number moves with the fields it
 * contains; consent is separately versioned, and the version a registrant accepted is
 * recorded with their registration.
 */
export default function RegistrationSetupTab(): JSX.Element {
  const { slug: workspaceSlug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  // Categories, the form and consent are separate capabilities on the API; mirror that.
  const canCategories = can('registrations.manage_categories');
  const canForm = can('registrations.manage_form');
  const canConsent = can('registrations.manage_consent');
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories', workspaceSlug, eventId], queryFn: () => eventAdminApi.categories(workspaceSlug, eventId) });
  const form = useQuery({ queryKey: ['registration-form', workspaceSlug, eventId], queryFn: () => eventAdminApi.registrationForm(workspaceSlug, eventId) });
  const documents = useQuery({ queryKey: ['consent-documents', workspaceSlug, eventId], queryFn: () => eventAdminApi.consentDocuments(workspaceSlug, eventId) });

  const [cat, setCat] = useState({ name: '', capacity: '' });
  const [draftFields, setDraftFields] = useState<RegistrationFieldInput[] | null>(null);
  const [field, setField] = useState({ label: '', type: 'TEXT' as RegistrationFieldType, required: false, options: '' });
  const [document, setDocument] = useState({ key: 'privacy', title: '', body: '', required: true });

  useEffect(() => {
    if (form.data && draftFields === null) {
      setDraftFields(form.data.fields.map(({ key, label, type, required, sortOrder, placeholder, helpText, options }) => ({
        key, label, type, required, sortOrder, placeholder: placeholder ?? undefined, helpText: helpText ?? undefined, options: options ?? undefined,
      })));
    }
  }, [form.data, draftFields]);

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const reload = (key: string): Promise<void> => queryClient.invalidateQueries({ queryKey: [key, workspaceSlug, eventId] });

  const addCategory = useMutation({
    mutationFn: () => eventAdminApi.addCategory(workspaceSlug, eventId, {
      name: cat.name,
      capacity: cat.capacity ? Number(cat.capacity) : undefined,
      sortOrder: 0,
    }),
    onSuccess: () => { setCat({ name: '', capacity: '' }); setError(null); void reload('categories'); },
    onError,
  });
  const removeCategory = useMutation({
    mutationFn: (id: string) => eventAdminApi.deleteCategory(workspaceSlug, eventId, id),
    onSuccess: () => void reload('categories'),
    onError,
  });
  const toggleCategory = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => eventAdminApi.updateCategory(workspaceSlug, eventId, input.id, { isActive: input.isActive }),
    onSuccess: () => void reload('categories'),
    onError,
  });
  const saveForm = useMutation({
    mutationFn: () => eventAdminApi.saveRegistrationForm(workspaceSlug, eventId, {
      title: form.data?.title ?? t('setup.fields'),
      description: form.data?.description ?? undefined,
      fields: draftFields ?? [],
    }),
    onSuccess: (data) => { setDraftFields(null); queryClient.setQueryData(['registration-form', workspaceSlug, eventId], data); setError(null); },
    onError,
  });
  const publishDocument = useMutation({
    mutationFn: () => eventAdminApi.addConsentDocument(workspaceSlug, eventId, {
      key: document.key,
      title: document.title,
      body: document.body,
      required: document.required,
      publish: true,
    }),
    onSuccess: () => { setDocument({ ...document, title: '', body: '' }); setError(null); void reload('consent-documents'); },
    onError,
  });

  if (categories.isLoading || form.isLoading || documents.isLoading) return <LoadingState label={t('common.loading')} />;

  function addField(): void {
    const key = slug(field.label);
    if (!key) return;
    const options = CHOICE_TYPES.includes(field.type)
      ? field.options.split(',').map((label) => label.trim()).filter(Boolean).map((label) => ({ value: slug(label), label }))
      : undefined;
    setDraftFields([...(draftFields ?? []), { key, label: field.label, type: field.type, required: field.required, sortOrder: (draftFields?.length ?? 0) + 1, options }]);
    setField({ label: '', type: 'TEXT', required: false, options: '' });
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Section title={t('setup.categories')}>
        <ul className="divide-y divide-brand-primary/10">
          {categories.data?.map((category) => (
            <li key={category.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {category.name} <span className="text-xs text-brand-text/70">({category.key})</span>{' '}
                {!category.isActive ? <Pill>{t('setup.inactive')}</Pill> : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-brand-text/70">
                  {category.registrationCount ?? 0}{category.capacity ? ` / ${category.capacity}` : ''}
                </span>
                {canCategories ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => toggleCategory.mutate({ id: category.id, isActive: !category.isActive })}>
                      {category.isActive ? t('setup.deactivate') : t('setup.activate')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeCategory.mutate(category.id)}>{t('team.remove')}</Button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {canCategories ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); addCategory.mutate(); }}>
            <Field label={t('setup.name')} htmlFor="cat-name"><Input id="cat-name" required value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></Field>
            <Field label={t('setup.capacity')} htmlFor="cat-cap"><Input id="cat-cap" type="number" min={1} value={cat.capacity} onChange={(e) => setCat({ ...cat, capacity: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={addCategory.isPending}>{t('setup.addCategory')}</Button></div>
          </form>
        ) : null}
      </Section>

      <Section title={t('setup.fields')}>
        <ul className="divide-y divide-brand-primary/10">
          {draftFields?.map((entry, index) => (
            <li key={entry.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {entry.label} <Pill>{entry.type}</Pill> {entry.required ? <Pill>{t('common.required')}</Pill> : null}
              </span>
              {canForm ? (
                <Button size="sm" variant="ghost" onClick={() => setDraftFields((draftFields ?? []).filter((_, i) => i !== index))}>
                  {t('team.remove')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canForm ? (
          <>
            <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); addField(); }}>
              <Field label={t('setup.label')} htmlFor="f-label"><Input id="f-label" required value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} /></Field>
              <Field label={t('setup.type')} htmlFor="f-type">
                <Select id="f-type" value={field.type} onChange={(e) => setField({ ...field, type: e.target.value as RegistrationFieldType })}>
                  {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </Field>
              {CHOICE_TYPES.includes(field.type) ? (
                <Field label={t('setup.options')} htmlFor="f-opts" hint={t('setup.optionsHint')}>
                  <Input id="f-opts" required value={field.options} onChange={(e) => setField({ ...field, options: e.target.value })} />
                </Field>
              ) : null}
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" checked={field.required} onChange={(e) => setField({ ...field, required: e.target.checked })} />
                {t('common.required')}
              </label>
              <div className="flex items-end"><Button type="submit">{t('setup.addField')}</Button></div>
            </form>
            <Button className="mt-3" disabled={!draftFields || draftFields.length === 0 || saveForm.isPending} onClick={() => saveForm.mutate()}>
              {t('setup.saveForm')}
            </Button>
          </>
        ) : null}
      </Section>

      <Section title={t('setup.consent')}>
        <ul className="divide-y divide-brand-primary/10 text-sm">
          {documents.data?.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
              <span>{entry.title} <span className="text-xs text-brand-text/70">{entry.key} v{entry.version}</span></span>
              {entry.required ? <Pill>{t('common.required')}</Pill> : null}
            </li>
          ))}
        </ul>
        {canConsent ? (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); publishDocument.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('setup.documentKey')} htmlFor="doc-key"><Input id="doc-key" required value={document.key} onChange={(e) => setDocument({ ...document, key: slug(e.target.value) })} /></Field>
              <Field label={t('setup.label')} htmlFor="doc-title"><Input id="doc-title" required value={document.title} onChange={(e) => setDocument({ ...document, title: e.target.value })} /></Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" checked={document.required} onChange={(e) => setDocument({ ...document, required: e.target.checked })} />
                {t('common.required')}
              </label>
            </div>
            <Field label={t('setup.consentText')} htmlFor="doc-body" hint={t('setup.consentHint')}>
              <textarea
                id="doc-body"
                rows={4}
                required
                className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
                value={document.body}
                onChange={(e) => setDocument({ ...document, body: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={publishDocument.isPending}>{t('setup.publish')}</Button>
          </form>
        ) : null}
      </Section>
    </div>
  );
}

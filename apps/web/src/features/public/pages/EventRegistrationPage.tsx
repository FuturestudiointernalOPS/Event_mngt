import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  PublicRegistrationField,
  RegistrationAnswerValue,
  RegistrationReceipt,
} from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/services/api-client';
import { eventsApi } from '@/services/events.api';
import { publicApi } from '@/services/public.api';

type Answer = RegistrationAnswerValue;

function FieldControl({
  field,
  value,
  error,
  onChange,
}: {
  field: PublicRegistrationField;
  value: Answer | undefined;
  error?: string;
  onChange: (value: Answer) => void;
}): JSX.Element {
  const id = `f-${field.key}`;
  const label = `${field.label}${field.required ? ' *' : ''}`;
  const options = field.options ?? [];

  if (field.type === 'CHECKBOX') {
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
        {field.helpText ? <p className="text-xs text-brand-text/70">{field.helpText}</p> : null}
        {error ? <p role="alert" className="text-xs font-medium text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (field.type === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{label}</legend>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, option.value]
                    : selected.filter((entry) => entry !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
        {error ? <p role="alert" className="text-xs font-medium text-red-600">{error}</p> : null}
      </fieldset>
    );
  }

  return (
    <Field label={label} htmlFor={id} error={error}>
      {field.type === 'SELECT' ? (
        <Select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" />
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      ) : field.type === 'TEXTAREA' ? (
        <textarea
          id={id}
          rows={4}
          className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm"
          placeholder={field.placeholder ?? undefined}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={
            field.type === 'EMAIL' ? 'email'
              : field.type === 'PHONE' ? 'tel'
              : field.type === 'NUMBER' ? 'number'
              : field.type === 'DATE' ? 'date'
              : field.type === 'URL' ? 'url'
              : 'text'
          }
          placeholder={field.placeholder ?? undefined}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(field.type === 'NUMBER' ? Number(e.target.value) : e.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * Public registration: the organiser's form, one consent per document, then the receipt.
 *
 * The form is a versioned document and consent is versioned with it, so a registrant always
 * sees exactly what they accepted. Server-side validation is authoritative; the field errors
 * it returns are shown next to each control.
 */
export default function EventRegistrationPage(): JSX.Element {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { t } = useI18n();
  const context = useQuery({ queryKey: queryKeys.publicEvent(eventSlug), queryFn: () => eventsApi.publicContext(eventSlug), retry: false });
  const form = useQuery({ queryKey: ['registration-form', eventSlug], queryFn: () => publicApi.form(eventSlug), retry: false });

  const [categoryKey, setCategoryKey] = useState('');
  const [person, setPerson] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  // One key per form instance: a double click or a retry after a timeout cannot register twice.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  if (context.isLoading || form.isLoading) return <LoadingState label={t('common.loading')} />;
  if (context.isError || form.isError || !context.data || !form.data) {
    return <div className="mx-auto max-w-lg p-8"><ErrorState title={t('notFound.title')} message={errorMessage(form.error ?? context.error, t('notFound.body'))} /></div>;
  }

  const { organization, branding } = context.data;
  const data = form.data;
  const fields = data.form?.fields ?? [];

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    setErrors({});
    try {
      setReceipt(
        await publicApi.register(
          eventSlug,
          {
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone || undefined,
            categoryKey: categoryKey || undefined,
            answers: Object.entries(answers)
              .filter(([, value]) => value !== '' && value !== undefined)
              .map(([fieldKey, value]) => ({ fieldKey, value })),
            consents: data.consentDocuments
              .filter((document) => consents[document.key])
              .map((document) => ({ key: document.key, version: document.version, accepted: true as const })),
          },
          idempotencyKey,
        ),
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'invalid_answers') {
        setErrors((error.details as { fields?: Record<string, string> } | undefined)?.fields ?? {});
      }
      setFailure(errorMessage(error, t('common.error')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemeProvider value={{ organization, branding }}>
      <div className="min-h-screen bg-brand-background">
        <header className="border-b border-brand-primary/10 bg-brand-surface"><div className="mx-auto flex max-w-2xl items-center px-4 py-3"><BrandLogo /></div></header>
        <main className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="text-2xl font-semibold">{data.event.name}</h1>

          {receipt ? (
            <div role="status" className="mt-6 rounded-brand border border-brand-primary/20 bg-brand-surface p-6">
              <p className="text-lg font-semibold">
                {receipt.requiresApproval ? t('reg.donePending') : t('reg.doneConfirmed')}
              </p>
              <p className="mt-2 text-sm">{receipt.reference}</p>
            </div>
          ) : !data.window.isOpen ? (
            <p role="alert" className="mt-6 rounded-brand bg-amber-50 p-4 text-sm">{t('reg.closed')}</p>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={(e) => void submit(e)} noValidate>
              {data.categories.length > 0 ? (
                <Field label={t('reg.category')} htmlFor="category">
                  <Select id="category" value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
                    <option value="" />
                    {data.categories.map((category) => (
                      <option key={category.key} value={category.key}>{category.name}</option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${t('reg.firstName')} *`} htmlFor="first"><Input id="first" required value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} /></Field>
                <Field label={`${t('reg.lastName')} *`} htmlFor="last"><Input id="last" required value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} /></Field>
                <Field label={`${t('auth.email')} *`} htmlFor="email"><Input id="email" type="email" required value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} /></Field>
                <Field label={t('reg.phone')} htmlFor="phone"><Input id="phone" type="tel" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} /></Field>
              </div>

              {fields.map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={answers[field.key]}
                  error={errors[field.key]}
                  onChange={(value) => setAnswers({ ...answers, [field.key]: value })}
                />
              ))}

              {data.consentDocuments.map((document) => (
                <div key={document.key} className="rounded-brand bg-brand-surface p-4 text-sm">
                  <p className="font-medium">{document.title}</p>
                  <p className="mt-1 whitespace-pre-line">{document.body}</p>
                  <label className="mt-3 flex items-start gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="mt-1"
                      required={document.required}
                      checked={consents[document.key] ?? false}
                      onChange={(e) => setConsents({ ...consents, [document.key]: e.target.checked })}
                    />
                    {t('reg.consentLabel')}{document.required ? ' *' : ''}
                  </label>
                </div>
              ))}

              {failure ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{failure}</p> : null}
              <Button type="submit" size="lg" disabled={busy || receipt !== null}>{busy ? t('common.saving') : t('public.register')}</Button>
            </form>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

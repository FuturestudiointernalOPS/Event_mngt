import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FieldView, PublicRegistrationResult } from '@event-platform/shared';
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

type Answer = string | boolean;

function FieldControl({ field, value, error, onChange }: { field: FieldView; value: Answer | undefined; error?: string; onChange: (v: Answer) => void }): JSX.Element {
  const id = `f-${field.key}`;
  if (field.type === 'CHECKBOX') {
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />{field.label}{field.required ? ' *' : ''}</label>
        {error ? <p role="alert" className="text-xs font-medium text-red-600">{error}</p> : null}
      </div>
    );
  }
  if (field.type === 'RADIO') {
    return (
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{field.label}{field.required ? ' *' : ''}</legend>
        {field.options?.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm"><input type="radio" name={id} checked={value === option} onChange={() => onChange(option)} />{option}</label>
        ))}
        {error ? <p role="alert" className="text-xs font-medium text-red-600">{error}</p> : null}
      </fieldset>
    );
  }
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} htmlFor={id} error={error}>
      {field.type === 'SELECT' ? (
        <Select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" />
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      ) : field.type === 'TEXTAREA' ? (
        <textarea id={id} rows={4} className="w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

/**
 * Public registration: category first, then the form the organiser configured for it,
 * then consent. Server-side validation is authoritative; the field errors it returns are
 * shown next to each control.
 */
export default function EventRegistrationPage(): JSX.Element {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { t } = useI18n();
  const context = useQuery({ queryKey: queryKeys.publicEvent(eventSlug), queryFn: () => eventsApi.publicContext(eventSlug), retry: false });
  const form = useQuery({ queryKey: ['registration-form', eventSlug], queryFn: () => publicApi.form(eventSlug), retry: false });

  const [categoryKey, setCategoryKey] = useState('');
  const [person, setPerson] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublicRegistrationResult | null>(null);
  // One key per form instance: a double click or a retry after a timeout cannot register twice.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  if (context.isLoading || form.isLoading) return <LoadingState label={t('common.loading')} />;
  if (context.isError || form.isError || !context.data || !form.data) {
    return <div className="mx-auto max-w-lg p-8"><ErrorState title={t('notFound.title')} message={errorMessage(form.error ?? context.error, t('notFound.body'))} /></div>;
  }

  const { organization, branding } = context.data;
  const data = form.data;
  const fields = data.fields.filter((f) => f.categoryKey === null || f.categoryKey === categoryKey);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    setErrors({});
    try {
      setResult(await publicApi.register(eventSlug, { ...person, phone: person.phone || undefined, categoryKey, answers, consent }, idempotencyKey));
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

          {result ? (
            <div role="status" className="mt-6 rounded-brand border border-brand-primary/20 bg-brand-surface p-6">
              <p className="text-lg font-semibold">{result.status === 'CONFIRMED' ? t('reg.doneConfirmed') : t('reg.donePending')}</p>
              <p className="mt-2 text-sm">{t('reg.checkEmail')}</p>
              {result.accessToken ? (
                <Link to={`/participant?token=${encodeURIComponent(result.accessToken)}`} className="mt-4 inline-block"><Button>{t('reg.openSpace')}</Button></Link>
              ) : null}
            </div>
          ) : !data.event.registrationOpen ? (
            <p role="alert" className="mt-6 rounded-brand bg-amber-50 p-4 text-sm">{t('reg.closed')}</p>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={(e) => void submit(e)} noValidate>
              <Field label={`${t('reg.category')} *`} htmlFor="category">
                <Select id="category" required value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
                  <option value="" />
                  {data.categories.map((c) => <option key={c.key} value={c.key} disabled={c.full}>{c.name}{c.full ? ` (${t('reg.full')})` : ''}</option>)}
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${t('reg.firstName')} *`} htmlFor="first"><Input id="first" required value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} /></Field>
                <Field label={`${t('reg.lastName')} *`} htmlFor="last"><Input id="last" required value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} /></Field>
                <Field label={`${t('auth.email')} *`} htmlFor="email"><Input id="email" type="email" required value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} /></Field>
                <Field label={t('reg.phone')} htmlFor="phone"><Input id="phone" type="tel" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} /></Field>
              </div>

              {categoryKey ? fields.map((f) => (
                <FieldControl key={f.id} field={f} value={answers[f.key]} error={errors[f.key]} onChange={(v) => setAnswers({ ...answers, [f.key]: v })} />
              )) : null}

              {data.consent.text ? (
                <div className="rounded-brand bg-brand-surface p-4 text-sm">
                  <p className="whitespace-pre-line">{data.consent.text}</p>
                  <label className="mt-3 flex items-start gap-2 font-medium"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{t('reg.consentLabel')}{data.consent.required ? ' *' : ''}</label>
                </div>
              ) : null}

              {failure ? <p role="alert" className="rounded-brand bg-red-50 p-3 text-sm text-red-700">{failure}</p> : null}
              <Button type="submit" size="lg" disabled={busy || !categoryKey || result !== null}>{busy ? t('common.saving') : t('public.register')}</Button>
            </form>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

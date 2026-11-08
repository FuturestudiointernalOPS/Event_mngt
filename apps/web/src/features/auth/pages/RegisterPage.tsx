import { zodResolver } from '@hookform/resolvers/zod';
import { registerRequestSchema, type RegisterRequest } from '@event-platform/shared';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiRequestError } from '@/services/api-client';
import { authApi } from '@/services/auth.api';

export default function RegisterPage(): JSX.Element {
  const { t } = useI18n();
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await authApi.register({
        email: values.email,
        password: values.password,
        displayName: values.displayName ? values.displayName : undefined,
      });
      setDone(true);
    } catch (error) {
      setFailure(error instanceof ApiRequestError ? error.message : t('common.error'));
    }
  });

  return (
    <ThemeProvider value={null}>
      <div className="flex min-h-screen items-center justify-center bg-brand-background px-4">
        <div className="w-full max-w-sm rounded-brand border border-brand-primary/10 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-brand-text">{t('auth.registerTitle')}</h1>

          {done ? (
            <p role="status" className="mt-6 text-sm text-brand-text">
              {t('auth.checkEmail')}
            </p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
              <Field
                label={t('auth.displayName')}
                htmlFor="displayName"
                error={errors.displayName?.message}
              >
                <Input id="displayName" autoComplete="name" {...register('displayName')} />
              </Field>

              <Field label={t('auth.email')} htmlFor="email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </Field>

              <Field
                label={t('auth.password')}
                htmlFor="password"
                error={errors.password?.message}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
              </Field>

              {failure ? (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {failure}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {t('auth.createAccount')}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-brand-text/70">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-brand-primary underline">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}

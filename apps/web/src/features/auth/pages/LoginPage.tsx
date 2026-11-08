import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@event-platform/shared';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { authApi } from '@/services/auth.api';
import { ApiRequestError } from '@/services/api-client';
import { useSessionStore } from '@/stores/session.store';

export default function LoginPage(): JSX.Element {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const status = useSessionStore((state) => state.status);
  const memberships = useSessionStore((state) => state.memberships);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'authenticated') {
    const first = memberships[0];
    return <Navigate to={first ? `/workspace/${first.organizationSlug}` : '/participant'} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const session = await authApi.login(values);
      const first = session.memberships[0];
      navigate(first ? `/workspace/${first.organizationSlug}` : '/participant', {
        replace: true,
      });
    } catch (error) {
      setFailure(
        error instanceof ApiRequestError ? error.message : t('common.error'),
      );
    }
  });

  return (
    <ThemeProvider value={null}>
      <div className="flex min-h-screen items-center justify-center bg-brand-background px-4">
        <div className="w-full max-w-sm rounded-brand border border-brand-primary/10 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-brand-text">{t('auth.title')}</h1>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
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
                autoComplete="current-password"
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
              {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-6 text-sm text-brand-text/70">
            {t('auth.needAccount')}{' '}
            <Link to="/register" className="font-medium text-brand-primary underline">
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}

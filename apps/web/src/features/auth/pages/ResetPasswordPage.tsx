import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { AuthCard } from '@/components/layout/AuthCard';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiRequestError } from '@/services/api-client';
import { authApi } from '@/services/auth.api';

export default function ResetPasswordPage(): JSX.Element {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(params.get('token') ?? '', password);
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(failure instanceof ApiRequestError ? failure.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('auth.resetTitle')}>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <Field label={t('auth.newPassword')} htmlFor="password" error={error ?? undefined}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {t('common.save')}
        </Button>
      </form>
      <Link to="/login" className="block text-center text-sm text-brand-primary underline">
        {t('auth.signIn')}
      </Link>
    </AuthCard>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { AuthCard } from '@/components/layout/AuthCard';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { authApi } from '@/services/auth.api';

export default function ForgotPasswordPage(): JSX.Element {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      // The same message whether or not the address exists, so accounts cannot be probed.
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('auth.forgotTitle')}>
      {sent ? (
        <p role="status">{t('auth.forgotSent')}</p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <Field label={t('auth.email')} htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {t('auth.sendLink')}
          </Button>
        </form>
      )}
      <Link to="/login" className="block text-center text-sm text-brand-primary underline">
        {t('auth.signIn')}
      </Link>
    </AuthCard>
  );
}

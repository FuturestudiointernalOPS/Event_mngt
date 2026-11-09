import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { AuthCard } from '@/components/layout/AuthCard';
import { Button } from '@/components/ui/button';
import { authApi } from '@/services/auth.api';

type State = 'working' | 'done' | 'failed';

/** Landing page of the e-mailed verification link. The token is single-use. */
export default function VerifyEmailPage(): JSX.Element {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'working' : 'failed');

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    authApi
      .verifyEmail(token)
      .then(() => !cancelled && setState('done'))
      .catch(() => !cancelled && setState('failed'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthCard title={t('auth.verifyTitle')}>
      {state === 'working' ? <p role="status">{t('common.loading')}</p> : null}
      {state === 'done' ? <p role="status">{t('auth.verifyDone')}</p> : null}
      {state === 'failed' ? <p role="alert">{t('auth.verifyFailed')}</p> : null}
      <Link to="/login">
        <Button className="w-full">{t('auth.signIn')}</Button>
      </Link>
    </AuthCard>
  );
}

import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { AuthCard } from '@/components/layout/AuthCard';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/services/api-client';
import { authApi } from '@/services/auth.api';
import { teamApi } from '@/services/team.api';
import { useSessionStore } from '@/stores/session.store';

/** Accepting an invitation requires signing in with the invited e-mail address. */
export default function JoinPage(): JSX.Element {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useSessionStore((state) => state.status);
  const ready = useSessionStore((state) => state.sessionReady);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const workspace = params.get('workspace') ?? '';
  const token = params.get('token') ?? '';

  if (ready && status !== 'authenticated') {
    // Come back here after signing in.
    return <Navigate to={`/login?next=${encodeURIComponent(`/join?workspace=${workspace}&token=${token}`)}`} replace />;
  }

  async function accept(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const joined = await teamApi.acceptInvitation({ workspaceSlug: workspace, token });
      const current = await authApi.me();
      useSessionStore.getState().setUser(current.user, current.memberships);
      navigate(`/workspace/${joined.slug}`, { replace: true });
    } catch (failure) {
      setError(failure instanceof ApiRequestError ? failure.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('team.joinTitle')}>
      <p className="text-sm">{t('team.joinBody', { workspace })}</p>
      {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      <Button className="w-full" onClick={() => void accept()} disabled={busy || !token}>
        {t('team.accept')}
      </Button>
    </AuthCard>
  );
}

import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useI18n } from '@/app/providers/I18nProvider';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/stores/session.store';
import { queryKeys } from '@/lib/query-keys';
import { authApi } from '@/services/auth.api';
import { workspacesApi } from '@/services/workspaces.api';
import type { WorkspaceContext } from '@event-platform/shared';

export interface WorkspaceOutletContext {
  context: WorkspaceContext;
}

/**
 * Tenant shell. Branding is resolved before this renders, so the user never sees a
 * flash of another organisation's colours.
 */
export function WorkspaceShell(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  // Hooks must run before any early return below.
  const permissions = useSessionStore(
    (state) => state.memberships.find((m) => m.organizationSlug === slug)?.permissions ?? [],
  );

  const contextQuery = useQuery({
    queryKey: queryKeys.workspaceContext(slug),
    queryFn: () => workspacesApi.context(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => navigate('/login', { replace: true }),
  });

  if (contextQuery.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (contextQuery.isError || !contextQuery.data) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorState
          title={t('common.error')}
          message={t('workspace.onboarding')}
          onRetry={() => void contextQuery.refetch()}
          retryLabel={t('common.retry')}
        />
      </div>
    );
  }

  const context = contextQuery.data;

  const navigation = [
    { to: `/workspace/${slug}`, label: t('nav.dashboard'), end: true },
    { to: `/workspace/${slug}/events`, label: t('nav.events'), end: false },
    { to: `/workspace/${slug}/team`, label: t('nav.team'), end: false },
    { to: `/workspace/${slug}/settings/branding`, label: t('nav.branding'), end: false },
    ...(permissions.includes('workspace:manage') ? [{ to: `/workspace/${slug}/settings/privacy`, label: t('nav.privacy'), end: false }] : []),
    ...(permissions.includes('audit:read') ? [{ to: `/workspace/${slug}/audit`, label: t('nav.audit'), end: false }] : []),
  ];

  return (
    <ThemeProvider
      value={{ organization: context.organization, branding: context.branding }}
    >
      <div className="min-h-screen bg-brand-background">
        <header className="border-b border-brand-primary/10 bg-brand-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <BrandLogo />
            </div>

            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="locale-switcher">
                Langue
              </label>
              <select
                id="locale-switcher"
                value={locale}
                onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'fr')}
                className="rounded-brand border border-brand-primary/20 bg-white px-2 py-1 text-sm"
              >
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>

              <Link to="/account/security" className="text-sm underline">{t('nav.security')}</Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                {t('nav.signOut')}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
          <nav aria-label="Workspace" className="md:w-56 md:shrink-0">
            <ul className="flex gap-1 overflow-x-auto md:flex-col">
              {navigation.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'block whitespace-nowrap rounded-brand px-3 py-2 text-sm font-medium',
                        isActive
                          ? 'bg-brand-primary text-white'
                          : 'text-brand-text/80 hover:bg-brand-surface',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <main className="min-w-0 flex-1">
            <Outlet context={{ context } satisfies WorkspaceOutletContext} />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

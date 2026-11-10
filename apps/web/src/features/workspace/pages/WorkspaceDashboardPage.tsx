import { Link, useOutletContext } from 'react-router-dom';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import type { WorkspaceOutletContext } from '@/components/layout/WorkspaceShell';

export default function WorkspaceDashboardPage(): JSX.Element {
  const { t } = useI18n();
  const { context, can } = useOutletContext<WorkspaceOutletContext>();
  const slug = context.organization.slug;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-text">
          {t('workspace.dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-brand-text/70">
          {t('workspace.dashboard.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {can(CAPABILITY_KEYS.eventsView) ? (
          <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-text">{t('events.title')}</h2>
            <p className="mt-1 text-xs text-brand-text/60">{t('events.empty')}</p>
            <Link to={`/workspace/${slug}/events`} className="mt-4 inline-block">
              <Button size="sm" variant="secondary">
                {t('nav.events')}
              </Button>
            </Link>
          </section>
        ) : null}

        {can(CAPABILITY_KEYS.organizationManageBranding) ? (
          <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-text">
              {t('workspace.branding.title')}
            </h2>
            <p className="mt-1 text-xs text-brand-text/60">
              {t('workspace.branding.subtitle')}
            </p>
            <Link
              to={`/workspace/${slug}/settings/branding`}
              className="mt-4 inline-block"
            >
              <Button size="sm" variant="secondary">
                {t('nav.branding')}
              </Button>
            </Link>
          </section>
        ) : null}

        {can(CAPABILITY_KEYS.organizationViewMembers) ? (
          <section className="rounded-brand border border-brand-primary/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-text">{t('access.title')}</h2>
            <p className="mt-1 text-xs text-brand-text/60">{t('access.subtitle')}</p>
            <Link
              to={`/workspace/${slug}/settings/access`}
              className="mt-4 inline-block"
            >
              <Button size="sm" variant="secondary">
                {t('nav.access')}
              </Button>
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}

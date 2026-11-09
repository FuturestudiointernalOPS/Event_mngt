import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/components/branding/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Pill, Section, Stat } from '@/components/ui/section';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { platformApi } from '@/services/staff-ops.api';

/** Super Admin console, themed with the platform's own (neutral) brand, never a tenant's. */
export default function PlatformAdminPage(): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ['platform-overview'], queryFn: platformApi.overview, retry: false });
  const modules = useQuery({ queryKey: ['platform-modules'], queryFn: platformApi.modules, retry: false });
  const setModule = useMutation({
    mutationFn: (i: { key: string; available: boolean }) => platformApi.setModule(i.key, i.available),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-modules'] }),
  });
  const setStatus = useMutation({
    mutationFn: (i: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) => platformApi.setStatus(i.id, i.status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-overview'] }),
  });

  return (
    <ThemeProvider value={null}>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('platform.title')}</h1>
          <p className="text-sm text-brand-text/70">{t('platform.subtitle')}</p>
        </div>
        {overview.isLoading ? <LoadingState label={t('common.loading')} /> : null}
        {overview.isError ? <ErrorState title={t('common.error')} message={errorMessage(overview.error, t('common.error'))} /> : null}
        {overview.data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label={t('platform.organisations')} value={`${overview.data.organisations.active} / ${overview.data.organisations.total}`} />
              <Stat label={t('nav.events')} value={overview.data.events} />
              <Stat label={t('reports.registrations')} value={overview.data.registrations} />
            </div>
            <Section title={t('platform.organisations')}>
              <ul className="divide-y divide-brand-primary/10">
                {overview.data.organisationList.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span><strong>{o.name}</strong> <span className="text-xs text-brand-text/70">/{o.slug} · {o.events} {t('nav.events').toLowerCase()}</span></span>
                    <span className="flex items-center gap-2">
                      <Pill>{statusLabel(o.status)}</Pill>
                      <Button size="sm" variant={o.status === 'ACTIVE' ? 'danger' : 'secondary'} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: o.id, status: o.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>
                        {o.status === 'ACTIVE' ? t('team.suspend') : t('team.activate')}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title={t('platform.modules')}>
              <p className="mb-3 text-xs text-brand-text/70">{t('platform.modulesHint')}</p>
              <ul className="divide-y divide-brand-primary/10">
                {modules.data?.map((m) => (
                  <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span>{m.name} <Pill>{m.priority.toUpperCase()}</Pill></span>
                    {m.locked ? <Pill>{m.priority === 'core' ? t('event.alwaysOn') : t('event.comingSoon')}</Pill> : (
                      <Button size="sm" variant={m.available ? 'secondary' : 'primary'} disabled={setModule.isPending} onClick={() => setModule.mutate({ key: m.key, available: !m.available })}>
                        {m.available ? t('event.disable') : t('event.enable')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          </>
        ) : null}
      </div>
    </ThemeProvider>
  );
}

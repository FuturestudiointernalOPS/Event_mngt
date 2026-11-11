import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { auditApi } from '@/services/staff-ops.api';

/** Read-only trail of who did what, newest first. */
export default function AuditPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const log = useQuery({ queryKey: ['audit', slug, page], queryFn: () => auditApi.list(slug, page), retry: false });

  if (log.isLoading) return <LoadingState label={t('common.loading')} />;
  if (log.isError || !log.data) return <ErrorState message={t('common.error')} onRetry={() => void log.refetch()} retryLabel={t('common.retry')} />;
  const pages = Math.max(1, Math.ceil(log.data.total / log.data.pageSize));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('audit.title')}</h1>
      <Section title={t('audit.recent')}>
        {log.data.items.length === 0 ? <EmptyState title={t('common.empty')} /> : (
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-brand-text/70"><th className="pb-2">{t('audit.when')}</th><th>{t('audit.action')}</th><th>{t('audit.who')}</th></tr></thead>
            <tbody>
              {log.data.items.map((row) => (
                <tr key={row.id} className="border-t border-brand-primary/10">
                  <td className="py-2 pr-3 text-xs">{new Date(row.createdAt).toLocaleString(locale)}</td>
                  <td className="pr-3 font-mono text-xs">{row.action}</td>
                  <td className="text-xs">{row.actor?.email ?? t('audit.system')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
            <span>{page} / {pages}</span>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</Button>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

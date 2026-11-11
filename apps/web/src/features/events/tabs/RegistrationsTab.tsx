import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Pill, Section } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { eventAdminApi } from '@/services/event-admin.api';
import { BadgePanel } from '../components/BadgePanel';
import type { EventOutletContext } from '../pages/EventLayout';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED'];

/** Staff review: filter, read the answers and consent, approve or reject. */
export default function RegistrationsTab(): JSX.Element {
  const { slug, eventId, can } = useOutletContext<EventOutletContext>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canApprove = can('registrations.approve');
  const canReject = can('registrations.reject');
  const canErase = can('registrations.erase');
  const canViewBadge = can('registrations.view_badges');
  const canManageBadge = can('registrations.manage_badges');

  const list = useQuery({
    queryKey: ['registrations', slug, eventId, status, search, page],
    queryFn: () => eventAdminApi.registrations(slug, eventId, { status: status || undefined, search: search || undefined, page }),
  });
  const detail = useQuery({
    queryKey: ['registration', slug, eventId, openId],
    queryFn: () => eventAdminApi.registration(slug, eventId, openId ?? ''),
    enabled: openId !== null,
  });

  const reload = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['registrations', slug, eventId] });
    void queryClient.invalidateQueries({ queryKey: ['registration', slug, eventId] });
  };
  const decide = useMutation({
    mutationFn: (input: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      input.decision === 'APPROVED'
        ? eventAdminApi.approve(slug, eventId, input.id, {})
        : eventAdminApi.reject(slug, eventId, input.id, {}),
    onSuccess: () => { setError(null); reload(); },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  const erase = useMutation({
    mutationFn: (id: string) => eventAdminApi.erase(slug, eventId, id),
    onSuccess: () => { setError(null); reload(); },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <Section
      title={t('event.tab.registrations')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Input aria-label={t('common.search')} placeholder={t('common.search')} className="w-48" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select aria-label={t('events.status')} className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t('common.all')}</option>
            {STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </Select>
        </div>
      }
    >
      {error ? <p role="alert" className="mb-3 rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {list.isLoading ? <LoadingState label={t('common.loading')} /> : null}
      {list.data && list.data.items.length === 0 ? <EmptyState title={t('common.empty')} /> : null}

      <ul className="divide-y divide-brand-primary/10">
        {list.data?.items.map((row) => (
          <li key={row.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="text-left" onClick={() => setOpenId(openId === row.id ? null : row.id)}>
                <p className="text-sm font-medium">{row.person.firstName} {row.person.lastName}</p>
                <p className="text-xs text-brand-text/70">
                  {row.person.email}{row.category ? ` · ${row.category.name}` : ''}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <Pill>{statusLabel(row.status)}</Pill>
                {canApprove && row.status === 'PENDING' ? (
                  <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'APPROVED' })}>{t('reg.confirm')}</Button>
                ) : null}
                {canReject && row.status === 'PENDING' ? (
                  <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'REJECTED' })}>{t('reg.reject')}</Button>
                ) : null}
                {canErase && !row.person.email.endsWith('@erased.invalid') ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={erase.isPending}
                    onClick={() => { if (window.confirm(t('reg.eraseConfirm'))) erase.mutate(row.id); }}
                  >
                    {t('reg.erase')}
                  </Button>
                ) : null}
              </div>
            </div>
            {openId === row.id && detail.data ? (
              <dl className="mt-3 grid gap-1 rounded-brand bg-brand-surface p-3 text-xs sm:grid-cols-2">
                {detail.data.person.phone ? <div><dt className="font-medium">{t('reg.phone')}</dt><dd>{detail.data.person.phone}</dd></div> : null}
                {detail.data.answers.map((answer) => (
                  <div key={answer.fieldKey}><dt className="font-medium">{answer.fieldKey}</dt><dd>{String(answer.value)}</dd></div>
                ))}
                {detail.data.consents.map((consent) => (
                  <div key={`${consent.key}-${consent.version}`}><dt className="font-medium">{t('reg.consent')} {consent.key} v{consent.version}</dt><dd>{new Date(consent.acceptedAt).toLocaleString()}</dd></div>
                ))}
              </dl>
            ) : null}
            {openId === row.id && row.status === 'APPROVED' && canViewBadge ? (
              <BadgePanel slug={slug} eventId={eventId} registrationId={row.id} canManage={canManageBadge} />
            ) : null}
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span>{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      ) : null}
    </Section>
  );
}

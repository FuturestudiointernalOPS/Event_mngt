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
import type { EventOutletContext } from '../pages/EventLayout';

/** Staff review: filter, read the answers and consent, confirm / reject / cancel. */
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
  const canManage = can('registration:manage');

  const list = useQuery({
    queryKey: ['registrations', slug, eventId, status, search, page],
    queryFn: () => eventAdminApi.registrations(slug, eventId, { status: status || undefined, search: search || undefined, page }),
  });
  const detail = useQuery({
    queryKey: ['registration', slug, eventId, openId],
    queryFn: () => eventAdminApi.registration(slug, eventId, openId ?? ''),
    enabled: openId !== null,
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: 'CONFIRM' | 'REJECT' | 'CANCEL' }) =>
      eventAdminApi.decide(slug, eventId, input.id, { decision: input.decision }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['registrations', slug, eventId] });
      void queryClient.invalidateQueries({ queryKey: ['registration', slug, eventId] });
    },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });
  const erase = useMutation({
    mutationFn: (id: string) => eventAdminApi.erase(slug, eventId, id),
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['registrations', slug, eventId] }); },
    onError: (e) => setError(errorMessage(e, t('common.error'))),
  });
  const resend = useMutation({
    mutationFn: (id: string) => eventAdminApi.resendAccess(slug, eventId, id),
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
            {['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        </div>
      }
    >
      {error ? <p role="alert" className="mb-3 rounded-brand bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {list.isLoading ? <LoadingState label={t('common.loading')} /> : null}
      {list.data && list.data.items.length === 0 ? <EmptyState title={t('common.empty')} /> : null}

      <ul className="divide-y divide-brand-primary/10">
        {list.data?.items.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                <p className="text-xs text-brand-text/70">{r.email} · {r.categoryName}</p>
              </button>
              <div className="flex items-center gap-2">
                <Pill>{statusLabel(r.status)}</Pill>
                {r.checkedIn ? <Pill>{t('checkin.checkedIn')}</Pill> : null}
                {canManage && r.status === 'PENDING' ? (
                  <>
                    <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'CONFIRM' })}>{t('reg.confirm')}</Button>
                    <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'REJECT' })}>{t('reg.reject')}</Button>
                  </>
                ) : null}
                {canManage && ['PENDING', 'CONFIRMED'].includes(r.status) ? (
                  <Button size="sm" variant="ghost" onClick={() => resend.mutate(r.id)}>{t('reg.resend')}</Button>
                ) : null}
                {canManage && !r.email.endsWith('@erased.invalid') ? (
                  <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t('reg.eraseConfirm'))) erase.mutate(r.id); }}>{t('reg.erase')}</Button>
                ) : null}
                {canManage && r.status === 'CONFIRMED' ? (
                  <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: r.id, decision: 'CANCEL' })}>{t('event.cancel')}</Button>
                ) : null}
              </div>
            </div>
            {openId === r.id && detail.data ? (
              <dl className="mt-3 grid gap-1 rounded-brand bg-brand-surface p-3 text-xs sm:grid-cols-2">
                {detail.data.phone ? <div><dt className="font-medium">{t('reg.phone')}</dt><dd>{detail.data.phone}</dd></div> : null}
                {Object.entries(detail.data.answers).map(([key, value]) => (
                  <div key={key}><dt className="font-medium">{key}</dt><dd>{String(value)}</dd></div>
                ))}
                {detail.data.consents.map((c) => (
                  <div key={c.createdAt}><dt className="font-medium">{t('reg.consent')} v{c.policyVersion}</dt><dd>{c.granted ? t('common.yes') : t('common.no')}</dd></div>
                ))}
              </dl>
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

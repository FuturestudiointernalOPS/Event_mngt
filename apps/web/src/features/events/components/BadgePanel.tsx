import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { badgeQrPayload, type IssuedBadge } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/section';
import { errorMessage } from '@/lib/errors';
import { useStatusLabel } from '@/lib/status';
import { ApiRequestError } from '@/services/api-client';
import { eventAdminApi } from '@/services/event-admin.api';

/** The QR a freshly issued badge encodes, drawn locally (no third-party QR service). */
function IssuedBadgeCard({ badge, onDone }: { badge: IssuedBadge; onDone: () => void }): JSX.Element {
  const { t } = useI18n();
  const payload = badgeQrPayload(badge.token);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [payload]);

  return (
    <div role="status" className="mt-3 space-y-2 rounded-brand border border-brand-primary/20 bg-white p-4 text-center">
      <p className="text-sm font-medium">{t('badge.showOnce')}</p>
      {src ? <img src={src} alt={`QR ${badge.reference}`} className="mx-auto h-48 w-48" /> : null}
      <p className="break-all font-mono text-xs">{payload}</p>
      <div className="flex justify-center gap-2 print:hidden">
        <Button size="sm" variant="secondary" onClick={() => window.print()}>{t('badge.print')}</Button>
        <Button size="sm" onClick={onDone}>{t('badge.done')}</Button>
      </div>
    </div>
  );
}

/** Staff view of one registration's badge: state, reissue (shows the code once) and revoke. */
export function BadgePanel({
  slug,
  eventId,
  registrationId,
  canManage,
}: {
  slug: string;
  eventId: string;
  registrationId: string;
  canManage: boolean;
}): JSX.Element {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<IssuedBadge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ['badge', slug, eventId, registrationId];

  const badge = useQuery({
    queryKey: key,
    queryFn: () => eventAdminApi.badge(slug, eventId, registrationId),
    retry: false,
  });
  const noBadge = badge.error instanceof ApiRequestError && badge.error.status === 404;

  const onError = (e: unknown): void => setError(errorMessage(e, t('common.error')));
  const reissue = useMutation({
    mutationFn: () => eventAdminApi.reissueBadge(slug, eventId, registrationId),
    onSuccess: (result) => { setError(null); setIssued(result); void queryClient.invalidateQueries({ queryKey: key }); },
    onError,
  });
  const revoke = useMutation({
    mutationFn: () => eventAdminApi.revokeBadge(slug, eventId, registrationId),
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: key }); },
    onError,
  });

  return (
    <div className="mt-3 rounded-brand border border-brand-primary/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('badge.title')}</p>
        {badge.data ? <Pill>{statusLabel(badge.data.status)}</Pill> : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
      {badge.isLoading ? <p className="mt-2 text-xs">{t('common.loading')}</p> : null}
      {noBadge ? <p className="mt-2 text-xs text-brand-text/70">{t('badge.none')}</p> : null}
      {badge.data ? (
        <p className="mt-2 text-xs text-brand-text/70">
          {t('badge.reference')}: {badge.data.reference} · {t('badge.reissues', { count: badge.data.reissueCount })}
        </p>
      ) : null}
      {canManage && (badge.data || noBadge) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={reissue.isPending}
            onClick={() => { if (!badge.data || window.confirm(t('badge.reissueConfirm'))) reissue.mutate(); }}
          >
            {badge.data ? t('badge.reissue') : t('badge.issue')}
          </Button>
          {badge.data?.status === 'ISSUED' ? (
            <Button size="sm" variant="danger" disabled={revoke.isPending} onClick={() => { if (window.confirm(t('badge.revokeConfirm'))) revoke.mutate(); }}>
              {t('badge.revoke')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {issued ? <IssuedBadgeCard badge={issued} onDone={() => setIssued(null)} /> : null}
    </div>
  );
}

import { useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { errorMessage } from '@/lib/errors';
import { participantApi } from '@/services/participant.api';

/** The participant's own data rights: download, withdraw, erase. Withdraw and erase are final. */
export function MyDataSection({ canWithdraw, onGone }: { canWithdraw: boolean; onGone: (kind: 'withdrawn' | 'erased') => void }): JSX.Element {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function download(): Promise<void> {
    try {
      const blob = new Blob([JSON.stringify(await participantApi.exportData(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'my-data.json';
      link.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t('common.error')));
    }
  }

  async function leave(kind: 'withdrawn' | 'erased'): Promise<void> {
    if (!window.confirm(t(kind === 'withdrawn' ? 'participant.withdrawConfirm' : 'participant.eraseConfirm'))) return;
    try {
      await (kind === 'withdrawn' ? participantApi.withdraw() : participantApi.erase());
      onGone(kind);
    } catch (e) {
      setError(errorMessage(e, t('common.error')));
    }
  }

  return (
    <Section title={t('participant.myData')}>
      {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
      <p className="mb-3 text-xs text-brand-text/70">{t('participant.myDataHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void download()}>{t('participant.download')}</Button>
        {canWithdraw ? <Button size="sm" variant="secondary" onClick={() => void leave('withdrawn')}>{t('participant.withdraw')}</Button> : null}
        <Button size="sm" variant="danger" onClick={() => void leave('erased')}>{t('participant.eraseMine')}</Button>
      </div>
    </Section>
  );
}

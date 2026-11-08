import { useI18n } from '@/app/providers/I18nProvider';

export default function PlatformAdminPage(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-brand-text">{t('platform.title')}</h1>
      <p className="text-sm text-brand-text/70">{t('platform.subtitle')}</p>
      <p className="rounded-brand bg-brand-surface p-4 text-xs text-brand-text/60">
        Cross-tenant views are the only code paths allowed to bypass tenant predicates.
        They are audited and gated by platform permissions that no organisation role
        holds. Organisation management arrives in Phase 2.
      </p>
    </div>
  );
}

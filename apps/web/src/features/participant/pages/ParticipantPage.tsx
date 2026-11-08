import { useI18n } from '@/app/providers/I18nProvider';

export default function ParticipantPage(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-brand-text">{t('participant.title')}</h1>
      <p className="text-sm text-brand-text/70">{t('participant.subtitle')}</p>
      <p className="rounded-brand bg-brand-surface p-4 text-xs text-brand-text/60">
        Participant accounts are optional: public registration does not require one.
        Badges, profiles, meetings and introduction requests arrive in Phases 4 and 5.
      </p>
    </div>
  );
}

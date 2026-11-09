import { useI18n } from '@/app/providers/I18nProvider';
import type { TranslationKey } from '@/lib/i18n';

/** Translates a status code (e.g. PENDING, PUBLISHED); an unknown code is shown as-is. */
export function useStatusLabel(): (status: string) => string {
  const { t } = useI18n();
  return (status) => {
    const label = t(`status.${status}` as TranslationKey) as string | undefined;
    return label ?? status;
  };
}

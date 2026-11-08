import type { Locale } from '@event-platform/shared';
import { en } from '../locales/en';
import type { TranslationKey } from '../locales/en';
import { fr } from '../locales/fr';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, fr };

const LOCALE_STORAGE_KEY = 'ep.locale';

export function translate(
  locale: Locale,
  key: TranslationKey,
  variables?: Record<string, string | number>,
): string {
  const template = dictionaries[locale]?.[key] ?? en[key];

  if (!variables) {
    return template;
  }

  return Object.entries(variables).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function resolveInitialLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') {
    return stored;
  }
  return window.navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function persistLocale(locale: Locale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export type { TranslationKey };

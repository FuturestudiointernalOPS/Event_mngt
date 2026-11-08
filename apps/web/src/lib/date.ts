export function formatDateTime(
  isoValue: string,
  timeZone: string,
  locale: 'fr' | 'en',
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(isoValue));
  } catch {
    return isoValue;
  }
}

export function formatDateRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  locale: 'fr' | 'en',
): string {
  const start = formatDateTime(startsAt, timeZone, locale);
  const end = formatDateTime(endsAt, timeZone, locale);
  return `${start} → ${end}`;
}

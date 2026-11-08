/**
 * URL-safe slug for event and workspace identifiers.
 * Accents are folded so French titles produce usable slugs.
 */
export function slugify(value: string, maxLength = 60): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Appends -2, -3, ... until the slug is free. `exists` performs the lookup.
 */
export async function ensureUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'event';
  let candidate = root;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

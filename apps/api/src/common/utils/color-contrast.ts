/**
 * WCAG contrast helpers used by the branding validator.
 * Kept dependency-free: branding validation must not depend on a UI library.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(value: string): Rgb | null {
  const hex = value.trim().replace('#', '');
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((character) => character + character)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two hex colours, or null when a value cannot be parsed. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);

  if (!fg || !bg) {
    return null;
  }

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));

  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG_AA_NORMAL_TEXT = 4.5;

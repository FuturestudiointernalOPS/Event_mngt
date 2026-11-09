/** Groups smaller than this are never published: they could identify individuals. */
export const ANONYMITY_THRESHOLD = 5;

/** Returns the count, or null when it is small enough to risk identifying someone. */
export function publishableCount(count: number, threshold = ANONYMITY_THRESHOLD): number | null {
  return count >= threshold ? count : null;
}

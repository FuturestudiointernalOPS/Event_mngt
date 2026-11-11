/**
 * The date before which an event counts as expired for data retention.
 * An event whose end is strictly earlier than this cut-off has outlived its retention
 * period. Calendar months are used so "12 months" means the same day a year earlier.
 */
export function retentionCutoff(now: Date, retentionMonths: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);
  return cutoff;
}

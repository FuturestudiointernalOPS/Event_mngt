import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_BUDGETS } from './rate-limit.budgets';

const ALL_BUDGETS = Object.values(RATE_LIMIT_BUDGETS).flatMap((surface) =>
  Object.values(surface),
);

describe('production rate-limit budgets', () => {
  it('gives every declared budget a positive limit and window', () => {
    for (const bucket of ALL_BUDGETS) {
      expect(bucket.length).toBeGreaterThan(0);
      for (const budget of bucket) {
        expect(budget.limit).toBeGreaterThan(0);
        expect(budget.windowSeconds).toBeGreaterThan(0);
        expect(budget.bucket.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps bucket names unique so tuning one route cannot affect another', () => {
    const names = ALL_BUDGETS.flatMap((bucket) =>
      bucket.map((entry: { bucket: string }) => entry.bucket),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('keys sensitive account actions by account rather than address', () => {
    const expectUserKey = (budget: readonly { key: string }[]) => {
      expect(budget.map((entry) => entry.key)).toContain('user');
    };

    expectUserKey(RATE_LIMIT_BUDGETS.auth.mfaEnable);
    expectUserKey(RATE_LIMIT_BUDGETS.workspace.invite);
    expectUserKey(RATE_LIMIT_BUDGETS.workspace.reportExport);
    expectUserKey(RATE_LIMIT_BUDGETS.operations.checkInSync);
  });
});

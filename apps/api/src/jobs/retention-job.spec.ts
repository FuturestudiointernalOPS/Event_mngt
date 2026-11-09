import { describe, expect, it, vi } from 'vitest';
import { runRetentionSweep } from './retention-job';

describe('runRetentionSweep', () => {
  it('purges every configured organisation inside its own scope and totals the result', async () => {
    const purge = vi.fn().mockResolvedValueOnce({ erased: 3 }).mockResolvedValueOnce({ erased: 2 });
    const result = await runRetentionSweep({
      listOrganizations: async () => [
        { organizationId: 'a', retentionMonths: 6 },
        { organizationId: 'b', retentionMonths: 12 },
      ],
      purge,
    });

    expect(result).toEqual({ organisations: 2, erased: 5, failed: 0 });
    expect(purge.mock.calls.map(([ctx]) => ctx.organizationId)).toEqual(['a', 'b']);
  });

  it('keeps going when one organisation fails, and reports it', async () => {
    const onError = vi.fn();
    const result = await runRetentionSweep({
      listOrganizations: async () => [
        { organizationId: 'bad', retentionMonths: 6 },
        { organizationId: 'good', retentionMonths: 6 },
      ],
      purge: async (ctx) => {
        if (ctx.organizationId === 'bad') throw new Error('boom');
        return { erased: 1 };
      },
      onError,
    });

    expect(result).toEqual({ organisations: 2, erased: 1, failed: 1 });
    expect(onError).toHaveBeenCalledWith('bad', expect.any(Error));
  });

  it('does nothing when no organisation configured retention', async () => {
    expect(await runRetentionSweep({ listOrganizations: async () => [], purge: async () => ({ erased: 9 }) })).toEqual({ organisations: 0, erased: 0, failed: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import {
  assertOfflineAllowed,
  maxClockSkewMinutes,
  normaliseScannedAt,
  offlineAllowed,
  sortScansByScannedAt,
} from './check-in.sync.rules';

describe('offline sync rules', () => {
  it('allows offline sync unless the module turns it off', () => {
    expect(offlineAllowed({})).toBe(true);
    expect(offlineAllowed({ allowOffline: true })).toBe(true);
    expect(offlineAllowed({ allowOffline: false })).toBe(false);
    expect(() => assertOfflineAllowed({ allowOffline: false })).toThrowError(
      AppException,
    );
  });

  it('falls back to the documented clock skew', () => {
    expect(maxClockSkewMinutes({})).toBe(5);
    expect(maxClockSkewMinutes({ maxClockSkewMinutes: 12 })).toBe(12);
    expect(maxClockSkewMinutes({ maxClockSkewMinutes: -1 })).toBe(5);
    expect(maxClockSkewMinutes({ maxClockSkewMinutes: 'soon' })).toBe(5);
  });

  it('orders a batch by scannedAt without mutating the input', () => {
    const scans = [
      { scanId: 'b', scannedAt: '2026-11-10T10:00:00.000Z' },
      { scanId: 'a', scannedAt: '2026-11-10T09:00:00.000Z' },
      { scanId: 'c', scannedAt: '2026-11-10T11:00:00.000Z' },
    ];

    expect(sortScansByScannedAt(scans).map((scan) => scan.scanId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(scans.map((scan) => scan.scanId)).toEqual(['b', 'a', 'c']);
  });

  it('keeps a plausible device timestamp', () => {
    const receivedAt = new Date('2026-11-10T10:00:00.000Z');
    const scannedAt = normaliseScannedAt(
      '2026-11-10T09:58:00.000Z',
      receivedAt,
      5,
    );

    expect(scannedAt.toISOString()).toBe('2026-11-10T09:58:00.000Z');
  });

  it('replaces a timestamp beyond the allowed future skew', () => {
    const receivedAt = new Date('2026-11-10T10:00:00.000Z');
    const scannedAt = normaliseScannedAt(
      '2026-11-10T10:30:00.000Z',
      receivedAt,
      5,
    );

    expect(scannedAt).toBe(receivedAt);
  });
});

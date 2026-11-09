import { describe, expect, it } from 'vitest';
import { sha256Hex } from './manifest-store';

describe('sha256Hex', () => {
  it('matches the known SHA-256 test vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is stable, so a device hash equals the server manifest hash', async () => {
    expect(await sha256Hex('EP1.some-id.signature')).toBe(await sha256Hex('EP1.some-id.signature'));
  });
});

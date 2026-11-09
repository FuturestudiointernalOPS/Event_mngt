import { describe, expect, it } from 'vitest';
import { publishableCount } from './anonymity';

describe('publishableCount', () => {
  it('hides small groups and shows large ones', () => {
    expect(publishableCount(4)).toBeNull();
    expect(publishableCount(1)).toBeNull();
    expect(publishableCount(5)).toBe(5);
    expect(publishableCount(120)).toBe(120);
  });

  it('hides zero so an empty group is indistinguishable from a small one', () => {
    expect(publishableCount(0)).toBeNull();
  });
});

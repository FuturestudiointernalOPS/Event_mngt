import { describe, expect, it } from 'vitest';
import { toBrandOverrides } from './events.mapper';

describe('toBrandOverrides', () => {
  it('returns valid colour overrides', () => {
    expect(toBrandOverrides({ primaryColor: '#112233' })).toEqual({ primaryColor: '#112233' });
  });

  it('reads null, empty and malformed values as no override', () => {
    expect(toBrandOverrides(null)).toBeNull();
    expect(toBrandOverrides({})).toBeNull();
    expect(toBrandOverrides({ primaryColor: 'red; background:url(x)' })).toBeNull();
  });
});

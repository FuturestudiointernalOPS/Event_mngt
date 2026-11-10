import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { assertCanBeParent } from './editions.rules';

function capture(fn: () => void): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to throw');
}

describe('assertCanBeParent', () => {
  it('accepts a top-level event as a parent', () => {
    expect(() => assertCanBeParent({ parentEventId: null })).not.toThrow();
  });

  it('refuses an edition of an edition', () => {
    expect(capture(() => assertCanBeParent({ parentEventId: 'parent' })).code).toBe(
      'invalid_reference',
    );
  });
});

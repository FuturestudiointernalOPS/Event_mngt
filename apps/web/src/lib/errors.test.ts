import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/services/api-client';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it("uses the API's own message for API errors", () => {
    expect(errorMessage(new ApiRequestError(422, 'consent_required', 'Accept the consent.'), 'fallback')).toBe('Accept the consent.');
  });

  it('falls back for anything else, without leaking internals', () => {
    expect(errorMessage(new TypeError('x is undefined'), 'Something went wrong.')).toBe('Something went wrong.');
    expect(errorMessage('boom', 'Something went wrong.')).toBe('Something went wrong.');
  });
});

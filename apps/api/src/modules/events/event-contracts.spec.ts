import { describe, expect, it } from 'vitest';
import { createEventRequestSchema, updateEventRequestSchema } from '@event-platform/shared';

describe('event request schemas', () => {
  it('does not inject defaults into a partial update (regression)', () => {
    // Previously a PATCH of { name } came back with format and visibility filled in,
    // silently resetting a public event to PRIVATE.
    expect(updateEventRequestSchema.parse({ name: 'New name' })).toEqual({ name: 'New name' });
  });

  it('still applies defaults when creating an event', () => {
    const created = createEventRequestSchema.parse({
      name: 'Summit',
      timeZone: 'Africa/Porto-Novo',
      startsAt: '2026-06-01T09:00:00+01:00',
      endsAt: '2026-06-01T17:00:00+01:00',
    });

    expect(created.format).toBe('IN_PERSON');
    expect(created.visibility).toBe('PRIVATE');
  });
});

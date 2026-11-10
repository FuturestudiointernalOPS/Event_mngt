import type { CheckIn } from '@event-platform/shared';
import type { CheckInWithParticipant } from './check-ins.repository';

/**
 * Row → contract. The raw badge token is not part of any row shape this mapper sees,
 * so it cannot leak into a response.
 */
export function toCheckIn(
  row: CheckInWithParticipant,
  duplicate: boolean,
): CheckIn {
  return {
    id: row.id,
    registrationId: row.registrationId,
    reference: row.registration.reference,
    participant: {
      displayName: `${row.registration.person.firstName} ${row.registration.person.lastName}`.trim(),
      category: row.registration.category ? row.registration.category.name : null,
    },
    source: row.source,
    scannedAt: row.scannedAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    duplicate,
  };
}

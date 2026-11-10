import type {
  IntroductionProfile,
  IntroductionRequest as IntroductionRequestContract,
  IntroductionRequestDetail,
  IntroductionStatusHistory as IntroductionStatusHistoryContract,
} from '@event-platform/shared';
import type {
  IntroductionDetailRow,
  IntroductionProfileRow,
  IntroductionRequestRow,
} from './introductions.repository';
import type { IntroductionStatusHistory } from '../../database/prisma-client';

/** Row → contract. The display name is the only personal field the queue needs. */

function toProfile(profile: IntroductionProfileRow): IntroductionProfile {
  return {
    id: profile.id,
    displayName: `${profile.registration.person.firstName} ${profile.registration.person.lastName}`.trim(),
  };
}

function toHistory(
  row: IntroductionStatusHistory,
): IntroductionStatusHistoryContract {
  return {
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorUserId: row.actorUserId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toIntroductionRequest(
  row: IntroductionRequestRow,
): IntroductionRequestContract {
  return {
    id: row.id,
    requestingProfile: toProfile(row.requestingProfile),
    reason: row.reason,
    offeredHelp: row.offeredHelp,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    outcome: row.outcome,
    outcomeNotes: row.outcomeNotes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toIntroductionRequestDetail(
  row: IntroductionDetailRow,
): IntroductionRequestDetail {
  return {
    ...toIntroductionRequest(row),
    history: row.statusHistory.map(toHistory),
  };
}

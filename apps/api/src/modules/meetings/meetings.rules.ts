import { AppException } from '../../common/app-exception';
import { MeetingStatus } from '../../database/prisma-client';

/**
 * Meeting state machine and proposal limits (WP-17), as pure functions.
 *
 * The staff routes and the future participant slice call the same helpers, so the two
 * surfaces cannot disagree about what is legal.
 */

export type MeetingAction = 'accept' | 'decline' | 'cancel' | 'complete';

const TARGET: Record<MeetingAction, MeetingStatus> = {
  accept: MeetingStatus.ACCEPTED,
  decline: MeetingStatus.DECLINED,
  cancel: MeetingStatus.CANCELLED,
  complete: MeetingStatus.COMPLETED,
};

const ALLOWED: Record<MeetingStatus, readonly MeetingStatus[]> = {
  [MeetingStatus.PROPOSED]: [
    MeetingStatus.ACCEPTED,
    MeetingStatus.DECLINED,
    MeetingStatus.CANCELLED,
  ],
  [MeetingStatus.ACCEPTED]: [
    MeetingStatus.COMPLETED,
    MeetingStatus.CANCELLED,
  ],
  [MeetingStatus.DECLINED]: [],
  [MeetingStatus.CANCELLED]: [],
  [MeetingStatus.COMPLETED]: [],
};

/** The state an accepted action moves to, whether or not it is currently legal. */
export function targetStatus(action: MeetingAction): MeetingStatus {
  return TARGET[action];
}

export function assertMeetingTransition(
  status: MeetingStatus,
  action: MeetingAction,
): MeetingStatus {
  const target = TARGET[action];

  if (!ALLOWED[status].includes(target)) {
    throw AppException.unprocessable(
      'invalid_transition',
      `A meeting that is ${status.toLowerCase()} cannot become ${target.toLowerCase()}.`,
    );
  }

  return target;
}

/** A profile may not be paired with itself; the two parties must be distinct. */
export function assertDistinctProfiles(
  proposerProfileId: string,
  recipientProfileId: string,
): void {
  if (proposerProfileId === recipientProfileId) {
    throw AppException.unprocessable(
      'invalid_reference',
      'A profile cannot be paired with itself.',
    );
  }
}

/**
 * `maxProposalsPerParticipant` caps the proposer's *active* proposals, so finished
 * meetings never count against a later request.
 */
export function assertProposalLimit(
  activeProposals: number,
  maxProposals: number,
): void {
  if (activeProposals >= maxProposals) {
    throw AppException.unprocessable(
      'proposal_limit_reached',
      `A participant may have at most ${maxProposals} active meeting proposals.`,
    );
  }
}

/** Snapshot of the module setting stored on the meeting row. */
export function requiresStaffConfirmation(settings: Record<string, unknown>): boolean {
  return settings.requiresStaffConfirmation === true;
}

export function maxProposalsPerParticipant(
  settings: Record<string, unknown>,
): number {
  const value = settings.maxProposalsPerParticipant;

  return typeof value === 'number' && Number.isFinite(value) ? value : 10;
}

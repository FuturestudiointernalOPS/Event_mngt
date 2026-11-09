import type { IntroductionStatus, MeetingStatus } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/** Participant-facing rules (meetings, introductions, eligibility) as pure functions. */

export function assertConfirmed(status: string): void {
  if (status !== 'CONFIRMED') {
    throw AppException.forbidden(
      'registration_not_confirmed',
      'This feature opens once your registration is confirmed.',
    );
  }
}

export function assertCanPropose(input: {
  proposerId: string;
  inviteeId: string;
  proposalsSoFar: number;
  max: number;
}): void {
  if (input.proposerId === input.inviteeId) {
    throw AppException.badRequest('invalid_invitee', 'You cannot propose a meeting to yourself.');
  }
  if (input.proposalsSoFar >= input.max) {
    throw AppException.unprocessable('proposal_limit', 'You have reached the meeting proposal limit.');
  }
}

export type MeetingResponse = 'ACCEPT' | 'DECLINE' | 'CANCEL';

/** Who may do what to a meeting, and from which state. */
export function resolveMeetingResponse(
  response: MeetingResponse,
  status: MeetingStatus,
  role: 'proposer' | 'invitee',
): MeetingStatus {
  if (response === 'CANCEL') {
    if (status !== 'PROPOSED' && status !== 'ACCEPTED' && status !== 'CONFIRMED') {
      throw AppException.unprocessable('invalid_status_transition', 'This meeting can no longer be cancelled.');
    }
    return 'CANCELLED';
  }

  if (role !== 'invitee') {
    throw AppException.forbidden('not_invitee', 'Only the invited participant can answer a proposal.');
  }
  if (status !== 'PROPOSED') {
    throw AppException.unprocessable('invalid_status_transition', 'This proposal was already answered.');
  }

  return response === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
}

const INTRO_TRANSITIONS: Record<IntroductionStatus, IntroductionStatus[]> = {
  SUBMITTED: ['IN_REVIEW', 'APPROVED', 'DECLINED', 'CLOSED'],
  IN_REVIEW: ['APPROVED', 'DECLINED', 'CLOSED'],
  APPROVED: ['INTRODUCED', 'CLOSED'],
  DECLINED: ['CLOSED'],
  INTRODUCED: ['CLOSED'],
  CLOSED: [],
};

export function assertIntroductionTransition(
  from: IntroductionStatus,
  to: IntroductionStatus,
  outcome: string | undefined,
): void {
  if (!INTRO_TRANSITIONS[from].includes(to)) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      `A request that is ${from.toLowerCase().replace('_', ' ')} cannot become ${to.toLowerCase().replace('_', ' ')}.`,
    );
  }
  if (to === 'INTRODUCED' && !outcome) {
    throw AppException.badRequest('outcome_required', 'Record the outcome of the introduction.');
  }
}

export function assertCanRequestIntroduction(input: {
  requesterId: string;
  ownerId: string;
  innovationApproved: boolean;
  openRequestExists: boolean;
}): void {
  if (!input.innovationApproved) {
    throw AppException.notFound('not_found', 'Innovation not found.');
  }
  if (input.requesterId === input.ownerId) {
    throw AppException.badRequest('own_innovation', 'You cannot request an introduction to your own innovation.');
  }
  if (input.openRequestExists) {
    throw AppException.conflict('request_exists', 'You already have an open request for this innovation.');
  }
}

/** A participant may withdraw until they have been checked in. */
export function assertCanSelfCancel(status: string, checkedInCount: number): void {
  if (status !== 'PENDING' && status !== 'CONFIRMED') {
    throw AppException.unprocessable('invalid_status_transition', 'This registration is not active.');
  }
  if (checkedInCount > 0) {
    throw AppException.unprocessable('already_checked_in', 'You have already been checked in.');
  }
}

/** Staff confirmation applies only to an accepted meeting, and only when the module asks for it. */
export function assertCanConfirmMeeting(status: MeetingStatus, requiresStaffConfirmation: boolean): void {
  if (!requiresStaffConfirmation) {
    throw AppException.unprocessable('confirmation_not_required', 'This event does not require staff confirmation.');
  }
  if (status !== 'ACCEPTED') {
    throw AppException.unprocessable('invalid_status_transition', 'Only an accepted meeting can be confirmed.');
  }
}

/** A meeting is completed from its settled state: confirmed when staff confirm, else accepted. */
export function assertCanComplete(status: MeetingStatus, requiresStaffConfirmation: boolean): void {
  const settled = requiresStaffConfirmation ? 'CONFIRMED' : 'ACCEPTED';
  if (status !== settled) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      requiresStaffConfirmation
        ? 'Only a staff-confirmed meeting can be completed.'
        : 'Only an accepted meeting can be completed.',
    );
  }
}

import { AppException } from '../../common/app-exception';
import {
  IntroductionOutcome,
  IntroductionStatus,
} from '../../database/prisma-client';

/**
 * Introduction queue state machine and settings (WP-17), as pure functions.
 *
 * INTRODUCED and DECLINED are terminal: a decided request is never reopened, so the
 * history stays a complete account of what happened.
 */

export type IntroductionAction = 'assign' | 'decline' | 'introduce';

const TARGET: Record<IntroductionAction, IntroductionStatus> = {
  assign: IntroductionStatus.ASSIGNED,
  decline: IntroductionStatus.DECLINED,
  introduce: IntroductionStatus.INTRODUCED,
};

const ALLOWED: Record<IntroductionStatus, readonly IntroductionStatus[]> = {
  [IntroductionStatus.REQUESTED]: [
    IntroductionStatus.ASSIGNED,
    IntroductionStatus.DECLINED,
  ],
  [IntroductionStatus.ASSIGNED]: [
    IntroductionStatus.INTRODUCED,
    IntroductionStatus.DECLINED,
  ],
  [IntroductionStatus.INTRODUCED]: [],
  [IntroductionStatus.DECLINED]: [],
};

const OUTCOMES: Record<IntroductionStatus, readonly IntroductionOutcome[]> = {
  [IntroductionStatus.REQUESTED]: [],
  [IntroductionStatus.ASSIGNED]: [],
  [IntroductionStatus.INTRODUCED]: [
    IntroductionOutcome.CONNECTED,
    IntroductionOutcome.FOLLOW_UP,
  ],
  [IntroductionStatus.DECLINED]: [
    IntroductionOutcome.NO_MATCH,
    IntroductionOutcome.DECLINED,
  ],
};

export function assertIntroductionTransition(
  status: IntroductionStatus,
  action: IntroductionAction,
): IntroductionStatus {
  const target = TARGET[action];

  if (!ALLOWED[status].includes(target)) {
    throw AppException.unprocessable(
      'invalid_transition',
      `An introduction request that is ${status.toLowerCase()} cannot become ${target.toLowerCase()}.`,
    );
  }

  return target;
}

/** `requireReason` is a module setting; the reason itself is short free text. */
export function assertReasonRequired(
  requireReason: boolean,
  reason: string | null,
): void {
  if (requireReason && (reason === null || reason.trim() === '')) {
    throw AppException.unprocessable(
      'reason_required',
      'A reason is required for an introduction request.',
    );
  }
}

export interface InitialAssignment {
  status: IntroductionStatus;
  assignedToUserId: string | null;
}

/**
 * `autoAssign` routes a staff-created request to its creator. Without an actor there is
 * nobody to assign it to, so the request waits in the queue as REQUESTED.
 */
export function initialAssignment(
  autoAssign: boolean,
  actorUserId: string | null,
): InitialAssignment {
  if (autoAssign && actorUserId !== null) {
    return {
      status: IntroductionStatus.ASSIGNED,
      assignedToUserId: actorUserId,
    };
  }

  return { status: IntroductionStatus.REQUESTED, assignedToUserId: null };
}

/** A decided request records the outcome its state allows. */
export function assertOutcomeForStatus(
  status: IntroductionStatus,
  outcome: IntroductionOutcome,
): void {
  if (!OUTCOMES[status].includes(outcome)) {
    throw AppException.unprocessable(
      'invalid_outcome',
      `The outcome "${outcome}" cannot be recorded on a request that is ${status.toLowerCase()}.`,
    );
  }
}

export function reasonRequired(settings: Record<string, unknown>): boolean {
  return settings.requireReason === true;
}

export function autoAssignEnabled(settings: Record<string, unknown>): boolean {
  return settings.autoAssign === true;
}

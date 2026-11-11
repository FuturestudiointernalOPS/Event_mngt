import { AppException } from '../../common/app-exception';

/** Participant-space rules, as pure functions. */

/** A registrant may withdraw until they have actually attended. */
export function assertCanWithdraw(input: { status: string; checkedIn: boolean }): void {
  if (input.status !== 'APPROVED') {
    throw AppException.unprocessable('invalid_status', 'This registration is not active.');
  }
  if (input.checkedIn) {
    throw AppException.unprocessable('already_checked_in', 'You have already been checked in.');
  }
}

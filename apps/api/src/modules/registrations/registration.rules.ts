import type { FieldType, RegistrationStatus } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/** Registration rules as pure functions (R11). */

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[] | null;
  categoryId: string | null;
}

export type AnswerValue = string | boolean;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{6,20}$/;

/**
 * Validates submitted answers against the event's form for one category.
 * Returns only the answers that belong to the form (unknown keys are refused, not
 * silently stored) and reports every problem at once, keyed by field.
 */
export function validateAnswers(
  fields: readonly FormField[],
  categoryId: string,
  answers: Record<string, AnswerValue>,
): Record<string, AnswerValue> {
  const applicable = fields.filter((f) => f.categoryId === null || f.categoryId === categoryId);
  const known = new Set(applicable.map((f) => f.key));
  const problems: Record<string, string> = {};
  const clean: Record<string, AnswerValue> = {};

  for (const key of Object.keys(answers)) {
    if (!known.has(key)) {
      problems[key] = 'This field is not part of the form.';
    }
  }

  for (const field of applicable) {
    const raw = answers[field.key];
    const empty = raw === undefined || raw === '' || raw === false;

    if (empty) {
      if (field.required) {
        problems[field.key] = 'This field is required.';
      }
      continue;
    }

    const problem = checkValue(field, raw);
    if (problem) {
      problems[field.key] = problem;
    } else {
      clean[field.key] = typeof raw === 'string' ? raw.trim() : raw;
    }
  }

  if (Object.keys(problems).length > 0) {
    throw AppException.unprocessable('invalid_answers', 'Some answers are not valid.', { fields: problems });
  }

  return clean;
}

function checkValue(field: FormField, value: AnswerValue): string | null {
  if (field.type === 'CHECKBOX') {
    return typeof value === 'boolean' ? null : 'Expected a yes/no value.';
  }
  if (typeof value !== 'string') {
    return 'Expected text.';
  }
  switch (field.type) {
    case 'EMAIL':
      return EMAIL.test(value) ? null : 'Enter a valid email address.';
    case 'PHONE':
      return PHONE.test(value) ? null : 'Enter a valid phone number.';
    case 'SELECT':
    case 'RADIO':
      return field.options?.includes(value) ? null : 'Choose one of the listed options.';
    case 'TEXTAREA':
      return value.length <= 4000 ? null : 'Too long.';
    default:
      return value.length <= 500 ? null : 'Too long.';
  }
}

export function assertRegistrationOpen(
  event: {
    status: string;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
  },
  now: Date,
): void {
  const open = event.status === 'PUBLISHED' || event.status === 'REGISTRATION_OPEN';
  const started = !event.registrationOpensAt || event.registrationOpensAt <= now;
  const notEnded = !event.registrationClosesAt || event.registrationClosesAt > now;

  if (!open || !started || !notEnded) {
    throw AppException.unprocessable('registration_closed', 'Registration is not open for this event.');
  }
}

export function assertCapacity(category: { capacity: number | null }, taken: number): void {
  if (category.capacity !== null && taken >= category.capacity) {
    throw AppException.unprocessable('category_full', 'This category is full.');
  }
}

/** Automatic approval only applies when the category itself does not require review. */
export function initialStatus(input: {
  approvalMode: string;
  categoryRequiresApproval: boolean;
}): RegistrationStatus {
  return input.approvalMode === 'automatic' && !input.categoryRequiresApproval
    ? 'CONFIRMED'
    : 'PENDING';
}

const DECISIONS: Record<string, { from: RegistrationStatus[]; to: RegistrationStatus }> = {
  CONFIRM: { from: ['PENDING', 'REJECTED'], to: 'CONFIRMED' },
  REJECT: { from: ['PENDING'], to: 'REJECTED' },
  CANCEL: { from: ['PENDING', 'CONFIRMED'], to: 'CANCELLED' },
};

export function resolveDecision(
  decision: 'CONFIRM' | 'REJECT' | 'CANCEL',
  current: RegistrationStatus,
): RegistrationStatus {
  const rule = DECISIONS[decision];

  if (!rule.from.includes(current)) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      `A ${current.toLowerCase()} registration cannot be ${decision.toLowerCase()}ed.`,
    );
  }

  return rule.to;
}

export function assertConsent(required: boolean, consentText: string | null, granted: boolean): void {
  if (required && consentText && !granted) {
    throw AppException.unprocessable('consent_required', 'You must accept the consent statement to register.');
  }
}

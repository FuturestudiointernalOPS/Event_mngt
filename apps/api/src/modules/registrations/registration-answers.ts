import type {
  RegistrationAnswerValue,
  RegistrationField,
} from '@event-platform/shared';

/**
 * Answer validation against the current form, as pure functions (WP-10).
 *
 * The browser refuses the same cases through the shared schema; the server is the
 * authority because the form belongs to the event, not to the request.
 */

export interface AnswerIssue {
  path: string;
  message: string;
}

export interface SubmittedAnswer {
  fieldKey: string;
  value: RegistrationAnswerValue;
}

export interface StoredAnswer {
  fieldId: string;
  fieldKey: string;
  value: RegistrationAnswerValue;
}

export function isBlank(value: RegistrationAnswerValue): boolean {
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function optionValues(field: RegistrationField): string[] {
  return (field.options ?? []).map((option) => option.value);
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function valueProblem(
  field: RegistrationField,
  value: RegistrationAnswerValue,
): string | null {
  switch (field.type) {
    case 'SELECT':
      return typeof value === 'string' && optionValues(field).includes(value)
        ? null
        : 'Choose one of the listed options.';

    case 'MULTI_SELECT': {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Choose at least one of the listed options.';
      }

      const allowed = optionValues(field);
      const valid =
        value.every((entry) => typeof entry === 'string' && allowed.includes(entry)) &&
        new Set(value).size === value.length;

      return valid ? null : 'Choose only from the listed options, without duplicates.';
    }

    case 'CHECKBOX':
      return value === true ? null : 'This box must be ticked.';

    case 'NUMBER':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : 'Enter a number.';

    case 'EMAIL':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? null
        : 'Enter a valid email address.';

    case 'URL':
      return typeof value === 'string' && isUrl(value)
        ? null
        : 'Enter a valid web address.';

    case 'DATE':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? null
        : 'Enter a valid date.';

    default:
      return typeof value === 'string' ? null : 'Enter text.';
  }
}

export function validateAnswers(
  fields: readonly RegistrationField[],
  answers: readonly SubmittedAnswer[],
): AnswerIssue[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const provided = new Map<string, RegistrationAnswerValue>();
  const issues: AnswerIssue[] = [];

  for (const answer of answers) {
    if (!byKey.has(answer.fieldKey)) {
      issues.push({
        path: `answers.${answer.fieldKey}`,
        message: 'This field is not part of the registration form.',
      });
      continue;
    }

    provided.set(answer.fieldKey, answer.value);
  }

  for (const field of fields) {
    const value = provided.get(field.key);

    if (value === undefined || isBlank(value)) {
      if (field.required) {
        issues.push({
          path: `answers.${field.key}`,
          message: `${field.label} is required.`,
        });
      }
      continue;
    }

    const problem = valueProblem(field, value);

    if (problem) {
      issues.push({ path: `answers.${field.key}`, message: problem });
    }
  }

  return issues;
}

/** The answers worth storing: known fields with a non-blank value. */
export function answeredFields(
  fields: readonly RegistrationField[],
  answers: readonly SubmittedAnswer[],
): StoredAnswer[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));

  return answers.flatMap((answer) => {
    const field = byKey.get(answer.fieldKey);

    if (!field || isBlank(answer.value)) {
      return [];
    }

    return [{ fieldId: field.id, fieldKey: field.key, value: answer.value }];
  });
}

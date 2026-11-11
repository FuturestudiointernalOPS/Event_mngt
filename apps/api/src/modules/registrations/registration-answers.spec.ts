import { describe, expect, it } from 'vitest';
import type { RegistrationField } from '@event-platform/shared';
import {
  answeredFields,
  isBlank,
  validateAnswers,
} from './registration-answers';

function field(overrides: Partial<RegistrationField>): RegistrationField {
  return {
    id: 'field-1',
    key: 'motivation',
    label: 'Motivation',
    type: 'TEXT',
    required: false,
    placeholder: null,
    helpText: null,
    options: null,
    sortOrder: 0,
    ...overrides,
  };
}

const OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

describe('answer validation', () => {
  it('accepts a complete submission', () => {
    const fields = [field({ required: true })];

    expect(validateAnswers(fields, [{ fieldKey: 'motivation', value: 'Because' }])).toEqual([]);
  });

  it('reports a missing required answer', () => {
    const issues = validateAnswers([field({ required: true })], []);

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('answers.motivation');
  });

  it('treats an empty string as missing for a required field', () => {
    expect(
      validateAnswers([field({ required: true })], [{ fieldKey: 'motivation', value: '  ' }]),
    ).toHaveLength(1);
  });

  it('rejects a key that is not in the form', () => {
    const issues = validateAnswers([], [{ fieldKey: 'ghost', value: 'x' }]);

    expect(issues[0].path).toBe('answers.ghost');
  });

  it('rejects a select value outside the options', () => {
    const fields = [field({ type: 'SELECT', key: 'choice', options: OPTIONS })];

    expect(validateAnswers(fields, [{ fieldKey: 'choice', value: 'maybe' }])).toHaveLength(1);
    expect(validateAnswers(fields, [{ fieldKey: 'choice', value: 'yes' }])).toEqual([]);
  });

  it('rejects a multi-select with an unknown or duplicate option', () => {
    const fields = [field({ type: 'MULTI_SELECT', key: 'choices', options: OPTIONS })];

    expect(validateAnswers(fields, [{ fieldKey: 'choices', value: ['yes', 'yes'] }])).toHaveLength(1);
    expect(validateAnswers(fields, [{ fieldKey: 'choices', value: ['yes', 'maybe'] }])).toHaveLength(1);
    expect(validateAnswers(fields, [{ fieldKey: 'choices', value: ['yes', 'no'] }])).toEqual([]);
  });

  it('requires a required checkbox to be ticked', () => {
    const fields = [field({ type: 'CHECKBOX', key: 'agree', required: true })];

    expect(validateAnswers(fields, [{ fieldKey: 'agree', value: false }])).toHaveLength(1);
    expect(validateAnswers(fields, [{ fieldKey: 'agree', value: true }])).toEqual([]);
  });

  it('checks numbers, emails, URLs and dates by type', () => {
    const fields = [
      field({ key: 'age', type: 'NUMBER' }),
      field({ key: 'mail', type: 'EMAIL' }),
      field({ key: 'site', type: 'URL' }),
      field({ key: 'day', type: 'DATE' }),
    ];

    expect(
      validateAnswers(fields, [
        { fieldKey: 'age', value: 'old' },
        { fieldKey: 'mail', value: 'not-an-email' },
        { fieldKey: 'site', value: 'not a url' },
        { fieldKey: 'day', value: 'not a date' },
      ]),
    ).toHaveLength(4);

    expect(
      validateAnswers(fields, [
        { fieldKey: 'age', value: 30 },
        { fieldKey: 'mail', value: 'amina@example.test' },
        { fieldKey: 'site', value: 'https://example.test' },
        { fieldKey: 'day', value: '2026-11-10' },
      ]),
    ).toEqual([]);
  });
});

describe('stored answers', () => {
  it('keeps known non-blank answers with their field id', () => {
    const fields = [field({ id: 'field-1' }), field({ id: 'field-2', key: 'extra' })];

    expect(
      answeredFields(fields, [
        { fieldKey: 'motivation', value: 'Because' },
        { fieldKey: 'extra', value: '' },
        { fieldKey: 'unknown', value: 'x' },
      ]),
    ).toEqual([{ fieldId: 'field-1', fieldKey: 'motivation', value: 'Because' }]);
  });

  it('treats an empty list and an empty string as blank', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank([])).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(isBlank(false)).toBe(false);
  });
});

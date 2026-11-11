import type {
  Category,
  PublicCategory,
  PublicRegistrationField,
  RegistrationField,
  RegistrationFieldOption,
  RegistrationForm,
  RegistrationWindow,
} from '@event-platform/shared';
import type { WindowInput } from './registration-forms.query';
import type { CategoryWithCount, FormWithFields } from './registration-forms.repository';

/** Pure row → contract mapping, kept out of the services so it stays testable. */

function optionsOf(value: unknown): RegistrationFieldOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter(
    (entry): entry is RegistrationFieldOption =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as RegistrationFieldOption).value === 'string' &&
      typeof (entry as RegistrationFieldOption).label === 'string',
  );
}

export function toCategory(row: CategoryWithCount): Category {
  return {
    id: row.id,
    eventId: row.eventId,
    key: row.key,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    registrationCount: row._count.registrations,
  };
}

export function toPublicCategory(row: {
  key: string;
  name: string;
  description: string | null;
}): PublicCategory {
  return { key: row.key, name: row.name, description: row.description };
}

export function toRegistrationField(row: {
  id: string;
  key: string;
  label: string;
  type: RegistrationField['type'];
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: unknown;
  sortOrder: number;
}): RegistrationField {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    required: row.required,
    placeholder: row.placeholder,
    helpText: row.helpText,
    options: optionsOf(row.options),
    sortOrder: row.sortOrder,
  };
}

export function toPublicField(row: RegistrationField): PublicRegistrationField {
  return {
    key: row.key,
    label: row.label,
    type: row.type,
    required: row.required,
    placeholder: row.placeholder,
    helpText: row.helpText,
    options: row.options,
  };
}

export function toRegistrationForm(row: FormWithFields): RegistrationForm {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    version: row.version,
    fields: row.fields.map(toRegistrationField),
  };
}

export function toPublicForm(
  row: FormWithFields | null,
): {
  title: string;
  description: string | null;
  version: number;
  fields: PublicRegistrationField[];
} | null {
  if (!row) {
    return null;
  }

  return {
    title: row.title,
    description: row.description,
    version: row.version,
    fields: row.fields.map(toRegistrationField).map(toPublicField),
  };
}

export type { WindowInput };

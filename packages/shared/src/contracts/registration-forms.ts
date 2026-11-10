import { z } from 'zod';
import { keySchema, uuidSchema } from './common';

/**
 * Participant categories and the event's registration form.
 *
 * A category classifies a role *within one event* (docs/00), and a form belongs to one
 * event. Neither is shared across events or organisations.
 */

export const registrationFieldTypeSchema = z.enum([
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'DATE',
  'URL',
  'SELECT',
  'MULTI_SELECT',
  'CHECKBOX',
]);

export type RegistrationFieldType = z.infer<typeof registrationFieldTypeSchema>;

const OPTION_TYPES: ReadonlySet<RegistrationFieldType> = new Set([
  'SELECT',
  'MULTI_SELECT',
]);

export const registrationFieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
});

export type RegistrationFieldOption = z.infer<typeof registrationFieldOptionSchema>;

/**
 * Options belong to choice fields and to nothing else. The rule lives in the schema so
 * the browser refuses the same input the API would.
 */
export const registrationFieldInputSchema = z
  .object({
    key: keySchema,
    label: z.string().trim().min(1).max(160),
    type: registrationFieldTypeSchema,
    required: z.boolean().default(false),
    placeholder: z.string().trim().max(160).optional(),
    helpText: z.string().trim().max(600).optional(),
    options: z.array(registrationFieldOptionSchema).min(1).max(50).optional(),
    sortOrder: z.number().int().min(0).max(999).default(0),
  })
  .superRefine((field, ctx) => {
    const needsOptions = OPTION_TYPES.has(field.type);

    if (needsOptions && !field.options) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'A choice field needs at least one option',
      });
    }

    if (!needsOptions && field.options) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Only choice fields accept options',
      });
    }

    if (field.options) {
      const values = field.options.map((option) => option.value);

      for (const value of values) {
        if (values.filter((candidate) => candidate === value).length > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message: `Duplicate option "${value}"`,
          });
          break;
        }
      }
    }
  });

export type RegistrationFieldInput = z.infer<typeof registrationFieldInputSchema>;

export const saveRegistrationFormRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    fields: z.array(registrationFieldInputSchema).min(1).max(40),
  })
  .superRefine((form, ctx) => {
    const keys = form.fields.map((field) => field.key);

    for (const key of keys) {
      if (keys.filter((candidate) => candidate === key).length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields'],
          message: `Duplicate field key "${key}"`,
        });
        break;
      }
    }
  });

export type SaveRegistrationFormRequest = z.infer<typeof saveRegistrationFormRequestSchema>;

export const registrationFieldSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  label: z.string(),
  type: registrationFieldTypeSchema,
  required: z.boolean(),
  placeholder: z.string().nullable(),
  helpText: z.string().nullable(),
  options: z.array(registrationFieldOptionSchema).nullable(),
  sortOrder: z.number().int(),
});

export type RegistrationField = z.infer<typeof registrationFieldSchema>;

export const registrationFormSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  title: z.string(),
  description: z.string().nullable(),
  version: z.number().int(),
  fields: z.array(registrationFieldSchema),
});

export type RegistrationForm = z.infer<typeof registrationFormSchema>;

export const categorySchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  capacity: z.number().int().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  registrationCount: z.number().int().optional(),
});

export type Category = z.infer<typeof categorySchema>;

export const createCategoryRequestSchema = z.object({
  key: keySchema.optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  capacity: z.number().int().min(1).max(100_000).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;

export const updateCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  capacity: z.number().int().min(1).max(100_000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

/** The anonymous registration page: no internal ids, no unapproved wording. */
export const publicCategorySchema = categorySchema.pick({
  key: true,
  name: true,
  description: true,
});

export type PublicCategory = z.infer<typeof publicCategorySchema>;

export const publicRegistrationFieldSchema = registrationFieldSchema.pick({
  key: true,
  label: true,
  type: true,
  required: true,
  placeholder: true,
  helpText: true,
  options: true,
});

export type PublicRegistrationField = z.infer<typeof publicRegistrationFieldSchema>;

export const registrationWindowSchema = z.object({
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  isOpen: z.boolean(),
});

export type RegistrationWindow = z.infer<typeof registrationWindowSchema>;

export const publicRegistrationFormSchema = z.object({
  event: z.object({ slug: z.string(), name: z.string() }),
  categories: z.array(publicCategorySchema),
  form: z
    .object({
      title: z.string(),
      description: z.string().nullable(),
      version: z.number().int(),
      fields: z.array(publicRegistrationFieldSchema),
    })
    .nullable(),
  consentDocuments: z.array(
    z.object({
      key: z.string(),
      version: z.number().int(),
      title: z.string(),
      body: z.string(),
      required: z.boolean(),
    }),
  ),
  window: registrationWindowSchema,
  duplicatePolicy: z.enum(['warn', 'block']),
  approvalMode: z.enum(['manual', 'automatic']),
});

export type PublicRegistrationForm = z.infer<typeof publicRegistrationFormSchema>;

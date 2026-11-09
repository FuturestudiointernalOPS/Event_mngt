import { z } from 'zod';
import { emailSchema } from './auth';
import { paginationQuerySchema, uuidSchema } from './common';

export const registrationStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED']);
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;

export const fieldTypeSchema = z.enum([
  'TEXT',
  'EMAIL',
  'PHONE',
  'SELECT',
  'RADIO',
  'CHECKBOX',
  'TEXTAREA',
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores');

/* ---------------------------------------------------------------- categories */

export const categoryInputSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional(),
  requiresApproval: z.boolean().default(false),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  position: z.number().int().min(0).max(1000).default(0),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const updateCategorySchema = categoryInputSchema
  .partial()
  .omit({ key: true })
  .extend({ isActive: z.boolean().optional() });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryViewSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  requiresApproval: z.boolean(),
  capacity: z.number().nullable(),
  position: z.number(),
  isActive: z.boolean(),
  registrationCount: z.number().int(),
});
export type CategoryView = z.infer<typeof categoryViewSchema>;

/* -------------------------------------------------------------------- fields */

export const fieldInputSchema = z
  .object({
    key: keySchema,
    label: z.string().trim().min(1).max(120),
    type: fieldTypeSchema,
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).min(1).max(30).optional(),
    categoryKey: keySchema.nullable().optional(),
    position: z.number().int().min(0).max(1000).default(0),
  })
  .refine((v) => !['SELECT', 'RADIO'].includes(v.type) || (v.options && v.options.length > 0), {
    message: 'Choice fields need at least one option',
    path: ['options'],
  });
export type FieldInput = z.infer<typeof fieldInputSchema>;

export const updateFieldSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(80)).min(1).max(30).optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;

export const fieldViewSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  label: z.string(),
  type: fieldTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).nullable(),
  categoryKey: z.string().nullable(),
  position: z.number(),
});
export type FieldView = z.infer<typeof fieldViewSchema>;

export const consentSettingsSchema = z.object({
  text: z.string().trim().min(10).max(4000),
  version: z.string().trim().min(1).max(20),
});
export type ConsentSettings = z.infer<typeof consentSettingsSchema>;

/* ------------------------------------------------------- public registration */

export interface PublicRegistrationForm {
  event: { slug: string; name: string; registrationOpen: boolean };
  consent: { text: string | null; version: string; required: boolean };
  categories: { key: string; name: string; description: string | null; full: boolean }[];
  fields: FieldView[];
}

export const answerValueSchema = z.union([z.string().max(4000), z.boolean()]);

export const submitRegistrationSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional(),
  categoryKey: keySchema,
  answers: z.record(z.string(), answerValueSchema).default({}),
  consent: z.boolean().default(false),
});
export type SubmitRegistrationRequest = z.infer<typeof submitRegistrationSchema>;

export interface PublicRegistrationResult {
  registrationId: string;
  status: RegistrationStatus;
  /** Participant portal credential. Shown once and e-mailed; null on an idempotent replay. */
  accessToken: string | null;
  replayed: boolean;
}

/* -------------------------------------------------------------- staff review */

export const listRegistrationsQuerySchema = paginationQuerySchema.extend({
  status: registrationStatusSchema.optional(),
  categoryKey: keySchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuerySchema>;

export const decideRegistrationSchema = z.object({
  decision: z.enum(['CONFIRM', 'REJECT', 'CANCEL']),
  note: z.string().trim().max(500).optional(),
});
export type DecideRegistrationRequest = z.infer<typeof decideRegistrationSchema>;

export interface RegistrationSummary {
  id: string;
  status: RegistrationStatus;
  firstName: string;
  lastName: string;
  email: string;
  categoryKey: string;
  categoryName: string;
  checkedIn: boolean;
  createdAt: string;
}

export interface RegistrationDetail extends RegistrationSummary {
  phone: string | null;
  answers: Record<string, string | boolean>;
  decisionNote: string | null;
  decidedAt: string | null;
  consents: { purpose: string; policyVersion: string; granted: boolean; createdAt: string }[];
}

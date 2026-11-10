import { z } from 'zod';
import { keySchema, paginationQuerySchema, uuidSchema } from './common';

/**
 * Registration submission and the staff read model.
 *
 * The public receipt deliberately carries no internal id: the per-event `reference` is
 * what the participant can quote back to the organiser.
 */

export const registrationStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WAITLISTED',
  'CANCELLED',
]);

export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;

export const registrationSourceSchema = z.enum(['PUBLIC', 'STAFF', 'IMPORT']);
export type RegistrationSource = z.infer<typeof registrationSourceSchema>;

export const registrationAnswerValueSchema = z.union([
  z.string().max(4000),
  z.array(z.string().max(400)).max(50),
  z.number(),
  z.boolean(),
]);

export type RegistrationAnswerValue = z.infer<typeof registrationAnswerValueSchema>;

export const submitRegistrationRequestSchema = z
  .object({
    email: z.email().max(254),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(3).max(40).optional(),
    organizationName: z.string().trim().max(180).optional(),
    jobTitle: z.string().trim().max(120).optional(),
    country: z.string().trim().max(80).optional(),
    categoryKey: keySchema.optional(),
    answers: z
      .array(
        z.object({
          fieldKey: keySchema,
          value: registrationAnswerValueSchema,
        }),
      )
      .max(60)
      .default([]),
    consents: z
      .array(
        z.object({
          key: keySchema,
          version: z.number().int().min(1),
          accepted: z.literal(true),
        }),
      )
      .max(20)
      .default([]),
  })
  .superRefine((value, ctx) => {
    const answerKeys = value.answers.map((answer) => answer.fieldKey);
    const consentKeys = value.consents.map((consent) => consent.key);

    for (const key of answerKeys) {
      if (answerKeys.filter((candidate) => candidate === key).length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['answers'],
          message: `Duplicate answer for "${key}"`,
        });
        break;
      }
    }

    for (const key of consentKeys) {
      if (consentKeys.filter((candidate) => candidate === key).length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['consents'],
          message: `Duplicate consent for "${key}"`,
        });
        break;
      }
    }
  });

export type SubmitRegistrationRequest = z.infer<typeof submitRegistrationRequestSchema>;

/** Anonymous confirmation: no ids, no answers, no other participants. */
export const registrationReceiptSchema = z.object({
  reference: z.string(),
  status: registrationStatusSchema,
  submittedAt: z.string(),
  duplicate: z.boolean(),
  requiresApproval: z.boolean(),
  badgeIssued: z.boolean(),
});

export type RegistrationReceipt = z.infer<typeof registrationReceiptSchema>;

export const personSummarySchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  organizationName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  country: z.string().nullable(),
});

export type PersonSummary = z.infer<typeof personSummarySchema>;

export const registrationSummarySchema = z.object({
  id: uuidSchema,
  reference: z.string(),
  status: registrationStatusSchema,
  source: registrationSourceSchema,
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  person: personSummarySchema,
  category: z.object({ key: z.string(), name: z.string() }).nullable(),
});

export type RegistrationSummary = z.infer<typeof registrationSummarySchema>;

export const registrationDetailSchema = registrationSummarySchema.extend({
  answers: z.array(
    z.object({
      fieldKey: z.string(),
      value: registrationAnswerValueSchema,
    }),
  ),
  consents: z.array(
    z.object({
      key: z.string(),
      version: z.number().int(),
      acceptedAt: z.string(),
    }),
  ),
  badge: z
    .object({
      status: z.enum(['ISSUED', 'REVOKED']),
      issuedAt: z.string(),
    })
    .nullable(),
});

export type RegistrationDetail = z.infer<typeof registrationDetailSchema>;

export const listRegistrationsQuerySchema = paginationQuerySchema.extend({
  status: registrationStatusSchema.optional(),
  categoryKey: keySchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuerySchema>;

export const decideRegistrationRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type DecideRegistrationRequest = z.infer<typeof decideRegistrationRequestSchema>;

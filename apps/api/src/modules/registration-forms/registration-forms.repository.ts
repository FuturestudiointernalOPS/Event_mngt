import { Injectable } from '@nestjs/common';
import type { RegistrationFieldInput } from '@event-platform/shared';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  Prisma,
  type ParticipantCategory,
  type RegistrationForm,
  type RegistrationField,
} from '../../database/prisma-client';

export type CategoryWithCount = ParticipantCategory & {
  _count: { registrations: number };
};

export type FormWithFields = RegistrationForm & { fields: RegistrationField[] };

export interface CategoryWrite {
  name?: string;
  description?: string | null;
  capacity?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * The form and category query surface for one event.
 *
 * Every method takes the organisation id and carries it in the predicate, so a category
 * id from another tenant is simply absent (R7).
 */
@Injectable()
export class RegistrationFormsRepository {
  eventExists(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
  }

  listCategories(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<CategoryWithCount[]> {
    return tx.participantCategory.findMany({
      where: { organizationId, eventId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { registrations: true } } },
    });
  }

  listPublicCategories(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ParticipantCategory[]> {
    return tx.participantCategory.findMany({
      where: { organizationId, eventId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findCategory(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    categoryId: string,
  ): Promise<ParticipantCategory | null> {
    return tx.participantCategory.findFirst({
      where: { id: categoryId, organizationId, eventId },
    });
  }

  findCategoryByKey(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    key: string,
  ): Promise<ParticipantCategory | null> {
    return tx.participantCategory.findFirst({
      where: { organizationId, eventId, key },
    });
  }

  createCategory(
    tx: TenantPrismaClient,
    data: {
      organizationId: string;
      eventId: string;
      key: string;
      name: string;
      description: string | null;
      capacity: number | null;
      sortOrder: number;
    },
  ): Promise<CategoryWithCount> {
    return tx.participantCategory.create({
      data,
      include: { _count: { select: { registrations: true } } },
    });
  }

  updateCategory(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    categoryId: string,
    data: CategoryWrite,
  ): Promise<CategoryWithCount> {
    return tx.participantCategory.update({
      where: { id: categoryId, organizationId, eventId },
      data,
      include: { _count: { select: { registrations: true } } },
    });
  }

  findForm(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<FormWithFields | null> {
    return tx.registrationForm.findFirst({
      where: { organizationId, eventId },
      include: { fields: { orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] } },
    });
  }

  /**
   * Replaces the field set and bumps the version in one transaction step. Answers
   * already captured keep their `fieldKey`, so a deletion never orphans evidence.
   */
  async saveForm(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    title: string,
    description: string | null,
    fields: RegistrationFieldInput[],
  ): Promise<FormWithFields> {
    const existing = await tx.registrationForm.findFirst({
      where: { organizationId, eventId },
      select: { id: true },
    });

    const form = existing
      ? await tx.registrationForm.update({
          where: { id: existing.id },
          data: { title, description, version: { increment: 1 } },
          select: { id: true },
        })
      : await tx.registrationForm.create({
          data: { organizationId, eventId, title, description, version: 1 },
          select: { id: true },
        });

    await tx.registrationField.deleteMany({ where: { formId: form.id, organizationId } });

    await tx.registrationField.createMany({
      data: fields.map((field, index) => ({
        organizationId,
        formId: form.id,
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder ?? null,
        helpText: field.helpText ?? null,
        options:
          field.options === undefined
            ? Prisma.DbNull
            : (field.options as unknown as Prisma.InputJsonValue),
        sortOrder: field.sortOrder ?? index,
      })),
    });

    const saved = await this.findForm(tx, organizationId, eventId);

    if (!saved) {
      throw new Error('The form disappeared inside its own transaction.');
    }

    return saved;
  }
}

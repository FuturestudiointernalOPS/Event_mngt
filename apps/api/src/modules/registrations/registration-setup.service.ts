import { Injectable } from '@nestjs/common';
import type {
  CategoryInput,
  CategoryView,
  ConsentSettings,
  FieldInput,
  FieldView,
  UpdateCategoryInput,
  UpdateFieldInput,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { RegistrationStatus } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

const ACTIVE_STATUSES = [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED];

/** Categories, the dynamic form and the consent statement of one event. */
@Injectable()
export class RegistrationSetupService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  /* --------------------------------------------------------------- categories */

  listCategories(eventId: string): Promise<CategoryView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const rows = await tx.participantCategory.findMany({
        where: { organizationId: tenant.organizationId, eventId },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { registrations: { where: { status: { in: ACTIVE_STATUSES } } } } },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        requiresApproval: row.requiresApproval,
        capacity: row.capacity,
        position: row.position,
        isActive: row.isActive,
        registrationCount: row._count.registrations,
      }));
    });
  }

  createCategory(eventId: string, input: CategoryInput): Promise<CategoryView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const clash = await tx.participantCategory.findFirst({
        where: { eventId, key: input.key },
        select: { id: true },
      });
      if (clash) {
        throw AppException.conflict('category_exists', 'A category with this key already exists.');
      }
      const created = await tx.participantCategory.create({
        data: {
          organizationId: tenant.organizationId,
          eventId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          requiresApproval: input.requiresApproval,
          capacity: input.capacity ?? null,
          position: input.position,
        },
      });
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: 'category.created',
        targetType: 'event',
        targetId: created.id,
      });
      return [];
    }).then(() => this.listCategories(eventId));
  }

  updateCategory(eventId: string, categoryId: string, input: UpdateCategoryInput): Promise<CategoryView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const updated = await tx.participantCategory.updateMany({
        where: { id: categoryId, eventId, organizationId: tenant.organizationId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.requiresApproval !== undefined && { requiresApproval: input.requiresApproval }),
          ...(input.capacity !== undefined && { capacity: input.capacity }),
          ...(input.position !== undefined && { position: input.position }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });
      if (updated.count === 0) {
        throw AppException.notFound('not_found', 'Category not found.');
      }
    }).then(() => this.listCategories(eventId));
  }

  /** A category with registrations is deactivated, never deleted: history must survive. */
  deleteCategory(eventId: string, categoryId: string): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const category = await tx.participantCategory.findFirst({
        where: { id: categoryId, eventId, organizationId: tenant.organizationId },
        select: { id: true, _count: { select: { registrations: true } } },
      });
      if (!category) {
        throw AppException.notFound('not_found', 'Category not found.');
      }
      if (category._count.registrations > 0) {
        throw AppException.unprocessable(
          'category_in_use',
          'This category has registrations. Deactivate it instead of deleting it.',
        );
      }
      await tx.participantCategory.delete({ where: { id: category.id } });
    });
  }

  /* ------------------------------------------------------------------- fields */

  listFields(eventId: string): Promise<FieldView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const rows = await tx.registrationField.findMany({
        where: { organizationId: tenant.organizationId, eventId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: { category: { select: { key: true } } },
      });
      return rows.map((row) => ({
        id: row.id,
        key: row.key,
        label: row.label,
        type: row.type,
        required: row.required,
        options: (row.options as string[] | null) ?? null,
        categoryKey: row.category?.key ?? null,
        position: row.position,
      }));
    });
  }

  createField(eventId: string, input: FieldInput): Promise<FieldView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const category = input.categoryKey
        ? await tx.participantCategory.findFirst({
            where: { eventId, key: input.categoryKey },
            select: { id: true },
          })
        : null;
      if (input.categoryKey && !category) {
        throw AppException.badRequest('invalid_reference', 'This category does not exist.');
      }
      const clash = await tx.registrationField.findFirst({ where: { eventId, key: input.key }, select: { id: true } });
      if (clash) {
        throw AppException.conflict('field_exists', 'A field with this key already exists.');
      }
      await tx.registrationField.create({
        data: {
          organizationId: tenant.organizationId,
          eventId,
          categoryId: category?.id ?? null,
          key: input.key,
          label: input.label,
          type: input.type,
          required: input.required,
          options: input.options ?? undefined,
          position: input.position,
        },
      });
    }).then(() => this.listFields(eventId));
  }

  updateField(eventId: string, fieldId: string, input: UpdateFieldInput): Promise<FieldView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const updated = await tx.registrationField.updateMany({
        where: { id: fieldId, eventId, organizationId: tenant.organizationId },
        data: {
          ...(input.label !== undefined && { label: input.label }),
          ...(input.required !== undefined && { required: input.required }),
          ...(input.options !== undefined && { options: input.options }),
          ...(input.position !== undefined && { position: input.position }),
        },
      });
      if (updated.count === 0) {
        throw AppException.notFound('not_found', 'Field not found.');
      }
    }).then(() => this.listFields(eventId));
  }

  /** Stored answers keep their keys, so removing a field never rewrites past registrations. */
  deleteField(eventId: string, fieldId: string): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const result = await tx.registrationField.deleteMany({
        where: { id: fieldId, eventId, organizationId: tenant.organizationId },
      });
      if (result.count === 0) {
        throw AppException.notFound('not_found', 'Field not found.');
      }
    });
  }

  /* ------------------------------------------------------------------ consent */

  getConsent(eventId: string): Promise<{ text: string | null; version: string }> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.requireEvent(tx, tenant.organizationId, eventId);
      return { text: event.consentText, version: event.consentVersion };
    });
  }

  setConsent(eventId: string, input: ConsentSettings): Promise<{ text: string | null; version: string }> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const event = await tx.event.update({
        where: { id: eventId },
        data: { consentText: input.text, consentVersion: input.version },
        select: { consentText: true, consentVersion: true },
      });
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: 'event.consent_updated',
        targetType: 'event',
        targetId: eventId,
        metadata: { version: input.version },
      });
      return { text: event.consentText, version: event.consentVersion };
    });
  }

  private async requireEvent(tx: TenantPrismaClient, organizationId: string, eventId: string) {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, consentText: true, consentVersion: true },
    });
    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
    return event;
  }
}

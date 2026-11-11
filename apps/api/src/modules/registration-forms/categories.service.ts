import { Injectable } from '@nestjs/common';
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { toCategory } from './registration-forms.mapper';
import {
  categoryKeyBase,
  nextAvailableKey,
} from './registration-forms.query';
import { RegistrationFormsRepository } from './registration-forms.repository';

/**
 * Event-scoped participant categories (WP-09).
 *
 * The key is stable once created: registrations reference the category row, so renaming
 * the label is safe while changing the key would rewrite history.
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationFormsRepository,
  ) {}

  list(eventId: string): Promise<Category[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const rows = await this.repository.listCategories(
        tx,
        tenant.organizationId,
        eventId,
      );

      return rows.map(toCategory);
    });
  }

  create(eventId: string, input: CreateCategoryRequest): Promise<Category> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const existing = await this.repository.listCategories(
        tx,
        tenant.organizationId,
        eventId,
      );

      const key =
        input.key ??
        nextAvailableKey(
          categoryKeyBase(input.name),
          existing.map((row) => row.key),
        );

      if (existing.some((row) => row.key === key)) {
        throw AppException.conflict(
          'conflict',
          'A category with this key already exists in this event.',
        );
      }

      const row = await this.repository.createCategory(tx, {
        organizationId: tenant.organizationId,
        eventId,
        key,
        name: input.name,
        description: input.description ?? null,
        capacity: input.capacity ?? null,
        sortOrder: input.sortOrder,
      });

      return toCategory(row);
    });
  }

  update(
    eventId: string,
    categoryId: string,
    input: UpdateCategoryRequest,
  ): Promise<Category> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await this.repository.findCategory(
        tx,
        tenant.organizationId,
        eventId,
        categoryId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Category not found.');
      }

      const row = await this.repository.updateCategory(
        tx,
        tenant.organizationId,
        eventId,
        categoryId,
        input,
      );

      return toCategory(row);
    });
  }

  /**
   * Category lookup for registration submission (WP-10), inside the caller's
   * transaction. The key is event-scoped, so this never crosses an event boundary.
   */
  async findCategoryByKey(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    key: string,
  ): Promise<{ id: string; key: string; name: string; isActive: boolean } | null> {
    const row = await this.repository.findCategoryByKey(
      tx,
      organizationId,
      eventId,
      key,
    );

    return row
      ? { id: row.id, key: row.key, name: row.name, isActive: row.isActive }
      : null;
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.repository.eventExists(tx, organizationId, eventId);

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}

import { Injectable } from '@nestjs/common';
import type {
  RegistrationForm,
  SaveRegistrationFormRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import {
  toRegistrationForm,
} from './registration-forms.mapper';
import { RegistrationFormsRepository } from './registration-forms.repository';

/**
 * The current registration form for one event (WP-09).
 *
 * Saving replaces the field set atomically and bumps the version. Answers already
 * captured keep their field key, so an edit never destroys what was submitted.
 */
@Injectable()
export class RegistrationFormService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationFormsRepository,
  ) {}

  show(eventId: string): Promise<RegistrationForm | null> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const row = await this.repository.findForm(
        tx,
        tenant.organizationId,
        eventId,
      );

      return row ? toRegistrationForm(row) : null;
    });
  }

  save(
    eventId: string,
    input: SaveRegistrationFormRequest,
  ): Promise<RegistrationForm> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const row = await this.repository.saveForm(
        tx,
        tenant.organizationId,
        eventId,
        input.title,
        input.description ?? null,
        input.fields,
      );

      return toRegistrationForm(row);
    });
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

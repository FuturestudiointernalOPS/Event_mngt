import { Injectable } from '@nestjs/common';
import type { PublicRegistrationForm } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { ConsentService } from '../consent/consent.service';
import { EventsService } from '../events/events.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { toPublicCategory, toPublicForm } from './registration-forms.mapper';
import { windowState } from './registration-forms.query';
import { RegistrationFormsRepository } from './registration-forms.repository';

/**
 * The anonymous registration page.
 *
 * The event is located from its public slug, then everything is read inside that
 * organisation's scope. A disabled registration module is reported exactly like a
 * missing event, so the page cannot be used to probe an event's existence.
 */
@Injectable()
export class PublicRegistrationFormService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationFormsRepository,
    private readonly events: EventsService,
    private readonly modules: ModuleRegistryService,
    private readonly consent: ConsentService,
  ) {}

  async get(eventSlug: string): Promise<PublicRegistrationForm> {
    const target = await this.events.findPublicTarget(eventSlug);

    if (!target) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return this.tenantTransaction.withOrganizationScope(
      target.organizationId,
      async (tx) => {
        const settings = await this.modules.requireEnabledSettings(
          tx,
          target.organizationId,
          target.id,
          'registration',
        );

        const [categories, formRow, requirements] = await Promise.all([
          this.repository.listPublicCategories(tx, target.organizationId, target.id),
          this.repository.findForm(tx, target.organizationId, target.id),
          this.consent.requirementsFor(tx, target.organizationId, target.id),
        ]);

        return {
          event: { slug: target.slug, name: target.name },
          categories: categories.map(toPublicCategory),
          form: toPublicForm(formRow),
          consentDocuments: requirements.map(({ id: _id, ...requirement }) => requirement),
          window: windowState(target),
          duplicatePolicy: settings.duplicatePolicy === 'block' ? 'block' : 'warn',
          approvalMode:
            settings.approvalMode === 'automatic' ? 'automatic' : 'manual',
        };
      },
    );
  }
}

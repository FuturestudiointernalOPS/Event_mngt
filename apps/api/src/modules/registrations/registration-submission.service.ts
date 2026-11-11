import { Injectable } from '@nestjs/common';
import type {
  RegistrationReceipt,
  SubmitRegistrationRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { RegistrationStatus } from '../../database/prisma-client';
import { BadgesService, type IssuedBadgeNotice } from '../badges/badges.service';
import { CategoriesService } from '../registration-forms/categories.service';
import { RegistrationFormService } from '../registration-forms/registration-form.service';
import { ConsentService } from '../consent/consent.service';
import { EventsService } from '../events/events.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { answeredFields, validateAnswers } from './registration-answers';
import { createReference } from './registration-reference';
import { RegistrationsRepository } from './registrations.repository';
import {
  assertRegistrationOpen,
  duplicatePolicy,
  initialStatus,
} from './registrations.rules';

interface SubmissionOutcome {
  receipt: RegistrationReceipt;
  notice: IssuedBadgeNotice | null;
}

/**
 * Anonymous registration submission (WP-10).
 *
 * The event is resolved from its public slug and the organisation comes from the event
 * row, never from the request. The write runs in `withOrganizationScope`, the only
 * public path that writes, and every row it creates is scoped to that organisation.
 */
@Injectable()
export class RegistrationSubmissionService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationsRepository,
    private readonly forms: RegistrationFormService,
    private readonly categories: CategoriesService,
    private readonly consent: ConsentService,
    private readonly modules: ModuleRegistryService,
    private readonly events: EventsService,
    private readonly badges: BadgesService,
  ) {}

  async submit(
    eventSlug: string,
    input: SubmitRegistrationRequest,
    ipAddress: string | null,
  ): Promise<RegistrationReceipt> {
    const target = await this.events.findPublicTarget(eventSlug);

    if (!target) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    const outcome = await this.tenantTransaction.withOrganizationScope(
      target.organizationId,
      async (tx): Promise<SubmissionOutcome> => {
        const settings = await this.modules.requireEnabledSettings(
          tx,
          target.organizationId,
          target.id,
          'registration',
        );

        assertRegistrationOpen(target.status, {
          opensAt: target.registrationOpensAt,
          closesAt: target.registrationClosesAt,
        });

        const policy = duplicatePolicy(settings.duplicatePolicy);
        const categoryId = await this.resolveCategory(
          tx,
          target.organizationId,
          target.id,
          input.categoryKey,
        );
        const fields = (await this.forms.formSnapshot(
          tx,
          target.organizationId,
          target.id,
        )) ?? [];

        const issues = validateAnswers(fields, input.answers);

        if (issues.length > 0) {
          throw AppException.badRequest(
            'validation_error',
            'Request validation failed.',
            issues,
          );
        }

        const email = input.email.trim().toLowerCase();
        const person =
          (await this.repository.findPersonByEmail(
            tx,
            target.organizationId,
            email,
          )) ??
          (await this.repository.createPerson(tx, {
            organizationId: target.organizationId,
            email,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone ?? null,
            organizationName: input.organizationName ?? null,
            jobTitle: input.jobTitle ?? null,
            country: input.country ?? null,
          }));

        const existing = await this.repository.findDuplicate(
          tx,
          target.organizationId,
          target.id,
          person.id,
        );

        if (existing && policy === 'block') {
          throw AppException.conflict(
            'duplicate_registration',
            'This email is already registered for this event.',
            [{ path: 'email', message: 'A registration already exists.' }],
          );
        }

        const reference = await this.uniqueReference(tx, target.id);
        const status = initialStatus(settings.approvalMode);

        const registration = await this.repository.create(tx, {
          organizationId: target.organizationId,
          eventId: target.id,
          personId: person.id,
          categoryId,
          reference,
          status,
          answers: answeredFields(fields, input.answers),
        });

        const requirements = await this.consent.requirementsFor(
          tx,
          target.organizationId,
          target.id,
        );

        await this.consent.recordAcceptances(tx, {
          organizationId: target.organizationId,
          registrationId: registration.id,
          requirements,
          accepted: input.consents,
          ipAddress,
        });

        const notice =
          status === RegistrationStatus.APPROVED
            ? await this.badges.issueForApproved(
                tx,
                target.organizationId,
                target.id,
                registration.id,
              )
            : null;

        return {
          notice,
          receipt: {
            reference,
            status,
            submittedAt: registration.submittedAt.toISOString(),
            duplicate: existing !== null,
            requiresApproval: status === RegistrationStatus.PENDING,
            badgeIssued: notice !== null,
          },
        };
      },
    );

    if (outcome.notice) {
      await this.badges.notifyIssued(outcome.notice);
    }

    return outcome.receipt;
  }

  private async resolveCategory(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    key: string | undefined,
  ): Promise<string | null> {
    if (!key) {
      return null;
    }

    const category = await this.categories.findCategoryByKey(
      tx,
      organizationId,
      eventId,
      key,
    );

    if (!category || !category.isActive) {
      throw AppException.unprocessable(
        'invalid_category',
        'The selected category is not available.',
        [{ path: 'categoryKey', message: 'Choose an open category.' }],
      );
    }

    return category.id;
  }

  /** The unique constraint is the final authority; this avoids the common collision. */
  private async uniqueReference(
    tx: TenantPrismaClient,
    eventId: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = createReference();
      const clash = await this.repository.findReference(tx, eventId, reference);

      if (!clash) {
        return reference;
      }
    }

    throw AppException.conflict(
      'conflict',
      'A registration reference could not be allocated. Try again.',
    );
  }
}

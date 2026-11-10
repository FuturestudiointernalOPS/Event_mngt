import { Injectable } from '@nestjs/common';
import type {
  ConsentDocument,
  ConsentRequirement,
  CreateConsentDocumentRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { toConsentDocument } from './consent.mapper';
import { ConsentRepository } from './consent.repository';
import {
  matchedAcceptances,
  missingRequiredConsents,
  toRequirementRecords,
  type AcceptedConsent,
  type ConsentRequirementRecord,
} from './consent.versions';

export interface RecordAcceptancesInput {
  organizationId: string;
  registrationId: string;
  requirements: readonly ConsentRequirementRecord[];
  accepted: readonly AcceptedConsent[];
  ipAddress?: string | null;
}

/**
 * Versioned consent documents and the evidence that they were accepted.
 *
 * The service exposes no update or delete path for a record: a consent record is
 * evidence, and rewriting it would destroy the fact it proves (WP-11).
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ConsentRepository,
  ) {}

  listForEvent(eventId: string): Promise<ConsentDocument[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const rows = await this.repository.listDocuments(
        tx,
        tenant.organizationId,
        eventId,
      );

      return rows.map(toConsentDocument);
    });
  }

  createDocument(
    eventId: string,
    input: CreateConsentDocumentRequest,
  ): Promise<ConsentDocument> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const latest = await this.repository.latestVersion(
        tx,
        tenant.organizationId,
        eventId,
        input.key,
      );

      const row = await this.repository.create(tx, {
        organizationId: tenant.organizationId,
        eventId,
        key: input.key,
        version: (latest?.version ?? 0) + 1,
        title: input.title,
        body: input.body,
        required: input.required,
        publishedAt: input.publish ? new Date() : null,
      });

      return toConsentDocument(row);
    });
  }

  /**
   * The latest published version of every key, for a caller that already owns a
   * transaction (the public form projection and registration submission).
   */
  async requirementsFor(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ConsentRequirementRecord[]> {
    const rows = await this.repository.publishedForEvent(
      tx,
      organizationId,
      eventId,
    );

    return toRequirementRecords(rows);
  }

  /** The same list without the internal document id, for public projections. */
  async latestPublished(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ConsentRequirement[]> {
    const records = await this.requirementsFor(tx, organizationId, eventId);

    return records.map(({ id: _id, ...requirement }) => requirement);
  }

  /**
   * Enforces and stores the accepted consents. A required document must be accepted at
   * its current version; an acceptance of an older version is treated as missing.
   */
  async recordAcceptances(
    tx: TenantPrismaClient,
    input: RecordAcceptancesInput,
  ): Promise<void> {
    const missing = missingRequiredConsents(input.requirements, input.accepted);

    if (missing.length > 0) {
      throw AppException.unprocessable(
        'consent_required',
        'The required consents were not accepted.',
        missing.map((requirement) => ({
          path: `consents.${requirement.key}`,
          message: `Version ${requirement.version} must be accepted`,
        })),
      );
    }

    const matched = matchedAcceptances(input.requirements, input.accepted);

    for (const requirement of matched) {
      await this.repository.createRecord(tx, {
        organizationId: input.organizationId,
        registrationId: input.registrationId,
        documentId: requirement.id,
        documentKey: requirement.key,
        documentVersion: requirement.version,
        ipAddress: input.ipAddress ?? null,
      });
    }
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

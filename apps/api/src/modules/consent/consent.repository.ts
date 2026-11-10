import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { ConsentDocument as ConsentDocumentRow } from '../../database/prisma-client';

/**
 * Consent documents and their append-only records.
 *
 * Every query carries the organisation predicate; a document id from another tenant is
 * never reachable (R7, docs/03). Records are inserted here and never updated.
 */
@Injectable()
export class ConsentRepository {
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

  listDocuments(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ConsentDocumentRow[]> {
    return tx.consentDocument.findMany({
      where: { organizationId, eventId },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  latestVersion(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    key: string,
  ): Promise<{ version: number } | null> {
    return tx.consentDocument.findFirst({
      where: { organizationId, eventId, key },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
  }

  create(
    tx: TenantPrismaClient,
    data: {
      organizationId: string;
      eventId: string;
      key: string;
      version: number;
      title: string;
      body: string;
      required: boolean;
      publishedAt: Date | null;
    },
  ): Promise<ConsentDocumentRow> {
    return tx.consentDocument.create({ data });
  }

  publishedForEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ConsentDocumentRow[]> {
    return tx.consentDocument.findMany({
      where: { organizationId, eventId, publishedAt: { not: null } },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createRecord(
    tx: TenantPrismaClient,
    data: {
      organizationId: string;
      registrationId: string;
      documentId: string;
      documentKey: string;
      documentVersion: number;
      ipAddress: string | null;
    },
  ): Promise<void> {
    await tx.consentRecord.create({
      data: { ...data, accepted: true },
    });
  }
}

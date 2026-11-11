import type { ConsentDocument } from '@event-platform/shared';
import type { ConsentDocument as ConsentDocumentRow } from '../../database/prisma-client';

export function toConsentDocument(row: ConsentDocumentRow): ConsentDocument {
  return {
    id: row.id,
    key: row.key,
    version: row.version,
    title: row.title,
    body: row.body,
    required: row.required,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

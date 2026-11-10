import type {
  Innovation as InnovationContract,
  OrganizationProfile as OrganizationProfileContract,
  ParticipantProfile as ParticipantProfileContract,
  PublicInnovation,
  PublicParticipantProfile,
} from '@event-platform/shared';
import type {
  Innovation,
  OrganizationProfile,
} from '../../database/prisma-client';
import type { ParticipantProfileWithReference } from './participant-profiles.repository';

/** Row → contract. The public variants drop every contact detail. */

export function toParticipantProfile(
  row: ParticipantProfileWithReference,
): ParticipantProfileContract {
  return {
    id: row.id,
    registrationId: row.registrationId,
    reference: row.registration.reference,
    headline: row.headline,
    bio: row.bio,
    company: row.company,
    jobTitle: row.jobTitle,
    websiteUrl: row.websiteUrl,
    photoUrl: row.photoUrl,
    visibility: row.visibility,
    moderationStatus: row.moderationStatus,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
    moderationNote: row.moderationNote,
  };
}

export function toOrganizationProfile(
  row: OrganizationProfile,
): OrganizationProfileContract {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.websiteUrl,
    logoUrl: row.logoUrl,
    contactEmail: row.contactEmail,
    country: row.country,
    sector: row.sector,
    visibility: row.visibility,
    moderationStatus: row.moderationStatus,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
    moderationNote: row.moderationNote,
  };
}

export function toInnovation(row: Innovation): InnovationContract {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    externalUrl: row.externalUrl,
    imageUrl: row.imageUrl,
    visibility: row.visibility,
    moderationStatus: row.moderationStatus,
    participantProfileId: row.participantProfileId,
    organizationProfileId: row.organizationProfileId,
    submittedAt: row.submittedAt.toISOString(),
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
    moderationNote: row.moderationNote,
  };
}

export function toPublicParticipantProfile(
  row: ParticipantProfileWithReference,
): PublicParticipantProfile {
  return {
    displayName: `${row.registration.person.firstName} ${row.registration.person.lastName}`.trim(),
    headline: row.headline,
    bio: row.bio,
    company: row.company,
    jobTitle: row.jobTitle,
    websiteUrl: row.websiteUrl,
    photoUrl: row.photoUrl,
  };
}

export function toPublicInnovation(row: Innovation): PublicInnovation {
  return {
    title: row.title,
    summary: row.summary,
    category: row.category,
    externalUrl: row.externalUrl,
    imageUrl: row.imageUrl,
  };
}

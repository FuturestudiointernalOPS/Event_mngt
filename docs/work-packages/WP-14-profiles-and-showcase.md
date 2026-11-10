# WP-14 — Profiles and showcase

**Wave** 2 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/profiles/**`, `apps/api/src/modules/participants/**`
**Depends on** WP-10

## Goal

A participant or an organisation can present itself, and the public showcase only ever
shows listings a staff member approved.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/profiles` | `profile:read` | participant profiles, filterable by moderation status |
| `GET /workspaces/:slug/events/:eventId/profiles/:profileId` | `profile:read` | one profile |
| `PATCH /workspaces/:slug/events/:eventId/profiles/:profileId` | `registration:manage` | edit on the participant's behalf |
| `PUT /workspaces/:slug/events/:eventId/registrations/:registrationId/profile` | `registration:manage` | create or replace the profile for a registration |
| `POST /workspaces/:slug/events/:eventId/profiles/:profileId/moderate` | `profile:moderate` | approve or reject |
| `GET /workspaces/:slug/events/:eventId/showcase` | `profile:read` | listings for the event |
| `POST /workspaces/:slug/events/:eventId/showcase` | `registration:manage` | add a listing |
| `POST /workspaces/:slug/events/:eventId/showcase/:innovationId/moderate` | `profile:moderate` | approve or reject |
| `GET /workspaces/:slug/organization-profile` | `profile:read` | the workspace's own profile |
| `PUT /workspaces/:slug/organization-profile` | `workspace:manage` | create or replace it |
| `GET /workspaces/:slug/events/:eventId/participants` | `participant:read` | people with their registrations |
| `GET /workspaces/:slug/events/:eventId/participants/:personId` | `participant:read` | one participant |
| `GET /public/events/:eventSlug/showcase` | public | approved profiles and innovations only |

## Rules

- A participant profile belongs to exactly one registration (`registrationId` unique) and
  therefore to one event. It starts as `DRAFT`; sending it for review makes it `PENDING`.
- Moderation is three-state and only staff can decide: `PENDING → APPROVED | REJECTED`.
  Approving an already approved profile is `409 conflict`.
- `visibility` defaults from the `showcase` module setting `publicByDefault`; a listing is
  public only when it is **both** approved and public. Moderation alone never exposes it.
- The organisation profile is one per organisation. It is the only row keyed by
  `organizationId` instead of an event, because a company listing is a workspace fact.
- Innovations attach to an event and to either a participant profile or an organisation
  profile. They carry their own moderation status and follow the same rule.
- The public showcase runs inside the organisation scope resolved from the event slug, and
  its projection contains no email, phone, internal id of another tenant, or unapproved row.
- Every tenant query carries the `organizationId` predicate; another tenant's profile is
  `not_found`.

## Acceptance (each becomes a test)

1. A profile starts `DRAFT` and becomes `PENDING` when submitted.
2. Only staff can approve; a second approval is `conflict`.
3. An approved but private profile is absent from the public showcase.
4. An approved and public profile appears, without email or phone.
5. An unapproved innovation is absent publicly even when its profile is approved.
6. The organisation profile is one row per organisation; a second `PUT` replaces it.
7. Participants list joins people to their registrations inside one event.
8. Another tenant's profile or participant is not found.

## Integration requests to the pre-flight

- Schema: `ParticipantProfile`, `OrganizationProfile`, `Innovation`,
  `ModerationStatus`, `ProfileVisibility` (frozen).
- Contracts: `contracts/profiles.ts`.
- Register `ProfilesModule` and `ParticipantsModule`; catalogue their routes.

## Out of scope

Participant self-service editing (needs the participant-account decision in `docs/11` D4),
image uploads beyond the storage URL, search ranking and AI summaries.

## Handover

- `modules/profiles/` owns profiles, the organisation profile and showcase listings;
  `modules/participants/` is the read model over people and their registrations.
- `allowParticipantEditing` is stored and surfaced but honoured only when participant
  accounts exist; staff edit on their behalf today. Recorded as a deliberate gap.
- Risk: the public showcase is org-scoped, so a large showcase is paginated at the
  organisation level; wave 4 can add a cached projection without changing the contract.

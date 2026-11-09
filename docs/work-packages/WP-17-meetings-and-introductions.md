# WP-17 — Meetings and introductions

**Wave** 3 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/meetings/**`, `apps/api/src/modules/introductions/**`
**Depends on** WP-05 (module registry), WP-14 (profiles and showcase)

## Prerequisites — waves 1 and 2 are not in the tree

Both features attach to participant profiles, so WP-14 must land first. In this repository
there is no `participant_profiles` table, no `modules/profiles/` and no participant access
guard; the shared permission strings (`meeting:*`, `introduction:*`) and the registry entries
already exist, and are reused rather than duplicated.

If WP-14 exposes profiles under different names or without an account link, **stop** and
raise an integration request. Do not invent a second profile table inside these modules.

## Goal

An event's networking programme runs end to end: a participant can propose a meeting and
staff can move an introduction request from "asked" to "introduced" with a recorded outcome,
and every state change is explainable afterwards.

## Contract — meetings

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/meetings` | `meeting:read` | list meetings, filter by status, paginated |
| `POST /workspaces/:slug/events/:eventId/meetings` | `meeting:manage` | propose a meeting between two profiles |
| `PATCH /workspaces/:slug/events/:eventId/meetings/:meetingId` | `meeting:manage` | accept, decline, cancel or complete |

## Contract — introductions

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/introductions` | `introduction:read` | queue, filter by status, paginated |
| `POST /workspaces/:slug/events/:eventId/introductions` | `introduction:manage` | record a request with a reason |
| `PATCH /workspaces/:slug/events/:eventId/introductions/:introductionId` | `introduction:manage` | assign, decide, mark introduced, record outcome |
| `GET /workspaces/:slug/events/:eventId/introductions/:introductionId` | `introduction:read` | request, assignment and full status history |

Participant self-service (a signed-in participant proposing or accepting without an
organisation role) is a **separate slice** and is out of scope here. It needs the participant
access guard and the account link that WP-14 introduces; it calls the same service methods
rather than duplicating the state machine.

## Rules — shared

- **Module gating.** Both features refuse writes with `module_not_enabled` unless `meetings`
  (respectively `introductions`) is enabled for the event, and the registry's `showcase`
  dependency is satisfied.
- **Same event, same tenant.** Both profiles must belong to the event and the organisation;
  an id from another event or tenant is reported as `not_found`, in the same wording as a
  genuinely missing id.
- **Profiles must be visible.** Only profiles in an approved, non-hidden state can be paired.
  A draft or rejected profile is not found.
- **No self-pairing.** A meeting or introduction whose two parties are the same profile is
  refused with `invalid_reference`.
- **Explicit tenant predicates.** Every query runs through `withTenant` with
  `organization_id` and `event_id`; row-level security is the second layer.

## Rules — meetings

- States are `PROPOSED → ACCEPTED | DECLINED | CANCELLED`, and `ACCEPTED → COMPLETED |
  CANCELLED`. Anything else is `invalid_transition`.
- Only the recipient can accept or decline. Either party can cancel while the meeting is
  proposed or accepted. Completion requires `ACCEPTED` and records an outcome of `MET`,
  `NO_SHOW` or `FOLLOW_UP` with optional notes.
- At most one active meeting may exist for the same pair in the same event. A second proposal
  returns `duplicate_meeting` (409) while the first is proposed or accepted; after it is
  declined, cancelled or completed, a new proposal is allowed.
- The module setting `maxProposalsPerParticipant` caps the requester's active proposals.
  Exceeding it returns `proposal_limit_reached` (422).
- The module setting `requiresStaffConfirmation` is stored with the meeting so the UI can
  explain whether a staff decision is also required; the state machine remains the source of
  truth.
- A meeting has one outcome record. Changing an outcome after completion is a new staff
  action and is recorded in the status history.

## Rules — introductions

- States are `REQUESTED → ASSIGNED → INTRODUCED`, with `DECLINED` reachable from `REQUESTED`
  or `ASSIGNED`. `INTRODUCED` and `DECLINED` are terminal.
- `reason` is required when the module setting `requireReason` is on; `offeredHelp` is
  optional. Both are short free text, length-capped and never rendered as HTML.
- Staff assignment sets `assignedToUserId` and moves `REQUESTED → ASSIGNED`. With
  `autoAssign` on, a staff-created request is assigned to its creator; a request created
  without an actor stays `REQUESTED`.
- Every transition appends one `introduction_status_history` row with the previous and next
  state, the actor, the note and the time. History is append-only: no update or delete path
  exists.
- Outcomes are recorded when the request becomes `INTRODUCED` (`CONNECTED`, `FOLLOW_UP`) or
  `DECLINED` (`NO_MATCH`, `DECLINED`), with optional notes.
- An assignment must name a member of the organisation holding `introduction:manage`; a user
  id outside the organisation is refused as `invalid_reference`.

## Schema this package needs (declared for the pre-flight)

From WP-14: `participant_profiles` with `organization_id`, `event_id`, `registration_id`, a
display name, an approval/visibility state, and (for the participant slice) a nullable
`user_id` account link.

This package adds, each carrying `organization_id` and `event_id` directly:

- `meetings` — two distinct profile ids, status, `proposed_at`, `duration_minutes`, note,
  `decided_at`, outcome enum and notes, actor, timestamps; index on
  `(organization_id, event_id, status)`.
- `introduction_requests` — requesting profile id, reason, offered help, status,
  `assigned_to_user_id`, `decided_at`, outcome and notes, timestamps; index on
  `(organization_id, event_id, status)`.
- `introduction_status_history` — request id, from state, to state, actor, note, created at;
  append-only.

Each table needs a tenant policy in `prisma/policies/tenant-rls.sql`, a classification in the
policy coverage test, shared contracts and API-path entries. Enums live in the schema and
are mirrored by Zod enums in the shared package.

## Acceptance (each becomes a test)

Meetings:

1. Propose, accept, complete with an outcome; the listing shows the final state.
2. Proposing a meeting with the same profile twice is refused with `invalid_reference`.
3. A profile id from another event or organisation is not found.
4. A second active proposal for the same pair is refused with `duplicate_meeting`.
5. Accepting or declining a meeting that is not `PROPOSED` is refused with
   `invalid_transition`.
6. Only the recipient may accept or decline; a third profile with `meeting:manage` may
   cancel but not accept.
7. The proposal cap from `maxProposalsPerParticipant` is enforced.
8. A meeting in an event without the `meetings` module enabled is refused.

Introductions:

9. Request with a reason, assign to a staff member, mark introduced, record an outcome; the
   history contains every transition in order.
10. A request without a reason is refused when `requireReason` is on.
11. Assigning a user outside the organisation is refused as `invalid_reference`.
12. Declining an introduced request is refused; the terminal state cannot be reopened.
13. A request from another event or organisation is not found.
14. No endpoint can update or delete a status-history row.

## Integration requests to the pre-flight

- The three models and their migration, RLS policies and policy-coverage entries.
- Shared contracts: meeting and introduction requests, responses, enums, list queries.
- API paths for both route groups.
- `MeetingsModule` and `IntroductionsModule` registration in the composition root.
- Seed: two approved profiles in one demo event, used by the tests.

## Out of scope

Matching or recommendation logic, calendar integration, video links, notifications and email
delivery, participant self-service routes, and agenda/session scheduling.

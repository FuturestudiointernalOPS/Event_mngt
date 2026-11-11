# 20 — Data retention, participant export and erasure

Phase 7 (privacy). This is a plan, not a description of shipped behaviour: nothing in this
document exists yet unless the "what already exists" section says so. The blocking product
decisions are D1–D6 in `11-open-decisions.md`.

## Why this is worth doing

The platform already promises participants that their data will not be kept forever, and
the beta checklist (`19-beta-runbook.md`) asks for a retention period per workspace. Today
that promise is kept by hand, which has three consequences:

1. **An omission is invisible.** Nothing fails, nothing is logged, and the workspace simply
   keeps data longer than it said. That is the worst failure mode: silent.
2. **A participant cannot act on their own data.** Asking for a copy or a deletion means
   finding a member of staff and hoping they know which screen to use.
3. **The data keeps growing.** Larger tables mean slower exports and reports, and more
   personal data exposed if anything leaks.

Automation turns a promise into a mechanism that can be checked, and gives the person the
data is about a route that does not depend on staff availability.

## What already exists

- **Anonymisation rules.** Erasing a person replaces their identifying fields and keeps the
  registration, check-in and badge rows, so counts, reports and issued badges stay correct.
  The replacement address uses a reserved domain that cannot receive e-mail.
- **Staff erasure of one registration.** It exists, it is authorised by `registrations.erase`,
  and it is audited. It operates on the **person**, not on the registration: the person row is
  shared across the organisation, so one erasure removes that identity from every
  registration of that person in that workspace.
- **Organisation-wide exports.** Staff with `reports.export` can request a CSV or PDF of one
  event's registrations; the file expires after seven days.
- **A scheduled cleanup.** A small maintenance task already runs on a timer for the
  rate-limit counters. It is the pattern a retention sweep should follow.
- **No participant credential.** A badge stores only a hash of its code and the code is
  displayed once. There is no participant account, session or stored secret.

## A — Retention period per workspace

### Decisions to take before coding

| Question | Recommendation |
| --- | --- |
| What counts as "last activity"? | A person is kept while they have a registration in an event that has not ended, then for the configured period after the last event they took part in. Without this rule the sweep would erase people already registered for the next edition. |
| Anonymise or delete? | Anonymise, reusing the existing rule. Deleting rows would make past reports wrong and is not needed to satisfy retention. |
| Who owns the setting? | The workspace. The platform administrator can see it but does not override it. |
| What does an empty setting mean? | Keep indefinitely — but only as an explicit choice, shown as such in the screen. |

### Steps

1. **Store the period.** A nullable integer on the workspace settings row, in months, with
   bounds (1–120) validated in the shared contract. Null means "no limit".
2. **Expose it.** Read and update through the existing workspace settings routes, under the
   capability that already governs settings (`organization.edit`). No new capability: the
   same screen, the same right.
3. **Dry run first.** A preview that answers "how many people are past the period" using
   exactly the predicate the sweep uses, so the number shown is the number erased. Nobody
   should be able to erase a hundred people by guessing.
4. **The sweep.** A daily maintenance task, following the rate-limit cleanup pattern:
   for each workspace with a period set, compute the cut-off, select the eligible people,
   apply the existing anonymisation in bounded batches, and record what it did.
5. **Report the run.** One audit entry per erased person (the existing action), plus one
   summary entry per run with the number examined and the number erased. A run that erases
   nothing must still be visible, otherwise a broken sweep looks like a quiet week.
6. **Tests.** Cut-off arithmetic across month and year boundaries; a person registered for a
   future event is never eligible; the preview matches the sweep; a second run is a no-op;
   a workspace without a period is untouched.

### Acceptance

- Setting a period and running the preview changes nothing.
- Running the sweep twice erases the same set once.
- Reports and counts for past events are unchanged afterwards.
- The run is visible in the audit log.

## B — Participant export and erasure

### The blocker

There is no way to know that the person asking is the person in the data. A badge is not a
usable credential (shown once, never retrievable), and there is no participant account.

### Options

| Option | Cost | Verdict |
| --- | --- | --- |
| Signed link sent by e-mail | Small: one public page, one verification step, reuse of the e-mail adapter | **Recommended** |
| Use the badge code as the credential | Superficially cheap | Rejected: the code cannot be re-shown, so a participant who lost the e-mail is stuck and support must intervene |
| Real participant accounts | Large: identity, sessions, a capability set, a new screen area | Out of scope for the beta |

### Design for the recommended option

1. **Request page.** A public page where the participant enters their e-mail. The answer must
   be identical whether or not the address exists, and the route must be rate-limited,
   otherwise the page becomes a way to discover who is registered where.
2. **Signed link.** Short-lived, single use, bound to the person **and** the workspace. Sent
   through the existing e-mail adapter.
3. **Verification.** The verification read happens before the tenant is known, like the
   public registration flow. The corresponding read must be added to the row-level security
   policies explicitly, with the same care as the public registration path.
4. **The answer.** Everything held about that person in that workspace, grouped by event:
   identity, registrations, answers, consents, badges and check-ins. A structured document
   is the honest machine-readable answer; a readable table can be derived from it.
5. **Erasure.** Reuse the existing anonymisation. The confirmation must state that the
   identity disappears from **all** of that person's registrations in the workspace, because
   that is what the mechanism does.
6. **Audit.** The existing erasure entry, plus a marker distinguishing a self-service request
   from a staff action, so support can answer "did they ask us, or did we do it?".
7. **Tests.** Expired link, reused link, a link from one workspace cannot read another,
   a second erasure is a no-op, and an unknown address produces the same visible answer.

### Acceptance

- A participant with no account can obtain and erase their data.
- The request page reveals nothing about who is registered.
- Erasing leaves counts and reports intact.
- Nothing in the flow requires a staff member.

## Order of work

1. **Event appearance is already done** (banner and colour overrides, with the public theme
   merged server-side). It is listed here only because it was part of the same privacy and
   presentation review.
2. **Retention** next: smallest, no new public surface, immediately valuable.
3. **Participant export and erasure** last: it needs the verification step and a policy
   change, and it is the one where a mistake is most visible.

## Deliberately not in scope

- Deleting rows instead of anonymising.
- A participant account area with saved preferences.
- Per-event retention periods. One period per workspace is enough for the beta; per-event
  values would make "what happens when editions overlap" a new decision.
- Exporting data across workspaces. A person is one row per workspace and must stay that way.

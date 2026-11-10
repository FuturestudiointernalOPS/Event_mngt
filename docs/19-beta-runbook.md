# 19 — Innovation Village beta runbook

Phase 8. This is a checklist, not a design: the decisions it depends on are in
`11-open-decisions.md` and must be taken first.

## Before (decisions that block go-live)

- [ ] **D1 Data ownership** and **D2 retention / consent wording** agreed in writing; the
      consent text entered for the event and the retention period set (workspace → Privacy).
- [ ] **E-mail provider**: sender domain verified; a test registration received the e-mail.
- [ ] **Hosting region** confirmed acceptable for participant data.
- [ ] Production environment built per `18-deployment-and-operations.md`; security checklist
      ticked; backup restore drilled.

## Configure (no engineering needed once the platform is up)

1. Organisation admin creates the account, verifies the e-mail, creates the workspace.
2. Branding: upload logo and favicon, set colours; read the contrast warnings.
3. Team: invite staff and assign roles (Registration Manager, Check-in Staff, Reporting
   Officer…). Everyone with access to participant data turns on two-factor authentication.
4. Create the 2026 event; enable modules **Registration, Showcase, Meetings, Introductions,
   Check-in, Reporting**; set categories (e.g. Visitor, Startup, Investor, Partner), form
   fields, capacities and the consent statement; choose approval mode per category.
5. Preview, then publish. Share `/e/<slug>`.

## Simulate (one week before)

- Register 30–50 test people across categories; confirm, reject and cancel a few.
- Have staff approve profiles and innovations; run a few meeting and introduction requests
  through to an outcome.
- **Check-in rehearsal on the real phones and entrance Wi-Fi**: download the manifest with a
  connection, switch to airplane mode, scan 10 badges, reconnect, confirm they sync and that
  scanning the same badge twice reports a duplicate. Also try the manual lookup.
- Run the load test against staging with the expected peak (`apps/api/scripts/load-test.ts`).
- Erase the test data (registrations tab → Erase, or the retention purge) before launch.

## Event day

- Two devices at the entrance, one spare; staff signed in beforehand and manifest downloaded.
- Watch the check-in tab (live counts, refreshes every 15 s) and the audit log.
- If connectivity drops: keep scanning; the queue is durable and syncs on reconnect.
- If a badge will not scan: manual lookup by name or e-mail, then Check in.

## After

- Export the registrations CSV (Reports → Export) for the organisers; it contains personal
  data, so store and share it accordingly.
- Review the reports and the public figures (small groups are hidden by design).
- Apply the retention period; keep the aggregate figures.
- Hold a short review against the beta learning objectives and log what to change.

## Rollback / incident

- A bad release: redeploy the previous image; migrations are additive, so the previous API
  keeps working against the newer schema unless a release notes says otherwise.
- A workspace misbehaving or compromised: suspend it from the Super Admin console.
- Suspected leaked participant link: Resend link rotates it; the old one stops working.
- Suspected leaked admin session: revoke sessions (Security) and reset the password.

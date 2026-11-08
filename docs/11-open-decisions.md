# 11 — Open decisions

Nothing here blocks the Phase 1 foundation. Each item needs a decision owner before the
phase that depends on it.

## Resolved (recorded so they are not reopened casually)

| Question | Decision | Rationale |
| --- | --- | --- |
| Supabase Auth / Storage? | **No.** Database hosting only | Master plan, backend plan and both prompts forbid it; PRD table 10.6 was stale |
| Per-tenant deployments? | **No.** One deployment, branding as data | White-label via configuration, not builds |
| Microservices? | **No.** Modular monolith | Team size and P0 timeline; module boundaries preserve the option |
| Auth approach? | Custom NestJS, Argon2id, JWT + rotating refresh | Explicit requirement; avoids provider lock-in |
| Validation approach? | Zod contracts shared by API and web | One source of truth; removes duplicated DTOs |
| Recurring events? | Event rows linked by `parent_event_id` (editions) | Preserves per-edition reporting and history |
| Participant categories? | Event-specific | Cross-event or global categories were explicitly rejected |

## Blocking decisions

### D1 — Data ownership across editions

Who owns the record accumulated over years: the ministry/institution, the village team, or
both? Determines export rights, admin roles and deletion authority.

- **Owner:** Future Studio + Innovation Village leadership
- **Needed by:** Phase 4 (data governance surfaces), Phase 6 (exports)
- **Default if unresolved:** organisation owns its data; platform admin has support access
  with audit trail.

### D2 — Retention, deletion and consent wording

Retention periods per record type, hard-delete vs anonymise, and the exact consent text and
legal basis (with review).

- **Owner:** Future Studio + legal review
- **Needed by:** Phase 4 (consent capture), Phase 8 (launch)
- **Default if unresolved:** retain event records indefinitely; support deletion requests
  manually with audit; consent wording drafted and marked provisional.

### D3 — Hosting region and residency

Whether data must stay in-country or in a specific region, affecting database and object
storage choices.

- **Owner:** Future Studio
- **Needed by:** before the production environment is created

### D4 — Participant identity reuse

May one person's identity be reused across events? Across organisations? The default is
**no cross-tenant sharing**, which is also the privacy-safest option.

- **Owner:** Product
- **Needed by:** Phase 4 (person modelling)
- **Default:** within one organisation, reuse email-matched person records across that
  organisation's events, with explicit participant consent; never across organisations.

### D5 — Email provider and sender domain

Resend, SES or other; sender domain strategy and SPF/DKIM/DMARC setup.

- **Owner:** Future Studio
- **Needed by:** Phase 2 (invitations), Phase 4 (confirmations, badges)
- **Default:** adapter interface implemented; provider chosen at deployment time.

### D6 — Peak load targets

Expected peak registrations, concurrent check-ins, acceptable API latency — used to size
the load tests and the pooling configuration.

- **Owner:** Future Studio + Innovation Village
- **Needed by:** Phase 7

## Non-blocking, revisit later

| Topic | Note |
| --- | --- |
| Pricing and subscription model | No billing code in MVP; organisation fields leave room |
| Custom domains | Future enhancement; slug + header resolution works today |
| MFA | Schema allows it; enable for privileged roles in Phase 7 |
| SMS / WhatsApp notifications | Adapter seam exists; not built |
| Public organisation directory | Not in MVP; visibility rules already model it |
| Event-scoped staff assignment | Phase 3 refines Event Manager to assigned events only |
| AI assistance | P2; registry entry reserved, no dependency created |

## Decisions taken in this consolidation that deviate from a source document

1. **PRD §10.6 technology table** proposed Supabase Auth and Supabase Storage. Superseded
   by the absolute Supabase restriction; the table must not be used for implementation.
2. **PRD §10.2** mentions "realtime/event data" in the data layer. Realtime is explicitly
   forbidden; live counts are served by polling or the API, not Supabase Realtime.
3. **Backend plan §13** and **frontend plan §10** use different phase names. This
   documentation maps both onto the eight product phases in
   `10-roadmap-and-backlog.md` so BE and FE milestones stay aligned.
4. **Validation** was left open ("class-validator or Zod"). Zod was chosen for contract
   sharing with the frontend.

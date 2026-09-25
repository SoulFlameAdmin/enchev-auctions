# SYSTEM 30 — Operational readiness

Phase 30 provides a concrete operating model for incidents and outages. It does **not** declare the company production-launch ready.

The canonical machine-readable contract is `config/enchev-operational-readiness.json`.

## Service ownership

Every current or planned runtime plane has an owner role and escalation path. PostgreSQL remains authoritative for auction truth; Redis/realtime/browser state remain support/projection planes.

## Runbooks

The contract contains executable operator checklists for:

- web/API outage;
- realtime outage;
- worker outage;
- database outage;
- Redis outage;
- storage/provider outage;
- data corruption;
- credential compromise.

Every runbook has five mandatory sections: **detect → contain → recover → verify → never**. Recovery may not trade auction correctness for availability.

## Incident severity

- **SEV-0** — authority/winner/bid correctness, corruption or critical credential compromise may be affected.
- **SEV-1** — major critical-journey outage without safe workaround.
- **SEV-2** — partial degradation with safe fallback.
- **SEV-3** — minor defect without critical journey or authority impact.

A single incident commander owns severity, assignments, communications and closure. Security incidents require a security lead.

## Data corruption

The first action is containment and evidence preservation. A repair may use only a verified source/backup/replay path and must retain audit evidence. Cache, browser or realtime projections can never replace authoritative PostgreSQL truth.

## Credential compromise

Suspected credentials are revoked/disabled first, then rotated. Replacement secrets may not be pasted into logs, issues or chat. Old credentials must be proven rejected.

## Maintenance and emergency changes

Emergency status shortens approval routing; it does not remove auditability, rollback requirements, security controls or the production approval gate.

## Readiness review

The operational review is complete as a review, but `productionLaunchApproved=false`. Outstanding provider and final-acceptance blockers remain explicit, including Redis, backup-retention alignment, authoritative production data-plane readiness, object storage and real mobile release evidence.

GREEN for 30.14 therefore means **the review happened and its conclusion is evidenced**, not that production launch has been approved.

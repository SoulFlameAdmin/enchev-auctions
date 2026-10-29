# ENCHEV CLOSED DEMO / MISSION-003 — role policy foundation

Status: YELLOW — unmerged stacked draft; policy-only verification, not real sign-in.
Observed: 2026-10-30.
Parent: [P0 CLOSED DEMO overlay](URGENT_DAVID_AGI_ENCHEV_CLOSED_DEMO_V1.md).
Dependency: MISSION-002 isolated boundary from [PR #385](https://github.com/SoulFlameAdmin/enchev-auctions/pull/385), stacked on MISSION-001 [PR #384](https://github.com/SoulFlameAdmin/enchev-auctions/pull/384).

## Purpose

Prepare explicit role-and-resource access rules for five independent demo actors:
- **seller** — own vehicle intake, submit, own watermarked preview;
- **admin** — same isolated demo's approval, lot and auction operations, permitted audit;
- **mitko** — own bidder acceptance, bid, allowed document preview;
- **borko** — separate bidder with NO access to Mitko's resources;
- **automation** — read-only demo audit foundation; no winner selection, release, payment or real effects.

Each actor has a unique demo-only subject ID and session ID; duplicate roles, IDs and sessions are rejected. The role roster requires an actually issued MISSION-002 boundary, not a forged JSON object. Role checks are deterministic, fail closed on unrecognized actions, wrong scope, mismatched session, cross-bidder access and non-watermarked documents. Tests are offline with fixtures.

## Critical trust limitation

**This is NOT a login system and is NOT production authorization.** A caller could submit an alleged subject/session ID unless a separate server API verifies it. The current change does not expose an API, issue a cookie, read an OAuth provider, perform KYC, or grant database access. These fixtures cannot prove role ownership, prevent credential theft, or validate session expiry. It is an isolated authorization *policy foundation*, not MISSION-003 GREEN.

Existing [Etap 1 QA PR #377](https://github.com/SoulFlameAdmin/enchev-auctions/pull/377) contains a separate demo session design. Reuse or reconcile the server-side signature checks and authoritative session store in a reviewed integration PR; never accept user-submitted role claims as authority.

## Required acceptance to promote MISSION-003 to GREEN

1. Dedicated preview deployment of the correct project, with MISSION-002 isolation and no production external effects.
2. Independent signed server-only session authentication and server-side identity lookup for seller, admin, Mitko, Borko and automation. Human and automation principals must be distinct.
3. Application API verifies authenticated actor before using any role check, all resources are bound to a demo namespace; RLS / DB grants checked separately.
4. Positive session and role tests from two browsers/devices; real negative tests for role spoofing, cross-user access, logout, expiry, replay and forged session cookies.
5. CI lint/typecheck/build/dependency scan and exact-head Preview verified; no known critical release blocker; reviewed PR and evidence attached to the existing immutable Master task ID.
6. Only after this, start MISSION-004 persisted vehicle intake in the isolated demo database.

## Unchanged guardrails

No production deploy, DB migration, email, external payment, tax invoice, legal obligation or customer sale. Never mark SYSTEM points GREEN solely from local tests or isolated CI. Critical dependency audit and Forge media 404 remain [Issue #380](https://github.com/SoulFlameAdmin/enchev-auctions/issues/380). No new SYSTEM ID or GAP number was invented.

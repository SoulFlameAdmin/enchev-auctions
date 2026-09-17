# Enchev Auctions — 00.06 Dependency Inventory

Status: GREEN — dependency inventory implemented and verified with production evidence
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.06`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01`–`00.05`

This document inventories dependencies that are **actually observed** in the repository and connected GitHub/Vercel/Supabase state. It separates current runtime dependencies, development-only tooling and future/planned dependencies so unfinished systems are not presented as already installed.

This task does not add pricing, payment or finance scope.

## 1. Dependency classification

- **CURRENT-PROD** — actively used by the currently deployed Enchev web application.
- **DEV-EVIDENCE** — used to develop, test, coordinate or record engineering evidence; never auction authority.
- **PRESENTATION** — affects visuals/content but cannot decide auction truth.
- **PLANNED-UNBOUND** — required by later FROZEN tasks, but no production provider/runtime dependency is yet selected or implemented.
- **LOCAL-DEV** — workstation automation only; production must not depend on it.

## 2. Source/runtime package inventory

Observed from repository `package.json`:

| Dependency | Declared version | Class | Current role | Criticality |
| --- | --- | --- | --- | --- |
| `next` | `latest` | CURRENT-PROD | Next.js application/build/runtime | High for current web surface |
| `react` | `latest` | CURRENT-PROD | UI rendering | High for current web surface |
| `react-dom` | `latest` | CURRENT-PROD | Browser/server React rendering | High for current web surface |
| `typescript` | `latest` | DEV-EVIDENCE/build | Type checking/build tooling | High for engineering correctness |
| `@types/node` | `latest` | DEV-EVIDENCE/build | Node type definitions | Build-time |
| `@types/react` | `latest` | DEV-EVIDENCE/build | React type definitions | Build-time |
| `@types/react-dom` | `latest` | DEV-EVIDENCE/build | React DOM type definitions | Build-time |

Observed Vercel build logs resolve the current production build to **Next.js 16.3.5** and Vercel CLI **59.16.0** at verification time.

### Package-management findings

1. The repository currently has **no `package-lock.json`**.
2. App dependencies are declared as **`latest`**, so a fresh install can resolve different versions over time.
3. No Node `engines` constraint or `.nvmrc` is present in the observed tree.
4. This inventory therefore records a reproducibility risk; it does **not** silently fix or declare dependency pinning complete. Lockfile enforcement, dependency review and build provenance are owned by Phase 26.

## 3. GitHub dependency

### `SoulFlameAdmin/enchev-auctions`

Class: **CURRENT-PROD + engineering source of truth**

Observed state:

- default branch: `main`;
- connected GitHub permissions include push/admin for the current connector;
- Vercel production project is linked to this repository;
- automatic GitHub → Vercel deployments are active;
- repository visibility is currently reported by GitHub as **public**.

### Governance discrepancy found

The FROZEN Phase 01 tracker includes `Private GitHub repo enchev-auctions`, but the connected GitHub API currently reports `visibility: public`.

This inventory does **not** change repository visibility because that is a separate foundation/security action. The Phase 01 item must not rely on an old/default GREEN assumption; it requires later re-verification/correction before production readiness.

## 4. Vercel dependency

### Production project `enchev-auctions`

Class: **CURRENT-PROD**

Observed:

- project ID: `prj_X3TAEQf9oGE79te9NdNlvB6jnhno`;
- Git link: `SoulFlameAdmin/enchev-auctions`;
- production alias: `enchev-auctions.vercel.app`;
- framework: Next.js;
- recent production deployments are `READY`;
- observed production compute region on current deployments: `iad1`;
- build path uses `npm run build` → `next build`.

Current responsibility: hosting/build/deployment of the web/Command Center application.

Not yet proven: authoritative auction API, persistent realtime auction service, close worker, Redis or production provider infrastructure. Vercel hosting success alone is not proof of those future components.

### Other Vercel project

`enchev-auctions-web` (`prj_Pf4fv4ieojPRrCoeoXcxkoWmSqmU`) exists but is currently unlinked in the returned project list. It is **not** treated as a production dependency of the active application.

## 5. Supabase dependency

### Connected project

Project: `soulflame-twins`
Project ref: `frhletkiuupgksmgxoxc`
Region: `eu-west-1`
Status: `ACTIVE_HEALTHY`
Database: PostgreSQL 17 (`17.6.1.127` observed)

Class for Enchev today: **DEV-EVIDENCE**, not customer auction authority.

Observed Enchev-specific assets:

- `public.enchev_development_events` — engineering/CI/deployment evidence table;
- Edge Function `enchev-development-status` — active development-status function.

No Enchev production auction/bid/final-result/vehicle-domain/RBAC tables or authoritative auction function have been proven in the connected project during WAVE 0 inspections.

### Shared-project boundary

The Supabase project is shared with other SoulFlame/DAVID/restaurant functions. Therefore its current role must remain explicitly scoped: Enchev development evidence can coexist there, but later production data/security architecture must assess blast radius, RLS, credentials, backups and isolation before customer auction state is placed in any shared environment.

This task does not select a new paid project or create one.

## 6. Browser/platform dependencies in current UI

Class: **CURRENT-PROD browser platform**, but non-authoritative.

Observed current code uses:

- `localStorage` — Command Center/status/background persistence;
- `BroadcastChannel` — same-browser status synchronization;
- `MutationObserver` — local DAVID UI/control integration;
- `fetch` — browser requests, including local DAVID bridge requests;
- `URLSearchParams` — inventory query state;
- browser timers (`setInterval`, `setTimeout`) — demo/live visual countdown behavior.

These are presentation/development mechanisms. Per `00.03`/`00.04`, none may become authoritative bid ordering, timing or winner logic.

## 7. External presentation/content dependency

### Unsplash image CDN

Class: **PRESENTATION**

Current homepage/inventory sample vehicle cards reference `images.unsplash.com` URLs. If unavailable, imagery can fail while auction truth must remain unaffected.

The repository also contains a local hero asset under `public/images`, so not all imagery is externally hosted.

Before production inventory/media work, vehicle media must move to the controlled storage/media architecture defined by later FROZEN tasks rather than relying on demo Unsplash content.

## 8. DAVID local development tooling

Class: **LOCAL-DEV / DEV-EVIDENCE only**

Observed repository tooling:

- `tools/david/auto-continue-enchev-v2.mjs`;
- `tools/david/worker-control.mjs`;
- PowerShell/CMD launcher/install scripts;
- `tools/david/package.json` with `playwright-core` **1.63.0**;
- Microsoft Edge controlled through local CDP port `9444`;
- local DAVID bridge used by the frontend control UI at `http://127.0.0.1:9445`;
- custom local protocol `david-enchev://start`.

The repository README for this worker explicitly states that it is not part of the production application or auction runtime.

Production correctness, deployment, bidding, realtime or finalization must never require a specific developer PC, Edge profile, ChatGPT session, localhost bridge or DAVID worker.

## 9. Planned but currently unbound dependencies

The FROZEN plan requires the following categories later, but WAVE 0 evidence does not prove a concrete production dependency yet:

| Planned dependency category | Current state |
| --- | --- |
| Production PostgreSQL auction domain | PLANNED-UNBOUND / not implemented for Enchev |
| Supabase Auth / production identity path | PLANNED-UNBOUND |
| Redis environment | PLANNED-UNBOUND |
| Persistent WebSocket/realtime service | PLANNED-UNBOUND |
| Authoritative auction API/service | PLANNED-UNBOUND |
| Close/finalization worker/scheduler | PLANNED-UNBOUND |
| Object/media storage | PLANNED-UNBOUND |
| Search/index engine | PLANNED-UNBOUND |
| KYC/KYB provider | PLANNED-UNBOUND |
| Email provider | PLANNED-UNBOUND |
| SMS provider | PLANNED-UNBOUND |
| VIN/history provider if used | PLANNED-UNBOUND |
| Transport provider if used | PLANNED-UNBOUND |
| Monitoring/error tracking stack | PLANNED-UNBOUND |
| WAF/DDoS/security services | PLANNED-UNBOUND |

A planned provider does not become a dependency until its provider choice, environment boundary, credentials, failure behavior and ownership are actually implemented/verified in the relevant frozen task.

## 10. Dependency ownership and failure rule

Every future critical dependency must eventually record:

1. owner/component;
2. environment(s);
3. data handled and sensitivity;
4. authoritative vs derived role;
5. authentication/credential boundary;
6. timeout/retry/circuit behavior;
7. failure/degraded behavior;
8. monitoring/alerting;
9. recovery/restore path;
10. version/update policy;
11. exit/replacement strategy where practical.

No third-party or local tool may silently become winner authority merely because it is convenient.

## 11. Known dependency risks recorded by this task

These findings are **not** falsely marked solved by `00.06`:

- app package versions use `latest`;
- no app lockfile is present;
- no explicit Node runtime version is pinned in the observed repository;
- GitHub repo is currently public despite the Phase 01 `Private GitHub repo` requirement;
- current Supabase Enchev usage is inside a shared multi-project Supabase project;
- external Unsplash assets are demo/presentation dependencies;
- local DAVID/Edge/localhost tooling is development-only and must not leak into production authority;
- core auction/realtime/Redis/provider dependencies are not yet implemented.

These are routed to their existing downstream FROZEN tasks. No new task IDs are invented or renumbered here.

## 12. Acceptance criteria for 00.06

`00.06` may be GREEN only when:

1. actual current source/runtime dependencies are inventoried from repository evidence;
2. GitHub and Vercel deployment dependencies are identified;
3. the connected Supabase role is identified without falsely treating development evidence as auction authority;
4. browser/external-content/local-DAVID dependencies are classified;
5. planned-but-not-yet-implemented dependency categories are clearly separated from current dependencies;
6. dependency/version/isolation risks are recorded rather than hidden;
7. no pricing/payment/finance scope is added;
8. the exact implementation commit builds/typechecks and deploys successfully;
9. production HTTP/runtime verification shows no regression;
10. GREEN evidence records exact commit/deployment results.

## 13. Evidence

Implementation commit: `7bda0dbc9603ca068deac37591c9034f9c535c9c`

Production verification for that exact commit:

- Vercel deployment: `dpl_GEQf6ucwQZ8C4ctMEf7TPRhjGQCx`
- deployment state: `READY`
- `next build`: PASS
- Next.js 16.3.5 compile: PASS
- TypeScript: PASS
- static generation: 4/4 PASS
- production `https://enchev-auctions.vercel.app/`: HTTP 200
- Vercel runtime errors during verification window: 0
- GitHub combined commit status: Vercel `success`
- Supabase connected project: `soulflame-twins` (`frhletkiuupgksmgxoxc`) ACTIVE_HEALTHY; Enchev-specific runtime remains development evidence only (`enchev_development_events` / `enchev-development-status`), not auction authority

This evidence proves completion of the `00.06` dependency-inventory/governance task. It does not prove that the planned production auction dependencies are already implemented.

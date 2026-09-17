# Enchev Auctions — 00.02 Actors and Permission Map

Status target: MASTER SYSTEM PLAN v1.0 FROZEN task `00.02`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01 System scope and boundaries`

This document defines the actor and permission contract for Enchev Auctions. It does not claim that RBAC is already implemented. Runtime enforcement belongs to later identity, authorization, admin, yard, auctioneer and security tasks in the frozen plan.

## 1. Permission model rules

1. **Default deny.** An authenticated identity has no privileged capability unless a role/policy explicitly grants it.
2. **Server-side enforcement.** UI visibility is never authorization. Every protected API, database mutation, realtime subscription and worker command must validate authorization server-side.
3. **Least privilege.** Roles receive only the capabilities required for their operational responsibility.
4. **Object scope matters.** Permission to perform an action does not imply permission over every vehicle, auction, seller, buyer, organization, yard or country.
5. **No self-approval for high-risk actions.** Highest-risk overrides, role grants and final-result changes require independent approval where the frozen plan requires maker-checker/dual control.
6. **Auction authority is separate from user authority.** No human role, browser client, realtime transport or AI feature may bypass the authoritative auction transaction/finalization path defined by the system invariants.
7. **Auditable privileged actions.** Admin, support, compliance, auctioneer and yard exceptions must produce durable actor/action/target/time/reason evidence.
8. **AI is never a privileged actor.** AI may assist or recommend only; it cannot grant roles, approve identity, accept bids, select winners, finalize auctions or perform unaudited overrides.

## 2. Human actors

### Guest / Public visitor

Allowed:
- view public marketplace content, public vehicle pages and published auction information;
- use public search/filter/navigation;
- start registration/login flows.

Not allowed:
- place bids or enter protected live-auction rooms;
- view private bidder/seller/account data;
- mutate vehicles, auctions, users, documents or operational records.

### Buyer

Allowed when authenticated and eligible for the relevant market/auction:
- manage own buyer profile and permitted account settings;
- watch vehicles, save searches and use buyer workspace features;
- view auction state exposed to eligible buyers;
- submit pre-bids/max bids/live bids through the authoritative bid API;
- view own accepted/rejected bid receipts and own auction outcomes;
- use permitted release/pickup/logistics flows after a valid result.

Not allowed:
- see another bidder's private max bid;
- modify vehicle/seller records;
- change auction rules, close state or final result;
- access admin/support/yard-only data.

### Seller

Allowed within owned/delegated scope:
- create and maintain permitted vehicle/listing drafts;
- upload required media/documents through protected workflows;
- submit listings for review;
- answer public vehicle questions under seller identity;
- view own listing/auction operational state and permitted post-auction workflow.

Not allowed:
- approve own restricted compliance/review gates;
- view private bidder max values or bidder-only data;
- directly mutate accepted bids, winner selection or authoritative close state;
- perform admin exceptions.

### Support agent

Allowed within assigned support scope:
- search/read the minimum account, auction and case information required to resolve support issues;
- create/update support cases, complaints and dispute records;
- trigger only explicitly permitted support workflows.

Not allowed by default:
- place bids on behalf of users;
- grant privileged roles;
- approve own high-risk access escalation;
- rewrite accepted bid history or final results;
- access secrets or unrestricted identity documents without an explicit privileged workflow.

### Compliance / verification reviewer

Allowed within assigned review scope:
- review KYC/KYB/eligibility state and submitted evidence;
- apply permitted verification outcomes, holds and review reasons;
- access compliance audit history required for the case.

Not allowed:
- participate in bidding decisions;
- alter auction chronology or winner selection;
- use compliance access for unrelated marketplace browsing.

### Inspector

Allowed within assigned vehicle scope:
- create structured inspection observations and required media/provenance records;
- submit inspection versions for moderation/review.

Not allowed:
- publish a vehicle solely by inspection authority;
- change seller identity/ownership evidence;
- alter auction bids or final results.

### Yard / operations staff

Allowed within assigned yard/site scope:
- record intake, physical location, custody movements and handoffs;
- validate permitted pickup/release artifacts;
- update operational vehicle custody state through controlled workflows.

Not allowed:
- modify accepted bids or auction winner;
- bypass compliance/no-release holds;
- access unrelated user data outside operational need.

### Auctioneer / live-sale operator

Allowed within specifically assigned auction/lane scope:
- operate start/pause/resume/skip/reschedule controls that are explicitly permitted by auction rules;
- manage lane progression through server-authoritative commands;
- perform exceptional actions only through audited, policy-constrained workflows.

Not allowed:
- directly rewrite accepted bid rows;
- select a winner outside deterministic authoritative finalization;
- silently change auction rules after bidding has begun.

### Platform administrator

Allowed according to explicit admin permissions:
- manage users/roles/configuration/features and operational queues;
- administer vehicles/auctions/providers/system configuration where separately authorized;
- perform privileged interventions through audited workflows.

Restrictions:
- privileged access must be MFA/step-up protected when later identity tasks are implemented;
- highest-risk grants/overrides require maker-checker/dual control where specified;
- admin authority does not permit unaudited direct modification of authoritative bid/final-result history.

### Security / break-glass administrator

A separately controlled emergency actor, not an everyday admin role.

Allowed only under documented incident conditions:
- emergency access required for containment/recovery;
- credential/session/security intervention within the approved incident procedure.

Required controls:
- strong authentication;
- time-bounded use where possible;
- explicit reason/ticket/incident reference;
- alerting and post-use review;
- no routine business operation.

## 3. Non-human actors

### Application API / authoritative auction service

- validates identity, eligibility, auction state, increments, ordering and idempotency;
- is the only path allowed to commit accepted bids according to the authoritative transaction contract.

### Realtime service

- authenticates subscriptions and room access;
- distributes state/events but is **not** authoritative for winner selection;
- must force authoritative resync after gaps/reconnect conditions.

### Worker / scheduler / finalizer

- executes authorized background jobs under service identity;
- finalizes through the single authoritative close path;
- uses scoped service credentials and idempotent/retry-safe semantics.

### External providers

Examples include identity verification, messaging, vehicle-history and transport integrations when enabled.

Provider permissions are limited to the minimum data/action contract required for that integration. Provider responses are inputs to Enchev workflows, not unrestricted authorization to mutate auction truth.

## 4. High-level permission matrix

| Capability | Guest | Buyer | Seller | Support | Compliance | Inspector | Yard/Ops | Auctioneer | Admin |
|---|---|---|---|---|---|---|---|---|---|
| View public marketplace | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Manage own account/profile | No | Own | Own | Own | Own | Own | Own | Own | Own |
| Create/edit vehicle listing | No | No | Owned/delegated | No | Review only | Inspection only | Custody only | No | Scoped |
| Submit bid | No | Eligible self | No | No | No | No | No | No | No |
| View private max bid | No | Own only | No | No | No | No | No | No | No by default |
| Review identity/eligibility | No | Own status | Own status | Limited case view | Assigned cases | No | No | No | Scoped |
| Operate yard custody | No | No | No | Read if needed | Holds only | Inspection only | Assigned site | No | Scoped |
| Operate auction lane | No | No | No | No | No | No | No | Assigned lane | Scoped |
| Change accepted bid history | No | No | No | No | No | No | No | No | No direct permission |
| Override final result | No | No | No | No | No | No | No | No | Only through separately controlled maker-checker workflow if later enabled |
| Grant privileged roles | No | No | No | No | No | No | No | No | Separately authorized admin only |

`Own`, `assigned`, `scoped` and `delegated` are authorization constraints, not UI conventions. They must eventually be enforced in API/database/realtime policies and covered by cross-account/object-level authorization tests.

## 5. Role-combination and separation rules

- Buyer and seller capabilities may coexist on one human account only when each action is evaluated under the relevant role and object scope.
- Support access does not inherit admin authority.
- Compliance review does not inherit auctioneer authority.
- Yard access does not inherit seller or admin authority.
- Auctioneer authority is restricted to assigned events/lanes and never grants direct database bid mutation.
- Organization/delegated roles introduced later must narrow permissions further by organization, market, vehicle, auction or operational scope.
- Service identities are never represented as ordinary human accounts.

## 6. Enforcement locations required by later implementation

The permission map must be enforced consistently across:

- Supabase Auth/session identity;
- API authorization middleware/policies;
- PostgreSQL constraints/RLS where appropriate;
- realtime/WebSocket room authorization;
- object/media/document access;
- worker/service credentials;
- admin, support, compliance, yard and auctioneer command handlers;
- audit/event records for privileged actions.

## 7. Current implementation truth at creation of this artifact

At the time `00.02` was defined:

- the GitHub/Vercel application contains the frozen role requirements but not a complete Enchev RBAC implementation;
- the connected Supabase project contains no Enchev domain/RBAC tables beyond the Enchev development-evidence table;
- therefore this artifact is the **permission contract**, while implementation/enforcement remains tracked by later FROZEN tasks such as identity/access, RLS, admin security, yard permissions, auctioneer role controls and authorization-abuse tests.

## 8. Acceptance for 00.02

`00.02 Actors and permission map` is GREEN when:

- the actor set is explicitly defined;
- privileged and non-privileged boundaries are explicit;
- authoritative auction restrictions are preserved;
- the permission matrix distinguishes own/scoped/assigned access;
- high-risk separation-of-duty rules are documented;
- the artifact is committed to the FROZEN-plan repository;
- repository build/typecheck and production deployment remain healthy after the change.

This task does **not** mark later RBAC/security implementation tasks GREEN.
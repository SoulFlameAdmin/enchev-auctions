# ENCHEV AUCTIONS — URGENT LEGAL FOUNDATION v1
Last updated: 2026-11-03 | Launch target: 2027-03-01 09:00 Europe/Sofia
Status: Design + governance tracker. **NOT a legal opinion, not approval for real-money operations.**

## Non-negotiable source-of-truth rules
- The existing 119-day calendar (D001–D119, 799 estimated team-hours) is unchanged; legal requirements are linked to it.
- The MASTER SYSTEM PLAN (4,374 points) and its immutable numbering remain untouched.
- Additional legal requirements have permanent, separate IDs LEG-001 through LEG-163; do not renumber or fake-green existing points.
- The 163 requirements in `app/data/urgent-legal-foundation-v1.json` include: business model, contracts, KYC/KYB, vehicle ownership, auction rules, consumer rights, payments and taxes, title transfer, GDPR/DSA, technical evidence, international expansion, and 11 new legal modules.
- Each requirement has: `question, reason, implementation, acceptance, owner, priority, applicability, linkedDay, dueDate`.
- Dashboard status defaults to UNRESOLVED; never infer legal readiness from a code build or marketing demo.
- Mark APPROVED only with documented decision, named reviewer, evidence and test evidence; N/A only with a documented applicability decision by a reviewer.
- Manual dashboard acceptance cannot independently certify a real business transaction.

## What is live NOW
1. A complete register of 163 individually numbered requirements.
2. Eleven visible GO/NO-GO groups, including 14 particularly critical decision points in the final sign-off group.
3. Deadline/owner/P0 and daily execution links per item, with search and filters.
4. Local browser progress state, JSON backups/import and CSV export.
5. Official starter sources for GDPR, consumer law, DSA and DAC7, and explicit *legal review pending* for conditional laws.
6. Existing "⚡ Спешен план" button and 119-day tracking still first in the existing command center.

## What is NOT yet live
- Real contractual template delivery and durable-medium acceptance receipts.
- Secure admin sign-off and shared cloud status (local storage only).
- Paid KYC/KYB checks, verified VIN/title screening, AML program.
- Production payment service, escrow/wallet provider, signed webhooks, settlement ledger.
- Automatic invoicing/VAT/margin-tax/fiscal reporting/DAC7 exports.
- Mechanized legal gating in auction publish/bid/settlement/release endpoints.
- Live legal counsel validation, signed contracts or official transfer of an actual vehicle.
These are future implementation tasks, not implied by new dashboard controls.

## Decisions before building money-moving workflows
**D008 (by 10 Nov):** signed matrix of Seller of Record, buyer type, inventory ownership, direct vs agent role, cash flow, fee payer, territory, liability, whether private sellers and damaged/ELV vehicles permitted. Lead: Enchev + legal.
**D027 (by 29 Nov):** signed terms and pricing, contracts and bid validity/withdrawal model. Lead: counsel.
**D014/D021:** role, identity and vehicle ownership verification. Lead: product + legal + engineering.
**D077 (by 18 Jan):** consumer rights; an online auction must not be assumed to be the consumer-law 'public auction' exception. Lead: counsel.
**D084 (by 25 Jan):** settlement model, licensed PSP, payments, invoicing/VAT and documents. Lead: accountant + PSP + engineering.
**D112 (by 22 Feb):** prelaunch GO/NO-GO; no money without independent evidence and signed operational acceptance.

## Planned server-side implementation — cannot be replaced by UI
**Identity / authorities**
- `legal_entities` / `seller_profiles` / `buyer_profiles` / `role_grants` / `verification_reviews`.
- Require signed-in admins, MFA for high-risk actions, scoped RBAC/RLS, no PII in public logs.
- KYC data minimization and retention; outsource regulated verification when necessary.

**Contracts and consents**
- `document_templates` / `document_versions` / `acceptance_receipts`: immutable template digest, locale, effective dates, user/action, timestamp, evidence identifier.
- Offer pre-bid display of actual seller, final-price breakdown, binding rules, and applicable consumer-law disclosures.
- Preserve legal document snapshots for active and completed auctions.

**Vehicle and property checks**
- `ownership_reviews` / `lien_checks` / `vehicle_release_holds`: seller authority, title/documents, restricted/ELV status, insurance and transport handoffs.
- Hold publish, closing or release when legal eligibility is unresolved according to signed rules.
- Use protected object storage with safe upload policies; no personal documents in unrestricted UI/local storage.

**Auction invariants**
- `auction_rules_versions`, `accepted_bid_ledger`, `auction_closures` with server timestamp, one accepted sequential order, deterministic winner, anti-shill controls and uneditable audit.
- A dashboard checkbox cannot override a server decision.

**Money and documents**
- Money-flow diagram must be approved before selecting PSP and schema.
- `transactions` / `provider_events` / `commission_ledger` / `payout_reconciliations` / `tax_invoices` / `seller_tax_reports`.
- Validate PSP webhook signatures and idempotency; never promise 'escrow' until actual licensed arrangement exists.
- Cash in first MVP should be off by default. Legal cash thresholds, VAT rules, fiscalization and DAC7 reporting need versioned reviewed configurations, not model-generated constants.

**Consumer and post-sale**
- `withdrawal_requests` / `claims` / `disputes` / `delivery_receipts` / `transfer_documents`.
- Per-transaction seller classification; enforce only applicable rights and exceptions after counsel review.
- Separate Won, Sale Confirmed, Paid, Contract Signed, Ownership Transferred, Vehicle Released and Completed.
- For registered Bulgarian vehicles, confirm whether notarized signatures are needed under the specific legal facts.

**Launch readiness contract (target: future endpoint + server enforcement)**
1. `LaunchDecision` default `NO_GO` for `real_money` and `public_real_auction`.
2. `GO` may be issued only by authorized role with signed legal/finance/engineering/operations approvals, current evidence and verified test suite.
3. `GO` is scoped to a legal entity, country, transaction model, seller category, payer flow, environment and date range.
4. Fail closed on unknown, expired, contested or absent evidence and require incident rollback.
5. Approved documents and payment providers are referenced by immutable identifiers; never place credentials in browser.
6. Browser-local manual statuses are **informational** and are not accepted by this server contract.
7. Staging dry run and sandbox money may operate under separate `DEMO` mode; demos must be clearly marked and cannot issue genuine release documents.

## Validation
Run: `node scripts/verify-urgent-legal-foundation.mjs`.
Acceptance: 163 unique sequential IDs, 12 categories, 11 gates, 119 unchanged days and every linked day valid; UI before weekly task tracker and approval requiring evidence/test/reviewer.
Manual acceptance: legal counsel reviews conditional/ambiguous requirements; accounting consultant signs tax/fiscal flows; independent tester checks actual production interactions before real money.

## Official starting points
- EU Consumer Rights Directive: https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng
- NRA DAC7 portal: https://portal.nra.bg/details/dpi-dac7
- Digital Services Act: https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package
- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj

No numeric cash threshold or claim of universal auction/AML/licensing exemption should be hardcoded without a current primary-source legal check.

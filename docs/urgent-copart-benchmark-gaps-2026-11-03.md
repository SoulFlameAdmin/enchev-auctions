# ENCHEV AUCTIONS × COPART — Functional Benchmark & Launch Scope
**As of 03.11.2026** · Deadline **01.03.2027** · status **SPECIFICATION / NOT IMPLEMENTATION CERTIFICATION**

**Objective:** Deliver a legally and technically verifiable Bulgaria + Spain pilot of a full auction business flow. Copy *business capability patterns*, **not** Copart's source code, branding, templates or terms. The system must have its own pricing, legal documents, contracts and operational responsibilities.

**The frozen execution baseline stays exactly 119 D001–D119 days and 799 estimated team-hours.** This append-only layer adds feature-specific acceptance checks; the new volume must be re-estimated and prioritized. Do not claim that 69 mandatory-by-launch controls fit inside the original 799 hours without a fresh capacity plan. The MASTER SYSTEM v1.0 / Expansion v2.0 / GAP tracker and DAVID infrastructure are untouched.

## 1. Verified external benchmark: Copart Spain vs USA

- **ES:** Registered business/professional buyers, ID and business/activity documentation, authority for scrap buyers, active membership; B2B restrictions apply in ES. Copart Spain is **not** evidence that private individuals may bid on all ES lots.
- **ES:** Auctions/vehicle search, advance bidding, online auctions, multiple yards, inspection, seller documentation, mandatory buyer fees, document transfer and yard retrieval, transport available. Live price bids in ES may be quoted **ex VAT**; tax depends on buyer and seller context and requires country-specific review.
- **ES:** Published fee tables dated **06 January 2026** include Basic/Premium membership, a tiered buyer charge, online bid charge, document administration, lot retrieval, late payment, storage and relist. Some Copart ES FAQ mirrors conflict on the retrieval fee (€31.70 vs €45) even while referring to 2026. This means **DO NOT IMPORT LIVE RATES**.
- **ES:** The buyer-side flow includes a payment deadline expressed as three working days and pickup within five working days (including auction day according to current FAQs), bank transfer, invoice, gate-pass PIN after payment/documents, export/ELV requirements. These deadlines are **Copart rules only**, not automatically Enchev contractual terms.
- **USA (functional ideas; not asserted for Spain):** pre-bid, proxy/max bids (Copart BID4U brand), live virtual bid, automatic countdown reset, reserve/On Approval seller acceptance, counteroffer, Buy It Now, Make an Offer. US fee rules and USD figures must never be confused with Spanish pricing.
- **Seller-side:** Company as agent/auctioneer or seller-of-record, seller documents and title, commission and payout. Copart discloses payment collection from buyers and payment onward to sellers as an operational service, but exact process is not a license to collect or hold client funds in Bulgaria.

Official sources:
- Copart ES FAQ and 2026 fees: https://www.copart.es/Content/ES/EN/Support/FAQ-Topics/Index
- Copart ES English fee reference: https://www.copart.es/en/Content/es/de/support/faq-topics/index
- Copart ES registration: https://www.copart.es/Content/ES/es-es/Support/How-to-Buy/Join
- Copart ES terms: https://www.copart.es/Content/es/es-ES/Member-Terms-Conditions
- Copart US bidding modes: https://www.copart.com/help/bidding-and-buying/ways-to-bid-buy
- Copart US terms (last revised July 09, 2026): https://www.copart.com/Content/US/EN/Member-Terms-and-Conditions
- Copart US member guide: https://www.copart.com/content/us/en/landing-page/member-guide

## 2. Plan comparison — important difference between COVERAGE and DELIVERED CODE

Source of truth: `app/data/urgent-auction-benchmark-v1.json` cross-linked with `app/data/urgent-119-days.json` and the separate 163-point legal catalog. The first 119 plan's **wording** includes:
- **27 explicit** functionalities, but these have not been independently certified as implemented.
- **23 partial** areas where detailed business and acceptance rules are missing.
- **26 specification gaps** added to the linked days.
- **69 P0 pilot/launch-facing controls** and **7 P1** (later pilot or phase 2); these are controls not additional days.

| Capability | D days already in baseline | What must now be added or proven |
|---|---|---|
| Seller of record, membership, buyer eligibility | D008–D014 | Signed B2B/B2C/territory, membership and buying-power limits, licensed demolition buyer, business document matrix |
| Vehicle intake, catalog, title and condition | D015–D028 | Provenance, title/extract/export/scrap statuses, owner authorizations, yard and inspection work orders |
| Full auction engine and legally binding award | D029–D056 | Pre-bid, proxy/max, tie policy, seller approval vs provisional winner, no winner before approval, detailed cancel/relist, time extension |
| Revenue model and transparent transaction fees | D057–D063, D079–D084 | Versioned configurable fee engine, buyer/seller fees, live vs prebid, country/tax/VAT, paid/unpaid, fee waiver and refund rules |
| Documents / company purchase | D018, D046, D058–D065, D072–D083 | Complete checklist, agreement version hashes, owner/title/export/ELV originals, invoices/credit notes, buyer/seller settlement |
| Buyer funds, payment and seller settlement | D059–D084 | Bank transfer/PSP, payment reconciliation, deposits as liabilities, chargeback and payout approval; never mark manual screenshots as confirmed payment |
| Vehicle pickup and logistics | D061–D062, D081–D083, D105 | Single-use gate pass; docs+paid hold; yard appointments; transporter identity; insurance; proof of delivery |
| Security & audit | D085–D091, D112–D118 | Independent security results, RLS, immutable audit/reproducible fee snapshots, load/restoration testing, signed launch GO |

**No blanket copying:** Enchev can improve UX and pricing; Copart's user interface, code, brand, wording, photos and proprietary templates are not transferred. The US examples are *feature categories*, not terms binding ES or BG.

## 3. 2026 Copart Spain financial benchmark — reference only

Published figures are **EUR net**, plus applicable VAT where due, subject to specific version, buyer status and geography.

| Component | Copart ES public reference | Implementation in ENCHEV |
|---|---|---|
| Basic / Premium membership | €26.42 / €52.84 annually (net) | configurable, **unset** pending Enchev decision |
| Buyer fee | tiered €34.88→€530.72 under €15,500; 3.60% at/above €15,500 | `BUYER_TIER` with versioned price ranges |
| Online LIVE bid fee | €10.57 below €6,750; €17.96 €6,750–13,499.99; €25.36 at/above €13,500 | `VIRTUAL_LIVE`, pre-bid distinction |
| Lot retrieval | €45 on 06.01.2026 dated reference; **older/mirrored page also €31.70** | `GATE_LOADING`, independent rule/version |
| National document transfer | €151.12 | `TITLE_TRANSFER`, only when service actually applies |
| Export administration | €109.90 | `EXPORT_ADMIN` |
| Late payment | €36.99 | `LATE_PAYMENT`, only Enchev-approved rule |
| Storage after grace period | €10.57 per calendar day/lot | `STORAGE`, calendar and location rule |
| Relist after nonpayment | 10% of sale price, min. €285.33 | `RELIST`, no automatic fee without signed policy |

Illustrative **Copart benchmark arithmetic**, not a quote, price commitment or Enchev invoice: winning price €5,000 with buyer fee €454.94 (the €4,458–5,559.99 bracket), LIVE fee €10.57, lot retrieval €45 and a selected national document-transfer service €151.12 totals **€5,661.63 before applicable VAT**. Real tax, other charges and service applicability vary; a buy-now or pre-bid route may apply different charges.

**Never hardcode competitor fees as Enchev rules.** Every Enchev fee must have `feeCode, market, sellerEntity, buyerTaxCountry, chargeableEvent, payer, taxCategory, currency, effectiveFrom, effectiveTo, feeVersion, valueRule, waiverPolicy, roundingPolicy, approvedBy`. Use **integer minor units** and decimal-safe VAT, not floating point. Same fee event must not be charged twice.

Order of financial calculations:
1. Check authorization and legally accepted tariff version. `auction_rules_snapshot` and `fee_rules_snapshot` are immutable per transaction.
2. Calculate hammer price, separate buyer charges, seller charges, services, taxes, deposits, PSP costs and refund adjustments.
3. Display **estimated maximum total before the binding bid**. After the bid closes, issue a versioned invoice/payment request only on the legally approved path.
4. Match incoming money via provider-verified webhooks or dual-approved bank reconciliation; do not trust a client browser flag.
5. Reserve platform revenue vs buyer money vs seller payable vs tax liabilities as **separate ledger accounts**. Deposits are liabilities, not company revenue.
6. `release_authorization` needs payment received, documents complete, allowed buyer and logistics clearance. Seller settlement requires reconciled source of funds and financial approval.

## 4. Mandatory end-to-end documents (17 flows, none yet legally signed)

The machine-readable list is in the scope JSON. Critical categories:
- **Before auction**: seller consignment agreement; owner and liability declaration; VIN, photographs, damage, title and authenticity; buyer's KYC/KYB, approved license and accepted versioned terms.
- **After successful auction**: award / seller confirmation (or seller approval hold), purchase summary, pre-invoice / invoice (only after tax confirmation), exact fee breakdown and payment instruction.
- **After payment**: independently matched bank/PSP proof, seller settlement report, original ownership/registration/transfer powers, export or destruction certificate if applicable.
- **Pickup**: gate pass token, carrier consent/authorization, transport quote, CMR/waybill if applicable, signed handover.
- **Exceptions**: missing original, re-sale/relist, payment default, partial refund, complaint, chargeback, credit note.

Each document: `docType, requiredFor, country, legalEntity, issuer, subject/lotId/transactionId, sourceHash, templateVersion, acceptedTermsVersion, signers, timestamp, verificationStatus, expiry, immutableAuditRef, accessPolicy`. Originals and notarization where legally required cannot be substituted by an arbitrary PDF. All files are permissioned and personal-data minimization applies.

**A documents-release gate is NOT simply a generated PDF:** no pickup before the *required actual documents* and real reconciled payment.

## 5. Business state machines

**Lot:** DRAFT → EVIDENCE_REVIEW → APPROVED → SCHEDULED → LIVE → CLOSED → {SELLER_APPROVAL_PENDING | AWARDED | UNSOLD | CANCELLED} → {RELISTED | INVOICE_PENDING}.

**Transaction:** AWARDED → DOCS_PENDING → PAYMENT_REQUESTED → {PARTIAL | PAID | FAILED | DISPUTED} → RELEASE_ALLOWED → VEHICLE_COLLECTED → SELLER_SETTLED → COMPLETED. Negative adjustments through CREDIT_NOTE/REFUND, without rewriting the original ledger.

**Payment:** initiated → provider/statement verified → reconciled → releasable; a webhook re-delivery or retried request cannot produce a second ledger entry. Sandbox is not real money.

**Pickup:** BLOCKED (unpaid / missing ownership / unauthorized carrier) → READY → PIN_ISSUED → REDEEMED (one use) → SIGNED_HANDOVER. Never trust client time, cookie or manual paid toggle.

**Auction:** all authoritative state server/DB-based, sequence, idempotency, tie-breaking, seller approval and reserve independent from a browser demo.

## 6. Where the gaps enter the frozen 119-day plan

| Deadline gate | Binding scope additions |
|---|---|
| **D008** business decision | Who sells, professional/private buyers, tiered membership/buying-power, commission, deposit and refund model signed by Enchev |
| **D013–D023** identity/inventory | Country documents, professional licenses, title status, actual owner authorization, complete seller file |
| **D026–D056** auction core | Pre-bid/proxy, seller approval, reserve, deterministic winner, atomically accepted bids, reconnect, competition |
| **D057–D070** demo commercial flow | Fee rule engine, invoice lines, pro forma, document vault, gating, customer-visible total cost, independent sandbox payments |
| **D071–D084** regulated flow | Lawyer, accountant, provider contracts, VAT decision matrix, payment reconciliation, supplier settlement, seller/transaction ledger |
| **D085–D091** protection | RLS, attack tests, safe recovery, 100 concurrent pilots, no unexplained money movement |
| **D092–D105** real closed pilot | Documented real legal deal only after GO, real ownership, actual buyer, money source, signed delivery or remain sandbox |
| **D106–D119** launch | Mobile parity, operational alerts, finance/admin reporting, legal/security GO, rollback and 24h support plan |

The eight **signature gates** are in the same JSON. A conditional NO-GO means **demo or sandbox only**, not production with improvised paperwork.

## 7. Owners and decisions requiring real-world authority

- **Енчев:** business & seller-of-record, markets (BG/ES), pricing and membership, which buyer types allowed, financial processor and funding.
- **Митко:** full-system architecture, commercial pricing rule design, product acceptance, operations/SLA, evidence and scope management.
- **Борко:** secure Next.js/DB schema, payment and fee engine, versioning, access control, realtime, UI/UX and CI coverage.
- **Адвокат BG/ES:** terms, customer status, property/title transfer, dispute/refunds, KYC/AML applicability, jurisdictional eligibility and document originals.
- **Счетоводител:** VAT, cross-border flows, invoice/credit-note formats, recognized platform revenue vs GMV and payouts.
- **Payment provider/bank:** allowed merchant model and verification, client funds handling, bank reconciliation and chargebacks.
- **Transport/yard partner:** storage, lot holding, pickup authorization, chain-of-custody and insurance.

**Major capacity risk:** 69 P0 conditions across 48 linked days do not imply they can be completed at the historical estimate of 799 hours. The plan should be re-estimated with *overlap deduction*, owners, parallel work and signed restrictions. Prioritize safe paid transaction pilot first; avoid declaring whole Copart global-scale parity by 01.03.2027.

## 8. March 1: definition of truly ready

Launch is **GO** only with a real validated end-to-end path:
seller with ownership → verified lot → authorized buyer → server-approved bid → deterministic awarded winner → versioned tax/fee invoice → real provider/bank confirmation → legal document clearance → signed release and handover → seller payout / reconciliation and audit. No critical/high security blockers. Every step has independently verifiable, appropriately access-restricted evidence. Otherwise limit public access to **demo / no real funds**.

P1 / phase 2 options: optional Buy It Now and Make an Offer, richer watchlist/inspection appointments, customer support, certain storage/CRM improvements. These are documented, but must not hold a safe pilot hostage unless Enchev elects them as mandatory.

## 9. Technical implementation contract

The `app/data/urgent-auction-benchmark-v1.json` planning layer contains:
- **76** CP-nnn function IDs with acceptance, linked D day, source, legal refs and baseline coverage.
- **20** fee codes, all `enabled:false`, `amount:null`, `feeRuleVersion:null`.
- **17** document workflows, each `templateStatus:"not-legal-approved"`.
- **8** approval gates, each pending signature.
- Original `app/data/urgent-119-days.json` and 163 legal requirements unchanged.

The urgency dashboard must show this as a **separate Copart functional checklist**; a manual item is accepted only with actual PASS + evidence. The display must never infer completion just from the presence of a spec.

**Implementation state today:** This document and UI/data are specifications and work tracking. They do **not** create bank integrations, document templates, tax eligibility or real bidding. They do not change live prices or production databases.

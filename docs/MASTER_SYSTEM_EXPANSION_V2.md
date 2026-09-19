# ENCHEV AUCTIONS — MASTER SYSTEM EXPANSION v2.0 APPEND-ONLY

Status: ACTIVE
Base: `docs/MASTER_SYSTEM_PLAN_V1_FROZEN.md`
Machine-readable expansion: `app/master-system-expansion-v2/part-1.json` … `part-4.json`
System worker: `tools/david/auto-continue-enchev-v5.mjs`
Identity digest: `FNV1a32 e7c9cf20`

## Purpose

Extend the frozen 1,054-point technical plan into a company-level operating system for a real international vehicle-auction and cross-border vehicle-trading business.

The frozen plan remains immutable. Expansion v2 adds 38 phases (62–99) and 3,226 new evidence-gated system points. Frozen + expansion baseline is **4,280 system points**. The existing append-only GAP registry currently contains **94 tasks**, so the unified SYSTEM tracker contains **4,374 system points**.

This is not a claim that every jurisdiction has identical legal, tax, customs, payment or consumer rules. Country-specific activation always requires the configured country profile, authoritative external data/providers where applicable, and qualified legal/tax/compliance sign-off where the task requires it.

## Governance law

1. Frozen phases 00–61 and their existing task IDs never move, disappear, renumber or change meaning.
2. Expansion phases 62–99 are append-only and identity-locked by CI.
3. Every expansion task starts RED.
4. GREEN requires concrete evidence.
5. Tasks marked `test` require explicit PASS/SUCCESS evidence.
6. New discoveries after v2 use append-only GAP IDs; they are never hidden by changing old task meanings.
7. FINAL SYSTEM ACCEPTANCE (phase 47) is blocked by every non-GREEN task outside phase 47, including phases 62–99 and manual GAP items.
8. Expansion phases obey their explicit `dependsOn` graph. CI rejects dependency cycles and later-wave dependencies.
9. Pricing, payments, settlement, accounting, tax, FX, customs, CRM and company-operation scope is explicitly authorized by this expansion.
10. Legal/tax/regulatory outcomes must not be guessed or hardcoded into UI/business logic. They are country-configured and evidence-gated.

## Scale

- Frozen system tasks: **1,054**
- Expansion v2 tasks: **3,226**
- Frozen + expansion baseline: **4,280**
- Existing append-only GAP tasks: **94**
- Unified SYSTEM tracker: **4,374**
- Frozen + expansion test tasks: **1,201**
- Expansion test tasks: **965**
- Expansion security tasks: **192**
- Expansion legal tasks: **74**
- Expansion global/international tasks: **116**
- Expansion core tasks: **1,879**
- Expansion phases: **38**

## New phases

| Phase | Domain | Wave | Tasks | Explicit dependencies |
|---:|---|---:|---:|---|
| 62 | Corporate operating model, legal entities & governance | 3 | 74 | 00, 02, 04, 32 |
| 63 | Commercial roles, marketplace model & contract architecture | 4 | 80 | 15, 54, 59, 62 |
| 64 | Pricing, fees, commissions & commercial quote engine | 7 | 86 | 21, 63, 67 |
| 65 | Payments, deposits, refunds, payouts & settlement | 7 | 86 | 04, 05, 16, 24, 52, 63, 64, 67, 69 |
| 66 | Accounting ledger, reconciliation & close | 12 | 86 | 03, 24, 64, 65, 67 |
| 67 | VAT, sales tax, invoicing & fiscal documents | 4 | 84 | 15, 21, 54, 63 |
| 68 | Treasury, FX, currency exposure & liquidity | 12 | 86 | 65, 66, 67 |
| 69 | AML, sanctions, high-value vehicle & financial-crime controls | 5 | 84 | 05, 52, 53, 54, 63 |
| 70 | Customs, tariffs, origin & cross-border clearance | 4 | 85 | 21, 54, 55, 60, 63, 67 |
| 71 | Vehicle import eligibility, homologation & technical compliance | 4 | 85 | 06, 21, 54, 60, 70 |
| 72 | Title, ownership transfer, registration & post-sale documents | 7 | 86 | 06, 13, 60, 70, 71 |
| 73 | International freight, ports, carriers & delivery orchestration | 7 | 86 | 13, 55, 60, 70, 71, 72 |
| 74 | Insurance, cargo risk, claims & loss handling | 7 | 86 | 55, 73 |
| 75 | Seller/dealer acquisition, CRM & account management | 7 | 85 | 05, 35, 59, 63 |
| 76 | Buyer acquisition, CRM, lifecycle & sales operations | 7 | 85 | 04, 05, 33, 59, 63 |
| 77 | Customer service, multilingual contact center & SLA | 7 | 86 | 12, 14, 21, 57, 63 |
| 78 | Disputes, cancellations, returns, reversals & chargebacks | 7 | 84 | 14, 15, 37, 54, 63, 65, 72, 73, 74 |
| 79 | Procurement, supplier management & third-party commercial governance | 12 | 86 | 20, 55, 58, 63, 66 |
| 80 | Yard, warehouse, parking, fleet & capacity operations | 7 | 86 | 13, 60, 72, 73 |
| 81 | Vehicle intake, inspection, reconditioning & readiness | 7 | 86 | 06, 34, 60, 80 |
| 82 | Photography, video, media studio & listing content operations | 8 | 86 | 34, 35, 49, 56, 81 |
| 83 | Auction operations, scheduling, lanes & capacity planning | 8 | 86 | 08, 10, 11, 36, 61, 81, 82 |
| 84 | Country/market configuration & launch factory | 8 | 85 | 21, 31, 39, 54, 55, 63, 67, 69, 70, 71 |
| 85 | Localization, translation, content & legal catalog operations | 8 | 85 | 21, 56, 57, 84 |
| 86 | International vehicle catalog, taxonomy & search data quality | 8 | 85 | 06, 21, 38, 85 |
| 87 | Landed-cost, tax/customs estimate & price transparency | 12 | 86 | 64, 67, 68, 70, 73, 74, 84 |
| 88 | Fraud, trust, investigations & loss prevention | 9 | 85 | 16, 41, 53, 65, 69 |
| 89 | Management accounting, profitability & executive reporting | 12 | 86 | 66, 68, 75, 76 |
| 90 | Data platform, BI, warehouse, experimentation & decision systems | 7 | 86 | 17, 24, 29, 50, 51 |
| 91 | Marketing, growth, SEO, affiliate & partnership operations | 13 | 85 | 56, 57, 75, 76, 85, 90 |
| 92 | HR, people operations, internal IAM & training | 3 | 82 | 04, 16, 52, 62 |
| 93 | Internal backoffice, approvals, workflow automation & RPA | 12 | 86 | 14, 24, 50, 59, 75, 76, 77, 78, 79 |
| 94 | IT service management, incident, problem & change management | 12 | 86 | 23, 27, 30, 43, 55 |
| 95 | Business continuity, disaster recovery & regional/site failover | 12 | 86 | 17, 27, 30, 40, 43, 48, 51, 55, 80, 94 |
| 96 | Corporate security, GRC, assurance & audit program | 12 | 85 | 16, 41, 49, 52, 54, 55, 58, 62, 69, 94, 95 |
| 97 | Legal/compliance operations, policy lifecycle & regulatory change | 12 | 84 | 15, 29, 54, 62, 63, 67, 69, 84, 96 |
| 98 | Country-by-country production launch, scale & localization acceptance | 14 | 85 | 39, 45, 46, 84, 85, 86, 87, 91, 94, 95, 96, 97 |
| 99 | International company final operating acceptance & scale readiness | 14 | 85 | 44, 45, 46, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98 |

## Execution meaning

The numeric phase ID is an immutable taxonomy ID. The real execution order is the existing execution-wave model plus the explicit `dependsOn` DAG.

Typical dependency chain:

foundation / architecture / identity / international config
→ corporate/commercial role model
→ tax/compliance / AML / customs rules
→ pricing
→ payments/settlement
→ accounting/treasury
→ ownership/title/import eligibility
→ freight/insurance/yard/intake
→ auction operations
→ seller/buyer CRM and support
→ country configuration/localization
→ fraud/risk/data/finance reporting
→ marketing/people/backoffice/ITSM/GRC
→ country production launch
→ international-company operating acceptance
→ final system acceptance.

## Current standards / authoritative-reference baseline

The plan treats the following as reference or applicability baselines, not as a substitute for jurisdiction-specific professional advice:

- OWASP ASVS 5.0 — https://owasp.org/projects/asvs
- NIST SP 800-63-4 — https://csrc.nist.gov/pubs/sp/800/63/4/final
- W3C WCAG 2.2 / ISO/IEC 40500:2025 — https://www.w3.org/WAI/standards-guidelines/wcag/
- ISO 4217 currency identifiers — https://www.iso.org/iso-4217-currency-codes.html
- EU GDPR processing principles — https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en
- EU Digital Services Act — https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- European Accessibility Act — https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en
- EU EORI — https://taxation-customs.ec.europa.eu/customs/customs-procedures-import-and-export/customs-operations/economic-operators-registration-and-identification-number-eori_en
- EU TARIC — https://taxation-customs.ec.europa.eu/online-services/online-services-and-databases-customs/eu-customs-tariff-taric_en
- EU VAT special schemes — https://taxation-customs.ec.europa.eu/taxation/vat/vat-special-schemes_en
- EU Consumer Rights Directive overview — https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en

## Country-launch law

A country cannot be marked production-ready merely because the website has a translation. The country launch chain must prove, where applicable:

- legal entity / contracting model;
- trader/seller/buyer classification;
- KYC/KYB eligibility;
- sanctions/AML applicability;
- tax/VAT/fiscal-document model;
- currency/rounding/FX behavior;
- customs/EORI/tariff/import-export routing;
- vehicle import eligibility / homologation;
- title/ownership/registration documents;
- transport/carrier/insurance network;
- payment/payout/provider routing;
- consumer/marketplace disclosures;
- privacy/data-transfer/residency review;
- accessibility/localization completeness;
- support language/hours;
- operational runbooks;
- monitoring/alerts;
- rollback;
- production pilot;
- legal/tax/compliance sign-off evidence.

## Completion law

Expansion v2 is complete only when phases 62–99 are all GREEN with concrete evidence and all prerequisite frozen-plan work remains GREEN.

ENCHEV is not “100% complete” until phase 47 can pass its runtime gate across:
- all frozen tasks 00–61;
- all expansion tasks 62–99;
- all append-only GAP tasks;
- required production/country evidence.

No task count is a quality target by itself. New tasks are added only when they represent a real missing requirement, control, test, operating process, legal gate, recovery path or production proof.

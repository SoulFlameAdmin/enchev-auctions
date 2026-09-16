"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "green" | "yellow" | "red";
type Kind = "build" | "test" | "security" | "legal" | "money" | "ops" | "international" | "ai";
type TaskDef = { id: string; label: string; kind: Kind; defaultStatus: Status; gate?: string };
type PhaseDef = { id: string; title: string; tasks: TaskDef[] };
type SavedTask = { status?: Status; note?: string; evidence?: string; updatedAt?: string };
type CustomGap = { id: string; label: string; status: Status; note: string; createdAt: string };

const G = "green" as const;
const Y = "yellow" as const;
const R = "red" as const;

const t = (id: string, label: string, kind: Kind = "build", defaultStatus: Status = R, gate?: string): TaskDef => ({ id, label, kind, defaultStatus, gate });
const p = (id: string, title: string, tasks: TaskDef[]): PhaseDef => ({ id, title, tasks });

const phases: PhaseDef[] = [
  p("00", "Клиент, договор и scope", [
    t("00.01", "Заключен Phase 1 Production MVP scope", "ops", Y, "Писмено потвърден scope"),
    t("00.02", "Плащане €10k: 40% / 30% / 30%", "money", Y, "Потвърдени milestones"),
    t("00.03", "Exclusions + Change Request правило", "legal", Y),
    t("00.04", "Клиентът притежава production provider акаунтите", "ops", Y),
    t("00.05", "IP/source-code/licence/reuse rights са описани", "legal"),
    t("00.06", "Acceptance criteria за всеки milestone", "test"),
    t("00.07", "Warranty vs new feature правило", "legal"),
    t("00.08", "Client decision log / approvals", "ops"),
  ]),

  p("01", "Clean foundation и delivery", [
    t("01.01", "Private GitHub repo SoulFlameAdmin/enchev-auctions", "build", G),
    t("01.02", "Clean Next.js + TypeScript foundation", "build", G),
    t("01.03", "Vercel project enchev-auctions", "build", G),
    t("01.04", "GitHub main → Vercel automatic deployment", "test", G),
    t("01.05", "Supabase project", "build"),
    t("01.06", "Redis production-capable environment", "build"),
    t("01.07", "Monorepo: web/api/realtime/worker/packages", "build"),
    t("01.08", "CI lint/typecheck/unit/integration/build", "test"),
    t("01.09", "Preview / staging / production separation", "ops"),
    t("01.10", "Web/API/realtime/worker health endpoints", "test"),
    t("01.11", "Master Control cloud persistence", "build"),
    t("01.12", "Master Control multi-device realtime sync", "test"),
  ]),

  p("02", "Environment, config и secrets", [
    t("02.01", "Typed environment schema + startup validation"),
    t("02.02", "No secrets committed to Git", "security"),
    t("02.03", "Separate dev/staging/prod credentials", "security"),
    t("02.04", "Secret rotation procedure", "security"),
    t("02.05", "Country/market configuration registry", "international"),
    t("02.06", "Feature flags with safe defaults", "ops"),
    t("02.07", "Kill switches for bidding/payments/providers", "security"),
  ]),

  p("03", "Database и source of truth", [
    t("03.01", "PostgreSQL authoritative database"),
    t("03.02", "Migration framework + immutable migration history"),
    t("03.03", "UUID/entity ID strategy"),
    t("03.04", "UTC timestamps everywhere", "international"),
    t("03.05", "Money = integer minor units + ISO currency", "money"),
    t("03.06", "Transactional outbox for reliable events"),
    t("03.07", "Idempotency-key storage"),
    t("03.08", "Append-oriented auction/finance history"),
    t("03.09", "Database constraints protect invariants", "test"),
    t("03.10", "Seed data and deterministic test fixtures", "test"),
  ]),

  p("04", "Identity, organizations и RBAC", [
    t("04.01", "Supabase Auth integration"),
    t("04.02", "Email verification / recovery / session lifecycle"),
    t("04.03", "Buyer profile"),
    t("04.04", "Business buyer / organization profile"),
    t("04.05", "Seller organization profile"),
    t("04.06", "Roles: Buyer/Seller/Support/Finance/Admin/Super Admin"),
    t("04.07", "Permission matrix enforced server-side", "security"),
    t("04.08", "Admin MFA / step-up auth", "security"),
    t("04.09", "Session revoke / account suspend", "security"),
    t("04.10", "Cross-account IDOR tests", "test"),
  ]),

  p("05", "KYC, KYB, sanctions и eligibility", [
    t("05.01", "KYC provider adapter"),
    t("05.02", "KYB provider adapter"),
    t("05.03", "Manual-review fallback", "ops"),
    t("05.04", "Verification state machine"),
    t("05.05", "Buyer eligibility engine"),
    t("05.06", "Seller eligibility engine"),
    t("05.07", "Compliance holds block bid/payment/release", "security"),
    t("05.08", "Sanctions/export-control provider hook", "international"),
    t("05.09", "Biometrics OFF by default", "legal"),
    t("05.10", "Eligibility decision audit/evidence", "legal"),
  ]),

  p("06", "Seller onboarding", [
    t("06.01", "Seller type: trader/private/platform"),
    t("06.02", "Platform role: marketplace/broker/platform seller", "legal"),
    t("06.03", "Company details and beneficial-owner hooks"),
    t("06.04", "Seller bank/settlement details with restricted access", "money"),
    t("06.05", "Seller approval queue", "ops"),
    t("06.06", "Seller cannot publish before approval", "test"),
    t("06.07", "Seller-of-record shown per lot", "legal"),
  ]),

  p("07", "Vehicle inventory и provenance", [
    t("07.01", "Vehicle create/edit/version workflow"),
    t("07.02", "VIN / lot number / identifiers"),
    t("07.03", "Make/model/trim/year/body/engine/fuel/transmission"),
    t("07.04", "Odometer value/unit/status"),
    t("07.05", "Primary/secondary damage"),
    t("07.06", "Run & Drive / engine / airbags / flood / fire / hail"),
    t("07.07", "Title/document/export status"),
    t("07.08", "Vehicle location / yard / country"),
    t("07.09", "Provenance per fact: verified/seller/third-party/AI/unknown", "legal"),
    t("07.10", "Secure image upload"),
    t("07.11", "Secure private-document upload", "security"),
    t("07.12", "Media ordering/thumbnails/metadata stripping", "security"),
    t("07.13", "Seller submit → Admin review → Approve/Reject", "ops"),
    t("07.14", "Material edits create a new version", "test"),
  ]),

  p("08", "Catalog, search и public marketplace", [
    t("08.01", "Public vehicle/lot detail page"),
    t("08.02", "Search by make/model/VIN/lot/location"),
    t("08.03", "Filters: year/fuel/damage/status/location/auction"),
    t("08.04", "Sorting and pagination"),
    t("08.05", "Saved searches/watchlist"),
    t("08.06", "SEO metadata / canonical / sitemap", "ops"),
    t("08.07", "Responsive mobile/tablet/desktop", "test"),
    t("08.08", "Accessibility keyboard/focus/labels", "test"),
    t("08.09", "No private seller/buyer data leaks", "security"),
  ]),

  p("09", "Auction configuration и rules", [
    t("09.01", "Auction state machine"),
    t("09.02", "No Reserve auction"),
    t("09.03", "Reserve auction"),
    t("09.04", "Seller Approval auction"),
    t("09.05", "Buy Now path"),
    t("09.06", "Versioned auction-rule sets"),
    t("09.07", "Versioned bid increments"),
    t("09.08", "UTC schedule + localized display", "international"),
    t("09.09", "Immutable auction-start snapshot"),
    t("09.10", "Cancel-before-sale rules + participant notification", "legal"),
  ]),

  p("10", "Pre-Bid, Max Bid и proxy bidding", [
    t("10.01", "Atomic bid acceptance transaction"),
    t("10.02", "Eligibility checked inside bid path", "security"),
    t("10.03", "Bidding-power checked inside bid path", "money"),
    t("10.04", "Private Max Bid storage"),
    t("10.05", "Proxy bidding algorithm"),
    t("10.06", "Deterministic equal-max tie priority"),
    t("10.07", "Increment boundary validation"),
    t("10.08", "Idempotent duplicate request protection", "test"),
    t("10.09", "Private max never emitted to other users", "security"),
    t("10.10", "Concurrency/property tests for proxy bidding", "test"),
  ]),

  p("11", "Live realtime auction", [
    t("11.01", "Persistent realtime/WebSocket service"),
    t("11.02", "Authenticated room subscriptions", "security"),
    t("11.03", "Server-authoritative auction state"),
    t("11.04", "Server-authoritative timer"),
    t("11.05", "Realtime bid accepted/price/leader events"),
    t("11.06", "Sequence numbers/event ordering"),
    t("11.07", "Reconnect with authoritative refetch"),
    t("11.08", "Sequence-gap detection and recovery"),
    t("11.09", "Redis pub/sub is derived, not financial truth"),
    t("11.10", "Late-bid anti-sniping extension"),
    t("11.11", "Browser clock manipulation cannot alter close", "test"),
    t("11.12", "Multi-tab/device live consistency", "test"),
  ]),

  p("12", "Auction close и winner", [
    t("12.01", "Exactly-once logical close worker"),
    t("12.02", "Distributed close lock / idempotency"),
    t("12.03", "Deterministic winner"),
    t("12.04", "Reserve met/not-met result"),
    t("12.05", "Pending seller approval result"),
    t("12.06", "Buy Now finalization"),
    t("12.07", "Immutable result record"),
    t("12.08", "No silent admin winner edit", "security"),
    t("12.09", "Exceptional void/reversal requires reason + audit", "legal"),
    t("12.10", "Restart during close does not create duplicate result", "test"),
  ]),

  p("13", "Deposits, ledger и bidding power", [
    t("13.01", "Double-entry ledger", "money"),
    t("13.02", "Immutable journal/postings", "money"),
    t("13.03", "Balanced-entry database validation", "test"),
    t("13.04", "Deposit pending/received/held/released states", "money"),
    t("13.05", "Deposit != vehicle payment enforced", "money"),
    t("13.06", "Bidding-power rules", "money"),
    t("13.07", "Open/won exposure projection", "money"),
    t("13.08", "Manual finance adjustment requires permission + reason", "security"),
    t("13.09", "Ledger reconciliation tests", "test"),
  ]),

  p("14", "Fees, taxes и invoices", [
    t("14.01", "Versioned fee schedules", "money"),
    t("14.02", "Buyer/platform/document/storage fee rules", "money"),
    t("14.03", "Tax/VAT profile hooks per market", "international"),
    t("14.04", "Fee preview before commitment", "legal"),
    t("14.05", "Invoice immutable snapshot", "money"),
    t("14.06", "Invoice line-item reproducibility", "test"),
    t("14.07", "PDF/HTML invoice output", "money"),
    t("14.08", "Historical invoice unaffected by new fee version", "test"),
  ]),

  p("15", "Payments, reconciliation и refunds", [
    t("15.01", "PaymentProvider abstraction", "money"),
    t("15.02", "Bank-transfer first-class flow", "money"),
    t("15.03", "Card/tokenized payment flow when enabled", "money"),
    t("15.04", "Raw card data never stored", "security"),
    t("15.05", "Signed/verified payment webhooks", "security"),
    t("15.06", "Webhook idempotency/replay protection", "test"),
    t("15.07", "Payment reconciliation queue", "ops"),
    t("15.08", "Refund workflow", "money"),
    t("15.09", "Chargeback/dispute hook", "ops"),
    t("15.10", "Wrong currency/amount rejected", "test"),
  ]),

  p("16", "Seller settlement", [
    t("16.01", "Seller payable calculation", "money"),
    t("16.02", "Platform-fee deductions", "money"),
    t("16.03", "Settlement hold conditions", "money"),
    t("16.04", "Settlement approval / dual control", "security"),
    t("16.05", "Settlement reconciliation", "test"),
    t("16.06", "Settlement statement for seller", "money"),
  ]),

  p("17", "Release, pickup и title/documents", [
    t("17.01", "Release gate: payment cleared"),
    t("17.02", "Release gate: compliance cleared"),
    t("17.03", "Release gate: documents ready"),
    t("17.04", "Single-use pickup authorization"),
    t("17.05", "Pickup identity/evidence event", "security"),
    t("17.06", "Pickup completed audit"),
    t("17.07", "Document handover status"),
    t("17.08", "Unpaid/held vehicle cannot release", "test"),
  ]),

  p("18", "Logistics, storage, import/export", [
    t("18.01", "LogisticsProvider abstraction", "international"),
    t("18.02", "Transport quote/request/order"),
    t("18.03", "Carrier tracking events"),
    t("18.04", "Storage deadline and fee rules", "money"),
    t("18.05", "International shipping/import disclosure", "legal"),
    t("18.06", "Export-control hooks", "international"),
    t("18.07", "Country-specific documents checklist", "international"),
  ]),

  p("19", "Notifications и communications", [
    t("19.01", "Transactional email provider"),
    t("19.02", "SMS provider for critical events"),
    t("19.03", "Outbid/win/payment/pickup notifications"),
    t("19.04", "Notification preferences"),
    t("19.05", "Retry/dead-letter handling"),
    t("19.06", "No secret/private max in notifications", "security"),
    t("19.07", "Localized notification templates", "international"),
  ]),

  p("20", "Admin и operations", [
    t("20.01", "Admin dashboard"),
    t("20.02", "User/org search and controls"),
    t("20.03", "Verification queues"),
    t("20.04", "Vehicle moderation queue"),
    t("20.05", "Live auction monitor"),
    t("20.06", "Finance/payment queues", "money"),
    t("20.07", "Release/logistics queues"),
    t("20.08", "Privileged action step-up/dual control", "security"),
    t("20.09", "Before/after/reason audit for admin changes", "security"),
  ]),

  p("21", "Support, complaints и disputes", [
    t("21.01", "Support tickets linked to transaction"),
    t("21.02", "Complaint workflow"),
    t("21.03", "Dispute workflow"),
    t("21.04", "Evidence freeze"),
    t("21.05", "Full transaction reconstruction"),
    t("21.06", "Refund/void escalation permissions", "security"),
    t("21.07", "Response deadlines configurable by market", "international"),
  ]),

  p("22", "Legal, privacy и marketplace trust", [
    t("22.01", "Terms of Use versioning", "legal"),
    t("22.02", "Buyer/Auction Rules", "legal"),
    t("22.03", "Seller Terms", "legal"),
    t("22.04", "Vehicle Condition policy", "legal"),
    t("22.05", "Fees & Payments policy", "legal"),
    t("22.06", "Shipping/Import policy", "legal"),
    t("22.07", "Privacy notice/data map", "legal"),
    t("22.08", "Cookie consent/preferences", "legal"),
    t("22.09", "KYC/Identity notice", "legal"),
    t("22.10", "Acceptable Use", "legal"),
    t("22.11", "Complaints/Disputes policy", "legal"),
    t("22.12", "Marketplace transparency / seller role", "legal"),
    t("22.13", "Sanctions/Export Control notice", "legal"),
    t("22.14", "AI Transparency", "legal"),
    t("22.15", "Legal text ↔ system behavior matrix", "test"),
    t("22.16", "Country legal approval gate", "international"),
  ]),

  p("23", "Security hardening", [
    t("23.01", "Threat model" , "security"),
    t("23.02", "Least-privilege service credentials", "security"),
    t("23.03", "Rate limiting", "security"),
    t("23.04", "WAF/DDoS/bot controls", "security"),
    t("23.05", "Secure headers/CSP", "security"),
    t("23.06", "CSRF protection where applicable", "security"),
    t("23.07", "Input validation / output encoding", "security"),
    t("23.08", "Upload MIME/size/malware protections", "security"),
    t("23.09", "Dependency/security scanning", "security"),
    t("23.10", "Admin/security audit alerts", "security"),
    t("23.11", "External penetration test", "security"),
    t("23.12", "Critical/high pentest findings resolved", "test"),
  ]),

  p("24", "Fraud и risk", [
    t("24.01", "Risk-event model"),
    t("24.02", "Velocity/device/IP anomaly hooks"),
    t("24.03", "Bid abuse/collusion signal hooks"),
    t("24.04", "Payment-risk signal hooks", "money"),
    t("24.05", "Manual risk review queue", "ops"),
    t("24.06", "No opaque AI auto-ban in critical path", "ai"),
    t("24.07", "False-positive review and override audit", "test"),
  ]),

  p("25", "Observability и SRE", [
    t("25.01", "Structured logs"),
    t("25.02", "Metrics: bids/latency/errors/connections"),
    t("25.03", "Distributed traces for critical flows"),
    t("25.04", "Auction-close failure alert"),
    t("25.05", "Payment/reconciliation failure alert"),
    t("25.06", "Queue/backlog alert"),
    t("25.07", "DB/Redis/realtime health dashboards"),
    t("25.08", "SLO/SLI targets"),
    t("25.09", "Incident runbook/on-call path", "ops"),
  ]),

  p("26", "Backup, recovery и continuity", [
    t("26.01", "Automated database backups"),
    t("26.02", "Point-in-time recovery policy"),
    t("26.03", "Object/document backup policy"),
    t("26.04", "Restore drill"),
    t("26.05", "RPO/RTO documented"),
    t("26.06", "Realtime service restart recovery"),
    t("26.07", "Auction recovery after worker/process failure", "test"),
    t("26.08", "Disaster recovery runbook tested", "test"),
  ]),

  p("27", "Performance, load и concurrency", [
    t("27.01", "Baseline latency budgets"),
    t("27.02", "10 concurrent bidders test", "test"),
    t("27.03", "50 concurrent bidders test", "test"),
    t("27.04", "100 concurrent bidders test", "test"),
    t("27.05", "500+ bidder stress test", "test"),
    t("27.06", "Database row-lock/contention test", "test"),
    t("27.07", "WebSocket fanout stress test", "test"),
    t("27.08", "Reconnect storm test", "test"),
    t("27.09", "No bid/winner corruption under load", "test"),
    t("27.10", "Capacity limit documented before launch", "ops"),
  ]),

  p("28", "Automated QA и test matrix", [
    t("28.01", "Unit tests for domain rules", "test"),
    t("28.02", "Database integration tests", "test"),
    t("28.03", "API integration tests", "test"),
    t("28.04", "Browser E2E tests", "test"),
    t("28.05", "Auction race-condition suite", "test"),
    t("28.06", "Payment webhook replay suite", "test"),
    t("28.07", "RBAC/IDOR abuse suite", "test"),
    t("28.08", "Release-gate suite", "test"),
    t("28.09", "Regression suite required before deploy", "test"),
    t("28.10", "Production smoke tests after deploy", "test"),
  ]),

  p("29", "Internationalization и Country Profiles", [
    t("29.01", "i18n architecture" , "international"),
    t("29.02", "BG locale" , "international"),
    t("29.03", "EN locale" , "international"),
    t("29.04", "Locale-safe numbers/dates/currency", "international"),
    t("29.05", "CountryProfile schema", "international"),
    t("29.06", "Per-country seller/consumer profile", "international"),
    t("29.07", "Per-country payment/KYC adapters", "international"),
    t("29.08", "Per-country legal docs/acceptance", "international"),
    t("29.09", "Per-country tax/fee display", "international"),
    t("29.10", "Per-country launch gate defaults OFF", "international"),
    t("29.11", "No Bulgarian-only hardcoding", "test"),
  ]),

  p("30", "Provider adapters и vendor independence", [
    t("30.01", "PaymentProvider interface"),
    t("30.02", "KycProvider interface"),
    t("30.03", "LogisticsProvider interface"),
    t("30.04", "VIN/history provider interface"),
    t("30.05", "Email/SMS provider interface"),
    t("30.06", "AI provider interface", "ai"),
    t("30.07", "Provider timeout/retry/circuit-breaker strategy"),
    t("30.08", "Provider outage fallback/runbook", "ops"),
  ]),

  p("31", "AI — non-authoritative", [
    t("31.01", "AI natural-language search → safe filters", "ai"),
    t("31.02", "AI support assistant", "ai"),
    t("31.03", "AI seller listing assistant", "ai"),
    t("31.04", "AI translation assistance", "ai"),
    t("31.05", "Grounded vehicle summary + provenance", "ai"),
    t("31.06", "Visual damage assistant with human review", "ai"),
    t("31.07", "AI cannot accept bid/choose winner/move money/release", "security"),
    t("31.08", "AI transparency labels where applicable", "legal"),
  ]),

  p("32", "Analytics, reporting, SEO и accessibility", [
    t("32.01", "Business event taxonomy"),
    t("32.02", "Auction conversion reporting"),
    t("32.03", "Seller performance reporting"),
    t("32.04", "Finance/revenue reporting", "money"),
    t("32.05", "Audit-compatible analytics boundaries", "legal"),
    t("32.06", "SEO technical baseline"),
    t("32.07", "Accessibility audit", "test"),
    t("32.08", "Performance/Core Web Vitals baseline", "test"),
  ]),

  p("33", "PWA, mobile и UX resilience", [
    t("33.01", "Installable PWA shell"),
    t("33.02", "Mobile live auction UX"),
    t("33.03", "Connection-state indicator"),
    t("33.04", "Offline-safe read-only/error behavior"),
    t("33.05", "Large bid confirmation / accidental-click protection"),
    t("33.06", "No stale UI presented as authoritative", "test"),
    t("33.07", "Native apps only after separate business case", "ops"),
  ]),

  p("34", "Closed pilot", [
    t("34.01", "Verified test seller"),
    t("34.02", "Realistic vehicle + 10+ photos + documents"),
    t("34.03", "Two+ verified test buyers"),
    t("34.04", "Deposit/bidding power test"),
    t("34.05", "Pre-Bid + Max Bid test"),
    t("34.06", "Live bid + late extension test"),
    t("34.07", "Correct winner test"),
    t("34.08", "Invoice/payment/release test"),
    t("34.09", "Restart/reconnect during transaction test", "test"),
    t("34.10", "Complaint reconstruction test", "test"),
    t("34.11", "No critical blockers pilot sign-off", "test"),
  ]),

  p("35", "First-market production launch", [
    t("35.01", "Legal entity/company details final", "legal"),
    t("35.02", "Production KYC/KYB enabled"),
    t("35.03", "Production payments/bank reconciliation enabled", "money"),
    t("35.04", "Production email/SMS enabled"),
    t("35.05", "Final fee schedule", "money"),
    t("35.06", "External legal review / market sign-off", "legal"),
    t("35.07", "External security review/pentest sign-off", "security"),
    t("35.08", "Backup restore proven", "test"),
    t("35.09", "Controlled real inventory"),
    t("35.10", "Controlled real buyer cohort"),
    t("35.11", "First real auction"),
    t("35.12", "First real complete transaction + audit", "test"),
  ]),

  p("36", "International expansion", [
    t("36.01", "Country #2 CountryProfile", "international"),
    t("36.02", "Country #2 legal approval", "international"),
    t("36.03", "Country #2 KYC/payment compatibility", "international"),
    t("36.04", "Country #2 localization", "international"),
    t("36.05", "Country #2 controlled pilot", "test"),
    t("36.06", "No core rewrite required", "test"),
    t("36.07", "Additional market repeatable launch playbook", "international"),
    t("36.08", "Single authoritative write region per hot lot unless proven otherwise", "security"),
  ]),

  p("37", "Business cash, support и client operations", [
    t("37.01", "Development cash ledger separate from marketplace money", "money"),
    t("37.02", "Project reserve tracked", "money"),
    t("37.03", "Tax/accounting/warranty reserve tracked", "money"),
    t("37.04", "Client operational provider costs separate", "money"),
    t("37.05", "Buyer deposits separate from development fee", "money"),
    t("37.06", "Vehicle payments separate from deposits", "money"),
    t("37.07", "Support plan after launch", "ops"),
    t("37.08", "Monthly infrastructure cost dashboard", "money"),
    t("37.09", "Client update: Done / Now / Next / Blocker / Money", "ops"),
  ]),

  p("38", "Mature international platform", [
    t("38.01", "Multi-region read strategy"),
    t("38.02", "Regional CDN/cache tuning"),
    t("38.03", "Horizontal realtime scaling"),
    t("38.04", "Advanced fraud/risk graph"),
    t("38.05", "B2B/dealer API"),
    t("38.06", "White-label/multi-tenant only after tenant isolation tests", "security"),
    t("38.07", "Advanced seller settlement automation", "money"),
    t("38.08", "Native apps if justified"),
    t("38.09", "Operational SLA/SLO and 24/7 model when justified", "ops"),
    t("38.10", "Continuous security/legal/provider review", "international"),
  ]),
];

const STORE_KEY = "enchev-master-control-v2";
const GAPS_KEY = "enchev-master-gaps-v1";

const statusText: Record<Status, string> = { green: "РАБОТИ", yellow: "ТЕСТ / ГРЕШКА", red: "ЛИПСВА" };
const kindText: Record<Kind, string> = { build: "FUNCTION", test: "TEST", security: "SECURITY", legal: "LEGAL", money: "MONEY", ops: "OPS", international: "GLOBAL", ai: "AI" };

export default function MasterControlCenter() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Record<string, SavedTask>>({});
  const [gaps, setGaps] = useState<CustomGap[]>([]);
  const [filter, setFilter] = useState<"all" | Status | "next">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "01": true });
  const [gapText, setGapText] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
      setGaps(JSON.parse(localStorage.getItem(GAPS_KEY) || "[]"));
    } catch {}
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY && e.newValue) setSaved(JSON.parse(e.newValue));
      if (e.key === GAPS_KEY && e.newValue) setGaps(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("enchev-control") : null;
    channel?.addEventListener("message", (e) => {
      if (e.data?.saved) setSaved(e.data.saved);
      if (e.data?.gaps) setGaps(e.data.gaps);
    });
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); channel?.close(); };
  }, []);

  const persist = (next: Record<string, SavedTask>) => {
    setSaved(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    if (typeof BroadcastChannel !== "undefined") { const c = new BroadcastChannel("enchev-control"); c.postMessage({ saved: next }); c.close(); }
  };
  const persistGaps = (next: CustomGap[]) => {
    setGaps(next);
    localStorage.setItem(GAPS_KEY, JSON.stringify(next));
    if (typeof BroadcastChannel !== "undefined") { const c = new BroadcastChannel("enchev-control"); c.postMessage({ gaps: next }); c.close(); }
  };

  const getStatus = (task: TaskDef): Status => saved[task.id]?.status || task.defaultStatus;
  const setStatus = (task: TaskDef, status: Status) => persist({ ...saved, [task.id]: { ...saved[task.id], status, updatedAt: new Date().toISOString() } });
  const setField = (task: TaskDef, field: "note" | "evidence", value: string) => persist({ ...saved, [task.id]: { ...saved[task.id], [field]: value, updatedAt: new Date().toISOString() } });

  const allTasks = useMemo(() => phases.flatMap((phase) => phase.tasks.map((task) => ({ phase, task }))), []);
  const counts = useMemo(() => {
    const base = { green: 0, yellow: 0, red: 0 };
    allTasks.forEach(({ task }) => base[getStatus(task)]++);
    gaps.forEach((g) => base[g.status]++);
    return base;
  }, [saved, gaps, allTasks]);
  const total = counts.green + counts.yellow + counts.red;
  const progress = total ? Math.round((counts.green / total) * 100) : 0;
  const nextTechnical = allTasks.find(({ phase, task }) => phase.id !== "00" && getStatus(task) !== G);
  const nextClient = allTasks.find(({ phase, task }) => phase.id === "00" && getStatus(task) !== G);

  const visible = (task: TaskDef) => {
    const status = getStatus(task);
    if (filter === "next" && nextTechnical?.task.id !== task.id && nextClient?.task.id !== task.id) return false;
    if (filter !== "all" && filter !== "next" && status !== filter) return false;
    if (query && !`${task.id} ${task.label} ${task.kind}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  };

  const addGap = () => {
    const label = gapText.trim(); if (!label) return;
    const item: CustomGap = { id: `GAP-${Date.now()}`, label, status: R, note: "", createdAt: new Date().toISOString() };
    persistGaps([item, ...gaps]); setGapText("");
  };

  return <>
    <button className="burgerButton" onClick={() => setMenuOpen(true)} aria-label="Отвори меню"><span/><span/><span/></button>
    {menuOpen && <div className="menuShade" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidePanel ${menuOpen ? "sideOpen" : ""}`}>
      <div className="sidePanelTop"><div><div className="miniLabel">ENCHEV AUCTIONS</div><strong>Command Center</strong></div><button className="iconButton" onClick={() => setMenuOpen(false)}>×</button></div>
      <button className="sideMenuItem" onClick={() => { setOpen(true); setMenuOpen(false); }}><span className="sideMenuIcon">◫</span><span><b>Етапи</b><small>Единствен master plan 0 → 100%</small></span><span>›</span></button>
      <div className="sideStatusBox"><div className="liveLine"><i/> LOCAL REALTIME</div><span>Общ прогрес</span><b>{progress}%</b><div className="miniProgress"><i style={{width:`${progress}%`}}/></div><small>{counts.green} работят · {counts.yellow} тест/грешка · {counts.red} липсват</small></div>
    </aside>

    {open && <div className="controlOverlay">
      <header className="controlHeader">
        <div><div className="eyebrow">ENCHEV AUCTIONS · MASTER CONTROL</div><h1>0 → 100% International Production</h1><p>Един source of truth за функции, тестове, грешки, пропуски, пари, legal, security, providers, държави и launch.</p></div>
        <button className="closeControl" onClick={() => setOpen(false)}>×</button>
      </header>

      <section className="controlKpis">
        <div><span>PROGRESS</span><b>{progress}%</b></div><div className="kGreen"><span>РАБОТИ</span><b>{counts.green}</b></div><div className="kYellow"><span>ТЕСТ / ГРЕШКА</span><b>{counts.yellow}</b></div><div className="kRed"><span>ЛИПСВА</span><b>{counts.red}</b></div><div><span>LIVE HEARTBEAT</span><b className="clockText">{now.toLocaleTimeString("bg-BG")}</b><small>Cloud realtime идва със Supabase</small></div>
      </section>

      <section className="nextGrid">
        <div className="nextCard"><span>СЛЕДВАЩА ТЕХНИЧЕСКА СТЪПКА</span><b>{nextTechnical ? `${nextTechnical.task.id} · ${nextTechnical.task.label}` : "Всичко техническо е зелено"}</b></div>
        <div className="nextCard client"><span>CLIENT / BUSINESS BLOCKER</span><b>{nextClient ? `${nextClient.task.id} · ${nextClient.task.label}` : "Няма client blocker"}</b></div>
      </section>

      <section className="controlTools">
        <div className="filterGroup">
          {(["all","next","green","yellow","red"] as const).map((f) => <button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f==="all"?"Всичко":f==="next"?"Next":f==="green"?"Зелено":f==="yellow"?"Жълто":"Червено"}</button>)}
        </div>
        <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Търси функция, тест, ID..." />
      </section>

      <section className="gapBox">
        <div><b>Открит нов пропуск?</b><small>Добавяме го веднага. Планът не може да прикрива неизвестни рискове.</small></div>
        <div className="gapInput"><input value={gapText} onChange={(e)=>setGapText(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")addGap();}} placeholder="Напр. PSP timeout fallback липсва..."/><button onClick={addGap}>+ Добави пропуск</button></div>
      </section>

      {gaps.length > 0 && <section className="phaseBlock gapPhase"><button className="phaseHead" onClick={()=>setExpanded({...expanded,GAPS:!expanded.GAPS})}><div><span>GAPS</span><b>Нови открити пропуски</b></div><strong>{gaps.length}</strong></button>{expanded.GAPS && <div>{gaps.map((g)=><div className="taskRow" key={g.id}><div className="taskMain"><span className="taskId">{g.id}</span><b>{g.label}</b></div><div className="statusButtons">{([G,Y,R] as Status[]).map(s=><button key={s} className={g.status===s?s:""} onClick={()=>persistGaps(gaps.map(x=>x.id===g.id?{...x,status:s}:x))}>{statusText[s]}</button>)}</div><button className="removeGap" onClick={()=>persistGaps(gaps.filter(x=>x.id!==g.id))}>×</button></div>)}</div>}</section>}

      <main className="phaseList">
        {phases.map((phase) => {
          const shown = phase.tasks.filter(visible); if (!shown.length) return null;
          const phaseCounts = { green: 0, yellow: 0, red: 0 }; phase.tasks.forEach(x=>phaseCounts[getStatus(x)]++);
          const isOpen = expanded[phase.id] ?? (shown.length <= 8);
          return <section className="phaseBlock" key={phase.id}>
            <button className="phaseHead" onClick={()=>setExpanded({...expanded,[phase.id]:!isOpen})}>
              <div><span>PHASE {phase.id}</span><b>{phase.title}</b></div><div className="phaseCounts"><i className="greenDot">{phaseCounts.green}</i><i className="yellowDot">{phaseCounts.yellow}</i><i className="redDot">{phaseCounts.red}</i><strong>{isOpen?"−":"+"}</strong></div>
            </button>
            {isOpen && <div className="phaseTasks">{shown.map(task => {
              const s=getStatus(task); const info=saved[task.id]||{};
              return <article className={`taskCard task-${s}`} key={task.id}>
                <div className="taskTop"><div className="taskMain"><span className="taskId">{task.id}</span><span className={`kind kind-${task.kind}`}>{kindText[task.kind]}</span><b>{task.label}</b>{task.gate&&<small>Gate: {task.gate}</small>}</div><div className="statusButtons">{([G,Y,R] as Status[]).map(x=><button key={x} className={s===x?x:""} onClick={()=>setStatus(task,x)}>{statusText[x]}</button>)}</div></div>
                <div className="taskDetails"><input value={info.evidence||""} onChange={(e)=>setField(task,"evidence",e.target.value)} placeholder="Evidence: URL / test / commit / резултат..."/><input value={info.note||""} onChange={(e)=>setField(task,"note",e.target.value)} placeholder="Бележка / грешка / blocker / какво остава..."/><span>{info.updatedAt?`Updated ${new Date(info.updatedAt).toLocaleString("bg-BG")}`:"Няма update"}</span></div>
              </article>})}</div>}
          </section>;
        })}
      </main>

      <footer className="controlFooter"><b>Правило:</b> GREEN = има функция + тест + доказателство. Код без тест не е GREEN. След Supabase този board става cloud realtime и ще е еднакъв на всички устройства.</footer>
    </div>}
  </>;
}

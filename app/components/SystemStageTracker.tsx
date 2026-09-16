"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "green" | "yellow" | "red";
type Kind = "core" | "test" | "security" | "legal" | "global" | "ai";
type Task = { id: string; label: string; defaultStatus: Status; kind?: Kind };
type Phase = { id: string; title: string; tasks: Task[] };
type NoteMap = Record<string, { evidence?: string; blocker?: string; updatedAt?: string }>;

const phases: Phase[] = [
  { id: "01", title: "Clean foundation", tasks: [
    { id: "01.01", label: "Private GitHub repo enchev-auctions", defaultStatus: "green" },
    { id: "01.02", label: "Clean Next.js + TypeScript base", defaultStatus: "green" },
    { id: "01.03", label: "Vercel project enchev-auctions", defaultStatus: "green" },
    { id: "01.04", label: "GitHub → Vercel automatic deploy", defaultStatus: "green" },
    { id: "01.05", label: "Supabase project", defaultStatus: "red" },
    { id: "01.06", label: "Redis environment", defaultStatus: "red" },
    { id: "01.07", label: "Environment separation: local / staging / production", defaultStatus: "red" },
    { id: "01.08", label: "Environment variable validation", defaultStatus: "red" },
    { id: "01.09", label: "CI: lint / typecheck / test / build", defaultStatus: "red", kind: "test" },
    { id: "01.10", label: "Web / API / realtime / worker health endpoints", defaultStatus: "red", kind: "test" },
  ]},
  { id: "02", title: "Architecture & repository structure", tasks: [
    { id: "02.01", label: "apps/web", defaultStatus: "red" },
    { id: "02.02", label: "apps/api", defaultStatus: "red" },
    { id: "02.03", label: "apps/realtime", defaultStatus: "red" },
    { id: "02.04", label: "apps/worker", defaultStatus: "red" },
    { id: "02.05", label: "packages/domain", defaultStatus: "red" },
    { id: "02.06", label: "packages/contracts", defaultStatus: "red" },
    { id: "02.07", label: "packages/config", defaultStatus: "red" },
    { id: "02.08", label: "packages/providers", defaultStatus: "red" },
    { id: "02.09", label: "Database migrations structure", defaultStatus: "red" },
    { id: "02.10", label: "Architecture decision records", defaultStatus: "red" },
  ]},
  { id: "03", title: "Database & data integrity", tasks: [
    { id: "03.01", label: "PostgreSQL schema baseline", defaultStatus: "red" },
    { id: "03.02", label: "Migration runner", defaultStatus: "red" },
    { id: "03.03", label: "Seed data for staging", defaultStatus: "red" },
    { id: "03.04", label: "UUID identifiers", defaultStatus: "red" },
    { id: "03.05", label: "UTC timestamps everywhere", defaultStatus: "red", kind: "global" },
    { id: "03.06", label: "Archival rules where required", defaultStatus: "red" },
    { id: "03.07", label: "Immutable event history for critical actions", defaultStatus: "red" },
    { id: "03.08", label: "Idempotency keys for critical writes", defaultStatus: "red" },
    { id: "03.09", label: "Transactional outbox", defaultStatus: "red" },
    { id: "03.10", label: "Migration rollback / recovery procedure", defaultStatus: "red", kind: "test" },
  ]},
  { id: "04", title: "Identity & access", tasks: [
    { id: "04.01", label: "Supabase Auth", defaultStatus: "red" },
    { id: "04.02", label: "Register / login / logout / recovery", defaultStatus: "red" },
    { id: "04.03", label: "Buyer / Seller / Support / Admin roles", defaultStatus: "red" },
    { id: "04.04", label: "RBAC permission matrix", defaultStatus: "red", kind: "security" },
    { id: "04.05", label: "Admin MFA", defaultStatus: "red", kind: "security" },
    { id: "04.06", label: "Session revocation", defaultStatus: "red", kind: "security" },
    { id: "04.07", label: "Account status: active / restricted / suspended", defaultStatus: "red" },
    { id: "04.08", label: "Audit trail for privileged actions", defaultStatus: "red", kind: "security" },
    { id: "04.09", label: "Cross-account access tests", defaultStatus: "red", kind: "test" },
  ]},
  { id: "05", title: "KYC / KYB / eligibility", tasks: [
    { id: "05.01", label: "KYC provider abstraction", defaultStatus: "red" },
    { id: "05.02", label: "KYB provider abstraction", defaultStatus: "red" },
    { id: "05.03", label: "Verification states", defaultStatus: "red" },
    { id: "05.04", label: "Manual review queue", defaultStatus: "red" },
    { id: "05.05", label: "Buyer eligibility engine", defaultStatus: "red" },
    { id: "05.06", label: "Seller verification workflow", defaultStatus: "red" },
    { id: "05.07", label: "Compliance holds", defaultStatus: "red" },
    { id: "05.08", label: "Verification audit history", defaultStatus: "red" },
    { id: "05.09", label: "Blocked-user enforcement tests", defaultStatus: "red", kind: "test" },
  ]},
  { id: "06", title: "Vehicle inventory", tasks: [
    { id: "06.01", label: "Vehicle CRUD", defaultStatus: "red" },
    { id: "06.02", label: "VIN / make / model / trim / year", defaultStatus: "red" },
    { id: "06.03", label: "Engine / fuel / transmission / drivetrain", defaultStatus: "red" },
    { id: "06.04", label: "Odometer model", defaultStatus: "red" },
    { id: "06.05", label: "Condition / damage / run status", defaultStatus: "red" },
    { id: "06.06", label: "Title/document status", defaultStatus: "red" },
    { id: "06.07", label: "Country / region / city / yard location", defaultStatus: "red", kind: "global" },
    { id: "06.08", label: "Secure image uploads", defaultStatus: "red", kind: "security" },
    { id: "06.09", label: "Secure document uploads", defaultStatus: "red", kind: "security" },
    { id: "06.10", label: "Data provenance labels", defaultStatus: "red" },
    { id: "06.11", label: "Vehicle version history", defaultStatus: "red" },
    { id: "06.12", label: "Seller submit → Admin review → Publish", defaultStatus: "red" },
    { id: "06.13", label: "Vehicle validation tests", defaultStatus: "red", kind: "test" },
  ]},
  { id: "07", title: "Public marketplace & discovery", tasks: [
    { id: "07.01", label: "Homepage", defaultStatus: "red" },
    { id: "07.02", label: "Vehicle listing grid", defaultStatus: "red" },
    { id: "07.03", label: "Vehicle detail page", defaultStatus: "red" },
    { id: "07.04", label: "Search by make / model / VIN / lot", defaultStatus: "red" },
    { id: "07.05", label: "Filters", defaultStatus: "red" },
    { id: "07.06", label: "Sorting", defaultStatus: "red" },
    { id: "07.07", label: "Pagination / infinite loading strategy", defaultStatus: "red" },
    { id: "07.08", label: "Upcoming / live / ended auction views", defaultStatus: "red" },
    { id: "07.09", label: "Responsive mobile UX", defaultStatus: "red" },
    { id: "07.10", label: "SEO metadata / sitemap / canonical URLs", defaultStatus: "red" },
    { id: "07.11", label: "Accessibility baseline", defaultStatus: "red", kind: "test" },
  ]},
  { id: "08", title: "Auction configuration", tasks: [
    { id: "08.01", label: "Auction state machine", defaultStatus: "red" },
    { id: "08.02", label: "No-reserve auction", defaultStatus: "red" },
    { id: "08.03", label: "Reserve auction", defaultStatus: "red" },
    { id: "08.04", label: "Seller-approval result path", defaultStatus: "red" },
    { id: "08.05", label: "Buy-now mode", defaultStatus: "red" },
    { id: "08.06", label: "Versioned auction rules", defaultStatus: "red" },
    { id: "08.07", label: "Bid increment table", defaultStatus: "red" },
    { id: "08.08", label: "Pre-bid start / live start / end timestamps", defaultStatus: "red" },
    { id: "08.09", label: "Auction-start immutable vehicle snapshot", defaultStatus: "red" },
    { id: "08.10", label: "Auction publish validation", defaultStatus: "red", kind: "test" },
  ]},
  { id: "09", title: "Pre-Bid & Max Bid engine", tasks: [
    { id: "09.01", label: "Atomic Pre-Bid transaction", defaultStatus: "red" },
    { id: "09.02", label: "Private Max Bid storage", defaultStatus: "red", kind: "security" },
    { id: "09.03", label: "Proxy bidding algorithm", defaultStatus: "red" },
    { id: "09.04", label: "Deterministic equal-max priority", defaultStatus: "red" },
    { id: "09.05", label: "Increment boundary validation", defaultStatus: "red" },
    { id: "09.06", label: "Eligibility enforcement before bid acceptance", defaultStatus: "red" },
    { id: "09.07", label: "Duplicate-request protection", defaultStatus: "red" },
    { id: "09.08", label: "Private max never exposed to other clients", defaultStatus: "red", kind: "test" },
    { id: "09.09", label: "Proxy-bid scenario test matrix", defaultStatus: "red", kind: "test" },
  ]},
  { id: "10", title: "Live realtime auction", tasks: [
    { id: "10.01", label: "Persistent WebSocket service", defaultStatus: "red" },
    { id: "10.02", label: "Authenticated WebSocket handshake", defaultStatus: "red", kind: "security" },
    { id: "10.03", label: "Auction rooms", defaultStatus: "red" },
    { id: "10.04", label: "Realtime bid events", defaultStatus: "red" },
    { id: "10.05", label: "Current leader event", defaultStatus: "red" },
    { id: "10.06", label: "Outbid event", defaultStatus: "red" },
    { id: "10.07", label: "Server-authoritative timer", defaultStatus: "red" },
    { id: "10.08", label: "Late-bid extension", defaultStatus: "red" },
    { id: "10.09", label: "Reconnect after network drop", defaultStatus: "red" },
    { id: "10.10", label: "Sequence-gap detection", defaultStatus: "red" },
    { id: "10.11", label: "Authoritative state refetch", defaultStatus: "red" },
    { id: "10.12", label: "Browser-clock manipulation test", defaultStatus: "red", kind: "test" },
    { id: "10.13", label: "Two-browser live synchronization test", defaultStatus: "red", kind: "test" },
  ]},
  { id: "11", title: "Auction finalization & winner", tasks: [
    { id: "11.01", label: "Exactly-once logical close", defaultStatus: "red" },
    { id: "11.02", label: "Close worker", defaultStatus: "red" },
    { id: "11.03", label: "Distributed lock / single authoritative finalizer", defaultStatus: "red" },
    { id: "11.04", label: "Deterministic winner selection", defaultStatus: "red" },
    { id: "11.05", label: "Reserve result", defaultStatus: "red" },
    { id: "11.06", label: "Seller-approval pending result", defaultStatus: "red" },
    { id: "11.07", label: "Unsold result", defaultStatus: "red" },
    { id: "11.08", label: "Immutable final result event", defaultStatus: "red" },
    { id: "11.09", label: "Exceptional void/reversal with reason + audit", defaultStatus: "red" },
    { id: "11.10", label: "Restart during close test", defaultStatus: "red", kind: "test" },
    { id: "11.11", label: "Simultaneous final bids test", defaultStatus: "red", kind: "test" },
  ]},
  { id: "12", title: "Notifications & user state", tasks: [
    { id: "12.01", label: "Notification event model", defaultStatus: "red" },
    { id: "12.02", label: "Email provider abstraction", defaultStatus: "red" },
    { id: "12.03", label: "SMS provider abstraction", defaultStatus: "red" },
    { id: "12.04", label: "Outbid notification", defaultStatus: "red" },
    { id: "12.05", label: "Auction start notification", defaultStatus: "red" },
    { id: "12.06", label: "Auction result notification", defaultStatus: "red" },
    { id: "12.07", label: "Security alert notification", defaultStatus: "red", kind: "security" },
    { id: "12.08", label: "Notification preferences", defaultStatus: "red" },
    { id: "12.09", label: "Retry / dead-letter handling", defaultStatus: "red", kind: "test" },
  ]},
  { id: "13", title: "Release, pickup & logistics", tasks: [
    { id: "13.01", label: "Release state machine", defaultStatus: "red" },
    { id: "13.02", label: "Compliance/document release gates", defaultStatus: "red" },
    { id: "13.03", label: "Pickup authorization", defaultStatus: "red" },
    { id: "13.04", label: "Single-use pickup code", defaultStatus: "red", kind: "security" },
    { id: "13.05", label: "Pickup completed event", defaultStatus: "red" },
    { id: "13.06", label: "Transport provider abstraction", defaultStatus: "red" },
    { id: "13.07", label: "Transport request / quote flow", defaultStatus: "red" },
    { id: "13.08", label: "Shipment status events", defaultStatus: "red" },
    { id: "13.09", label: "Release abuse tests", defaultStatus: "red", kind: "test" },
  ]},
  { id: "14", title: "Admin & operations", tasks: [
    { id: "14.01", label: "Admin dashboard", defaultStatus: "red" },
    { id: "14.02", label: "User search / review", defaultStatus: "red" },
    { id: "14.03", label: "Verification queue", defaultStatus: "red" },
    { id: "14.04", label: "Vehicle review queue", defaultStatus: "red" },
    { id: "14.05", label: "Auction create/edit/publish controls", defaultStatus: "red" },
    { id: "14.06", label: "Live auction monitor", defaultStatus: "red" },
    { id: "14.07", label: "Release / logistics queue", defaultStatus: "red" },
    { id: "14.08", label: "Support tickets", defaultStatus: "red" },
    { id: "14.09", label: "Complaints / disputes", defaultStatus: "red" },
    { id: "14.10", label: "Evidence freeze", defaultStatus: "red" },
    { id: "14.11", label: "Feature flags", defaultStatus: "red" },
    { id: "14.12", label: "High-risk admin action confirmation", defaultStatus: "red", kind: "security" },
  ]},
  { id: "15", title: "Legal, privacy & transparency", tasks: [
    { id: "15.01", label: "Terms version registry", defaultStatus: "red", kind: "legal" },
    { id: "15.02", label: "Buyer auction rules", defaultStatus: "red", kind: "legal" },
    { id: "15.03", label: "Seller terms", defaultStatus: "red", kind: "legal" },
    { id: "15.04", label: "Vehicle condition policy", defaultStatus: "red", kind: "legal" },
    { id: "15.05", label: "Privacy notice", defaultStatus: "red", kind: "legal" },
    { id: "15.06", label: "Cookie consent / preferences", defaultStatus: "red", kind: "legal" },
    { id: "15.07", label: "KYC identity notice", defaultStatus: "red", kind: "legal" },
    { id: "15.08", label: "Marketplace transparency", defaultStatus: "red", kind: "legal" },
    { id: "15.09", label: "AI transparency", defaultStatus: "red", kind: "legal" },
    { id: "15.10", label: "Seller-of-record / platform-role display", defaultStatus: "red", kind: "legal" },
    { id: "15.11", label: "Country legal launch gate", defaultStatus: "red", kind: "global" },
    { id: "15.12", label: "Policy ↔ system behavior consistency tests", defaultStatus: "red", kind: "test" },
  ]},
  { id: "16", title: "Security hardening", tasks: [
    { id: "16.01", label: "Authorization abuse test suite", defaultStatus: "red", kind: "security" },
    { id: "16.02", label: "Rate limiting", defaultStatus: "red", kind: "security" },
    { id: "16.03", label: "Bot / scripted abuse controls", defaultStatus: "red", kind: "security" },
    { id: "16.04", label: "Secure headers", defaultStatus: "red", kind: "security" },
    { id: "16.05", label: "CSRF protection where applicable", defaultStatus: "red", kind: "security" },
    { id: "16.06", label: "Signed upload URLs", defaultStatus: "red", kind: "security" },
    { id: "16.07", label: "Upload MIME/type/size validation", defaultStatus: "red", kind: "security" },
    { id: "16.08", label: "Secrets management", defaultStatus: "red", kind: "security" },
    { id: "16.09", label: "Key rotation procedure", defaultStatus: "red", kind: "security" },
    { id: "16.10", label: "Least-privilege provider credentials", defaultStatus: "red", kind: "security" },
    { id: "16.11", label: "Dependency vulnerability scanning", defaultStatus: "red", kind: "security" },
    { id: "16.12", label: "External penetration test", defaultStatus: "red", kind: "security" },
  ]},
  { id: "17", title: "Observability & recovery", tasks: [
    { id: "17.01", label: "Structured application logs", defaultStatus: "red" },
    { id: "17.02", label: "Metrics", defaultStatus: "red" },
    { id: "17.03", label: "Distributed traces", defaultStatus: "red" },
    { id: "17.04", label: "Error tracking", defaultStatus: "red" },
    { id: "17.05", label: "Uptime monitoring", defaultStatus: "red" },
    { id: "17.06", label: "Realtime connection metrics", defaultStatus: "red" },
    { id: "17.07", label: "Bid latency metrics", defaultStatus: "red" },
    { id: "17.08", label: "Auction close failure alert", defaultStatus: "red" },
    { id: "17.09", label: "Worker failure alert", defaultStatus: "red" },
    { id: "17.10", label: "Database backups", defaultStatus: "red" },
    { id: "17.11", label: "Restore drill", defaultStatus: "red", kind: "test" },
    { id: "17.12", label: "Disaster recovery runbook", defaultStatus: "red" },
  ]},
  { id: "18", title: "Load, concurrency & chaos tests", tasks: [
    { id: "18.01", label: "10 concurrent bidders", defaultStatus: "red", kind: "test" },
    { id: "18.02", label: "50 concurrent bidders", defaultStatus: "red", kind: "test" },
    { id: "18.03", label: "100 concurrent bidders", defaultStatus: "red", kind: "test" },
    { id: "18.04", label: "500+ bidder stress test", defaultStatus: "red", kind: "test" },
    { id: "18.05", label: "Database contention test", defaultStatus: "red", kind: "test" },
    { id: "18.06", label: "WebSocket fanout test", defaultStatus: "red", kind: "test" },
    { id: "18.07", label: "Reconnect storm test", defaultStatus: "red", kind: "test" },
    { id: "18.08", label: "API duplicate-request storm", defaultStatus: "red", kind: "test" },
    { id: "18.09", label: "Realtime service restart during auction", defaultStatus: "red", kind: "test" },
    { id: "18.10", label: "Worker restart during auction close", defaultStatus: "red", kind: "test" },
    { id: "18.11", label: "Redis interruption recovery", defaultStatus: "red", kind: "test" },
    { id: "18.12", label: "No winner corruption under load", defaultStatus: "red", kind: "test" },
  ]},
  { id: "19", title: "Closed pilot", tasks: [
    { id: "19.01", label: "Create and verify seller", defaultStatus: "red", kind: "test" },
    { id: "19.02", label: "Create vehicle + photos + documents", defaultStatus: "red", kind: "test" },
    { id: "19.03", label: "Admin review + publish", defaultStatus: "red", kind: "test" },
    { id: "19.04", label: "Create and verify Buyer A", defaultStatus: "red", kind: "test" },
    { id: "19.05", label: "Create and verify Buyer B", defaultStatus: "red", kind: "test" },
    { id: "19.06", label: "Pre-Bid scenario", defaultStatus: "red", kind: "test" },
    { id: "19.07", label: "Max Bid scenario", defaultStatus: "red", kind: "test" },
    { id: "19.08", label: "Live two-buyer auction", defaultStatus: "red", kind: "test" },
    { id: "19.09", label: "Late-bid extension", defaultStatus: "red", kind: "test" },
    { id: "19.10", label: "Correct winner", defaultStatus: "red", kind: "test" },
    { id: "19.11", label: "Release / pickup flow", defaultStatus: "red", kind: "test" },
    { id: "19.12", label: "Complaint reconstruction", defaultStatus: "red", kind: "test" },
    { id: "19.13", label: "Full audit reconstruction", defaultStatus: "red", kind: "test" },
    { id: "19.14", label: "Pilot sign-off: zero critical blockers", defaultStatus: "red", kind: "test" },
  ]},
  { id: "20", title: "Production provider activation", tasks: [
    { id: "20.01", label: "Production KYC/KYB provider", defaultStatus: "red" },
    { id: "20.02", label: "Production email provider", defaultStatus: "red" },
    { id: "20.03", label: "Production SMS provider", defaultStatus: "red" },
    { id: "20.04", label: "VIN/history provider if used", defaultStatus: "red" },
    { id: "20.05", label: "Transport provider if used", defaultStatus: "red" },
    { id: "20.06", label: "Provider timeout/retry tests", defaultStatus: "red", kind: "test" },
    { id: "20.07", label: "Provider outage fallback behavior", defaultStatus: "red", kind: "test" },
  ]},
  { id: "21", title: "International readiness", tasks: [
    { id: "21.01", label: "CountryProfile configuration model", defaultStatus: "red", kind: "global" },
    { id: "21.02", label: "No country-specific hardcoding in core", defaultStatus: "red", kind: "global" },
    { id: "21.03", label: "Locale-aware dates", defaultStatus: "red", kind: "global" },
    { id: "21.04", label: "Timezone-aware display", defaultStatus: "red", kind: "global" },
    { id: "21.05", label: "BG locale", defaultStatus: "red", kind: "global" },
    { id: "21.06", label: "EN locale", defaultStatus: "red", kind: "global" },
    { id: "21.07", label: "Translation key architecture", defaultStatus: "red", kind: "global" },
    { id: "21.08", label: "Country-specific KYC profile", defaultStatus: "red", kind: "global" },
    { id: "21.09", label: "Country-specific legal profile", defaultStatus: "red", kind: "global" },
    { id: "21.10", label: "Country-specific document profile", defaultStatus: "red", kind: "global" },
    { id: "21.11", label: "Market activation gate", defaultStatus: "red", kind: "global" },
    { id: "21.12", label: "Country #2 activation without core rewrite", defaultStatus: "red", kind: "global" },
    { id: "21.13", label: "Regional CDN strategy", defaultStatus: "red", kind: "global" },
    { id: "21.14", label: "Regional data/residency review", defaultStatus: "red", kind: "global" },
  ]},
  { id: "22", title: "AI-assisted features", tasks: [
    { id: "22.01", label: "AI isolated from authoritative auction path", defaultStatus: "red", kind: "ai" },
    { id: "22.02", label: "Natural-language vehicle search", defaultStatus: "red", kind: "ai" },
    { id: "22.03", label: "AI support assistant", defaultStatus: "red", kind: "ai" },
    { id: "22.04", label: "AI listing assistant", defaultStatus: "red", kind: "ai" },
    { id: "22.05", label: "AI vehicle summary", defaultStatus: "red", kind: "ai" },
    { id: "22.06", label: "AI translation assistance", defaultStatus: "red", kind: "ai" },
    { id: "22.07", label: "AI output provenance / labels", defaultStatus: "red", kind: "ai" },
    { id: "22.08", label: "AI hallucination / unsafe-action tests", defaultStatus: "red", kind: "test" },
    { id: "22.09", label: "Visual damage assistant with human review", defaultStatus: "red", kind: "ai" },
  ]},
  { id: "23", title: "Production launch & ongoing engineering", tasks: [
    { id: "23.01", label: "Production domain", defaultStatus: "red" },
    { id: "23.02", label: "Production configuration review", defaultStatus: "red" },
    { id: "23.03", label: "Production secrets review", defaultStatus: "red", kind: "security" },
    { id: "23.04", label: "Production backup verified", defaultStatus: "red", kind: "test" },
    { id: "23.05", label: "Production health dashboard", defaultStatus: "red" },
    { id: "23.06", label: "Incident runbook", defaultStatus: "red" },
    { id: "23.07", label: "First controlled live auction", defaultStatus: "red", kind: "test" },
    { id: "23.08", label: "Post-launch error review", defaultStatus: "red", kind: "test" },
    { id: "23.09", label: "Regression suite before every release", defaultStatus: "red", kind: "test" },
    { id: "23.10", label: "Performance baseline tracked over time", defaultStatus: "red", kind: "test" },
  ]},
];

const STORAGE_KEY = "enchev-system-master-status-v3";
const NOTES_KEY = "enchev-system-master-notes-v3";
const GAPS_KEY = "enchev-system-master-gaps-v3";
const CHANNEL = "enchev-system-master-realtime-v3";

function baseStatuses() {
  const result: Record<string, Status> = {};
  phases.forEach((phase) => phase.tasks.forEach((task) => (result[task.id] = task.defaultStatus)));
  return result;
}

export default function SystemStageTracker() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>(baseStatuses);
  const [notes, setNotes] = useState<NoteMap>({});
  const [gaps, setGaps] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [gapText, setGapText] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    try {
      const savedStatuses = localStorage.getItem(STORAGE_KEY);
      const savedNotes = localStorage.getItem(NOTES_KEY);
      const savedGaps = localStorage.getItem(GAPS_KEY);
      if (savedStatuses) setStatuses((current) => ({ ...current, ...JSON.parse(savedStatuses) }));
      if (savedNotes) setNotes(JSON.parse(savedNotes));
      if (savedGaps) setGaps(JSON.parse(savedGaps));
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === "state") {
        setStatuses((current) => ({ ...current, ...(event.data.statuses || {}) }));
        if (event.data.notes) setNotes(event.data.notes);
        if (event.data.gaps) setGaps(event.data.gaps);
      }
    };
    return () => channel.close();
  }, []);

  function persist(nextStatuses: Record<string, Status>, nextNotes = notes, nextGaps = gaps) {
    setStatuses(nextStatuses);
    setNotes(nextNotes);
    setGaps(nextGaps);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStatuses));
      localStorage.setItem(NOTES_KEY, JSON.stringify(nextNotes));
      localStorage.setItem(GAPS_KEY, JSON.stringify(nextGaps));
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage({ type: "state", statuses: nextStatuses, notes: nextNotes, gaps: nextGaps });
      channel.close();
    } catch {}
  }

  function setTaskStatus(id: string, status: Status) {
    const nextNotes = { ...notes, [id]: { ...notes[id], updatedAt: new Date().toISOString() } };
    persist({ ...statuses, [id]: status }, nextNotes);
  }

  function updateNote(id: string, field: "evidence" | "blocker", value: string) {
    const nextNotes = { ...notes, [id]: { ...notes[id], [field]: value, updatedAt: new Date().toISOString() } };
    persist(statuses, nextNotes);
  }

  function addGap() {
    const label = gapText.trim();
    if (!label) return;
    const id = `GAP.${Date.now()}`;
    const nextGaps = [...gaps, { id, label, defaultStatus: "red", kind: "core" as Kind }];
    setGapText("");
    persist({ ...statuses, [id]: "red" }, notes, nextGaps);
  }

  function removeGap(id: string) {
    const nextGaps = gaps.filter((gap) => gap.id !== id);
    const nextStatuses = { ...statuses };
    const nextNotes = { ...notes };
    delete nextStatuses[id];
    delete nextNotes[id];
    persist(nextStatuses, nextNotes, nextGaps);
  }

  const allTasks = useMemo(() => [...phases.flatMap((phase) => phase.tasks), ...gaps], [gaps]);
  const totals = useMemo(() => {
    const result = { green: 0, yellow: 0, red: 0 };
    allTasks.forEach((task) => result[statuses[task.id] || task.defaultStatus]++);
    return result;
  }, [allTasks, statuses]);
  const progress = allTasks.length ? Math.round((totals.green / allTasks.length) * 100) : 0;
  const nextTask = allTasks.find((task) => (statuses[task.id] || task.defaultStatus) !== "green");

  const visiblePhases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source: Phase[] = gaps.length ? [...phases, { id: "GAP", title: "Открити пропуски", tasks: gaps }] : phases;
    return source
      .map((phase) => ({
        ...phase,
        tasks: phase.tasks.filter((task) => {
          const status = statuses[task.id] || task.defaultStatus;
          const matchFilter = filter === "all" || status === filter;
          const matchSearch = !q || `${task.id} ${task.label} ${phase.title}`.toLowerCase().includes(q);
          return matchFilter && matchSearch;
        }),
      }))
      .filter((phase) => phase.tasks.length > 0);
  }, [statuses, filter, query, gaps]);

  return (
    <>
      <button className="burgerButton" aria-label="Отвори меню" onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
      {menuOpen && <div className="menuShade" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidePanel ${menuOpen ? "sideOpen" : ""}`}>
        <div className="sidePanelTop">
          <div><div className="miniLabel">ENCHEV AUCTIONS</div><strong>System Command Center</strong></div>
          <button className="iconButton" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <button className="sideMenuItem" onClick={() => { setControlOpen(true); setMenuOpen(false); }}>
          <span className="sideMenuIcon">◫</span><span><b>Етапи</b><small>Истински системен план 0 → 100%</small></span><span>›</span>
        </button>
        <div className="sideStatusBox">
          <div className="liveLine"><i /> LOCAL REALTIME · CLOUD NEXT</div>
          <span>Системен прогрес</span><b>{progress}%</b>
          <div className="miniProgress"><i style={{ width: `${progress}%` }} /></div>
          <small>{totals.green} работят · {totals.yellow} тест/грешка · {totals.red} липсват</small>
        </div>
      </aside>

      {controlOpen && (
        <section className="controlOverlay">
          <header className="controlHeader">
            <div><div className="eyebrow">SYSTEM SOURCE OF TRUTH · 0 → 100%</div><h1>Enchev Auctions — Етапи</h1><p>Само реалната система: архитектура, функции, тестове, грешки, пропуски, security, providers, international readiness и production.</p></div>
            <button className="closeControl" onClick={() => setControlOpen(false)}>×</button>
          </header>

          <div className="controlKpis">
            <div><span>ПРОГРЕС</span><b>{progress}%</b><small>{allTasks.length} системни точки</small></div>
            <div className="kGreen"><span>РАБОТИ</span><b>{totals.green}</b><small>доказано</small></div>
            <div className="kYellow"><span>ТЕСТ / ГРЕШКА</span><b>{totals.yellow}</b><small>не е приключено</small></div>
            <div className="kRed"><span>ЛИПСВА</span><b>{totals.red}</b><small>не е построено</small></div>
            <div><span>LIVE</span><b className="clockText">{now.toLocaleTimeString("bg-BG")}</b><small>локален realtime</small></div>
          </div>

          <div className="nextGrid"><div className="nextCard"><span>NEXT SYSTEM BLOCKER</span><b>{nextTask ? `${nextTask.id} · ${nextTask.label}` : "Всичко е GREEN"}</b></div></div>

          <div className="controlTools">
            <div className="filterGroup">
              {(["all", "green", "yellow", "red"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Всички" : value === "green" ? "Работи" : value === "yellow" ? "Тест/грешка" : "Липсва"}</button>)}
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Търси функция, тест, етап..." />
          </div>

          <div className="gapBox">
            <div><b>Открихме пропуск?</b><small>Добавяме го веднага в master плана. Нищо не остава само в чата.</small></div>
            <div className="gapInput"><input value={gapText} onChange={(e) => setGapText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGap()} placeholder="Нова липсваща системна стъпка..." /><button onClick={addGap}>Добави пропуск</button></div>
          </div>

          <div className="phaseList">
            {visiblePhases.map((phase) => {
              const phaseTotal = phase.tasks.length;
              const phaseGreen = phase.tasks.filter((task) => (statuses[task.id] || task.defaultStatus) === "green").length;
              const phaseYellow = phase.tasks.filter((task) => (statuses[task.id] || task.defaultStatus) === "yellow").length;
              const phaseRed = phaseTotal - phaseGreen - phaseYellow;
              const phasePct = phaseTotal ? Math.round((phaseGreen / phaseTotal) * 100) : 0;
              return (
                <details className={`phaseBlock ${phase.id === "GAP" ? "gapPhase" : ""}`} key={phase.id} open={phase.id === "01" || phase.id === "GAP"}>
                  <summary className="phaseHead"><div><span>ЕТАП {phase.id}</span><b>{phase.title}</b></div><div className="phaseCounts"><i className="greenDot">{phaseGreen}</i><i className="yellowDot">{phaseYellow}</i><i className="redDot">{phaseRed}</i><strong>{phasePct}%</strong></div></summary>
                  <div className="phaseTasks">
                    {phase.tasks.map((task) => {
                      const status = statuses[task.id] || task.defaultStatus;
                      const note = notes[task.id] || {};
                      return (
                        <article key={task.id} className={`taskCard task-${status}`}>
                          <div className="taskTop">
                            <div className="taskMain"><span className="taskId">{task.id}</span>{task.kind && task.kind !== "core" && <span className={`kind kind-${task.kind}`}>{task.kind.toUpperCase()}</span>}<b>{task.label}</b><small>{status === "green" ? "Работи и е проверено" : status === "yellow" ? "Има тест, грешка или незавършена проверка" : "Още не е построено"}</small></div>
                            <div className="statusButtons"><button className={status === "green" ? "green" : ""} onClick={() => setTaskStatus(task.id, "green")}>РАБОТИ</button><button className={status === "yellow" ? "yellow" : ""} onClick={() => setTaskStatus(task.id, "yellow")}>ТЕСТ/ГРЕШКА</button><button className={status === "red" ? "red" : ""} onClick={() => setTaskStatus(task.id, "red")}>ЛИПСВА</button>{phase.id === "GAP" && <button className="removeGap" onClick={() => removeGap(task.id)}>×</button>}</div>
                          </div>
                          <div className="taskDetails"><input value={note.evidence || ""} onChange={(e) => updateNote(task.id, "evidence", e.target.value)} placeholder="Evidence: URL / commit / test result" /><input value={note.blocker || ""} onChange={(e) => updateNote(task.id, "blocker", e.target.value)} placeholder="Грешка / blocker / какво остава" /><span>{note.updatedAt ? `Update ${new Date(note.updatedAt).toLocaleString("bg-BG")}` : "No update yet"}</span></div>
                        </article>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>

          <footer className="controlFooter"><b>Правило:</b> GREEN само когато функцията реално работи и има доказателство. YELLOW при тест, грешка, частично работещо или чакаща проверка. RED когато липсва. След Supabase този Command Center ще се премести от local realtime към cloud realtime между устройства.</footer>
        </section>
      )}
    </>
  );
}

"use client";

import { useEffect } from "react";

type Status = "green" | "yellow" | "red";
type Kind = "core" | "test" | "security" | "legal" | "global" | "ai";
type GapTask = { id: string; label: string; defaultStatus: Status; kind: Kind };

const GK = "enchev-system-gaps-v5";
const SK = "enchev-system-status-v5";
const CK = "enchev-system-realtime-v5";

// Append-only audit discoveries. These IDs are permanent and must never be reused.
const AUDIT_GAPS: GapTask[] = [
  {id:"GAP-001",label:"[Security disclosure] Publish and maintain /.well-known/security.txt per RFC 9116",defaultStatus:"red",kind:"security"},
  {id:"GAP-002",label:"[Security disclosure] Public coordinated vulnerability disclosure policy with scope and safe-harbor guidance",defaultStatus:"red",kind:"security"},
  {id:"GAP-003",label:"[Security disclosure] Security contact ownership, backup contact and expiry/rotation process",defaultStatus:"red",kind:"security"},
  {id:"GAP-004",label:"[Security disclosure] Vulnerability intake, severity triage, acknowledgement and remediation SLA",defaultStatus:"red",kind:"security"},
  {id:"GAP-005",label:"[Security disclosure] Fix verification, researcher communication and disclosure closure evidence",defaultStatus:"red",kind:"security"},
  {id:"GAP-006",label:"[Browser supply chain] Inventory every third-party JavaScript/tag loaded in user-facing pages",defaultStatus:"red",kind:"security"},
  {id:"GAP-007",label:"[Browser supply chain] Explicit allowlist and owner for every third-party browser script",defaultStatus:"red",kind:"security"},
  {id:"GAP-008",label:"[Browser supply chain] SRI, sandboxing, self-hosting or documented exception for third-party scripts",defaultStatus:"red",kind:"security"},
  {id:"GAP-009",label:"[Browser supply chain] No unapproved analytics/tag-manager code on live bidding and privileged admin surfaces",defaultStatus:"red",kind:"security"},
  {id:"GAP-010",label:"[Security logging] Tamper-resistant central security log sink, logging-failure alert and log-access audit",defaultStatus:"red",kind:"security"},

  {id:"GAP-011",label:"[AI governance] Inventory every AI feature, model, provider and authoritative/non-authoritative boundary",defaultStatus:"red",kind:"ai"},
  {id:"GAP-012",label:"[AI governance] Model/provider/version registry with deployment history",defaultStatus:"red",kind:"ai"},
  {id:"GAP-013",label:"[AI governance] Version prompts/system instructions and bind production outputs to prompt/model versions",defaultStatus:"red",kind:"ai"},
  {id:"GAP-014",label:"[AI governance] Approval and rollback gate for model/provider/prompt changes",defaultStatus:"red",kind:"ai"},
  {id:"GAP-015",label:"[AI governance] Offline evaluation and regression suite for every AI-assisted feature",defaultStatus:"red",kind:"test"},
  {id:"GAP-016",label:"[AI security] Prompt-injection and tool/action-boundary abuse tests",defaultStatus:"red",kind:"security"},
  {id:"GAP-017",label:"[AI security] Sensitive-data leakage and provider-retention test/review",defaultStatus:"red",kind:"security"},
  {id:"GAP-018",label:"[AI reliability] AI provider outage, timeout and degraded-mode behavior",defaultStatus:"red",kind:"test"},
  {id:"GAP-019",label:"[AI governance] Human review/escalation path for consequential AI suggestions and fraud/risk outputs",defaultStatus:"red",kind:"ai"},
  {id:"GAP-020",label:"[AI legal] EU AI Act applicability/transparency assessment and evidence for each AI feature",defaultStatus:"red",kind:"legal"},

  {id:"GAP-021",label:"[Bid fairness] Durable server bid receipt created for every critical bid request",defaultStatus:"red",kind:"core"},
  {id:"GAP-022",label:"[Bid fairness] Server received_at is authoritative; client timestamp is informational only",defaultStatus:"red",kind:"core"},
  {id:"GAP-023",label:"[Bid fairness] Persist stable accepted/rejected reason code with every bid receipt",defaultStatus:"red",kind:"core"},
  {id:"GAP-024",label:"[Bid ambiguity] Idempotency-result lookup after client timeout or unknown response",defaultStatus:"red",kind:"core"},
  {id:"GAP-025",label:"[Bid idempotency] Define retention window and persistence guarantees for critical idempotency keys",defaultStatus:"red",kind:"core"},
  {id:"GAP-026",label:"[Bid ordering] Assign authoritative bid sequence atomically inside the committed transaction",defaultStatus:"red",kind:"core"},
  {id:"GAP-027",label:"[Anti-sniping] Late-bid extension update is atomic with accepted bid transaction",defaultStatus:"red",kind:"core"},
  {id:"GAP-028",label:"[Close race] Explicit serialization rule for bid acceptance racing auction close/finalization",defaultStatus:"red",kind:"core"},
  {id:"GAP-029",label:"[Close boundary] Document exact inclusive/exclusive end-time rule and test it",defaultStatus:"red",kind:"test"},
  {id:"GAP-030",label:"[Offline safety] Never queue bids offline; stale/offline bid attempts fail explicitly",defaultStatus:"red",kind:"core"},
  {id:"GAP-031",label:"[Stale UI] Bid acceptance always uses server state even when browser price/timer is stale",defaultStatus:"red",kind:"test"},
  {id:"GAP-032",label:"[Fairness test] Asymmetric-latency bidders around the exact close boundary",defaultStatus:"red",kind:"test"},
  {id:"GAP-033",label:"[Duplicate test] Network retry/double-submit after server commit produces no duplicate bid side effect",defaultStatus:"red",kind:"test"},
  {id:"GAP-034",label:"[Ambiguous commit test] Client times out after committed bid and reconciles by request/idempotency ID",defaultStatus:"red",kind:"test"},
  {id:"GAP-035",label:"[Max bid rules] Define and test increase, decrease, replacement and cancellation semantics",defaultStatus:"red",kind:"core"},
  {id:"GAP-036",label:"[Reserve rules] Define reserve-change permissions and immutable audit behavior after auction start",defaultStatus:"red",kind:"core"},
  {id:"GAP-037",label:"[Platform outage fairness] Policy for pause, extension, reschedule or cancellation near close",defaultStatus:"red",kind:"core"},
  {id:"GAP-038",label:"[Platform outage fairness] Mass-disconnect scenario proves no hidden winner advantage",defaultStatus:"red",kind:"test"},

  {id:"GAP-039",label:"[Buy Now] Atomic one-winner Buy Now claim transaction",defaultStatus:"red",kind:"core"},
  {id:"GAP-040",label:"[Buy Now] Two simultaneous Buy Now requests produce exactly one accepted claim",defaultStatus:"red",kind:"test"},
  {id:"GAP-041",label:"[Buy Now] Duplicate-click/retry idempotency",defaultStatus:"red",kind:"test"},
  {id:"GAP-042",label:"[Buy Now] Deterministic rule for Buy Now racing a live/pre-bid",defaultStatus:"red",kind:"test"},
  {id:"GAP-043",label:"[Buy Now] Deterministic rule for Buy Now racing close/finalization",defaultStatus:"red",kind:"test"},
  {id:"GAP-044",label:"[Buy Now] Durable acceptance/rejection receipt and authoritative availability state",defaultStatus:"red",kind:"core"},

  {id:"GAP-045",label:"[Pre-auction gate] Automated readiness gate before every scheduled live auction",defaultStatus:"red",kind:"core"},
  {id:"GAP-046",label:"[Pre-auction gate] Block start when critical DB/realtime/worker/clock/capacity dependencies are unhealthy",defaultStatus:"red",kind:"test"},
  {id:"GAP-047",label:"[Safe deploy] Auction-aware change freeze for dangerous schema/engine/config changes during hot auctions",defaultStatus:"red",kind:"core"},
  {id:"GAP-048",label:"[Safe deploy] Emergency hotfix procedure while active auctions exist",defaultStatus:"red",kind:"core"},
  {id:"GAP-049",label:"[Safe deploy] Canary auto-stop on bid, realtime or finalizer regression signals",defaultStatus:"red",kind:"test"},
  {id:"GAP-050",label:"[Realtime operations] WebSocket node DRAINING state stops new room ownership before shutdown",defaultStatus:"red",kind:"core"},
  {id:"GAP-051",label:"[Realtime operations] Room/connection ownership handoff and reconnect verification during drain",defaultStatus:"red",kind:"test"},
  {id:"GAP-052",label:"[Bulkhead] Isolate bid/finalization resource pools from search, AI, media and background workloads",defaultStatus:"red",kind:"core"},
  {id:"GAP-053",label:"[Overload] Priority/load-shedding order keeps bid/finalization above non-critical workloads",defaultStatus:"red",kind:"core"},
  {id:"GAP-054",label:"[Redis safety] Eviction/maxmemory policy cannot silently discard authoritative auction state",defaultStatus:"red",kind:"core"},
  {id:"GAP-055",label:"[Rate-limit dependency] Explicit fail-open/fail-closed behavior when limiter storage is unavailable",defaultStatus:"red",kind:"security"},
  {id:"GAP-056",label:"[Feature flags] Owner, reason, creation time, expiry, audit, cleanup and safe default for every flag",defaultStatus:"red",kind:"core"},

  {id:"GAP-057",label:"[Time zones] Track deployed IANA tzdb version and update ownership/process",defaultStatus:"red",kind:"global"},
  {id:"GAP-058",label:"[Time zones] Re-evaluate future local auction schedules after tzdb rule changes",defaultStatus:"red",kind:"test"},
  {id:"GAP-059",label:"[Object recovery] Object-storage versioning/backup/replication policy for photos, videos and documents",defaultStatus:"red",kind:"core"},
  {id:"GAP-060",label:"[Object recovery] Restore drill for vehicle media/documents into a clean environment",defaultStatus:"red",kind:"test"},
  {id:"GAP-061",label:"[Object recovery] Database-to-object reconciliation after restore detects missing/orphaned objects",defaultStatus:"red",kind:"test"},
  {id:"GAP-062",label:"[Backup resilience] Immutable/ransomware-resistant backup copy or equivalent isolation",defaultStatus:"red",kind:"security"},
  {id:"GAP-063",label:"[Privacy restore] Deletion tombstone/reconciliation prevents deleted personal data silently reappearing after backup restore",defaultStatus:"red",kind:"legal"},
  {id:"GAP-064",label:"[Webhook replay] Timestamp/nonce tolerance and replay protection in addition to signatures/idempotency",defaultStatus:"red",kind:"security"},
  {id:"GAP-065",label:"[Audit time integrity] Critical audit/bid timestamps have trusted source and detectable clock anomaly",defaultStatus:"red",kind:"security"},
  {id:"GAP-066",label:"[Test data] Production/staging test-data isolation, synthetic-data rules and purge procedure",defaultStatus:"red",kind:"security"},

  {id:"GAP-067",label:"[Eligibility] Age-of-majority / legal-capacity gate per launch country where applicable",defaultStatus:"red",kind:"legal"},
  {id:"GAP-068",label:"[Identity lifecycle] Track identity-document expiry",defaultStatus:"red",kind:"core"},
  {id:"GAP-069",label:"[Identity lifecycle] Automatically restrict eligibility when required KYC/identity evidence expires",defaultStatus:"red",kind:"core"},
  {id:"GAP-070",label:"[Identity lifecycle] Re-verification and renewal workflow with audit history",defaultStatus:"red",kind:"core"},
  {id:"GAP-071",label:"[Identity abuse] Detect/review likely duplicate real identities across multiple accounts",defaultStatus:"red",kind:"security"},
  {id:"GAP-072",label:"[Bidder credentials] Country-specific bidder/dealer licence or credential issue/expiry/renewal model where required",defaultStatus:"red",kind:"global"},
  {id:"GAP-073",label:"[Eligibility correctness] Re-check current eligibility inside every authoritative bid/Buy Now transaction",defaultStatus:"red",kind:"test"},
  {id:"GAP-074",label:"[Support access] Support/admin impersonation is disabled or strongly scoped, step-up protected and fully audited",defaultStatus:"red",kind:"security"},

  {id:"GAP-075",label:"[Vehicle identity] VIN format/check-digit validation plus explicit non-standard chassis-number handling",defaultStatus:"red",kind:"core"},
  {id:"GAP-076",label:"[Odometer integrity] ACTUAL / NOT ACTUAL / EXEMPT / UNKNOWN status model",defaultStatus:"red",kind:"core"},
  {id:"GAP-077",label:"[Odometer integrity] Preserve original odometer unit/value and conversion provenance",defaultStatus:"red",kind:"global"},
  {id:"GAP-078",label:"[Condition trust] Run & Drive stores observation time, observer/source, evidence and non-warranty semantics",defaultStatus:"red",kind:"core"},
  {id:"GAP-079",label:"[Vehicle safety] Recall lookup provenance, checked-at timestamp and freshness policy where provider/data exists",defaultStatus:"red",kind:"core"},
  {id:"GAP-080",label:"[Vehicle history] Theft/salvage/flood/title-history provenance, provider limitations and checked-at timestamp",defaultStatus:"red",kind:"core"},
  {id:"GAP-081",label:"[EV safety] BEV/HEV/PHEV high-voltage hazard and damaged-battery risk flags",defaultStatus:"red",kind:"core"},
  {id:"GAP-082",label:"[EV safety] Damaged/flooded high-voltage vehicle quarantine, trained-role, towing/storage and emergency procedure",defaultStatus:"red",kind:"test"},
  {id:"GAP-083",label:"[Physical exception] Vehicle unavailable/missing after auction workflow and participant notification",defaultStatus:"red",kind:"core"},
  {id:"GAP-084",label:"[Physical exception] New damage discovered after auction but before pickup: evidence, hold, notification and dispute path",defaultStatus:"red",kind:"core"},
  {id:"GAP-085",label:"[Physical exception] Lost/missing key or critical document after auction triggers hold and incident workflow",defaultStatus:"red",kind:"core"},
  {id:"GAP-086",label:"[Yard degraded mode] Offline/degraded yard actions reconcile deterministically after connectivity returns",defaultStatus:"red",kind:"test"},

  {id:"GAP-087",label:"[EU consumer law] Determine per-country whether online-only auctions are distance contracts rather than public auctions and map resulting obligations",defaultStatus:"red",kind:"legal"},
  {id:"GAP-088",label:"[EU consumer law] Consumer-vs-trader flow maps withdrawal/conformity/pre-contract information rules by transaction and auction mode",defaultStatus:"red",kind:"legal"},
  {id:"GAP-089",label:"[EU marketplace] DSA Articles 30-32 applicability: trader traceability, compliance-by-design and illegal-product consumer notification workflow",defaultStatus:"red",kind:"legal"},
  {id:"GAP-090",label:"[EU product safety] GPSR Article 22 applicability and Safety Gate/contact/workflow requirements for online marketplace operations",defaultStatus:"red",kind:"legal"},
  {id:"GAP-091",label:"[EU P2B] Applicability review and ranking-transparency requirements for business sellers where applicable",defaultStatus:"red",kind:"legal"},
  {id:"GAP-092",label:"[EU P2B] Seller restriction/suspension/termination reasons, durable notice, complaint and reinstatement workflow where applicable",defaultStatus:"red",kind:"legal"},
  {id:"GAP-093",label:"[EU cybersecurity] NIS2 applicability decision; if applicable, map risk controls and 24h/72h/final incident notification runbook",defaultStatus:"red",kind:"legal"},
  {id:"GAP-094",label:"[Country launch evidence] Country legal sign-off explicitly records Consumer Rights/DSA/GPSR/P2B/NIS2/AI applicability decisions",defaultStatus:"red",kind:"global"}
];

export default function SeedAuditGaps(){
  useEffect(()=>{
    try{
      const existing: GapTask[] = JSON.parse(localStorage.getItem(GK) || "[]");
      const statuses: Record<string,Status> = JSON.parse(localStorage.getItem(SK) || "{}");
      const byId = new Map(existing.map(g=>[g.id,g]));
      let changed = false;

      for(const gap of AUDIT_GAPS){
        if(!byId.has(gap.id)){
          byId.set(gap.id,gap);
          changed = true;
        }
        if(!statuses[gap.id]){
          statuses[gap.id] = "red";
          changed = true;
        }
      }

      if(!changed) return;
      const merged = Array.from(byId.values());
      localStorage.setItem(GK,JSON.stringify(merged));
      localStorage.setItem(SK,JSON.stringify(statuses));

      const publish = ()=>{
        try{
          const c = new BroadcastChannel(CK);
          c.postMessage({type:"state",statuses,gaps:merged});
          c.close();
        }catch{}
      };
      publish();
      window.setTimeout(publish,0);
    }catch{}
  },[]);

  return null;
}

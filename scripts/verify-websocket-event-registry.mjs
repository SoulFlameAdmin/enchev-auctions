import fs from "node:fs";
import { decideRealtimeSequence, isEnchevRealtimeEvent } from "../packages/contracts/src/realtime-event.ts";

const registry = JSON.parse(fs.readFileSync("config/enchev-websocket-event-registry.json", "utf8"));
function fail(message) { throw new Error("24.12 WEBSOCKET_EVENT_REGISTRY FAIL: " + message); }
function requireTrue(condition, message) { if (!condition) fail(message); }

requireTrue(registry.task === "24.12", "task drift");
requireTrue(registry.envelopeVersion === 1, "envelope version drift");
requireTrue(registry.transportAuthority === false, "transport must remain non-authoritative");
requireTrue(registry.sequenceScope === "auction-stream", "sequence scope drift");
requireTrue(String(registry.gapPolicy).includes("resync"), "gap/resync policy missing");
requireTrue(String(registry.authorityBoundary).includes("PostgreSQL remains authoritative"), "authority boundary missing");

const required = ["id","type","source","subject","time","sequence","schemaVersion","correlationId","data"];
requireTrue(JSON.stringify(registry.requiredEnvelopeFields) === JSON.stringify(required), "required envelope fields drift");

const allowed = new Map();
for (const item of registry.events || []) {
  requireTrue(typeof item.type === "string" && /^enchev\.[a-z.]+\.v1$/.test(item.type), "invalid event type");
  requireTrue(item.schemaVersion === 1, "schema version drift");
  requireTrue(item.subjectPrefix === "auction/", "subject prefix drift");
  requireTrue(!allowed.has(item.type), "duplicate event type");
  allowed.set(item.type, item.schemaVersion);
}
requireTrue(allowed.size >= 6, "registry incomplete");

const sample = {
  id: "evt-01",
  type: "enchev.bid.accepted.v1",
  source: "enchev-auctions",
  subject: "auction/EA-10539",
  time: "2026-09-22T00:00:00.000Z",
  sequence: 42,
  schemaVersion: 1,
  correlationId: "req-01",
  data: { bidId: "bid-01", amountMinor: 125000 }
};
requireTrue(isEnchevRealtimeEvent(sample, allowed), "valid event rejected");
requireTrue(decideRealtimeSequence(41, 42) === "apply", "contiguous event must apply");
requireTrue(decideRealtimeSequence(42, 42) === "duplicate", "duplicate event must be ignored");
requireTrue(decideRealtimeSequence(40, 42) === "resync", "sequence gap must trigger resync");
requireTrue(decideRealtimeSequence(null, 2) === "resync", "initial non-one sequence must resync");

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const rejectEvent = (label, mutate) => {
    const value = structuredClone(sample);
    mutate(value);
    if (isEnchevRealtimeEvent(value, allowed)) fail("negative self-test accepted: " + label);
    cases += 1;
  };
  rejectEvent("unknown type", (v) => { v.type = "enchev.unknown.v1"; });
  rejectEvent("wrong source", (v) => { v.source = "browser"; });
  rejectEvent("bad subject", (v) => { v.subject = "user/1"; });
  rejectEvent("bad time", (v) => { v.time = "yesterday"; });
  rejectEvent("zero sequence", (v) => { v.sequence = 0; });
  rejectEvent("schema mismatch", (v) => { v.schemaVersion = 2; });
  rejectEvent("extra field", (v) => { v.authoritative = true; });
  console.log("24.12 WEBSOCKET_EVENT_REGISTRY_SELF_TEST PASS negative_cases=" + cases + " events=" + allowed.size + " gap_policy=resync");
} else {
  console.log("24.12 WEBSOCKET_EVENT_REGISTRY PASS events=" + allowed.size + " envelope=v1 sequence=auction-stream authority=false");
}

import fs from "node:fs";

const cloudClient = fs.readFileSync("app/components/CloudPlanStateSync.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const workflow = fs.readFileSync(".github/workflows/verify-enchev-web.yml", "utf8");
const syncScript = fs.readFileSync("scripts/sync-cloud-plan-state.mjs", "utf8");
const verifiedSource = fs.readFileSync("app/components/VerifiedPlanEvidenceSync.tsx", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`CLOUD_PLAN_STATE FAILED: ${message}`);
    process.exit(1);
  }
}

function extractVerifiedRows(source) {
  const markerIndex = source.indexOf("const VERIFIED_WAVE_0");
  const open = source.indexOf("{", markerIndex);
  const close = source.indexOf("\n};", open);
  assert(markerIndex >= 0 && open >= 0 && close > open, "VERIFIED_WAVE_0 block must exist");
  const block = source.slice(open + 1, close);
  const rows = [];
  const ids = new Set();
  for (const match of block.matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) {
    const id = match[1];
    const evidence = JSON.parse(`"${match[2]}"`);
    assert(!ids.has(id), `duplicate verified ID ${id}`);
    assert(/^([0-9]{2}\.[0-9]{2}|GAP-[0-9]{3,})$/.test(id), `invalid verified ID ${id}`);
    assert(Boolean(evidence.trim()), `missing evidence for ${id}`);
    ids.add(id);
    rows.push({ id, evidence });
  }
  assert(rows.length > 0, "verified state extraction must return rows");
  return rows;
}

assert(cloudClient.includes("frhletkiuupgksmgxoxc.supabase.co/functions/v1/enchev-plan-state"), "client must use the dedicated Enchev Edge Function");
assert(cloudClient.includes("new EventSource(`${ENDPOINT}?stream=1`)"), "client must use SSE cloud realtime stream");
assert(cloudClient.includes("BroadcastChannel(CHANNEL_KEY)"), "cloud updates must fan out through existing realtime channel");
assert(cloudClient.includes("localIsNewer"), "newer local manual state must not be silently overwritten");
assert(!cloudClient.includes("SUPABASE_SERVICE_ROLE_KEY"), "service-role credentials must never exist in browser code");
assert(layout.includes('import CloudPlanStateSync from "./components/CloudPlanStateSync";'), "root layout must import CloudPlanStateSync");
assert(layout.includes("<CloudPlanStateSync />"), "root layout must mount CloudPlanStateSync");
assert(workflow.includes("sync-plan-cloud:"), "workflow must contain a separate cloud sync job");
assert(workflow.includes("id-token: write"), "cloud sync job must use GitHub OIDC");
assert(workflow.includes("needs: verify-web"), "cloud write must happen only after verification passes");
assert(workflow.includes("node scripts/sync-cloud-plan-state.mjs"), "workflow must invoke cloud sync script");
assert(syncScript.includes('audience = "enchev-plan-state"'), "sync must request dedicated OIDC audience");
assert(syncScript.includes('method: "POST"'), "sync must write through Edge Function POST");
assert(syncScript.includes("Cloud read-back mismatch"), "sync must verify cloud read-back after write");
assert(!syncScript.includes("SUPABASE_SERVICE_ROLE_KEY"), "CI sync must not require a Supabase service-role secret");

const rows = extractVerifiedRows(verifiedSource);
console.log(`CLOUD_PLAN_STATE invariant PASS verified_rows=${rows.length}`);

if (process.argv.includes("--self-test")) {
  const acceptCloud = ({ localUpdatedAt, cloudUpdatedAt, localEvidence, localBlocker }) => {
    const localTime = Date.parse(localUpdatedAt || "");
    const cloudTime = Date.parse(cloudUpdatedAt || "");
    const localIsNewer = Number.isFinite(localTime) && Number.isFinite(cloudTime) && localTime > cloudTime;
    return !(localIsNewer && ((localBlocker || "").trim() || (localEvidence || "").trim()));
  };
  assert(acceptCloud({ localUpdatedAt: "", cloudUpdatedAt: "2026-09-17T10:00:00Z", localEvidence: "", localBlocker: "" }), "fresh browser must accept cloud state");
  assert(acceptCloud({ localUpdatedAt: "2026-09-17T09:00:00Z", cloudUpdatedAt: "2026-09-17T10:00:00Z", localEvidence: "old", localBlocker: "" }), "newer cloud state must replace older local projection");
  assert(!acceptCloud({ localUpdatedAt: "2026-09-17T11:00:00Z", cloudUpdatedAt: "2026-09-17T10:00:00Z", localEvidence: "manual evidence", localBlocker: "" }), "newer local evidence must be preserved");
  assert(!acceptCloud({ localUpdatedAt: "2026-09-17T11:00:00Z", cloudUpdatedAt: "2026-09-17T10:00:00Z", localEvidence: "", localBlocker: "manual blocker" }), "newer local blocker must be preserved");
  assert(rows.every(row => row.evidence.trim().length > 0), "all cloud GREEN rows must have evidence");
  console.log("CLOUD_PLAN_STATE SELF-TEST PASS: fresh sync, cloud freshness, local override protection, GREEN evidence");
}

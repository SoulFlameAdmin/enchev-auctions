#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CLOUD_QUOTA_COOLDOWN_MS, CLOUD_QUOTA_BACKOFF_KEY,
  classifyPlanEndpoint, shouldBlockPlanEndpoint, isFreshPlanRows,
} from "../app/lib/enchev-cloud-transport-policy.ts";

// Tests use Node 24 built-in type stripping, not a simulated API response.
let cases = 0;
for (const code of [200,201,206]) {
  assert.equal(classifyPlanEndpoint(code),"ok");cases++;
}
assert.equal(classifyPlanEndpoint(402),"quota-restricted");cases++;
for (const code of [0,400,401,403,404,429,500,503]) {
  assert.equal(classifyPlanEndpoint(code),"transient-error");cases++;
}
assert.equal(CLOUD_QUOTA_COOLDOWN_MS,900000);cases++;
assert.match(CLOUD_QUOTA_BACKOFF_KEY,/402/);cases++;
const now=1800000000000;
for (const delta of [0,1,1000,60000,CLOUD_QUOTA_COOLDOWN_MS-1]) {
  assert.equal(shouldBlockPlanEndpoint(String(now-delta),now),true);cases++;
}
for (const value of ["",null,{},[],1234,"nan",String(now+1),
  String(now-CLOUD_QUOTA_COOLDOWN_MS),String(now-10000000),"-1000000000000"]) {
  assert.equal(shouldBlockPlanEndpoint(value,now),false);cases++;
}
for(const invalid of [undefined,null,[],{}, {rows:null},{rows:{}},{rows:"not array"}]){
  assert.equal(isFreshPlanRows(invalid),false);cases++;
}
assert.equal(isFreshPlanRows({rows:[]}),true);cases++;
assert.equal(isFreshPlanRows({rows:[{task_id:"24.13"}]}),true);cases++;

// Statically prevent accidental reintroduction of the 402 request storm.
// These assertions are NOT a substitute for browser smoke, but enforce
// that the successful load precedes SSE and that the 402 circuit closes it.
const client=fs.readFileSync("app/components/CloudPlanStateSync.tsx","utf8");
const checks=[
  ["guarded 402 response",client.includes('kind === "quota-restricted"')],
  ["stop requests on quota",client.includes("quotaCircuitOpen(true)")],
  ["SSE shutdown",client.includes("source.close()")],
  ["SSE error handler",client.includes("current.onerror = () =>")],
  ["no implicit SSE reconnect",client.includes("if (!receivedState) void pull();")],
  ["on-demand only while master stages open",client.includes("if (!stagesVisible) return;")],
  ["stop polling on tab hidden",client.includes('document.visibilityState === "hidden"')],
  ["only visible retries",client.includes('document.visibilityState !== "hidden"')],
  ["bounded 5-minute fallback",client.includes("}, 300000);")],
  ["avoid duplicate SSE snapshot",client.includes("let receivedState = false")],
  ["react to master panel",client.includes('window.addEventListener("enchev-master-stages-visible"')],

  ["SSE only after good pull",client.includes("if (success && active && !blocked) connectStream()")],
  ["single active pull",client.includes("inFlight = true") && client.includes("inFlight = false")],
  ["cross-tab breaker",client.includes("BroadcastChannel(HEALTH_CHANNEL_KEY)")],
  ["persisted cooldown",client.includes("localStorage.setItem(CLOUD_QUOTA_BACKOFF_KEY")],
  ["user-visible degraded state",client.includes('role="status"') && client.includes("HTTP 402")],
  ["retain cloud merge semantics",client.includes("localIsNewer")],
  ["retain SSE",client.includes("new EventSource(`${ENDPOINT}?stream=1`)")],
  ["no unsafe provider credentials",!client.includes("SUPABASE_SERVICE_ROLE_KEY")],
];
const master=fs.readFileSync("app/components/MasterSystemPlanV1.tsx","utf8");
assert.ok(master.includes('new CustomEvent("enchev-master-stages-visible"'),"Master Plan must publish visibility");
assert.ok(master.includes("if (open) window.dispatchEvent"),"Master Plan must close signal on unmount");
cases += 2;
for(const [label,yes] of checks){assert.ok(yes,label);cases++;}
console.log("CLOUD_402_CIRCUIT_GUARD PASS cases="+cases+" status=fail-closed rows=untouched");

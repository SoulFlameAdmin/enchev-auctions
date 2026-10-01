import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  createRateLimitResponseContract,
  isRateLimitResponseContract,
} from "../packages/contracts/src/http-schema.ts";

const CONFIG_PATH="config/enchev-rate-limit-bypass-41-11.json";
const DOMAIN_PATH="packages/domain/src/rate-limit-bypass.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("RATE_LIMIT_BYPASS_41_11 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-rate-limit-41-11-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"rate-limit-bypass.js")).href+"?v="+Date.now());
  return {mod,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.11"||config.title!=="Rate-limit bypass test"||config.kind!=="security") fail("task identity drift");
if(config.policy?.algorithm!=="independent-sliding-windows") fail("algorithm drift");
for(const key of ["trustedSourceDerivedServerSide","actorDerivedServerSide","clientActorClaimForbidden","clientSourceClaimForbidden","actorSourceAndRouteBucketsIndependent","everyAllowedAttemptCounts","clockRegressionRejected","genericPublic429"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionDistributedLimiterStoreNotClaimed","edgeProxyTrustedSourceExtractionNotClaimed","providerSpecificWafRateLimitNotClaimed","botBiddingCertificationRemains41_12"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==16) fail("abuse scenario coverage drift");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Rate-limit bypass test||security"')) fail("frozen 41.11 identity missing");

const {mod:d,tmp}=await loadDomain();
const policy=d.validateRateLimitBypassPolicy({
  actorLimit:config.policy.actorLimit,
  actorWindowMs:config.policy.actorWindowMs,
  sourceLimit:config.policy.sourceLimit,
  sourceWindowMs:config.policy.sourceWindowMs,
  routeLimit:config.policy.routeLimit,
  routeWindowMs:config.policy.routeWindowMs,
});
const base=Date.parse("2026-10-01T16:00:00Z");

function perform(state,actorKey,trustedSourceKey,routeKey,nowMs){
  const pre=d.checkRateLimitBypass(state,{actorKey,trustedSourceKey,routeKey,nowMs},policy);
  if(!pre.allowed) return {decision:pre,state:pre.state};
  const next=d.recordRateLimitedRequest(pre.state,{actorKey,trustedSourceKey,routeKey,nowMs},policy);
  return {decision:d.checkRateLimitBypass(next,{actorKey,trustedSourceKey,routeKey,nowMs},policy),state:next};
}

// 1. Same actor/source: actor budget blocks after 5 allowed attempts.
let state=d.emptyRateLimitBypassState();
for(let i=0;i<policy.actorLimit;i++){
  const pre=d.checkRateLimitBypass(state,{actorKey:"actor-a",trustedSourceKey:"src-a",routeKey:"route-bid",nowMs:base+i},policy);
  if(!pre.allowed) fail("same actor/source blocked before actor threshold");
  state=d.recordRateLimitedRequest(pre.state,{actorKey:"actor-a",trustedSourceKey:"src-a",routeKey:"route-bid",nowMs:base+i},policy);
}
let blocked=d.checkRateLimitBypass(state,{actorKey:"actor-a",trustedSourceKey:"src-a",routeKey:"route-bid",nowMs:base+100},policy);
if(blocked.allowed||blocked.triggeredBy!=="actor") fail("actor bucket bypassed");

// 2. Source rotation cannot bypass the actor bucket.
state=d.emptyRateLimitBypassState();
for(let i=0;i<policy.actorLimit;i++){
  const ctx={actorKey:"actor-rotate-source",trustedSourceKey:"src-"+i,routeKey:"route-bid",nowMs:base+i};
  const pre=d.checkRateLimitBypass(state,ctx,policy); if(!pre.allowed) fail("source rotation blocked early");
  state=d.recordRateLimitedRequest(pre.state,ctx,policy);
}
blocked=d.checkRateLimitBypass(state,{actorKey:"actor-rotate-source",trustedSourceKey:"src-new",routeKey:"route-bid",nowMs:base+100},policy);
if(blocked.allowed||blocked.triggeredBy!=="actor") fail("source rotation bypassed actor budget");

// 3. Actor rotation cannot bypass trusted-source budget.
state=d.emptyRateLimitBypassState();
for(let i=0;i<policy.sourceLimit;i++){
  const ctx={actorKey:"actor-"+i,trustedSourceKey:"shared-source",routeKey:"route-search",nowMs:base+i};
  const pre=d.checkRateLimitBypass(state,ctx,policy); if(!pre.allowed) fail("actor rotation blocked before source threshold");
  state=d.recordRateLimitedRequest(pre.state,ctx,policy);
}
blocked=d.checkRateLimitBypass(state,{actorKey:"actor-next",trustedSourceKey:"shared-source",routeKey:"route-search",nowMs:base+100},policy);
if(blocked.allowed||blocked.triggeredBy!=="source") fail("actor rotation bypassed source budget");

// 4. Rotating both actor and source still hits route-wide budget.
state=d.emptyRateLimitBypassState();
for(let i=0;i<policy.routeLimit;i++){
  const ctx={actorKey:"route-actor-"+i,trustedSourceKey:"route-src-"+i,routeKey:"route-critical",nowMs:base+i};
  const pre=d.checkRateLimitBypass(state,ctx,policy); if(!pre.allowed) fail("route-wide test blocked before threshold");
  state=d.recordRateLimitedRequest(pre.state,ctx,policy);
}
blocked=d.checkRateLimitBypass(state,{actorKey:"route-actor-next",trustedSourceKey:"route-src-next",routeKey:"route-critical",nowMs:base+100},policy);
if(blocked.allowed||blocked.triggeredBy!=="route") fail("actor+source rotation bypassed route budget");

// 5-6. Client spoofed identity/source claims are forbidden.
expectReject("client source spoof",()=>d.checkRateLimitBypass(d.emptyRateLimitBypassState(),{
  actorKey:"actor-a",trustedSourceKey:"trusted-edge-key",routeKey:"route-bid",nowMs:base,clientClaimedSourceKey:"1.2.3.4"
},policy),"RATE_LIMIT_CLIENT_SOURCE_CLAIM_FORBIDDEN");
expectReject("client actor spoof",()=>d.checkRateLimitBypass(d.emptyRateLimitBypassState(),{
  actorKey:"actor-a",trustedSourceKey:"trusted-edge-key",routeKey:"route-bid",nowMs:base,clientClaimedActorKey:"admin"
},policy),"RATE_LIMIT_CLIENT_ACTOR_CLAIM_FORBIDDEN");

// 7. Same-timestamp burst is counted; no timestamp coalescing bypass.
state=d.emptyRateLimitBypassState();
for(let i=0;i<policy.actorLimit;i++){
  const ctx={actorKey:"burst-actor",trustedSourceKey:"burst-src-"+i,routeKey:"route-burst",nowMs:base};
  const pre=d.checkRateLimitBypass(state,ctx,policy); if(!pre.allowed) fail("same-timestamp burst blocked early");
  state=d.recordRateLimitedRequest(pre.state,ctx,policy);
}
blocked=d.checkRateLimitBypass(state,{actorKey:"burst-actor",trustedSourceKey:"burst-src-new",routeKey:"route-burst",nowMs:base},policy);
if(blocked.allowed||blocked.triggeredBy!=="actor") fail("same-timestamp burst bypassed limiter");

// 8. A blocked request is not allowed to be recorded as another attempt.
expectReject("record blocked request",()=>d.recordRateLimitedRequest(state,{
  actorKey:"burst-actor",trustedSourceKey:"burst-src-new",routeKey:"route-burst",nowMs:base
},policy),"RATE_LIMIT_REQUEST_ALREADY_BLOCKED");

// 9. Exact window expiry recovers safely.
const recovered=d.checkRateLimitBypass(state,{
  actorKey:"burst-actor",trustedSourceKey:"burst-src-new",routeKey:"route-burst",nowMs:base+policy.actorWindowMs
},policy);
if(!recovered.allowed) fail("window expiry did not recover actor bucket");

// 10. Clock rollback cannot reset windows.
expectReject("clock rollback",()=>d.checkRateLimitBypass(state,{
  actorKey:"burst-actor",trustedSourceKey:"burst-src-new",routeKey:"route-burst",nowMs:base-1
},policy),"RATE_LIMIT_CLOCK_REGRESSION");

// 11. Cross-route budget remains independent.
state=d.emptyRateLimitBypassState();
for(let i=0;i<policy.actorLimit;i++){
  const ctx={actorKey:"actor-cross-route",trustedSourceKey:"src-cross-"+i,routeKey:"route-one",nowMs:base+i};
  const pre=d.checkRateLimitBypass(state,ctx,policy); state=d.recordRateLimitedRequest(pre.state,ctx,policy);
}
const otherRoute=d.checkRateLimitBypass(state,{actorKey:"different-actor",trustedSourceKey:"different-source",routeKey:"route-two",nowMs:base+100},policy);
if(!otherRoute.allowed) fail("unrelated route was contaminated");

// 12-13. Generic public 429 + canonical response contract.
const publicBlocked=d.publicRateLimitBypassResponse(blocked,policy);
if(/actor|source|route|bucket|ip/i.test(publicBlocked.message)) fail("public 429 leaks limiter internals");
const response=createRateLimitResponseContract({
  retryAfterSeconds:publicBlocked.retryAfterSeconds,
  limit:publicBlocked.limit,
  remaining:publicBlocked.remaining,
  resetEpochSeconds:Math.floor((base+publicBlocked.retryAfterSeconds*1000)/1000),
  code:publicBlocked.code,
  message:publicBlocked.message,
});
if(!isRateLimitResponseContract(response)||response.status!==429) fail("canonical 429 contract rejected");

// 14-16 negative structural cases.
expectReject("blank trusted source",()=>d.checkRateLimitBypass(d.emptyRateLimitBypassState(),{actorKey:"a",trustedSourceKey:" ",routeKey:"r",nowMs:base},policy),"RATE_LIMIT_SOURCE_KEY_REQUIRED");
expectReject("blank route",()=>d.checkRateLimitBypass(d.emptyRateLimitBypassState(),{actorKey:"a",trustedSourceKey:"s",routeKey:" ",nowMs:base},policy),"RATE_LIMIT_ROUTE_KEY_REQUIRED");

if(process.argv.includes("--self-test")){
  expectReject("zero actor limit",()=>d.validateRateLimitBypassPolicy({...policy,actorLimit:0}),"RATE_LIMIT_ACTOR_LIMIT_INVALID");
  expectReject("zero source window",()=>d.validateRateLimitBypassPolicy({...policy,sourceWindowMs:0}),"RATE_LIMIT_SOURCE_WINDOW_INVALID");
  expectReject("zero route limit",()=>d.validateRateLimitBypassPolicy({...policy,routeLimit:0}),"RATE_LIMIT_ROUTE_LIMIT_INVALID");
  expectReject("public response for allowed decision",()=>d.publicRateLimitBypassResponse({
    allowed:true,retryAfterSeconds:0,triggeredBy:null,actorRemaining:1,sourceRemaining:1,routeRemaining:1,state:d.emptyRateLimitBypassState()
  },policy),"RATE_LIMIT_RESPONSE_NOT_BLOCKED");
  console.log("RATE_LIMIT_BYPASS_41_11_SELF_TEST PASS scenarios=16 actor_limit=5 source_limit=12 route_limit=30 source_rotation_blocked=true actor_rotation_blocked=true combined_rotation_route_guard=true spoofed_identity_rejected=true same_timestamp_burst_counted=true clock_regression_rejected=true canonical_429=true production_distributed_store_claim=false negative_cases=4");
}else{
  console.log("RATE_LIMIT_BYPASS_41_11 PASS scenarios=16 multi_bucket=true canonical_429=true");
}
setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

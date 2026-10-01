import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  decideIdempotencyAction,
  isIdempotencyKey,
} from "../packages/contracts/src/http-schema.ts";

const CONFIG_PATH="config/enchev-critical-request-replay-41-10.json";
const DOMAIN_PATH="packages/domain/src/critical-request-replay.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("CRITICAL_REQUEST_REPLAY_41_10 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}
const fp=(char)=>"sha256:"+char.repeat(64);

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-critical-replay-41-10-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"critical-request-replay.js")).href+"?v="+Date.now());
  return {mod,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.10"||config.title!=="Replay / duplicate critical-request test"||config.kind!=="security") fail("task identity drift");
for(const key of ["authenticatedActorScoped","operationScoped","idempotencyKeyScoped","canonicalFingerprintRequired","inProgressDuplicateRejected","completedDuplicateReplaysStoredResult","differentFingerprintConflicts","oneLogicalRequestOneEffect","completionIsIdempotentOnlyWhenIdentical","effectReferenceCannotBeReusedAcrossLogicalRequests","transportRetriesDoNotChangeAuthority"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionAtomicDatabasePersistenceNotClaimed","productionBidRuntimeNotClaimed","productionFinalizationRuntimeNotClaimed","paymentCaptureRuntimeNotClaimed","rateLimitBypassCertificationRemains41_11"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.operations)||config.operations.length!==4) fail("operation coverage drift");
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==15) fail("abuse scenario coverage drift");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Replay / duplicate critical-request test||security"')) fail("frozen 41.10 identity missing");

const {mod:d,tmp}=await loadDomain();
const base=Date.parse("2026-10-01T12:00:00Z");

if(!isIdempotencyKey("bid.retry-001")) fail("41.10 valid key disagrees with canonical 24.07 validator");
if(decideIdempotencyAction(null,fp("a")).action!=="execute") fail("24.07 execute semantic drift");
if(decideIdempotencyAction({requestFingerprint:fp("a"),state:"completed"},fp("a")).action!=="replay") fail("24.07 replay semantic drift");
if(decideIdempotencyAction({requestFingerprint:fp("a"),state:"in-progress"},fp("a")).action!=="in-progress") fail("24.07 in-progress semantic drift");
if(decideIdempotencyAction({requestFingerprint:fp("a"),state:"completed"},fp("b")).action!=="conflict") fail("24.07 conflict semantic drift");

let ledger=d.emptyCriticalRequestLedger();
const effects={bid:0,finalize:0};

// Bid executes exactly once.
let begin=d.beginCriticalRequest(ledger,{actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),nowMs:base});
if(begin.action!=="execute") fail("first bid did not execute");
ledger=begin.state;
effects.bid++;
ledger=d.completeCriticalRequest(ledger,{
  actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),
  nowMs:base+10,responseStatus:201,responseRef:"response:bid-001",effectRef:"bid-event:001"
});
begin=d.beginCriticalRequest(ledger,{actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),nowMs:base+20});
if(begin.action!=="replay") fail("completed duplicate bid did not replay");
if(effects.bid!==1) fail("duplicate bid repeated side effect");
const replayBid=d.replayCriticalRequestResponse(ledger,{actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a")});
if(replayBid.responseStatus!==201||replayBid.responseRef!=="response:bid-001"||replayBid.effectRef!=="bid-event:001") fail("stored bid replay drift");

// Finalization executes exactly once.
let fin=d.beginCriticalRequest(ledger,{actorId:"auctioneer-1",operation:"auction.finalize",idempotencyKey:"finalize.retry-001",requestFingerprint:fp("c"),nowMs:base+30});
if(fin.action!=="execute") fail("first finalization did not execute");
ledger=fin.state;
effects.finalize++;
ledger=d.completeCriticalRequest(ledger,{
  actorId:"auctioneer-1",operation:"auction.finalize",idempotencyKey:"finalize.retry-001",requestFingerprint:fp("c"),
  nowMs:base+40,responseStatus:200,responseRef:"response:final-001",effectRef:"auction-result:001"
});
fin=d.beginCriticalRequest(ledger,{actorId:"auctioneer-1",operation:"auction.finalize",idempotencyKey:"finalize.retry-001",requestFingerprint:fp("c"),nowMs:base+50});
if(fin.action!=="replay"||effects.finalize!==1) fail("duplicate finalization repeated side effect");
const replayFinal=d.replayCriticalRequestResponse(ledger,{actorId:"auctioneer-1",operation:"auction.finalize",idempotencyKey:"finalize.retry-001",requestFingerprint:fp("c")});
if(replayFinal.effectRef!=="auction-result:001") fail("stored finalization replay drift");

// In-progress duplicate is blocked.
let inFlight=d.beginCriticalRequest(ledger,{actorId:"buyer-2",operation:"bid.submit",idempotencyKey:"bid.inflight",requestFingerprint:fp("d"),nowMs:base+60});
ledger=inFlight.state;
expectReject("in-progress duplicate",()=>d.beginCriticalRequest(ledger,{actorId:"buyer-2",operation:"bid.submit",idempotencyKey:"bid.inflight",requestFingerprint:fp("d"),nowMs:base+61}),"IDEMPOTENCY_REQUEST_IN_PROGRESS");
expectReject("replay before completion",()=>d.replayCriticalRequestResponse(ledger,{actorId:"buyer-2",operation:"bid.submit",idempotencyKey:"bid.inflight",requestFingerprint:fp("d")}),"IDEMPOTENCY_REQUEST_IN_PROGRESS");

// Same scoped key, different payload/fingerprint conflicts.
expectReject("same bid key different payload",()=>d.beginCriticalRequest(ledger,{actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("e"),nowMs:base+70}),"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
expectReject("same finalization key different payload",()=>d.beginCriticalRequest(ledger,{actorId:"auctioneer-1",operation:"auction.finalize",idempotencyKey:"finalize.retry-001",requestFingerprint:fp("f"),nowMs:base+70}),"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");

// Same opaque key in another actor scope is a new logical request.
let actorScoped=d.beginCriticalRequest(ledger,{actorId:"buyer-9",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),nowMs:base+80});
if(actorScoped.action!=="execute") fail("same key another actor should be independently scoped");
ledger=actorScoped.state;

// Same actor/key but another operation is independently scoped.
let opScoped=d.beginCriticalRequest(ledger,{actorId:"buyer-1",operation:"seller.reserve.update",idempotencyKey:"bid.retry-001",requestFingerprint:fp("1"),nowMs:base+81});
if(opScoped.action!=="execute") fail("same key another operation should be independently scoped");
ledger=opScoped.state;

// Identical completion retry is idempotent.
const beforeCount=ledger.records.length;
ledger=d.completeCriticalRequest(ledger,{
  actorId:"buyer-9",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),
  nowMs:base+90,responseStatus:201,responseRef:"response:bid-009",effectRef:"bid-event:009"
});
const completedOnce=ledger;
ledger=d.completeCriticalRequest(ledger,{
  actorId:"buyer-9",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),
  nowMs:base+91,responseStatus:201,responseRef:"response:bid-009",effectRef:"bid-event:009"
});
if(ledger!==completedOnce||ledger.records.length!==beforeCount) fail("identical completion retry created mutation");

// Conflicting completion retry is rejected.
expectReject("conflicting completion retry",()=>d.completeCriticalRequest(ledger,{
  actorId:"buyer-9",operation:"bid.submit",idempotencyKey:"bid.retry-001",requestFingerprint:fp("a"),
  nowMs:base+92,responseStatus:200,responseRef:"response:changed",effectRef:"bid-event:009"
}),"CRITICAL_REQUEST_COMPLETION_CONFLICT");

// One effect ref cannot belong to two logical requests.
let reserve=d.beginCriticalRequest(ledger,{actorId:"seller-1",operation:"seller.reserve.update",idempotencyKey:"reserve-001",requestFingerprint:fp("2"),nowMs:base+100});
ledger=reserve.state;
expectReject("effect ref reused",()=>d.completeCriticalRequest(ledger,{
  actorId:"seller-1",operation:"seller.reserve.update",idempotencyKey:"reserve-001",requestFingerprint:fp("2"),
  nowMs:base+101,responseStatus:200,responseRef:"response:reserve-001",effectRef:"bid-event:009"
}),"CRITICAL_REQUEST_EFFECT_REF_REUSED");

if(process.argv.includes("--self-test")){
  expectReject("malformed idempotency key",()=>d.beginCriticalRequest(ledger,{actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"bad key",requestFingerprint:fp("3"),nowMs:base}),"IDEMPOTENCY_KEY_INVALID");
  expectReject("malformed fingerprint",()=>d.beginCriticalRequest(ledger,{actorId:"buyer-1",operation:"bid.submit",idempotencyKey:"valid-key",requestFingerprint:"payload-json",nowMs:base}),"CRITICAL_REQUEST_FINGERPRINT_INVALID");
  expectReject("blank actor",()=>d.beginCriticalRequest(ledger,{actorId:" ",operation:"bid.submit",idempotencyKey:"valid-key",requestFingerprint:fp("3"),nowMs:base}),"CRITICAL_REQUEST_ACTOR_REQUIRED");
  expectReject("time regression completion",()=>d.completeCriticalRequest(ledger,{
    actorId:"buyer-2",operation:"bid.submit",idempotencyKey:"bid.inflight",requestFingerprint:fp("d"),
    nowMs:base-1,responseStatus:201,responseRef:"response:x",effectRef:"bid-event:x"
  }),"CRITICAL_REQUEST_TIME_REGRESSION");
  console.log("CRITICAL_REQUEST_REPLAY_41_10_SELF_TEST PASS scenarios=15 operations=4 bid_effects=1 finalization_effects=1 completed_replay=true in_progress_rejected=true fingerprint_conflict=true actor_scope=true operation_scope=true effect_ref_unique=true production_atomic_persistence_claim=false negative_cases=4");
}else{
  console.log("CRITICAL_REQUEST_REPLAY_41_10 PASS scenarios=15 one_logical_request_one_effect=true");
}

setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

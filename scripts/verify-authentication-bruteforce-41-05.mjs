import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  createRateLimitResponseContract,
  isRateLimitResponseContract,
} from "../packages/contracts/src/http-schema.ts";

const CONFIG_PATH="config/enchev-authentication-bruteforce-41-05.json";
const DOMAIN_PATH="packages/domain/src/authentication-bruteforce.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("AUTHENTICATION_BRUTEFORCE_41_05 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn){
  let rejected=false;
  try{fn();}catch{rejected=true;}
  if(!rejected) fail("negative case accepted: "+label);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-auth-bruteforce-41-05-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"authentication-bruteforce.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.05"||config.title!=="Authentication brute-force test"||config.kind!=="security") fail("task identity drift");
if(config.policy?.algorithm!=="sliding-window-plus-escalating-principal-lockout") fail("algorithm drift");
for(const key of ["principalAndSourceBucketsIndependent","successClearsPrincipalFailures","sourceAttemptsRemainRateLimitedAfterSuccess"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["genericAuthenticationFailure","genericThrottleResponse","accountExistenceNotExposed","bucketReasonNotExposedToClient","perPrincipalDefenseAgainstDistributedGuessing","perSourceDefenseAgainstSprayingAndStuffing","captchaNotRequiredForCertification","mfaNotClaimedByThisTask"]){
  if(config.security?.[key]!==true) fail("security guardrail disabled: "+key);
}
for(const key of ["productionIdentityProviderIntegrationNotClaimed","productionDistributedStoreNotClaimed","adminMfaCertificationNotClaimed","rateLimitBypassCertificationRemains41_11","botBiddingCertificationRemains41_12"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==10) fail("abuse scenario coverage drift");

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
const phase41=source.slice(p41Start,p42Start);
if(!phase41.includes('"Authentication brute-force test||security"')) fail("frozen 41.05 identity missing");

const d=await loadDomain();
const policy=d.validateAuthenticationThrottlePolicy({
  principalLimit:config.policy.principalLimit,
  principalWindowMs:config.policy.principalWindowMs,
  sourceLimit:config.policy.sourceLimit,
  sourceWindowMs:config.policy.sourceWindowMs,
  lockoutBaseMs:config.policy.lockoutBaseMs,
  lockoutMaxMs:config.policy.lockoutMaxMs,
});

let state=d.emptyAuthenticationThrottleState();
const base=Date.parse("2026-10-01T00:00:00Z");

function attempt(principalKey,sourceKey,nowMs,result="failure"){
  const before=d.checkAuthenticationAttempt(state,{principalKey,sourceKey,nowMs},policy);
  if(!before.allowed) return before;
  state=d.recordAuthenticationResult(before.state,{principalKey,sourceKey,nowMs},result,policy);
  return d.checkAuthenticationAttempt(state,{principalKey,sourceKey,nowMs},policy);
}

// 1. targeted brute force: sixth attempt must be blocked after five failures.
state=d.emptyAuthenticationThrottleState();
for(let i=0;i<5;i++){
  const now=base+i*1000;
  const pre=d.checkAuthenticationAttempt(state,{principalKey:"acct-target",sourceKey:"src-a",nowMs:now},policy);
  if(!pre.allowed) fail("targeted brute force blocked before threshold");
  state=d.recordAuthenticationResult(pre.state,{principalKey:"acct-target",sourceKey:"src-a",nowMs:now},"failure",policy);
}
let blocked=d.checkAuthenticationAttempt(state,{principalKey:"acct-target",sourceKey:"src-a",nowMs:base+5000},policy);
if(blocked.allowed||blocked.triggeredBy!=="principal") fail("targeted brute force did not trigger principal defense");

// 2. distributed sources against one account must still hit principal bucket.
state=d.emptyAuthenticationThrottleState();
for(let i=0;i<5;i++){
  const now=base+i*1000;
  const sourceKey="distributed-"+i;
  const pre=d.checkAuthenticationAttempt(state,{principalKey:"acct-distributed",sourceKey,nowMs:now},policy);
  if(!pre.allowed) fail("distributed attack blocked before principal threshold");
  state=d.recordAuthenticationResult(pre.state,{principalKey:"acct-distributed",sourceKey,nowMs:now},"failure",policy);
}
blocked=d.checkAuthenticationAttempt(state,{principalKey:"acct-distributed",sourceKey:"distributed-6",nowMs:base+5000},policy);
if(blocked.allowed||blocked.triggeredBy!=="principal") fail("distributed targeted guessing bypassed principal bucket");

// 3. source spraying many accounts must hit source bucket.
state=d.emptyAuthenticationThrottleState();
for(let i=0;i<20;i++){
  const now=base+i*100;
  const principalKey="spray-acct-"+i;
  const pre=d.checkAuthenticationAttempt(state,{principalKey,sourceKey:"spray-source",nowMs:now},policy);
  if(!pre.allowed) fail("spray blocked before source threshold");
  state=d.recordAuthenticationResult(pre.state,{principalKey,sourceKey:"spray-source",nowMs:now},"failure",policy);
}
blocked=d.checkAuthenticationAttempt(state,{principalKey:"spray-acct-20",sourceKey:"spray-source",nowMs:base+2500},policy);
if(blocked.allowed||blocked.triggeredBy!=="source") fail("password spraying bypassed source bucket");

// 4. successful auth clears principal failures but not source attempts.
state=d.emptyAuthenticationThrottleState();
for(let i=0;i<3;i++){
  const now=base+i*1000;
  const pre=d.checkAuthenticationAttempt(state,{principalKey:"acct-success",sourceKey:"src-success",nowMs:now},policy);
  state=d.recordAuthenticationResult(pre.state,{principalKey:"acct-success",sourceKey:"src-success",nowMs:now},"failure",policy);
}
let pre=d.checkAuthenticationAttempt(state,{principalKey:"acct-success",sourceKey:"src-success",nowMs:base+4000},policy);
if(!pre.allowed) fail("valid success preflight unexpectedly blocked");
state=d.recordAuthenticationResult(pre.state,{principalKey:"acct-success",sourceKey:"src-success",nowMs:base+4000},"success",policy);
const afterSuccess=d.checkAuthenticationAttempt(state,{principalKey:"acct-success",sourceKey:"src-success",nowMs:base+5000},policy);
if(!afterSuccess.allowed||afterSuccess.principalRemaining!==policy.principalLimit) fail("successful auth did not reset principal failures");
if(afterSuccess.sourceRemaining>=policy.sourceLimit) fail("successful auth incorrectly reset source attempt history");

// 5. lockout expires and attempt is allowed after the computed cooloff.
state=d.emptyAuthenticationThrottleState();
for(let i=0;i<5;i++){
  const now=base+i*1000;
  pre=d.checkAuthenticationAttempt(state,{principalKey:"acct-expire",sourceKey:"src-expire-"+i,nowMs:now},policy);
  state=d.recordAuthenticationResult(pre.state,{principalKey:"acct-expire",sourceKey:"src-expire-"+i,nowMs:now},"failure",policy);
}
const duringLock=d.checkAuthenticationAttempt(state,{principalKey:"acct-expire",sourceKey:"src-new",nowMs:base+5000},policy);
if(duringLock.allowed||duringLock.retryAfterSeconds<1) fail("lockout did not block");
const afterLock=d.checkAuthenticationAttempt(state,{principalKey:"acct-expire",sourceKey:"src-new",nowMs:base+policy.lockoutBaseMs+6000},policy);
if(!afterLock.allowed) fail("expired principal lockout did not recover");

// 6. public failure and throttle responses are generic.
const genericFailure=d.publicAuthenticationFailure();
if(genericFailure.code!=="AUTHENTICATION_FAILED"||/user|password|locked|exist/i.test(genericFailure.message)) fail("generic failure leaks account/password state");
const publicThrottle=d.publicAuthenticationThrottle(duringLock,policy);
if(/principal|source|bucket|account|locked/i.test(publicThrottle.message)) fail("throttle response leaks internal bucket/account state");

// 7. canonical 429 response contract for a blocked authentication attempt.
const http429=createRateLimitResponseContract({
  retryAfterSeconds:publicThrottle.retryAfterSeconds,
  limit:publicThrottle.limit,
  remaining:publicThrottle.remaining,
  resetEpochSeconds:Math.floor((base+5000+publicThrottle.retryAfterSeconds*1000)/1000),
  code:publicThrottle.code,
  message:publicThrottle.message,
});
if(!isRateLimitResponseContract(http429)||http429.status!==429) fail("blocked auth response does not satisfy canonical 429 contract");

if(process.argv.includes("--self-test")){
  expectReject("zero principal limit",()=>d.validateAuthenticationThrottlePolicy({...policy,principalLimit:0}));
  expectReject("zero source window",()=>d.validateAuthenticationThrottlePolicy({...policy,sourceWindowMs:0}));
  expectReject("invalid lockout range",()=>d.validateAuthenticationThrottlePolicy({...policy,lockoutBaseMs:60000,lockoutMaxMs:30000}));
  expectReject("blank principal",()=>d.checkAuthenticationAttempt(state,{principalKey:" ",sourceKey:"src",nowMs:base},policy));
  expectReject("blank source",()=>d.checkAuthenticationAttempt(state,{principalKey:"acct",sourceKey:" ",nowMs:base},policy));
  expectReject("public throttle for allowed decision",()=>d.publicAuthenticationThrottle({
    allowed:true,retryAfterSeconds:0,triggeredBy:null,principalRemaining:1,sourceRemaining:1,state:d.emptyAuthenticationThrottleState()
  },policy));
  console.log("AUTHENTICATION_BRUTEFORCE_41_05_SELF_TEST PASS scenarios=10 principal_limit=5 source_limit=20 distributed_guessing_blocked=true password_spraying_blocked=true credential_stuffing_source_guard=true generic_failure=true canonical_429=true production_idp_claim=false negative_cases=6");
}else{
  console.log("AUTHENTICATION_BRUTEFORCE_41_05 PASS scenarios=10 dual_bucket=true generic_failure=true canonical_429=true");
}

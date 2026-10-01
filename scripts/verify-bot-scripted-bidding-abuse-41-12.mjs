import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-bot-scripted-bidding-abuse-41-12.json";
const DOMAIN_PATH="packages/domain/src/bid-abuse-guard.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("BOT_SCRIPTED_BIDDING_ABUSE_41_12 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-bid-abuse-41-12-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const guard=await import(pathToFileURL(path.join(tmp,"bid-abuse-guard.js")).href+"?v="+Date.now());
  const session=await import(pathToFileURL(path.join(tmp,"session-security.js")).href+"?v="+Date.now());
  return {guard,session,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.12"||config.title!=="Bot / scripted bidding abuse test"||config.kind!=="security") fail("task identity drift");
for(const key of ["serverDerivedActorRequired","trustedSourceServerDerived","clientHumanClaimForbidden","activeSessionRequired","buyerFunctionAuthorizationRequired","challengeSingleUse","challengeActorSessionAuctionVersionBound","routeWideHardLimitDelegatedTo41_11","idempotencyReplayDelegatedTo41_10"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionBotDetectionProviderNotClaimed","captchaProviderNotClaimed","deviceFingerprintProviderNotClaimed","productionDistributedAbuseStoreNotClaimed","acceptedBidAuthorityNotClaimed","ssrfCertificationRemains41_13"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==18) fail("abuse scenario coverage drift");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Bot / scripted bidding abuse test||security"')) fail("frozen 41.12 identity missing");

const {guard:d,session:s,tmp}=await loadDomain();
const policy=d.validateBidAbusePolicy({
  actorAuctionLimit:config.policy.actorAuctionLimit,
  actorAuctionWindowMs:config.policy.actorAuctionWindowMs,
  actorFanoutAuctionLimit:config.policy.actorFanoutAuctionLimit,
  actorFanoutWindowMs:config.policy.actorFanoutWindowMs,
  sourceDistinctActorLimit:config.policy.sourceDistinctActorLimit,
  sourceActorWindowMs:config.policy.sourceActorWindowMs,
  regularCadenceSamples:config.policy.regularCadenceSamples,
  regularCadenceToleranceMs:config.policy.regularCadenceToleranceMs,
  challengeTtlMs:config.policy.challengeTtlMs,
  maxHistory:config.policy.maxHistory,
});
const sessionPolicy=s.validateSessionSecurityPolicy({absoluteTtlMs:43200000,idleTimeoutMs:1800000,minSessionIdLength:32});
const base=Date.parse("2026-10-02T00:00:00Z");
const sid=(c)=>c.repeat(32);

let sessionState=s.emptySessionSecurityState();
const buyerSession=s.issueAuthenticatedSession(sessionState,{userId:"buyer-1",nowMs:base,securityVersion:2},sessionPolicy,()=>sid("b")); sessionState=buyerSession.state;
const sellerSession=s.issueAuthenticatedSession(sessionState,{userId:"seller-1",nowMs:base+1,securityVersion:3},sessionPolicy,()=>sid("s")); sessionState=sellerSession.state;

const buyerContext={actorId:"buyer-1",source:"server-session",accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[]};
const sellerContext={actorId:"seller-1",source:"server-session",accountStatus:"active",roles:["seller"],permissions:["seller.autosave-listing"],scopeKeys:[]};

function bid(state,overrides={}){
  return d.authorizeAndRecordBidAttempt(state,{
    actorContext:buyerContext,
    sessionState,
    sessionPolicy,
    sessionId:sid("b"),
    requiredSecurityVersion:2,
    trustedSourceKey:"src-1",
    auctionId:"auction-1",
    nowMs:base+1000,
    ...overrides,
  },policy);
}

// Rapid same-auction script: first four pass, fifth requires challenge.
let state=d.emptyBidAbuseState();
for(let i=0;i<policy.actorAuctionLimit;i++){
  const out=bid(state,{nowMs:base+1000+i*100, trustedSourceKey:"src-"+i});
  if(out.challenged) fail("rapid sequence challenged before threshold");
  state=out.state;
}
expectReject("rapid same-auction script",()=>bid(state,{nowMs:base+2000,trustedSourceKey:"src-new"}),"BID_ABUSE_CHALLENGE_REQUIRED");

// Source rotation does not reset actor-auction behavior.
let sourceRotate=d.emptyBidAbuseState();
for(let i=0;i<policy.actorAuctionLimit;i++){
  sourceRotate=bid(sourceRotate,{nowMs:base+3000+i*100,trustedSourceKey:"rotate-"+i}).state;
}
expectReject("source rotation same actor",()=>bid(sourceRotate,{nowMs:base+4000,trustedSourceKey:"rotate-new"}),"BID_ABUSE_CHALLENGE_REQUIRED");

// Rotating request/idempotency keys is intentionally absent from abuse state; actor behavior still trips.
if(!config.policy.idempotencyReplayDelegatedTo41_10) fail("41.10 composition drift");
expectReject("idempotency key rotation cannot reset behavior",()=>bid(sourceRotate,{nowMs:base+4100,trustedSourceKey:"rotate-next"}),"BID_ABUSE_CHALLENGE_REQUIRED");

// Multi-auction fanout.
let fanout=d.emptyBidAbuseState();
for(let i=0;i<policy.actorFanoutAuctionLimit;i++){
  fanout=bid(fanout,{auctionId:"fanout-"+i,nowMs:base+5000+i*100,trustedSourceKey:"fan-src-"+i}).state;
}
expectReject("multi-auction fanout",()=>bid(fanout,{auctionId:"fanout-new",nowMs:base+6000,trustedSourceKey:"fan-src-new"}),"BID_ABUSE_CHALLENGE_REQUIRED");

// Multi-account same source using direct assessments (identity is server-derived).
let multi=d.emptyBidAbuseState();
for(let i=0;i<policy.sourceDistinctActorLimit;i++){
  const assessment=d.assessBidAbuse(multi,{actorId:"actor-"+i,trustedSourceKey:"shared-source",auctionId:"multi-"+i,nowMs:base+7000+i*100},policy);
  if(!assessment.allowed) fail("multi-account source challenged before threshold");
  multi=Object.freeze({
    attempts:Object.freeze([...assessment.state.attempts,{actorId:"actor-"+i,trustedSourceKey:"shared-source",auctionId:"multi-"+i,atMs:base+7000+i*100}]),
    challenges:assessment.state.challenges,
    lastObservedAtMs:base+7000+i*100,
  });
}
const multiDecision=d.assessBidAbuse(multi,{actorId:"actor-new",trustedSourceKey:"shared-source",auctionId:"multi-new",nowMs:base+8000},policy);
if(multiDecision.allowed||multiDecision.reason!=="source-multi-account") fail("multi-account scripted source not challenged");

// Regular cadence.
let cadence=d.emptyBidAbuseState();
for(let i=0;i<policy.regularCadenceSamples-1;i++){
  cadence=bid(cadence,{auctionId:"cadence-auction",trustedSourceKey:"cadence-"+i,nowMs:base+10000+i*1000}).state;
}
const cadenceDecision=d.assessBidAbuse(cadence,{actorId:"buyer-1",trustedSourceKey:"cadence-last",auctionId:"cadence-auction",nowMs:base+10000+(policy.regularCadenceSamples-1)*1000},policy);
if(cadenceDecision.allowed||cadenceDecision.reason!=="regular-cadence") fail("regular cadence not challenged");

// Same timestamp burst counts independently and trips actor-auction threshold.
let burst=d.emptyBidAbuseState();
for(let i=0;i<policy.actorAuctionLimit;i++){
  burst=bid(burst,{auctionId:"burst-auction",trustedSourceKey:"burst-"+i,nowMs:base+20000}).state;
}
expectReject("same timestamp burst",()=>bid(burst,{auctionId:"burst-auction",trustedSourceKey:"burst-new",nowMs:base+20000}),"BID_ABUSE_CHALLENGE_REQUIRED");

// Client claims are forbidden.
expectReject("client human claim",()=>bid(d.emptyBidAbuseState(),{clientClaimedHuman:true}),"BID_ABUSE_CLIENT_HUMAN_CLAIM_FORBIDDEN");
expectReject("client source claim",()=>bid(d.emptyBidAbuseState(),{clientClaimedSourceKey:"1.2.3.4"}),"BID_ABUSE_CLIENT_SOURCE_CLAIM_FORBIDDEN");

// Prepare suspicious state and bound server-issued challenge.
let suspicious=d.emptyBidAbuseState();
for(let i=0;i<policy.actorAuctionLimit;i++){
  suspicious=bid(suspicious,{nowMs:base+30000+i*100,trustedSourceKey:"challenge-src-"+i}).state;
}
let challengeOut=d.issueBidAbuseChallenge(suspicious,{
  challengeId:"challenge-001",actorId:"buyer-1",sessionId:sid("b"),securityVersion:2,auctionId:"auction-1",issuedAtMs:base+31000
},policy);
suspicious=challengeOut.state;

// Foreign actor/session/auction/security-version challenge misuse.
expectReject("foreign actor challenge",()=>d.authorizeAndRecordBidAttempt(suspicious,{
  actorContext:{...buyerContext,actorId:"buyer-2"},sessionState,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:2,
  trustedSourceKey:"x",auctionId:"auction-1",nowMs:base+31100,challengeId:"challenge-001"
},policy),"SESSION_USER_MISMATCH");
expectReject("foreign session challenge",()=>d.authorizeAndRecordBidAttempt(suspicious,{
  actorContext:buyerContext,sessionState,sessionPolicy,sessionId:sid("s"),requiredSecurityVersion:2,
  trustedSourceKey:"x",auctionId:"auction-1",nowMs:base+31100,challengeId:"challenge-001"
},policy),"SESSION_USER_MISMATCH");
expectReject("cross auction challenge",()=>d.authorizeAndRecordBidAttempt(suspicious,{
  actorContext:buyerContext,sessionState,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:2,
  trustedSourceKey:"x",auctionId:"auction-2",nowMs:base+31100,challengeId:"challenge-001"
},policy),"BID_ABUSE_CHALLENGE_AUCTION_MISMATCH");
expectReject("stale security version challenge",()=>d.authorizeAndRecordBidAttempt(suspicious,{
  actorContext:buyerContext,sessionState,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:1,
  trustedSourceKey:"x",auctionId:"auction-1",nowMs:base+31100,challengeId:"challenge-001"
},policy),"SESSION_SECURITY_VERSION_STALE");

// Expired challenge.
expectReject("expired challenge",()=>d.authorizeAndRecordBidAttempt(suspicious,{
  actorContext:buyerContext,sessionState,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:2,
  trustedSourceKey:"x",auctionId:"auction-1",nowMs:base+31000+policy.challengeTtlMs,challengeId:"challenge-001"
},policy),"BID_ABUSE_CHALLENGE_EXPIRED");

// Valid challenged bid consumes the challenge.
const valid=d.authorizeAndRecordBidAttempt(suspicious,{
  actorContext:buyerContext,sessionState,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:2,
  trustedSourceKey:"challenge-final",auctionId:"auction-1",nowMs:base+31100,challengeId:"challenge-001"
},policy);
if(!valid.challenged||valid.riskReason!=="actor-auction-velocity") fail("valid challenged bid did not consume risk challenge");

// Consumed challenge replay fails.
expectReject("consumed challenge replay",()=>d.authorizeAndRecordBidAttempt(valid.state,{
  actorContext:buyerContext,sessionState,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:2,
  trustedSourceKey:"challenge-replay",auctionId:"auction-1",nowMs:base+31200,challengeId:"challenge-001"
},policy),"BID_ABUSE_CHALLENGE_REPLAY");

// Revoked session cannot bid.
const revoked=s.revokeAuthenticatedSession(sessionState,{sessionId:sid("b"),userId:"buyer-1",nowMs:base+40000});
expectReject("revoked session bid",()=>d.authorizeAndRecordBidAttempt(d.emptyBidAbuseState(),{
  actorContext:buyerContext,sessionState:revoked,sessionPolicy,sessionId:sid("b"),requiredSecurityVersion:2,
  trustedSourceKey:"revoked",auctionId:"auction-1",nowMs:base+40100
},policy),"SESSION_REVOKED");

// Non-buyer cannot bid.
expectReject("non buyer bid",()=>d.authorizeAndRecordBidAttempt(d.emptyBidAbuseState(),{
  actorContext:sellerContext,sessionState,sessionPolicy,sessionId:sid("s"),requiredSecurityVersion:3,
  trustedSourceKey:"seller",auctionId:"auction-1",nowMs:base+41000
},policy),"FUNCTION_AUTH_ROLE_FORBIDDEN");

if(process.argv.includes("--self-test")){
  expectReject("low cadence samples",()=>d.validateBidAbusePolicy({...policy,regularCadenceSamples:2}),"BID_ABUSE_CADENCE_SAMPLES_TOO_LOW");
  expectReject("history below actor limit",()=>d.validateBidAbusePolicy({...policy,maxHistory:1}),"BID_ABUSE_HISTORY_TOO_LOW");
  expectReject("challenge collision",()=>d.issueBidAbuseChallenge(suspicious,{
    challengeId:"challenge-001",actorId:"buyer-1",sessionId:sid("b"),securityVersion:2,auctionId:"auction-1",issuedAtMs:base+31100
  },policy),"BID_ABUSE_CHALLENGE_ID_COLLISION");
  expectReject("client actor claim",()=>bid(d.emptyBidAbuseState(),{clientClaimedActorId:"admin"}),"BID_ABUSE_CLIENT_ACTOR_CLAIM_FORBIDDEN");
  console.log("BOT_SCRIPTED_BIDDING_ABUSE_41_12_SELF_TEST PASS scenarios=18 actor_velocity=true source_rotation_resistant=true multi_auction_fanout=true multi_account_source=true regular_cadence=true same_timestamp_burst=true single_use_challenge=true actor_session_version_auction_bound=true active_session_required=true buyer_authorization_required=true production_bot_provider_claim=false accepted_bid_authority_claim=false negative_cases=4");
}else{
  console.log("BOT_SCRIPTED_BIDDING_ABUSE_41_12 PASS scenarios=18 challenge_enforcement=true production_provider_claim=false");
}
setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

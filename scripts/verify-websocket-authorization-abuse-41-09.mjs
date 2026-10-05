import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-websocket-authorization-abuse-41-09.json";
const DOMAIN_PATH="packages/domain/src/websocket-authorization.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const REALTIME_BOUNDARY_PATH="apps/realtime/boundary.json";
const REALTIME_RUNTIME_PATH="apps/realtime/server.mjs";

function fail(message){throw new Error("WEBSOCKET_AUTHORIZATION_ABUSE_41_09 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-ws-auth-41-09-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const ws=await import(pathToFileURL(path.join(tmp,"websocket-authorization.js")).href+"?v="+Date.now());
  const session=await import(pathToFileURL(path.join(tmp,"session-security.js")).href+"?v="+Date.now());
  return {ws,session,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.09"||config.title!=="WebSocket authorization abuse test"||config.kind!=="security") fail("task identity drift");
for(const key of ["serverUpgradedSocketContextOnly","clientIdentityClaimsForbidden","activeSessionRequiredAtHandshake","activeSessionRecheckedPerRoomAction","grantActorBound","grantSessionBound","grantSecurityVersionBound","grantAuctionBound","grantExpiryRequired","bidActionRequiresBuyerFunctionAuthorization","operateActionRequiresAuctioneerFunctionAuthorization","crossAuctionRoomReuseRejected","staleOrRevokedSessionRejected"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionWebSocketRuntimeNotClaimed","persistentSocketServiceImplementedForLoopbackCertification","networkUpgradeHandlerImplementedForLoopbackCertification","loopbackOnlyUntilProductionAuthorization","phase10HandshakeAndRoomTasksNotMarkedComplete","replayCriticalRequestCertificationRemains41_10"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
for(const key of ["productionSessionAuthorizationIntegrated","productionRoomAuthorizationIntegrated"]){
  if(config.claimBoundary?.[key]!==false) fail("production authorization must remain unclaimed until integrated: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==16) fail("abuse scenario coverage drift");

const boundary=readJson(REALTIME_BOUNDARY_PATH);
if(boundary.implementation_state!=="implemented"||boundary.source_mode!=="runtime") fail("realtime runtime boundary drift");
if(boundary.network_exposure!=="loopback-only") fail("unauthenticated certification runtime must remain loopback-only");
if(boundary.production_session_authorization_integrated!==false) fail("production session authorization claim requires review");

const realtimeRuntime=fs.readFileSync(REALTIME_RUNTIME_PATH,"utf8");
for(const marker of [
  'const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);',
  'if (!loopbackHosts.has(host))',
  'unauthenticated certification runtime must remain loopback-only'
]){
  if(!realtimeRuntime.includes(marker)) fail("loopback safety guard missing: "+marker);
}
if(realtimeRuntime.includes("authorizeWebSocketHandshake(")) fail("production auth integration detected; 41.09 claim boundary requires review");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"WebSocket authorization abuse test||security"')) fail("frozen 41.09 identity missing");

const {ws,session:s,tmp}=await loadDomain();
const base=Date.parse("2026-10-01T10:00:00Z");
const id=(char)=>char.repeat(32);
const sessionPolicy=s.validateSessionSecurityPolicy({absoluteTtlMs:43200000,idleTimeoutMs:1800000,minSessionIdLength:32});

let state=s.emptySessionSecurityState();
const buyer=s.issueAuthenticatedSession(state,{userId:"buyer-1",nowMs:base,securityVersion:2},sessionPolicy,()=>id("b")); state=buyer.state;
const seller=s.issueAuthenticatedSession(state,{userId:"seller-1",nowMs:base+1,securityVersion:3},sessionPolicy,()=>id("s")); state=seller.state;
const auctioneer=s.issueAuthenticatedSession(state,{userId:"auc-1",nowMs:base+2,securityVersion:4},sessionPolicy,()=>id("a")); state=auctioneer.state;

const buyerConn=ws.authorizeWebSocketHandshake({
  sessionState:state,sessionPolicy,connectionId:"conn-buyer",actorId:"buyer-1",sessionId:id("b"),securityVersion:2,
  accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[],connectedAtMs:base+100
});
const sellerConn=ws.authorizeWebSocketHandshake({
  sessionState:state,sessionPolicy,connectionId:"conn-seller",actorId:"seller-1",sessionId:id("s"),securityVersion:3,
  accountStatus:"active",roles:["seller"],permissions:["seller.autosave-listing"],scopeKeys:[],connectedAtMs:base+100
});
const auctioneerConn=ws.authorizeWebSocketHandshake({
  sessionState:state,sessionPolicy,connectionId:"conn-auctioneer",actorId:"auc-1",sessionId:id("a"),securityVersion:4,
  accountStatus:"active",roles:["auctioneer"],permissions:["auctioneer.control-lane"],scopeKeys:["auctioneer.control-lane:auction-1"],connectedAtMs:base+100
});

expectReject("forged actor handshake",()=>ws.authorizeWebSocketHandshake({
  sessionState:state,sessionPolicy,connectionId:"forged-actor",actorId:"buyer-1",sessionId:id("b"),securityVersion:2,
  accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[],connectedAtMs:base+100,clientClaimedActorId:"admin-1"
}),"WS_CLIENT_ACTOR_CLAIM_FORBIDDEN");

expectReject("forged role handshake",()=>ws.authorizeWebSocketHandshake({
  sessionState:state,sessionPolicy,connectionId:"forged-role",actorId:"buyer-1",sessionId:id("b"),securityVersion:2,
  accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[],connectedAtMs:base+100,clientClaimedRoles:["admin"]
}),"WS_CLIENT_ROLE_CLAIM_FORBIDDEN");

expectReject("restricted account handshake",()=>ws.authorizeWebSocketHandshake({
  sessionState:state,sessionPolicy,connectionId:"restricted",actorId:"buyer-1",sessionId:id("b"),securityVersion:2,
  accountStatus:"restricted",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[],connectedAtMs:base+100
}),"WS_ACCOUNT_NOT_ACTIVE");

const revokedState=s.revokeAuthenticatedSession(state,{sessionId:id("b"),userId:"buyer-1",nowMs:base+150});
expectReject("revoked session handshake",()=>ws.authorizeWebSocketHandshake({
  sessionState:revokedState,sessionPolicy,connectionId:"revoked",actorId:"buyer-1",sessionId:id("b"),securityVersion:2,
  accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[],connectedAtMs:base+200
}),"SESSION_REVOKED");

const buyerGrant=ws.issueWebSocketRoomGrant({context:buyerConn,grantId:"grant-buyer-a1",auctionId:"auction-1",actions:["watch","bid"],issuedAtMs:base+200,ttlMs:60000});
if(ws.assertWebSocketRoomAuthorized({sessionState:state,sessionPolicy,context:buyerConn,grant:buyerGrant,auctionId:"auction-1",action:"bid",nowMs:base+300})!==true) fail("valid buyer room bid denied");

const auctioneerGrant=ws.issueWebSocketRoomGrant({context:auctioneerConn,grantId:"grant-auctioneer-a1",auctionId:"auction-1",actions:["watch","operate"],issuedAtMs:base+200,ttlMs:60000});
if(ws.assertWebSocketRoomAuthorized({sessionState:state,sessionPolicy,context:auctioneerConn,grant:auctioneerGrant,auctionId:"auction-1",action:"operate",nowMs:base+300})!==true) fail("valid auctioneer operate denied");

expectReject("foreign actor grant",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:sellerConn,grant:buyerGrant,auctionId:"auction-1",action:"watch",nowMs:base+300
}),"WS_GRANT_ACTOR_MISMATCH");

expectReject("foreign session grant",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:{...buyerConn,sessionId:id("s")},grant:buyerGrant,auctionId:"auction-1",action:"watch",nowMs:base+300
}),"SESSION_USER_MISMATCH");

expectReject("stale security version grant",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:{...buyerConn,securityVersion:1},grant:buyerGrant,auctionId:"auction-1",action:"watch",nowMs:base+300
}),"SESSION_SECURITY_VERSION_STALE");

expectReject("cross auction reuse",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:buyerConn,grant:buyerGrant,auctionId:"auction-2",action:"watch",nowMs:base+300
}),"WS_CROSS_AUCTION_FORBIDDEN");

expectReject("expired grant",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:buyerConn,grant:buyerGrant,auctionId:"auction-1",action:"watch",nowMs:base+60200
}),"WS_GRANT_EXPIRED");

const watchOnly=ws.issueWebSocketRoomGrant({context:buyerConn,grantId:"watch-only",auctionId:"auction-1",actions:["watch"],issuedAtMs:base+200,ttlMs:60000});
expectReject("watch to bid escalation",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:buyerConn,grant:watchOnly,auctionId:"auction-1",action:"bid",nowMs:base+300
}),"WS_ROOM_ACTION_FORBIDDEN");

const sellerBidGrant=ws.issueWebSocketRoomGrant({context:sellerConn,grantId:"seller-bid",auctionId:"auction-1",actions:["bid"],issuedAtMs:base+200,ttlMs:60000});
expectReject("seller uses bid grant",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:sellerConn,grant:sellerBidGrant,auctionId:"auction-1",action:"bid",nowMs:base+300
}),"FUNCTION_AUTH_ROLE_FORBIDDEN");

const buyerOperateGrant=ws.issueWebSocketRoomGrant({context:buyerConn,grantId:"buyer-operate",auctionId:"auction-1",actions:["operate"],issuedAtMs:base+200,ttlMs:60000});
expectReject("buyer uses operate grant",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:buyerConn,grant:buyerOperateGrant,auctionId:"auction-1",action:"operate",nowMs:base+300
}),"FUNCTION_AUTH_ROLE_FORBIDDEN");

const unassignedConn={...auctioneerConn,scopeKeys:[]};
const unassignedGrant=ws.issueWebSocketRoomGrant({context:unassignedConn,grantId:"unassigned-op",auctionId:"auction-1",actions:["operate"],issuedAtMs:base+200,ttlMs:60000});
expectReject("auctioneer without assignment",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:state,sessionPolicy,context:unassignedConn,grant:unassignedGrant,auctionId:"auction-1",action:"operate",nowMs:base+300
}),"FUNCTION_AUTH_SCOPE_FORBIDDEN");

expectReject("revoked stale socket reuse",()=>ws.assertWebSocketRoomAuthorized({
  sessionState:revokedState,sessionPolicy,context:buyerConn,grant:buyerGrant,auctionId:"auction-1",action:"watch",nowMs:base+300
}),"SESSION_REVOKED");

if(process.argv.includes("--self-test")){
  expectReject("duplicate grant action",()=>ws.issueWebSocketRoomGrant({context:buyerConn,grantId:"dup",auctionId:"auction-1",actions:["watch","watch"],issuedAtMs:base+200,ttlMs:60000}),"WS_GRANT_ACTION_DUPLICATE");
  expectReject("zero grant ttl",()=>ws.issueWebSocketRoomGrant({context:buyerConn,grantId:"ttl0",auctionId:"auction-1",actions:["watch"],issuedAtMs:base+200,ttlMs:0}),"WS_GRANT_TTL_INVALID");
  expectReject("grant predates connection",()=>ws.issueWebSocketRoomGrant({context:buyerConn,grantId:"old",auctionId:"auction-1",actions:["watch"],issuedAtMs:base,ttlMs:60000}),"WS_GRANT_PREDATES_CONNECTION");
  expectReject("blank connection",()=>ws.authorizeWebSocketHandshake({
    sessionState:state,sessionPolicy,connectionId:" ",actorId:"buyer-1",sessionId:id("b"),securityVersion:2,
    accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],scopeKeys:[],connectedAtMs:base+100
  }),"WS_CONNECTION_ID_REQUIRED");
  console.log("WEBSOCKET_AUTHORIZATION_ABUSE_41_09_SELF_TEST PASS scenarios=16 server_identity_only=true session_rechecked=true actor_bound=true session_bound=true security_version_bound=true auction_bound=true cross_auction_reuse_rejected=true stale_session_rejected=true bid_function_auth=true operate_assignment_auth=true local_runtime=true loopback_only=true production_auth_integrated=false negative_cases=4");
}else{
  console.log("WEBSOCKET_AUTHORIZATION_ABUSE_41_09 PASS scenarios=16 authorization_contract=true local_runtime=true loopback_only=true production_auth_integrated=false");
}

setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

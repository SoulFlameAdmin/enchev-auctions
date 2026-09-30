import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-session-fixation-revocation-41-06.json";
const DOMAIN_PATH="packages/domain/src/session-security.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("SESSION_FIXATION_REVOCATION_41_06 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-session-41-06-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"session-security.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.06"||config.title!=="Session fixation/revocation test"||config.kind!=="security") fail("task identity drift");
for(const key of ["serverIssuedSessionIdsOnly","rotateOnAuthentication","rotateOnPrivilegeChange","rotateOnPasswordChange","oldSessionInvalidAfterRotation","logoutRevokesPresentedSession","revokeAllSupported","absoluteExpiryFailClosed","idleExpiryFailClosed"]){
  if(config.policy?.[key]!==true) fail("session policy guardrail disabled: "+key);
}
for(const key of ["productionIdentityProviderSessionIntegrationNotClaimed","productionDistributedRevocationStoreNotClaimed","browserCookieEmissionNotClaimed","adminMfaCertificationRemains41_07","privilegeEscalationCertificationRemains41_08"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==12) fail("abuse scenario coverage drift");
if(config.cookie?.name!=="__Host-enchev-session"||config.cookie?.httpOnly!==true||config.cookie?.secure!==true||config.cookie?.sameSite!=="lax"||config.cookie?.path!=="/"||config.cookie?.domain!==null) fail("cookie contract drift");

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
const phase41=source.slice(p41Start,p42Start);
if(!phase41.includes('"Session fixation/revocation test||security"')) fail("frozen 41.06 identity missing");

const d=await loadDomain();
const policy=d.validateSessionSecurityPolicy({
  absoluteTtlMs:config.policy.absoluteTtlMs,
  idleTimeoutMs:config.policy.idleTimeoutMs,
  minSessionIdLength:config.policy.minSessionIdLength,
});
const cookie=d.sessionCookieContract();
if(JSON.stringify(cookie)!==JSON.stringify(config.cookie)) fail("runtime cookie contract drift");

const base=Date.parse("2026-10-01T00:00:00Z");
const id=(char)=>char.repeat(32);

// 1. client-proposed authenticated ID is forbidden.
expectReject("client-chosen fixation",()=>d.issueAuthenticatedSession(
  d.emptySessionSecurityState(),
  {userId:"u1",nowMs:base,securityVersion:1,clientProposedSessionId:id("x")},
  policy,
  ()=>id("a")
),"CLIENT_SESSION_ID_FORBIDDEN");

// 2. authentication creates a server-issued fresh session.
let issued=d.issueAuthenticatedSession(
  d.emptySessionSecurityState(),
  {userId:"u1",nowMs:base,securityVersion:1},
  policy,
  ()=>id("a")
);
if(issued.session.sessionId!==id("a")||issued.session.rotationReason!=="authentication"||issued.session.status!=="active") fail("authenticated session issuance drift");
d.assertAuthenticatedSession(issued.state,{sessionId:id("a"),userId:"u1",nowMs:base+1000,requiredSecurityVersion:1},policy);

// 3. privilege change rotates ID, advances security version and revokes old.
let rotated=d.rotateAuthenticatedSession(issued.state,{
  sessionId:id("a"),userId:"u1",nowMs:base+2000,requiredSecurityVersion:1,newSecurityVersion:2,reason:"privilege-change"
},policy,()=>id("b"));
if(rotated.session.sessionId===rotated.revokedSessionId||rotated.session.sessionId!==id("b")||rotated.session.securityVersion!==2) fail("privilege rotation drift");
expectReject("old replay after privilege rotation",()=>d.assertAuthenticatedSession(rotated.state,{sessionId:id("a"),userId:"u1",nowMs:base+3000,requiredSecurityVersion:1},policy),"SESSION_REVOKED");
d.assertAuthenticatedSession(rotated.state,{sessionId:id("b"),userId:"u1",nowMs:base+3000,requiredSecurityVersion:2},policy);

// 4. password change rotates again.
rotated=d.rotateAuthenticatedSession(rotated.state,{
  sessionId:id("b"),userId:"u1",nowMs:base+4000,requiredSecurityVersion:2,newSecurityVersion:3,reason:"password-change"
},policy,()=>id("c"));
expectReject("old replay after password rotation",()=>d.assertAuthenticatedSession(rotated.state,{sessionId:id("b"),userId:"u1",nowMs:base+5000,requiredSecurityVersion:2},policy),"SESSION_REVOKED");
d.assertAuthenticatedSession(rotated.state,{sessionId:id("c"),userId:"u1",nowMs:base+5000,requiredSecurityVersion:3},policy);

// 5. logout revokes the presented session.
let loggedOut=d.revokeAuthenticatedSession(rotated.state,{sessionId:id("c"),userId:"u1",nowMs:base+6000});
expectReject("logout replay",()=>d.assertAuthenticatedSession(loggedOut,{sessionId:id("c"),userId:"u1",nowMs:base+7000,requiredSecurityVersion:3},policy),"SESSION_REVOKED");

// 6. revoke-all kills every active session for one user without touching another user.
let multi=d.emptySessionSecurityState();
let a1=d.issueAuthenticatedSession(multi,{userId:"u1",nowMs:base,securityVersion:1},policy,()=>id("d")); multi=a1.state;
let a2=d.issueAuthenticatedSession(multi,{userId:"u1",nowMs:base+1,securityVersion:1},policy,()=>id("e")); multi=a2.state;
let b1=d.issueAuthenticatedSession(multi,{userId:"u2",nowMs:base+2,securityVersion:1},policy,()=>id("f")); multi=b1.state;
const revokedAll=d.revokeAllAuthenticatedSessions(multi,{userId:"u1",nowMs:base+8000});
expectReject("revoke-all first replay",()=>d.assertAuthenticatedSession(revokedAll,{sessionId:id("d"),userId:"u1",nowMs:base+9000,requiredSecurityVersion:1},policy),"SESSION_REVOKED");
expectReject("revoke-all second replay",()=>d.assertAuthenticatedSession(revokedAll,{sessionId:id("e"),userId:"u1",nowMs:base+9000,requiredSecurityVersion:1},policy),"SESSION_REVOKED");
d.assertAuthenticatedSession(revokedAll,{sessionId:id("f"),userId:"u2",nowMs:base+9000,requiredSecurityVersion:1},policy);

// 7. cross-user reuse is rejected.
expectReject("cross-user reuse",()=>d.assertAuthenticatedSession(revokedAll,{sessionId:id("f"),userId:"u1",nowMs:base+9000,requiredSecurityVersion:1},policy),"SESSION_USER_MISMATCH");

// 8. stale security version is rejected even for an otherwise active session.
expectReject("security version staleness",()=>d.assertAuthenticatedSession(revokedAll,{sessionId:id("f"),userId:"u2",nowMs:base+9000,requiredSecurityVersion:2},policy),"SESSION_SECURITY_VERSION_STALE");

// 9. idle expiry.
let idle=d.issueAuthenticatedSession(d.emptySessionSecurityState(),{userId:"idle",nowMs:base,securityVersion:1},policy,()=>id("g"));
expectReject("idle timeout",()=>d.assertAuthenticatedSession(idle.state,{sessionId:id("g"),userId:"idle",nowMs:base+policy.idleTimeoutMs,requiredSecurityVersion:1},policy),"SESSION_IDLE_EXPIRED");

// 10. touching an active session advances idle window.
let touched=d.touchAuthenticatedSession(idle.state,{sessionId:id("g"),userId:"idle",nowMs:base+policy.idleTimeoutMs-1000,requiredSecurityVersion:1},policy);
d.assertAuthenticatedSession(touched,{sessionId:id("g"),userId:"idle",nowMs:base+policy.idleTimeoutMs+1000,requiredSecurityVersion:1},policy);

// 11. absolute expiry still wins despite activity.
expectReject("absolute timeout",()=>d.assertAuthenticatedSession(touched,{sessionId:id("g"),userId:"idle",nowMs:base+policy.absoluteTtlMs,requiredSecurityVersion:1},policy),"SESSION_ABSOLUTE_EXPIRED");

// 12. generated ID collision fails closed.
expectReject("session ID collision",()=>d.issueAuthenticatedSession(issued.state,{userId:"u2",nowMs:base+1,securityVersion:1},policy,()=>id("a")),"SESSION_ID_COLLISION");

if(process.argv.includes("--self-test")){
  expectReject("short generated ID",()=>d.issueAuthenticatedSession(d.emptySessionSecurityState(),{userId:"u1",nowMs:base,securityVersion:1},policy,()=>"short"),"SESSION_ID_TOO_SHORT");
  expectReject("weak min ID policy",()=>d.validateSessionSecurityPolicy({...policy,minSessionIdLength:8}),"SESSION_ID_MIN_LENGTH_TOO_LOW");
  expectReject("idle exceeds absolute",()=>d.validateSessionSecurityPolicy({...policy,idleTimeoutMs:policy.absoluteTtlMs+1}),"SESSION_IDLE_EXCEEDS_ABSOLUTE");
  expectReject("privilege rotation without version advance",()=>d.rotateAuthenticatedSession(issued.state,{
    sessionId:id("a"),userId:"u1",nowMs:base+2000,requiredSecurityVersion:1,newSecurityVersion:1,reason:"privilege-change"
  },policy,()=>id("z")),"SESSION_SECURITY_VERSION_NOT_ADVANCED");
  expectReject("foreign logout",()=>d.revokeAuthenticatedSession(b1.state,{sessionId:id("f"),userId:"u1",nowMs:base+10}),"SESSION_USER_MISMATCH");
  console.log("SESSION_FIXATION_REVOCATION_41_06_SELF_TEST PASS scenarios=12 server_issued_only=true auth_rotation=true privilege_rotation=true password_rotation=true old_replay_rejected=true logout_replay_rejected=true revoke_all=true idle_expiry=true absolute_expiry=true cookie_host_only=true production_idp_claim=false negative_cases=5");
}else{
  console.log("SESSION_FIXATION_REVOCATION_41_06 PASS scenarios=12 server_issued_only=true rotation_and_revocation=true");
}

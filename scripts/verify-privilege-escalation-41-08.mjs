import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-privilege-escalation-41-08.json";
const DOMAIN_PATH="packages/domain/src/privilege-escalation.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("PRIVILEGE_ESCALATION_41_08 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-privilege-41-08-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const privilege=await import(pathToFileURL(path.join(tmp,"privilege-escalation.js")).href+"?v="+Date.now());
  const session=await import(pathToFileURL(path.join(tmp,"session-security.js")).href+"?v="+Date.now());
  return {privilege,session,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.08"||config.title!=="Privilege-escalation test"||config.kind!=="security") fail("task identity drift");
for(const key of ["serverSideMutationOnly","adminManageUsersRequired","freshMfaRequired","selfPrivilegeMutationForbidden","targetSecurityVersionCompareAndSwap","securityVersionBumpedOnMutation","targetSessionsRevokedOnMutation","permissionMustBeBackedByRole","unknownRolesAndPermissionsRejected","securityAdminSeparationOfDuties","mfaDoesNotReplaceRolePermissionChecks"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionDirectoryProviderIntegrationNotClaimed","databaseRolePersistenceNotClaimed","securityAdminApprovalWorkflowNotClaimed","websocketAuthorizationCertificationRemains41_09"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==14) fail("abuse scenario coverage drift");

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!source.slice(p41Start,p42Start).includes('"Privilege-escalation test||security"')) fail("frozen 41.08 identity missing");

const {privilege:p,session:s,tmp}=await loadDomain();
const base=Date.parse("2026-10-01T01:00:00Z");
const id=(char)=>char.repeat(32);
const sessionPolicy=s.validateSessionSecurityPolicy({absoluteTtlMs:43200000,idleTimeoutMs:1800000,minSessionIdLength:32});

let state=s.emptySessionSecurityState();
const adminSession=s.issueAuthenticatedSession(state,{userId:"admin-1",nowMs:base,securityVersion:5},sessionPolicy,()=>id("a")); state=adminSession.state;
const buyerSession=s.issueAuthenticatedSession(state,{userId:"buyer-1",nowMs:base+1,securityVersion:2},sessionPolicy,()=>id("b")); state=buyerSession.state;
const sellerSession=s.issueAuthenticatedSession(state,{userId:"seller-1",nowMs:base+2,securityVersion:3},sessionPolicy,()=>id("c")); state=sellerSession.state;
const secSession=s.issueAuthenticatedSession(state,{userId:"root-1",nowMs:base+3,securityVersion:7},sessionPolicy,()=>id("d")); state=secSession.state;

const adminContext={actorId:"admin-1",source:"server-session",accountStatus:"active",roles:["admin"],permissions:["admin.manage-users"],scopeKeys:[]};
const adminMfa={source:"server-verified-provider",actorId:"admin-1",sessionId:id("a"),securityVersion:5,aal:2,verifiedAtMs:base+1000,factors:[
  {factorId:"admin-password",factorClass:"knowledge",verifiedAtMs:base+900},
  {factorId:"admin-totp",factorClass:"possession",verifiedAtMs:base+1000}
]};
const securityAdminContext={actorId:"root-1",source:"server-session",accountStatus:"active",roles:["admin","security-admin"],permissions:["admin.manage-users","security.break-glass"],scopeKeys:[]};
const securityAdminMfa={source:"server-verified-provider",actorId:"root-1",sessionId:id("d"),securityVersion:7,aal:2,verifiedAtMs:base+1000,factors:[
  {factorId:"root-password",factorClass:"knowledge",verifiedAtMs:base+900},
  {factorId:"root-key",factorClass:"possession",verifiedAtMs:base+1000}
]};

const buyer={userId:"buyer-1",accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],securityVersion:2};
const seller={userId:"seller-1",accountStatus:"active",roles:["seller"],permissions:["seller.autosave-listing","seller.lower-reserve"],securityVersion:3};
const other={userId:"user-2",accountStatus:"active",roles:["buyer"],permissions:["buyer.submit-bid"],securityVersion:1};

// Valid admin promotion of another user.
const promoted=p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:state,sessionPolicy,target:buyer,
  request:{targetUserId:"buyer-1",expectedSecurityVersion:2,roles:["buyer","support"],permissions:["buyer.submit-bid","support.manage-case"]},
  nowMs:base+2000
});
if(promoted.target.securityVersion!==3||!promoted.target.roles.includes("support")||promoted.revokedTargetSessions!==true) fail("valid promotion drift");
expectReject("old buyer session after promotion",()=>s.assertAuthenticatedSession(promoted.sessionState,{sessionId:id("b"),userId:"buyer-1",nowMs:base+3000,requiredSecurityVersion:2},sessionPolicy),"SESSION_REVOKED");

// Valid admin demotion also revokes target session.
let sellerState=state;
const demoted=p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:sellerState,sessionPolicy,target:seller,
  request:{targetUserId:"seller-1",expectedSecurityVersion:3,roles:["buyer"],permissions:["buyer.submit-bid"]},
  nowMs:base+2000
});
expectReject("old seller session after demotion",()=>s.assertAuthenticatedSession(demoted.sessionState,{sessionId:id("c"),userId:"seller-1",nowMs:base+3000,requiredSecurityVersion:3},sessionPolicy),"SESSION_REVOKED");

// Self mutation forbidden even for admin.
expectReject("admin self promotion",()=>p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:state,sessionPolicy,target:{userId:"admin-1",accountStatus:"active",roles:["admin"],permissions:["admin.manage-users"],securityVersion:5},
  request:{targetUserId:"admin-1",expectedSecurityVersion:5,roles:["admin","security-admin"],permissions:["admin.manage-users","security.break-glass"]},
  nowMs:base+2000
}),"PRIVILEGE_SELF_MUTATION_FORBIDDEN");

// Ordinary admin cannot grant security-admin.
expectReject("admin grants security-admin",()=>p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["security-admin"],permissions:["security.break-glass"]},
  nowMs:base+2000
}),"PRIVILEGE_SECURITY_ADMIN_SEPARATION_REQUIRED");

// Dual admin + security-admin may grant security privilege to another user.
const securityGrant=p.applyPrivilegeMutation({
  actorContext:securityAdminContext,actorSessionId:id("d"),actorRequiredSecurityVersion:7,actorMfaAssurance:securityAdminMfa,
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["security-admin"],permissions:["security.break-glass"]},
  nowMs:base+2000
});
if(!securityGrant.target.roles.includes("security-admin")||securityGrant.target.securityVersion!==2) fail("security-admin grant drift");

// Role/permission consistency.
expectReject("permission without backed role",()=>p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["buyer"],permissions:["admin.manage-users"]},
  nowMs:base+2000
}),"PRIVILEGE_PERMISSION_NOT_ROLE_BACKED");

// Stale target CAS.
expectReject("stale target version",()=>p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:0,roles:["buyer","support"],permissions:["buyer.submit-bid","support.manage-case"]},
  nowMs:base+2000
}),"PRIVILEGE_TARGET_VERSION_STALE");

// Missing MFA.
expectReject("admin without MFA",()=>p.applyPrivilegeMutation({
  actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:null,
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["buyer","support"],permissions:["buyer.submit-bid","support.manage-case"]},
  nowMs:base+2000
}),"ADMIN_MFA_REQUIRED");

// Client context is rejected by function authorization.
expectReject("client context",()=>p.applyPrivilegeMutation({
  actorContext:{...adminContext,source:"client"},actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["buyer","support"],permissions:["buyer.submit-bid","support.manage-case"]},
  nowMs:base+2000
}),"FUNCTION_AUTH_SERVER_CONTEXT_REQUIRED");

// Non-admin buyer cannot mutate privileges even if it injects admin permission into context.
expectReject("buyer injected admin permission",()=>p.applyPrivilegeMutation({
  actorContext:{actorId:"buyer-1",source:"server-session",accountStatus:"active",roles:["buyer"],permissions:["admin.manage-users"],scopeKeys:[]},
  actorSessionId:id("b"),actorRequiredSecurityVersion:2,actorMfaAssurance:{...adminMfa,actorId:"buyer-1",sessionId:id("b"),securityVersion:2},
  sessionState:state,sessionPolicy,target:other,
  request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["admin"],permissions:["admin.manage-users"]},
  nowMs:base+2000
}),"FUNCTION_AUTH_ROLE_FORBIDDEN");

if(process.argv.includes("--self-test")){
  expectReject("duplicate role",()=>p.applyPrivilegeMutation({
    actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
    sessionState:state,sessionPolicy,target:other,
    request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["buyer","buyer"],permissions:["buyer.submit-bid"]},
    nowMs:base+2000
  }),"PRIVILEGE_DUPLICATE_ROLE");
  expectReject("duplicate permission",()=>p.applyPrivilegeMutation({
    actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
    sessionState:state,sessionPolicy,target:other,
    request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["buyer"],permissions:["buyer.submit-bid","buyer.submit-bid"]},
    nowMs:base+2000
  }),"PRIVILEGE_DUPLICATE_PERMISSION");
  expectReject("empty role set",()=>p.applyPrivilegeMutation({
    actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
    sessionState:state,sessionPolicy,target:other,
    request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:[],permissions:[]},
    nowMs:base+2000
  }),"PRIVILEGE_ROLE_SET_EMPTY");
  expectReject("target mismatch",()=>p.applyPrivilegeMutation({
    actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
    sessionState:state,sessionPolicy,target:other,
    request:{targetUserId:"someone-else",expectedSecurityVersion:1,roles:["buyer"],permissions:["buyer.submit-bid"]},
    nowMs:base+2000
  }),"PRIVILEGE_TARGET_MISMATCH");
  expectReject("noop mutation",()=>p.applyPrivilegeMutation({
    actorContext:adminContext,actorSessionId:id("a"),actorRequiredSecurityVersion:5,actorMfaAssurance:adminMfa,
    sessionState:state,sessionPolicy,target:other,
    request:{targetUserId:"user-2",expectedSecurityVersion:1,roles:["buyer"],permissions:["buyer.submit-bid"]},
    nowMs:base+2000
  }),"PRIVILEGE_NOOP_MUTATION");
  console.log("PRIVILEGE_ESCALATION_41_08_SELF_TEST PASS scenarios=14 self_mutation_blocked=true role_permission_injection_blocked=true stale_target_cas_blocked=true target_sessions_revoked=true security_version_bumped=true security_admin_separation=true mfa_required=true function_auth_required=true accepted_bid_or_winner_mutation=false negative_cases=5");
}else{
  console.log("PRIVILEGE_ESCALATION_41_08 PASS scenarios=14 escalation_guards=true target_session_revocation=true");
}

setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

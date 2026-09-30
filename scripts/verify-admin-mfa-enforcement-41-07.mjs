import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-admin-mfa-enforcement-41-07.json";
const DOMAIN_PATH="packages/domain/src/admin-mfa-enforcement.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("ADMIN_MFA_ENFORCEMENT_41_07 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-admin-mfa-41-07-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[
    tsc,DOMAIN_PATH,
    "--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler",
    "--allowImportingTsExtensions","false","--skipLibCheck","--outDir",tmp,"--pretty","false"
  ],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"admin-mfa-enforcement.js")).href+"?v="+Date.now());
  const session=await import(pathToFileURL(path.join(tmp,"session-security.js")).href+"?v="+Date.now());
  return {mfa:mod,session,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.07"||config.title!=="Admin MFA enforcement test"||config.kind!=="security") fail("task identity drift");
for(const key of ["serverVerifiedAssuranceOnly","sessionBoundAssurance","securityVersionBoundAssurance","freshStepUpRequired","adminAndSecurityAdminProtected","roleAndPermissionChecksStillRequired"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
if(config.policy?.requiredAal!==2||config.policy?.minDistinctFactorClasses!==2||config.policy?.maxStepUpAgeMs!==900000) fail("MFA policy value drift");
for(const key of ["adminWithoutMfaRejected","securityAdminWithoutMfaRejected","aal1Rejected","singleFactorClassRejected","staleMfaRejected","foreignActorAssuranceRejected","foreignSessionAssuranceRejected","staleSecurityVersionRejected","clientAssertedMfaRejected","expiredSessionRejectedBeforeMfa","nonPrivilegedRolesDoNotGainPrivilegeFromMfa"]){
  if(config.protectedBehavior?.[key]!==true) fail("protected behavior disabled: "+key);
}
for(const key of ["productionMfaProviderIntegrationNotClaimed","factorEnrollmentUxNotClaimed","recoveryFlowNotClaimed","phishingResistantMfaNotClaimed","privilegeEscalationCertificationRemains41_08"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==12) fail("abuse scenario coverage drift");

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
const phase41=source.slice(p41Start,p42Start);
if(!phase41.includes('"Admin MFA enforcement test||security"')) fail("frozen 41.07 identity missing");

const {mfa:d,session:s,tmp}=await loadDomain();
const sessionPolicy=s.validateSessionSecurityPolicy({absoluteTtlMs:43200000,idleTimeoutMs:1800000,minSessionIdLength:32});
const mfaPolicy=d.validateAdminMfaPolicy({requiredAal:2,minDistinctFactorClasses:2,maxStepUpAgeMs:900000});
const base=Date.parse("2026-10-01T00:00:00Z");
const sid=(char)=>char.repeat(32);

let issued=s.issueAuthenticatedSession(s.emptySessionSecurityState(),{
  userId:"admin-1",nowMs:base,securityVersion:2
},sessionPolicy,()=>sid("a"));

const adminContext={
  actorId:"admin-1",
  source:"server-session",
  accountStatus:"active",
  roles:["admin"],
  permissions:["admin.manage-users"],
  scopeKeys:[],
};
const adminScope={kind:"global"};
const validMfa={
  source:"server-verified-provider",
  actorId:"admin-1",
  sessionId:sid("a"),
  securityVersion:2,
  aal:2,
  verifiedAtMs:base+1000,
  factors:[
    {factorId:"password-primary",factorClass:"knowledge",verifiedAtMs:base+900},
    {factorId:"totp-device-1",factorClass:"possession",verifiedAtMs:base+1000},
  ],
};

// 1. admin without MFA.
expectReject("admin no MFA",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:null,mfaPolicy
}),"ADMIN_MFA_REQUIRED");

// 2. valid admin two-factor step-up.
if(d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:validMfa,mfaPolicy
})!==true) fail("valid admin MFA denied");

// 3. AAL1.
expectReject("AAL1",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:{...validMfa,aal:1},mfaPolicy
}),"ADMIN_MFA_AAL_INSUFFICIENT");

// 4. same factor class twice.
expectReject("same factor class",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:{...validMfa,factors:[
    {factorId:"totp-a",factorClass:"possession",verifiedAtMs:base+900},
    {factorId:"totp-b",factorClass:"possession",verifiedAtMs:base+1000}
  ]},mfaPolicy
}),"ADMIN_MFA_DISTINCT_FACTOR_CLASSES_INSUFFICIENT");

// 5. stale step-up.
expectReject("stale step-up",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+mfaPolicy.maxStepUpAgeMs+1002,mfaAssurance:validMfa,mfaPolicy
}),"ADMIN_MFA_STEP_UP_STALE");

// 6. foreign actor assurance.
expectReject("foreign actor assurance",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:{...validMfa,actorId:"admin-2"},mfaPolicy
}),"ADMIN_MFA_ACTOR_MISMATCH");

// 7. foreign session assurance.
expectReject("foreign session assurance",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:{...validMfa,sessionId:sid("b")},mfaPolicy
}),"ADMIN_MFA_SESSION_MISMATCH");

// 8. stale security version in assurance.
expectReject("stale MFA security version",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:{...validMfa,securityVersion:1},mfaPolicy
}),"ADMIN_MFA_SECURITY_VERSION_MISMATCH");

// 9. client-asserted MFA.
expectReject("client asserted MFA",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:{...validMfa,source:"client"},mfaPolicy
}),"ADMIN_MFA_SERVER_ASSURANCE_REQUIRED");

// 10. expired session must fail even with otherwise valid MFA.
expectReject("expired session with valid MFA",()=>d.assertMfaProtectedFunctionAuthorized({
  context:adminContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+sessionPolicy.absoluteTtlMs,mfaAssurance:{...validMfa,verifiedAtMs:base+sessionPolicy.absoluteTtlMs-1000,factors:[
    {factorId:"password-primary",factorClass:"knowledge",verifiedAtMs:base+sessionPolicy.absoluteTtlMs-1100},
    {factorId:"totp-device-1",factorClass:"possession",verifiedAtMs:base+sessionPolicy.absoluteTtlMs-1000}
  ]},mfaPolicy
}),"SESSION_ABSOLUTE_EXPIRED");

// 11. MFA cannot grant a missing role/permission.
const buyerContext={
  actorId:"admin-1",
  source:"server-session",
  accountStatus:"active",
  roles:["buyer"],
  permissions:["buyer.submit-bid"],
  scopeKeys:[],
};
expectReject("MFA without admin role/permission",()=>d.assertMfaProtectedFunctionAuthorized({
  context:buyerContext,capability:"admin.manage-users",scope:adminScope,
  sessionState:issued.state,sessionPolicy,sessionId:sid("a"),requiredSecurityVersion:2,
  nowMs:base+2000,mfaAssurance:validMfa,mfaPolicy
}),"FUNCTION_AUTH_ROLE_FORBIDDEN");

// 12. security-admin also requires MFA.
let sec=s.issueAuthenticatedSession(issued.state,{userId:"sec-1",nowMs:base+10,securityVersion:1},sessionPolicy,()=>sid("c"));
const secContext={
  actorId:"sec-1",source:"server-session",accountStatus:"active",
  roles:["security-admin"],permissions:["security.break-glass"],scopeKeys:[]
};
expectReject("security admin no MFA",()=>d.assertMfaProtectedFunctionAuthorized({
  context:secContext,capability:"security.break-glass",scope:adminScope,
  sessionState:sec.state,sessionPolicy,sessionId:sid("c"),requiredSecurityVersion:1,
  nowMs:base+2000,mfaAssurance:null,mfaPolicy
}),"ADMIN_MFA_REQUIRED");

if(process.argv.includes("--self-test")){
  expectReject("invalid AAL policy",()=>d.validateAdminMfaPolicy({...mfaPolicy,requiredAal:1}),"ADMIN_MFA_AAL_MUST_BE_2");
  expectReject("weak distinct factor policy",()=>d.validateAdminMfaPolicy({...mfaPolicy,minDistinctFactorClasses:1}),"ADMIN_MFA_DISTINCT_FACTOR_CLASSES_MUST_BE_2");
  expectReject("future assertion",()=>d.assertAdminMfaAssurance({...validMfa,verifiedAtMs:base+5000},{
    actorId:"admin-1",sessionId:sid("a"),securityVersion:2,sessionIssuedAtMs:base,nowMs:base+2000
  },mfaPolicy),"ADMIN_MFA_VERIFIED_AT_FUTURE");
  expectReject("duplicate factor id",()=>d.assertAdminMfaAssurance({...validMfa,factors:[
    {factorId:"same",factorClass:"knowledge",verifiedAtMs:base+900},
    {factorId:"same",factorClass:"possession",verifiedAtMs:base+1000}
  ]},{
    actorId:"admin-1",sessionId:sid("a"),securityVersion:2,sessionIssuedAtMs:base,nowMs:base+2000
  },mfaPolicy),"ADMIN_MFA_FACTOR_ID_DUPLICATE");
  expectReject("MFA predates session",()=>d.assertAdminMfaAssurance({...validMfa,verifiedAtMs:base-1,factors:[
    {factorId:"p",factorClass:"knowledge",verifiedAtMs:base-2},
    {factorId:"o",factorClass:"possession",verifiedAtMs:base-1}
  ]},{
    actorId:"admin-1",sessionId:sid("a"),securityVersion:2,sessionIssuedAtMs:base,nowMs:base+2000
  },mfaPolicy),"ADMIN_MFA_PREDATES_SESSION");
  console.log("ADMIN_MFA_ENFORCEMENT_41_07_SELF_TEST PASS scenarios=12 aal=2 distinct_factor_classes=2 step_up_max_seconds=900 session_bound=true security_version_bound=true admin_protected=true security_admin_protected=true production_provider_claim=false negative_cases=5");
}else{
  console.log("ADMIN_MFA_ENFORCEMENT_41_07 PASS scenarios=12 aal=2 session_bound=true");
}

setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

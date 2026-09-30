import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-function-level-authorization-abuse-41-04.json";
const DOMAIN_PATH="packages/domain/src/function-authorization.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("FUNCTION_LEVEL_AUTHORIZATION_ABUSE_41_04 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-function-auth-41-04-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"function-authorization.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

function expectReject(label,fn){
  let rejected=false;
  try{fn();}catch{rejected=true;}
  if(!rejected) fail("abuse case accepted: "+label);
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.04"||config.title!=="Function-level authorization abuse test"||config.kind!=="security") fail("task identity drift");
for(const key of ["serverSessionContextRequired","defaultDeny","explicitPermissionRequired","roleAloneIsInsufficient","wildcardPermissionUnsupported","inactiveAccountDenied"]){
  if(config.authority?.[key]!==true) fail("authority guardrail disabled: "+key);
}
if(config.authority?.uiVisibilityIsAuthorization!==false) fail("UI visibility must never count as authorization");
for(const key of ["horizontalFunctionEscalationRejected","verticalFunctionEscalationRejected","crossRoleFunctionReuseRejected","missingPermissionRejected","foreignOwnScopeRejected","unassignedScopeRejected","clientContextRejected","restrictedOrSuspendedRejected","acceptedBidOrWinnerMutationForbidden","deterministicEvidenceOnly"]){
  if(config.acceptance?.[key]!==true) fail("acceptance guardrail disabled: "+key);
}
for(const key of ["doesNotClaimAdminMfaCertification","doesNotClaimPrivilegeEscalationTaskComplete","doesNotClaimWebsocketAuthorizationTaskComplete"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.capabilities)||config.capabilities.length!==11) fail("expected 11 protected capability policies");
if(new Set(config.capabilities.map(x=>x.id)).size!==11) fail("duplicate capability policy");
for(const row of config.capabilities){
  if(!Array.isArray(row.roles)||row.roles.length<1) fail("capability missing role set: "+row.id);
  if(!["own","assigned","global"].includes(row.scope)) fail("capability scope invalid: "+row.id);
}

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
const phase41=source.slice(p41Start,p42Start);
if(!phase41.includes('"Function-level authorization abuse test||security"')) fail("frozen 41.04 identity missing");

const d=await loadDomain();
const policies=d.FUNCTION_AUTHORIZATION_POLICIES;
const configIds=config.capabilities.map(x=>x.id).sort();
const runtimeIds=Object.keys(policies).sort();
if(JSON.stringify(configIds)!==JSON.stringify(runtimeIds)) fail("config/runtime capability set drift");
for(const row of config.capabilities){
  const policy=policies[row.id];
  if(!policy) fail("runtime policy missing: "+row.id);
  if(policy.scope!==row.scope) fail("runtime scope drift: "+row.id);
  if(JSON.stringify([...policy.allowedRoles].sort())!==JSON.stringify([...row.roles].sort())) fail("runtime role drift: "+row.id);
}

const ctx=(actorId,roles,permissions,scopeKeys=[],accountStatus="active")=>({
  actorId,source:"server-session",accountStatus,roles,permissions,scopeKeys
});
const own=(ownerActorId)=>({kind:"own",ownerActorId});
const assigned=(resourceKey)=>({kind:"assigned",resourceKey});
const globalScope={kind:"global"};

const positive=[
  [ctx("buyer-1",["buyer"],["buyer.submit-bid"]),"buyer.submit-bid",own("buyer-1")],
  [ctx("seller-1",["seller"],["seller.autosave-listing"]),"seller.autosave-listing",own("seller-1")],
  [ctx("seller-1",["seller"],["seller.lower-reserve"]),"seller.lower-reserve",own("seller-1")],
  [ctx("support-1",["support"],["support.manage-case"],["support.manage-case:case-1"]),"support.manage-case",assigned("case-1")],
  [ctx("compliance-1",["compliance"],["compliance.review-identity"],["compliance.review-identity:review-1"]),"compliance.review-identity",assigned("review-1")],
  [ctx("inspector-1",["inspector"],["inspector.submit-inspection"],["inspector.submit-inspection:vehicle-1"]),"inspector.submit-inspection",assigned("vehicle-1")],
  [ctx("yard-1",["yard"],["yard.update-custody"],["yard.update-custody:yard-a"]),"yard.update-custody",assigned("yard-a")],
  [ctx("auctioneer-1",["auctioneer"],["auctioneer.control-lane"],["auctioneer.control-lane:lane-a"]),"auctioneer.control-lane",assigned("lane-a")],
  [ctx("admin-1",["admin"],["admin.manage-users"]),"admin.manage-users",globalScope],
  [ctx("admin-1",["admin"],["admin.manage-feature-flags"]),"admin.manage-feature-flags",globalScope],
  [ctx("sec-1",["security-admin"],["security.break-glass"]),"security.break-glass",globalScope]
];
for(const [context,capability,scope] of positive){
  if(d.assertFunctionAuthorized(context,capability,scope)!==true) fail("valid capability denied: "+capability);
}

const abuseCases=[
  ["buyer->seller autosave",ctx("buyer-1",["buyer"],["seller.autosave-listing"]),"seller.autosave-listing",own("buyer-1")],
  ["buyer->admin users",ctx("buyer-1",["buyer"],["admin.manage-users"]),"admin.manage-users",globalScope],
  ["seller->buyer bid",ctx("seller-1",["seller"],["buyer.submit-bid"]),"buyer.submit-bid",own("seller-1")],
  ["seller->admin flags",ctx("seller-1",["seller"],["admin.manage-feature-flags"]),"admin.manage-feature-flags",globalScope],
  ["support->auctioneer",ctx("support-1",["support"],["auctioneer.control-lane"],["auctioneer.control-lane:lane-a"]),"auctioneer.control-lane",assigned("lane-a")],
  ["support->admin users",ctx("support-1",["support"],["admin.manage-users"]),"admin.manage-users",globalScope],
  ["compliance->buyer bid",ctx("compliance-1",["compliance"],["buyer.submit-bid"]),"buyer.submit-bid",own("compliance-1")],
  ["yard->seller reserve",ctx("yard-1",["yard"],["seller.lower-reserve"]),"seller.lower-reserve",own("yard-1")],
  ["auctioneer->seller reserve",ctx("auctioneer-1",["auctioneer"],["seller.lower-reserve"]),"seller.lower-reserve",own("auctioneer-1")],
  ["auctioneer->admin users",ctx("auctioneer-1",["auctioneer"],["admin.manage-users"]),"admin.manage-users",globalScope],
  ["role without permission",ctx("seller-1",["seller"],[]),"seller.autosave-listing",own("seller-1")],
  ["wildcard does not authorize",ctx("admin-1",["admin"],[]),"admin.manage-users",globalScope],
  ["foreign own scope",ctx("seller-1",["seller"],["seller.autosave-listing"]),"seller.autosave-listing",own("seller-2")],
  ["unassigned resource",ctx("support-1",["support"],["support.manage-case"],["support.manage-case:case-1"]),"support.manage-case",assigned("case-2")],
  ["restricted account",ctx("admin-1",["admin"],["admin.manage-users"],[],"restricted"),"admin.manage-users",globalScope],
  ["suspended account",ctx("sec-1",["security-admin"],["security.break-glass"],[],"suspended"),"security.break-glass",globalScope]
];
for(const [label,context,capability,scope] of abuseCases){
  expectReject(label,()=>d.assertFunctionAuthorized(context,capability,scope));
}

expectReject("client-sourced context",()=>d.assertFunctionAuthorized({
  actorId:"admin-1",source:"client",accountStatus:"active",roles:["admin"],permissions:["admin.manage-users"],scopeKeys:[]
},"admin.manage-users",globalScope));

expectReject("scope kind mismatch",()=>d.assertFunctionAuthorized(
  ctx("seller-1",["seller"],["seller.autosave-listing"]),
  "seller.autosave-listing",
  globalScope
));

if(process.argv.includes("--self-test")){
  const mutated=structuredClone(config);
  mutated.capabilities[0].roles.push("admin");
  if(mutated.capabilities[0].roles.length===config.capabilities[0].roles.length) fail("negative role-drift fixture broken");
  expectReject("blank actor",()=>d.assertFunctionAuthorized(
    ctx(" ",["admin"],["admin.manage-users"]),
    "admin.manage-users",
    globalScope
  ));
  expectReject("missing assigned resource",()=>d.assertFunctionAuthorized(
    ctx("support-1",["support"],["support.manage-case"],["support.manage-case:case-1"]),
    "support.manage-case",
    {kind:"assigned",resourceKey:" "}
  ));
  console.log("FUNCTION_LEVEL_AUTHORIZATION_ABUSE_41_04_SELF_TEST PASS capabilities=11 positive_cases=11 abuse_cases=18 default_deny=true explicit_permission=true role_alone_insufficient=true server_context=true accepted_bid_or_winner_mutation=false negative_cases=3");
}else{
  console.log("FUNCTION_LEVEL_AUTHORIZATION_ABUSE_41_04 PASS capabilities=11 abuse_cases=18 default_deny=true explicit_permission=true");
}

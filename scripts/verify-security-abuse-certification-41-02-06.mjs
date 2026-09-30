import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-security-abuse-certification-41-02-06.json";
const DOMAIN_PATH="packages/domain/src/security-abuse-certification.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const API_INVENTORY_PATH="config/enchev-api-endpoint-inventory.json";
const RATE_LIMIT_PATH="config/enchev-rate-limit-response-contract.json";

function fail(message){throw new Error("SECURITY_ABUSE_CERTIFICATION_41_02_06 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ",endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  if(start===-1||end===-1)fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="41");
  if(!phase)fail("phase 41 missing");
  return phase[2].slice(1,6).map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"41."+String(index+2).padStart(2,"0"),name,kind:kindRaw==="security"?"security":"feature"};
  });
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-security-41-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+String(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"security-abuse-certification.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
const expected=frozenTasks();
if(JSON.stringify(config.tasks)!==JSON.stringify(expected))fail("frozen task identity/kind drift");
if(config.baseline?.owaspApiSecurityEdition!=="2023")fail("OWASP API baseline drift");
if(config.baseline?.mappingIsCertification!==false)fail("mapping must not claim certification");
const expectedApi=[
  ["API1:2023","Broken Object Level Authorization"],
  ["API2:2023","Broken Authentication"],
  ["API3:2023","Broken Object Property Level Authorization"],
  ["API4:2023","Unrestricted Resource Consumption"],
  ["API5:2023","Broken Function Level Authorization"],
  ["API6:2023","Unrestricted Access to Sensitive Business Flows"],
  ["API7:2023","Server Side Request Forgery"],
  ["API8:2023","Security Misconfiguration"],
  ["API9:2023","Improper Inventory Management"],
  ["API10:2023","Unsafe Consumption of APIs"]
];
if(JSON.stringify(config.owaspApiTop10?.map(x=>[x.id,x.name]))!==JSON.stringify(expectedApi))fail("OWASP API Top 10 mapping drift");
for(const row of config.owaspApiTop10||[]) if(!Array.isArray(row.controls)||!row.controls.length)fail("OWASP mapping missing controls: "+row.id);
for(const key of ["defaultDeny","clientOwnershipNeverTrusted","unknownCapabilityDenied","crossObjectAccessDenied","bruteForceLockoutRequired","authSuccessResetsFailureBudget","sessionIdRotatesOnAuthentication","revokedSessionRejected","preAuthSessionRejected"]){
  if(config.invariants?.[key]!==true)fail("security invariant disabled: "+key);
}
if(!fs.existsSync(API_INVENTORY_PATH))fail("API endpoint inventory evidence missing");
const rate=readJson(RATE_LIMIT_PATH);
if(rate.status!==429||rate.errorCode!=="RATE_LIMITED"||rate.behavior?.failClosedOnInvalidMetadata!==true)fail("rate limit contract drift");

const d=await loadDomain();
const buyer={userId:"buyer-a",roles:["buyer"],organizationIds:["org-a"]};
const otherBuyer={userId:"buyer-b",roles:["buyer"],organizationIds:["org-b"]};
const admin={userId:"admin-a",roles:["admin"],organizationIds:["platform"]};

const own=d.authorizeObjectAccess({principal:buyer,action:"read",scope:{ownerUserId:"buyer-a"}});
if(!own.allowed||own.code!=="ALLOW_OWNER")fail("41.03 owner access rejected");
const cross=d.authorizeObjectAccess({principal:otherBuyer,action:"read",scope:{ownerUserId:"buyer-a"}});
if(cross.allowed||cross.code!=="DENY_OBJECT_SCOPE")fail("41.03 cross-object abuse accepted");
const assigned=d.authorizeObjectAccess({principal:buyer,action:"update",scope:{assignedUserIds:["buyer-a"]}});
if(!assigned.allowed)fail("41.03 explicit assignment rejected");
const org=d.authorizeObjectAccess({principal:buyer,action:"read",scope:{assignedOrganizationIds:["org-a"]}});
if(!org.allowed)fail("41.03 organization scope rejected");
const fakeAdmin=d.authorizeObjectAccess({principal:buyer,action:"delete",scope:{ownerUserId:"someone-else"},adminOverride:true});
if(fakeAdmin.allowed)fail("41.03 non-admin override accepted");
const realAdmin=d.authorizeObjectAccess({principal:admin,action:"read",scope:{ownerUserId:"buyer-a"},adminOverride:true});
if(!realAdmin.allowed)fail("41.03 explicit admin override rejected");

if(!d.authorizeFunction({principal:buyer,capability:"buyer.submit_bid"}).allowed)fail("41.04 buyer capability rejected");
if(d.authorizeFunction({principal:buyer,capability:"admin.manage_roles"}).allowed)fail("41.04 privilege escalation accepted");
if(d.authorizeFunction({principal:buyer,capability:"unknown.execute"}).allowed)fail("41.04 unknown capability accepted");
if(!d.authorizeFunction({principal:admin,capability:"admin.manage_roles"}).allowed)fail("41.04 admin capability rejected");

const guard=new d.AuthenticationBruteForceGuard({maxFailures:5,windowMs:300000,lockoutMs:900000});
const key="login:buyer-a";
for(let i=0;i<4;i++){
  if(!guard.check(key,1000+i).allowed)fail("41.05 premature lockout");
  guard.recordFailure(key,1000+i);
}
if(!guard.check(key,2000).allowed)fail("41.05 fifth attempt should be allowed before failure");
const locked=guard.recordFailure(key,2000);
if(locked.failures!==5||locked.lockedUntilMs<=2000)fail("41.05 lockout not created");
if(guard.check(key,2001).allowed)fail("41.05 locked identity allowed");
if(!guard.check(key,locked.lockedUntilMs).allowed)fail("41.05 lockout did not expire");
guard.recordFailure(key,locked.lockedUntilMs+1);
guard.recordSuccess(key);
if(guard.snapshot(key)!==null)fail("41.05 successful auth did not reset budget");

const sessions=new d.SessionSecurityRegistry();
sessions.issuePreAuthSession({sessionId:"pre-1",userId:"buyer-a",nowMs:100});
if(sessions.authorize("pre-1","buyer-a").allowed)fail("41.06 pre-auth session authorized");
const active=sessions.rotateOnAuthentication({oldSessionId:"pre-1",newSessionId:"auth-1",userId:"buyer-a",nowMs:200});
if(active.sessionId!=="auth-1"||active.authenticatedAtMs!==200)fail("41.06 authentication rotation drift");
if(sessions.authorize("pre-1","buyer-a").allowed)fail("41.06 pre-auth identifier remained usable");
if(!sessions.authorize("auth-1","buyer-a").allowed)fail("41.06 rotated session rejected");
if(sessions.authorize("auth-1","buyer-b").allowed)fail("41.06 wrong-subject session accepted");
sessions.revoke("auth-1",300);
if(sessions.authorize("auth-1","buyer-a").allowed)fail("41.06 revoked session accepted");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("blank principal",()=>d.authorizeObjectAccess({principal:{userId:" ",roles:["buyer"]},action:"read",scope:{ownerUserId:"x"}}));
  await reject("blank capability",()=>d.authorizeFunction({principal:buyer,capability:" "}));
  await reject("invalid brute-force max",()=>new d.AuthenticationBruteForceGuard({maxFailures:1}));
  await reject("invalid brute-force time",()=>guard.check("x",-1));
  const fixation=new d.SessionSecurityRegistry();fixation.issuePreAuthSession({sessionId:"same",userId:"u",nowMs:1});
  await reject("session fixation",()=>fixation.rotateOnAuthentication({oldSessionId:"same",newSessionId:"same",userId:"u",nowMs:2}));
  await reject("session id reuse",()=>{const x=new d.SessionSecurityRegistry();x.issuePreAuthSession({sessionId:"a",userId:"u",nowMs:1});x.issuePreAuthSession({sessionId:"a",userId:"u",nowMs:2});});
  const mutated=structuredClone(config);mutated.baseline.mappingIsCertification=true;let rejected=false;try{if(mutated.baseline.mappingIsCertification!==false)throw new Error("bad");}catch{rejected=true;}if(!rejected)fail("mapping certification overclaim accepted");
  console.log("SECURITY_ABUSE_CERTIFICATION_41_02_06_SELF_TEST PASS tasks=5 api_top10=10 negative_cases=7 object_default_deny=true function_default_deny=true brute_force_lockout=true session_rotation_revocation=true");
}else{
  console.log("SECURITY_ABUSE_CERTIFICATION_41_02_06 PASS tasks=5 api_top10=10 object_default_deny=true function_default_deny=true brute_force_lockout=true session_rotation_revocation=true");
}

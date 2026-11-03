// D003: release truth for Supabase targets, privileges and staging isolation.
// This is a read-only, secret-free evidence contract; never conflates
// project documentation with proof of a live runtime environment binding.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

export const D003_AUDIT_PATH="config/urgent-D003-db-binding-audit.json";
const sourceJson=path=>JSON.parse(readFileSync(path,"utf8"));
function fail(s){throw new Error("URGENT_D003_DB_BOUNDARY FAIL: "+s)}
const realMoneyRiskGate=["D003-G1","D003-G2","D003-G3","D003-G4"];

function rejectCredentialFields(v,trail="root"){
 if(Array.isArray(v)){v.forEach((x,i)=>rejectCredentialFields(x,trail+"["+i+"]"));return}
 if(!v||typeof v!=="object")return;
 for(const [key,value] of Object.entries(v)){
  if(/^(?:api[_-]?key|service[_-]?role|service[_-]?role[_-]?key|secret|password|access[_-]?token|refresh[_-]?token|authorization|database[_-]?url|connection[_-]?string|credential|jwt)$/i.test(key))fail("sensitive field name in audit "+trail+"."+key);
  if(typeof value==="string" && /(postgres(?:ql)?:\/\/|sb_secret_|sk_live_|-----BEGIN PRIVATE KEY-----)/i.test(value))fail("credential material in audit at "+trail+"."+key);
  rejectCredentialFields(value,trail+"."+key);
 }
}
function project(a,scope){return a.projects.find(x=>x.scope===scope)}
export function verifyD003(a,governance,environment,baseline){
 if(a.schemaVersion!==1||a.task!=="D003"||a.asOf!=="2026-11-03")fail("audit identity drift");
 if(a.auditStatus!=="blocked-pending-provider-evidence")fail("cannot claim D003 completed without new independent evidence");
 if(a.realMoneyAuctionAuthority!==false)fail("real-money authority must remain disabled");
 rejectCredentialFields(a);
 const g=project(a,"development-governance");
 const e=project(a,"auction-demo-and-related-services");
 if(!g||!e||g.id===e.id||a.projects.length!==2)fail("two distinct known project roles required");
 if(g.id!==governance.project_ref||g.name!==governance.project_name||g.source!=="config/enchev-supabase-project.json")fail("governance repository pointer mismatch");
 if(governance.auction_authority!==false||governance.shared_project!==true)fail("existing governance binding is not a production auction source");
 if(g.auctionAuthority!==false||g.connectorAccess!=="denied-permission"||g.liveStatus!=="unverified")fail("do not invent governance project live access");
 if(e.id!=="ejfrnjhlggebzmpmxajl"||e.name!=="enchev-auctions"||e.region!=="eu-central-1")fail("read-only connected project evidence mismatched");
 if(e.auctionAuthority!==false||e.runtimeBindings!=="unverified"||e.developmentBranchesCount!==0)fail("connected demo project is not certified production auction authority");
 if(e.publicTableCount!==28||e.publicTablesWithRlsEnabled!==28||e.migrationsCount!==28)fail("read-only observation baseline drift");
 const rt=a.runtime;
 if(rt.vercelEnvironmentNamesRead!=="denied-403"||rt.decryptedSecretsRead!==false||rt.secretValuesInRepository!==false)fail("Vercel environment access must be accurately classified");
 if(rt.stagingDatabase.verifiedIndependent!==false||rt.stagingDatabase.projectId!==null||rt.stagingDatabase.roleVerified!==false)fail("staging database is not verified");
 if(rt.production.dbBindingVerified!==false||rt.preview.dbBindingVerified!==false)fail("can't assert production/preview DB target verified");
 if(rt.production.dbRoleVerified!==false||rt.preview.dbRoleVerified!==false)fail("must not claim separately scoped roles");
 if(rt.production.projectDbRef!==null||rt.preview.projectDbRef!==null)fail("runtime project ref must not be guessed from source code");
 const model=environment.environments;
 if(model.find(x=>x.name==="staging")?.platform_environment!=="preview")fail("staging config must remain Vercel preview");
 if(model.find(x=>x.name==="production")?.platform_environment!=="production")fail("production mode mismatch");
 if(model.find(x=>x.name==="staging")?.production_authority!==false)fail("preview must never have production authority");
 const d003=baseline.tasks.find(x=>x.id==="D003");
 if(d003?.dependency!=="D002"||!d003.passCriteria.includes("authoritative DB target"))fail("original D003 acceptance/dependency changed");
 if(a.gateChecks.length!==7||new Set(a.gateChecks.map(x=>x.id)).size!==7)fail("D003 gate list inconsistent");
 for(const id of realMoneyRiskGate){const g=a.gateChecks.find(x=>x.id===id);if(!g||g.state==="verified")fail("missing real-world proof cannot become GREEN: "+id)}
 if(a.gateChecks.filter(x=>x.state==="verified").length!==3)fail("partial gate evidence count drift");
 if(a.acceptancePolicy.d003CanBeMarkedDone!==false||a.acceptancePolicy.nextDayD004CanWriteRealStagingFixtures!==false||a.acceptancePolicy.requiresAllGatesVerified!==true)fail("D003 must remain blocked for actual prod/staging integration");
 if(!a.liveReadOnlyFindings.some(x=>x.code==="PUBLIC_SECURITY_DEFINER_GRANTS"))fail("security grants risk must remain visible");
 if(!a.liveReadOnlyFindings.some(x=>x.code==="VERCEL_ENV_METADATA_403"))fail("Vercel metadata blocker must remain visible");
 if(!a.liveReadOnlyFindings.some(x=>x.code==="NO_STAGING_SUPABASE_BRANCH"))fail("staging blocker must remain visible");
 return {task:d003.id,knownProjects:a.projects.length,verifiedGates:3,blockedGates:4,decision:"BLOCKED",safeToEnableRealMoney:false};
}

const governance=sourceJson("config/enchev-supabase-project.json");
const environment=sourceJson("config/enchev-runtime-environments.json");
const baseline=sourceJson("app/data/urgent-119-days.json");
const audit=sourceJson(D003_AUDIT_PATH);
const result=verifyD003(audit,governance,environment,baseline);
console.log("URGENT_D003_DB_BOUNDARY PASS audit=read_only known_projects="+result.knownProjects+" gates_verified="+result.verifiedGates+" gates_blocked="+result.blockedGates+" production_authority=NO-GO");

if(process.argv.includes("--self-test")){
 const clone=()=>structuredClone(audit);
 const reject=(title,mutate)=>{const x=clone();mutate(x);assert.throws(()=>verifyD003(x,governance,environment,baseline),undefined,title)};
 reject("governance substituted for auction DB",x=>{x.projects[1].id=x.projects[0].id});
 reject("fake production binding",x=>{x.runtime.production.dbBindingVerified=true});
 reject("fake preview role",x=>{x.runtime.preview.dbRoleVerified=true});
 reject("missing staging record",x=>{x.runtime.stagingDatabase.verifiedIndependent=true});
 reject("fake green",x=>{x.acceptancePolicy.d003CanBeMarkedDone=true});
 reject("real money auction enabled",x=>{x.realMoneyAuctionAuthority=true});
 reject("live governance access invented",x=>{x.projects[0].liveStatus="ACTIVE_HEALTHY"});
 reject("project pointer mismatch",x=>{x.projects[0].id="wrong"});
 reject("credential field",x=>{x.password="must-not-appear"});
 reject("connection material",x=>{x.runtime.production.projectDbRef="postgresql://example:pw@host/db"});
 reject("lost permission blocker",x=>{x.liveReadOnlyFindings=x.liveReadOnlyFindings.filter(v=>v.code!=="VERCEL_ENV_METADATA_403")});
 reject("staging environment mistaken for production",x=>{x.runtime.preview.dbBindingVerified=true});
 console.log("URGENT_D003_DB_BOUNDARY_SELF_TEST PASS negative_cases=12");
}

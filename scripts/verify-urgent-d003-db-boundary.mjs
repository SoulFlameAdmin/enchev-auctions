// D003: release truth for Supabase targets, privileges and staging isolation.
// This is a read-only, secret-free evidence contract; never conflates
// project documentation with proof of a live runtime environment binding.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

export const D003_AUDIT_PATH="config/urgent-D003-db-binding-audit.json";
const sourceJson=path=>JSON.parse(readFileSync(path,"utf8"));
function fail(s){throw new Error("URGENT_D003_DB_BOUNDARY FAIL: "+s)}
const stillMissingProviderEvidence=["D003-G1","D003-G2","D003-G4"];

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

// Verified acceptance must use reviewed external provider evidence. Never infer
// it from a green build or editable status alone. D003 success does not enable
// real-money bids or payments; those remain governed by separate release gates.
function verifyProviderEvidence(a,governance,environment,baseline){
 const gates=a.gateChecks;
 if(gates.length!==7||new Set(gates.map(x=>x.id)).size!==7||
    !["D003-G1","D003-G2","D003-G3","D003-G4","D003-G5","D003-G6","D003-G7"].every(id=>gates.some(g=>g.id===id&&g.state==="verified")))fail("all seven verified gates required");
 const gov=project(a,"development-governance"), auction=project(a,"auction-demo-and-related-services");
 if(!gov||!auction||a.projects.length!==2||gov.id===auction.id)fail("two distinct audited project identities required");
 if(gov.id!==governance.project_ref||gov.name!==governance.project_name||gov.auctionAuthority!==false||
    governance.auction_authority!==false||gov.liveStatus==="unverified"||
    !["verified-read-only","owner-reviewed-metadata"].includes(gov.connectorAccess))fail("governance access/authority not evidenced");
 if(auction.id!=="ejfrnjhlggebzmpmxajl"||auction.name!=="enchev-auctions"||auction.region!=="eu-central-1")fail("auction DB project identity changed");
 const rt=a.runtime,st=rt.stagingDatabase,p=rt.production,v=rt.preview;
 if(!st.verifiedIndependent||!st.roleVerified||st.noProductionDataCopied!==true||!st.projectId||
    [gov.id,auction.id].includes(st.projectId))fail("separate data-less staging DB required");
 if(p.projectDbRef!==auction.id||v.projectDbRef!==st.projectId||
    p.dbBindingVerified!==true||v.dbBindingVerified!==true||
    p.dbRoleVerified!==true||v.dbRoleVerified!==true||
    !p.dbRoleName||!v.dbRoleName||p.dbRoleName===v.dbRoleName)fail("distinct verified production/preview project and DB roles required");
 if(rt.vercelEnvironmentNamesRead!=="verified-metadata-only"||
    rt.decryptedSecretsRead!==false||rt.secretValuesInRepository!==false)fail("review environment metadata, never decrypt or commit secrets");
 if(environment.environments.find(x=>x.name==="staging")?.production_authority!==false||
    environment.environments.find(x=>x.name==="staging")?.platform_environment!=="preview"||
    environment.environments.find(x=>x.name==="production")?.platform_environment!=="production")fail("environment authority policy drift");
 if(baseline.tasks.find(x=>x.id==="D003")?.passCriteria?.includes("authoritative DB target")!==true)fail("original acceptance criterion changed");
 const proofs=a.providerEvidence;
 if(!proofs||typeof proofs!=="object"||Array.isArray(proofs))fail("provider evidence records missing");
 for(const g of gates){
   const e=proofs[g.id];
   if(!e||e.reviewStatus!=="accepted"||
      typeof e.reviewer!=="string"||e.reviewer.trim().length<2||
      typeof e.checkedAt!=="string"||Number.isNaN(Date.parse(e.checkedAt))||
      typeof e.url!=="string"||!["https://github.com/SoulFlameAdmin/enchev-auctions/","https://vercel.com/","https://supabase.com/"].some(prefix=>e.url.startsWith(prefix)))fail("missing independently reviewed, traceable provider evidence for "+g.id);
 }
 if(a.acceptancePolicy.requiresAllGatesVerified!==true||
    a.acceptancePolicy.d003CanBeMarkedDone!==true||
    a.acceptancePolicy.nextDayD004CanWriteRealStagingFixtures!==true)fail("acceptance policy not justified by provider evidence");
 return {task:"D003",knownProjects:a.projects.length,verifiedGates:7,blockedGates:0,decision:"VERIFIED_FOR_D003",safeToEnableRealMoney:false};
}

export function verifyD003(a,governance,environment,baseline){
 if(a.schemaVersion!==1||a.task!=="D003"||typeof a.asOf!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(a.asOf))fail("audit identity drift");
 if(a.realMoneyAuctionAuthority!==false)fail("real-money authority must remain disabled");
 rejectCredentialFields(a);
 if(a.auditStatus==="verified-with-provider-evidence")return verifyProviderEvidence(a,governance,environment,baseline);
 if(a.auditStatus!=="blocked-pending-provider-evidence")fail("unsupported evidence status");
 const g=project(a,"development-governance");
 const e=project(a,"auction-demo-and-related-services");
 if(!g||!e||g.id===e.id||a.projects.length!==2)fail("two distinct known project roles required");
 if(g.id!==governance.project_ref||g.name!==governance.project_name||g.source!=="config/enchev-supabase-project.json")fail("governance repository pointer mismatch");
 if(governance.auction_authority!==false||governance.shared_project!==true)fail("existing governance binding is not a production auction source");
 if(g.auctionAuthority!==false||g.connectorAccess!=="denied-permission"||g.liveStatus!=="unverified")fail("do not invent governance project live access");
 if(e.id!=="ejfrnjhlggebzmpmxajl"||e.name!=="enchev-auctions"||e.region!=="eu-central-1")fail("read-only connected project evidence mismatched");
 if(e.auctionAuthority!==false||e.runtimeBindings!=="unverified"||e.developmentBranchesCount!==1)fail("connected main project has one independently verified staging branch, no real-money certification");
 if(e.publicTableCount!==28||e.publicTablesWithRlsEnabled!==28||e.migrationsCount!==28)fail("read-only observation baseline drift");
 const rt=a.runtime;
 if(rt.vercelEnvironmentNamesRead!=="denied-403"||rt.decryptedSecretsRead!==false||rt.secretValuesInRepository!==false)fail("Vercel environment access must be accurately classified");
 const st=rt.stagingDatabase;
 if(st.verifiedIndependent!==true||st.projectId!=="jranctnafndbqzrwcwos"||st.parentProjectId!==e.id||
    st.branchId!=="248ecd54-771a-4830-a7ab-4a29cb81bb32"||st.branchName!=="enchev-staging"||
    st.branchStatus!=="FUNCTIONS_DEPLOYED"||st.roleVerified!==false||
    st.noProductionDataCopied!==true||st.withData!==false||typeof st.persistent!=="boolean"||
    st.publicTables!==28||st.publicTablesWithRlsEnabled!==28||
    st.parentAppliedMigrations!==28||st.stagingAppliedMigrations!==29||
    st.recoveryMigration!=="d003_staging_restore_missing_calendar_rpc_baseline"||
    Object.values(st.syntheticAuctionRowCounts||{}).length!==4||
    !Object.values(st.syntheticAuctionRowCounts).every(x=>x===0))fail("staging isolation, migration repair, or synthetic-only baseline not verified");
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
 for(const id of stillMissingProviderEvidence){const g=a.gateChecks.find(x=>x.id===id);if(!g||g.state==="verified")fail("missing real-world proof cannot become GREEN: "+id)}
 if(a.gateChecks.find(x=>x.id==="D003-G3")?.state!=="verified")fail("independent staging branch confirmed and must remain correctly classified");
 if(a.gateChecks.filter(x=>x.state==="verified").length!==4)fail("partial gate evidence count drift");
 if(a.acceptancePolicy.d003CanBeMarkedDone!==false||a.acceptancePolicy.nextDayD004CanWriteRealStagingFixtures!==false||a.acceptancePolicy.requiresAllGatesVerified!==true)fail("D003 must remain blocked for actual prod/staging integration");
 if(!a.liveReadOnlyFindings.some(x=>x.code==="PUBLIC_SECURITY_DEFINER_GRANTS"))fail("security grants risk must remain visible");
 if(!a.liveReadOnlyFindings.some(x=>x.code==="VERCEL_ENV_METADATA_403"))fail("Vercel metadata blocker must remain visible");
 if(!a.liveReadOnlyFindings.some(x=>x.code==="STAGING_BRANCH_CREATED_WITH_SCHEMA_REPAIR"))fail("staging repair evidence must remain visible");
 return {task:d003.id,knownProjects:a.projects.length,verifiedGates:4,blockedGates:3,decision:"BLOCKED",safeToEnableRealMoney:false};
}

const governance=sourceJson("config/enchev-supabase-project.json");
const environment=sourceJson("config/enchev-runtime-environments.json");
const baseline=sourceJson("app/data/urgent-119-days.json");
const audit=sourceJson(D003_AUDIT_PATH);
const result=verifyD003(audit,governance,environment,baseline);
const dashboard=readFileSync("app/components/UrgentPlan119.tsx","utf8");
for(const marker of ["auditedD003:Entry={status:\"blocked\"","dbAudit.acceptancePolicy.d003CanBeMarkedDone","task.id===\"D003\"","d003CanBeMarkedDone&&status===\"done\""]){
 if(!dashboard.includes(marker))fail("D003 UI gate missing: "+marker);
}
console.log("URGENT_D003_DB_BOUNDARY PASS audit=read_only known_projects="+result.knownProjects+" gates_verified="+result.verifiedGates+" gates_blocked="+result.blockedGates+" production_authority=NO-GO");

if(process.argv.includes("--self-test")){
 const clone=()=>structuredClone(audit);
 const reject=(title,mutate)=>{const x=clone();mutate(x);assert.throws(()=>verifyD003(x,governance,environment,baseline),undefined,title)};
 reject("governance substituted for auction DB",x=>{x.projects[1].id=x.projects[0].id});
 reject("fake production binding",x=>{x.runtime.production.dbBindingVerified=true});
 reject("fake preview role",x=>{x.runtime.preview.dbRoleVerified=true});
 reject("missing staging record",x=>{x.runtime.stagingDatabase.verifiedIndependent=false});
 reject("fake green",x=>{x.acceptancePolicy.d003CanBeMarkedDone=true});
 reject("fabricated provider-ready audit without receipts",x=>{x.auditStatus="verified-with-provider-evidence";x.acceptancePolicy.d003CanBeMarkedDone=true});
 reject("real money auction enabled",x=>{x.realMoneyAuctionAuthority=true});
 reject("live governance access invented",x=>{x.projects[0].liveStatus="ACTIVE_HEALTHY"});
 reject("project pointer mismatch",x=>{x.projects[0].id="wrong"});
 reject("credential field",x=>{x.password="must-not-appear"});
 reject("connection material",x=>{x.runtime.production.projectDbRef=["postgresql:", "//", "invalid.example"].join("")});
 reject("lost permission blocker",x=>{x.liveReadOnlyFindings=x.liveReadOnlyFindings.filter(v=>v.code!=="VERCEL_ENV_METADATA_403")});
 reject("staging environment mistaken for production",x=>{x.runtime.preview.dbBindingVerified=true});
 reject("fake isolated staging data",x=>{x.runtime.stagingDatabase.noProductionDataCopied=false});
 reject("staging accidentally production",x=>{x.runtime.stagingDatabase.projectId=x.projects[1].id});
 reject("unverified migration repair",x=>{x.runtime.stagingDatabase.stagingAppliedMigrations=28});
 reject("staging gate downgraded",x=>{x.gateChecks.find(g=>g.id==="D003-G3").state="unverified"});
 console.log("URGENT_D003_DB_BOUNDARY_SELF_TEST PASS negative_cases=17");
}

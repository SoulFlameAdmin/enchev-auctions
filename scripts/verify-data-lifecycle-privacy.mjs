import fs from "node:fs";
import {
  anonymizeDirectIdentifiers,
  buildSubjectExportBundle,
  canDeleteSubjectData,
  createSensitiveAccessEvent,
  redactForLog,
} from "../packages/domain/src/data-lifecycle.ts";

const CONFIG_PATH="config/enchev-data-lifecycle-privacy.json";
const CLASSIFICATION_PATH="docs/00_07_DATA_CLASSIFICATION_MODEL.md";
const RESIDENCY_PATH="config/enchev-regional-data-residency-review.json";
const DOMAIN_PATH="packages/domain/src/data-lifecycle.ts";
const DOMAIN_INDEX_PATH="packages/domain/src/index.ts";

function fail(message){throw new Error(`DATA_LIFECYCLE_PRIVACY FAIL: ${message}`);}
function equal(actual,expected,label){
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function expectThrow(label,fn){
  let rejected=false;
  try{fn();}catch{rejected=true;}
  if(!rejected)fail(`negative runtime case not rejected: ${label}`);
}

export function validateConfig(config,classification,residency,domainSource,indexSource){
  if(config?.phaseId!=="29")fail("phaseId must be 29");
  if(config?.phaseName!=="Data lifecycle & privacy engineering")fail("phase name mismatch");
  if(config.legalConclusion!==false||config.privacyComplianceApproved!==false)fail("legal/privacy approval must not be claimed");
  if(config.authoritativeReference!==CLASSIFICATION_PATH)fail("00.07 classification reference drift");

  const expectedIds=Array.from({length:12},(_,i)=>`29.${String(i+1).padStart(2,"0")}`);
  equal((config.tasks||[]).map(x=>x.id),expectedIds,"frozen Phase 29 task registry");

  const backupTask=config.tasks.find(x=>x.id==="29.08");
  if(!backupTask||backupTask.greenEligible!==false||!backupTask.blocker)fail("29.08 must remain fail-closed pending production backup evidence");

  for(const dc of ["DC-0","DC-1","DC-2","DC-3"]){
    if(!classification.includes(`### ${dc}`))fail(`00.07 classification source missing ${dc}`);
    if(!(config.dataFamilies||[]).some(f=>String(f.sensitivity).includes(dc)))fail(`system inventory missing ${dc}`);
    if(!config.retention?.[dc])fail(`retention policy missing ${dc}`);
  }
  for(const authority of ["A0","A1","A2","A3","A4"]){
    if(!classification.includes(`### ${authority}`))fail(`00.07 authority source missing ${authority}`);
    if(!(config.dataFamilies||[]).some(f=>(f.authority||[]).includes(authority)))fail(`system inventory missing authority ${authority}`);
  }

  for(const family of config.dataFamilies||[]){
    if(!family.id||!family.sensitivity||!Array.isArray(family.authority)||family.authority.length===0)fail("29.01 incomplete data family");
    if(!Array.isArray(family.systems)||family.systems.length===0)fail(`29.01 systems missing for ${family.id}`);
    if(!Array.isArray(family.minimumFields)||family.minimumFields.length===0)fail(`29.03 minimum fields missing for ${family.id}`);
    if(!Array.isArray(family.prohibitedFields)||family.prohibitedFields.length===0)fail(`29.03 prohibited fields missing for ${family.id}`);
  }

  if(config.retention["DC-1"].defaultDays!==90)fail("29.04 bounded internal retention drift");
  if(config.retention["DC-2"].legalOverrideRequiredForLongerRetention!==true)fail("29.04 DC-2 extended retention must require legal profile");
  if(config.retention["DC-3"].secretValuesUseCredentialExpiry!==true)fail("29.04 secrets must follow credential expiry");

  if(!config.deletionAndAnonymization?.rules?.some(x=>x.includes("immutable A0")))fail("29.05 immutable A0 preservation rule missing");
  if(!config.deletionAndAnonymization?.preserveWhenRequired?.includes("legal_hold_reference"))fail("29.05 legal-hold preservation missing");

  const exportFlow=config.exportWorkflow;
  equal(exportFlow.states,["requested","identity-verified","collecting","reviewed","ready","delivered","expired","rejected"],"29.06 export states");
  if(exportFlow.requiresVerifiedSubject!==true||exportFlow.exportOnlySubjectScopedData!==true)fail("29.06 export scope guard missing");
  for(const excluded of ["credentials","password_hashes","provider_secrets","other_subject_data","internal_security_secrets"]){
    if(!exportFlow.exclude.includes(excluded))fail(`29.06 export exclusion missing ${excluded}`);
  }

  const hold=config.legalHold;
  if(hold.blocksDeletionWhileActive!==true||hold.requiresReason!==true||hold.requiresActor!==true||hold.requiresTimestamp!==true)fail("29.07 legal hold audit/deletion rules incomplete");
  if(hold.doesNotPermitExtraCollection!==true)fail("29.07 legal hold must not authorize extra collection");

  if(config.backupAlignment?.productionAuthoritativeProviderVerified!==false||config.backupAlignment?.greenEligible!==false)fail("29.08 backup alignment must remain unverified");
  if(!Array.isArray(config.backupAlignment.requirements)||config.backupAlignment.requirements.length<3)fail("29.08 backup alignment requirements incomplete");

  if(config.objectStorageLifecycle?.providerBound!==false)fail("29.09 provider must not be fabricated");
  if(config.objectStorageLifecycle?.orphanCleanupRequired!==true||config.objectStorageLifecycle?.legalHoldOverridesDeletion!==true)fail("29.09 object lifecycle safety incomplete");
  for(const cls of ["public-media","private-documents","inspection-evidence"]){
    if(!config.objectStorageLifecycle.classes?.[cls])fail(`29.09 object class missing ${cls}`);
  }

  for(const key of ["password","token","secret","authorization","cookie","private_max_bid"]){
    if(!config.logRedaction?.keyPatterns?.includes(key))fail(`29.10 redaction key missing ${key}`);
  }
  if(config.logRedaction?.replacement!=="[REDACTED]"||config.logRedaction?.maxDepth!==8)fail("29.10 redaction guard drift");

  const access=config.sensitiveAccessLogging;
  for(const field of ["event_id","occurred_at","actor_id","subject_id","resource_type","resource_id","purpose","sensitivity","action","outcome","correlation_id"]){
    if(!access.requiredFields.includes(field))fail(`29.11 access log required field missing ${field}`);
  }
  for(const field of ["raw_value","document_body","password","token","secret","private_max_bid"]){
    if(!access.forbiddenFields.includes(field))fail(`29.11 forbidden access-log field missing ${field}`);
  }
  if(access.appendOnlyIntent!==true)fail("29.11 access event must be append-only intent");

  if(!Array.isArray(config.crossBorderFlows)||config.crossBorderFlows.length<5)fail("29.12 data-flow inventory incomplete");
  if(config.crossBorderFlows.some(flow=>flow.persistentResidencyClaim!==false))fail("29.12 cross-border flow must not claim residency compliance");
  if(residency.residency_compliance_approved!==false||residency.market_activation_approval!==false)fail("29.12 must preserve 21.14 no-compliance boundary");

  for(const key of Object.keys(config.greenRules||{})){
    if(config.greenRules[key]!==true)fail(`GREEN rule disabled: ${key}`);
  }

  for(const fn of ["redactForLog","anonymizeDirectIdentifiers","createSensitiveAccessEvent","buildSubjectExportBundle","canDeleteSubjectData"]){
    if(!domainSource.includes(`function ${fn}`))fail(`domain helper missing ${fn}`);
  }
  if(!indexSource.includes('export * from "./data-lifecycle";'))fail("domain public export missing");

  return {tasks:12,greenEligibleTasks:11,dataFamilies:config.dataFamilies.length,crossBorderFlows:config.crossBorderFlows.length};
}

function validateRuntimeHelpers(){
  const redacted=redactForLog({
    email:"buyer@example.com",
    nested:{password:"secret",authorization:"Bearer abc.def.ghi",safe:"ok"},
    list:[{api_key:"123"},{message:"Contact seller@example.com"}],
  });
  const serialized=JSON.stringify(redacted);
  if(serialized.includes("buyer@example.com")||serialized.includes("seller@example.com")||serialized.includes('"secret"')||serialized.includes("abc.def.ghi")||serialized.includes('"123"')){
    fail("29.10 runtime redaction leaked sensitive sample data");
  }
  if(!serialized.includes("[REDACTED]"))fail("29.10 runtime redaction produced no redaction markers");

  const anonymized=anonymizeDirectIdentifiers({name:"Buyer",email:"buyer@example.com",lot_id:"EA-1"});
  if(anonymized.name!=="[ANONYMIZED]"||anonymized.email!=="[ANONYMIZED]"||anonymized.lot_id!=="EA-1")fail("29.05 anonymization helper drift");

  const event=createSensitiveAccessEvent({
    event_id:"evt-1",occurred_at:"2026-09-25T00:00:00.000Z",actor_id:"actor-1",subject_id:"subject-1",
    resource_type:"support-case",resource_id:"case-1",purpose:"support-review",sensitivity:"DC-2",
    action:"read",outcome:"allowed",correlation_id:"corr-1",
  });
  if(event.sensitivity!=="DC-2"||event.outcome!=="allowed")fail("29.11 access event helper drift");
  expectThrow("empty access actor",()=>createSensitiveAccessEvent({...event,actor_id:""}));

  const bundle=buildSubjectExportBundle({
    subjectId:"subject-1",identityVerified:true,generatedAt:"2026-09-25T00:00:00.000Z",
    records:[
      {source:"profile",subject_id:"subject-1",sensitivity:"DC-2",data:{name:"Buyer"}},
      {source:"watchlist",subject_id:"subject-1",sensitivity:"DC-1",data:{lot_id:"EA-1"}},
    ],
  });
  equal(bundle.sources,["profile","watchlist"],"29.06 export provenance");
  if(bundle.records.length!==2)fail("29.06 export record count drift");
  expectThrow("unverified export",()=>buildSubjectExportBundle({subjectId:"subject-1",identityVerified:false,generatedAt:"x",records:[]}));
  expectThrow("cross-subject export",()=>buildSubjectExportBundle({
    subjectId:"subject-1",identityVerified:true,generatedAt:"x",
    records:[{source:"profile",subject_id:"subject-2",sensitivity:"DC-2",data:{name:"Other"}}],
  }));

  if(canDeleteSubjectData({legalHoldActive:true,immutableAuthorityRequired:false})!=="blocked-by-legal-hold")fail("29.07 legal hold delete guard drift");
  if(canDeleteSubjectData({legalHoldActive:false,immutableAuthorityRequired:true})!=="anonymize")fail("29.05 immutable authority anonymization guard drift");
  if(canDeleteSubjectData({legalHoldActive:false,immutableAuthorityRequired:false})!=="delete")fail("29.05 ordinary deletion decision drift");
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const classification=fs.readFileSync(CLASSIFICATION_PATH,"utf8");
const residency=JSON.parse(fs.readFileSync(RESIDENCY_PATH,"utf8"));
const domainSource=fs.readFileSync(DOMAIN_PATH,"utf8");
const indexSource=fs.readFileSync(DOMAIN_INDEX_PATH,"utf8");
const result=validateConfig(config,classification,residency,domainSource,indexSource);
validateRuntimeHelpers();

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{
    const candidate=structuredClone(config);
    mutate(candidate);
    let rejected=false;
    try{validateConfig(candidate,classification,residency,domainSource,indexSource);}catch{rejected=true;}
    if(!rejected)fail(`negative self-test not rejected: ${label}`);
    cases+=1;
  };
  reject("drop task",c=>{c.tasks.pop();});
  reject("approve privacy compliance",c=>{c.privacyComplianceApproved=true;});
  reject("remove DC-3 family",c=>{c.dataFamilies=c.dataFamilies.filter(f=>!String(f.sensitivity).includes("DC-3"));});
  reject("remove minimization",c=>{c.dataFamilies[0].minimumFields=[];});
  reject("allow unverified export",c=>{c.exportWorkflow.requiresVerifiedSubject=false;});
  reject("legal hold no longer blocks deletion",c=>{c.legalHold.blocksDeletionWhileActive=false;});
  reject("fake backup readiness",c=>{c.backupAlignment.productionAuthoritativeProviderVerified=true;});
  reject("claim cross-border residency",c=>{c.crossBorderFlows[0].persistentResidencyClaim=true;});
  console.log(`DATA_LIFECYCLE_PRIVACY_SELF_TEST PASS cases=${cases} tasks=${result.tasks} green_eligible=${result.greenEligibleTasks}`);
}else{
  console.log(`DATA_LIFECYCLE_PRIVACY PASS phase=29 tasks=${result.tasks} green_eligible=${result.greenEligibleTasks} yellow=29.08 data_families=${result.dataFamilies} flows=${result.crossBorderFlows}`);
}

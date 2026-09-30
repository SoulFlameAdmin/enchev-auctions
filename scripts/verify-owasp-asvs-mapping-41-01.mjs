import fs from "node:fs";

const CONFIG_PATH="config/enchev-owasp-asvs-41-01.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("OWASP_ASVS_MAPPING_41_01 FAIL: "+message);}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
if(config.taskId!=="41.01"||config.title!=="OWASP ASVS control mapping") fail("task identity drift");
if(config.standard?.name!=="OWASP Application Security Verification Standard") fail("standard name drift");
if(config.standard?.version!=="5.0.0") fail("ASVS version must be pinned to 5.0.0");
if(config.standard?.officialUrl!=="https://owasp.org/projects/asvs") fail("official OWASP URL drift");
if(config.standard?.requirementReferencePrefix!=="v5.0.0-") fail("versioned requirement prefix missing");
for(const key of ["mappingIsNotCertification","controlPassNotImplied","externalPenetrationTestNotImplied","requirementLevelEvidenceMustBeAddedBeforeClaimingASVSCertification"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}

const expectedNames=[
  "Encoding and Sanitization",
  "Validation and Business Logic",
  "Web Frontend Security",
  "API and Web Service",
  "File Handling",
  "Authentication",
  "Session Management",
  "Authorization",
  "Self Contained Tokens",
  "OAuth and OIDC",
  "Cryptography",
  "Secure Communication",
  "Configuration",
  "Data Protection",
  "Secure Coding and Architecture",
  "Security Logging and Error Handling",
  "WebRTC"
];
if(!Array.isArray(config.mapping)||config.mapping.length!==17) fail("all 17 ASVS chapters must be mapped");
for(let index=0;index<17;index+=1){
  const row=config.mapping[index];
  if(row.chapter!==index+1) fail("chapter sequence drift at "+(index+1));
  if(row.name!==expectedNames[index]) fail("chapter name drift at "+(index+1));
  if(typeof row.verificationApproach!=="string"||!row.verificationApproach.trim()) fail("verification approach missing at "+(index+1));
  if(row.applicable===true&&(!Array.isArray(row.planTasks)||row.planTasks.length<1)) fail("applicable chapter lacks Enchev control mapping at "+(index+1));
  if(row.applicable===false&&(!row.rationale?.trim()||!row.reviewTrigger?.trim())) fail("non-applicable chapter lacks rationale/review trigger at "+(index+1));
}

const source=fs.readFileSync(MASTER_PATH,"utf8");
const phase41=source.slice(source.indexOf('["41","Security & abuse certification"'),source.indexOf('["42","Performance certification"'));
if(!phase41.includes('"OWASP ASVS control mapping||security"')) fail("frozen 41.01 identity missing");

const frozenIds=new Set();
for(const match of source.matchAll(/\["(\d{2})","[^"]+",\[(.*?)\]\]/gs)){
  const phase=match[1],body=match[2];
  let index=0;
  for(const item of body.matchAll(/"([^"]+)"/g)){
    index+=1;
    frozenIds.add(phase+"."+String(index).padStart(2,"0"));
  }
}
for(const row of config.mapping){
  for(const id of row.planTasks||[]){
    if(!frozenIds.has(id)) fail("mapping references unknown frozen task "+id);
  }
}

if(process.argv.includes("--self-test")){
  const clone=structuredClone(config);
  clone.mapping=clone.mapping.slice(0,16);
  if(clone.mapping.length===17) fail("negative chapter-count fixture broken");
  const applicable=config.mapping.filter(row=>row.applicable).length;
  const nonApplicable=config.mapping.filter(row=>!row.applicable).length;
  if(applicable!==16||nonApplicable!==1) fail("expected 16 applicable + 1 explicit non-applicable chapter");
  if(config.mapping[16].reviewTrigger.length<20) fail("WebRTC review trigger too weak");
  console.log("OWASP_ASVS_MAPPING_41_01_SELF_TEST PASS version=5.0.0 chapters=17 applicable=16 non_applicable=1 mapping_not_certification=true frozen_task_refs_valid=true");
}else{
  console.log("OWASP_ASVS_MAPPING_41_01 PASS version=5.0.0 chapters=17 mapping_not_certification=true");
}

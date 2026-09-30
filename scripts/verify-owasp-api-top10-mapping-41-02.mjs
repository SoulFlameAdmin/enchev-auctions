import fs from "node:fs";

const CONFIG_PATH="config/enchev-owasp-api-top10-41-02.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("OWASP_API_TOP10_MAPPING_41_02 FAIL: "+message);}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
if(config.taskId!=="41.02"||config.title!=="OWASP API Security Top 10 mapping") fail("task identity drift");
if(config.standard?.name!=="OWASP API Security Top 10") fail("standard name drift");
if(config.standard?.edition!=="2023") fail("API Security Top 10 edition must be pinned to 2023");
if(config.standard?.officialUrl!=="https://api-security.owasp.org/editions/2023/en/0x11-t10/") fail("official OWASP API Security URL drift");
if(config.standard?.riskReferencePrefix!=="API") fail("risk prefix drift");

for(const key of ["mappingIsNotCertification","riskPassNotImplied","externalPenetrationTestNotImplied","phase41AbuseTestsRemainRequired","futureEditionRequiresExplicitRemap"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}

const expected=[
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

if(!Array.isArray(config.mapping)||config.mapping.length!==10) fail("all ten 2023 API risks must be mapped");
const seen=new Set();
for(let index=0;index<expected.length;index+=1){
  const row=config.mapping[index];
  const [risk,name]=expected[index];
  if(row.risk!==risk||row.name!==name) fail("risk identity drift at "+risk);
  if(seen.has(row.risk)) fail("duplicate risk "+row.risk);
  seen.add(row.risk);
  if(!Array.isArray(row.planTasks)||row.planTasks.length<1) fail("risk lacks Enchev control mapping: "+row.risk);
  if(typeof row.verificationApproach!=="string"||row.verificationApproach.trim().length<20) fail("verification approach too weak: "+row.risk);
}

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
const phase41=source.slice(p41Start,p42Start);
if(!phase41.includes('"OWASP API Security Top 10 mapping||security"')) fail("frozen 41.02 identity missing");

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
  for(const id of row.planTasks){
    if(!frozenIds.has(id)) fail("mapping references unknown frozen task "+id);
  }
}

if(!config.mapping.some(row=>row.planTasks.includes("41.03"))) fail("BOLA must connect to 41.03");
if(!config.mapping.some(row=>row.planTasks.includes("41.04"))) fail("function/property authorization must connect to 41.04");
if(!config.mapping.some(row=>row.planTasks.includes("41.11"))) fail("resource consumption must connect to rate-limit bypass certification");
if(!config.mapping.some(row=>row.planTasks.includes("41.12"))) fail("sensitive business flows must connect to bot/scripted bidding certification");
if(!config.mapping.some(row=>row.planTasks.includes("41.13"))) fail("SSRF risk must connect to explicit SSRF assessment");

if(process.argv.includes("--self-test")){
  const reject=(label,mutate)=>{
    const clone=structuredClone(config);
    mutate(clone);
    let rejected=false;
    try{
      if(clone.mapping.length!==10) throw new Error("count");
      const risks=new Set(clone.mapping.map(row=>row.risk));
      if(risks.size!==10) throw new Error("duplicate");
      if(clone.standard.edition!=="2023") throw new Error("edition");
      if(!clone.claimBoundary.mappingIsNotCertification) throw new Error("claim");
    }catch{rejected=true;}
    if(!rejected) fail("negative self-test not rejected: "+label);
  };
  reject("missing risk",x=>x.mapping.pop());
  reject("duplicate risk",x=>x.mapping[9].risk=x.mapping[0].risk);
  reject("edition drift",x=>x.standard.edition="future");
  reject("certification overclaim",x=>x.claimBoundary.mappingIsNotCertification=false);
  console.log("OWASP_API_TOP10_MAPPING_41_02_SELF_TEST PASS edition=2023 risks=10 mapping_not_certification=true frozen_task_refs_valid=true phase41_links=true negative_cases=4");
}else{
  console.log("OWASP_API_TOP10_MAPPING_41_02 PASS edition=2023 risks=10 mapping_not_certification=true");
}

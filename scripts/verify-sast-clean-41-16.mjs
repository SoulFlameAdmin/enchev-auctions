import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH="config/enchev-sast-clean-41-16.json";
const WORKFLOW_PATH=".github/workflows/code-scan.yml";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("SAST_CLEAN_41_16 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function verifyWorkflow(text,config){
  const failures=[];
  const pin=config.engine.actionPin;
  if(!text.includes("push:")||!text.includes("pull_request:")) failures.push("push/PR triggers missing");
  if((text.match(/branches:\s*\[main\]/g)||[]).length<2) failures.push("main branch scope incomplete");
  if(!text.includes("contents: read")) failures.push("contents read permission missing");
  if(!text.includes("security-events: write")) failures.push("security-events write permission missing");
  if(!text.includes("github/codeql-action/init@"+pin)) failures.push("CodeQL init pin mismatch");
  if(!text.includes("github/codeql-action/analyze@"+pin)) failures.push("CodeQL analyze pin mismatch");
  if(!text.includes("github/codeql-action/upload-sarif@"+pin)) failures.push("CodeQL upload-sarif pin mismatch");
  if(!text.includes("languages: "+config.engine.language)) failures.push("CodeQL language drift");
  if(!text.includes("queries: "+config.engine.querySuite)) failures.push("CodeQL query suite drift");
  if(!text.includes("output: "+config.engine.sarifDirectory)) failures.push("SARIF output drift");
  if(!text.includes("upload: never")) failures.push("pre-gate automatic SARIF upload not disabled");
  if(!text.includes("node scripts/verify-sast-clean-41-16.mjs --dir "+config.engine.sarifDirectory)) failures.push("real SARIF severity gate missing");
  if(!text.includes("sarif_file: "+config.engine.sarifDirectory)) failures.push("post-gate SARIF upload path drift");
  if(!text.includes("if: always()")) failures.push("post-gate SARIF visibility guard missing");
  if(/github\/codeql-action\/(init|analyze|upload-sarif)@v\d/i.test(text)) failures.push("floating CodeQL major ref forbidden");
  if(/continue-on-error:\s*true/i.test(text)) failures.push("continue-on-error forbidden");
  return failures;
}

function ruleForResult(run,result){
  const rules=run?.tool?.driver?.rules||[];
  if(typeof result?.ruleIndex==="number"&&rules[result.ruleIndex]) return rules[result.ruleIndex];
  if(result?.ruleId) return rules.find(r=>r?.id===result.ruleId)||null;
  return null;
}

function securitySeverity(rule,result){
  const raw=result?.properties?.["security-severity"] ?? rule?.properties?.["security-severity"];
  if(raw===undefined||raw===null||raw==="") return null;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}

function isSecurityRule(rule,result){
  const tags=[
    ...(Array.isArray(rule?.properties?.tags)?rule.properties.tags:[]),
    ...(Array.isArray(result?.properties?.tags)?result.properties.tags:[])
  ].map(x=>String(x).toLowerCase());
  return rule?.properties?.["security-severity"]!==undefined ||
    result?.properties?.["security-severity"]!==undefined ||
    tags.includes("security") ||
    tags.some(t=>t.startsWith("external/cwe/"));
}

export function inspectSarifDocument(doc,threshold=7){
  if(!doc||typeof doc!=="object"||!Array.isArray(doc.runs)||doc.runs.length===0) fail("invalid or empty SARIF document");
  const highCritical=[];
  const unclassified=[];
  let securityResults=0;
  let totalResults=0;
  for(const run of doc.runs){
    for(const result of run?.results||[]){
      totalResults+=1;
      const rule=ruleForResult(run,result);
      if(!isSecurityRule(rule,result)) continue;
      securityResults+=1;
      const sev=securitySeverity(rule,result);
      const id=result?.ruleId||rule?.id||"unknown-rule";
      if(sev===null){
        unclassified.push(id);
        continue;
      }
      if(sev>=threshold) highCritical.push({id,severity:sev,message:result?.message?.text||""});
    }
  }
  return {highCritical,unclassified,securityResults,totalResults};
}

function findSarifFiles(dir){
  if(!fs.existsSync(dir)) fail("SARIF directory missing: "+dir);
  const out=[];
  const walk=(p)=>{
    for(const entry of fs.readdirSync(p,{withFileTypes:true})){
      const full=path.join(p,entry.name);
      if(entry.isDirectory()) walk(full);
      else if(entry.isFile()&&entry.name.toLowerCase().endsWith(".sarif")) out.push(full);
    }
  };
  walk(dir);
  if(out.length===0) fail("no SARIF files found in "+dir);
  return out.sort();
}

function inspectDirectory(dir,threshold){
  const totals={files:0,securityResults:0,totalResults:0,highCritical:[],unclassified:[]};
  for(const file of findSarifFiles(dir)){
    const result=inspectSarifDocument(readJson(file),threshold);
    totals.files+=1;
    totals.securityResults+=result.securityResults;
    totals.totalResults+=result.totalResults;
    totals.highCritical.push(...result.highCritical.map(x=>({...x,file})));
    totals.unclassified.push(...result.unclassified.map(id=>({id,file})));
  }
  return totals;
}

function fixture(severity,{security=true}={}){
  const props=security?{"security-severity":String(severity),tags:["security","external/cwe/cwe-79"]}:{tags:["maintainability"]};
  return {
    version:"2.1.0",
    runs:[{
      tool:{driver:{name:"CodeQL",rules:[{id:"js/test",properties:props}]}},
      results:[{ruleId:"js/test",ruleIndex:0,level:"error",message:{text:"fixture"}}]
    }]
  };
}

function runSelfTest(config){
  const medium=inspectSarifDocument(fixture(6.9),config.severityGate.securitySeverityThreshold);
  if(medium.highCritical.length||medium.unclassified.length) fail("medium security fixture blocked");
  const high=inspectSarifDocument(fixture(7.0),config.severityGate.securitySeverityThreshold);
  if(high.highCritical.length!==1) fail("high fixture not blocked");
  const critical=inspectSarifDocument(fixture(9.8),config.severityGate.securitySeverityThreshold);
  if(critical.highCritical.length!==1) fail("critical fixture not blocked");
  const nonSecurity=inspectSarifDocument(fixture(9.8,{security:false}),config.severityGate.securitySeverityThreshold);
  if(nonSecurity.highCritical.length||nonSecurity.securityResults) fail("non-security rule treated as security");
  const unclassified=fixture(1);
  delete unclassified.runs[0].tool.driver.rules[0].properties["security-severity"];
  unclassified.runs[0].tool.driver.rules[0].properties.tags=["security"];
  if(inspectSarifDocument(unclassified,7).unclassified.length!==1) fail("unclassified security result did not fail closed");

  const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
  const mutations=[
    workflow.replace("upload: never","upload: always"),
    workflow.replace("queries: "+config.engine.querySuite,"queries: security-and-quality"),
    workflow.replace("node scripts/verify-sast-clean-41-16.mjs --dir "+config.engine.sarifDirectory,"node --version"),
    workflow.replace("github/codeql-action/analyze@"+config.engine.actionPin,"github/codeql-action/analyze@v4"),
    workflow+"\ncontinue-on-error: true\n"
  ];
  for(let i=0;i<mutations.length;i++){
    if(verifyWorkflow(mutations[i],config).length===0) fail("unsafe workflow mutation accepted index="+i);
  }
  console.log("SAST_CLEAN_41_16_SELF_TEST PASS threshold=7.0 medium_allowed=true high_blocked=true critical_blocked=true unclassified_security_blocked=true non_security_ignored=true workflow_negative_cases=5");
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.16"||config.title!=="SAST clean of Critical/High"||config.kind!=="security") fail("task identity drift");
if(config.severityGate?.securitySeverityThreshold!==7||config.severityGate?.blocksHighAndCritical!==true||config.severityGate?.failsOnUnclassifiedSecurityResult!==true||config.severityGate?.realSarifRequired!==true||config.severityGate?.exactHeadCodeScanSuccessRequired!==true||config.severityGate?.sarifUploadAfterGateRequired!==true) fail("severity gate drift");
for(const key of ["pullRequestMainRequired","pushMainRequired","contentsReadRequired","securityEventsWriteRequired","analyzeUploadDisabledBeforeGate","immutableActionPinRequired","floatingActionRefsForbidden"]){
  if(config.workflowPolicy?.[key]!==true) fail("workflow policy disabled: "+key);
}
for(const key of ["javascriptTypescriptOnly","codeqlCoverageOnly","dastRemains41_17","dependencyScanRemains41_18","externalPenTestRemains41_20"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}

const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const failures=verifyWorkflow(workflow,config);
if(failures.length) fail(failures.join("; "));

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"SAST clean of Critical/High||security"')) fail("frozen 41.16 identity missing");

const dirIndex=process.argv.indexOf("--dir");
if(dirIndex>=0){
  const dir=process.argv[dirIndex+1];
  if(!dir) fail("missing --dir value");
  const totals=inspectDirectory(dir,config.severityGate.securitySeverityThreshold);
  if(totals.unclassified.length) fail("unclassified security findings="+totals.unclassified.length+" "+totals.unclassified.slice(0,10).map(x=>x.id).join(","));
  if(totals.highCritical.length) fail("High/Critical findings="+totals.highCritical.length+" "+totals.highCritical.slice(0,10).map(x=>x.id+"@"+x.severity).join(","));
  console.log("SAST_CLEAN_41_16_SARIF PASS files="+totals.files+" security_results="+totals.securityResults+" total_results="+totals.totalResults+" threshold="+config.severityGate.securitySeverityThreshold+" high_critical=0 unclassified_security=0");
}
if(process.argv.includes("--self-test")) runSelfTest(config);
if(dirIndex<0&&!process.argv.includes("--self-test")) console.log("SAST_CLEAN_41_16 PASS workflow_gate=true exact_head_code_scan_success_required=true");

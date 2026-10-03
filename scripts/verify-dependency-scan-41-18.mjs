import fs from "node:fs";

const CONFIG_PATH="config/enchev-dependency-scan-41-18.json";
const WORKFLOW_PATH=".github/workflows/dependency-scan.yml";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("DEPENDENCY_SCAN_41_18 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function inspectAudit(doc){
  if(!doc||typeof doc!=="object"||Array.isArray(doc)) fail("invalid npm audit JSON");
  if(!doc.metadata||typeof doc.metadata!=="object") fail("metadata missing");
  const counts=doc.metadata.vulnerabilities;
  if(!counts||typeof counts!=="object") fail("metadata.vulnerabilities missing");
  const normalized={info:0,low:0,moderate:0,high:0,critical:0,total:0};
  for(const k of Object.keys(normalized)){
    const n=Number(counts[k] ?? 0);
    if(!Number.isFinite(n)||n<0) fail("invalid vulnerability count: "+k);
    normalized[k]=n;
  }
  if(normalized.total===0) normalized.total=normalized.info+normalized.low+normalized.moderate+normalized.high+normalized.critical;
  return {counts:normalized,blocked:normalized.high+normalized.critical};
}

export function verifyWorkflow(text,config){
  const failures=[];
  if(!text.includes("pull_request:")||!text.includes("push:")) failures.push("push/PR triggers missing");
  if((text.match(/branches:\s*\[main\]/g)||[]).length<2) failures.push("main branch scope incomplete");
  if(!text.includes("contents: read")) failures.push("read-only contents permission missing");
  if(!text.includes("node-version: '24'")) failures.push("Node 24 missing");
  if(!text.includes("npm audit --json")) failures.push("npm audit JSON scan missing");
  if(!text.includes(config.engine.report)) failures.push("audit report path missing");
  if(!text.includes("verify-dependency-scan-41-18.mjs --report")) failures.push("real report gate missing");
  if(!text.includes("actions/upload-artifact@v4")) failures.push("audit evidence archive missing");
  if(/continue-on-error:\s*true/i.test(text)) failures.push("continue-on-error forbidden");
  return failures;
}

function runSelfTest(config){
  const mk=(high,critical)=>({metadata:{vulnerabilities:{info:0,low:1,moderate:2,high,critical,total:3+high+critical}}});
  if(inspectAudit(mk(0,0)).blocked!==0) fail("clean fixture blocked");
  if(inspectAudit(mk(1,0)).blocked!==1) fail("high fixture not blocked");
  if(inspectAudit(mk(0,1)).blocked!==1) fail("critical fixture not blocked");
  let invalidBlocked=false;
  try{inspectAudit({});}catch{invalidBlocked=true;}
  if(!invalidBlocked) fail("invalid report did not fail closed");
  const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
  const mutations=[
    workflow.replace("npm audit --json","npm --version"),
    workflow.replace("node scripts/verify-dependency-scan-41-18.mjs --report artifacts/npm-audit.json","node --version"),
    workflow+"\ncontinue-on-error: true\n"
  ];
  for(let i=0;i<mutations.length;i++) if(verifyWorkflow(mutations[i],config).length===0) fail("unsafe workflow mutation accepted index="+i);
  console.log("DEPENDENCY_SCAN_41_18_SELF_TEST PASS high_blocked=true critical_blocked=true invalid_fail_closed=true");
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.18"||config.title!=="Dependency scan clean of Critical/High") fail("task identity drift");
const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const failures=verifyWorkflow(workflow,config);
if(failures.length) fail(failures.join("; "));

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41=master.indexOf('["41","Security & abuse certification"');
const p42=master.indexOf('["42","Performance certification"');
if(p41<0||p42<=p41||!master.slice(p41,p42).includes('"Dependency scan clean of Critical/High||security"')) fail("frozen 41.18 identity missing");

const reportIndex=process.argv.indexOf("--report");
if(reportIndex>=0){
  const reportPath=process.argv[reportIndex+1];
  if(!reportPath||!fs.existsSync(reportPath)) fail("real audit report missing");
  const result=inspectAudit(readJson(reportPath));
  if(result.blocked>0) fail("Critical/High dependency vulnerabilities="+result.blocked+" high="+result.counts.high+" critical="+result.counts.critical);
  console.log("DEPENDENCY_SCAN_41_18_REPORT PASS high=0 critical=0 total="+result.counts.total);
}
if(process.argv.includes("--self-test")) runSelfTest(config);
if(reportIndex<0&&!process.argv.includes("--self-test")) console.log("DEPENDENCY_SCAN_41_18 PASS workflow_gate=true exact_head_success_required=true");

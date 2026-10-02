import fs from "node:fs";

const CONFIG_PATH="config/enchev-dependency-scan-clean-41-18.json";
const WORKFLOW_PATH=".github/workflows/dependency-scan.yml";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const LOWER_GATE_PATH="config/enchev-dependency-review.json";

function fail(message){throw new Error("DEPENDENCY_SCAN_CLEAN_41_18 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function inspectAuditReport(doc){
  const v=doc?.metadata?.vulnerabilities;
  if(!v||typeof v!=="object") fail("metadata.vulnerabilities missing");
  const keys=["info","low","moderate","high","critical","total"];
  const counts={};
  for(const key of keys){
    const n=Number(v[key]);
    if(!Number.isInteger(n)||n<0) fail("invalid vulnerability counter: "+key);
    counts[key]=n;
  }
  if(counts.total < counts.info+counts.low+counts.moderate+counts.high+counts.critical){
    fail("total vulnerability count is lower than severity sum");
  }
  return counts;
}

export function verifyWorkflow(text,config){
  const failures=[];
  if(!text.includes("push:")||!text.includes("pull_request:")) failures.push("push/PR triggers missing");
  if((text.match(/branches:\s*\[main\]/g)||[]).length<2) failures.push("main branch scope incomplete");
  if(!text.includes("contents: read")) failures.push("read-only contents permission missing");
  if(!text.includes("node-version: '24'")) failures.push("Node 24 missing");
  if(!text.includes(config.engine.command+" > "+config.engine.report)) failures.push("canonical npm audit command/report missing");
  if(!text.includes(config.engine.exitCodeEvidence)) failures.push("audit exit-code evidence missing");
  if(!text.includes("node scripts/verify-dependency-scan-clean-41-18.mjs --report "+config.engine.report+" --exit-code-file "+config.engine.exitCodeEvidence)) failures.push("real audit report gate missing");
  if(!text.includes("uses: actions/upload-artifact@v4")) failures.push("audit artifact upload missing");
  if(!text.includes("if: always()")) failures.push("failure evidence archive guard missing");
  if(/continue-on-error:\s*true/i.test(text)) failures.push("continue-on-error forbidden");
  if(text.includes("|| true")) failures.push("audit bypass token forbidden");
  return failures;
}

function runSelfTest(config){
  const fixture=(high,critical,moderate=0)=>({metadata:{vulnerabilities:{info:0,low:0,moderate,high,critical,total:high+critical+moderate}}});
  const clean=inspectAuditReport(fixture(0,0,2));
  if(clean.high!==0||clean.critical!==0) fail("clean fixture drift");
  const high=inspectAuditReport(fixture(1,0));
  if(high.high!==1) fail("high fixture drift");
  const critical=inspectAuditReport(fixture(0,1));
  if(critical.critical!==1) fail("critical fixture drift");
  let malformedRejected=false;
  try{inspectAuditReport({metadata:{vulnerabilities:{high:"x"}}});}catch{malformedRejected=true;}
  if(!malformedRejected) fail("malformed report accepted");

  const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
  const mutations=[
    workflow.replace("--audit-level=high","--audit-level=critical"),
    workflow.replace("--package-lock-only ",""),
    workflow.replace("node scripts/verify-dependency-scan-clean-41-18.mjs --report "+config.engine.report+" --exit-code-file "+config.engine.exitCodeEvidence,"node --version"),
    workflow+"\ncontinue-on-error: true\n",
    workflow+"\nrun: npm audit --json || true\n"
  ];
  for(let i=0;i<mutations.length;i++){
    if(verifyWorkflow(mutations[i],config).length===0) fail("unsafe workflow mutation accepted index="+i);
  }
  console.log("DEPENDENCY_SCAN_CLEAN_41_18_SELF_TEST PASS high_detected=true critical_detected=true medium_allowed=true malformed_blocked=true workflow_negative_cases=5");
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.18"||config.title!=="Dependency scan clean of Critical/High"||config.kind!=="security") fail("task identity drift");
if(config.policy?.packageLockOnly!==true||config.policy?.auditLevel!=="high"||config.policy?.highMustBeZero!==true||config.policy?.criticalMustBeZero!==true||config.policy?.realJsonReportRequired!==true||config.policy?.npmAuditExitCodeMustBeZero!==true||config.policy?.exactHeadDependencyScanSuccessRequired!==true||config.policy?.reportArchivedRequired!==true) fail("dependency policy drift");
for(const key of ["npmLockfileDependencyGraphOnly","containerImageScanNotClaimed","osPackageScanNotClaimed","runtimeReachabilityNotClaimed","sbomArchiveRemains41_19","externalPenTestRemains41_20"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}

const lower=readJson(LOWER_GATE_PATH);
if(lower.taskId!=="26.09"||lower.policy?.auditLevel!=="high"||lower.policy?.blocksHighAndCritical!==true||lower.policy?.packageLockOnly!==true) fail("26.09 lower dependency gate drift");

const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const workflowFailures=verifyWorkflow(workflow,config);
if(workflowFailures.length) fail(workflowFailures.join("; "));

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Dependency scan clean of Critical/High||security"')) fail("frozen 41.18 identity missing");

const reportIndex=process.argv.indexOf("--report");
const exitIndex=process.argv.indexOf("--exit-code-file");
if(reportIndex>=0||exitIndex>=0){
  const reportPath=process.argv[reportIndex+1];
  const exitPath=process.argv[exitIndex+1];
  if(!reportPath||!exitPath) fail("both --report and --exit-code-file are required");
  if(!fs.existsSync(reportPath)||!fs.existsSync(exitPath)) fail("audit evidence file missing");
  const counts=inspectAuditReport(readJson(reportPath));
  const exitCode=Number(fs.readFileSync(exitPath,"utf8").trim());
  if(!Number.isInteger(exitCode)||exitCode<0) fail("invalid npm audit exit code evidence");
  if(counts.high>0||counts.critical>0) fail("High/Critical dependency findings high="+counts.high+" critical="+counts.critical);
  if(exitCode!==0) fail("npm audit exited non-zero despite zero High/Critical: "+exitCode);
  console.log("DEPENDENCY_SCAN_CLEAN_41_18_REPORT PASS high=0 critical=0 moderate="+counts.moderate+" low="+counts.low+" info="+counts.info+" total="+counts.total+" npm_exit=0");
}
if(process.argv.includes("--self-test")) runSelfTest(config);
if(reportIndex<0&&exitIndex<0&&!process.argv.includes("--self-test")) console.log("DEPENDENCY_SCAN_CLEAN_41_18 PASS workflow_gate=true exact_head_dependency_scan_success_required=true");

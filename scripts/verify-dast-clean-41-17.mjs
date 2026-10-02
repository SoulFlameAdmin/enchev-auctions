import fs from "node:fs";

const CONFIG_PATH="config/enchev-dast-clean-41-17.json";
const WORKFLOW_PATH=".github/workflows/dast-scan.yml";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("DAST_CLEAN_41_17 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function inspectZapReport(doc, threshold=3){
  if(!doc||typeof doc!=="object") fail("invalid JSON report");
  if(!Array.isArray(doc.site)||doc.site.length===0) fail("report contains no scanned site");
  let totalAlerts=0;
  const highCritical=[];
  const unclassified=[];
  const riskCounts={high:0,medium:0,low:0,informational:0,other:0};

  for(const site of doc.site){
    const alerts=Array.isArray(site?.alerts)?site.alerts:[];
    for(const alert of alerts){
      totalAlerts+=1;
      const raw=alert?.riskcode;
      const risk=Number(raw);
      const id=String(alert?.pluginid ?? alert?.alertRef ?? alert?.name ?? "unknown-alert");
      const name=String(alert?.alert ?? alert?.name ?? "unknown");
      if(raw===undefined||raw===null||raw===""||!Number.isFinite(risk)){
        unclassified.push({id,name});
        continue;
      }
      if(risk>=3) riskCounts.high+=1;
      else if(risk===2) riskCounts.medium+=1;
      else if(risk===1) riskCounts.low+=1;
      else if(risk===0) riskCounts.informational+=1;
      else riskCounts.other+=1;
      if(risk>=threshold) highCritical.push({id,name,risk});
    }
  }
  return {totalAlerts,highCritical,unclassified,riskCounts,sites:doc.site.length};
}

export function verifyWorkflow(text,config){
  const failures=[];
  if(!text.includes("push:")||!text.includes("pull_request:")) failures.push("push/PR triggers missing");
  if((text.match(/branches:\s*\[main\]/g)||[]).length<2) failures.push("main branch scope incomplete");
  if(!text.includes("contents: read")) failures.push("read-only contents permission missing");
  if(!text.includes("node-version: '24'")) failures.push("Node 24 missing");
  if(!text.includes("npm ci --no-audit --no-fund")) failures.push("locked install missing");
  if(!text.includes("npm run build")) failures.push("production build missing");
  if(!text.includes("next start --hostname 0.0.0.0 --port 3000")) failures.push("isolated local app start missing");
  if(!text.includes("chmod 0777 artifacts/zap")) failures.push("container-writable ZAP artifact directory missing");
  if(!text.includes(config.target.healthPath)) failures.push("local health gate missing");
  if(!text.includes(config.engine.dockerImage)) failures.push("ZAP version-pinned image missing");
  if(!text.includes("zap-full-scan.py")) failures.push("ZAP full active scan missing");
  if(!text.includes("-m "+config.scan.traditionalSpiderMinutes)) failures.push("spider bound drift");
  if(!text.includes("-T "+config.scan.zapStartupPassiveTimeoutMinutes)) failures.push("ZAP timeout drift");
  if(!text.includes("-J zap-report.json")) failures.push("JSON report missing");
  if(!text.includes("-r zap-report.html")) failures.push("HTML report missing");
  if(!text.includes("node scripts/verify-dast-clean-41-17.mjs --report "+config.engine.reportJson)) failures.push("real report severity gate missing");
  if(/https:\/\/(?!127\.0\.0\.1|localhost)/i.test(text.replace(/https:\/\/api\.github\.com/gi,""))) failures.push("external HTTPS target/reference forbidden in DAST workflow");
  if(/target:\s*['"]?https?:\/\//i.test(text)) failures.push("hard-coded remote DAST target forbidden");
  if(/continue-on-error:\s*true/i.test(text)) failures.push("continue-on-error forbidden");
  return failures;
}

function runSelfTest(config){
  const report=(riskcode)=>({
    "@version":"2.17.0",
    site:[{"@name":"http://172.17.0.1:3000",alerts:[
      {pluginid:"10001",alert:"fixture",riskcode}
    ]}]
  });
  const medium=inspectZapReport(report("2"),config.severityGate.zapRiskCodeThreshold);
  if(medium.highCritical.length||medium.unclassified.length) fail("medium fixture blocked");
  const high=inspectZapReport(report("3"),config.severityGate.zapRiskCodeThreshold);
  if(high.highCritical.length!==1) fail("high fixture not blocked");
  const unknown=report("");
  if(inspectZapReport(unknown,3).unclassified.length!==1) fail("unclassified alert did not fail closed");
  const clean={"@version":"2.17.0",site:[{"@name":"http://172.17.0.1:3000","alerts":[]}]};
  if(inspectZapReport(clean,3).totalAlerts!==0) fail("clean report drift");

  const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
  const mutations=[
    workflow.replace("zap-full-scan.py","zap-baseline.py"),
    workflow.replaceAll(config.engine.dockerImage,"ghcr.io/zaproxy/zaproxy:weekly"),
    workflow.replace("node scripts/verify-dast-clean-41-17.mjs --report "+config.engine.reportJson,"node --version"),
    workflow.replace("next start --hostname 0.0.0.0 --port 3000","next start --port 3000"),
    workflow.replace("chmod 0777 artifacts/zap","true"),
    workflow+"\ncontinue-on-error: true\n"
  ];
  for(let i=0;i<mutations.length;i++){
    if(verifyWorkflow(mutations[i],config).length===0) fail("unsafe workflow mutation accepted index="+i);
  }
  console.log("DAST_CLEAN_41_17_SELF_TEST PASS high_blocked=true medium_allowed=true unclassified_blocked=true clean_allowed=true workflow_negative_cases=6 isolated_local_target=true");
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.17"||config.title!=="DAST clean of Critical/High"||config.kind!=="security") fail("task identity drift");
if(config.target?.environment!=="isolated-ci-local"||config.target?.productionTargetForbidden!==true||config.target?.previewTargetForbidden!==true||config.target?.externalTargetForbidden!==true||config.target?.authenticatedScanClaimed!==false) fail("target safety boundary drift");
if(config.scan?.fullActiveScanRequired!==true||config.scan?.jsonReportRequired!==true||config.scan?.htmlReportRequired!==true) fail("scan coverage drift");
if(config.severityGate?.zapRiskCodeThreshold!==3||config.severityGate?.blocksHighAndCritical!==true||config.severityGate?.unclassifiedAlertsFailClosed!==true||config.severityGate?.realReportRequired!==true||config.severityGate?.exactHeadDastWorkflowSuccessRequired!==true) fail("severity gate drift");
for(const key of ["unauthenticatedLocalSurfaceOnly","productionDastNotClaimed","authenticatedDastNotClaimed","externalPenTestRemains41_20","allCriticalHighResolutionRemains41_21"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}

const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const workflowFailures=verifyWorkflow(workflow,config);
if(workflowFailures.length) fail(workflowFailures.join("; "));

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"DAST clean of Critical/High||security"')) fail("frozen 41.17 identity missing");

const reportIndex=process.argv.indexOf("--report");
if(reportIndex>=0){
  const reportPath=process.argv[reportIndex+1];
  if(!reportPath) fail("missing --report value");
  if(!fs.existsSync(reportPath)) fail("report missing: "+reportPath);
  const result=inspectZapReport(readJson(reportPath),config.severityGate.zapRiskCodeThreshold);
  if(result.unclassified.length) fail("unclassified alerts="+result.unclassified.length+" "+result.unclassified.slice(0,10).map(x=>x.id).join(","));
  if(result.highCritical.length) fail("High/Critical alerts="+result.highCritical.length+" "+result.highCritical.slice(0,10).map(x=>x.id+"@risk"+x.risk).join(","));
  console.log("DAST_CLEAN_41_17_REPORT PASS sites="+result.sites+" alerts="+result.totalAlerts+" high_critical=0 unclassified=0 medium="+result.riskCounts.medium+" low="+result.riskCounts.low+" informational="+result.riskCounts.informational);
}
if(process.argv.includes("--self-test")) runSelfTest(config);
if(reportIndex<0&&!process.argv.includes("--self-test")) console.log("DAST_CLEAN_41_17 PASS workflow_gate=true exact_head_dast_success_required=true local_only=true");

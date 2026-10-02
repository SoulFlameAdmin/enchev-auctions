import fs from "node:fs";

const CONFIG_PATH="config/enchev-secret-scanning-clean-41-15.json";
const WORKFLOW_PATH=".github/workflows/secret-scan.yml";
const LOWER_GATE_PATH="scripts/verify-secret-scanning-gate.mjs";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("SECRET_SCANNING_CLEAN_41_15 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function verifySecretScanWorkflow(text, config){
  const failures=[];
  const pin=config.scanner.actionPin;
  const version=config.scanner.runtimeVersion;
  if(!text.includes("push:")) failures.push("push trigger missing");
  if(!text.includes("pull_request:")) failures.push("pull_request trigger missing");
  const mainScopes=(text.match(/branches:\s*\[main\]/g)||[]).length;
  if(mainScopes<2) failures.push("push/PR main scope incomplete");
  if(!text.includes("contents: read")) failures.push("read-only contents permission missing");
  if(!text.includes("fetch-depth: 0")) failures.push("full history checkout missing");
  if(!text.includes("trufflesecurity/trufflehog@"+pin)) failures.push("scanner action immutable pin mismatch");
  if(!text.includes("version: '"+version+"'")) failures.push("scanner runtime version mismatch");
  for(const token of config.forbiddenWorkflowTokens){
    if(text.toLowerCase().includes(String(token).toLowerCase())) failures.push("forbidden workflow token: "+token);
  }
  return failures;
}

function runSelfTest(config){
  const valid=[
    "name: Secret Scan",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    branches: [main]",
    "permissions:",
    "  contents: read",
    "steps:",
    "  - uses: actions/checkout@v4",
    "    with:",
    "      fetch-depth: 0",
    "  - uses: trufflesecurity/trufflehog@"+config.scanner.actionPin,
    "    with:",
    "      version: '"+config.scanner.runtimeVersion+"'"
  ].join("\n");
  if(verifySecretScanWorkflow(valid,config).length) fail("valid self-test fixture rejected");
  const mutations=[
    valid.replace("fetch-depth: 0","fetch-depth: 1"),
    valid.replace(config.scanner.actionPin,"main"),
    valid.replace("contents: read","contents: write"),
    valid+"\ncontinue-on-error: true",
    valid+"\nargs: --exclude-paths ignored.txt",
    valid.replace("  pull_request:\n    branches: [main]","  pull_request:\n    branches: [develop]")
  ];
  for(let i=0;i<mutations.length;i++){
    if(verifySecretScanWorkflow(mutations[i],config).length===0) fail("unsafe mutation accepted index="+i);
  }
  console.log("SECRET_SCANNING_CLEAN_41_15_SELF_TEST PASS negative_cases=6 full_history=true immutable_pin=true read_only=true fail_closed=true suppression_free=true exact_head_workflow_success_required=true");
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.15"||config.title!=="Secret scanning clean"||config.kind!=="security") fail("task identity drift");
for(const key of ["fullHistoryRequired","pullRequestMainRequired","pushMainRequired","readOnlyContentsRequired","failClosedRequired","suppressionFreeWorkflowRequired"]){
  if(config.scanner?.[key]!==true) fail("scanner guardrail disabled: "+key);
}
for(const key of ["exactHeadWorkflowSuccessRequired","historyScanRequired","configurationSelfTestRequired","noRepositorySuppressionFileRequired"]){
  if(config.cleanEvidence?.[key]!==true) fail("clean evidence requirement disabled: "+key);
}
for(const key of ["githubHostedScanOnly","providerOrganizationSecretScanningNotClaimed","externalSecretManagerRotationNotClaimed","historicalCredentialRevocationNotInferredFromCleanScan","sastRemains41_16"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.forbiddenWorkflowTokens)||config.forbiddenWorkflowTokens.length<6) fail("forbidden token coverage drift");

const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const failures=verifySecretScanWorkflow(workflow,config);
if(failures.length) fail(failures.join("; "));
if(fs.existsSync(".trufflehogignore")) fail("repository suppression file .trufflehogignore is forbidden for 41.15");
if(!fs.existsSync(LOWER_GATE_PATH)) fail("26.10 lower-level secret scanning gate missing");

const lowerGate=fs.readFileSync(LOWER_GATE_PATH,"utf8");
if(!lowerGate.includes(config.scanner.actionPin)||!lowerGate.includes(config.scanner.runtimeVersion)||!lowerGate.includes("fetch-depth: 0")) fail("26.10 lower gate does not bind current scanner pin/version/full history");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Secret scanning clean||security"')) fail("frozen 41.15 identity missing");

if(process.argv.includes("--self-test")) runSelfTest(config);
console.log("SECRET_SCANNING_CLEAN_41_15 PASS configuration_clean=true hosted_exact_head_result_required=true scanner=TruffleHog history=full suppression_free=true organization_secret_scanning_claim=false");

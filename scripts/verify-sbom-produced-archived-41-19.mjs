import fs from "node:fs";

const CONFIG_PATH="config/enchev-sbom-produced-archived-41-19.json";
const WORKFLOW_PATH=".github/workflows/sbom.yml";
const LOWER_VERIFIER_PATH="scripts/verify-sbom-generation.mjs";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("SBOM_PRODUCED_ARCHIVED_41_19 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function verifyWorkflow(text,config){
  const failures=[];
  if(!text.includes("push:")||!text.includes("pull_request:")) failures.push("push/PR triggers missing");
  if((text.match(/branches:\s*\[main\]/g)||[]).length<2) failures.push("main branch scope incomplete");
  if(!text.includes("contents: read")) failures.push("read-only contents permission missing");
  if(!text.includes("ref: ${{ github.event.pull_request.head.sha || github.sha }}")) failures.push("exact source checkout missing");
  if(!text.includes("node-version: '24'")) failures.push("Node 24 missing");
  if(!text.includes("npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application")) failures.push("canonical CycloneDX command missing");
  if(!text.includes(config.engine.artifactPath)) failures.push("SBOM artifact path drift");
  if(!text.includes("node scripts/verify-sbom-generation.mjs --file "+config.engine.artifactPath)) failures.push("SBOM document validation missing");
  if(!text.includes("uses: actions/upload-artifact@v4")) failures.push("artifact upload missing");
  if(!text.includes("name: "+config.engine.artifactNamePrefix+"${{ github.event.pull_request.head.sha || github.sha }}")) failures.push("exact-head artifact naming missing");
  if(!text.includes("if-no-files-found: error")) failures.push("missing artifact does not fail");
  if(!text.includes("retention-days: "+config.engine.retentionDays)) failures.push("retention policy drift");
  return failures;
}

function runSelfTest(config){
  const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
  const mutations=[
    workflow.replace("ref: ${{ github.event.pull_request.head.sha || github.sha }}","ref: ${{ github.sha }}"),
    workflow.replace("--package-lock-only ",""),
    workflow.replace("--sbom-format=cyclonedx","--sbom-format=spdx"),
    workflow.replace("if-no-files-found: error","if-no-files-found: warn"),
    workflow.replace("retention-days: "+config.engine.retentionDays,"retention-days: 1"),
    workflow.replace(config.engine.artifactNamePrefix+"${{ github.event.pull_request.head.sha || github.sha }}",config.engine.artifactNamePrefix+"latest")
  ];
  for(let i=0;i<mutations.length;i++){
    if(verifyWorkflow(mutations[i],config).length===0) fail("unsafe workflow mutation accepted index="+i);
  }
  console.log("SBOM_PRODUCED_ARCHIVED_41_19_SELF_TEST PASS exact_head=true cyclonedx=true lockfile=true validated=true archived=true retention_days="+config.engine.retentionDays+" workflow_negative_cases=6");
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.19"||config.title!=="SBOM produced and archived"||config.kind!=="security") fail("task identity drift");
if(config.engine?.format!=="CycloneDX"||config.engine?.generator!=="npm sbom"||config.engine?.retentionDays<14) fail("SBOM engine/retention drift");
for(const key of ["exactSourceCheckoutRequired","packageLockOnlyRequired","applicationTypeRequired","artifactValidationRequired","exactHeadArtifactNameRequired","missingArtifactFailsRequired","archiveRetentionRequired","exactHeadSbomWorkflowSuccessRequired"]){
  if(config.policy?.[key]!==true) fail("SBOM policy disabled: "+key);
}
for(const key of ["applicationDependencySbomOnly","containerImageSbomNotClaimed","infrastructureSbomNotClaimed","externalPenTestRemains41_20","allCriticalHighResolutionRemains41_21"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!fs.existsSync(LOWER_VERIFIER_PATH)) fail("26.12 SBOM verifier missing");

const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const failures=verifyWorkflow(workflow,config);
if(failures.length) fail(failures.join("; "));

const lower=fs.readFileSync(LOWER_VERIFIER_PATH,"utf8");
for(const token of ["CycloneDX","components","root-name","root-type"]){
  if(!lower.includes(token)) fail("26.12 SBOM document validation token missing: "+token);
}

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"SBOM produced and archived||security"')) fail("frozen 41.19 identity missing");

if(process.argv.includes("--self-test")) runSelfTest(config);
else console.log("SBOM_PRODUCED_ARCHIVED_41_19 PASS exact_head_sbom_workflow_success_required=true retention_days="+config.engine.retentionDays);

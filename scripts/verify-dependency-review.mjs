import fs from "node:fs";

const CONFIG_PATH="config/enchev-dependency-review.json";
const WORKFLOW_PATH=".github/workflows/verify-enchev-web.yml";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";
const LOCK_GATE_PATH="config/enchev-dependency-lockfile-gate.json";

function fail(message){throw new Error("DEPENDENCY_REVIEW_GATE FAIL: "+message);}

export function validate(config,workflow,preGate,lockGate){
  if(config?.taskId!=="26.09"||config?.name!=="Dependency review"||config?.gateVersion!==1)fail("identity drift");
  if(config?.workflow!==WORKFLOW_PATH||config?.action!=="actions/dependency-review-action@v4"||config?.event!=="pull_request")fail("execution identity drift");
  if(config?.policy?.failOnSeverity!=="high"||config?.policy?.blocksHighAndCritical!==true||config?.policy?.reviewOnlyChangedDependencies!==true||config?.policy?.ciFailureBlocksGreen!==true)fail("policy drift");
  if(config?.policy?.lockfileEnforcementTask!=="26.08")fail("26.08 dependency missing");
  if(lockGate?.taskId!=="26.08"||lockGate?.rules?.rootLockfileRequired!==true||lockGate?.rules?.npmCiRequiredInCi!==true)fail("26.08 lockfile gate unavailable");

  if(!workflow.includes("pull_request:"))fail("PR trigger missing");
  if(!workflow.includes("uses: actions/dependency-review-action@v4"))fail("dependency review action missing");
  if(!workflow.includes("if: github.event_name == 'pull_request'"))fail("dependency review must be PR-only");
  if(!workflow.includes("fail-on-severity: high"))fail("HIGH severity fail policy missing");
  if(!workflow.includes("name: Dependency review (26.09)"))fail("26.09 CI step marker missing");
  if(!preGate.includes('["scripts/verify-dependency-review.mjs", "--self-test"]'))fail("stable pre-gate missing 26.09");
  return true;
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
const preGate=fs.readFileSync(PRE_GATE_PATH,"utf8");
const lockGate=JSON.parse(fs.readFileSync(LOCK_GATE_PATH,"utf8"));
validate(config,workflow,preGate,lockGate);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{
    const box={config:structuredClone(config),workflow,preGate,lockGate:structuredClone(lockGate)};
    mutate(box);
    let rejected=false;
    try{validate(box.config,box.workflow,box.preGate,box.lockGate);}catch{rejected=true;}
    if(!rejected)fail("negative case accepted: "+label);
    cases+=1;
  };
  reject("severity weakened",x=>{x.config.policy.failOnSeverity="critical";});
  reject("action removed",x=>{x.workflow=x.workflow.replace("uses: actions/dependency-review-action@v4","uses: actions/checkout@v4");});
  reject("PR guard removed",x=>{x.workflow=x.workflow.replace("if: github.event_name == 'pull_request'","if: github.event_name == 'push'");});
  reject("CI policy weakened",x=>{x.workflow=x.workflow.replace("fail-on-severity: high","fail-on-severity: critical");});
  reject("26.08 lockfile gate disabled",x=>{x.lockGate.rules.rootLockfileRequired=false;});
  reject("pre-gate removed",x=>{x.preGate=x.preGate.replace('["scripts/verify-dependency-review.mjs", "--self-test"]',"");});
  console.log("DEPENDENCY_REVIEW_GATE_SELF_TEST PASS cases="+cases+" fail_closed=true");
}else{
  console.log("DEPENDENCY_REVIEW_GATE PASS task=26.09 fail_on_severity=high pr_only=true");
}

import fs from "node:fs";

const CONFIG_PATH="config/enchev-dependency-review.json";
const WORKFLOW_PATH=".github/workflows/verify-enchev-web.yml";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";
const LOCK_GATE_PATH="config/enchev-dependency-lockfile-gate.json";

function fail(message){throw new Error("DEPENDENCY_REVIEW_GATE FAIL: "+message);}

export function validate(config,workflow,preGate,lockGate){
  if(config?.taskId!=="26.09"||config?.name!=="Dependency review"||config?.gateVersion!==2)fail("identity drift");
  if(config?.engine!=="npm-audit"||config?.advisoryProvider!=="npm-registry"||config?.event!=="pull_request")fail("review engine drift");
  if(config?.policy?.auditLevel!=="high"||config?.policy?.blocksHighAndCritical!==true||config?.policy?.packageLockOnly!==true||config?.policy?.ciFailureBlocksGreen!==true)fail("policy drift");
  if(config?.policy?.lockfileEnforcementTask!=="26.08"||config?.policy?.githubDependencyGraphOptional!==true)fail("dependency ownership drift");
  if(lockGate?.taskId!=="26.08"||lockGate?.rules?.rootLockfileRequired!==true||lockGate?.rules?.npmCiRequiredInCi!==true)fail("26.08 lockfile gate unavailable");

  if(!workflow.includes("pull_request:"))fail("PR trigger missing");
  if(!workflow.includes("name: Dependency review (26.09)"))fail("26.09 CI step marker missing");
  if(!workflow.includes("run: npm audit --package-lock-only --audit-level=high"))fail("canonical npm advisory command missing");
  if(workflow.includes("uses: actions/dependency-review-action@v4"))fail("unsupported GitHub dependency-review provider still configured");
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
  reject("severity weakened",x=>{x.config.policy.auditLevel="critical";});
  reject("provider drift",x=>{x.config.advisoryProvider="unknown";});
  reject("audit command removed",x=>{x.workflow=x.workflow.replace("run: npm audit --package-lock-only --audit-level=high","run: npm --version");});
  reject("lock-only removed",x=>{x.workflow=x.workflow.replace("--package-lock-only ","");});
  reject("unsupported provider restored",x=>{x.workflow+="\n      - uses: actions/dependency-review-action@v4\n";});
  reject("26.08 lockfile gate disabled",x=>{x.lockGate.rules.rootLockfileRequired=false;});
  reject("pre-gate removed",x=>{x.preGate=x.preGate.replace('["scripts/verify-dependency-review.mjs", "--self-test"]',"");});
  console.log("DEPENDENCY_REVIEW_GATE_SELF_TEST PASS cases="+cases+" fail_closed=true provider=npm-registry");
}else{
  console.log("DEPENDENCY_REVIEW_GATE PASS task=26.09 provider=npm-registry audit_level=high");
}

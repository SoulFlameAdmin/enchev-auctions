import fs from "node:fs";

const config=JSON.parse(fs.readFileSync("config/enchev-dependency-lockfile-gate.json","utf8"));
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
const workflow=fs.readFileSync(".github/workflows/verify-enchev-web.yml","utf8");
const preGate=fs.readFileSync("scripts/run-system-test-pre-gates.mjs","utf8");

function fail(message){throw new Error("DEPENDENCY_LOCKFILE_GATE FAIL: "+message);}
function same(a,b){return JSON.stringify(a||{})===JSON.stringify(b||{});}

export function validate(c,p,l,w,g){
  if(c?.taskId!=="26.08"||c?.name!=="Dependency lockfile enforcement"||c?.gateVersion!==1)fail("identity drift");
  if(c?.packageManager!=="npm"||c?.lockfile!=="package-lock.json"||c?.lockfileVersion!==3||c?.nodeMajor!==24)fail("manager contract drift");
  for(const key of ["rootLockfileRequired","singlePackageManager","npmCiRequiredInCi","npmInstallForbiddenInCi","lockfileManifestConsistencyRequired","lockfileIntegrityMetadataRequired","ciFailureBlocksGreen"]){
    if(c.rules?.[key]!==true)fail("rule disabled: "+key);
  }
  if(l?.lockfileVersion!==3||l?.name!==p?.name||l?.version!==p?.version)fail("lock identity drift");
  const root=l?.packages?.[""];
  if(!root)fail("root package missing");
  if(!same(root.dependencies,p.dependencies))fail("dependencies drift");
  if(!same(root.devDependencies,p.devDependencies))fail("devDependencies drift");
  if(JSON.stringify(root.workspaces||[])!==JSON.stringify(p.workspaces||[]))fail("workspaces drift");
  if(!w.includes("cache-dependency-path: package-lock.json"))fail("cache path drift");
  const canonical=["npm","ci","--no-audit","--no-fund"].join(" ");
  if(!w.includes("run: "+canonical))fail("canonical CI install missing");
  const resolving=["npm","install"].join(" ");
  if(w.includes("run: "+resolving))fail("resolving install remains in CI");
  if(!g.includes('["scripts/verify-dependency-lockfile-enforcement.mjs", "--self-test"]'))fail("pre-gate missing");
  return true;
}

validate(config,pkg,lock,workflow,preGate);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{
    const box={config:structuredClone(config),pkg:structuredClone(pkg),lock:structuredClone(lock),workflow,preGate};
    mutate(box);
    let rejected=false;
    try{validate(box.config,box.pkg,box.lock,box.workflow,box.preGate);}catch{rejected=true;}
    if(!rejected)fail("negative case accepted: "+label);
    cases++;
  };
  reject("lock version",x=>{x.lock.lockfileVersion=2;});
  reject("dependency drift",x=>{x.lock.packages[""].dependencies.next="0.0.0";});
  reject("cache drift",x=>{x.workflow=x.workflow.replace("cache-dependency-path: package-lock.json","cache-dependency-path: package.json");});
  reject("CI install drift",x=>{x.workflow=x.workflow.replace(["npm","ci"].join(" "),["npm","install"].join(" "));});
  reject("pre-gate removed",x=>{x.preGate=x.preGate.replace('["scripts/verify-dependency-lockfile-enforcement.mjs", "--self-test"]',"");});
  console.log("DEPENDENCY_LOCKFILE_GATE_SELF_TEST PASS cases="+cases+" fail_closed=true");
}else{
  console.log("DEPENDENCY_LOCKFILE_GATE PASS task=26.08 manager=npm lockfileVersion=3 npm_ci=true");
}

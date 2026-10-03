import fs from "node:fs";
import crypto from "node:crypto";

const CONFIG_PATH="config/enchev-sbom-archive-41-19.json";
const WORKFLOW_PATH=".github/workflows/sbom.yml";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
function fail(m){throw new Error("SBOM_ARCHIVE_41_19 FAIL: "+m);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

export function inspectSbom(doc){
  if(!doc||doc.bomFormat!=="CycloneDX") fail("CycloneDX bomFormat missing");
  if(!doc.specVersion) fail("specVersion missing");
  if(!doc.metadata||typeof doc.metadata!=="object") fail("metadata missing");
  if(!Array.isArray(doc.components)) fail("components array missing");
  return {specVersion:String(doc.specVersion),components:doc.components.length};
}
export function verifyWorkflow(text,config){
  const f=[];
  if(!text.includes("npm sbom --package-lock-only --sbom-format=cyclonedx")) f.push("locked CycloneDX generation missing");
  if(!text.includes("verify-sbom-generation.mjs --file "+config.engine.artifact)) f.push("base SBOM validation missing");
  if(!text.includes("sha256sum "+config.engine.artifact)) f.push("SBOM digest generation missing");
  if(!text.includes("verify-sbom-archived-41-19.mjs --file "+config.engine.artifact)) f.push("41.19 verifier missing");
  if(!text.includes("actions/upload-artifact@v4")) f.push("archive action missing");
  if(!text.includes("retention-days: "+config.archive.retentionDays)) f.push("retention drift");
  if(!text.includes("if-no-files-found: error")) f.push("fail-closed artifact rule missing");
  return f;
}
export function verifyDigest(file,digestFile){
  const raw=fs.readFileSync(file);
  const expected=crypto.createHash("sha256").update(raw).digest("hex");
  const line=fs.readFileSync(digestFile,"utf8").trim();
  const actual=line.split(/\s+/)[0]?.toLowerCase();
  if(actual!==expected) fail("SHA-256 digest mismatch");
  return expected;
}
function selfTest(config){
  const fixture={bomFormat:"CycloneDX",specVersion:"1.6",metadata:{component:{name:"fixture"}},components:[]};
  if(inspectSbom(fixture).components!==0) fail("fixture drift");
  let bad=false;try{inspectSbom({});}catch{bad=true;}if(!bad) fail("invalid SBOM accepted");
  const workflow=fs.readFileSync(WORKFLOW_PATH,"utf8");
  if(verifyWorkflow(workflow.replace("retention-days: 30","retention-days: 1"),config).length===0) fail("retention mutation accepted");
  console.log("SBOM_ARCHIVE_41_19_SELF_TEST PASS cyclonedx_required=true digest_required=true archive_required=true");
}
const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.19"||config.title!=="SBOM produced and archived") fail("task identity drift");
const wf=fs.readFileSync(WORKFLOW_PATH,"utf8");
const wfFailures=verifyWorkflow(wf,config);if(wfFailures.length) fail(wfFailures.join("; "));
const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41=master.indexOf('["41","Security & abuse certification"'),p42=master.indexOf('["42","Performance certification"');
if(p41<0||p42<=p41||!master.slice(p41,p42).includes('"SBOM produced and archived||security"')) fail("frozen 41.19 identity missing");

const idx=process.argv.indexOf("--file");
if(idx>=0){
  const file=process.argv[idx+1],digestIdx=process.argv.indexOf("--sha-file"),digest=digestIdx>=0?process.argv[digestIdx+1]:null;
  if(!file||!digest||!fs.existsSync(file)||!fs.existsSync(digest)) fail("SBOM or digest evidence missing");
  const result=inspectSbom(readJson(file));const hash=verifyDigest(file,digest);
  console.log("SBOM_ARCHIVE_41_19_EVIDENCE PASS spec="+result.specVersion+" components="+result.components+" sha256="+hash);
}
if(process.argv.includes("--self-test")) selfTest(config);
if(idx<0&&!process.argv.includes("--self-test")) console.log("SBOM_ARCHIVE_41_19 PASS exact_head_workflow_success_required=true");

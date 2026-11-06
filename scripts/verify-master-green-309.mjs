import fs from "node:fs";

const SRC = "app/components/VerifiedPlanEvidenceSync.tsx";
const CONTRACT = "config/enchev-rate-limit-response-contract.json";
const DOC = "docs/24_08_RATE_LIMIT_RESPONSE_CONTRACT.md";
const source = fs.readFileSync(SRC, "utf8");
const contract = JSON.parse(fs.readFileSync(CONTRACT, "utf8"));
const doc = fs.readFileSync(DOC, "utf8");

function fail(message) { throw Error("MASTER_GREEN_309 FAIL: " + message); }

export function inspect(candidate) {
  const start = candidate.indexOf("const VERIFIED_WAVE_0: Record<string, string> = {");
  const end = candidate.indexOf("\n};", start);
  if (start < 0 || end < 0) fail("registry missing");
  const block = candidate.slice(start, end);
  const rows = [...block.matchAll(/^\s*"([0-9]{2}\.[0-9]{2})":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)];
  const ids = rows.map(x=>x[1]);
  if (ids.length < 309) fail("fewer than 309 verified proof rows");
  if (new Set(ids).size !== ids.length) fail("duplicate verified IDs");
  if (!ids.includes("24.07") || !ids.includes("24.08")) fail("adjacent verified IDs are missing");
  const proofLine = rows.find(x=>x[1]==="24.08");
  if (!proofLine) fail("24.08 proof missing");
  const evidence = JSON.parse('"' + proofLine[2] + '"');
  for (const needed of [
    "Rate-limit response contract",
    "f3d41ad7ee6be1763e429d3bbf56ab1248757ced",
    "b8d1d16f98c7187efc146b64cdf2aee3d0a46620",
    "35627130038 SUCCESS",
    "429",
    "Retry-After"
  ]) if (!evidence.includes(needed)) fail("evidence field missing: " + needed);
  return {rows:ids.length,taskId:"24.08"};
}

const found=inspect(source);
if (contract.taskId !== "24.08" || contract.status !== 429 ||
  contract.errorCode !== "RATE_LIMITED" || !contract.behavior?.failClosedOnInvalidMetadata) fail("shared rate-limit contract drift");
if (!doc.includes("35627130038") || !doc.includes("b8d1d16f98c7187efc146b64cdf2aee3d0a46620")) fail("canonical independent evidence drift");

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,value)=>{
    let denied=false;
    try{inspect(value);}catch{denied=true;}
    if(!denied)fail("negative proof accepted: " + label);
    cases++;
  };
  reject("remove 24.08",source.replace(/^\s*"24\.08":.*\n/m,"\n"));
  reject("duplicate 24.08",source.replace(/(\s*"24\.08":.*\n)/, "$1$1"));
  reject("broken SHA",source.replace("f3d41ad7ee6be1763e429d3bbf56ab1248757ced","UNKNOWN"));
  reject("missing passing CI",source.replace("35627130038 SUCCESS","35627130038 PENDING"));
  console.log("MASTER_GREEN_309_SELF_TEST PASS negative_cases="+cases+" source_rows="+found.rows+" cloud_write=false");
}else {
  console.log("MASTER_GREEN_309 PASS task=24.08 verified_source_rows="+found.rows+" cloud_write=false");
}

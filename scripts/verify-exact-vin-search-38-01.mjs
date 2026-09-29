import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH="packages/config/src/exact-vin-search.ts";
const INDEX_PATH="packages/config/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/38_01_EXACT_VIN_SEARCH.md";

function fail(message){throw new Error("EXACT_VIN_SEARCH_38_01 FAIL: "+message);}
function frozenIdentity(){
 const source=fs.readFileSync(MASTER_PATH,"utf8");
 const start=source.indexOf('["38"'), end=source.indexOf('["39"',start);
 if(start<0||end<0)fail("phase 38 frozen plan missing");
 const slice=source.slice(start,end);
 if(!slice.includes('"Exact VIN search"'))fail("38.01 frozen identity drift");
 return "38.01";
}
async function load(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-vin-search-"));
 try{
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const result=spawnSync(process.execPath,[tsc,SOURCE_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(result.status!==0)fail("TypeScript compile failed: "+(result.stderr||result.stdout||"").trim());
  return await import(pathToFileURL(path.join(tmp,"exact-vin-search.js")).href+"?v="+Date.now());
 }finally{setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);}
}

if(frozenIdentity()!=="38.01")fail("task id drift");
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./exact-vin-search";'))fail("public export missing");
const doc=fs.readFileSync(DOC_PATH,"utf8");
for(const token of ["17-character VIN","exact equality","I, O and Q","partial VIN","duplicate normalized VIN"])if(!doc.includes(token))fail("documentation missing boundary: "+token);

const d=await load();
const vin="WBS3R9C50JAK10482";
if(d.normalizeExactVin(" "+vin.toLowerCase()+" ")!==vin)fail("case/trim normalization drift");
for(const bad of ["","WBS3R9","WBS3R9C50JAK1048","WBS3R9C50JAK104822","WBS3R9C50JAK10O82","WBS3R9C50JAK10I82","WBS3R9C50JAK10Q82","WВS3R9C50JAK10482"]){
 if(d.normalizeExactVin(bad)!==null)fail("invalid VIN accepted: "+bad);
}
const docs=[
 {vin,value:{lot:"EA-10482"}},
 {vin:"WDC0G4KB1MF10511",value:{lot:"EA-10511"}},
 {vin:"invalid",value:{lot:"bad"}}
];
const hit=d.searchExactVin(vin.toLowerCase(),docs);
if(hit.normalizedVin!==vin||hit.match?.lot!=="EA-10482")fail("exact VIN hit drift");
if(d.searchExactVin("WBS3R9C50JAK10481",docs).match!==null)fail("near VIN must not match");
if(d.searchExactVin("WBS3R9C50JAK1048",docs).match!==null)fail("partial VIN must not match");

if(process.argv.includes("--self-test")){
 let duplicateRejected=false;
 try{d.searchExactVin(vin,[...docs,{vin:vin.toLowerCase(),value:{lot:"duplicate"}}]);}catch{duplicateRejected=true;}
 if(!duplicateRejected)fail("duplicate normalized VIN not rejected");
 console.log("EXACT_VIN_SEARCH_38_01_SELF_TEST PASS task=38.01 exact=true invalid_cases=8 partial_rejected=true confusable_rejected=true duplicate_rejected=true");
}else{
 console.log("EXACT_VIN_SEARCH_38_01 PASS task=38.01 exact=true");
}

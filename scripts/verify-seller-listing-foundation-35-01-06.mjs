import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-seller-listing-foundation-35-01-06.json";
const DOMAIN_PATH="packages/domain/src/seller-listing-foundation.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("SELLER_LISTING_35_01_06 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="35");
  if(!phase) fail("phase 35 missing");
  return phase[2].slice(0,6).map((entry,index)=>({id:"35."+String(index+1).padStart(2,"0"),name:String(entry).split("|")[0],kind:"feature"}));
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-seller-listing-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"seller-listing-foundation.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
if(JSON.stringify(config.tasks.map(x=>[x.id,x.name,x.kind]))!==JSON.stringify(frozenTasks().map(x=>[x.id,x.name,x.kind]))) fail("frozen 35.01-35.06 task identity drift");
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./seller-listing-foundation";')) fail("domain export missing");

const d=await loadDomain();
const base=d.normalizeSellerListingDraft({
  listingId:"l1",sellerId:"seller-1",vehicleId:"v1",revision:0,updatedAt:"2026-09-27T13:00:00Z",wizardStep:"vehicle",
  fields:{vin:"WVWZZZ1JZXW000001",make:"VW",model:"Golf",year:"2020"},
  media:[],appliedMutationIds:[]
});

const wizard=d.sellerListingWizardState(base,config.requirements);
if(!wizard.canAdvance||wizard.next!=="condition") fail("35.01 wizard vehicle gate drift");

const saved=d.autosaveSellerListingDraft(base,{sellerId:"seller-1",mutationId:"m1",expectedRevision:0,occurredAt:"2026-09-27T13:01:00Z",wizardStep:"condition",fields:{condition:"Used - disclosed wear"}});
if(saved.revision!==1||saved.wizardStep!=="condition"||saved.fields.condition!=="Used - disclosed wear") fail("35.02 autosave drift");
const retry=d.autosaveSellerListingDraft(saved,{sellerId:"seller-1",mutationId:"m1",expectedRevision:0,occurredAt:"2026-09-27T13:01:00Z",fields:{condition:"ignored retry"}});
if(retry.revision!==1||retry.fields.condition!=="Used - disclosed wear") fail("35.02 idempotent retry drift");

const fieldCheck=d.requiredSellerListingFields(saved,[...config.requirements.vehicleFields,...config.requirements.conditionFields]);
if(!fieldCheck.ready) fail("35.03 field readiness drift");

const withMedia=d.autosaveSellerListingDraft(saved,{sellerId:"seller-1",mutationId:"m2",expectedRevision:1,occurredAt:"2026-09-27T13:02:00Z",wizardStep:"pricing",fields:{reservePriceCents:"1250000"},media:[
  {id:"ex1",kind:"exterior-photo",uri:"s3://listing/ex.jpg",order:1},
  {id:"in1",kind:"interior-photo",uri:"s3://listing/in.jpg",order:2},
  {id:"vin1",kind:"vin-photo",uri:"s3://listing/vin.jpg",order:3}
]});
const mediaCheck=d.requiredSellerListingMedia(withMedia,config.requirements.requiredMediaKinds);
if(!mediaCheck.ready) fail("35.04 media readiness drift");

const preview=d.buildSellerListingPreview(withMedia,config.requirements);
if(!preview.submitReady||"sellerId" in preview||"appliedMutationIds" in preview) fail("35.05 preview privacy/readiness drift");

let thread=[];
thread=d.addPublicVehicleQuestion(thread,{questionId:"q1",vehicleId:"v1",askerUserId:"buyer-1",body:"Does the vehicle include two keys?",createdAt:"2026-09-27T13:03:00Z",status:"published"});
thread=d.addPublicVehicleQuestion(thread,{questionId:"q2",vehicleId:"v1",askerUserId:"buyer-2",body:"Hidden moderation sample",createdAt:"2026-09-27T13:04:00Z",status:"hidden"});
thread=d.addPublicVehicleQuestion(thread,{questionId:"q3",vehicleId:"v2",askerUserId:"buyer-3",body:"Other vehicle",createdAt:"2026-09-27T13:05:00Z",status:"published"});
const publicQ=d.publicVehicleQuestions(thread,"v1");
if(publicQ.length!==1||publicQ[0].questionId!=="q1") fail("35.06 public Q&A filtering drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("missing vehicle field",()=>d.normalizeSellerListingDraft({...base,fields:{...base.fields,vin:" "}}));
  await reject("cross seller autosave",()=>d.autosaveSellerListingDraft(base,{sellerId:"seller-2",mutationId:"x",expectedRevision:0,occurredAt:"2026-09-27T13:06:00Z"}));
  await reject("stale revision",()=>d.autosaveSellerListingDraft(saved,{sellerId:"seller-1",mutationId:"x2",expectedRevision:0,occurredAt:"2026-09-27T13:06:00Z"}));
  const missingMedia=d.requiredSellerListingMedia(saved,config.requirements.requiredMediaKinds);
  if(missingMedia.ready||missingMedia.missing.length!==3) fail("missing media not detected");
  const incompletePreview=d.buildSellerListingPreview(saved,config.requirements);
  if(incompletePreview.submitReady) fail("incomplete preview marked submit-ready");
  await reject("duplicate question",()=>d.addPublicVehicleQuestion(thread,{...thread[0]}));
  await reject("question too long",()=>d.addPublicVehicleQuestion([],{questionId:"long",vehicleId:"v1",askerUserId:"u",body:"x".repeat(1001),createdAt:"2026-09-27T13:07:00Z",status:"published"}));
  await reject("question limit",()=>d.addPublicVehicleQuestion([thread[0]],{questionId:"q4",vehicleId:"v1",askerUserId:"u",body:"x",createdAt:"2026-09-27T13:07:00Z",status:"published"},1));
  console.log("SELLER_LISTING_35_01_06_SELF_TEST PASS tasks=6 negative_cases=8");
}else{
  console.log("SELLER_LISTING_35_01_06 PASS tasks=6 autosave_idempotent=true preview_ready=true qa_public=true");
}

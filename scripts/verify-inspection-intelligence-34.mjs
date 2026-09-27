import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-inspection-intelligence-34.json";
const DOMAIN_PATH="packages/domain/src/inspection-intelligence.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error("INSPECTION_INTELLIGENCE_34 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="34");
  if(!phase) fail("phase 34 missing");
  return phase[2].map((entry,index)=>({id:"34."+String(index+1).padStart(2,"0"),raw:String(entry),name:String(entry).split("|")[0],kind:String(entry).includes("||ai")?"ai":String(entry).includes("||test")?"test":"feature"}));
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-inspection-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"inspection-intelligence.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
const frozen=frozenTasks();
if(frozen.length!==20) fail("phase 34 task count drift");
const expected=config.tasks.map(x=>[x.id,x.name,x.kind]);
const actual=frozen.map(x=>[x.id,x.name,x.kind]);
if(JSON.stringify(expected)!==JSON.stringify(actual)) fail("frozen Phase 34 task identity/kind drift");
const binding=readJson(BINDING_PATH);
if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
if(config.authority?.aiDamageAuthoritative!==false||config.authority?.governanceSupabaseAuthoritative!==false) fail("authority drift");
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./inspection-intelligence";')) fail("domain export missing");

const d=await loadDomain();
const sha="a".repeat(64);
const media=[
  {id:"m-cold",kind:"cold-start-video",angle:"engine-front",uri:"s3://inspection/cold.mp4",mimeType:"video/mp4",sha256:sha,bytes:1000,capturedAt:"2026-09-27T12:00:00Z",order:4},
  {id:"m-walk",kind:"walk-around-video",angle:"360",uri:"s3://inspection/walk.mp4",mimeType:"video/mp4",sha256:"b".repeat(64),bytes:2000,capturedAt:"2026-09-27T12:01:00Z",order:5},
  {id:"m-audio",kind:"engine-audio",angle:"engine-bay",uri:"s3://inspection/engine.m4a",mimeType:"audio/mp4",sha256:"c".repeat(64),bytes:500,capturedAt:"2026-09-27T12:02:00Z",order:6},
  {id:"m-under",kind:"undercarriage-video",angle:"underside",uri:"s3://inspection/under.mp4",mimeType:"video/mp4",sha256:"d".repeat(64),bytes:1500,capturedAt:"2026-09-27T12:03:00Z",order:7},
  {id:"p-front",kind:"photo",angle:"front",uri:"s3://inspection/front.jpg",mimeType:"image/jpeg",sha256:"e".repeat(64),bytes:300,capturedAt:"2026-09-27T11:57:00Z",order:1},
  {id:"p-rear",kind:"photo",angle:"rear",uri:"s3://inspection/rear.jpg",mimeType:"image/jpeg",sha256:"f".repeat(64),bytes:310,capturedAt:"2026-09-27T11:58:00Z",order:2},
  {id:"p-int",kind:"photo",angle:"interior",uri:"s3://inspection/interior.jpg",mimeType:"image/jpeg",sha256:"1".repeat(64),bytes:320,capturedAt:"2026-09-27T11:59:00Z",order:3}
];

const report=d.normalizeInspectionReport({
  reportId:"r1",vehicleId:"v1",version:1,status:"submitted",
  sellerDeclaration:{declaredByUserId:"seller-1",declaredAt:"2026-09-27T10:00:00Z",summary:"Known cosmetic wear disclosed",knownIssues:["rear-bumper-scratch"]},
  inspector:{inspectorId:"inspector-1",capturedAt:"2026-09-27T12:04:00Z"},
  media,
  damageMap:[{id:"d1",bodyArea:"rear-bumper",x:0.72,y:0.61,severity:2,description:"scratch",source:"inspector"}],
  obdCodes:[{code:"P0300",system:"powertrain",status:"stored"}],
  paintMeasurements:[{panel:"hood",microns:118}],
  tires:[
    {position:"front-left",treadMm:6.2,pressureKpa:230,condition:"good"},
    {position:"front-right",treadMm:6.1,pressureKpa:231,condition:"good"},
    {position:"rear-left",treadMm:5.8,pressureKpa:228,condition:"good"},
    {position:"rear-right",treadMm:5.9,pressureKpa:229,condition:"good"}
  ],
  components:[
    {group:"glass",item:"windshield",status:"good",note:null},
    {group:"lights",item:"headlights",status:"good",note:null},
    {group:"interior",item:"driver-seat",status:"good",note:null}
  ]
});

if(report.reportId!=="r1"||report.vehicleId!=="v1") fail("34.01 structured schema drift");
if(report.sellerDeclaration.declaredByUserId!=="seller-1") fail("34.02 seller declaration drift");
if(report.inspector.inspectorId!=="inspector-1"||!report.inspector.capturedAt.endsWith("Z")) fail("34.03 inspector provenance drift");
for(const pair of [["34.04","cold-start-video"],["34.05","walk-around-video"],["34.06","engine-audio"],["34.07","undercarriage-video"]]) if(!report.media.some(x=>x.kind===pair[1])) fail(pair[0]+" required media missing");
if(report.damageMap[0]?.x!==0.72||report.damageMap[0]?.bodyArea!=="rear-bumper") fail("34.08 damage map drift");
if(report.obdCodes[0]?.code!=="P0300") fail("34.09 OBD capture drift");
if(report.paintMeasurements[0]?.microns!==118) fail("34.10 paint measurement drift");
if(report.tires.length!==4) fail("34.11 tire fields drift");
if(new Set(report.components.map(x=>x.group)).size!==3) fail("34.12 component fields drift");

const checklist=d.buildInspectionPhotoChecklist(report.media,config.requirements.requiredPhotoAngles);
if(!checklist.every(x=>x.complete)) fail("34.13 photo checklist incomplete");
const angles=d.validateRequiredMediaAngles(report.media,config.requirements.requiredPhotoAngles);
if(!angles.complete) fail("34.14 required-angle validation drift");
const orders=report.media.map(x=>x.order);
if(JSON.stringify(orders)!==JSON.stringify([...orders].sort((a,b)=>a-b))) fail("34.14 media ordering drift");

const queued=d.enqueueInspectionTranscode(report.media.find(x=>x.id==="m-cold"));
const ready=d.completeInspectionTranscode(queued,"https://cdn.example.test/r1/m-cold/master.m3u8");
if(queued.state!=="queued"||ready.state!=="ready"||ready.variants.length!==2||!ready.manifestUri) fail("34.15 playback pipeline drift");
if(!d.verifyInspectionMediaIntegrity(report.media.find(x=>x.id==="m-cold"),sha,1000)) fail("34.16 media integrity drift");

const v2=d.createInspectionVersion(report,{...report,version:999,status:"submitted",sellerDeclaration:{...report.sellerDeclaration,summary:"Known cosmetic wear disclosed and rechecked"}});
if(v2.version!==2||report.version!==1) fail("34.17 immutable version drift");
const moderated=d.moderateInspection(v2,{moderatorId:"mod-1",action:"approve",reason:"Complete inspection reviewed",occurredAt:"2026-09-27T12:10:00Z"});
if(moderated.report.status!=="approved"||v2.status!=="submitted"||moderated.event.version!==2) fail("34.18 moderation drift");

const ai=d.recordAiDamageSuggestion(v2,{suggestionId:"ai-1",modelRef:"damage-model-v1",confidence:0.82,point:{id:"ai-d1",bodyArea:"front-door",x:0.31,y:0.44,severity:2,description:"possible dent"}});
if(ai.authoritativeDamageMap.length!==v2.damageMap.length||ai.authoritativeDamageMap.some(x=>x.id==="ai-d1")) fail("34.19 AI mutated authoritative damage map");

const complete=d.inspectionCompleteness(v2,config.requirements);
if(!complete.complete||complete.missing.length!==0) fail("34.20 completeness expected complete");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("invalid sha",()=>d.normalizeInspectionReport({...report,media:[{...media[0],sha256:"bad"}]}));
  await reject("damage coordinate",()=>d.normalizeInspectionReport({...report,damageMap:[{...report.damageMap[0],x:2}]}));
  await reject("OBD format",()=>d.normalizeInspectionReport({...report,obdCodes:[{...report.obdCodes[0],code:"BAD"}]}));
  await reject("paint bounds",()=>d.normalizeInspectionReport({...report,paintMeasurements:[{panel:"hood",microns:-1}]}));
  await reject("tire bounds",()=>d.normalizeInspectionReport({...report,tires:[{...report.tires[0],treadMm:99}]}));
  await reject("transcode audio",()=>d.enqueueInspectionTranscode(report.media.find(x=>x.kind==="engine-audio")));
  await reject("version identity",()=>d.createInspectionVersion(report,{...report,reportId:"other"}));
  await reject("AI confidence",()=>d.recordAiDamageSuggestion(report,{suggestionId:"x",modelRef:"m",confidence:2,point:{id:"x",bodyArea:"door",x:0.2,y:0.2,severity:1,description:"x"}}));
  if(d.verifyInspectionMediaIntegrity(report.media.find(x=>x.id==="m-cold"),sha,999)) fail("integrity mismatch accepted");
  const incomplete=d.inspectionCompleteness({...report,media:report.media.filter(x=>x.kind!=="cold-start-video")},config.requirements);
  if(incomplete.complete||!incomplete.missing.includes("media:cold-start-video")) fail("incomplete inspection not detected");
  const missingAngle=d.validateRequiredMediaAngles(report.media,["front","roof"]);
  if(missingAngle.complete||JSON.stringify(missingAngle.missing)!==JSON.stringify(["roof"])) fail("required-angle negative case drift");
  console.log("INSPECTION_INTELLIGENCE_34_SELF_TEST PASS tasks=20 negative_cases=11");
}else{
  console.log("INSPECTION_INTELLIGENCE_34 PASS tasks=20 complete=true ai_authoritative=false immutable_versions=true");
}

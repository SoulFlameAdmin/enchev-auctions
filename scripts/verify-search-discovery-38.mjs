import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-search-discovery-38.json";
const DOMAIN_PATH="packages/domain/src/search-discovery.ts";
const CROSS_SCRIPT_PATH="packages/config/src/cross-script-search.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const INVENTORY_PATH="app/inventory/page.tsx";
const DOC_PATH="docs/38_SEARCH_DISCOVERY_PERSONALIZATION.md";

function fail(message){throw new Error("SEARCH_DISCOVERY_38 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ",endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  if(start===-1||end===-1)fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="38");
  if(!phase)fail("phase 38 missing");
  return phase[2].map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    const kind=kindRaw==="global"?"global":kindRaw==="test"?"test":"feature";
    return {id:"38."+String(index+1).padStart(2,"0"),name,kind};
  });
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-search-discovery-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const result=spawnSync(process.execPath,[
    tsc,DOMAIN_PATH,CROSS_SCRIPT_PATH,
    "--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler",
    "--skipLibCheck","--rootDir","packages","--outDir",tmp,"--pretty","false"
  ],{encoding:"utf8"});
  if(result.status!==0)fail("domain TypeScript compile failed: "+(result.stderr||result.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"domain/src/search-discovery.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
const expected=frozenTasks();
if(expected.length!==19)fail("Phase 38 must contain 19 frozen tasks");
if(JSON.stringify(config.tasks)!==JSON.stringify(expected))fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH))fail("documentation missing");
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./search-discovery";'))fail("domain export missing");
const inventory=fs.readFileSync(INVENTORY_PATH,"utf8");
if(!inventory.includes('searchVehicleCatalog'))fail("real inventory is not wired to Phase 38 search engine");
if(!inventory.includes('window.history.replaceState'))fail("38.16 inventory URL state integration missing");

const d=await loadDomain();

const docs=[
  {id:"v1",lot:"EA-10001",vin:"WBA00000000010001",title:"2021 BMW X5 xDrive40i",make:"BMW",model:"X5 xDrive40i",year:2021,region:"Европа",location:"София, BG",damage:"Minor dents",titleStatus:"Clean",status:"live",priceCents:1900000,buyNowCents:2400000,updatedAt:"2026-09-29T05:00:00.000Z"},
  {id:"v2",lot:"EA-10002",vin:"WDD00000000010002",title:"2022 Mercedes-Benz GLC",make:"Mercedes",model:"GLC",year:2022,region:"Европа",location:"Munich, DE",damage:"Front end",titleStatus:"Salvage",status:"upcoming",priceCents:2100000,buyNowCents:0,updatedAt:"2026-09-29T05:01:00.000Z"},
  {id:"v3",lot:"EA-10003",vin:"WAU00000000010003",title:"2022 Audi RS3 Sportback",make:"Audi",model:"RS3 Sportback",year:2022,region:"Европа",location:"Crewe, UK",damage:"Minor scratches",titleStatus:"Clean",status:"open",priceCents:2200000,buyNowCents:2600000,updatedAt:"2026-09-29T05:02:00.000Z"},
  {id:"v4",lot:"EA-10004",vin:"WVW00000000010004",title:"2026 Volkswagen Golf GTI",make:"Volkswagen",model:"Golf GTI",year:2026,region:"Европа",location:"London, UK",damage:"Clean title",titleStatus:"Clean",status:"open",priceCents:1800000,buyNowCents:2050000,updatedAt:"2026-09-29T05:03:00.000Z"},
  {id:"v5",lot:"EA-10005",vin:"WBA00000000010005",title:"2020 BMW X5 xDrive40i",make:"BMW",model:"X5 xDrive40i",year:2020,region:"САЩ",location:"Texas, USA",damage:"Rear end",titleStatus:"Salvage",status:"sold",priceCents:1900000,buyNowCents:0,updatedAt:"2026-09-29T05:04:00.000Z"},
];

if(d.exactVinSearch("WDD00000000010002",docs)?.id!=="v2")fail("38.01 exact VIN search drift");
if(d.exactVinSearch("wdd00000000010002",docs)?.id!=="v2")fail("38.01 VIN case normalization drift");
if(d.exactLotNumberSearch("EA-10003",docs)?.id!=="v3")fail("38.02 exact LOT search drift");

const text=d.searchVehicleCatalog(docs,{query:"Audi RS3"});
if(text.length!==1||text[0].vehicle.id!=="v3"||text[0].reason!=="full-text")fail("38.03 full-text search drift");

const faceted=d.searchVehicleCatalog(docs,{facets:{makes:["BMW"],regions:["Европа"],statuses:["live"],yearFrom:2021}});
if(faceted.length!==1||faceted[0].vehicle.id!=="v1")fail("38.04 faceted filtering drift");

const typo=d.searchVehicleCatalog(docs,{query:"Mercedez GLC",typoTolerance:true});
if(typo.length!==1||typo[0].vehicle.id!=="v2"||typo[0].reason!=="typo")fail("38.05 typo tolerance drift");

if(d.normalizeMakeModelSynonyms("VW golfgti")!=="volkswagen golf gti")fail("38.06 synonym normalization drift");
const synonym=d.searchVehicleCatalog(docs,{query:"VW golfgti"});
if(synonym.length!==1||synonym[0].vehicle.id!=="v4")fail("38.06 synonym search integration drift");

const translit=d.searchVehicleCatalog(docs,{query:"sofiya"});
if(translit.length!==1||translit[0].vehicle.id!=="v1")fail("38.07 transliteration-aware search drift");
const crossScript=d.searchVehicleCatalog(docs,{query:"Ауди RS3"});
if(crossScript.length!==1||crossScript[0].vehicle.id!=="v3")fail("38.08 cross-script matching drift");

const sorted=d.searchVehicleCatalog(docs,{facets:{makes:["BMW"]},sort:"price-asc"});
if(sorted.map(x=>x.vehicle.lot).join(",")!=="EA-10001,EA-10005")fail("38.09 stable LOT tie-break sort drift");

const index=d.buildSearchIndex(docs,"catalog-r1","2026-09-29T05:10:00.000Z",1);
const fresh=d.assessSearchIndexFreshness(index,"catalog-r1",Date.parse("2026-09-29T05:10:30.000Z"),60_000);
if(!fresh.fresh||fresh.reason!=="fresh")fail("38.10 index freshness drift");
const stale=d.assessSearchIndexFreshness(index,"catalog-r2",Date.parse("2026-09-29T05:10:30.000Z"),60_000);
if(stale.fresh||stale.reason!=="revision-mismatch")fail("38.10 source revision freshness drift");

const rebuilt=d.rebuildSearchIndex(index,[...docs,{...docs[0],id:"v6",lot:"EA-10006",vin:"WBA00000000010006"}],"catalog-r2","2026-09-29T05:11:00.000Z");
if(rebuilt.revision!==2||rebuilt.sourceRevision!=="catalog-r2"||rebuilt.documents.length!==6)fail("38.11 index rebuild drift");

const fallback=d.searchWithOutageFallback({index,sourceDocuments:docs,expectedSourceRevision:"catalog-r2",nowMs:Date.parse("2026-09-29T05:11:00.000Z"),indexAvailable:true,request:{query:"Audi"}});
if(fallback.mode!=="source-fallback"||fallback.reason!=="index-stale"||fallback.results[0]?.vehicle.id!=="v3")fail("38.12 stale index fallback drift");
const outage=d.searchWithOutageFallback({index:null,sourceDocuments:docs,expectedSourceRevision:"catalog-r2",nowMs:Date.parse("2026-09-29T05:11:00.000Z"),indexAvailable:false,request:{query:"BMW"}});
if(outage.mode!=="source-fallback"||outage.reason!=="index-outage"||outage.results.length!==2)fail("38.12 outage fallback drift");

const similar=d.recommendSimilarVehicles(docs[0],docs,3);
if(similar[0]?.id!=="v5")fail("38.13 similar vehicle recommendation drift");

const recent=d.recommendRecentlyViewed(["v3","v1","v3","missing","v4"],docs,3);
if(recent.map(x=>x.id).join(",")!=="v3,v1,v4")fail("38.14 recently viewed ordering/dedupe drift");

const preset=d.createSavedFilterPreset({
  presetId:"preset-1",userId:"user-1",name:"BMW Europe",
  request:{query:"BMW",facets:{regions:["Европа"]},sort:"year-desc"},
  createdAt:"2026-09-29T05:12:00.000Z"
});
if(preset.name!=="BMW Europe"||preset.request.facets?.regions?.[0]!=="Европа"||!Object.isFrozen(preset))fail("38.15 saved preset drift");

const url=d.serializeSearchUrlState({query:"BMW",facets:{regions:["Европа"],makes:["BMW"],buyNowOnly:true},sort:"year-desc"},2);
if(url!=="q=BMW&make=BMW&region=%D0%95%D0%B2%D1%80%D0%BE%D0%BF%D0%B0&buyNow=1&sort=year-desc&page=2")fail("38.16 deterministic URL state drift: "+url);

const analytics=d.createSearchAnalyticsEvent({
  eventId:"search-event-1",event:"search-submitted",occurredAt:"2026-09-29T05:13:00.000Z",
  request:{query:"BMW",facets:{regions:["Европа"]},sort:"year-desc"},resultCount:1,source:"inventory"
});
if(analytics.queryLength!==3||!analytics.hasFacets||analytics.resultCount!==1||analytics.sort!=="year-desc")fail("38.17 search analytics drift");
if("vin" in analytics||"vehicle" in analytics||"bidderId" in analytics)fail("38.17 analytics leaked sensitive/raw identifiers");

const facets=d.buildFacets(docs);
if(facets.makes.BMW!==2||facets.regions["Европа"]!==4||facets.statuses.live!==1)fail("38.04 facet aggregation drift");

function generatedVehicle(i){
  const make=i%5===0?"BMW":i%5===1?"Mercedes":i%5===2?"Audi":i%5===3?"Volkswagen":"Porsche";
  const model=make==="BMW"?"X5":make==="Mercedes"?"GLC":make==="Audi"?"RS3":make==="Volkswagen"?"Golf GTI":"Macan S";
  return {
    id:"gen-"+i,
    lot:"EA-"+String(20000+i).padStart(5,"0"),
    vin:"TESTVIN"+String(i).padStart(10,"0"),
    title:String(2018+i%9)+" "+make+" "+model,
    make,model,year:2018+i%9,
    region:i%2===0?"Европа":"САЩ",
    location:i%2===0?"София, BG":"Texas, USA",
    damage:i%3===0?"Front end":"Minor dents",
    titleStatus:i%4===0?"Salvage":"Clean",
    status:i%7===0?"live":i%7===1?"upcoming":i%7===2?"sold":"open",
    priceCents:1000000+(i%500)*1000,
    buyNowCents:i%3===0?1500000+(i%500)*1000:0,
    updatedAt:new Date(Date.UTC(2026,8,29,5,0,i%60)).toISOString(),
  };
}

const baselineCatalog=Array.from({length:config.performance.baselineCatalogSize},(_,i)=>generatedVehicle(i));
const baseline=d.measureSearchPerformance(baselineCatalog,[
  {query:"BMW X5"},{query:"Mercedez GLC"},{query:"Ауди RS3"},{facets:{regions:["Европа"]},sort:"year-desc"}
]);
if(baseline.catalogSize!==1000||baseline.queries!==4||baseline.durationMs>config.performance.maxCiDurationMs)fail("38.18 performance baseline exceeded: "+baseline.durationMs+"ms");

const largeCatalog=Array.from({length:config.performance.largeCatalogSize},(_,i)=>generatedVehicle(i));
const load=d.measureSearchPerformance(largeCatalog,[
  {query:"BMW X5"},
  {query:"Mercedez GLC"},
  {query:"Ауди RS3"},
  {query:"VW golfgti"},
  {facets:{regions:["Европа"],statuses:["open","live"]},sort:"price-asc"},
  {facets:{buyNowOnly:true,yearFrom:2022},sort:"year-desc"}
]);
if(load.catalogSize!==20000||load.queries!==6||load.resultChecksum<=0||load.durationMs>config.performance.maxCiDurationMs)fail("38.19 large catalog load exceeded: "+load.durationMs+"ms");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("duplicate index id",()=>d.buildSearchIndex([docs[0],{...docs[1],id:docs[0].id}],"r","2026-09-29T05:10:00.000Z"));
  await reject("duplicate index lot",()=>d.buildSearchIndex([docs[0],{...docs[1],lot:docs[0].lot}],"r","2026-09-29T05:10:00.000Z"));
  await reject("duplicate index vin",()=>d.buildSearchIndex([docs[0],{...docs[1],vin:docs[0].vin}],"r","2026-09-29T05:10:00.000Z"));
  await reject("bad VIN",()=>d.buildSearchIndex([{...docs[0],vin:"ЕА-INVALID"}],"r","2026-09-29T05:10:00.000Z"));
  await reject("bad index revision",()=>d.buildSearchIndex(docs,"r","2026-09-29T05:10:00.000Z",0));
  await reject("bad freshness threshold",()=>d.assessSearchIndexFreshness(index,"catalog-r1",Date.now(),0));
  await reject("bad similar limit",()=>d.recommendSimilarVehicles(docs[0],docs,0));
  await reject("bad recent limit",()=>d.recommendRecentlyViewed([],docs,0));
  await reject("preset too long",()=>d.createSavedFilterPreset({presetId:"p",userId:"u",name:"x".repeat(81),request:{},createdAt:"2026-09-29T05:12:00.000Z"}));
  await reject("bad URL page",()=>d.serializeSearchUrlState({},0));
  await reject("bad analytics count",()=>d.createSearchAnalyticsEvent({eventId:"x",event:"search-submitted",occurredAt:"2026-09-29T05:13:00.000Z",request:{},resultCount:-1,source:"inventory"}));
  const confusable=d.exactLotNumberSearch("ЕА-10003",docs);
  if(confusable!==null)fail("identifier confusable must not match");
  console.log("SEARCH_DISCOVERY_38_SELF_TEST PASS tasks=19 negative_cases=11 baseline_ms="+baseline.durationMs.toFixed(1)+" load_catalog=20000 load_ms="+load.durationMs.toFixed(1)+" checksum="+load.resultChecksum);
}else{
  console.log("SEARCH_DISCOVERY_38 PASS tasks=19 baseline_ms="+baseline.durationMs.toFixed(1)+" load_ms="+load.durationMs.toFixed(1));
}

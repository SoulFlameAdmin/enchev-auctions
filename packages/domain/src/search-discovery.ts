import { foldCrossScriptSearchText, normalizeAsciiSearchIdentifier } from "../../config/src/cross-script-search";

export type SearchVehicle = Readonly<{
  id: string;
  lot: string;
  vin: string;
  title: string;
  make: string;
  model: string;
  year: number;
  region: string;
  location: string;
  damage: string;
  titleStatus: string;
  status: "live" | "upcoming" | "open" | "sold";
  priceCents: number;
  buyNowCents: number;
  updatedAt: string;
}>;

export type SearchSort =
  | "recommended"
  | "price-asc"
  | "price-desc"
  | "year-desc"
  | "year-asc"
  | "updated-desc";

export type SearchFacets = Readonly<{
  makes?: readonly string[];
  models?: readonly string[];
  regions?: readonly string[];
  locations?: readonly string[];
  damage?: readonly string[];
  titleStatuses?: readonly string[];
  statuses?: readonly SearchVehicle["status"][];
  yearFrom?: number;
  yearTo?: number;
  buyNowOnly?: boolean;
}>;

export type SearchRequest = Readonly<{
  query?: string;
  facets?: SearchFacets;
  sort?: SearchSort;
  typoTolerance?: boolean;
}>;

export type SearchResult = Readonly<{
  vehicle: SearchVehicle;
  score: number;
  reason:
    | "exact-vin"
    | "exact-lot"
    | "full-text"
    | "typo"
    | "facets-only";
}>;

export type SearchIndexSnapshot = Readonly<{
  revision: number;
  sourceRevision: string;
  builtAt: string;
  documents: readonly SearchVehicle[];
}>;

export type SearchFallbackResult = Readonly<{
  mode: "index" | "source-fallback";
  reason: "fresh-index" | "index-stale" | "index-outage";
  results: readonly SearchResult[];
}>;

export type SavedFilterPreset = Readonly<{
  presetId: string;
  userId: string;
  name: string;
  request: SearchRequest;
  createdAt: string;
}>;

export type SearchAnalyticsEvent = Readonly<{
  eventId: string;
  event: "search-submitted" | "result-opened" | "preset-applied";
  occurredAt: string;
  queryLength: number;
  resultCount: number;
  hasFacets: boolean;
  sort: SearchSort;
  source: "inventory" | "home" | "recommendation";
}>;

const MAKE_SYNONYMS: Readonly<Record<string,string>> = Object.freeze({
  "mercedes benz":"mercedes",
  "mercedes-benz":"mercedes",
  "merc":"mercedes",
  "benz":"mercedes",
  "vw":"volkswagen",
  "volks wagon":"volkswagen",
  "volks-wagen":"volkswagen",
  "bimmer":"bmw",
  "beemer":"bmw",
});

const MODEL_SYNONYMS: Readonly<Record<string,string>> = Object.freeze({
  "golfgti":"golf gti",
  "golf gti":"golf gti",
  "rs 3":"rs3",
  "rs-3":"rs3",
  "x 5":"x5",
  "x-5":"x5",
  "c 43":"c43",
  "c-43":"c43",
});

function required(value:string, code:string):string{
  const normalized=String(value??"").trim();
  if(!normalized)throw new Error(code);
  return normalized;
}

function utc(value:string, code:string):string{
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed)||!value.endsWith("Z"))throw new Error(code);
  const canonical=new Date(parsed).toISOString();
  if(canonical!==value)throw new Error(code);
  return canonical;
}

function positiveInt(value:number, code:string):number{
  if(!Number.isSafeInteger(value)||value<1)throw new Error(code);
  return value;
}

function validateVehicle(vehicle:SearchVehicle):SearchVehicle{
  required(vehicle.id,"SEARCH_VEHICLE_ID_REQUIRED");
  const lot=normalizeAsciiSearchIdentifier(vehicle.lot);
  const vin=normalizeAsciiSearchIdentifier(vehicle.vin);
  if(!lot)throw new Error("SEARCH_LOT_INVALID");
  if(!vin||vin.length<11)throw new Error("SEARCH_VIN_INVALID");
  required(vehicle.title,"SEARCH_TITLE_REQUIRED");
  required(vehicle.make,"SEARCH_MAKE_REQUIRED");
  required(vehicle.model,"SEARCH_MODEL_REQUIRED");
  required(vehicle.region,"SEARCH_REGION_REQUIRED");
  required(vehicle.location,"SEARCH_LOCATION_REQUIRED");
  required(vehicle.damage,"SEARCH_DAMAGE_REQUIRED");
  required(vehicle.titleStatus,"SEARCH_TITLE_STATUS_REQUIRED");
  if(!Number.isSafeInteger(vehicle.year)||vehicle.year<1886||vehicle.year>2200)throw new Error("SEARCH_YEAR_INVALID");
  if(!Number.isSafeInteger(vehicle.priceCents)||vehicle.priceCents<0)throw new Error("SEARCH_PRICE_INVALID");
  if(!Number.isSafeInteger(vehicle.buyNowCents)||vehicle.buyNowCents<0)throw new Error("SEARCH_BUY_NOW_INVALID");
  utc(vehicle.updatedAt,"SEARCH_UPDATED_AT_INVALID");
  return Object.freeze({...vehicle,lot,vin});
}

function normalizePhrase(value:string):string{
  const folded=foldCrossScriptSearchText(value)
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
  if(!folded)return "";
  return MAKE_SYNONYMS[folded]??MODEL_SYNONYMS[folded]??folded;
}

function normalizeQueryText(value:string):string{
  const base=normalizePhrase(value);
  if(!base)return "";
  const tokens=base.split(" ").map(token=>MAKE_SYNONYMS[token]??MODEL_SYNONYMS[token]??token);
  const joined=tokens.join(" ");
  return MAKE_SYNONYMS[joined]??MODEL_SYNONYMS[joined]??joined;
}

function documentText(vehicle:SearchVehicle):string{
  return [
    vehicle.title,vehicle.make,vehicle.model,vehicle.region,vehicle.location,
    vehicle.damage,vehicle.titleStatus,String(vehicle.year),
  ].map(normalizePhrase).join(" ");
}

function levenshtein(a:string,b:string):number{
  if(a===b)return 0;
  if(!a.length)return b.length;
  if(!b.length)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  const curr=new Array<number>(b.length+1);
  for(let i=1;i<=a.length;i++){
    curr[0]=i;
    for(let j=1;j<=b.length;j++){
      curr[j]=Math.min(
        curr[j-1]+1,
        prev[j]+1,
        prev[j-1]+(a[i-1]===b[j-1]?0:1),
      );
    }
    for(let j=0;j<=b.length;j++)prev[j]=curr[j];
  }
  return prev[b.length];
}

function tokenTypoMatch(query:string, text:string):boolean{
  const qTokens=query.split(" ").filter(Boolean);
  const dTokens=text.split(" ").filter(Boolean);
  return qTokens.every(q=>{
    const maxDistance=q.length<=4?1:q.length<=8?2:3;
    return dTokens.some(d=>Math.abs(d.length-q.length)<=maxDistance&&levenshtein(q,d)<=maxDistance);
  });
}

function containsAll(query:string,text:string):boolean{
  const tokens=query.split(" ").filter(Boolean);
  return tokens.every(token=>text.includes(token));
}

export function exactVinSearch(queryInput:string, documents:readonly SearchVehicle[]):SearchVehicle|null{
  const query=normalizeAsciiSearchIdentifier(queryInput);
  if(!query)return null;
  const rows=documents.map(validateVehicle);
  return rows.find(vehicle=>vehicle.vin===query)??null;
}

export function exactLotNumberSearch(queryInput:string, documents:readonly SearchVehicle[]):SearchVehicle|null{
  const query=normalizeAsciiSearchIdentifier(queryInput);
  if(!query)return null;
  const rows=documents.map(validateVehicle);
  return rows.find(vehicle=>vehicle.lot===query)??null;
}

export function normalizeMakeModelSynonyms(query:string):string{
  return normalizeQueryText(query);
}

export function matchesTypoTolerantText(queryInput:string, vehicle:SearchVehicle):boolean{
  const query=normalizeQueryText(queryInput);
  if(!query)return true;
  return tokenTypoMatch(query,documentText(validateVehicle(vehicle)));
}

function matchesFacets(vehicle:SearchVehicle, facets:SearchFacets|undefined):boolean{
  if(!facets)return true;
  const oneOf=(value:string,values:readonly string[]|undefined)=>!values?.length||values.includes(value);
  if(!oneOf(vehicle.make,facets.makes))return false;
  if(!oneOf(vehicle.model,facets.models))return false;
  if(!oneOf(vehicle.region,facets.regions))return false;
  if(!oneOf(vehicle.location,facets.locations))return false;
  if(!oneOf(vehicle.damage,facets.damage))return false;
  if(!oneOf(vehicle.titleStatus,facets.titleStatuses))return false;
  if(facets.statuses?.length&&!facets.statuses.includes(vehicle.status))return false;
  if(facets.yearFrom!==undefined&&vehicle.year<facets.yearFrom)return false;
  if(facets.yearTo!==undefined&&vehicle.year>facets.yearTo)return false;
  if(facets.buyNowOnly&&vehicle.buyNowCents<=0)return false;
  return true;
}

function scoreVehicle(vehicle:SearchVehicle,queryInput:string,typoTolerance:boolean):SearchResult|null{
  const raw=queryInput.trim();
  if(!raw)return {vehicle,score:0,reason:"facets-only"};
  const identifier=normalizeAsciiSearchIdentifier(raw);
  if(identifier&&vehicle.vin===identifier)return {vehicle,score:1000,reason:"exact-vin"};
  if(identifier&&vehicle.lot===identifier)return {vehicle,score:950,reason:"exact-lot"};
  const query=normalizeQueryText(raw);
  const text=documentText(vehicle);
  if(query&&containsAll(query,text)){
    const title=normalizePhrase(vehicle.title);
    const score=title.startsWith(query)?800:title.includes(query)?700:600;
    return {vehicle,score,reason:"full-text"};
  }
  if(typoTolerance&&query&&tokenTypoMatch(query,text))return {vehicle,score:400,reason:"typo"};
  return null;
}

function stableSort(results:SearchResult[],sort:SearchSort):SearchResult[]{
  return results.sort((a,b)=>{
    if(sort==="price-asc")return a.vehicle.priceCents-b.vehicle.priceCents||a.vehicle.lot.localeCompare(b.vehicle.lot);
    if(sort==="price-desc")return b.vehicle.priceCents-a.vehicle.priceCents||a.vehicle.lot.localeCompare(b.vehicle.lot);
    if(sort==="year-desc")return b.vehicle.year-a.vehicle.year||a.vehicle.lot.localeCompare(b.vehicle.lot);
    if(sort==="year-asc")return a.vehicle.year-b.vehicle.year||a.vehicle.lot.localeCompare(b.vehicle.lot);
    if(sort==="updated-desc")return Date.parse(b.vehicle.updatedAt)-Date.parse(a.vehicle.updatedAt)||a.vehicle.lot.localeCompare(b.vehicle.lot);
    return b.score-a.score||b.vehicle.year-a.vehicle.year||a.vehicle.lot.localeCompare(b.vehicle.lot);
  });
}

export function searchVehicleCatalog(
  documentsInput:readonly SearchVehicle[],
  request:SearchRequest={},
):readonly SearchResult[]{
  const documents=documentsInput.map(validateVehicle);
  const query=request.query??"";
  const typoTolerance=request.typoTolerance!==false;
  const sort=request.sort??"recommended";
  const results:SearchResult[]=[];
  for(const vehicle of documents){
    if(!matchesFacets(vehicle,request.facets))continue;
    const match=scoreVehicle(vehicle,query,typoTolerance);
    if(match)results.push(Object.freeze(match));
  }
  return Object.freeze(stableSort(results,sort));
}

export function buildFacets(documentsInput:readonly SearchVehicle[]):Readonly<{
  makes:Readonly<Record<string,number>>;
  models:Readonly<Record<string,number>>;
  regions:Readonly<Record<string,number>>;
  statuses:Readonly<Record<SearchVehicle["status"],number>>;
}>{
  const documents=documentsInput.map(validateVehicle);
  const count=(values:string[])=>Object.freeze(values.reduce<Record<string,number>>((acc,value)=>{
    acc[value]=(acc[value]??0)+1;return acc;
  },{}));
  const statusCount={live:0,upcoming:0,open:0,sold:0};
  for(const vehicle of documents)statusCount[vehicle.status]++;
  return Object.freeze({
    makes:count(documents.map(x=>x.make)),
    models:count(documents.map(x=>x.model)),
    regions:count(documents.map(x=>x.region)),
    statuses:Object.freeze(statusCount),
  });
}

export function buildSearchIndex(
  documentsInput:readonly SearchVehicle[],
  sourceRevisionInput:string,
  builtAtInput:string,
  revision=1,
):SearchIndexSnapshot{
  const sourceRevision=required(sourceRevisionInput,"SEARCH_INDEX_SOURCE_REVISION_REQUIRED");
  const builtAt=utc(builtAtInput,"SEARCH_INDEX_BUILT_AT_INVALID");
  positiveInt(revision,"SEARCH_INDEX_REVISION_INVALID");
  const documents=Object.freeze(documentsInput.map(validateVehicle).sort((a,b)=>a.lot.localeCompare(b.lot)));
  const ids=new Set<string>(),lots=new Set<string>(),vins=new Set<string>();
  for(const vehicle of documents){
    if(ids.has(vehicle.id))throw new Error("SEARCH_INDEX_DUPLICATE_ID");
    if(lots.has(vehicle.lot))throw new Error("SEARCH_INDEX_DUPLICATE_LOT");
    if(vins.has(vehicle.vin))throw new Error("SEARCH_INDEX_DUPLICATE_VIN");
    ids.add(vehicle.id);lots.add(vehicle.lot);vins.add(vehicle.vin);
  }
  return Object.freeze({revision,sourceRevision,builtAt,documents});
}

export function assessSearchIndexFreshness(
  index:SearchIndexSnapshot,
  expectedSourceRevision:string,
  nowMs:number,
  maxAgeMs=60_000,
):Readonly<{fresh:boolean;reason:"fresh"|"revision-mismatch"|"age-exceeded";ageMs:number}>{
  required(expectedSourceRevision,"SEARCH_FRESHNESS_SOURCE_REQUIRED");
  if(!Number.isFinite(nowMs))throw new Error("SEARCH_FRESHNESS_NOW_INVALID");
  if(!Number.isFinite(maxAgeMs)||maxAgeMs<1000)throw new Error("SEARCH_FRESHNESS_AGE_INVALID");
  const built=Date.parse(index.builtAt);
  const ageMs=Math.max(0,nowMs-built);
  if(index.sourceRevision!==expectedSourceRevision)return Object.freeze({fresh:false,reason:"revision-mismatch",ageMs});
  if(ageMs>maxAgeMs)return Object.freeze({fresh:false,reason:"age-exceeded",ageMs});
  return Object.freeze({fresh:true,reason:"fresh",ageMs});
}

export function rebuildSearchIndex(
  current:SearchIndexSnapshot|null,
  documents:readonly SearchVehicle[],
  sourceRevision:string,
  builtAt:string,
):SearchIndexSnapshot{
  return buildSearchIndex(documents,sourceRevision,builtAt,(current?.revision??0)+1);
}

export function searchWithOutageFallback(input:Readonly<{
  index:SearchIndexSnapshot|null;
  sourceDocuments:readonly SearchVehicle[];
  expectedSourceRevision:string;
  nowMs:number;
  indexAvailable:boolean;
  request:SearchRequest;
  maxAgeMs?:number;
}>):SearchFallbackResult{
  if(!input.indexAvailable||!input.index){
    return Object.freeze({mode:"source-fallback",reason:"index-outage",results:searchVehicleCatalog(input.sourceDocuments,input.request)});
  }
  const freshness=assessSearchIndexFreshness(input.index,input.expectedSourceRevision,input.nowMs,input.maxAgeMs);
  if(!freshness.fresh){
    return Object.freeze({mode:"source-fallback",reason:"index-stale",results:searchVehicleCatalog(input.sourceDocuments,input.request)});
  }
  return Object.freeze({mode:"index",reason:"fresh-index",results:searchVehicleCatalog(input.index.documents,input.request)});
}

export function recommendSimilarVehicles(
  anchorInput:SearchVehicle,
  documentsInput:readonly SearchVehicle[],
  limit=4,
):readonly SearchVehicle[]{
  const anchor=validateVehicle(anchorInput);
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new Error("SIMILAR_LIMIT_INVALID");
  const rows=documentsInput.map(validateVehicle).filter(x=>x.id!==anchor.id).map(vehicle=>{
    let score=0;
    if(vehicle.make===anchor.make)score+=50;
    if(vehicle.model===anchor.model)score+=35;
    score+=Math.max(0,20-Math.abs(vehicle.year-anchor.year)*4);
    const denominator=Math.max(1,anchor.priceCents);
    score+=Math.max(0,20-Math.round(Math.abs(vehicle.priceCents-anchor.priceCents)/denominator*20));
    if(vehicle.region===anchor.region)score+=5;
    return {vehicle,score};
  }).sort((a,b)=>b.score-a.score||a.vehicle.lot.localeCompare(b.vehicle.lot));
  return Object.freeze(rows.slice(0,limit).map(x=>x.vehicle));
}

export function recommendRecentlyViewed(
  recentlyViewedIds:readonly string[],
  documentsInput:readonly SearchVehicle[],
  limit=4,
):readonly SearchVehicle[]{
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new Error("RECENT_LIMIT_INVALID");
  const byId=new Map(documentsInput.map(validateVehicle).map(x=>[x.id,x] as const));
  const seen=new Set<string>(),rows:SearchVehicle[]=[];
  for(const id of recentlyViewedIds){
    if(seen.has(id))continue;
    seen.add(id);
    const vehicle=byId.get(id);
    if(vehicle)rows.push(vehicle);
    if(rows.length===limit)break;
  }
  return Object.freeze(rows);
}

export function createSavedFilterPreset(input:Readonly<{
  presetId:string;userId:string;name:string;request:SearchRequest;createdAt:string;
}>):SavedFilterPreset{
  const presetId=required(input.presetId,"PRESET_ID_REQUIRED");
  const userId=required(input.userId,"PRESET_USER_REQUIRED");
  const name=required(input.name,"PRESET_NAME_REQUIRED");
  const createdAt=utc(input.createdAt,"PRESET_CREATED_AT_INVALID");
  if(name.length>80)throw new Error("PRESET_NAME_TOO_LONG");
  const request=Object.freeze({
    query:input.request.query?.trim()??"",
    facets:input.request.facets?Object.freeze({...input.request.facets}):undefined,
    sort:input.request.sort??"recommended",
    typoTolerance:input.request.typoTolerance!==false,
  });
  return Object.freeze({presetId,userId,name,request,createdAt});
}

export function serializeSearchUrlState(request:SearchRequest,page=1):string{
  if(!Number.isSafeInteger(page)||page<1)throw new Error("SEARCH_URL_PAGE_INVALID");
  const params=new URLSearchParams();
  const query=request.query?.trim();
  if(query)params.set("q",query);
  const facets=request.facets;
  const addMany=(key:string,values:readonly string[]|undefined)=>values?.slice().sort().forEach(value=>params.append(key,value));
  addMany("make",facets?.makes);
  addMany("model",facets?.models);
  addMany("region",facets?.regions);
  addMany("location",facets?.locations);
  addMany("damage",facets?.damage);
  addMany("title",facets?.titleStatuses);
  addMany("status",facets?.statuses);
  if(facets?.yearFrom!==undefined)params.set("yearFrom",String(facets.yearFrom));
  if(facets?.yearTo!==undefined)params.set("yearTo",String(facets.yearTo));
  if(facets?.buyNowOnly)params.set("buyNow","1");
  if(request.sort&&request.sort!=="recommended")params.set("sort",request.sort);
  if(request.typoTolerance===false)params.set("typo","0");
  if(page>1)params.set("page",String(page));
  return params.toString();
}

export function createSearchAnalyticsEvent(input:Readonly<{
  eventId:string;event:SearchAnalyticsEvent["event"];occurredAt:string;
  request:SearchRequest;resultCount:number;source:SearchAnalyticsEvent["source"];
}>):SearchAnalyticsEvent{
  const eventId=required(input.eventId,"SEARCH_ANALYTICS_ID_REQUIRED");
  const occurredAt=utc(input.occurredAt,"SEARCH_ANALYTICS_TIME_INVALID");
  if(!Number.isSafeInteger(input.resultCount)||input.resultCount<0)throw new Error("SEARCH_ANALYTICS_RESULT_COUNT_INVALID");
  const facets=input.request.facets;
  const hasFacets=Boolean(facets&&(
    facets.makes?.length||facets.models?.length||facets.regions?.length||facets.locations?.length||
    facets.damage?.length||facets.titleStatuses?.length||facets.statuses?.length||
    facets.yearFrom!==undefined||facets.yearTo!==undefined||facets.buyNowOnly
  ));
  return Object.freeze({
    eventId,event:input.event,occurredAt,
    queryLength:(input.request.query??"").trim().length,
    resultCount:input.resultCount,
    hasFacets,
    sort:input.request.sort??"recommended",
    source:input.source,
  });
}

export function measureSearchPerformance(
  documents:readonly SearchVehicle[],
  requests:readonly SearchRequest[],
):Readonly<{catalogSize:number;queries:number;durationMs:number;resultChecksum:number}>{
  const start=performance.now();
  let resultChecksum=0;
  for(const request of requests){
    const results=searchVehicleCatalog(documents,request);
    resultChecksum+=results.length;
    for(const result of results.slice(0,10))resultChecksum+=result.vehicle.lot.length+result.score;
  }
  const durationMs=performance.now()-start;
  return Object.freeze({catalogSize:documents.length,queries:requests.length,durationMs,resultChecksum});
}

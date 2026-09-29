import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-international-proof-39.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const INDEX_PATH="packages/config/src/index.ts";
const DOC_PATH="docs/39_REAL_INTERNATIONAL_PROOF.md";
const RTL_PAGE_PATH="app/rtl-capability/page.tsx";

function fail(message){throw new Error("INTERNATIONAL_PROOF_39 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ",endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  if(start===-1||end===-1)fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="39");
  if(!phase)fail("phase 39 missing");
  return phase[2].map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"39."+String(index+1).padStart(2,"0"),name,kind:kindRaw==="global"?"global":kindRaw==="test"?"test":"feature"};
  });
}

async function loadModules(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-international-proof-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const sources=[
    "packages/config/src/international-proof.ts",
    "packages/config/src/country-market-bundle.ts",
    "packages/config/src/country-provider-routing.ts",
    "packages/config/src/country-data-residency-check.ts",
    "packages/config/src/timezone-aware-display.ts",
    "packages/config/src/locale-aware-date.ts",
    "packages/config/src/locale-fallback-chain.ts",
    "packages/config/src/rtl-layout-capability.ts",
    "packages/config/src/international-contact-models.ts",
    "packages/config/src/market-activation-gate.ts",
    "packages/config/src/market-activation-feature-flag.ts"
  ];
  const result=spawnSync(process.execPath,[tsc,...sources,
    "--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler",
    "--skipLibCheck","--rootDir","packages/config/src","--outDir",tmp,"--pretty","false"
  ],{encoding:"utf8"});
  if(result.status!==0)fail("TypeScript compile failed: "+(result.stderr||result.stdout||"").trim());

  for(const name of fs.readdirSync(tmp)){
    if(!name.endsWith(".js"))continue;
    const file=path.join(tmp,name);
    const emitted=fs.readFileSync(file,"utf8")
      .replace(/from "([.][/]?[^"]+?)(?<![.]js)";/g,'from "$1.js";')
      .replace(/from '([.][/]?[^']+?)(?<![.]js)';/g,"from '$1.js';")
      .replace(/import "([.][/]?[^"]+?)(?<![.]js)";/g,'import "$1.js";')
      .replace(/import '([.][/]?[^']+?)(?<![.]js)';/g,"import '$1.js';");
    fs.writeFileSync(file,emitted);
  }

  const load=async(name)=>await import(pathToFileURL(path.join(tmp,name+".js")).href+"?v="+Date.now());
  const modules={
    proof:await load("international-proof"),
    market:await load("country-market-bundle"),
    providers:await load("country-provider-routing"),
    residency:await load("country-data-residency-check"),
    time:await load("timezone-aware-display"),
    date:await load("locale-aware-date"),
    fallback:await load("locale-fallback-chain"),
    rtl:await load("rtl-layout-capability"),
    contacts:await load("international-contact-models"),
    gate:await load("market-activation-gate"),
    flag:await load("market-activation-feature-flag")
  };
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return modules;
}

const config=readJson(CONFIG_PATH);
const expected=frozenTasks();
if(expected.length!==18)fail("Phase 39 must contain 18 frozen tasks");
if(JSON.stringify(config.tasks)!==JSON.stringify(expected))fail("frozen Phase 39 task identity drift");
if(config.dryRunOnly!==true||config.realCustomerDataAllowed!==false)fail("proof safety boundary drift");
if(!fs.existsSync(DOC_PATH))fail("documentation missing");
const docs=fs.readFileSync(DOC_PATH,"utf8");
for(const token of ["dryRunOnly=true","realCustomerDataAllowed=false","does **not** activate a real market","39.18"]){
  if(!docs.includes(token))fail("documentation boundary missing: "+token);
}
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./international-proof";'))fail("international-proof public export missing");

const m=await loadModules();
const c1=config.countries.country1;
const c2=config.countries.country2;

function validateCountry(label,country){
  const bundle=m.market.validateCountryMarketBundle({
    countryProfile:country.countryProfile,
    kycProfile:country.kycProfile,
    legalProfile:country.legalProfile,
    documentProfile:country.documentProfile
  });
  if(!bundle.ok)fail(label+" market bundle invalid: "+bundle.errors.join("; "));
  const routes=m.providers.validateCountryProviderRoutes(country.providerRoutes,country.countryProfile);
  if(!routes.ok)fail(label+" provider routes invalid: "+routes.errors.join("; "));
  for(const capability of ["documents","identity","notifications","transport"]){
    const route=m.providers.resolveCountryProviderRoute(country.countryProfile,routes.value,capability);
    if(!route||route.mode!=="dry-run"||route.enabled!==true)fail(label+" provider capability missing: "+capability);
  }
  const residency=m.residency.evaluateCountryDataResidencyCheck(country.countryProfile,country.residencyPolicy,country.dataPlanes);
  if(!residency.completed||!residency.approved||residency.blockers.length!==0)fail(label+" residency proof not approved");
  return {bundle:bundle.value,routes:routes.value,residency};
}

const bg=validateCountry("country1",c1);
if(bg.bundle.countryProfile.countryCode!=="BG"||bg.bundle.countryProfile.defaultLocale!=="bg-BG")fail("39.01 country #1 configuration drift");

const de=validateCountry("country2",c2);
if(de.bundle.countryProfile.countryCode!=="DE"||de.bundle.countryProfile.defaultLocale!=="de-DE")fail("39.02 country #2 configuration drift");

const activationGate=m.gate.evaluateMarketActivationGate(
  c2.syntheticActivationApproval,c2.countryProfile,c2.kycProfile,c2.legalProfile,c2.documentProfile
);
if(!activationGate.active)fail("39.03 synthetic country #2 activation gate did not pass");
const activation=m.flag.applyMarketActivationFeatureFlag(c2.syntheticFeatureFlag,c2.countryProfile,activationGate);
if(!activation.active||activation.countryCode!=="DE")fail("39.03 synthetic country #2 feature activation did not pass");
const noRewrite=spawnSync(process.execPath,["scripts/verify-country-2-without-core-rewrite.mjs","--self-test"],{encoding:"utf8"});
if(noRewrite.status!==0)fail("39.03 existing no-core-rewrite invariant failed: "+(noRewrite.stderr||noRewrite.stdout||"").trim());

const registry=readJson(config.thirdLanguageDryRun.registryPath);
const third=readJson(config.thirdLanguageDryRun.messagePath);
const expectedKeys=[...registry.keys].sort();
const actualKeys=Object.keys(third.messages).sort();
if(third.locale!==config.thirdLanguageDryRun.locale||JSON.stringify(expectedKeys)!==JSON.stringify(actualKeys))fail("39.04 third-language package completeness drift");
if(config.thirdLanguageDryRun.productionShape!==true||config.thirdLanguageDryRun.sideEffects!==false||config.thirdLanguageDryRun.marketActivation!==false)fail("39.04 production dry-run safety drift");

let dstCases=0;
for(const countryCode of ["BG","DE"]){
  const fixture=config.timezoneDst[countryCode];
  for(const group of ["springForward","fallBack"]){
    for(const item of fixture[group]){
      const offset=m.proof.resolveTimeZoneOffsetMinutes(item.instant,fixture.timeZone);
      if(offset!==item.expectedOffsetMinutes)fail("39.05 DST offset drift "+countryCode+" "+item.instant+" expected="+item.expectedOffsetMinutes+" got="+offset);
      dstCases++;
    }
  }
}
if(dstCases!==8)fail("39.05 expected eight DST cases");

const instant=config.localeFormatting.dateInstant;
const bgDateTime=m.time.formatCountryProfileDateTime(instant,c1.countryProfile,"bg-BG","numeric");
const deDateTime=m.time.formatCountryProfileDateTime(instant,c2.countryProfile,"de-DE","numeric");
const bgDate=m.date.formatCountryProfileDate("2026-09-29",c1.countryProfile,"bg-BG","numeric");
const deDate=m.date.formatCountryProfileDate("2026-09-29",c2.countryProfile,"de-DE","numeric");
if(!bgDateTime||!deDateTime||!bgDate||!deDate||bgDateTime===deDateTime)fail("39.06 locale date/time formatting drift");

const value=config.localeFormatting.numberValue;
const bgNumber=m.proof.formatLocaleNumber(value,"bg-BG",{minimumFractionDigits:2,maximumFractionDigits:2});
const deNumber=m.proof.formatLocaleNumber(value,"de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
const enNumber=m.proof.formatLocaleNumber(value,"en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const eur=m.proof.formatLocaleNumber(config.localeFormatting.currencyValue,"de-DE",{style:"currency",currency:"EUR"});
if(!bgNumber.includes(",")||!deNumber.includes(",")||!enNumber.includes(".")||!eur.includes("€"))fail("39.07 locale number formatting drift");

const metric=m.proof.validateInternationalUnitProfile(config.unitProfiles.find(x=>x.countryCode==="BG"));
const imperial=m.proof.validateInternationalUnitProfile(config.unitProfiles.find(x=>x.countryCode==="US"));
const metricDistance=m.proof.formatDistanceFromKilometers(100,metric,"bg-BG");
const imperialDistance=m.proof.formatDistanceFromKilometers(100,imperial,"en-US");
const imperialMass=m.proof.formatMassFromKilograms(100,imperial,"en-US");
if(!metricDistance.endsWith(" km")||!imperialDistance.includes("62.1 mi")||!imperialMass.includes("220.5 lb"))fail("39.08 metric/imperial profile drift");

for(const address of config.contacts.addresses){
  const result=m.contacts.validateInternationalAddress(address);
  if(!result.ok)fail("39.09 international address rejected: "+result.errors.join("; "));
}
for(const phone of config.contacts.phones){
  const result=m.contacts.validateInternationalPhone(phone);
  if(!result.ok)fail("39.10 international phone rejected: "+result.errors.join("; "));
}

const normalizedText=m.proof.normalizeInternationalUserText(config.userTextFixture);
const normalizedJson=JSON.stringify(normalizedText);
if(!normalizedJson.includes("Mitüko")||!normalizedJson.includes("München")||!normalizedJson.includes("Köln")||normalizedJson.includes("\\u0308"))fail("39.11 recursive NFC user-text normalization drift");

const rtl=m.rtl.layoutDirectionAttributes({locale:config.rtlDryRun.locale,direction:config.rtlDryRun.direction});
if(!rtl||rtl.dir!=="rtl"||rtl.lang!=="ar-SA")fail("39.12 RTL direction dry-run drift");
const rtlPage=fs.readFileSync(RTL_PAGE_PATH,"utf8");
for(const token of ["dir={direction}","lang={lang}","data-rtl-probe"]){
  if(!rtlPage.includes(token))fail("39.12 RTL UI acceptance surface missing: "+token);
}

const fallback=m.fallback.resolveLocaleFallbackChain(c2.countryProfile,config.localeFallback.requestedLocale);
if(!fallback.ok||fallback.resolvedLocale!==config.localeFallback.expectedResolvedLocale||fallback.chain[0]!=="de-DE")fail("39.13 locale fallback drift");

const kycProfiles=[c1.kycProfile,c2.kycProfile];
if(m.proof.routeCountryScopedProfile("BG",kycProfiles)?.countryCode!=="BG"||m.proof.routeCountryScopedProfile("DE",kycProfiles)?.countryCode!=="DE")fail("39.14 country KYC routing drift");

const documentProfiles=[c1.documentProfile,c2.documentProfile];
if(m.proof.routeCountryScopedProfile("BG",documentProfiles)?.countryCode!=="BG"||m.proof.routeCountryScopedProfile("DE",documentProfiles)?.countryCode!=="DE")fail("39.15 country document routing drift");

for(const country of [c1,c2]){
  const identity=m.providers.resolveCountryProviderRoute(country.countryProfile,country.providerRoutes,"identity");
  const transport=m.providers.resolveCountryProviderRoute(country.countryProfile,country.providerRoutes,"transport");
  if(!identity||!transport||identity.countryCode!==country.countryProfile.countryCode||transport.countryCode!==country.countryProfile.countryCode)fail("39.16 provider routing drift "+country.countryProfile.countryCode);
}

if(!bg.residency.approved||!de.residency.approved)fail("39.17 regional data-flow/residency verification drift");

const enabled=m.proof.transitionCountryActivation(config.activationRollback.initial,config.activationRollback.enabled);
const rolledBack=m.proof.transitionCountryActivation(enabled,config.activationRollback.rolledBack);
if(!enabled.enabled||rolledBack.enabled||rolledBack.revision!==3||rolledBack.countryCode!=="DE")fail("39.18 activation rollback drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("cross-country activation",()=>m.proof.transitionCountryActivation(config.activationRollback.initial,{...config.activationRollback.enabled,countryCode:"BG"}));
  await reject("activation revision skip",()=>m.proof.transitionCountryActivation(config.activationRollback.initial,{...config.activationRollback.enabled,revision:3}));
  await reject("duplicate country-routed profile",()=>m.proof.routeCountryScopedProfile("DE",[c2.kycProfile,c2.kycProfile]));
  await reject("unit mismatch",()=>m.proof.validateInternationalUnitProfile({countryCode:"US",system:"imperial",distanceUnit:"km",massUnit:"lb"}));
  await reject("malformed Unicode user text",()=>m.proof.normalizeInternationalUserText({value:"\uD800"}));
  const badResidency=m.residency.evaluateCountryDataResidencyCheck(c2.countryProfile,c2.residencyPolicy,[{id:"bad-plane",region:"us-east-1",configured:true,customerData:true}]);
  if(badResidency.approved||badResidency.blockers.length===0)fail("negative residency fixture unexpectedly approved");
  const badRoute=m.providers.resolveCountryProviderRoute(c2.countryProfile,[{...c2.providerRoutes[0],countryCode:"BG"}],"documents");
  if(badRoute!==null)fail("cross-country provider route unexpectedly resolved");
  console.log("INTERNATIONAL_PROOF_39_SELF_TEST PASS tasks=18 countries=2 third_language=en-US dst_cases=8 negative_cases=7 config_driven=true no_core_rewrite=true rollback=true dry_run_only=true");
}else{
  console.log("INTERNATIONAL_PROOF_39 PASS tasks=18 countries=2 third_language=en-US dst_cases=8 config_driven=true rollback=true dry_run_only=true");
}

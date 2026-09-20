import fs from "node:fs";

const CONFIG_PATH="config/enchev-production-smoke-suite.json";
const RUNTIME_PATH="config/enchev-runtime-environments.json";
const HEALTH_PATH="config/enchev-health-endpoints.json";
const PACKAGE_PATH="package.json";

function fail(message){throw new Error(`PRODUCTION_SMOKE_SUITE FAIL: ${message}`);}
function same(a,b,label){if(JSON.stringify(a)!==JSON.stringify(b))fail(`${label} drift`);}

export function validate(config,runtime,health,pkg){
  if(config?.taskId!=="25.13")fail("taskId must be 25.13");
  if(config?.name!=="Production smoke suite"||config?.suiteVersion!==1)fail("identity drift");
  const env=config.environment;
  if(!env||env.role!=="production"||env.platform!=="vercel"||env.platformEnvironment!=="production")fail("production environment drift");
  if(env.branchPolicy!=="main-only"||env.productionAuthority!==true||env.baseUrlSource!=="canonical-runtime-config")fail("production authority contract drift");

  const prod=runtime?.environments?.find(item=>item.name==="production");
  if(!prod||prod.platform_environment!=="production"||prod.branch_policy!=="main-only"||prod.production_authority!==true)fail("01.07 production topology drift");
  const nonProd=(runtime?.environments||[]).filter(item=>item.name!=="production");
  if(nonProd.some(item=>item.production_authority===true))fail("non-production environment gained production authority");

  const expectedHealth=(health?.endpoints||[]).map(item=>({component:item.component,path:item.path,httpStatus:item.http_status,ready:item.ready,status:item.status}));
  same(config.healthChecks,expectedHealth,"health checks");
  same(config.pageChecks,[
    {name:"home",path:"/",httpStatus:200},
    {name:"inventory",path:"/inventory",httpStatus:200},
    {name:"lot-ea-10539",path:"/lot/EA-10539",httpStatus:200},
    {name:"live-auctions",path:"/live-auctions",httpStatus:200},
    {name:"profile",path:"/profile",httpStatus:200}
  ],"page checks");

  const p=config.requestPolicy;
  if(!p||p.method!=="GET"||p.redirect!=="error"||p.cache!=="no-store"||p.timeoutMs!==15000||p.mutatingRequestsForbidden!==true)fail("request policy drift");
  for(const key of ["canonicalProductionUrlOnly","allHealthChecksMustPass","allPageChecksMustPass","productionAuthorityMustRemainTrueOnlyForProduction","ciContractAndNegativeSelfTestsMustPass","liveProductionSmokeEvidenceRequiredBeforeGreen","liveEvidenceMustRecordObservedProductionDeployment"]){
    if(config.greenRules?.[key]!==true)fail(`GREEN rule disabled: ${key}`);
  }
  if(config.ownership?.runtimeEnvironmentTask!=="01.07"||config.ownership?.healthEndpointTask!=="01.10"||config.ownership?.stagingSmokeSuiteTask!=="25.12"||config.ownership?.failureInjectionHarnessTask!=="25.14")fail("ownership drift");
  if(pkg?.scripts?.["verify:production-smoke-suite"]!=="node scripts/verify-production-smoke-suite.mjs")fail("package verify script drift");
  if(pkg?.scripts?.["verify:production-smoke-suite:self-test"]!=="node scripts/verify-production-smoke-suite.mjs --self-test")fail("package self-test script drift");
  if(pkg?.scripts?.test!=="node scripts/verify-production-smoke-suite.mjs --self-test && node scripts/run-ci-tests.mjs")fail("aggregate npm test must gate 25.13");
  return {health:config.healthChecks.length,pages:config.pageChecks.length};
}

export function productionBaseUrl(runtime){
  let url;
  try{url=new URL(runtime.canonical_production_url);}catch{fail("canonical production URL invalid");}
  if(url.protocol!=="https:"||url.hostname!=="enchev-auctions.vercel.app"||(url.pathname!=="/"&&url.pathname!==""))fail("canonical production URL drift");
  return url.origin;
}

function validateHealth(check,status,body){
  if(status!==check.httpStatus)fail(`${check.component} HTTP ${status}, expected ${check.httpStatus}`);
  if(!body||typeof body!=="object"||body.component!==check.component)fail(`${check.component} response drift`);
  if(body.ready!==check.ready||body.ok!==check.ready||body.status!==check.status)fail(`${check.component} readiness drift`);
  if(body.schemaVersion!==1||body.valuesExposed!==false)fail(`${check.component} health schema drift`);
}

async function req(url,options,timeoutMs){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
}

export async function runLive(config,runtime){
  const base=productionBaseUrl(runtime);
  const options={method:"GET",redirect:"error",cache:"no-store"};
  for(const check of config.healthChecks){
    const response=await req(base+check.path,options,config.requestPolicy.timeoutMs);
    let body;try{body=await response.json();}catch{fail(`${check.component} health did not return JSON`);}
    validateHealth(check,response.status,body);
    console.log(`PRODUCTION_SMOKE_HEALTH PASS component=${check.component} http=${response.status} ready=${body.ready}`);
  }
  for(const check of config.pageChecks){
    const response=await req(base+check.path,options,config.requestPolicy.timeoutMs);
    if(response.status!==check.httpStatus)fail(`${check.name} HTTP ${response.status}, expected ${check.httpStatus}`);
    const type=response.headers.get("content-type")||"";
    if(!type.toLowerCase().includes("text/html"))fail(`${check.name} must return text/html`);
    const body=await response.text();
    if(!body.toLowerCase().includes("<html"))fail(`${check.name} response does not look like HTML`);
    console.log(`PRODUCTION_SMOKE_PAGE PASS name=${check.name} http=${response.status}`);
  }
  console.log(`PRODUCTION_SMOKE_LIVE PASS task=25.13 base=${base} health=${config.healthChecks.length} pages=${config.pageChecks.length}`);
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const runtime=JSON.parse(fs.readFileSync(RUNTIME_PATH,"utf8"));
const health=JSON.parse(fs.readFileSync(HEALTH_PATH,"utf8"));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const result=validate(config,runtime,health,pkg);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let bad=false;try{validate(c,runtime,health,pkg);}catch{bad=true;}if(!bad)fail(`negative self-test not rejected: ${label}`);cases+=1;};
  reject("preview environment",c=>{c.environment.platformEnvironment="preview";});
  reject("production loses authority",c=>{c.environment.productionAuthority=false;});
  reject("page removed",c=>{c.pageChecks.pop();});
  reject("health check removed",c=>{c.healthChecks.pop();});
  reject("mutations allowed",c=>{c.requestPolicy.mutatingRequestsForbidden=false;});
  reject("live evidence waived",c=>{c.greenRules.liveProductionSmokeEvidenceRequiredBeforeGreen=false;});
  const badRuntime=structuredClone(runtime);badRuntime.canonical_production_url="https://example.com";let rejected=false;try{productionBaseUrl(badRuntime);}catch{rejected=true;}if(!rejected)fail("noncanonical production URL accepted");cases+=1;
  console.log(`PRODUCTION_SMOKE_SUITE_SELF_TEST PASS cases=${cases} health=${result.health} pages=${result.pages} fail_closed=true`);
}else if(process.argv.includes("--live")){
  await runLive(config,runtime);
}else{
  console.log(`PRODUCTION_SMOKE_SUITE PASS task=25.13 health=${result.health} pages=${result.pages} live_required_before_green=true`);
}

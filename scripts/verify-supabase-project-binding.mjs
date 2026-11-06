import fs from "node:fs";

const CONFIG_PATH = "config/enchev-supabase-project.json";
const CLIENT_PATH = "app/components/CloudPlanStateSync.tsx";
const SYNC_PATH = "scripts/sync-cloud-plan-state.mjs";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";
const EDGE_PATH = "supabase/functions/enchev-plan-state/index.ts";

const EXPECTED = {
  project_ref: "ejfrnjhlggebzmpmxajl",
  project_url: "https://ejfrnjhlggebzmpmxajl.supabase.co",
  project_name: "enchev-auctions",
  region: "eu-central-1",
  expected_status: "ACTIVE_HEALTHY",
};
function fail(message){throw new Error("SUPABASE_PROJECT_BINDING FAIL: "+message);}
function same(actual,expected,label){
  if(JSON.stringify([...actual].sort())!==JSON.stringify([...expected].sort())) fail(label+" mismatch");
}
export function validateBinding(config,sources){
  for(const [key,value] of Object.entries(EXPECTED)){
    if(config[key]!==value)fail(key+" expected "+value+", got "+config[key]);
  }
  if(config.shared_project!==false)fail("governance project must not be shared");
  if(config.scope!=="enchev-only-development-governance")fail("scope must remain Enchev-only");
  if(config.auction_authority!==false)fail("governance is not authoritative auction data");
  same(config.enchev_resources?.tables||[],["public.enchev_plan_state"],"Enchev table allowlist");
  same(config.enchev_resources?.edge_functions||[],["enchev-plan-state"],"Enchev function allowlist");
  if(/(service[_-]?role|password|secret|api[_-]?key|publishable[_-]?key|access[_-]?token)/i.test(JSON.stringify(config))){
    fail("config must never contain provider credentials");
  }
  const endpoint=config.project_url+"/functions/v1/enchev-plan-state";
  if(!sources.client.includes(endpoint)||!sources.sync.includes(endpoint))fail("client and OIDC sync must use same Enchev endpoint");
  if(sources.client.includes("frhletkiuupgksmgxoxc")||sources.sync.includes("frhletkiuupgksmgxoxc"))fail("Twins reference forbidden");
  if(!sources.edge.includes('const PROJECT="ejfrnjhlggebzmpmxajl"'))fail("edge DB project pin absent");
  if(!sources.edge.includes("verifyGithubOidc(")||!sources.edge.includes('claims.ref!=="refs/heads/main"')||
    !sources.edge.includes('claims.workflow_ref!==WORKFLOW')||
    !sources.edge.includes('claims.repository!==REPO')||
    !sources.edge.includes('crypto.subtle.verify('))fail("strict signed GitHub OIDC write gate missing");
  if(!sources.edge.includes('status:"green"')||!sources.edge.includes("validateRows(JSON.parse(raw),claims)"))fail("signed batch validation missing");
  if(!sources.workflow.includes("Supabase project binding invariant")||
    !sources.workflow.includes("Supabase project binding self-tests")||
    !sources.workflow.includes("Supabase project live endpoint"))fail("required CI checks missing");
  return {endpoint,projectRef:config.project_ref,region:config.region};
}
async function validateLive(config){
  const endpoint=config.project_url+"/functions/v1/enchev-plan-state";
  const response=await fetch(endpoint,{headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(10000)});
  if(!response.ok)fail("live endpoint HTTP "+response.status);
  const payload=await response.json();
  if(!Array.isArray(payload.rows))fail("live endpoint has no rows array");
  const denied=await fetch(endpoint,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({rows:[]}),signal:AbortSignal.timeout(10000)
  });
  if(denied.status!==401)fail("unsigned write MUST return 401, got "+denied.status);
  console.log("SUPABASE_PROJECT_LIVE PASS endpoint="+endpoint+" rows="+payload.rows.length+" unsigned_write=401");
}
function selfTest(config,sources){
  validateBinding(config,sources);
  const bad=[
    {...config,project_ref:"wrong-project"},
    {...config,project_url:"https://wrong.supabase.co"},
    {...config,shared_project:true},
    {...config,auction_authority:true},
    {...config,scope:"production-auction-authority"},
    {...config,secret:"should-not-exist"},
    {...config,enchev_resources:{...config.enchev_resources,tables:[]}},
    {...config,enchev_resources:{...config.enchev_resources,edge_functions:[]}},
  ];
  for(let i=0;i<bad.length;i++){
    let blocked=false;
    try{validateBinding(bad[i],sources);}catch{blocked=true;}
    if(!blocked)fail("negative case "+(i+1)+" accepted");
  }
  for(const key of ["client","sync","edge"]){
    let blocked=false;
    const tampered={...sources,[key]:sources[key].replaceAll(config.project_ref,"frhletkiuupgksmgxoxc")};
    try{validateBinding(config,tampered);}catch{blocked=true;}
    if(!blocked)fail("cross-project tampering accepted for "+key);
  }
  console.log("SUPABASE_PROJECT_BINDING_SELF_TEST PASS cases="+(bad.length+3));
}
const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources={
  client:fs.readFileSync(CLIENT_PATH,"utf8"),
  sync:fs.readFileSync(SYNC_PATH,"utf8"),
  workflow:fs.readFileSync(WORKFLOW_PATH,"utf8"),
  edge:fs.readFileSync(EDGE_PATH,"utf8"),
};
if(process.argv.includes("--self-test"))selfTest(config,sources);
else if(process.argv.includes("--live")){
  validateBinding(config,sources);
  await validateLive(config);
}else{
  const result=validateBinding(config,sources);
  console.log("SUPABASE_PROJECT_BINDING PASS ref="+result.projectRef+" region="+result.region+" shared=false");
}

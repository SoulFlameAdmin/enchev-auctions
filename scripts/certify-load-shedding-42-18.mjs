import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl=String(process.argv[2]||"").replace(/\/$/,"");
const databaseUrl=process.env.DATABASE_URL;
const requestCount=Number(process.env.ENCHEV_42_18_REQUESTS||40);
const admissionLimit=Number(process.env.ENCHEV_42_18_EXPECTED_LIMIT||4);
const output=process.env.ENCHEV_42_18_OUTPUT||"artifacts/42-18/load-shedding.json";

if(!/^https?:\/\//.test(baseUrl)) throw new Error("LOAD_SHEDDING_42_18 FAIL: base URL missing");
if(!databaseUrl) throw new Error("LOAD_SHEDDING_42_18 FAIL: DATABASE_URL missing");
if(!Number.isSafeInteger(requestCount)||requestCount<20||requestCount>200) throw new Error("LOAD_SHEDDING_42_18 FAIL: request count must be 20..200");
if(!Number.isSafeInteger(admissionLimit)||admissionLimit<1||admissionLimit>=requestCount) throw new Error("LOAD_SHEDDING_42_18 FAIL: invalid expected limit");

function psql(sql){
  return new Promise((resolve,reject)=>{
    const child=spawn("psql",[databaseUrl,"-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-c",sql],{stdio:["ignore","pipe","pipe"],env:process.env});
    let stdout="",stderr="";
    child.stdout.on("data",c=>{stdout+=c;});
    child.stderr.on("data",c=>{stderr+=c;});
    child.on("error",reject);
    child.on("close",code=>code===0?resolve(stdout.trim()):reject(new Error(`psql exited ${code}: ${stderr.trim()}`)));
  });
}
function percentile(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))]||0;
}

const fixtures=Array.from({length:requestCount},(_,index)=>({auctionId:randomUUID(),bidderId:randomUUID(),amountCents:4_000_000+index}));
const values=fixtures.map(f=>`('${f.auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour')`).join(",\n");
await psql(`set role service_role; insert into public.enchev_auctions (id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at) values ${values};`);

const startedAt=new Date().toISOString();
const results=await Promise.all(fixtures.map(async(f,index)=>{
  const t0=process.hrtime.bigint();
  try{
    const response=await fetch(baseUrl+"/api/bids",{
      method:"POST",
      headers:{authorization:`Bearer ci-session-${f.bidderId}-xxxxxxxxxxxxxxxxxxxxxxxx`,"content-type":"application/json","idempotency-key":`shed42-${index}-${randomUUID()}`},
      body:JSON.stringify({auctionId:f.auctionId,amountCents:f.amountCents}),
      signal:AbortSignal.timeout(10000),
    });
    const latencyMs=Number(process.hrtime.bigint()-t0)/1e6;
    const text=await response.text();
    let body=null;try{body=JSON.parse(text);}catch{}
    return {index,fixture:f,status:response.status,latencyMs,headers:{loadShed:response.headers.get("x-enchev-load-shed"),retryAfter:response.headers.get("retry-after")},body,text};
  }catch(error){return {index,fixture:f,status:0,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,error:String(error)};}
}));

const accepted=results.filter(r=>r.status===201&&r.body?.ok===true&&r.body?.authority==="postgresql");
const shed=results.filter(r=>r.status===503&&r.headers?.loadShed==="capacity"&&String(r.text).includes("OVERLOADED_RETRYABLE"));
const other=results.filter(r=>!accepted.includes(r)&&!shed.includes(r));
if(other.length) throw new Error(`LOAD_SHEDDING_42_18 FAIL: unexpected outcomes=${other.length}`);
if(shed.length<1) throw new Error("LOAD_SHEDDING_42_18 FAIL: no load was shed");
if(accepted.length<1||accepted.length>admissionLimit) throw new Error(`LOAD_SHEDDING_42_18 FAIL: accepted=${accepted.length} exceeds limit=${admissionLimit}`);
if(shed.some(r=>r.headers.retryAfter!==null)) throw new Error("LOAD_SHEDDING_42_18 FAIL: invented Retry-After observed");
if(shed.some(r=>r.body?.ok===true)) throw new Error("LOAD_SHEDDING_42_18 FAIL: shed request returned fake success");

const integrityRaw=await psql(`
  set role service_role;
  select json_build_object(
    'acceptedRows',(select count(*) from public.enchev_bids),
    'mutatedAuctions',(select count(*) from public.enchev_auctions where current_sequence>0),
    'duplicateSequences',(select count(*) from (select auction_id,sequence from public.enchev_bids group by auction_id,sequence having count(*)>1) d)
  )::text;
`);
const integrity=JSON.parse(integrityRaw);
if(Number(integrity.acceptedRows)!==accepted.length||Number(integrity.mutatedAuctions)!==accepted.length||Number(integrity.duplicateSequences)!==0){
  throw new Error(`LOAD_SHEDDING_42_18 FAIL: mutation drift ${JSON.stringify(integrity)}`);
}

const acceptedLatency=accepted.map(r=>r.latencyMs);
const shedLatency=shed.map(r=>r.latencyMs);
const report={
  taskId:"42.18",
  title:"Load-shedding behavior",
  certified:true,
  environment:"github-actions-production-like-local",
  policySourceTask:"27.13",
  admissionLimit,
  burstRequests:requestCount,
  accepted:accepted.length,
  shed:shed.length,
  shedBeforeAuthoritativeMutation:true,
  explicitRetryableFailure:true,
  fakeSuccessObserved:false,
  retryAfterInvented:false,
  latencyMs:{
    acceptedP95:percentile(acceptedLatency,.95),
    shedP95:percentile(shedLatency,.95),
    shedMax:Math.max(...shedLatency),
  },
  integrity:{acceptedRows:Number(integrity.acceptedRows),mutatedAuctions:Number(integrity.mutatedAuctions),duplicateSequences:Number(integrity.duplicateSequences)},
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`LOAD_SHEDDING_42_18 PASS burst=${requestCount} accepted=${accepted.length} shed=${shed.length} limit=${admissionLimit} mutation_safe=true`);

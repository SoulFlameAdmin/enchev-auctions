import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl=String(process.argv[2]||"").replace(/\/$/,"");
const databaseUrl=process.env.DATABASE_URL;
const durationSeconds=Number(process.env.ENCHEV_42_14_DURATION_SECONDS||600);
const requestsPerSecond=Number(process.env.ENCHEV_42_14_RPS||4);
const appPid=Number(process.env.ENCHEV_42_APP_PID||0);
const output=process.env.ENCHEV_42_14_OUTPUT||"artifacts/42-14-15/soak-memory.json";

if(!/^https?:\/\//.test(baseUrl)) throw new Error("SOAK_42_14 FAIL: base URL missing");
if(!databaseUrl) throw new Error("SOAK_42_14 FAIL: DATABASE_URL missing");
if(!Number.isSafeInteger(durationSeconds)||durationSeconds<600||durationSeconds>3600) throw new Error("SOAK_42_14 FAIL: duration must be 600..3600 seconds");
if(!Number.isSafeInteger(requestsPerSecond)||requestsPerSecond<1||requestsPerSecond>10) throw new Error("SOAK_42_14 FAIL: RPS must be 1..10");
if(!Number.isSafeInteger(appPid)||appPid<2) throw new Error("SOAK_42_14 FAIL: ENCHEV_42_APP_PID missing");

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
function median(values){return percentile(values,.5);}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function sampleProcess(){
  const result=spawnSync("ps",["-o","rss=,%cpu=","-p",String(appPid)],{encoding:"utf8"});
  if(result.status!==0||!result.stdout.trim()) return null;
  const [rssRaw,cpuRaw]=result.stdout.trim().split(/\s+/);
  const rssKb=Number(rssRaw),cpuPercent=Number(cpuRaw);
  if(!Number.isFinite(rssKb)||!Number.isFinite(cpuPercent)) return null;
  return {atMs:Date.now(),rssKb,cpuPercent};
}

const requestCount=durationSeconds*requestsPerSecond;
const fixtures=Array.from({length:requestCount},(_,index)=>({
  auctionId:randomUUID(),
  bidderId:randomUUID(),
  amountCents:2_000_000+index,
}));

for(let offset=0;offset<fixtures.length;offset+=200){
  const values=fixtures.slice(offset,offset+200).map(f=>
    `('${f.auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '2 hours')`
  ).join(",\n");
  await psql(`set role service_role; insert into public.enchev_auctions (id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at) values ${values};`);
}

let sampling=true;
const resourceSamples=[];
const healthSamples=[];
const sampler=(async()=>{
  while(sampling){
    const proc=sampleProcess();
    if(proc) resourceSamples.push(proc);
    const t0=process.hrtime.bigint();
    try{
      const response=await fetch(baseUrl+"/api/health/web",{signal:AbortSignal.timeout(3000)});
      healthSamples.push({atMs:Date.now(),ok:response.ok,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,status:response.status});
    }catch(error){
      healthSamples.push({atMs:Date.now(),ok:false,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,status:0,error:String(error)});
    }
    await sleep(5000);
  }
})();

const startedAt=new Date().toISOString();
const startedMs=Date.now();
const intervalMs=1000/requestsPerSecond;
const requests=fixtures.map((fixture,index)=>new Promise(resolve=>setTimeout(resolve,Math.max(0,startedMs+index*intervalMs-Date.now()))).then(async()=>{
  const token=`ci-session-${fixture.bidderId}-xxxxxxxxxxxxxxxxxxxxxxxx`;
  const t0=process.hrtime.bigint();
  try{
    const response=await fetch(baseUrl+"/api/bids",{
      method:"POST",
      headers:{authorization:"Bearer "+token,"content-type":"application/json","idempotency-key":`soak42-${index}-${randomUUID()}`},
      body:JSON.stringify({auctionId:fixture.auctionId,amountCents:fixture.amountCents}),
      signal:AbortSignal.timeout(5000),
    });
    let body=null;try{body=await response.json();}catch{}
    return {index,status:response.status,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,body};
  }catch(error){
    return {index,status:0,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,error:String(error)};
  }
}));

const results=await Promise.all(requests);
sampling=false;
await sampler;
const elapsedMs=Date.now()-startedMs;

const invalid=results.filter(r=>r.error||r.status!==201||r.body?.ok!==true||r.body?.authority!=="postgresql"||r.body?.sequence!==1);
if(invalid.length) throw new Error(`SOAK_42_14 FAIL: invalid responses=${invalid.length}/${requestCount}`);
if(elapsedMs<durationSeconds*1000-2000) throw new Error(`SOAK_42_14 FAIL: elapsed too short ${elapsedMs}ms`);

const healthFailures=healthSamples.filter(s=>!s.ok);
if(healthFailures.length) throw new Error(`SOAK_42_14 FAIL: health failures=${healthFailures.length}/${healthSamples.length}`);
if(resourceSamples.length<Math.max(20,Math.floor(durationSeconds/10))) throw new Error(`MEMORY_42_15 FAIL: insufficient process samples=${resourceSamples.length}`);

const rss=resourceSamples.map(s=>s.rssKb);
const segment=Math.max(5,Math.floor(rss.length*.2));
const headMedianKb=median(rss.slice(0,segment));
const tailMedianKb=median(rss.slice(-segment));
const growthKb=tailMedianKb-headMedianKb;
const peakRssKb=Math.max(...rss);
if(growthKb>131072) throw new Error(`MEMORY_42_15 FAIL: tail median grew ${(growthKb/1024).toFixed(1)} MiB`);
if(peakRssKb>786432) throw new Error(`MEMORY_42_15 FAIL: peak RSS ${(peakRssKb/1024).toFixed(1)} MiB exceeds 768 MiB`);

const integrityRaw=await psql(`
  set role service_role;
  select json_build_object(
    'acceptedRows',(select count(*) from public.enchev_bids),
    'auctionsAtSequenceOne',(select count(*) from public.enchev_auctions where current_sequence=1),
    'duplicateSequences',(select count(*) from (select auction_id,sequence from public.enchev_bids group by auction_id,sequence having count(*)>1) d)
  )::text;
`);
const integrity=JSON.parse(integrityRaw);
if(Number(integrity.acceptedRows)!==requestCount||Number(integrity.auctionsAtSequenceOne)!==requestCount||Number(integrity.duplicateSequences)!==0){
  throw new Error("SOAK_42_14 FAIL: authoritative integrity drift");
}

const latencies=results.map(r=>r.latencyMs);
const cpu=resourceSamples.map(s=>s.cpuPercent);
const report={
  taskIds:["42.14","42.15"],
  title:"Long-duration soak + memory-leak observation",
  certified:true,
  environment:"github-actions-production-like-local",
  authority:"postgresql",
  durationSeconds:elapsedMs/1000,
  targetDurationSeconds:durationSeconds,
  requestsPerSecond,
  totalRequests:requestCount,
  successfulResponses:requestCount,
  failedResponses:0,
  health:{samples:healthSamples.length,failures:0,p95Ms:percentile(healthSamples.map(s=>s.latencyMs),.95)},
  latencyMs:{p50:percentile(latencies,.50),p95:percentile(latencies,.95),p99:percentile(latencies,.99),max:Math.max(...latencies)},
  memory:{samples:resourceSamples.length,headMedianMiB:headMedianKb/1024,tailMedianMiB:tailMedianKb/1024,growthMiB:growthKb/1024,peakMiB:peakRssKb/1024,unboundedGrowthObserved:false},
  cpu:{p50:percentile(cpu,.50),p95:percentile(cpu,.95),max:Math.max(...cpu)},
  integrity:{acceptedRows:Number(integrity.acceptedRows),duplicateSequences:Number(integrity.duplicateSequences)},
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`SOAK_42_14_15 PASS duration_s=${report.durationSeconds.toFixed(1)} requests=${requestCount} p95_ms=${report.latencyMs.p95.toFixed(2)} memory_growth_mib=${report.memory.growthMiB.toFixed(1)} peak_mib=${report.memory.peakMiB.toFixed(1)}`);

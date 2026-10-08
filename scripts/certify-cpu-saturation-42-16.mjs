import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl=String(process.argv[2]||"").replace(/\/$/,"");
const databaseUrl=process.env.DATABASE_URL;
const durationSeconds=Number(process.env.ENCHEV_42_16_DURATION_SECONDS||30);
const requestsPerSecond=Number(process.env.ENCHEV_42_16_RPS||2);
const output=process.env.ENCHEV_42_16_OUTPUT||"artifacts/42-16/cpu-saturation.json";

if(!/^https?:\/\//.test(baseUrl)) throw new Error("CPU_SATURATION_42_16 FAIL: base URL missing");
if(!databaseUrl) throw new Error("CPU_SATURATION_42_16 FAIL: DATABASE_URL missing");
if(!Number.isSafeInteger(durationSeconds)||durationSeconds<20||durationSeconds>120) throw new Error("CPU_SATURATION_42_16 FAIL: duration must be 20..120 seconds");
if(!Number.isSafeInteger(requestsPerSecond)||requestsPerSecond<1||requestsPerSecond>10) throw new Error("CPU_SATURATION_42_16 FAIL: RPS must be 1..10");

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
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const requestCount=durationSeconds*requestsPerSecond;
const fixtures=Array.from({length:requestCount},(_,index)=>({auctionId:randomUUID(),bidderId:randomUUID(),amountCents:3_000_000+index}));
const values=fixtures.map(f=>`('${f.auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour')`).join(",\n");
await psql(`set role service_role; insert into public.enchev_auctions (id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at) values ${values};`);

const logicalCpus=Math.max(1,os.availableParallelism?.()||os.cpus().length||1);
const burnerCount=Math.max(1,Math.min(4,logicalCpus));
const burnerCode=`const end=Date.now()+${(durationSeconds+5)*1000};let x=0;while(Date.now()<end){for(let i=0;i<200000;i++){x=(x+i)%1000000007;}}process.exit(x<0?1:0);`;
const burners=[];
for(let i=0;i<burnerCount;i+=1){burners.push(spawn(process.execPath,["-e",burnerCode],{stdio:"ignore"}));}

const health=[];
let healthSampling=true;
const healthLoop=(async()=>{
  while(healthSampling){
    const t0=process.hrtime.bigint();
    try{
      const response=await fetch(baseUrl+"/api/health/web",{signal:AbortSignal.timeout(5000)});
      health.push({ok:response.ok,status:response.status,latencyMs:Number(process.hrtime.bigint()-t0)/1e6});
    }catch(error){
      health.push({ok:false,status:0,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,error:String(error)});
    }
    await sleep(500);
  }
})();

const startedAt=new Date().toISOString();
const startedMs=Date.now();
const intervalMs=1000/requestsPerSecond;
const requests=fixtures.map((f,index)=>new Promise(resolve=>setTimeout(resolve,Math.max(0,startedMs+index*intervalMs-Date.now()))).then(async()=>{
  const t0=process.hrtime.bigint();
  try{
    const response=await fetch(baseUrl+"/api/bids",{
      method:"POST",
      headers:{authorization:`Bearer ci-session-${f.bidderId}-xxxxxxxxxxxxxxxxxxxxxxxx`,"content-type":"application/json","idempotency-key":`cpu42-${index}-${randomUUID()}`},
      body:JSON.stringify({auctionId:f.auctionId,amountCents:f.amountCents}),
      signal:AbortSignal.timeout(10000),
    });
    let body=null;try{body=await response.json();}catch{}
    return {status:response.status,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,body};
  }catch(error){return {status:0,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,error:String(error)};}
}));

const results=await Promise.all(requests);
healthSampling=false;
await healthLoop;
for(const child of burners){try{child.kill("SIGTERM");}catch{}}
await Promise.all(burners.map(child=>new Promise(resolve=>child.exitCode!==null?resolve():child.once("exit",resolve))));

const invalid=results.filter(r=>r.error||r.status!==201||r.body?.ok!==true||r.body?.authority!=="postgresql");
if(invalid.length) throw new Error(`CPU_SATURATION_42_16 FAIL: bid failures=${invalid.length}/${requestCount}`);
const healthSuccess=health.filter(s=>s.ok).length;
const healthRatio=health.length?healthSuccess/health.length:0;
if(health.length<20||healthRatio<.95) throw new Error(`CPU_SATURATION_42_16 FAIL: health success ratio=${healthRatio.toFixed(3)} samples=${health.length}`);

let recovered=false;
let recoveryLatencyMs=0;
const recoveryStarted=process.hrtime.bigint();
for(let attempt=0;attempt<20;attempt+=1){
  try{
    const response=await fetch(baseUrl+"/api/health/web",{signal:AbortSignal.timeout(2000)});
    if(response.ok){recovered=true;recoveryLatencyMs=Number(process.hrtime.bigint()-recoveryStarted)/1e6;break;}
  }catch{}
  await sleep(250);
}
if(!recovered) throw new Error("CPU_SATURATION_42_16 FAIL: service did not recover after CPU pressure");

const integrityRaw=await psql(`set role service_role; select json_build_object('acceptedRows',(select count(*) from public.enchev_bids),'duplicateSequences',(select count(*) from (select auction_id,sequence from public.enchev_bids group by auction_id,sequence having count(*)>1) d))::text;`);
const integrity=JSON.parse(integrityRaw);
if(Number(integrity.acceptedRows)!==requestCount||Number(integrity.duplicateSequences)!==0) throw new Error("CPU_SATURATION_42_16 FAIL: integrity drift");

const latencies=results.map(r=>r.latencyMs);
const report={
  taskId:"42.16",
  title:"CPU saturation behavior",
  certified:true,
  environment:"github-actions-production-like-local",
  pressure:{logicalCpus,burnerProcesses:burnerCount,durationSeconds,fullBusyLoopWorkers:true},
  workload:{requestsPerSecond,totalRequests:requestCount,successfulResponses:requestCount},
  health:{samples:health.length,successRatio:healthRatio,p95Ms:percentile(health.map(s=>s.latencyMs),.95),recoveredAfterPressure:true,recoveryLatencyMs},
  latencyMs:{p50:percentile(latencies,.50),p95:percentile(latencies,.95),p99:percentile(latencies,.99),max:Math.max(...latencies)},
  integrity:{acceptedRows:Number(integrity.acceptedRows),duplicateSequences:Number(integrity.duplicateSequences)},
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`CPU_SATURATION_42_16 PASS burners=${burnerCount}/${logicalCpus} requests=${requestCount} health_ratio=${healthRatio.toFixed(3)} p95_ms=${report.latencyMs.p95.toFixed(2)} recovery_ms=${recoveryLatencyMs.toFixed(0)}`);

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl=String(process.argv[2]||"").replace(/\/$/,"");
const databaseUrl=process.env.DATABASE_URL;
const requestCount=Number(process.env.ENCHEV_42_13_REQUESTS||200);
const output=process.env.ENCHEV_42_13_OUTPUT||"artifacts/42-13/traffic-spike.json";

if(!/^https?:\/\//.test(baseUrl)) throw new Error("TRAFFIC_SPIKE_42_13 FAIL: base URL missing");
if(!databaseUrl) throw new Error("TRAFFIC_SPIKE_42_13 FAIL: DATABASE_URL missing");
if(!Number.isSafeInteger(requestCount)||requestCount<100||requestCount>500) throw new Error("TRAFFIC_SPIKE_42_13 FAIL: request count must be 100..500");

function psql(sql){
  return new Promise((resolve,reject)=>{
    const child=spawn("psql",[databaseUrl,"-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-c",sql],{stdio:["ignore","pipe","pipe"],env:process.env});
    let stdout="",stderr="";
    child.stdout.on("data",(c)=>{stdout+=c;});
    child.stderr.on("data",(c)=>{stderr+=c;});
    child.on("error",reject);
    child.on("close",(code)=>{
      if(code!==0) reject(new Error(`psql exited ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
}
function percentile(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))]||0;
}

const fixtures=Array.from({length:requestCount},(_,index)=>({
  auctionId:randomUUID(),
  bidderId:randomUUID(),
  amountCents:2_000_000+index,
}));

for(let offset=0;offset<fixtures.length;offset+=100){
  const values=fixtures.slice(offset,offset+100).map((f)=>
    "('" + f.auctionId + "'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour')"
  ).join(",\n");
  await psql(`
    set role service_role;
    insert into public.enchev_auctions (
      id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at
    ) values ${values};
  `);
}

const startedAt=new Date().toISOString();
const burstStarted=process.hrtime.bigint();
const results=await Promise.all(fixtures.map(async(f,index)=>{
  const token=`ci-session-${f.bidderId}-xxxxxxxxxxxxxxxxxxxxxxxx`;
  const t0=process.hrtime.bigint();
  try{
    const response=await fetch(baseUrl+"/api/bids",{
      method:"POST",
      headers:{
        authorization:"Bearer "+token,
        "content-type":"application/json",
        "idempotency-key":`spike42-13-${index}-${randomUUID()}`,
      },
      body:JSON.stringify({auctionId:f.auctionId,amountCents:f.amountCents}),
    });
    const latencyMs=Number(process.hrtime.bigint()-t0)/1e6;
    let body=null;
    try{body=await response.json();}catch{}
    return {index,fixture:f,status:response.status,latencyMs,body};
  }catch(error){
    return {index,fixture:f,status:0,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,error:String(error)};
  }
}));
const burstElapsedMs=Number(process.hrtime.bigint()-burstStarted)/1e6;

const invalid=results.filter((r)=>
  r.error||
  r.status!==201||
  r.body?.ok!==true||
  r.body?.authority!=="postgresql"||
  r.body?.auctionId!==r.fixture.auctionId||
  r.body?.bidderId!==r.fixture.bidderId||
  r.body?.amountCents!==r.fixture.amountCents||
  r.body?.sequence!==1
);
if(invalid.length){
  console.error(JSON.stringify(invalid.slice(0,5),null,2));
  throw new Error(`TRAFFIC_SPIKE_42_13 FAIL: invalid responses=${invalid.length}/${requestCount}`);
}

const auctionIdSql=fixtures.map((f)=>"'" + f.auctionId + "'::uuid").join(",");
const integrityRaw=await psql(`
  set role service_role;
  select json_build_object(
    'acceptedRows',(select count(*) from public.enchev_bids where auction_id in (${auctionIdSql})),
    'auctionsAtSequenceOne',(select count(*) from public.enchev_auctions where id in (${auctionIdSql}) and current_sequence=1),
    'duplicateSequences',(
      select count(*) from (
        select auction_id,sequence from public.enchev_bids
        where auction_id in (${auctionIdSql})
        group by auction_id,sequence having count(*)>1
      ) d
    )
  )::text;
`);
const integrity=JSON.parse(integrityRaw);
if(Number(integrity.acceptedRows)!==requestCount||Number(integrity.auctionsAtSequenceOne)!==requestCount||Number(integrity.duplicateSequences)!==0){
  throw new Error("TRAFFIC_SPIKE_42_13 FAIL: authoritative integrity drift");
}

const latencies=results.map((r)=>r.latencyMs);
const report={
  taskId:"42.13",
  title:"Traffic-spike certification",
  certified:true,
  environment:"github-actions-production-like-local",
  route:"POST /api/bids",
  authority:"postgresql",
  spikeShape:"idle-to-full-burst",
  concurrentRequests:requestCount,
  successfulResponses:requestCount,
  failedResponses:0,
  burstElapsedMs,
  observedThroughputRequestsPerSecond:requestCount/(burstElapsedMs/1000),
  latencyMs:{
    p50:percentile(latencies,.50),p95:percentile(latencies,.95),p99:percentile(latencies,.99),max:Math.max(...latencies)
  },
  integrity:{
    acceptedRows:Number(integrity.acceptedRows),
    duplicateSequences:Number(integrity.duplicateSequences),
    noWinnerOrSequenceCorruption:true,
  },
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`TRAFFIC_SPIKE_42_13 PASS requests=${requestCount} throughput_rps=${report.observedThroughputRequestsPerSecond.toFixed(2)} p50_ms=${report.latencyMs.p50.toFixed(2)} p95_ms=${report.latencyMs.p95.toFixed(2)} p99_ms=${report.latencyMs.p99.toFixed(2)}`);

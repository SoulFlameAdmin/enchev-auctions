import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const output = process.env.ENCHEV_42_10_OUTPUT || "artifacts/42-10/database-pool-saturation.json";
const clientCount = Number(process.env.ENCHEV_42_10_CLIENTS || 200);
const poolLimit = Number(process.env.ENCHEV_42_10_POOL_LIMIT || 20);
const dbHoldSeconds = Number(process.env.ENCHEV_42_10_DB_HOLD_SECONDS || 0.1);

if (!databaseUrl) throw new Error("DB_POOL_SATURATION_42_10 FAIL: DATABASE_URL missing");
if (!Number.isSafeInteger(clientCount) || clientCount < 50 || clientCount > 500) throw new Error("DB_POOL_SATURATION_42_10 FAIL: clients must be 50..500");
if (!Number.isSafeInteger(poolLimit) || poolLimit < 5 || poolLimit > 50 || poolLimit >= clientCount) throw new Error("DB_POOL_SATURATION_42_10 FAIL: invalid pool limit");

function dbUrlWithApplicationName(name) {
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", name);
  return url.toString();
}

function psql(sql, applicationName = "enchev-42-10-control") {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [dbUrlWithApplicationName(applicationName), "-X", "-q", "-A", "-t", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio:["ignore","pipe","pipe"],
      env:process.env,
    });
    let stdout="", stderr="";
    child.stdout.on("data",(c)=>{stdout+=c;});
    child.stderr.on("data",(c)=>{stderr+=c;});
    child.on("error",reject);
    child.on("close",(code)=>{
      if(code!==0) reject(new Error(`psql exited ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
}

function fingerprint(value){ return createHash("sha256").update(value).digest("hex"); }
function percentile(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))]||0;
}
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

let active=0;
let maxActive=0;
let maxQueueDepth=0;
const waiters=[];
async function withPool(fn){
  const queuedAt=process.hrtime.bigint();
  if(active>=poolLimit){
    maxQueueDepth=Math.max(maxQueueDepth,waiters.length+1);
    await new Promise((resolve)=>waiters.push(resolve));
  }
  active+=1;
  maxActive=Math.max(maxActive,active);
  const acquiredAt=process.hrtime.bigint();
  try{
    const value=await fn();
    return {value,queueWaitMs:Number(acquiredAt-queuedAt)/1e6};
  }finally{
    active-=1;
    const next=waiters.shift();
    if(next) next();
  }
}

const fixtures=Array.from({length:clientCount},(_,index)=>({
  auctionId:randomUUID(),
  bidderId:randomUUID(),
  amountCents:2_000_000 + index,
}));

const chunks=[];
for(let offset=0;offset<fixtures.length;offset+=100){
  const slice=fixtures.slice(offset,offset+100);
  const values=slice.map((f)=>
    `('${f.auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour')`
  ).join(",\n");
  chunks.push(psql(`
    set role service_role;
    insert into public.enchev_auctions (
      id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at
    ) values ${values};
  `));
}
await Promise.all(chunks);

let monitorStop=false;
const connectionSamples=[];
const monitor=(async()=>{
  while(!monitorStop){
    try{
      const raw=await psql(`
        select
          count(*)::int,
          count(*) filter (where state='active')::int
        from pg_stat_activity
        where application_name='enchev-42-10-pooled';
      `);
      const [connectionsRaw,activeRaw]=String(raw).split("|");
      connectionSamples.push({
        atMs:Date.now(),
        connections:Number(connectionsRaw||0),
        active:Number(activeRaw||0),
        localPoolActive:active,
        queueDepth:waiters.length,
      });
    }catch{}
    await delay(25);
  }
})();

const startedAt=new Date().toISOString();
const results=await Promise.all(fixtures.map(async(f,index)=>{
  const key=`pool42-10-${index}-${randomUUID()}`;
  const fp=fingerprint(JSON.stringify({task:"42.10",auctionId:f.auctionId,bidderId:f.bidderId,index}));
  const t0=process.hrtime.bigint();
  try{
    const slot=await withPool(()=>psql(`
      set role service_role;
      select pg_sleep(${dbHoldSeconds});
      select public.enchev_place_bid(
        '${f.auctionId}'::uuid,
        '${f.bidderId}'::uuid,
        ${f.amountCents}::bigint,
        '${key}'::text,
        '${fp}'::text
      )::text;
    `,"enchev-42-10-pooled"));
    const latencyMs=Number(process.hrtime.bigint()-t0)/1e6;
    const lines=String(slot.value).split(/\r?\n/).filter(Boolean);
    return {index,latencyMs,queueWaitMs:slot.queueWaitMs,result:JSON.parse(lines.at(-1))};
  }catch(error){
    return {index,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,error:String(error)};
  }
}));
monitorStop=true;
await monitor;

const failures=results.filter((r)=>r.error);
if(failures.length) throw new Error(`DB_POOL_SATURATION_42_10 FAIL: process failures=${failures.length}`);
const invalid=results.filter((r)=>r.result?.accepted!==true || r.result?.authority!=="postgresql" || r.result?.sequence!==1);
if(invalid.length) throw new Error(`DB_POOL_SATURATION_42_10 FAIL: invalid accepted results=${invalid.length}`);

const maxObservedConnections=Math.max(...connectionSamples.map((s)=>s.connections),0);
const maxObservedActive=Math.max(...connectionSamples.map((s)=>s.active),0);
if(maxQueueDepth<1) throw new Error("DB_POOL_SATURATION_42_10 FAIL: pool never saturated");
if(maxActive!==poolLimit) throw new Error(`DB_POOL_SATURATION_42_10 FAIL: local max active=${maxActive}, expected=${poolLimit}`);
if(maxObservedConnections>poolLimit) throw new Error(`DB_POOL_SATURATION_42_10 FAIL: database connections exceeded pool limit observed=${maxObservedConnections}`);
if(maxObservedActive<Math.max(5,Math.floor(poolLimit*0.5))) throw new Error(`DB_POOL_SATURATION_42_10 FAIL: database saturation not observed active=${maxObservedActive}`);

const integrityRaw=await psql(`
  set role service_role;
  select json_build_object(
    'acceptedRows',(select count(*) from public.enchev_bids),
    'auctionsAtSequenceOne',(select count(*) from public.enchev_auctions where current_sequence=1),
    'duplicateAuctionSequences',(
      select count(*) from (
        select auction_id,sequence from public.enchev_bids
        group by auction_id,sequence having count(*)>1
      ) d
    )
  )::text;
`);
const integrity=JSON.parse(integrityRaw);
if(Number(integrity.acceptedRows)!==clientCount || Number(integrity.auctionsAtSequenceOne)!==clientCount || Number(integrity.duplicateAuctionSequences)!==0){
  throw new Error("DB_POOL_SATURATION_42_10 FAIL: integrity drift");
}

const latencies=results.map((r)=>r.latencyMs);
const queueWaits=results.map((r)=>Number(r.queueWaitMs||0));
const report={
  taskId:"42.10",
  title:"Database pool saturation test",
  certified:true,
  environment:"github-actions-postgresql-17",
  logicalClients:clientCount,
  configuredPoolLimit:poolLimit,
  artificialDbHoldSeconds:dbHoldSeconds,
  maxLocalPoolActive:maxActive,
  maxQueueDepth,
  maxDatabaseConnectionsObserved:maxObservedConnections,
  maxDatabaseActiveObserved:maxObservedActive,
  poolLimitRespected:maxObservedConnections<=poolLimit,
  queueObserved:maxQueueDepth>0,
  latencyMs:{
    p50:percentile(latencies,.50),p95:percentile(latencies,.95),p99:percentile(latencies,.99),max:Math.max(...latencies)
  },
  queueWaitMs:{
    p50:percentile(queueWaits,.50),p95:percentile(queueWaits,.95),p99:percentile(queueWaits,.99),max:Math.max(...queueWaits)
  },
  integrity:{
    acceptedRows:Number(integrity.acceptedRows),
    duplicateAuctionSequences:Number(integrity.duplicateAuctionSequences),
  },
  connectionSamples,
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`DB_POOL_SATURATION_42_10 PASS clients=${clientCount} pool=${poolLimit} max_db_connections=${maxObservedConnections} max_active=${maxObservedActive} max_queue=${maxQueueDepth} queue_p95_ms=${report.queueWaitMs.p95.toFixed(2)} latency_p95_ms=${report.latencyMs.p95.toFixed(2)}`);

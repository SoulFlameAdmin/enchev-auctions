import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrls=process.argv.slice(2).map(v=>String(v).replace(/\/$/,"")).filter(Boolean);
const databaseUrl=process.env.DATABASE_URL;
const auctionCount=Number(process.env.ENCHEV_42_17_AUCTIONS||100);
const bidsPerAuction=Number(process.env.ENCHEV_42_19_BIDS_PER_AUCTION||5);
const output=process.env.ENCHEV_42_17_OUTPUT||"artifacts/42-17-19/horizontal-integrity.json";

if(baseUrls.length<2||baseUrls.some(url=>!/^https?:\/\//.test(url))) throw new Error("HORIZONTAL_SCALE_42_17 FAIL: at least two base URLs required");
if(!databaseUrl) throw new Error("HORIZONTAL_SCALE_42_17 FAIL: DATABASE_URL missing");
if(!Number.isSafeInteger(auctionCount)||auctionCount<50||auctionCount>200) throw new Error("HORIZONTAL_SCALE_42_17 FAIL: auction count must be 50..200");
if(!Number.isSafeInteger(bidsPerAuction)||bidsPerAuction<3||bidsPerAuction>10) throw new Error("INTEGRITY_42_19 FAIL: bids per auction must be 3..10");

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

for(const url of baseUrls){
  const r=await fetch(url+"/api/health/web");
  if(!r.ok) throw new Error(`HORIZONTAL_SCALE_42_17 FAIL: unhealthy instance ${url}`);
}

const fixtures=Array.from({length:auctionCount},(_,auctionIndex)=>({
  auctionIndex,
  auctionId:randomUUID(),
  bidders:Array.from({length:bidsPerAuction},()=>randomUUID()),
}));
for(let offset=0;offset<fixtures.length;offset+=100){
  const values=fixtures.slice(offset,offset+100).map(f=>
    `('${f.auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour')`
  ).join(",\n");
  await psql(`set role service_role; insert into public.enchev_auctions (id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at) values ${values};`);
}

const instanceStats=Object.fromEntries(baseUrls.map(url=>[url,{requests:0,success:0}]));
const latencies=[];
const startedAt=new Date().toISOString();
await Promise.all(fixtures.map(async fixture=>{
  for(let bidIndex=0;bidIndex<bidsPerAuction;bidIndex+=1){
    const bidderId=fixture.bidders[bidIndex];
    const baseUrl=baseUrls[(fixture.auctionIndex+bidIndex)%baseUrls.length];
    const amountCents=2_000_000+fixture.auctionIndex*10_000+(bidIndex+1)*100;
    instanceStats[baseUrl].requests+=1;
    const t0=process.hrtime.bigint();
    const response=await fetch(baseUrl+"/api/bids",{
      method:"POST",
      headers:{authorization:`Bearer ci-session-${bidderId}-xxxxxxxxxxxxxxxxxxxxxxxx`,"content-type":"application/json","idempotency-key":`scale42-${fixture.auctionIndex}-${bidIndex}-${randomUUID()}`},
      body:JSON.stringify({auctionId:fixture.auctionId,amountCents}),
      signal:AbortSignal.timeout(10000),
    });
    const latencyMs=Number(process.hrtime.bigint()-t0)/1e6;
    latencies.push(latencyMs);
    let body=null;try{body=await response.json();}catch{}
    if(response.status!==201||body?.ok!==true||body?.authority!=="postgresql"||body?.sequence!==bidIndex+1||body?.amountCents!==amountCents){
      throw new Error(`HORIZONTAL_SCALE_42_17 FAIL: bid drift auction=${fixture.auctionIndex} bid=${bidIndex} status=${response.status}`);
    }
    instanceStats[baseUrl].success+=1;
  }
}));

for(const [url,stats] of Object.entries(instanceStats)){
  if(stats.requests<1||stats.success!==stats.requests) throw new Error(`HORIZONTAL_SCALE_42_17 FAIL: instance did not carry certified traffic ${url}`);
}
const totalAccepted=auctionCount*bidsPerAuction;

await psql("set role service_role; update public.enchev_auctions set ends_at=now()-interval '1 second' where status='live';");
await psql(`
  set role service_role;
  select public.enchev_finalize_auction(
    id,
    'scale42-19-' || replace(id::text,'-',''),
    repeat('b',64)
  )
  from public.enchev_auctions
  order by id;
`);

const integrityRaw=await psql(`
  set role service_role;
  select json_build_object(
    'auctionCount',(select count(*) from public.enchev_auctions),
    'acceptedRows',(select count(*) from public.enchev_bids),
    'sequenceComplete',(select count(*) from public.enchev_auctions where current_sequence=${bidsPerAuction}),
    'duplicateSequences',(select count(*) from (select auction_id,sequence from public.enchev_bids group by auction_id,sequence having count(*)>1) d),
    'finalizations',(select count(*) from public.enchev_auction_finalizations),
    'winnerMismatch',(
      select count(*)
      from public.enchev_auction_finalizations f
      where f.outcome<>'winner_assigned'
         or f.winning_amount_cents<>(select max(b.amount_cents) from public.enchev_bids b where b.auction_id=f.auction_id)
         or f.winner_bid_id<>(select b2.id from public.enchev_bids b2 where b2.auction_id=f.auction_id order by b2.amount_cents desc,b2.sequence desc limit 1)
    ),
    'auctionWinnerMismatch',(
      select count(*)
      from public.enchev_auctions a
      join public.enchev_auction_finalizations f on f.auction_id=a.id
      where a.status<>'ended' or a.winner_bid_id<>f.winner_bid_id or a.winner_bidder_id<>f.winner_bidder_id or a.winning_amount_cents<>f.winning_amount_cents
    )
  )::text;
`);
const integrity=JSON.parse(integrityRaw);
if(Number(integrity.auctionCount)!==auctionCount||Number(integrity.acceptedRows)!==totalAccepted||Number(integrity.sequenceComplete)!==auctionCount||Number(integrity.duplicateSequences)!==0||Number(integrity.finalizations)!==auctionCount||Number(integrity.winnerMismatch)!==0||Number(integrity.auctionWinnerMismatch)!==0){
  throw new Error(`INTEGRITY_42_19 FAIL: ${JSON.stringify(integrity)}`);
}

const report={
  taskIds:["42.17","42.19"],
  title:"Horizontal-scale + no corruption at certified load",
  certified:true,
  environment:"github-actions-production-like-local",
  authority:"postgresql",
  apiInstances:baseUrls.length,
  instanceStats,
  auctions:auctionCount,
  bidsPerAuction,
  acceptedBids:totalAccepted,
  peakLogicalConcurrentAuctions:auctionCount,
  latencyMs:{p50:percentile(latencies,.50),p95:percentile(latencies,.95),p99:percentile(latencies,.99),max:Math.max(...latencies)},
  integrity:{
    duplicateSequences:Number(integrity.duplicateSequences),
    finalizations:Number(integrity.finalizations),
    winnerMismatch:Number(integrity.winnerMismatch),
    auctionWinnerMismatch:Number(integrity.auctionWinnerMismatch),
    noDataOrWinnerCorruption:true,
  },
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`HORIZONTAL_INTEGRITY_42_17_19 PASS instances=${baseUrls.length} auctions=${auctionCount} bids=${totalAccepted} p95_ms=${report.latencyMs.p95.toFixed(2)} winner_mismatch=0`);

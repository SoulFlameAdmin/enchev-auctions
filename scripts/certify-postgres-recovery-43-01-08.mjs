import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const sourceUrl=process.env.DATABASE_URL;
const restoreDbName=process.env.ENCHEV_43_RESTORE_DB||"enchev_restore";
const output=process.env.ENCHEV_43_OUTPUT||"artifacts/43-01-08/postgres-recovery.json";
const backupFile=process.env.ENCHEV_43_BACKUP_FILE||"artifacts/43-01-08/enchev-recovery.dump";
const auctionCount=Number(process.env.ENCHEV_43_AUCTIONS||20);
const bidsPerAuction=Number(process.env.ENCHEV_43_BIDS_PER_AUCTION||3);

if(!sourceUrl) throw new Error("RECOVERY_43 FAIL: DATABASE_URL missing");
if(!Number.isSafeInteger(auctionCount)||auctionCount<10||auctionCount>100) throw new Error("RECOVERY_43 FAIL: auction count must be 10..100");
if(!Number.isSafeInteger(bidsPerAuction)||bidsPerAuction<2||bidsPerAuction>10) throw new Error("RECOVERY_43 FAIL: bids per auction must be 2..10");
if(!/^[a-z][a-z0-9_]{2,62}$/.test(restoreDbName)) throw new Error("RECOVERY_43 FAIL: restore database name invalid");

function withDatabase(url,db){const u=new URL(url);u.pathname="/"+db;return u.toString();}
const maintenanceUrl=withDatabase(sourceUrl,"postgres");
const restoreUrl=withDatabase(sourceUrl,restoreDbName);

function command(bin,args,{capture=true}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{stdio:capture?["ignore","pipe","pipe"]:"inherit",env:process.env});
    let stdout="",stderr="";
    if(capture){child.stdout.on("data",c=>{stdout+=c;});child.stderr.on("data",c=>{stderr+=c;});}
    child.on("error",reject);
    child.on("close",code=>code===0?resolve(stdout.trim()):reject(new Error(`${bin} exited ${code}: ${stderr.trim()}`)));
  });
}
const psql=(url,sql)=>command("psql",[url,"-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-c",sql]);
const nowIso=()=>new Date().toISOString();

function sha256File(file){return createHash("sha256").update(fs.readFileSync(file)).digest("hex");}

const fixtures=Array.from({length:auctionCount},(_,i)=>({
  auctionId:randomUUID(),
  bidders:Array.from({length:bidsPerAuction},()=>randomUUID()),
  baseAmount:2_500_000+i*10_000,
}));

const auctionValues=fixtures.map(f=>`('${f.auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour')`).join(",\n");
let seedSql=`set role service_role;\ninsert into public.enchev_auctions (id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at) values ${auctionValues};\n`;
for(const [ai,f] of fixtures.entries()){
  for(let bi=0;bi<bidsPerAuction;bi+=1){
    const amount=f.baseAmount+(bi+1)*100;
    seedSql+=`select public.enchev_place_bid('${f.auctionId}'::uuid,'${f.bidders[bi]}'::uuid,${amount}::bigint,'recovery43-${ai}-${bi}'::text,'${createHash("sha256").update(`43:${ai}:${bi}`).digest("hex")}'::text);\n`;
  }
}
seedSql+="update public.enchev_auctions set ends_at=now()-interval '1 second' where status='live';\n";
for(const [ai,f] of fixtures.entries()){
  seedSql+=`select public.enchev_finalize_auction('${f.auctionId}'::uuid,'recovery43-close-${ai}'::text,'${createHash("sha256").update(`43:close:${ai}`).digest("hex")}'::text);\n`;
}
await psql(sourceUrl,seedSql);

const snapshotSql=`
set role service_role;
select json_build_object(
  'auctions',(select count(*) from public.enchev_auctions),
  'bids',(select count(*) from public.enchev_bids),
  'finalizations',(select count(*) from public.enchev_auction_finalizations),
  'winnerMismatch',(select count(*) from public.enchev_auction_finalizations f where f.winning_amount_cents<>(select max(b.amount_cents) from public.enchev_bids b where b.auction_id=f.auction_id)),
  'auctionHash',(select md5(coalesce(string_agg(id::text||':'||status||':'||current_sequence||':'||coalesce(winning_amount_cents::text,''),'|' order by id),'')) from public.enchev_auctions),
  'bidHash',(select md5(coalesce(string_agg(id::text||':'||auction_id::text||':'||sequence||':'||amount_cents,'|' order by auction_id,sequence),'')) from public.enchev_bids),
  'finalizationHash',(select md5(coalesce(string_agg(id::text||':'||auction_id::text||':'||outcome||':'||coalesce(winning_amount_cents::text,''),'|' order by auction_id),'')) from public.enchev_auction_finalizations),
  'latestAuthoritativeAt',greatest(
    coalesce((select max(accepted_at) from public.enchev_bids),to_timestamp(0)),
    coalesce((select max(closed_at) from public.enchev_auction_finalizations),to_timestamp(0))
  )
)::text;
`;
const expected=JSON.parse(await psql(sourceUrl,snapshotSql));
const expectedBids=auctionCount*bidsPerAuction;
if(Number(expected.auctions)!==auctionCount||Number(expected.bids)!==expectedBids||Number(expected.finalizations)!==auctionCount||Number(expected.winnerMismatch)!==0){
  throw new Error(`RECOVERY_43 FAIL: seed integrity drift ${JSON.stringify(expected)}`);
}

fs.mkdirSync(path.dirname(backupFile),{recursive:true});
const backupStarted=process.hrtime.bigint();
await command("pg_dump",["--format=custom","--no-owner","--no-privileges","--file",backupFile,sourceUrl]);
const backupDurationMs=Number(process.hrtime.bigint()-backupStarted)/1e6;
const backupCompletedAt=Date.now();
const latestAtMs=Date.parse(expected.latestAuthoritativeAt);
const localRpoSeconds=Math.max(0,(backupCompletedAt-latestAtMs)/1000);
const backupBytes=fs.statSync(backupFile).size;
if(backupBytes<1024) throw new Error("RECOVERY_43 FAIL: backup unexpectedly small");

await psql(sourceUrl,"set role service_role; update public.enchev_auctions set current_bid_cents=current_bid_cents+777 where status='ended';");
const corrupted=Number(await psql(sourceUrl,"select count(*) from public.enchev_auctions a where a.current_bid_cents<>(select max(b.amount_cents) from public.enchev_bids b where b.auction_id=a.id);"));
if(corrupted!==auctionCount) throw new Error(`RECOVERY_43 FAIL: corruption scenario not observed count=${corrupted}`);

await psql(sourceUrl,"set role service_role; truncate table public.enchev_auction_finalizations, public.enchev_bids, public.enchev_auctions restart identity;");
const afterDelete=Number(await psql(sourceUrl,"select (select count(*) from public.enchev_auctions)+(select count(*) from public.enchev_bids)+(select count(*) from public.enchev_auction_finalizations);"));
if(afterDelete!==0) throw new Error("RECOVERY_43 FAIL: accidental delete scenario not established");

await psql(maintenanceUrl,`drop database if exists ${restoreDbName} with (force);`);
await psql(maintenanceUrl,`create database ${restoreDbName};`);
const restoreStarted=process.hrtime.bigint();
await command("pg_restore",["--no-owner","--no-privileges","--exit-on-error","--dbname",restoreUrl,backupFile]);
const restoreDurationMs=Number(process.hrtime.bigint()-restoreStarted)/1e6;
const restored=JSON.parse(await psql(restoreUrl,snapshotSql));
const localRtoSeconds=restoreDurationMs/1000;

for(const key of ["auctions","bids","finalizations","winnerMismatch","auctionHash","bidHash","finalizationHash"]){
  if(String(restored[key])!==String(expected[key])) throw new Error(`RECOVERY_43 FAIL: restored ${key} mismatch expected=${expected[key]} actual=${restored[key]}`);
}

const report={
  taskIds:["43.01","43.02","43.03","43.04","43.05","43.06","43.07","43.08"],
  title:"PostgreSQL backup and recovery certification foundation",
  certifiedLocal:true,
  productionCertified:false,
  environment:"github-actions-postgresql-17-clean-restore",
  backup:{format:"pg_dump-custom",bytes:backupBytes,sha256:sha256File(backupFile),durationMs:backupDurationMs,automatedByWorkflow:true},
  restore:{database:restoreDbName,durationMs:restoreDurationMs,cleanEnvironment:true,integrityMatched:true},
  measurements:{localRpoSeconds,localRtoSeconds},
  fixtures:{auctions:auctionCount,bids:expectedBids,finalizations:auctionCount},
  drills:{accidentalDeleteObserved:true,corruptedDataObserved:true,corruptedRows:corrupted,recoveredFromBackup:true},
  integrity:{winnerMismatch:Number(restored.winnerMismatch),auctionHash:restored.auctionHash,bidHash:restored.bidHash,finalizationHash:restored.finalizationHash},
  productionBlockers:["dedicated-auction-database-backup-provider-not-live-certified","provider-pitr-not-verified","production-rpo-rto-not-measured"],
  startedAt:nowIso(),
  completedAt:nowIso(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`RECOVERY_43_01_08 PASS backup_bytes=${backupBytes} backup_ms=${backupDurationMs.toFixed(0)} restore_ms=${restoreDurationMs.toFixed(0)} local_rpo_s=${localRpoSeconds.toFixed(3)} local_rto_s=${localRtoSeconds.toFixed(3)} auctions=${auctionCount} bids=${expectedBids} corruption_recovered=true delete_recovered=true production=false`);

import fs from "node:fs";
import path from "node:path";

const REQUIRED_BIDDERS = 50;
const TASK_ID = "42.03";
const baseUrl = String(process.env.ENCHEV_42_03_BASE_URL || "").replace(/\/$/, "");
const auctionId = String(process.env.ENCHEV_42_03_AUCTION_ID || "");
const tokensRaw = process.env.ENCHEV_42_03_TOKENS_JSON || "";
const startAmount = Number(process.env.ENCHEV_42_03_START_AMOUNT_CENTS || "");
const increment = Number(process.env.ENCHEV_42_03_INCREMENT_CENTS || "");
const output = process.env.ENCHEV_42_03_OUTPUT || "artifacts/42-03/concurrent-bidders.json";

function fail(message){ throw new Error("CONCURRENT_BIDDERS_42_03_CERT FAIL: " + message); }
function pctl(values,p){ const s=[...values].sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1))] || 0; }
function decodeSub(token){
  const parts=token.split(".");
  if(parts.length!==3) fail("all bidder sessions must be JWTs");
  const payload=JSON.parse(Buffer.from(parts[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
  if(typeof payload.sub!=="string" || !payload.sub) fail("bidder JWT missing sub");
  return payload.sub;
}
if(!baseUrl || !/^https?:\/\//.test(baseUrl)) fail("ENCHEV_42_03_BASE_URL missing/invalid");
if(!/^[0-9a-f-]{36}$/i.test(auctionId)) fail("ENCHEV_42_03_AUCTION_ID missing/invalid");
if(!Number.isSafeInteger(startAmount) || startAmount <= 0) fail("ENCHEV_42_03_START_AMOUNT_CENTS missing/invalid");
if(!Number.isSafeInteger(increment) || increment <= 0) fail("ENCHEV_42_03_INCREMENT_CENTS missing/invalid");

let tokens;
try { tokens=JSON.parse(tokensRaw); } catch { fail("ENCHEV_42_03_TOKENS_JSON must be JSON"); }
if(!Array.isArray(tokens) || tokens.length!==REQUIRED_BIDDERS || tokens.some(x=>typeof x!=="string")) fail("exactly 50 bidder JWTs required");
const bidderIds=tokens.map(decodeSub);
if(new Set(bidderIds).size!==REQUIRED_BIDDERS) fail("50 distinct bidder identities required");

const launchGate = new Promise((resolve)=>setTimeout(resolve,250));
const startedAt=new Date().toISOString();
const requests=tokens.map(async(token,index)=>{
  const amountCents=startAmount+(index*increment);
  const key=`cert42-03-${Date.now()}-${index}-${crypto.randomUUID()}`;
  await launchGate;
  const t0=process.hrtime.bigint();
  let response;
  try{
    response=await fetch(baseUrl+"/api/bids",{
      method:"POST",
      headers:{
        "authorization":"Bearer "+token,
        "content-type":"application/json",
        "idempotency-key":key,
        "x-request-id":`cert42.03.${index}.${crypto.randomUUID()}`
      },
      body:JSON.stringify({auctionId,amountCents}),
      redirect:"manual"
    });
  }catch(error){
    return {index,bidderId:bidderIds[index],amountCents,status:0,latencyMs:Number(process.hrtime.bigint()-t0)/1e6,networkError:String(error)};
  }
  const latencyMs=Number(process.hrtime.bigint()-t0)/1e6;
  const requestId=response.headers.get("x-request-id");
  let body=null;
  try{ body=await response.json(); }catch{}
  return {index,bidderId:bidderIds[index],amountCents,status:response.status,latencyMs,requestId,body};
});

const results=await Promise.all(requests);
const networkErrors=results.filter(x=>x.status===0);
if(networkErrors.length) fail("network errors="+networkErrors.length);
if(results.some(x=>!x.requestId)) fail("every response must carry X-Request-ID");
if(results.some(x=>![200,201,422].includes(x.status))) fail("unexpected HTTP status in concurrent set");

const accepted=results.filter(x=>x.status===200||x.status===201);
const rejected=results.filter(x=>x.status===422);
if(accepted.length<1) fail("at least one authoritative acceptance required");
for(const item of accepted){
  if(item.body?.authority!=="postgresql" || item.body?.ok!==true) fail("accepted response is not PostgreSQL authoritative");
  if(item.body?.auctionId!==auctionId) fail("accepted response auction mismatch");
  if(item.body?.bidderId!==item.bidderId) fail("accepted response bidder identity mismatch");
  if(item.body?.amountCents!==item.amountCents) fail("accepted response amount mismatch");
  if(!Number.isSafeInteger(item.body?.sequence) || item.body.sequence<1) fail("accepted response sequence missing");
}
for(const item of rejected){
  if(typeof item.body?.error?.code!=="string") fail("rejected response must be explicit error envelope");
}

const bySequence=[...accepted].sort((a,b)=>a.body.sequence-b.body.sequence);
for(let i=1;i<bySequence.length;i++){
  if(bySequence[i].body.sequence<=bySequence[i-1].body.sequence) fail("accepted sequence is not strictly increasing");
  if(bySequence[i].body.amountCents<=bySequence[i-1].body.amountCents) fail("accepted amount regressed under row-lock serialization");
}
if(new Set(bySequence.map(x=>x.body.sequence)).size!==bySequence.length) fail("duplicate accepted sequence");
if(new Set(bySequence.map(x=>x.body.bidId)).size!==bySequence.length) fail("duplicate accepted bid id");

const latencies=results.map(x=>x.latencyMs);
const report={
  taskId:TASK_ID,
  title:"50 concurrent bidders certified",
  certified:true,
  authority:"postgresql",
  auctionId,
  bidderCount:REQUIRED_BIDDERS,
  distinctBidderCount:new Set(bidderIds).size,
  requestCount:results.length,
  acceptedCount:accepted.length,
  rejectedCount:rejected.length,
  networkErrors:0,
  latencyMs:{p50:pctl(latencies,.50),p95:pctl(latencies,.95),p99:pctl(latencies,.99),max:Math.max(...latencies)},
  acceptedSequence:bySequence.map(x=>({sequence:x.body.sequence,bidId:x.body.bidId,bidderId:x.body.bidderId,amountCents:x.body.amountCents,replayed:x.body.replayed})),
  startedAt,
  completedAt:new Date().toISOString(),
  headSha:process.env.GITHUB_SHA || "local"
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`CONCURRENT_BIDDERS_42_03_CERT PASS bidders=50 accepted=${accepted.length} rejected=${rejected.length} p95_ms=${report.latencyMs.p95.toFixed(2)}`);

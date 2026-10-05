import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl=String(process.argv[2]||"http://127.0.0.1:4020").replace(/\/$/,"");
const wsUrl=baseUrl.replace(/^http/,"ws");
const key=process.env.ENCHEV_REALTIME_INTERNAL_KEY||"ci-realtime";
const subscriberCount=Number(process.env.ENCHEV_42_11_SUBSCRIBERS||500);
const eventCount=Number(process.env.ENCHEV_42_11_EVENTS||20);
const output=process.env.ENCHEV_42_11_OUTPUT||"artifacts/42-11/websocket-fanout-saturation.json";

if(typeof WebSocket!=="function") throw new Error("WEBSOCKET_FANOUT_42_11 FAIL: Node WebSocket client unavailable");
if(!Number.isSafeInteger(subscriberCount)||subscriberCount<100||subscriberCount>750) throw new Error("WEBSOCKET_FANOUT_42_11 FAIL: subscribers must be 100..750");
if(!Number.isSafeInteger(eventCount)||eventCount<10||eventCount>100) throw new Error("WEBSOCKET_FANOUT_42_11 FAIL: events must be 10..100");

function percentile(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))]||0;
}
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const auctionId=randomUUID();
const subject=`auction/${auctionId}`;
const sockets=[];
const sequences=Array.from({length:subscriberCount},()=>[]);
let socketErrors=0;

const openStarted=process.hrtime.bigint();
const batchSize=100;
for(let offset=0;offset<subscriberCount;offset+=batchSize){
  const batch=Array.from({length:Math.min(batchSize,subscriberCount-offset)},(_,localIndex)=>new Promise((resolve,reject)=>{
    const index=offset+localIndex;
    const socket=new WebSocket(`${wsUrl}/ws?subject=${encodeURIComponent(subject)}`);
    sockets[index]=socket;
    const timer=setTimeout(()=>reject(new Error(`subscriber ${index} open timeout`)),10000);
    socket.addEventListener("open",()=>{clearTimeout(timer);resolve();},{once:true});
    socket.addEventListener("error",()=>{socketErrors+=1;clearTimeout(timer);reject(new Error(`subscriber ${index} socket error`));},{once:true});
    socket.addEventListener("message",(event)=>{
      try{
        const parsed=JSON.parse(String(event.data));
        if(parsed.subject===subject&&Number.isSafeInteger(parsed.sequence)) sequences[index].push(parsed.sequence);
      }catch{}
    });
  }));
  await Promise.all(batch);
}
const connectionOpenMs=Number(process.hrtime.bigint()-openStarted)/1e6;

const healthResponse=await fetch(baseUrl+"/health");
const health=await healthResponse.json();
if(!healthResponse.ok||health?.connections!==subscriberCount) throw new Error(`WEBSOCKET_FANOUT_42_11 FAIL: health connections=${health?.connections}, expected=${subscriberCount}`);

const transportSamples=[];
const publishHttpLatencies=[];
const startedAt=new Date().toISOString();

for(let sequence=1;sequence<=eventCount;sequence+=1){
  const event={
    id:randomUUID(),
    type:"enchev.bid.accepted.v1",
    source:"enchev.api",
    subject,
    time:new Date().toISOString(),
    sequence,
    schemaVersion:1,
    correlationId:randomUUID(),
    data:{bidId:randomUUID(),amountCents:1_000_000+sequence*100},
  };
  const t0=process.hrtime.bigint();
  const response=await fetch(baseUrl+"/publish",{
    method:"POST",
    headers:{"content-type":"application/json","x-enchev-realtime-key":key},
    body:JSON.stringify(event),
  });
  publishHttpLatencies.push(Number(process.hrtime.bigint()-t0)/1e6);
  const body=await response.json();
  if(!response.ok||body?.ok!==true||body?.delivered!==subscriberCount||body?.transportAuthority!==false){
    throw new Error(`WEBSOCKET_FANOUT_42_11 FAIL: sequence=${sequence} delivered=${body?.delivered} status=${response.status}`);
  }
  if(!Array.isArray(body.samplesMs)||body.samplesMs.length!==subscriberCount) throw new Error("WEBSOCKET_FANOUT_42_11 FAIL: transport samples missing");
  transportSamples.push(...body.samplesMs.map(Number));
}

const expectedDeliveries=subscriberCount*eventCount;
const deadline=Date.now()+15000;
while(sequences.reduce((sum,items)=>sum+items.length,0)<expectedDeliveries&&Date.now()<deadline) await delay(25);

let ordered=true;
let incomplete=0;
for(const values of sequences){
  if(values.length!==eventCount){incomplete+=1;ordered=false;continue;}
  for(let sequence=1;sequence<=eventCount;sequence+=1){
    if(values[sequence-1]!==sequence){ordered=false;break;}
  }
}
if(incomplete>0) throw new Error(`WEBSOCKET_FANOUT_42_11 FAIL: incomplete subscribers=${incomplete}`);
if(!ordered) throw new Error("WEBSOCKET_FANOUT_42_11 FAIL: delivery ordering drift");
if(socketErrors>0) throw new Error(`WEBSOCKET_FANOUT_42_11 FAIL: socket errors=${socketErrors}`);
if(transportSamples.length!==expectedDeliveries) throw new Error(`WEBSOCKET_FANOUT_42_11 FAIL: samples=${transportSamples.length}/${expectedDeliveries}`);

const report={
  taskId:"42.11",
  title:"WebSocket fanout saturation test",
  certified:true,
  environment:"github-actions-production-like-local",
  transport:"websocket",
  transportAuthority:false,
  subscribers:subscriberCount,
  events:eventCount,
  deliveries:expectedDeliveries,
  connectionOpenMs,
  socketErrors,
  orderedDeliveryVerified:true,
  transportHandoffLatencyMs:{
    p50:percentile(transportSamples,.50),p95:percentile(transportSamples,.95),p99:percentile(transportSamples,.99),max:Math.max(...transportSamples)
  },
  publisherHttpLatencyMs:{
    p50:percentile(publishHttpLatencies,.50),p95:percentile(publishHttpLatencies,.95),p99:percentile(publishHttpLatencies,.99),max:Math.max(...publishHttpLatencies)
  },
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
for(const socket of sockets){try{socket.close(1000,"fanout-certification-complete");}catch{}}
await delay(150);
console.log(`WEBSOCKET_FANOUT_42_11 PASS subscribers=${subscriberCount} events=${eventCount} deliveries=${expectedDeliveries} open_ms=${connectionOpenMs.toFixed(2)} p50_ms=${report.transportHandoffLatencyMs.p50.toFixed(3)} p95_ms=${report.transportHandoffLatencyMs.p95.toFixed(3)} p99_ms=${report.transportHandoffLatencyMs.p99.toFixed(3)}`);

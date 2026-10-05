import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl=String(process.argv[2]||"http://127.0.0.1:4020").replace(/\/$/,"");
const wsUrl=baseUrl.replace(/^http/,"ws");
const key=process.env.ENCHEV_REALTIME_INTERNAL_KEY||"ci-realtime";
const concurrentClients=Number(process.env.ENCHEV_42_12_CLIENTS||200);
const cycles=Number(process.env.ENCHEV_42_12_CYCLES||5);
const output=process.env.ENCHEV_42_12_OUTPUT||"artifacts/42-12/reconnect-storm.json";

if(typeof WebSocket!=="function") throw new Error("RECONNECT_STORM_42_12 FAIL: Node WebSocket unavailable");
if(!Number.isSafeInteger(concurrentClients)||concurrentClients<50||concurrentClients>500) throw new Error("RECONNECT_STORM_42_12 FAIL: invalid client count");
if(!Number.isSafeInteger(cycles)||cycles<3||cycles>10) throw new Error("RECONNECT_STORM_42_12 FAIL: invalid cycle count");

const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
function percentile(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))]||0;
}
async function health(){
  const response=await fetch(baseUrl+"/health");
  const body=await response.json();
  if(!response.ok||body?.ok!==true) throw new Error("RECONNECT_STORM_42_12 FAIL: realtime health unavailable");
  return body;
}
async function waitConnections(expected,timeoutMs=10000){
  const deadline=Date.now()+timeoutMs;
  let last=-1;
  while(Date.now()<deadline){
    const body=await health();
    last=Number(body.connections);
    if(last===expected) return body;
    await delay(20);
  }
  throw new Error(`RECONNECT_STORM_42_12 FAIL: connections=${last}, expected=${expected}`);
}

const auctionId=randomUUID();
const subject=`auction/${auctionId}`;
const waveMetrics=[];
const allOpenLatencies=[];
let socketErrors=0;
let totalDeliveries=0;
const startedAt=new Date().toISOString();

for(let cycle=1;cycle<=cycles;cycle+=1){
  const sockets=[];
  const received=Array(concurrentClients).fill(0);
  const openLatencies=[];
  const waveOpenStarted=process.hrtime.bigint();

  for(let offset=0;offset<concurrentClients;offset+=100){
    const batch=Array.from({length:Math.min(100,concurrentClients-offset)},(_,localIndex)=>new Promise((resolve,reject)=>{
      const index=offset+localIndex;
      const t0=process.hrtime.bigint();
      const socket=new WebSocket(`${wsUrl}/ws?subject=${encodeURIComponent(subject)}`);
      sockets[index]=socket;
      const timer=setTimeout(()=>reject(new Error(`cycle=${cycle} subscriber=${index} open timeout`)),10000);
      socket.addEventListener("open",()=>{
        clearTimeout(timer);
        const latencyMs=Number(process.hrtime.bigint()-t0)/1e6;
        openLatencies.push(latencyMs);
        allOpenLatencies.push(latencyMs);
        resolve();
      },{once:true});
      socket.addEventListener("error",()=>{
        socketErrors+=1;
        clearTimeout(timer);
        reject(new Error(`cycle=${cycle} subscriber=${index} socket error`));
      },{once:true});
      socket.addEventListener("message",(event)=>{
        try{
          const parsed=JSON.parse(String(event.data));
          if(parsed.subject===subject&&parsed.sequence===cycle) received[index]+=1;
        }catch{}
      });
    }));
    await Promise.all(batch);
  }

  const openMs=Number(process.hrtime.bigint()-waveOpenStarted)/1e6;
  await waitConnections(concurrentClients);

  const event={
    id:randomUUID(),
    type:"enchev.auction.snapshot.v1",
    source:"enchev.api",
    subject,
    time:new Date().toISOString(),
    sequence:cycle,
    schemaVersion:1,
    correlationId:randomUUID(),
    data:{reconnectCycle:cycle},
  };

  const publishStarted=process.hrtime.bigint();
  const response=await fetch(baseUrl+"/publish",{
    method:"POST",
    headers:{"content-type":"application/json","x-enchev-realtime-key":key},
    body:JSON.stringify(event),
  });
  const publishHttpMs=Number(process.hrtime.bigint()-publishStarted)/1e6;
  const published=await response.json();
  if(!response.ok||published?.ok!==true||published?.delivered!==concurrentClients){
    throw new Error(`RECONNECT_STORM_42_12 FAIL: cycle=${cycle} publish delivered=${published?.delivered}`);
  }

  const deliveryDeadline=Date.now()+10000;
  while(received.reduce((a,b)=>a+b,0)<concurrentClients&&Date.now()<deliveryDeadline) await delay(20);
  if(received.some((n)=>n!==1)){
    const bad=received.filter((n)=>n!==1).length;
    throw new Error(`RECONNECT_STORM_42_12 FAIL: cycle=${cycle} exactly-once delivery failures=${bad}`);
  }
  totalDeliveries+=concurrentClients;

  const closeStarted=process.hrtime.bigint();
  for(const socket of sockets){
    try{socket.close(1000,"reconnect-cycle");}catch{}
  }
  await waitConnections(0);
  const closeMs=Number(process.hrtime.bigint()-closeStarted)/1e6;

  waveMetrics.push({
    cycle,
    clients:concurrentClients,
    openMs,
    closeMs,
    publishHttpMs,
    transportP95Ms:Number(published?.latencyMs?.p95||0),
  });
}

const finalHealth=await health();
if(Number(finalHealth.connections)!==0) throw new Error("RECONNECT_STORM_42_12 FAIL: residual connections remain");
if(socketErrors!==0) throw new Error(`RECONNECT_STORM_42_12 FAIL: socket errors=${socketErrors}`);

const totalConnectionsOpened=concurrentClients*cycles;
const report={
  taskId:"42.12",
  title:"Reconnect-storm certification",
  certified:true,
  environment:"github-actions-production-like-local",
  transport:"websocket",
  transportAuthority:false,
  concurrentClients,
  cycles,
  totalConnectionsOpened,
  totalDeliveries,
  socketErrors,
  residualConnections:Number(finalHealth.connections),
  exactlyOncePerReconnectCycleVerified:true,
  connectionOpenLatencyMs:{
    p50:percentile(allOpenLatencies,.50),p95:percentile(allOpenLatencies,.95),p99:percentile(allOpenLatencies,.99),max:Math.max(...allOpenLatencies)
  },
  waveMetrics,
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||"local",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`RECONNECT_STORM_42_12 PASS clients=${concurrentClients} cycles=${cycles} reconnects=${totalConnectionsOpened} deliveries=${totalDeliveries} residual=0 open_p95_ms=${report.connectionOpenLatencyMs.p95.toFixed(2)}`);

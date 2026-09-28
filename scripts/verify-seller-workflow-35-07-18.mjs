import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-seller-workflow-35-07-18.json";
const DOMAIN_PATH="packages/domain/src/seller-workflow.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("SELLER_WORKFLOW_35_07_18 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="35");
  if(!phase) fail("phase 35 missing");
  return phase[2].slice(6,18).map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"35."+String(index+7).padStart(2,"0"),name,kind:kindRaw==="security"?"security":kindRaw==="test"?"test":"feature"};
  });
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-seller-workflow-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"seller-workflow.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
if(JSON.stringify(config.tasks)!==JSON.stringify(frozenTasks())) fail("frozen 35.07-35.18 task identity drift");
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./seller-workflow";')) fail("domain export missing");

const d=await loadDomain();
const question={questionId:"q1",vehicleId:"v1",askerUserId:"buyer-1",body:"Can you confirm the service history?",createdAt:"2026-09-28T10:00:00Z",status:"published"};
const verification={sellerId:"seller-1",verificationId:"verify-1",status:"verified",verifiedAt:"2026-09-28T09:30:00Z"};

let replies=[];
replies=d.addSellerVerifiedReply(replies,[question],verification,{
  replyId:"r1",questionId:"q1",vehicleId:"v1",sellerId:"seller-1",
  body:"Yes. Full service history is available.",createdAt:"2026-09-28T10:05:00Z",
  media:[{id:"m1",kind:"qa-document",uri:"s3://listing/service-history.pdf"}]
});
if(replies.length!==1||!replies[0].verifiedSeller) fail("35.07 verified reply drift");
if(replies[0].media.length!==1||replies[0].media[0].kind!=="qa-document") fail("35.08 answer media drift");

const abuse=d.detectQuestionAbuse("visit https://a.test https://b.test https://c.test",[]);
if(abuse.allowed||!abuse.reasons.includes("too-many-links")) fail("35.09 abuse detection drift");
const hidden=d.applyQuestionModeration(question,{moderationId:"mod-1",questionId:"q1",moderatorId:"staff-1",action:"hide",reason:"abuse sample",occurredAt:"2026-09-28T10:06:00Z"});
if(hidden.question.status!=="hidden") fail("35.09 moderation drift");
if(!d.assertQaTimestampImmutable(question,hidden.question)) fail("35.10 immutable question timestamp drift");
const revised=d.reviseSellerReplyContent(replies[0],{body:"Yes. Full documented service history is available.",media:replies[0].media});
if(revised.createdAt!==replies[0].createdAt) fail("35.10 immutable reply timestamp drift");

let presence=d.updateSellerLiveAuctionPresence(null,{sellerId:"seller-1",auctionId:"a1",connectionId:"c1",state:"online",sequence:1,observedAt:"2026-09-28T10:10:00Z"});
presence=d.updateSellerLiveAuctionPresence(presence,{sellerId:"seller-1",auctionId:"a1",connectionId:"c1",state:"away",sequence:2,observedAt:"2026-09-28T10:11:00Z"});
if(presence.state!=="away"||presence.sequence!==2) fail("35.11 seller presence drift");

let viewing=d.createViewingRequest({requestId:"view-1",listingId:"l1",vehicleId:"v1",buyerId:"buyer-1",sellerId:"seller-1",requestedAt:"2026-09-28T10:12:00Z",scheduledFor:null,status:"requested",updatedAt:"2026-09-28T10:12:00Z"});
viewing=d.transitionViewingRequest(viewing,"accepted","2026-09-28T10:13:00Z","2026-09-29T09:00:00Z");
viewing=d.transitionViewingRequest(viewing,"completed","2026-09-29T09:30:00Z");
if(viewing.status!=="completed") fail("35.12 viewing workflow drift");

let reserve=d.normalizeReserveState({listingId:"l1",sellerId:"seller-1",reserveCents:1500000,revision:0,updatedAt:"2026-09-28T10:14:00Z",appliedMutationIds:[]});
reserve=d.lowerListingReserve(reserve,{sellerId:"seller-1",mutationId:"reserve-1",expectedRevision:0,newReserveCents:1400000,occurredAt:"2026-09-28T10:15:00Z"});
const reserveRetry=d.lowerListingReserve(reserve,{sellerId:"seller-1",mutationId:"reserve-1",expectedRevision:0,newReserveCents:1300000,occurredAt:"2026-09-28T10:16:00Z"});
if(reserve.reserveCents!==1400000||reserve.revision!==1||reserveRetry.reserveCents!==1400000) fail("35.13 reserve lowering drift");

let follow=d.openReserveNotMetFollowUp({followUpId:"f1",listingId:"l1",sellerId:"seller-1",reserveCents:1400000,highestBidCents:1350000,status:"pending",openedAt:"2026-09-28T11:00:00Z",updatedAt:"2026-09-28T11:00:00Z"});
follow=d.resolveReserveNotMetFollowUp(follow,"relist","2026-09-28T11:05:00Z");
if(follow.status!=="relist") fail("35.14 reserve-not-met follow-up drift");

let history=[];
history=d.appendListingChange(history,{changeId:"chg-1",listingId:"l1",actorId:"seller-1",field:"description",before:"Old",after:"Updated",critical:false,sequence:1,changedAt:"2026-09-28T11:10:00Z"});
history=d.appendListingChange(history,{changeId:"chg-2",listingId:"l1",actorId:"seller-1",field:"vin",before:"VIN-OLD",after:"VIN-CORRECTED",critical:true,sequence:2,changedAt:"2026-09-28T11:11:00Z"});
if(history.length!==2||history[1].sequence!==2) fail("35.15 listing change history drift");
let publication=d.publicationStateAfterListingChange("published",history[1]);
if(publication!=="pending-review") fail("35.16 critical edit review gate drift");
publication=d.republishAfterReview(publication,true);
if(publication!=="published") fail("35.16 republish after review drift");

let notifications=[];
notifications=d.createSellerResponseNotification(notifications,replies[0],question,"in-app","2026-09-28T11:12:00Z");
notifications=d.createSellerResponseNotification(notifications,replies[0],question,"in-app","2026-09-28T11:13:00Z");
if(notifications.length!==1||notifications[0].recipientUserId!=="buyer-1") fail("35.17 seller response notification drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("unverified reply",()=>d.addSellerVerifiedReply([], [question], {...verification,status:"revoked"}, {replyId:"rx",questionId:"q1",vehicleId:"v1",sellerId:"seller-1",body:"x",createdAt:"2026-09-28T12:00:00Z",media:[]}));
  await reject("hidden question reply",()=>d.addSellerVerifiedReply([], [{...question,status:"hidden"}], verification, {replyId:"rx2",questionId:"q1",vehicleId:"v1",sellerId:"seller-1",body:"x",createdAt:"2026-09-28T12:00:00Z",media:[]}));
  await reject("answer media duplicate",()=>d.addSellerVerifiedReply([], [question], verification, {replyId:"rx3",questionId:"q1",vehicleId:"v1",sellerId:"seller-1",body:"x",createdAt:"2026-09-28T12:00:00Z",media:[{id:"m",kind:"qa-image",uri:"u1"},{id:"m",kind:"qa-image",uri:"u2"}]}));
  await reject("timestamp mutation",()=>d.assertQaTimestampImmutable({createdAt:"2026-09-28T10:00:00Z"},{createdAt:"2026-09-28T10:00:01Z"}));
  await reject("stale presence",()=>d.updateSellerLiveAuctionPresence(presence,{...presence,sequence:2,observedAt:"2026-09-28T10:12:00Z"}));
  await reject("accepted viewing without schedule",()=>d.transitionViewingRequest(d.createViewingRequest({requestId:"v2",listingId:"l1",vehicleId:"v1",buyerId:"b",sellerId:"s",requestedAt:"2026-09-28T10:00:00Z",scheduledFor:null,status:"requested",updatedAt:"2026-09-28T10:00:00Z"}),"accepted","2026-09-28T10:01:00Z",null));
  await reject("reserve increase",()=>d.lowerListingReserve(reserve,{sellerId:"seller-1",mutationId:"reserve-2",expectedRevision:1,newReserveCents:1500000,occurredAt:"2026-09-28T10:17:00Z"}));
  await reject("follow-up when reserve met",()=>d.openReserveNotMetFollowUp({followUpId:"f2",listingId:"l1",sellerId:"seller-1",reserveCents:100,highestBidCents:100,status:"pending",openedAt:"2026-09-28T11:00:00Z",updatedAt:"2026-09-28T11:00:00Z"}));
  await reject("listing sequence gap",()=>d.appendListingChange(history,{changeId:"chg-3",listingId:"l1",actorId:"seller-1",field:"x",before:null,after:"y",critical:false,sequence:4,changedAt:"2026-09-28T11:12:00Z"}));
  await reject("republish without review",()=>d.republishAfterReview("published",true));
  await reject("notification question mismatch",()=>d.createSellerResponseNotification([],replies[0],{...question,questionId:"other"},"email","2026-09-28T11:12:00Z"));
  console.log("SELLER_WORKFLOW_35_07_18_SELF_TEST PASS tasks=12 negative_cases=11 e2e=true");
}else{
  console.log("SELLER_WORKFLOW_35_07_18 PASS tasks=12 e2e=true");
}

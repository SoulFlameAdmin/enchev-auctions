#!/usr/bin/env node
// MISSION-003 trusted-session contract fixtures. Local-only, no HTTP/DB writes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

const source = fs.readFileSync("packages/domain/src/closed-demo-session-guard.ts","utf8");
const barrel = fs.readFileSync("packages/domain/src/index.ts","utf8");
const workflow = fs.readFileSync(".github/workflows/enchev-closed-demo-mission003-roles.yml","utf8");
const adapter = fs.readFileSync("app/lib/enchev-closed-demo-auth-server.ts","utf8");
function requireTest(condition, message) {
  if (!condition) throw new Error("ENCHEV_MISSION003_SESSION_GUARD FAIL: "+message);
}
requireTest(adapter.includes('import "server-only"') &&
  adapter.includes("closedDemoBoundaryFromServer") &&
  adapter.includes("request.cookies.get") &&
  adapter.includes("authorizeClosedDemoTicket") &&
  !adapter.includes("NEXT_PUBLIC_"), "server-only browser adapter contract broken");
requireTest(!barrel.includes('export * from "./closed-demo-session-guard"'),
  "server ticket verifier must not be exposed in domain barrel");
requireTest(source.includes("timingSafeEqual") && source.includes("readSession") &&
  source.includes("readRoster"), "missing token+authority verification");
requireTest(!/\b(fetch|axios|stripe|supabase)\s*\(/i.test(source),
  "auth contract must not access providers");
requireTest(workflow.includes("verify-enchev-closed-demo-session-guard.mjs"),
  "CI must test session guard");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-closed-demo-sessions-"));
try {
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  requireTest(fs.existsSync(tsc),"TypeScript compiler unavailable");
  const args=[tsc,
    "packages/domain/src/closed-demo-isolation.ts",
    "packages/domain/src/closed-demo-roles.ts",
    "packages/domain/src/closed-demo-session-guard.ts",
    "--ignoreConfig","--target","ES2022","--module","NodeNext",
    "--moduleResolution","NodeNext","--strict","--skipLibCheck",
    "--outDir",tmp,"--pretty","false"];
  const compile=spawnSync(process.execPath,args,{encoding:"utf8"});
  requireTest(compile.status===0,"TS compilation: "+(compile.stdout||compile.stderr||"").slice(0,3000));
  fs.writeFileSync(path.join(tmp,"package.json"),'{"type":"module"}');
  const roles=await import(pathToFileURL(path.join(tmp,"closed-demo-roles.js")).href);
  const isolation=await import(pathToFileURL(path.join(tmp,"closed-demo-isolation.js")).href);
  const sessions=await import(pathToFileURL(path.join(tmp,"closed-demo-session-guard.js")).href);
  const now=1_800_000_000_000;
  const boundary=isolation.createClosedDemoBoundary({
    nodeEnv:"test",vercelEnv:undefined,vercelProjectId:undefined,
    demoProjectId:undefined,enabled:"true",
    namespace:"enchev_closed_demo_local_sessions01",
    paymentMode:"simulated-only",documentMode:"watermarked-nonlegal",
    storageMode:"memory-only",paymentProvider:undefined,
    realPaymentsEnabled:undefined,providerSecretPresent:false,
    databaseWriteCredentialPresent:false
  });
  const id=[
    {role:"seller",subjectId:"demo-seller-001",sessionId:"seller_session_1234567890"},
    {role:"admin",subjectId:"demo-admin-001",sessionId:"admin_session_1234567890"},
    {role:"mitko",subjectId:"demo-mitko-001",sessionId:"mitko_session_1234567890"},
    {role:"borko",subjectId:"demo-borko-001",sessionId:"borko_session_1234567890"},
    {role:"automation",subjectId:"demo-automation-001",sessionId:"automation_session_1234567890"}
  ];
  const actors=Object.fromEntries(id.map(x=>[x.role,x]));
  const db=new Map(id.map(x=>[x.sessionId,{
    ...x,namespace:boundary.namespace,status:"active",expiresAtMs:now+60*60*1000
  }]));
  let roster=id.map(x=>({...x}));
  let readThrows=false;
  const store={
    async readSession(sid){if(readThrows)throw new Error("unavailable");return db.get(sid)??null},
    async readRoster(){if(readThrows)throw new Error("unavailable");return roster}
  };
  const secret=Buffer.alloc(32,0x61),other=Buffer.alloc(32,0x62);
  const tokens=Object.fromEntries(id.map(x=>[
    x.role,sessions.issueClosedDemoSessionTicket(boundary,x.sessionId,now,secret)
  ]));
  const auction={namespace:boundary.namespace,kind:"auction",id:"demo-auction-003",
    sellerId:actors.seller.subjectId};
  const document={namespace:boundary.namespace,kind:"document",id:"demo-document-003",
    sellerId:actors.seller.subjectId,demoWatermarked:true};
  const ownedBid=role=>({...auction,buyerId:actors[role].subjectId});
  const check=(token,key,action,target,clock=now+1000,auth=store)=>
    sessions.authorizeClosedDemoTicket(boundary,token,key,clock,auth,action,target);
  let passed=0,denied=0;
  async function allow(label,promise){
    const d=await promise;
    requireTest(d.permitted===true && d.reason==="ALLOW",label+": "+d.reason);
    passed++;
  }
  async function reject(label,promise,reason){
    const d=await promise;
    requireTest(d.permitted===false && (!reason || d.reason===reason),
      label+": unexpectedly "+JSON.stringify(d));
    denied++;
  }
  await allow("Mitko bids own lot",check(tokens.mitko,secret,"bid:place",ownedBid("mitko")));
  await allow("Borko bids own lot",check(tokens.borko,secret,"bid:place",ownedBid("borko")));
  await allow("Admin starts auction",check(tokens.admin,secret,"auction:start",auction));
  await allow("Seller previews demo document",check(tokens.seller,secret,
    "document:preview",document));
  await allow("Automation can view audit",check(tokens.automation,secret,"audit:read",
    {namespace:boundary.namespace,kind:"audit",id:"demo-audit-001"}));

  await reject("Wrong signing key",check(tokens.mitko,other,"bid:place",ownedBid("mitko")),"INVALID_TICKET");
  await reject("Tampered signature",check(tokens.mitko.slice(0,-1)+"A",secret,"bid:place",ownedBid("mitko")));
  const [body,mac]=tokens.mitko.split(".");
  const hackedPayload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  hackedPayload.sessionId=actors.admin.sessionId;
  const hacked=Buffer.from(JSON.stringify(hackedPayload)).toString("base64url")+"."+mac;
  await reject("Forged principal",check(hacked,secret,"auction:start",auction),"INVALID_TICKET");
  await reject("Malformed ticket",check("not_a_ticket",secret,"bid:place",ownedBid("mitko")),"INVALID_TICKET");
  await reject("Expired signed ticket",check(tokens.mitko,secret,"bid:place",
    ownedBid("mitko"),now+15*60*1000),"TICKET_EXPIRED");
  await reject("Wrong actor permissions",check(tokens.admin,secret,"bid:place",ownedBid("mitko")),"ROLE_DENIED");
  await reject("Cross-bidder access",check(tokens.mitko,secret,"bid:place",
    ownedBid("borko")),"OWNERSHIP_DENIED");
  await reject("Unwatermarked doc",check(tokens.seller,secret,"document:preview",
    {...document,demoWatermarked:false}),"UNSAFE_TARGET");
  await reject("Wrong namespace",check(tokens.borko,secret,"bid:place",
    {...ownedBid("borko"),namespace:"public"}),"UNSAFE_TARGET");
  db.set(actors.mitko.sessionId,{...db.get(actors.mitko.sessionId),status:"revoked"});
  await reject("Session revoked",check(tokens.mitko,secret,"bid:place",ownedBid("mitko")),"SESSION_INACTIVE");
  db.set(actors.mitko.sessionId,{...db.get(actors.mitko.sessionId),status:"active",
    expiresAtMs:now+500});
  await reject("Authority session expired",check(tokens.mitko,secret,"bid:place",ownedBid("mitko")),"SESSION_INACTIVE");
  db.set(actors.mitko.sessionId,{...db.get(actors.mitko.sessionId),expiresAtMs:now+60*60*1000});
  db.set(actors.mitko.sessionId,{...db.get(actors.mitko.sessionId),role:"admin"});
  await reject("Role spoofed in DB",check(tokens.mitko,secret,"bid:place",ownedBid("mitko")),"ROSTER_MISMATCH");
  db.set(actors.mitko.sessionId,{...db.get(actors.mitko.sessionId),role:"mitko"});
  roster=roster.map(x=>x.role==="mitko"?{...x,subjectId:"demo-unknown-001"}:x);
  await reject("Roster changed",check(tokens.mitko,secret,"bid:place",ownedBid("mitko")),"ROSTER_MISMATCH");
  roster=id.map(x=>({...x}));
  readThrows=true;
  await reject("Authority offline",check(tokens.mitko,secret,"bid:place",ownedBid("mitko")),"AUTHORITY_UNAVAILABLE");
  readThrows=false;
  await reject("Untrusted fake boundary",sessions.authorizeClosedDemoTicket({...boundary},
    tokens.mitko,secret,now+1000,store,"bid:place",ownedBid("mitko")),"INVALID_BOUNDARY");
  await reject("Missing loader",check(tokens.mitko,secret,"bid:place",ownedBid("mitko"),
    now+1000,{}),"AUTHORITY_UNAVAILABLE");

  let blocked=false;
  try {sessions.issueClosedDemoSessionTicket(boundary,actors.mitko.sessionId,now,
    Buffer.alloc(4));}catch{blocked=true}
  requireTest(blocked,"Short signing secret accepted");denied++;
  blocked=false;
  try {sessions.issueClosedDemoSessionTicket({...boundary},actors.mitko.sessionId,now,secret)}
  catch{blocked=true}
  requireTest(blocked,"Forged boundary accepted for issuance");denied++;
  requireTest(!fs.readFileSync("packages/domain/src/index.ts","utf8")
    .includes("closed-demo-session-guard"),"Secret-bearing helpers exported via barrel");
  console.log("ENCHEV_MISSION003_SESSION_GUARD PASS allow="+passed+" deny="+denied+
    " no real login/DB/API changes; acceptance still YELLOW");
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}

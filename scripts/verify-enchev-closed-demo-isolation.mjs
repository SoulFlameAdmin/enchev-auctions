#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

const domainFile="packages/domain/src/closed-demo-isolation.ts";
const serverFile="app/lib/enchev-closed-demo-server.ts";
const indexFile="packages/domain/src/index.ts";
const overlayFile="docs/URGENT_DAVID_AGI_ENCHEV_CLOSED_DEMO_V1.md";

function fail(message){throw new Error("ENCHEV_MISSION002_ISOLATION FAIL: "+message);}
function must(condition,message){if(!condition)fail(message);}
const overlay=fs.readFileSync(overlayFile,"utf8");
must(overlay.includes("### MISSION-002 — Safe work branch / environment"),"MISSION-002 source missing");
must(overlay.includes("production cannot accidentally receive demo payment/document effects"),"MISSION-002 acceptance changed");
must(fs.readFileSync(indexFile,"utf8").includes('export * from "./closed-demo-isolation";'),"domain export missing");
const domainSource=fs.readFileSync(domainFile,"utf8");
const serverSource=fs.readFileSync(serverFile,"utf8");
must(serverSource.includes('import "server-only";'),"runtime module must be server-only");
must(serverSource.includes("process.env.VERCEL_ENV") && serverSource.includes("process.env.VERCEL_PROJECT_ID"),"runtime source must be server-derived");
must(!serverSource.includes("NEXT_PUBLIC_"),"must not put demo secrets in public bundle");
must(!/\b(fetch|axios|paymentIntents|createPaymentIntent)\s*\(/.test(domainSource),"domain must not perform external I/O");
must(!/\b(fetch|axios|paymentIntents|createPaymentIntent)\s*\(/.test(serverSource),"server adapter must not perform external I/O");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-closed-demo-isolation-"));
try{
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  must(fs.existsSync(tsc),"typescript dependency missing");
  const result=spawnSync(process.execPath,[tsc,domainFile,
    "--ignoreConfig","--target","ES2022","--module","ES2022",
    "--moduleResolution","Bundler","--skipLibCheck","--strict",
    "--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  must(result.status===0,"TypeScript domain compilation: "+(result.stderr||result.stdout||"").slice(0,2500));
  const d=await import(pathToFileURL(path.join(tmp,"closed-demo-isolation.js")).href);

  const valid={
    nodeEnv:"test",vercelEnv:undefined,vercelProjectId:undefined,demoProjectId:undefined,
    enabled:"true",namespace:"enchev_closed_demo_local_test0001",
    paymentMode:"simulated-only",documentMode:"watermarked-nonlegal",
    storageMode:"memory-only",paymentProvider:undefined,
    realPaymentsEnabled:undefined,providerSecretPresent:false,
    databaseWriteCredentialPresent:false
  };
  const b=d.createClosedDemoBoundary(valid);
  must(Object.isFrozen(b)&&b.externalEffects===false&&b.environment==="local","local boundary must be immutable and effect-free");
  const doc=d.prepareClosedDemoDocument(b,"demo-abc123","pro-forma");
  const pay=d.prepareClosedDemoPayment(b,"demo-abc123",10025,"EUR");
  must(Object.isFrozen(doc)&&doc.taxInvoice===false&&doc.legalEffect===false,"document claims legal status");
  must(doc.watermark.includes("NOT A TAX INVOICE")&&doc.storageMode==="memory-only","document watermark or storage wrong");
  must(Object.isFrozen(pay)&&pay.provider==="NONE"&&!pay.canCharge&&!pay.canSettle&&!pay.hasPayableInstructions,"payment has real-world capability");
  must(pay.state==="NOT_PAYABLE"&&pay.amountMinor===10025,"payment must not be a receivable");
  must(!/\b(iban|checkoutUrl|paymentUrl|clientSecret|serviceRole)\b/i.test(JSON.stringify(pay)),"payment includes a real routing field");

  const preview={...valid,nodeEnv:"production",vercelEnv:"preview",
    vercelProjectId:"prj_closedDemoIsolated123",
    demoProjectId:"prj_closedDemoIsolated123",
    namespace:"enchev_closed_demo_preview_test0001"};
  const previewCtx=d.createClosedDemoBoundary(preview);
  must(previewCtx.environment==="preview"&&previewCtx.externalEffects===false,"isolated preview should allow pure offline previews");

  let negatives=0;
  const reject=(name,fn)=>{
    let blocked=false;
    try{fn();}catch(err){blocked=String(err?.message||err).startsWith("ENCHEV_CLOSED_DEMO_DISABLED:");}
    if(!blocked) fail("negative case not blocked: "+name);
    negatives++;
  };
  reject("feature disabled",()=>d.createClosedDemoBoundary({...valid,enabled:undefined}));
  reject("unrecognized namespace",()=>d.createClosedDemoBoundary({...valid,namespace:"public"}));
  reject("production Vercel",()=>d.createClosedDemoBoundary({...valid,vercelEnv:"production",nodeEnv:"production"}));
  reject("production Node local",()=>d.createClosedDemoBoundary({...valid,nodeEnv:"production"}));
  reject("preview on real auction project",()=>d.createClosedDemoBoundary({...preview,vercelProjectId:d.CLOSED_DEMO_PRODUCTION_VERCEL_PROJECT_ID,demoProjectId:d.CLOSED_DEMO_PRODUCTION_VERCEL_PROJECT_ID}));
  reject("preview missing exact binding",()=>d.createClosedDemoBoundary({...preview,demoProjectId:undefined}));
  reject("preview matching wrong project",()=>d.createClosedDemoBoundary({...preview,demoProjectId:"prj_otherProject"}));
  reject("preview lacks production Node build",()=>d.createClosedDemoBoundary({...preview,nodeEnv:"test"}));
  reject("preview local namespace",()=>d.createClosedDemoBoundary({...preview,namespace:valid.namespace}));
  reject("real payment configured",()=>d.createClosedDemoBoundary({...valid,realPaymentsEnabled:"true"}));
  reject("real payment 1 configured",()=>d.createClosedDemoBoundary({...valid,realPaymentsEnabled:"1"}));
  reject("real payment uppercase configured",()=>d.createClosedDemoBoundary({...valid,realPaymentsEnabled:"TRUE"}));
  reject("payment provider configured",()=>d.createClosedDemoBoundary({...valid,paymentProvider:"stripe"}));
  reject("provider secret present",()=>d.createClosedDemoBoundary({...valid,providerSecretPresent:true}));
  reject("database write credential present",()=>d.createClosedDemoBoundary({...valid,databaseWriteCredentialPresent:true}));
  reject("live payment mode",()=>d.createClosedDemoBoundary({...valid,paymentMode:"live"}));
  reject("real invoice mode",()=>d.createClosedDemoBoundary({...valid,documentMode:"fiscal"}));
  reject("persistent storage",()=>d.createClosedDemoBoundary({...valid,storageMode:"database"}));
  reject("forged boundary",()=>d.prepareClosedDemoDocument({...b},"demo-abc123","pro-forma"));
  reject("non-demo transaction",()=>d.prepareClosedDemoDocument(b,"real-tx-42","pro-forma"));
  reject("unsupported legal document",()=>d.prepareClosedDemoDocument(b,"demo-abc123","tax-invoice"));
  reject("invalid amount",()=>d.prepareClosedDemoPayment(b,"demo-abc123",NaN,"EUR"));
  reject("negative amount",()=>d.prepareClosedDemoPayment(b,"demo-abc123",-1,"EUR"));
  reject("floating amount",()=>d.prepareClosedDemoPayment(b,"demo-abc123",1.2,"EUR"));
  reject("wrong currency",()=>d.prepareClosedDemoPayment(b,"demo-abc123",100,"USD"));
  reject("payment forged boundary",()=>d.prepareClosedDemoPayment({...b},"demo-abc123",100,"EUR"));
  console.log("ENCHEV_MISSION002_ISOLATION PASS — local+preview pure tests and "+negatives+" negative cases; external effects=0; source=MISSION-002");
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

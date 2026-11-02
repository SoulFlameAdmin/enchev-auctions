#!/usr/bin/env node
/**
 * Read-only diagnostic of public production assets as a possible sha256
 * verified recovery mirror. No secrets, no writes, no launch decisions.
 */
import fs from "node:fs";
import {createHash} from "node:crypto";
const manifest=JSON.parse(fs.readFileSync("config/forge-assets.json","utf8"));
const targets=[
 "media/9e4253c49399505b018a.jpg",
 "media/833f233b33cbcd789d20.jpg",
 "videos/intro-scroll.af",
 "videos/hero-intro.af",
 "videos/hero-mobile.af"
];
for (const path of targets) {
 const asset=manifest.find(x=>x.path===path);
 if(!asset)throw Error("Expected asset missing from manifest: "+path);
 const url="https://enchev-auctions.vercel.app/forge/"+path;
 try {
  const response=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(12000),cache:"no-store"});
  const type=response.headers.get("content-type")||"";
  let shaMatch=false, size=0;
  if(response.ok){
   const body=Buffer.from(await response.arrayBuffer());
   size=body.byteLength;
   shaMatch=createHash("sha256").update(body).digest("hex")===asset.sha256;
  }
  console.log("FORGE_MIRROR_DIAGNOSTIC "+JSON.stringify({path,status:response.status,type,size,shaMatch}));
 }catch(error){
  console.log("FORGE_MIRROR_DIAGNOSTIC "+JSON.stringify({path,error:String(error?.name||"network-error")}));
 }
}

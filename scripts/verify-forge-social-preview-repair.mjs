#!/usr/bin/env node
/**
 * P0 Forge social preview guard. Inspects the original compressed content,
 * the reduced SHA-256-pinned media manifest, and the replacement target.
 * Does NOT fetch remote content or suppress a failed asset download.
 */
import fs from "node:fs";
import {gunzipSync} from "node:zlib";
function must(x,reason){if(!x)throw Error("FORGE_SOCIAL_REPAIR FAIL: "+reason);}
const missing="media/2480ec12b70d13d46feb.jpg";
const brokenHash="d7577b4b9f6a6acda5594e9e6171678dba58e133";
const asset=fs.readFileSync("public/brand/ea-approved-1to1.jpg");
must(asset.length>1024&&asset[0]===0xff&&asset[1]===0xd8,"approved local JPEG missing/invalid");
const manifest=JSON.parse(fs.readFileSync("config/forge-assets.json","utf8"));
must(manifest.length===133,"expected original 134 minus one obsolete social-only image");
must(manifest.every(x=>x.path!==missing),"dead social image still required by clean build");
must(manifest.every(x=>typeof x.sha256==="string"&&/^[a-f0-9]{64}$/.test(x.sha256)),
  "remaining media SHA-256 integrity weakened");
const frontend=JSON.parse(gunzipSync(fs.readFileSync("config/forge-frontend.json.gz")));
const index=String(frontend["index.html"]||"");
const positions=[];let at=0;
while((at=index.indexOf(missing,at))!==-1){positions.push(at);at+=missing.length}
must(positions.length===4,"unexpected number of source social preview references");
for(const offset of positions){
  const near=index.slice(Math.max(0,offset-120),offset);
  must(near.includes("og:image")||near.includes("twitter:image"),
    "missing asset used outside social meta");
}
for(const [file,value] of Object.entries(frontend)){
  if(file==="index.html"||file==="source-manifest.json")continue;
  must(!String(value).includes(missing)&&!String(value).includes(brokenHash),
    "dead asset referenced in live Forge file "+file);
}
const script=fs.readFileSync("scripts/restore-forge-assets.mjs","utf8");
must(script.includes("replaceSocialToken(missingSocialImage, approvedSocialImage, 4)"),
  "HTML+RSC replacement absent");
must(script.includes("correctSocialDimension('width', 1200, socialWidth)") &&
  script.includes("correctSocialDimension('height', 630, socialHeight)"),
  "OpenGraph dimensions not corrected");
must(script.includes("digest(data) !== asset.sha256"),
  "remaining media integrity check unexpectedly removed");
console.log("FORGE_SOCIAL_REPAIR_STATIC PASS manifest=133 socialRefs=4 liveNonSocialRefs=0 sha256Checks=retained");

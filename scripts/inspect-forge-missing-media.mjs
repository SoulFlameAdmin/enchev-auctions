#!/usr/bin/env node
/**
 * Read-only Forge asset provenance inspection.
 * This script never downloads/changes assets, never disables the clean build.
 */
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
const hash = "d7577b4b9f6a6acda5594e9e6171678dba58e133";
const missingPath = "media/2480ec12b70d13d46feb.jpg";
const manifest = JSON.parse(fs.readFileSync("config/forge-assets.json","utf8"));
const matches = manifest.filter(x=>x.path === missingPath);
if (matches.length!==0 || manifest.length!==133) {
  throw Error("FORGE_MISSING_MEDIA_SCOPE: expected exactly 133 remaining hashed assets");
}
const frontend = JSON.parse(gunzipSync(fs.readFileSync("config/forge-frontend.json.gz")));
const needles = [missingPath, hash, "d7577b4b", "1200x630.jpg"];
const out = [];
for (const [file,raw] of Object.entries(frontend)) {
  const content=String(raw);
  for(const needle of needles) {
    let from=0,count=0,previews=[];
    while((from=content.indexOf(needle,from))!==-1) {
      count++;
      if(previews.length<8) previews.push(content.slice(Math.max(0,from-190),Math.min(content.length,from+needle.length+190))
        .replace(/\s+/g," ").slice(0,450));
      from+=needle.length;
    }
    if(count)out.push({file,needle,count,previews});
  }
}
const photoMap=JSON.parse(fs.readFileSync("config/forge-image-paths.json","utf8"));
const localRefs=Object.entries(photoMap).filter(([k,v])=>k.includes(hash)||v.includes(missingPath));
const summary={manifestAssets:manifest.length,frontendFiles:Object.keys(frontend).length,
  candidate:matches[0],references:out,sourceMap:localRefs};
console.log("FORGE_MISSING_MEDIA_PROVENANCE "+JSON.stringify(summary));

const index=String(frontend["index.html"]||"");
for(const needle of ["og:image:width","og:image:height"]){
 const positions=[];let at=0;
 while((at=index.indexOf(needle,at))!==-1){positions.push(at);at+=needle.length}
 console.log("FORGE_SOCIAL_FIELD_CONTEXT "+JSON.stringify({needle,positions,contexts:positions.map(i=>index.slice(i,i+90))}));
}

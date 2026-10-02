import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ENABLED = process.env.VERCEL === "1" || process.env.FORGE_SNAPSHOT_BUILD === "1";
if (!ENABLED) {
  console.log("FORGE_SNAPSHOT SKIP: enable on Vercel or set FORGE_SNAPSHOT_BUILD=1");
  process.exit(0);
}

const SOURCE = "https://forgeautomotive.co.uk";
const ALLOWED = new Set(["forgeautomotive.co.uk","cdn.sanity.io","cdn.forgeautomotive.media"]);
const OUT = path.resolve("public/forge-snapshot");
const MAX_FILES = 450;
const MAX_BYTES = 180 * 1024 * 1024;
const CONCURRENCY = 12;
const seeds = ["/","/builds/","/stock/","/contact/","/privacy/","/terms/","/cookies/"];

const queue = [];
const seen = new Set();
const entries = new Map();
let totalBytes = 0;

function clean(raw){
  return String(raw || "")
    .trim()
    .replace(/^["'\x60]+|["'\x60]+$/g,"")
    .replace(/\\u0026/g,"&")
    .replace(/\\\//g,"/");
}

function normalize(raw, base=SOURCE+"/"){
  const value=clean(raw);
  if(!value || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(value)) return null;
  try{
    const u=new URL(value,base);
    if(!ALLOWED.has(u.hostname)) return null;
    u.hash="";
    if(u.hostname==="cdn.sanity.io") u.search="";
    return u.href;
  }catch{return null}
}

function add(raw,base){
  const url=normalize(raw,base);
  if(!url || seen.has(url) || queue.length>=MAX_FILES) return;
  seen.add(url);
  queue.push(url);
}

function hasExt(p){
  return /\.[a-z0-9]{1,9}$/i.test(p);
}

function hashedSuffix(search){
  if(!search) return "";
  return "__q_"+crypto.createHash("sha1").update(search).digest("hex").slice(0,10);
}

function localName(url, type=""){
  const u=new URL(url);
  let p=decodeURIComponent(u.pathname || "/");
  if(u.hostname==="forgeautomotive.co.uk"){
    if(!p || p==="/") p="/index.html";
    else if(p.endsWith("/")) p+="index.html";
    else if(/text\/html/i.test(type) && !hasExt(p)) p+="/index.html";
    if(u.search && !p.endsWith(".html")) {
      const ext=path.posix.extname(p);
      p=(ext ? p.slice(0,-ext.length) : p)+hashedSuffix(u.search)+ext;
    }
    return "site/"+p.replace(/^\/+/, "");
  }
  if(!p || p==="/") p="/index";
  if(u.search){
    const ext=path.posix.extname(p);
    p=(ext ? p.slice(0,-ext.length) : p)+hashedSuffix(u.search)+ext;
  }
  return "external/"+u.hostname+"/"+p.replace(/^\/+/, "");
}

function scan(text,base){
  if(!text) return;
  const t=text.replace(/\\u0026/g,"&").replace(/\\\//g,"/");

  for(const m of t.matchAll(/https?:\/\/[^\s"'\x60<>\\]+/g)) add(m[0],base);
  for(const m of t.matchAll(/(?:src|href|poster|content)=["']([^"']+)["']/gi)) add(m[1],base);
  for(const m of t.matchAll(/(?:srcset)=["']([^"']+)["']/gi)){
    for(const part of m[1].split(",")) add(part.trim().split(/\s+/)[0],base);
  }
  for(const m of t.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) add(m[1],base);
  for(const m of t.matchAll(/["'\x60](\/(?:_next|videos|images|static|assets)\/[^"'\x60\s<>]+)["'\x60]/g)) add(m[1],base);
  for(const m of t.matchAll(/["'\x60]([^"'\x60\s<>]+\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico|mp4|webm|mov|af|glb|gltf|bin|wasm|json|webmanifest))(?:\?[^"'\x60]*)?["'\x60]/gi)) add(m[1],base);
}

async function fetchOne(url){
  try{
    const res=await fetch(url,{redirect:"follow",headers:{"User-Agent":"ENCHEV-Snapshot/1.0"}});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const type=res.headers.get("content-type") || "";
    const data=Buffer.from(await res.arrayBuffer());
    if(totalBytes+data.length>MAX_BYTES) throw new Error("snapshot byte cap reached");
    totalBytes+=data.length;
    const name=localName(url,type);
    entries.set(url,{url,name,type,data});
    if(/text\/html|javascript|text\/css|application\/(?:json|manifest\+json)/i.test(type) || /\.(?:js|css|json|gltf|webmanifest)$/i.test(new URL(url).pathname)){
      scan(data.toString("utf8"),url);
    }
    console.log("FORGE_SNAPSHOT",entries.size+"/"+queue.length,(totalBytes/1048576).toFixed(1)+"MB",name);
  }catch(error){
    console.warn("FORGE_SNAPSHOT MISS",url,String(error));
  }
}

for(const seed of seeds) add(seed,SOURCE+"/");

let cursor=0;
while(cursor<queue.length && cursor<MAX_FILES){
  const batch=queue.slice(cursor,cursor+CONCURRENCY);
  cursor+=batch.length;
  await Promise.all(batch.map(fetchOne));
}

const pairs=[...entries.values()].map(entry=>({
  url:entry.url,
  path:"/forge-snapshot/"+entry.name
})).sort((a,b)=>b.url.length-a.url.length);

function rewriteText(text){
  let out=text;
  for(const pair of pairs){
    out=out.replaceAll(pair.url,pair.path);
    const u=new URL(pair.url);
    if(u.hostname==="forgeautomotive.co.uk"){
      const root=u.pathname+u.search;
      if(root!=="/") out=out.replaceAll(root,pair.path);
    }
  }

  out=out
    .replaceAll("https:\\/\\/forgeautomotive.co.uk\\/","/forge-snapshot/site/")
    .replace(/(["'\x60(=:\s])\/_next\//g,"$1/forge-snapshot/site/_next/")
    .replace(/(["'\x60(=:\s])\/(videos|images|static|assets)\//g,"$1/forge-snapshot/site/$2/");

  if(/<html/i.test(out)){
    const base='<base href="/forge-snapshot/site/">';
    const guard='<script>window.__ENCHEV_FORGE_SNAPSHOT__=true;</script>';
    out=out.replace(/<head([^>]*)>/i,"<head$1>"+base+guard);
  }
  return out;
}

await fs.rm(OUT,{recursive:true,force:true});

for(const entry of entries.values()){
  const target=path.join(OUT,entry.name);
  await fs.mkdir(path.dirname(target),{recursive:true});
  const isText=/text\/html|javascript|text\/css|application\/(?:json|manifest\+json)/i.test(entry.type) || /\.(?:js|css|json|gltf|webmanifest)$/i.test(new URL(entry.url).pathname);
  if(isText) await fs.writeFile(target,rewriteText(entry.data.toString("utf8")));
  else await fs.writeFile(target,entry.data);
}

const report={
  source:SOURCE,
  generatedAt:new Date().toISOString(),
  files:entries.size,
  bytes:totalBytes,
  paths:[...entries.values()].map(({url,name,type,data})=>({url,name,type,bytes:data.length}))
};
await fs.writeFile(path.join(OUT,"snapshot-report.json"),JSON.stringify(report,null,2));

if(!entries.has(SOURCE+"/")) throw new Error("Forge home snapshot missing");
console.log("FORGE_SNAPSHOT READY files="+entries.size+" bytes="+totalBytes);

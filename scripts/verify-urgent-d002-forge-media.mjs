// D002: Fail-closed build integrity for all 134 restored cinematic assets.
// No network requests or production writes are made by this verifier.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const EXPECTED_ASSET_COUNT=134;
export const REPAIRED_MEDIA_PATH="media/2480ec12b70d13d46feb.jpg";
export const REPAIRED_MEDIA_SHA256="00d7eb76a558c7f82450e25692ee75f90dad9c2b6792766d60027ea77f885b52";
const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
function fail(message){throw new Error("URGENT_D002_FORGE_MEDIA FAIL: "+message)}
export function validateManifest(manifest,{expectedCount=EXPECTED_ASSET_COUNT,requireKnownMedia=true}={}){
 if(!Array.isArray(manifest)||manifest.length!==expectedCount)fail("expected "+expectedCount+" manifest entries, got "+(Array.isArray(manifest)?manifest.length:"invalid"));
 const seen=new Set();
 for(const asset of manifest){
  if(!asset||typeof asset!=="object"||typeof asset.path!=="string"||!asset.path.length)fail("invalid asset path");
  if(!/^[A-Za-z0-9_./-]+$/.test(asset.path)||asset.path.startsWith("/")||asset.path.split("/").some(s=>!s||s==="."||s===".."))fail("unsafe path: "+asset.path);
  if(seen.has(asset.path))fail("duplicate asset path: "+asset.path);
  seen.add(asset.path);
  if(!/^[0-9a-f]{64}$/.test(asset.sha256))fail("missing SHA-256 for "+asset.path);
  try{if(new URL(asset.url).protocol!=="https:")fail("non-HTTPS source: "+asset.path)}catch{fail("invalid source URL: "+asset.path)}
 }
 if(requireKnownMedia&&!manifest.some(x=>x.path===REPAIRED_MEDIA_PATH&&x.sha256===REPAIRED_MEDIA_SHA256))fail("historical missing media SHA-256 must remain pinned");
 return manifest;
}
export async function verifyRestoredAssets(manifest,output,{expectedCount=EXPECTED_ASSET_COUNT,requireKnownMedia=true}={}){
 validateManifest(manifest,{expectedCount,requireKnownMedia});
 let bytes=0;
 for(const asset of manifest){
  let value;
  try{value=await readFile(path.join(output,asset.path))}catch{fail("missing restored file: "+asset.path)}
  if(!value.length)fail("empty restored file: "+asset.path);
  if(sha256(value)!==asset.sha256)fail("asset digest differs: "+asset.path);
  bytes+=value.length;
 }
 return {count:manifest.length,bytes,knownMissingMediaVerified:requireKnownMedia};
}
async function selfTest(){
 const dir=await mkdtemp(path.join(tmpdir(),"enchev-D002-media-"));
 try{
  const good=Buffer.from("verified cinematic asset test");
  const manifest=[{path:"media/test.jpg",url:"https://assets.example.org/picture.jpg",sha256:sha256(good)}];
  const options={expectedCount:1,requireKnownMedia:false};
  validateManifest(manifest,options);
  await mkdir(path.join(dir,"media"),{recursive:true});
  await writeFile(path.join(dir,"media/test.jpg"),good);
  const pass=await verifyRestoredAssets(manifest,dir,options);
  assert.equal(pass.count,1);
  const rejected=async (label,fn)=>{let got=false;try{await fn()}catch{got=true}assert.ok(got,"must reject "+label)};
  await rejected("missing media",async()=>verifyRestoredAssets([{...manifest[0],path:"media/not-there.jpg"}],dir,options));
  await writeFile(path.join(dir,"media/test.jpg"),Buffer.from("tampered"));
  await rejected("digest mismatch",async()=>verifyRestoredAssets(manifest,dir,options));
  await writeFile(path.join(dir,"media/test.jpg"),Buffer.alloc(0));
  await rejected("empty content",async()=>verifyRestoredAssets(manifest,dir,options));
  await rejected("traversal",async()=>validateManifest([{...manifest[0],path:"../secret.jpg"}],options));
  await rejected("absolute path",async()=>validateManifest([{...manifest[0],path:"/secret.jpg"}],options));
  await rejected("duplicate paths",async()=>validateManifest([manifest[0],manifest[0]],{expectedCount:2,requireKnownMedia:false}));
  await rejected("untrusted HTTP source",async()=>validateManifest([{...manifest[0],url:"http://example.org/test.jpg"}],options));
  await rejected("missing SHA",async()=>validateManifest([{...manifest[0],sha256:"broken"}],options));
  await rejected("incorrect count",async()=>validateManifest([],options));
  console.log("URGENT_D002_FORGE_MEDIA_SELF_TEST PASS negative_cases=9 valid_cases=1 offline=true");
 }finally{await rm(dir,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href){
 if(process.argv.includes("--self-test"))await selfTest();
 else if(process.argv.includes("--verify")){
  const root=process.cwd();
  const assets=JSON.parse(await readFile(path.join(root,"config/forge-assets.json"),"utf8"));
  const r=await verifyRestoredAssets(assets,path.join(root,"public/forge"));
  console.log("URGENT_D002_FORGE_MEDIA PASS files="+r.count+" sha256=all_verified bytes="+r.bytes+" repaired_404_asset=true");
 }else{
  const root=process.cwd();
  const assets=JSON.parse(await readFile(path.join(root,"config/forge-assets.json"),"utf8"));
  validateManifest(assets);
  console.log("URGENT_D002_FORGE_MEDIA_MANIFEST PASS files="+assets.length+" immutable_sha256=true repaired_404_asset=pinned");
 }
}

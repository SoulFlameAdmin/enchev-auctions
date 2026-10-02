import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-upload-content-attack-41-14.json";
const MODULE_PATH="packages/domain/src/upload-content-policy.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("UPLOAD_CONTENT_ATTACK_41_14 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function bytes(text){return new TextEncoder().encode(text);}
function expectReject(label,fn,code){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||!actual.includes(code)) fail("negative case not rejected: "+label+" expected="+code+" actual="+actual);
}

async function loadModule(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-upload-41-14-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,MODULE_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--types","node","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"upload-content-policy.js")).href+"?v="+Date.now());
  return {mod,tmp};
}

function jpeg(extra=[]){return Uint8Array.from([0xff,0xd8,0xff,0xe0,0,0,0,0,0,0,0,0,...extra,0xff,0xd9]);}
function png(){
  return Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]);
}
function webp(){
  const out=new Uint8Array(20);
  out.set([0x52,0x49,0x46,0x46],0);
  const n=out.length-8;
  out[4]=n&255; out[5]=(n>>>8)&255; out[6]=(n>>>16)&255; out[7]=(n>>>24)&255;
  out.set([0x57,0x45,0x42,0x50],8);
  return out;
}
function pdf(extra=""){return bytes("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"+extra+"\n%%EOF\n");}
function pad(prefix,total=24){const out=new Uint8Array(Math.max(total,prefix.length));out.set(prefix);return out;}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.14"||config.title!=="Upload-content attack test"||config.kind!=="security") fail("task identity drift");
for(const key of ["contentSignatureAuthoritative","declaredMimeMustMatch","extensionMustMatch","imagesOnlyJpegPngWebp","documentsOnlyPdfJpegPng","svgForbidden","htmlXmlForbidden","executableForbidden","archiveForbidden","activePdfFeaturesForbidden","pathTraversalForbidden","encodedTraversalForbidden","unicodeBidiControlForbidden","controlCharactersForbidden","trailingPayloadForbidden","embeddedArchiveMarkerForbidden","boundedSizeRequired","minimumSizeRequired","failClosed"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionUploadEndpointNotClaimed","objectStorageIamNotClaimed","antivirusProviderNotClaimed","imageDecoderReencodingNotClaimed","contentDisarmReconstructionNotClaimed","secretScanningRemains41_15"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(config.repositoryAssessment?.productionUploadRouteFound!==false||config.repositoryAssessment?.concreteObjectStorageUploadAdapterFound!==false||config.repositoryAssessment?.reusableFailClosedBoundaryImplemented!==true) fail("repository assessment drift");
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==26) fail("abuse scenario coverage drift");
if(!Array.isArray(config.allowedPositiveFixtures)||config.allowedPositiveFixtures.length!==6) fail("positive fixture coverage drift");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Upload-content attack test||security"')) fail("frozen 41.14 identity missing");

const {mod:d,tmp}=await loadModule();
const defaultPolicy=d.defaultUploadContentPolicy();
if(defaultPolicy.minBytes!==config.defaultLimits.minBytes||defaultPolicy.maxFilenameBytes!==config.defaultLimits.maxFilenameBytes||defaultPolicy.maxBytesByPurpose["vehicle-image"]!==config.defaultLimits.vehicleImageMaxBytes||defaultPolicy.maxBytesByPurpose["vehicle-document"]!==config.defaultLimits.vehicleDocumentMaxBytes) fail("default limits drift");

for(const input of [
  {purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:jpeg()},
  {purpose:"vehicle-image",filename:"car.png",declaredMime:"image/png",bytes:png()},
  {purpose:"vehicle-image",filename:"car.webp",declaredMime:"image/webp",bytes:webp()},
  {purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pdf()},
  {purpose:"vehicle-document",filename:"title.jpeg",declaredMime:"image/jpeg",bytes:jpeg()},
  {purpose:"vehicle-document",filename:"title.png",declaredMime:"image/png",bytes:png()},
]){
  const result=d.inspectUploadContent(input);
  if(result.size!==input.bytes.length||!result.detectedMime) fail("positive fixture rejected or drifted: "+input.filename);
}

expectReject("path traversal",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"../car.jpg",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_FILENAME_PATH_TRAVERSAL");
expectReject("encoded traversal",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"..%2fcar.jpg",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_FILENAME_ENCODED_TRAVERSAL");
expectReject("bidi spoof",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"photo\u202Egpj.jpg",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_FILENAME_BIDI_CONTROL");
expectReject("control character",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car\u0000.jpg",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_FILENAME_CONTROL_CHARACTER");
expectReject("filename too long",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"a".repeat(181)+".jpg",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_FILENAME_TOO_LONG");
expectReject("double extension executable",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg.exe",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_EXTENSION_FORBIDDEN");
expectReject("extension mismatch",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.png",declaredMime:"image/jpeg",bytes:jpeg()}),"UPLOAD_EXTENSION_MIME_MISMATCH");
expectReject("declared mime mismatch",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/png",bytes:jpeg()}),"UPLOAD_DECLARED_MIME_MISMATCH");
expectReject("unknown content",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:pad([1,2,3,4])}),"UPLOAD_CONTENT_TYPE_UNKNOWN");
expectReject("svg",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:bytes("<svg><script>alert(1)</script></svg>")}),"UPLOAD_ACTIVE_MARKUP_FORBIDDEN");
expectReject("html",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:bytes("<!doctype html><script>x</script>")}),"UPLOAD_ACTIVE_MARKUP_FORBIDDEN");
expectReject("pe executable",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pad([0x4d,0x5a])}),"UPLOAD_EXECUTABLE_FORBIDDEN");
expectReject("elf executable",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pad([0x7f,0x45,0x4c,0x46])}),"UPLOAD_EXECUTABLE_FORBIDDEN");
expectReject("zip archive",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pad([0x50,0x4b,0x03,0x04])}),"UPLOAD_ARCHIVE_FORBIDDEN");
expectReject("gzip archive",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pad([0x1f,0x8b])}),"UPLOAD_ARCHIVE_FORBIDDEN");

const zipPoly=Uint8Array.from([...jpeg().slice(0,-2),0x50,0x4b,0x03,0x04,1,2,3,4,0xff,0xd9]);
expectReject("jpeg appended zip polyglot",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:zipPoly}),"UPLOAD_EMBEDDED_ARCHIVE_FORBIDDEN");
const trailingJpeg=Uint8Array.from([...jpeg(),1,2,3,4]);
expectReject("jpeg trailing payload",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:trailingJpeg}),"UPLOAD_JPEG_TRAILING_OR_TRUNCATED");
expectReject("png missing iend",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.png",declaredMime:"image/png",bytes:pad([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])}),"UPLOAD_PNG_IEND_INVALID");
const brokenWebp=webp(); brokenWebp[4]=0;
expectReject("webp riff size",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.webp",declaredMime:"image/webp",bytes:brokenWebp}),"UPLOAD_WEBP_RIFF_SIZE_MISMATCH");
const pdfTrailing=bytes("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\nMALICIOUS");
expectReject("pdf trailing payload",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pdfTrailing}),"UPLOAD_PDF_TRAILING_PAYLOAD");
expectReject("pdf javascript",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pdf("/JavaScript (alert)")}),"UPLOAD_PDF_ACTIVE_CONTENT_FORBIDDEN");
expectReject("pdf launch",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.pdf",declaredMime:"application/pdf",bytes:pdf("/Launch /F (cmd)")}),"UPLOAD_PDF_ACTIVE_CONTENT_FORBIDDEN");

const tinyPolicy=d.validateUploadContentPolicy({minBytes:16,maxFilenameBytes:180,maxBytesByPurpose:{"vehicle-image":32,"vehicle-document":32}});
expectReject("oversized",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:Uint8Array.from([...jpeg(),...new Uint8Array(20)])},tinyPolicy),"UPLOAD_TOO_LARGE");
expectReject("undersized",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.jpg",declaredMime:"image/jpeg",bytes:Uint8Array.from([0xff,0xd8,0xff,0xff,0xd9])}),"UPLOAD_TOO_SMALL");
expectReject("webp document purpose",()=>d.inspectUploadContent({purpose:"vehicle-document",filename:"title.webp",declaredMime:"image/webp",bytes:webp()}),"UPLOAD_PURPOSE_MIME_FORBIDDEN");
expectReject("pdf image purpose",()=>d.inspectUploadContent({purpose:"vehicle-image",filename:"car.pdf",declaredMime:"application/pdf",bytes:pdf()}),"UPLOAD_PURPOSE_MIME_FORBIDDEN");

if(process.argv.includes("--self-test")){
  expectReject("invalid filename policy",()=>d.validateUploadContentPolicy({minBytes:16,maxFilenameBytes:10,maxBytesByPurpose:{"vehicle-image":32,"vehicle-document":32}}),"UPLOAD_POLICY_FILENAME_LIMIT_INVALID");
  expectReject("invalid image limit policy",()=>d.validateUploadContentPolicy({minBytes:16,maxFilenameBytes:180,maxBytesByPurpose:{"vehicle-image":8,"vehicle-document":32}}),"UPLOAD_POLICY_IMAGE_LIMIT_INVALID");
  console.log("UPLOAD_CONTENT_ATTACK_41_14_SELF_TEST PASS abuse_scenarios=26 positive_fixtures=6 signature_authoritative=true mime_match=true extension_match=true active_markup_blocked=true executables_blocked=true archives_blocked=true purpose_confusion_blocked=true trailing_payload_blocked=true active_pdf_blocked=true filename_spoofing_blocked=true fail_closed=true production_upload_claim=false antivirus_claim=false negative_policy_cases=2");
}else{
  console.log("UPLOAD_CONTENT_ATTACK_41_14 PASS abuse_scenarios=26 positive_fixtures=6 production_upload_claim=false");
}
setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

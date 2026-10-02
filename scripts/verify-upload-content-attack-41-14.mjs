import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-upload-content-attack-41-14.json";
const MODULE_PATH="packages/providers/src/upload-content-policy.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOCUMENT_DOC="docs/21_10_COUNTRY_SPECIFIC_DOCUMENT_PROFILE.md";
const PROVIDER_BOUNDARY="packages/providers/boundary.json";
const WORKER_BOUNDARY="apps/worker/boundary.json";

function fail(message){throw new Error("UPLOAD_CONTENT_ATTACK_41_14 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}
const ascii=(value)=>new Uint8Array([...value].map(ch=>ch.charCodeAt(0)));
const concat=(...parts)=>{
  const arrays=parts.map(x=>x instanceof Uint8Array?x:new Uint8Array(x));
  const out=new Uint8Array(arrays.reduce((sum,x)=>sum+x.length,0));
  let offset=0; for(const array of arrays){out.set(array,offset);offset+=array.length;} return out;
};
const repeatBytes=(bytes,total)=>{
  const out=new Uint8Array(total);
  for(let i=0;i<total;i++) out[i]=bytes[i%bytes.length];
  return out;
};

async function loadModule(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-upload-41-14-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,MODULE_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--types","node","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("provider TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"upload-content-policy.js")).href+"?v="+Date.now());
  return {mod,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.14"||config.title!=="Upload-content attack test"||config.kind!=="security") fail("task identity drift");
for(const key of ["quarantineOnly","malwareScanRequiredBeforeRelease","serverGeneratedObjectKeysRequired","declaredSizeMustMatchObservedBytes","extensionMimeMagicMustAgree","archiveContentRejected","executableContentRejected","activeWebContentRejected","activePdfFeaturesRejected","imageDecodeReencodeRequiredBeforeRelease","pdfSecurityScanRequiredBeforeRelease","clientCleanClaimForbidden","clientObjectKeyForbidden","directPublicReleaseForbidden"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionUploadRuntimeNotClaimed","productionObjectStorageNotClaimed","productionMalwareScannerNotClaimed","decoderLevelImageSafetyNotClaimed","fullPdfParserSafetyNotClaimed","exifSanitizationNotClaimed","cleanStorageReleaseNotClaimed","secretScanningCertificationRemains41_15"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==34) fail("abuse scenario coverage drift");

const providers=readJson(PROVIDER_BOUNDARY);
const worker=readJson(WORKER_BOUNDARY);
const documentDoc=fs.readFileSync(DOCUMENT_DOC,"utf8");
if(providers.concrete_provider_clients!==false) fail("provider repository assessment drift");
if(worker.implementation_state!=="not-implemented") fail("worker repository assessment drift");
if(!documentDoc.includes("upload UI, storage buckets, malware scanning")) fail("document-profile upload boundary drift");
if(config.repositoryAssessment?.productionUploadRouteFound!==false
  ||config.repositoryAssessment?.productionObjectStorageClientFound!==false
  ||config.repositoryAssessment?.malwareScannerIntegrationFound!==false
  ||config.repositoryAssessment?.countryDocumentProfileExplicitlyExcludesUploadRuntime!==true) fail("repository assessment config drift");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"Upload-content attack test||security"')) fail("frozen 41.14 identity missing");

const {mod:d,tmp}=await loadModule();
const policy=d.validateUploadContentPolicy({
  maxFilenameLength:config.policy.maxFilenameLength,
  maxImageBytes:config.policy.maxImageBytes,
  maxPdfBytes:config.policy.maxPdfBytes,
  quarantineOnly:true,
  malwareScanRequiredBeforeRelease:true,
  serverGeneratedObjectKeysRequired:true,
});

const jpeg=concat(new Uint8Array([0xff,0xd8,0xff,0xe0]),ascii("JFIF-safe-image"),new Uint8Array([0xff,0xd9]));
const png=concat(
  new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  new Uint8Array([0x00,0x00,0x00,0x0d]),ascii("IHDR"),
  new Uint8Array(17),
  new Uint8Array([0x00,0x00,0x00,0x00]),ascii("IEND"),new Uint8Array([0xae,0x42,0x60,0x82])
);
const pdf=ascii("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n");

function assess(filename,mime,bytes,extra={}){
  return d.assessUploadContent({
    originalFilename:filename,
    declaredMime:mime,
    declaredSize:bytes.length,
    bytes,
    ...extra,
  },policy);
}

const qJpeg=assess("vehicle-front.jpg","image/jpeg",jpeg);
if(qJpeg.disposition!=="quarantine"||qJpeg.publishable!==false||qJpeg.malwareScanRequired!==true||qJpeg.sanitizerRequired!=="image-decode-reencode"||qJpeg.storageObjectKeyMode!=="server-generated") fail("valid JPEG quarantine contract drift");
const qPng=assess("damage-map.png","image/png",png);
if(qPng.detectedType!=="png"||qPng.disposition!=="quarantine") fail("valid PNG quarantine contract drift");
const qPdf=assess("title-document.pdf","application/pdf",pdf);
if(qPdf.detectedType!=="pdf"||qPdf.sanitizerRequired!=="document-security-scan"||qPdf.publishable!==false) fail("valid PDF quarantine contract drift");

expectReject("empty upload",()=>d.assessUploadContent({originalFilename:"x.jpg",declaredMime:"image/jpeg",declaredSize:0,bytes:new Uint8Array()},policy),"UPLOAD_DECLARED_SIZE_INVALID");
expectReject("declared size mismatch",()=>d.assessUploadContent({originalFilename:"x.jpg",declaredMime:"image/jpeg",declaredSize:jpeg.length+1,bytes:jpeg},policy),"UPLOAD_DECLARED_SIZE_MISMATCH");

const hugeJpeg=concat(new Uint8Array([0xff,0xd8,0xff]),repeatBytes(new Uint8Array([0x41]),policy.maxImageBytes-3),new Uint8Array([0xff,0xd9]));
expectReject("oversized image",()=>assess("huge.jpg","image/jpeg",hugeJpeg),"UPLOAD_CONTENT_TOO_LARGE");
const hugePdf=concat(ascii("%PDF-1.4\n"),repeatBytes(new Uint8Array([0x41]),policy.maxPdfBytes),ascii("\n%%EOF"));
expectReject("oversized pdf",()=>assess("huge.pdf","application/pdf",hugePdf),"UPLOAD_CONTENT_TOO_LARGE");

expectReject("unix traversal",()=>assess("../vehicle.jpg","image/jpeg",jpeg),"UPLOAD_FILENAME_PATH_FORBIDDEN");
expectReject("windows path",()=>assess("..\\vehicle.jpg","image/jpeg",jpeg),"UPLOAD_FILENAME_PATH_FORBIDDEN");
expectReject("control filename",()=>assess("bad\u0000.jpg","image/jpeg",jpeg),"UPLOAD_FILENAME_CONTROL_CHAR_FORBIDDEN");
expectReject("hidden dot filename",()=>assess(".vehicle.jpg","image/jpeg",jpeg),"UPLOAD_FILENAME_DOT_PATH_FORBIDDEN");
expectReject("dangerous double extension",()=>assess("invoice.exe.jpg","image/jpeg",jpeg),"UPLOAD_DOUBLE_EXTENSION_DANGEROUS");
expectReject("unsupported extension",()=>assess("vehicle.bin","image/jpeg",jpeg),"UPLOAD_EXTENSION_CONTENT_MISMATCH");
expectReject("mime parameter smuggling",()=>assess("vehicle.jpg","image/jpeg; text/html",jpeg),"UPLOAD_MIME_PARAMETER_FORBIDDEN");
expectReject("mime mismatch",()=>assess("vehicle.jpg","image/png",jpeg),"UPLOAD_MIME_CONTENT_MISMATCH");
expectReject("extension mismatch",()=>assess("vehicle.png","image/jpeg",jpeg),"UPLOAD_EXTENSION_CONTENT_MISMATCH");
expectReject("unsupported magic",()=>assess("vehicle.jpg","image/jpeg",ascii("not-an-image")),"UPLOAD_MAGIC_TYPE_UNSUPPORTED");

expectReject("windows executable",()=>assess("vehicle.jpg","image/jpeg",concat(new Uint8Array([0x4d,0x5a]),ascii("payload"))),"UPLOAD_EXECUTABLE_SIGNATURE_FORBIDDEN");
expectReject("elf executable",()=>assess("vehicle.jpg","image/jpeg",new Uint8Array([0x7f,0x45,0x4c,0x46,1,2,3])),"UPLOAD_EXECUTABLE_SIGNATURE_FORBIDDEN");
expectReject("zip archive",()=>assess("vehicle.jpg","image/jpeg",concat(new Uint8Array([0xff,0xd8,0xff]),new Uint8Array([0x50,0x4b,0x03,0x04]),new Uint8Array([0xff,0xd9]))),"UPLOAD_ARCHIVE_SIGNATURE_FORBIDDEN");
expectReject("rar archive",()=>assess("vehicle.jpg","image/jpeg",new Uint8Array([0x52,0x61,0x72,0x21,0x1a,0x07,1])),"UPLOAD_ARCHIVE_SIGNATURE_FORBIDDEN");
expectReject("7z archive",()=>assess("vehicle.jpg","image/jpeg",new Uint8Array([0x37,0x7a,0xbc,0xaf,0x27,0x1c,1])),"UPLOAD_ARCHIVE_SIGNATURE_FORBIDDEN");
expectReject("gzip archive",()=>assess("vehicle.jpg","image/jpeg",new Uint8Array([0x1f,0x8b,0x08,0x00])),"UPLOAD_ARCHIVE_SIGNATURE_FORBIDDEN");

const htmlJpeg=concat(new Uint8Array([0xff,0xd8,0xff]),ascii("<script>alert(1)</script>"),new Uint8Array([0xff,0xd9]));
expectReject("html script polyglot",()=>assess("vehicle.jpg","image/jpeg",htmlJpeg),"UPLOAD_ACTIVE_CONTENT_FORBIDDEN");
const svgJpeg=concat(new Uint8Array([0xff,0xd8,0xff]),ascii("<svg onload=x>"),new Uint8Array([0xff,0xd9]));
expectReject("svg active content",()=>assess("vehicle.jpg","image/jpeg",svgJpeg),"UPLOAD_ACTIVE_CONTENT_FORBIDDEN");

for(const [label,marker] of [
  ["pdf javascript","/JavaScript"],
  ["pdf openaction","/OpenAction"],
  ["pdf launch","/Launch"],
  ["pdf embedded file","/EmbeddedFile"],
]){
  const activePdf=ascii("%PDF-1.4\n1 0 obj\n<< "+marker+" 2 0 R >>\nendobj\n%%EOF");
  expectReject(label,()=>assess("document.pdf","application/pdf",activePdf),"UPLOAD_PDF_ACTIVE_CONTENT_FORBIDDEN");
}

expectReject("truncated jpeg",()=>assess("x.jpg","image/jpeg",new Uint8Array([0xff,0xd8,0xff,0x00])),"UPLOAD_JPEG_STRUCTURE_INVALID");
const invalidPng=concat(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ascii("not-a-real-png-envelope"));
expectReject("invalid png envelope",()=>assess("x.png","image/png",invalidPng),"UPLOAD_PNG_STRUCTURE_INVALID");
expectReject("pdf missing eof",()=>assess("x.pdf","application/pdf",ascii("%PDF-1.4\n1 0 obj\n<<>>\nendobj")),"UPLOAD_PDF_STRUCTURE_INVALID");

expectReject("client clean bypass",()=>assess("vehicle.jpg","image/jpeg",jpeg,{clientClaimedClean:true}),"UPLOAD_CLIENT_CLEAN_CLAIM_FORBIDDEN");
expectReject("client object key injection",()=>assess("vehicle.jpg","image/jpeg",jpeg,{clientObjectKey:"public/vehicle.jpg"}),"UPLOAD_CLIENT_OBJECT_KEY_FORBIDDEN");

if(process.argv.includes("--self-test")){
  expectReject("quarantine disabled",()=>d.validateUploadContentPolicy({...policy,quarantineOnly:false}),"UPLOAD_QUARANTINE_ONLY_REQUIRED");
  expectReject("scanner disabled",()=>d.validateUploadContentPolicy({...policy,malwareScanRequiredBeforeRelease:false}),"UPLOAD_MALWARE_SCAN_REQUIRED");
  expectReject("client keys enabled",()=>d.validateUploadContentPolicy({...policy,serverGeneratedObjectKeysRequired:false}),"UPLOAD_SERVER_OBJECT_KEYS_REQUIRED");
  expectReject("zero image limit",()=>d.validateUploadContentPolicy({...policy,maxImageBytes:0}),"UPLOAD_IMAGE_SIZE_LIMIT_INVALID");
  console.log("UPLOAD_CONTENT_ATTACK_41_14_SELF_TEST PASS scenarios=34 allowed_types=jpeg,png,pdf quarantine_only=true publishable=false size_binding=true mime_extension_magic_binding=true executable_rejected=true archive_rejected=true active_web_content_rejected=true active_pdf_features_rejected=true server_object_keys=true scanner_required=true production_upload_runtime_claim=false production_scanner_claim=false negative_cases=4");
}else{
  console.log("UPLOAD_CONTENT_ATTACK_41_14 PASS scenarios=34 quarantine_only=true");
}
setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);

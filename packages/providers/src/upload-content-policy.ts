export type UploadDetectedType = "jpeg" | "png" | "pdf";

export type UploadContentPolicy = Readonly<{
  maxFilenameLength: number;
  maxImageBytes: number;
  maxPdfBytes: number;
  quarantineOnly: true;
  malwareScanRequiredBeforeRelease: true;
  serverGeneratedObjectKeysRequired: true;
}>;

export type UploadContentInput = Readonly<{
  originalFilename: string;
  declaredMime: string;
  declaredSize: number;
  bytes: Uint8Array;
  clientObjectKey?: string | null;
  clientClaimedClean?: boolean | null;
}>;

export type QuarantinedUpload = Readonly<{
  disposition: "quarantine";
  detectedType: UploadDetectedType;
  normalizedMime: "image/jpeg" | "image/png" | "application/pdf";
  extension: "jpg" | "jpeg" | "png" | "pdf";
  originalFilename: string;
  observedSize: number;
  publishable: false;
  malwareScanRequired: true;
  sanitizerRequired: "image-decode-reencode" | "document-security-scan";
  storageObjectKeyMode: "server-generated";
}>;

const DANGEROUS_EXTENSIONS = new Set([
  "exe","com","bat","cmd","ps1","js","mjs","cjs","html","htm","svg","php","sh",
  "dll","msi","jar","zip","rar","7z","gz","tar","iso","apk","scr","vbs","wsf"
]);

const UNIVERSAL_ACTIVE_MARKERS = [
  "<script",
  "<!doctype",
  "<html",
  "<svg",
  "<?xml",
  "<?php",
  "javascript:",
  "vbscript:",
  "#!/",
] as const;

const PDF_ACTIVE_MARKERS = [
  "/javascript",
  "/js",
  "/openaction",
  "/launch",
  "/embeddedfile",
  "/richmedia",
  "/xfa",
  "/aa",
] as const;

function positiveInt(value:number, code:string):number{
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}

function required(value:string, code:string):string{
  if(typeof value!=="string"||!value.trim()) throw new Error(code);
  return value;
}

function startsWith(bytes:Uint8Array, signature:readonly number[]):boolean{
  if(bytes.length<signature.length) return false;
  return signature.every((value,index)=>bytes[index]===value);
}

function endsWith(bytes:Uint8Array, signature:readonly number[]):boolean{
  if(bytes.length<signature.length) return false;
  const offset=bytes.length-signature.length;
  return signature.every((value,index)=>bytes[offset+index]===value);
}

function containsSequence(bytes:Uint8Array, signature:readonly number[]):boolean{
  if(signature.length===0||bytes.length<signature.length) return false;
  outer: for(let i=0;i<=bytes.length-signature.length;i++){
    for(let j=0;j<signature.length;j++){
      if(bytes[i+j]!==signature[j]) continue outer;
    }
    return true;
  }
  return false;
}

function asciiBytes(value:string):readonly number[]{
  return Object.freeze([...value].map(char=>char.charCodeAt(0)));
}

function lowerAsciiByte(value:number):number{
  return value>=65&&value<=90 ? value+32 : value;
}

function containsAsciiCaseInsensitive(bytes:Uint8Array, needle:string):boolean{
  const target=[...needle].map(char=>char.toLowerCase().charCodeAt(0));
  if(target.length===0||bytes.length<target.length) return false;
  outer: for(let i=0;i<=bytes.length-target.length;i++){
    for(let j=0;j<target.length;j++){
      if(lowerAsciiByte(bytes[i+j])!==target[j]) continue outer;
    }
    return true;
  }
  return false;
}

function endsWithAsciiIgnoringWhitespace(bytes:Uint8Array, marker:string):boolean{
  let end=bytes.length;
  while(end>0&&[9,10,13,32].includes(bytes[end-1])) end--;
  const target=asciiBytes(marker);
  if(end<target.length) return false;
  const offset=end-target.length;
  return target.every((value,index)=>bytes[offset+index]===value);
}

function normalizeFilename(filenameInput:string, policy:UploadContentPolicy):Readonly<{filename:string;extension:string}>{
  const raw=required(filenameInput,"UPLOAD_FILENAME_REQUIRED");
  if(raw!==raw.trim()) throw new Error("UPLOAD_FILENAME_EDGE_WHITESPACE_FORBIDDEN");
  if(raw.length>policy.maxFilenameLength) throw new Error("UPLOAD_FILENAME_TOO_LONG");
  if(/[\x00-\x1f\x7f]/.test(raw)) throw new Error("UPLOAD_FILENAME_CONTROL_CHAR_FORBIDDEN");
  if(raw.includes("/")||raw.includes("\\")) throw new Error("UPLOAD_FILENAME_PATH_FORBIDDEN");
  if(raw.startsWith(".")||raw.endsWith(".")||raw==="."||raw==="..") throw new Error("UPLOAD_FILENAME_DOT_PATH_FORBIDDEN");
  if(!/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(raw)) throw new Error("UPLOAD_FILENAME_CHARSET_FORBIDDEN");
  const parts=raw.split(".");
  if(parts.length<2||!parts.at(-1)) throw new Error("UPLOAD_EXTENSION_REQUIRED");
  const extension=parts.at(-1)!.toLowerCase();
  for(const part of parts.slice(1,-1)){
    if(DANGEROUS_EXTENSIONS.has(part.toLowerCase())) throw new Error("UPLOAD_DOUBLE_EXTENSION_DANGEROUS");
  }
  return Object.freeze({filename:raw,extension});
}

function assertNoExecutableOrArchive(bytes:Uint8Array):void{
  if(startsWith(bytes,[0x4d,0x5a])) throw new Error("UPLOAD_EXECUTABLE_SIGNATURE_FORBIDDEN");
  if(startsWith(bytes,[0x7f,0x45,0x4c,0x46])) throw new Error("UPLOAD_EXECUTABLE_SIGNATURE_FORBIDDEN");
  if(containsSequence(bytes,[0x50,0x4b,0x03,0x04])
    || startsWith(bytes,[0x50,0x4b,0x05,0x06])
    || startsWith(bytes,[0x52,0x61,0x72,0x21,0x1a,0x07])
    || startsWith(bytes,[0x37,0x7a,0xbc,0xaf,0x27,0x1c])
    || startsWith(bytes,[0x1f,0x8b])){
    throw new Error("UPLOAD_ARCHIVE_SIGNATURE_FORBIDDEN");
  }
}

function assertNoActiveContent(bytes:Uint8Array, type:UploadDetectedType):void{
  for(const marker of UNIVERSAL_ACTIVE_MARKERS){
    if(containsAsciiCaseInsensitive(bytes,marker)) throw new Error("UPLOAD_ACTIVE_CONTENT_FORBIDDEN");
  }
  if(type==="pdf"){
    for(const marker of PDF_ACTIVE_MARKERS){
      if(containsAsciiCaseInsensitive(bytes,marker)) throw new Error("UPLOAD_PDF_ACTIVE_CONTENT_FORBIDDEN");
    }
  }
}

function detectType(bytes:Uint8Array):UploadDetectedType{
  if(startsWith(bytes,[0xff,0xd8,0xff])) return "jpeg";
  if(startsWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return "png";
  if(startsWith(bytes,asciiBytes("%PDF-"))) return "pdf";
  throw new Error("UPLOAD_MAGIC_TYPE_UNSUPPORTED");
}

function assertStructure(bytes:Uint8Array,type:UploadDetectedType):void{
  if(type==="jpeg"){
    if(bytes.length<5||!endsWith(bytes,[0xff,0xd9])) throw new Error("UPLOAD_JPEG_STRUCTURE_INVALID");
    return;
  }
  if(type==="png"){
    if(bytes.length<45
      || bytes[12]!==0x49||bytes[13]!==0x48||bytes[14]!==0x44||bytes[15]!==0x52
      || !endsWith(bytes,[0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82])){
      throw new Error("UPLOAD_PNG_STRUCTURE_INVALID");
    }
    return;
  }
  if(!endsWithAsciiIgnoringWhitespace(bytes,"%%EOF")) throw new Error("UPLOAD_PDF_STRUCTURE_INVALID");
}

export function validateUploadContentPolicy(policy:UploadContentPolicy):UploadContentPolicy{
  if(policy.quarantineOnly!==true) throw new Error("UPLOAD_QUARANTINE_ONLY_REQUIRED");
  if(policy.malwareScanRequiredBeforeRelease!==true) throw new Error("UPLOAD_MALWARE_SCAN_REQUIRED");
  if(policy.serverGeneratedObjectKeysRequired!==true) throw new Error("UPLOAD_SERVER_OBJECT_KEYS_REQUIRED");
  return Object.freeze({
    maxFilenameLength:positiveInt(policy.maxFilenameLength,"UPLOAD_FILENAME_LIMIT_INVALID"),
    maxImageBytes:positiveInt(policy.maxImageBytes,"UPLOAD_IMAGE_SIZE_LIMIT_INVALID"),
    maxPdfBytes:positiveInt(policy.maxPdfBytes,"UPLOAD_PDF_SIZE_LIMIT_INVALID"),
    quarantineOnly:true,
    malwareScanRequiredBeforeRelease:true,
    serverGeneratedObjectKeysRequired:true,
  });
}

export function assessUploadContent(
  input:UploadContentInput,
  policyInput:UploadContentPolicy,
):QuarantinedUpload{
  const policy=validateUploadContentPolicy(policyInput);
  if(input.clientObjectKey!==undefined&&input.clientObjectKey!==null) throw new Error("UPLOAD_CLIENT_OBJECT_KEY_FORBIDDEN");
  if(input.clientClaimedClean!==undefined&&input.clientClaimedClean!==null) throw new Error("UPLOAD_CLIENT_CLEAN_CLAIM_FORBIDDEN");
  if(!(input.bytes instanceof Uint8Array)) throw new Error("UPLOAD_BYTES_REQUIRED");

  const declaredSize=positiveInt(input.declaredSize,"UPLOAD_DECLARED_SIZE_INVALID");
  if(declaredSize!==input.bytes.length) throw new Error("UPLOAD_DECLARED_SIZE_MISMATCH");
  const {filename,extension}=normalizeFilename(input.originalFilename,policy);
  const mime=required(input.declaredMime,"UPLOAD_MIME_REQUIRED").trim().toLowerCase();
  if(mime.includes(";")) throw new Error("UPLOAD_MIME_PARAMETER_FORBIDDEN");

  assertNoExecutableOrArchive(input.bytes);
  const type=detectType(input.bytes);
  assertStructure(input.bytes,type);
  assertNoActiveContent(input.bytes,type);

  let normalizedMime:QuarantinedUpload["normalizedMime"];
  let allowedExtensions:readonly string[];
  let maxBytes:number;
  let sanitizerRequired:QuarantinedUpload["sanitizerRequired"];

  if(type==="jpeg"){
    normalizedMime="image/jpeg";
    allowedExtensions=["jpg","jpeg"];
    maxBytes=policy.maxImageBytes;
    sanitizerRequired="image-decode-reencode";
  }else if(type==="png"){
    normalizedMime="image/png";
    allowedExtensions=["png"];
    maxBytes=policy.maxImageBytes;
    sanitizerRequired="image-decode-reencode";
  }else{
    normalizedMime="application/pdf";
    allowedExtensions=["pdf"];
    maxBytes=policy.maxPdfBytes;
    sanitizerRequired="document-security-scan";
  }

  if(!allowedExtensions.includes(extension)) throw new Error("UPLOAD_EXTENSION_CONTENT_MISMATCH");
  if(mime!==normalizedMime) throw new Error("UPLOAD_MIME_CONTENT_MISMATCH");
  if(input.bytes.length>maxBytes) throw new Error("UPLOAD_CONTENT_TOO_LARGE");

  return Object.freeze({
    disposition:"quarantine",
    detectedType:type,
    normalizedMime,
    extension:extension as QuarantinedUpload["extension"],
    originalFilename:filename,
    observedSize:input.bytes.length,
    publishable:false,
    malwareScanRequired:true,
    sanitizerRequired,
    storageObjectKeyMode:"server-generated",
  });
}

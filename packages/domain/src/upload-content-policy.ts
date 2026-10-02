export type UploadPurpose = "vehicle-image" | "vehicle-document";

export type UploadContentPolicy = Readonly<{
  minBytes: number;
  maxFilenameBytes: number;
  maxBytesByPurpose: Readonly<Record<UploadPurpose, number>>;
}>;

export type UploadInspectionInput = Readonly<{
  purpose: UploadPurpose;
  filename: string;
  declaredMime: string;
  bytes: Uint8Array;
}>;

export type UploadInspectionResult = Readonly<{
  purpose: UploadPurpose;
  filename: string;
  extension: string;
  detectedMime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  size: number;
  serveAsAttachment: boolean;
}>;

const DEFAULT_POLICY: UploadContentPolicy = Object.freeze({
  minBytes: 16,
  maxFilenameBytes: 180,
  maxBytesByPurpose: Object.freeze({
    "vehicle-image": 12 * 1024 * 1024,
    "vehicle-document": 20 * 1024 * 1024,
  }),
});

const MIME_EXTENSIONS: Readonly<Record<UploadInspectionResult["detectedMime"], readonly string[]>> = Object.freeze({
  "image/jpeg": Object.freeze(["jpg", "jpeg"]),
  "image/png": Object.freeze(["png"]),
  "image/webp": Object.freeze(["webp"]),
  "application/pdf": Object.freeze(["pdf"]),
});

const ALLOWED_BY_PURPOSE: Readonly<Record<UploadPurpose, readonly UploadInspectionResult["detectedMime"][]>> = Object.freeze({
  "vehicle-image": Object.freeze(["image/jpeg", "image/png", "image/webp"]),
  "vehicle-document": Object.freeze(["application/pdf", "image/jpeg", "image/png"]),
});

const DENIED_EXTENSIONS = new Set([
  "exe","dll","com","scr","msi","bat","cmd","ps1","sh","js","mjs","cjs","html","htm","svg","xml",
  "php","py","pl","rb","jar","apk","zip","rar","7z","gz","tgz","tar","iso","dmg",
]);

const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/u;
const CONTROL_CHAR = /[\u0000-\u001F\u007F]/u;

function reject(code: string): never {
  throw new Error(code);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function indexOfSignature(bytes: Uint8Array, signature: readonly number[], start = 0): number {
  outer: for (let i = Math.max(0, start); i <= bytes.length - signature.length; i += 1) {
    for (let j = 0; j < signature.length; j += 1) {
      if (bytes[i + j] !== signature[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function asciiWindow(bytes: Uint8Array, max = 65536): string {
  return new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, max))).toLowerCase();
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) reject("UPLOAD_EXTENSION_REQUIRED");
  return filename.slice(dot + 1).toLowerCase();
}

function validateFilename(filename: string, policy: UploadContentPolicy): string {
  if (!filename || filename !== filename.trim()) reject("UPLOAD_FILENAME_INVALID");
  if (new TextEncoder().encode(filename).length > policy.maxFilenameBytes) reject("UPLOAD_FILENAME_TOO_LONG");
  if (CONTROL_CHAR.test(filename)) reject("UPLOAD_FILENAME_CONTROL_CHARACTER");
  if (BIDI_CONTROL.test(filename)) reject("UPLOAD_FILENAME_BIDI_CONTROL");
  if (filename.includes("/") || filename.includes("\\")) reject("UPLOAD_FILENAME_PATH_TRAVERSAL");
  const lower = filename.toLowerCase();
  if (lower.includes("%2f") || lower.includes("%5c") || lower.includes("%00")) reject("UPLOAD_FILENAME_ENCODED_TRAVERSAL");
  if (filename === "." || filename === ".." || filename.endsWith(".") || filename.endsWith(" ")) reject("UPLOAD_FILENAME_INVALID");
  const extension = extensionOf(filename);
  if (DENIED_EXTENSIONS.has(extension)) reject("UPLOAD_EXTENSION_FORBIDDEN");
  return extension;
}

function isHtmlXmlOrSvg(bytes: Uint8Array): boolean {
  const text = asciiWindow(bytes, 8192).replace(/^\uFEFF/, "").trimStart();
  return text.startsWith("<!doctype html") || text.startsWith("<html") || text.startsWith("<script") ||
    text.startsWith("<svg") || text.startsWith("<?xml") || text.includes("<script") || text.includes("<svg");
}

function isExecutable(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x4d,0x5a]) ||
    startsWith(bytes, [0x7f,0x45,0x4c,0x46]) ||
    startsWith(bytes, [0xcf,0xfa,0xed,0xfe]) ||
    startsWith(bytes, [0xfe,0xed,0xfa,0xcf]) ||
    startsWith(bytes, [0xca,0xfe,0xba,0xbe]);
}

function isArchive(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x50,0x4b,0x03,0x04]) ||
    startsWith(bytes, [0x1f,0x8b]) ||
    startsWith(bytes, [0x52,0x61,0x72,0x21,0x1a,0x07]) ||
    startsWith(bytes, [0x37,0x7a,0xbc,0xaf,0x27,0x1c]);
}

function detectAllowedMime(bytes: Uint8Array): UploadInspectionResult["detectedMime"] {
  if (startsWith(bytes, [0xff,0xd8,0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return "image/png";
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (startsWith(bytes, [0x25,0x50,0x44,0x46,0x2d])) return "application/pdf";
  reject("UPLOAD_CONTENT_TYPE_UNKNOWN");
}

function assertNoTrailingOrPolyglotPayload(bytes: Uint8Array, mime: UploadInspectionResult["detectedMime"]): void {
  if (indexOfSignature(bytes,[0x50,0x4b,0x03,0x04],1) >= 0 ||
      indexOfSignature(bytes,[0x37,0x7a,0xbc,0xaf,0x27,0x1c],1) >= 0 ||
      indexOfSignature(bytes,[0x52,0x61,0x72,0x21,0x1a,0x07],1) >= 0) {
    reject("UPLOAD_EMBEDDED_ARCHIVE_FORBIDDEN");
  }

  if (mime === "image/jpeg") {
    if (bytes.length < 2 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      reject("UPLOAD_JPEG_TRAILING_OR_TRUNCATED");
    }
  }

  if (mime === "image/png") {
    const iend = [0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82] as const;
    if (bytes.length < iend.length || indexOfSignature(bytes,iend,bytes.length-iend.length) !== bytes.length-iend.length) {
      reject("UPLOAD_PNG_IEND_INVALID");
    }
  }

  if (mime === "image/webp") {
    if (bytes.length < 12) reject("UPLOAD_WEBP_RIFF_INVALID");
    const declared = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    if ((declared >>> 0) !== bytes.length - 8) reject("UPLOAD_WEBP_RIFF_SIZE_MISMATCH");
  }

  if (mime === "application/pdf") {
    const text = asciiWindow(bytes);
    for (const marker of ["/javascript","/js","/launch","/embeddedfile","/openaction","/aa"]) {
      if (text.includes(marker)) reject("UPLOAD_PDF_ACTIVE_CONTENT_FORBIDDEN");
    }
    const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0,bytes.length-2048)));
    const eof = tail.lastIndexOf("%%EOF");
    if (eof < 0) reject("UPLOAD_PDF_EOF_MISSING");
    if (tail.slice(eof + 5).trim() !== "") reject("UPLOAD_PDF_TRAILING_PAYLOAD");
  }
}

export function validateUploadContentPolicy(input: UploadContentPolicy = DEFAULT_POLICY): UploadContentPolicy {
  const imageMax = input.maxBytesByPurpose?.["vehicle-image"];
  const docMax = input.maxBytesByPurpose?.["vehicle-document"];
  if (!Number.isInteger(input.minBytes) || input.minBytes < 1) reject("UPLOAD_POLICY_MIN_BYTES_INVALID");
  if (!Number.isInteger(input.maxFilenameBytes) || input.maxFilenameBytes < 32 || input.maxFilenameBytes > 512) reject("UPLOAD_POLICY_FILENAME_LIMIT_INVALID");
  if (!Number.isInteger(imageMax) || imageMax < input.minBytes) reject("UPLOAD_POLICY_IMAGE_LIMIT_INVALID");
  if (!Number.isInteger(docMax) || docMax < input.minBytes) reject("UPLOAD_POLICY_DOCUMENT_LIMIT_INVALID");
  return Object.freeze({
    minBytes: input.minBytes,
    maxFilenameBytes: input.maxFilenameBytes,
    maxBytesByPurpose: Object.freeze({"vehicle-image": imageMax, "vehicle-document": docMax}),
  });
}

export function defaultUploadContentPolicy(): UploadContentPolicy {
  return DEFAULT_POLICY;
}

export function inspectUploadContent(
  input: UploadInspectionInput,
  policyInput: UploadContentPolicy = DEFAULT_POLICY,
): UploadInspectionResult {
  const policy = validateUploadContentPolicy(policyInput);
  if (!(input.bytes instanceof Uint8Array)) reject("UPLOAD_BYTES_REQUIRED");
  if (input.bytes.byteLength < policy.minBytes) reject("UPLOAD_TOO_SMALL");
  const maxBytes = policy.maxBytesByPurpose[input.purpose];
  if (!maxBytes) reject("UPLOAD_PURPOSE_INVALID");
  if (input.bytes.byteLength > maxBytes) reject("UPLOAD_TOO_LARGE");

  const extension = validateFilename(input.filename, policy);
  if (isExecutable(input.bytes)) reject("UPLOAD_EXECUTABLE_FORBIDDEN");
  if (isArchive(input.bytes)) reject("UPLOAD_ARCHIVE_FORBIDDEN");
  if (isHtmlXmlOrSvg(input.bytes)) reject("UPLOAD_ACTIVE_MARKUP_FORBIDDEN");

  const detectedMime = detectAllowedMime(input.bytes);
  if (!ALLOWED_BY_PURPOSE[input.purpose].includes(detectedMime)) reject("UPLOAD_PURPOSE_MIME_FORBIDDEN");

  const declaredMime = input.declaredMime.trim().toLowerCase();
  if (!declaredMime || declaredMime.includes(";")) reject("UPLOAD_DECLARED_MIME_INVALID");
  if (declaredMime !== detectedMime) reject("UPLOAD_DECLARED_MIME_MISMATCH");
  if (!MIME_EXTENSIONS[detectedMime].includes(extension)) reject("UPLOAD_EXTENSION_MIME_MISMATCH");

  assertNoTrailingOrPolyglotPayload(input.bytes, detectedMime);

  return Object.freeze({
    purpose: input.purpose,
    filename: input.filename,
    extension,
    detectedMime,
    size: input.bytes.byteLength,
    serveAsAttachment: input.purpose === "vehicle-document",
  });
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/unicode-normalization.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_15_UNICODE_NORMALIZATION.md";

function fail(message) {
  throw new Error(`UNICODE_NORMALIZATION FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./unicode-normalization";')) {
    fail("packages/config public entrypoint must export unicode-normalization");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) {
      fail(`runtime/secret token forbidden in Unicode normalization source: ${token}`);
    }
  }

  for (const token of [
    "UNICODE_NORMALIZATION_MODEL_VERSION = 1",
    'UNICODE_NORMALIZATION_FORM = "NFC"',
    "export function normalizeUnicodeText",
    "export function isUnicodeTextNormalized",
    "hasUnpairedSurrogate"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (source.includes('"NFKC"') || source.includes('"NFKD"')) {
    fail("compatibility normalization must not be used by the canonical text contract");
  }

  for (const token of [
    "normalization form: **NFC**",
    "does **not** use compatibility normalization",
    "must not:",
    "not a spoofing/confusable detector",
    "21.20 Cross-script search tests",
    "does not require Vercel create/update/redeploy"
  ]) {
    if (!docSource.includes(token)) {
      fail(`documentation boundary missing: ${token}`);
    }
  }
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-unicode-normalization-"));
  try {
    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [
      tscPath,
      SOURCE_PATH,
      "--ignoreConfig",
      "--target", "ES2022",
      "--module", "ES2022",
      "--moduleResolution", "Bundler",
      "--skipLibCheck",
      "--outDir", tempDir,
      "--pretty", "false"
    ], { encoding: "utf8" });

    if (result.status !== 0) {
      fail(`TypeScript compile failed: ${(result.stderr || result.stdout || "").trim()}`);
    }

    const compiled = path.join(tempDir, "unicode-normalization.js");
    if (!fs.existsSync(compiled)) {
      fail("compiled Unicode normalization runtime module was not produced");
    }

    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function expectInvalid(normalize, label, input) {
  const result = normalize(input);
  if (result.ok) fail(`invalid fixture was accepted: ${label}`);
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
if (runtime.UNICODE_NORMALIZATION_MODEL_VERSION !== 1) {
  fail("runtime model version drift");
}
if (runtime.UNICODE_NORMALIZATION_FORM !== "NFC") {
  fail("runtime normalization form drift");
}
if (typeof runtime.normalizeUnicodeText !== "function") {
  fail("normalizeUnicodeText runtime export missing");
}
if (typeof runtime.isUnicodeTextNormalized !== "function") {
  fail("isUnicodeTextNormalized runtime export missing");
}

const normalize = runtime.normalizeUnicodeText;
const isNormalized = runtime.isUnicodeTextNormalized;

const decomposed = "Cafe\u0301";
const precomposed = "Caf\u00e9";
const a = normalize(decomposed);
const b = normalize(precomposed);

if (!a.ok || !b.ok) fail("canonical-equivalence fixtures were rejected");
if (a.value !== b.value || a.value !== precomposed) {
  fail("canonically equivalent text did not normalize identically");
}
if (a.changed !== true || b.changed !== false) {
  fail("changed flag drift for decomposed/precomposed text");
}

const secondPass = normalize(a.value);
if (!secondPass.ok || secondPass.value !== a.value || secondPass.changed !== false) {
  fail("normalization is not idempotent");
}

const emoji = "vehicle \ud83d\ude97";
const emojiResult = normalize(emoji);
if (!emojiResult.ok || emojiResult.value !== emoji) {
  fail("valid supplementary-plane character was not preserved");
}

const mixedScript = "A\u0410";
const mixedResult = normalize(mixedScript);
if (!mixedResult.ok || mixedResult.value !== mixedScript) {
  fail("mixed-script text must be preserved by normalization");
}

const fullWidth = "\uff21";
const fullWidthResult = normalize(fullWidth);
if (!fullWidthResult.ok || fullWidthResult.value !== fullWidth) {
  fail("NFC contract performed compatibility folding");
}

const preservation = "  MiXeD-Text!  ";
const preservationResult = normalize(preservation);
if (!preservationResult.ok || preservationResult.value !== preservation) {
  fail("case/whitespace/punctuation preservation drift");
}

const combining = "A\u030a";
const combiningResult = normalize(combining);
if (!combiningResult.ok || combiningResult.value !== "\u00c5") {
  fail("canonical composition fixture drift");
}

if (!isNormalized(precomposed)) fail("precomposed NFC text should be reported normalized");
if (isNormalized(decomposed)) fail("decomposed non-NFC text should not be reported normalized");
if (isNormalized(null)) fail("non-string input must not be reported normalized");

expectInvalid(normalize, "non-string", 42);
expectInvalid(normalize, "null", null);
expectInvalid(normalize, "lone high surrogate", "\ud800");
expectInvalid(normalize, "lone low surrogate", "\udc00");
expectInvalid(normalize, "high surrogate followed by ASCII", "\ud800A");
expectInvalid(normalize, "ASCII followed by low surrogate", "A\udc00");

if (process.argv.includes("--self-test")) {
  let rejectedLeak = false;
  try {
    verifySourceContract(
      source + "\nconst leaked = process.env.SECRET;\n",
      indexSource,
      docSource
    );
  } catch {
    rejectedLeak = true;
  }
  if (!rejectedLeak) fail("source contract did not reject runtime env access");

  let rejectedCompatibilityForm = false;
  try {
    verifySourceContract(
      source.replace('"NFC"', '"NFKC"'),
      indexSource,
      docSource
    );
  } catch {
    rejectedCompatibilityForm = true;
  }
  if (!rejectedCompatibilityForm) {
    fail("source contract did not reject compatibility normalization");
  }

  let rejectedMissingExport = false;
  try {
    verifySourceContract(
      source,
      indexSource.replace('export * from "./unicode-normalization";', ""),
      docSource
    );
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("UNICODE_NORMALIZATION_SELF_TEST PASS runtime_negative_cases=6 source_negative_cases=3 form=NFC canonical_equivalence=true idempotent=true malformed_surrogate_rejection=true compatibility_folding=false");
} else {
  console.log("UNICODE_NORMALIZATION PASS task=21.15 model_version=1 form=NFC canonical_equivalence=true idempotent=true supplementary_plane_preserved=true compatibility_folding=false");
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/international-contact-models.ts";
const UNICODE_PATH = "packages/config/src/unicode-normalization.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_18_INTERNATIONAL_CONTACT_MODELS.md";

function fail(message) {
  throw new Error(`INTERNATIONAL_CONTACT_MODELS FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./international-contact-models";')) {
    fail("packages/config public entrypoint must export international-contact-models");
  }

  for (const token of ["process.env", "Deno.env", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_OIDC_TOKEN"]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden: ${token}`);
  }

  for (const token of [
    "INTERNATIONAL_CONTACT_MODELS_VERSION = 1",
    "export type InternationalName",
    "export type InternationalAddress",
    "export type InternationalPhone",
    "export function validateInternationalName",
    "export function validateInternationalAddress",
    "export function validateInternationalPhone",
    "normalizeUnicodeText",
    "E164_PATTERN"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/\b(givenName|familyName|firstName|lastName)\b/.test(source)) {
    fail("generic name model must not require Western name-part fields");
  }

  for (const token of [
    "does not require a postal code",
    "does not infer a country",
    "21.15 NFC Unicode normalization",
    "does not require Vercel create/update/redeploy",
    "21.19",
    "21.20"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

function node16CompatibleSource(source) {
  return source.replaceAll('"./unicode-normalization"', '"./unicode-normalization.js"');
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-international-contact-"));
  try {
    const sourceDir = path.join(tempDir, "src");
    const outDir = path.join(tempDir, "out");
    fs.mkdirSync(sourceDir, { recursive: true });

    fs.writeFileSync(path.join(sourceDir, "unicode-normalization.ts"), fs.readFileSync(UNICODE_PATH, "utf8"), "utf8");
    fs.writeFileSync(
      path.join(sourceDir, "international-contact-models.ts"),
      node16CompatibleSource(fs.readFileSync(SOURCE_PATH, "utf8")),
      "utf8"
    );

    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [
      tscPath,
      path.join(sourceDir, "international-contact-models.ts"),
      "--ignoreConfig",
      "--target", "ES2022",
      "--module", "Node16",
      "--moduleResolution", "Node16",
      "--skipLibCheck",
      "--outDir", outDir,
      "--pretty", "false"
    ], { encoding: "utf8" });

    if (result.status !== 0) {
      fail(`TypeScript compile failed: ${(result.stderr || result.stdout || "").trim()}`);
    }

    const compiled = path.join(outDir, "international-contact-models.js");
    if (!fs.existsSync(compiled)) fail("compiled runtime module missing");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");
verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
if (runtime.INTERNATIONAL_CONTACT_MODELS_VERSION !== 1) fail("runtime model version drift");

const name = runtime.validateInternationalName({
  displayName: "山田 太郎",
  nativeScriptName: "山田 太郎",
  sortName: "やまだ たろう"
});
if (!name.ok || name.value.displayName !== "山田 太郎") fail("international name fixture rejected");

const normalizedName = runtime.validateInternationalName({ displayName: "Jose\u0301" });
if (!normalizedName.ok || normalizedName.value.displayName !== "José") fail("name NFC normalization failed");

const address = runtime.validateInternationalAddress({
  countryCode: "ZZ",
  addressLines: ["区 1", "建物 2"],
  locality: "都市",
  organization: "組織"
});
if (!address.ok || address.value.addressLines.length !== 2 || "postalCode" in address.value) {
  fail("international address fixture rejected or postal code became mandatory");
}

const phone = runtime.validateInternationalPhone({
  rawInput: "+359 88 123 4567",
  e164: "+359881234567",
  extension: "42"
});
if (!phone.ok || phone.value.e164 !== "+359881234567") fail("international phone fixture rejected");

const invalidFixtures = [
  ["blank name", () => runtime.validateInternationalName({ displayName: "   " })],
  ["western field injection", () => runtime.validateInternationalName({ displayName: "X", firstName: "X" })],
  ["missing address lines", () => runtime.validateInternationalAddress({ countryCode: "ZZ", addressLines: [] })],
  ["lowercase country", () => runtime.validateInternationalAddress({ countryCode: "zz", addressLines: ["A"] })],
  ["bad e164", () => runtime.validateInternationalPhone({ rawInput: "x", e164: "0035988" })],
  ["bad extension", () => runtime.validateInternationalPhone({ rawInput: "x", extension: "ext42" })],
  ["malformed unicode", () => runtime.validateInternationalName({ displayName: "\uD800" })],
  ["phone extra field", () => runtime.validateInternationalPhone({ rawInput: "x", carrier: "x" })]
];

for (const [label, run] of invalidFixtures) {
  if (run().ok) fail(`invalid fixture accepted: ${label}`);
}

if (process.argv.includes("--self-test")) {
  let rejected = false;
  try {
    verifySourceContract(source + "\nconst leaked = process.env.SECRET;\n", indexSource, docSource);
  } catch {
    rejected = true;
  }
  if (!rejected) fail("source guard did not reject env access");

  rejected = false;
  try {
    verifySourceContract(
      source,
      indexSource.replace('export * from "./international-contact-models";', ""),
      docSource
    );
  } catch {
    rejected = true;
  }
  if (!rejected) fail("source guard did not reject missing public export");

  rejected = false;
  try {
    verifySourceContract(source + "\ntype firstName = string;\n", indexSource, docSource);
  } catch {
    rejected = true;
  }
  if (!rejected) fail("source guard did not reject Western name-part coupling");

  console.log("INTERNATIONAL_CONTACT_MODELS_SELF_TEST PASS runtime_negative_cases=8 source_negative_cases=3 unicode_nfc=true western_name_parts_required=false postal_code_required=false e164_optional=true");
} else {
  console.log("INTERNATIONAL_CONTACT_MODELS PASS task=21.18 model_version=1 unicode_nfc=true western_name_parts_required=false postal_code_required=false e164_optional=true");
}

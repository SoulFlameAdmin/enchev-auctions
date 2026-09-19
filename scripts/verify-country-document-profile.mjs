import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/country-document-profile.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_10_COUNTRY_SPECIFIC_DOCUMENT_PROFILE.md";

function fail(message) {
  throw new Error(`COUNTRY_DOCUMENT_PROFILE FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./country-document-profile";')) {
    fail("packages/config public entrypoint must export country-document-profile");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in document profile source: ${token}`);
  }

  for (const token of [
    "COUNTRY_DOCUMENT_PROFILE_MODEL_VERSION = 1",
    "export type CountryDocumentRequirement",
    "export type CountryDocumentProfile",
    "export function validateCountryDocumentProfile",
    "countryCode must match CountryProfile.countryCode",
    "documents must not contain duplicate subject/key pairs",
    "documents must be sorted by subject and key"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/\b(?:BG|US|DE|FR|GB)\b|bg-BG|en-US|Europe\/Sofia|Bulgaria|България/.test(source)) {
    fail("document profile source must not contain concrete country/locale rules");
  }

  for (const token of [
    "no concrete country document records",
    "21.08 Country-specific KYC profile",
    "21.09 Country-specific legal profile",
    "21.11 Market activation gate",
    "upload UI, storage buckets",
    "subject:key"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

function findCompiledModule(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findCompiledModule(full);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === "country-document-profile.js") {
      return full;
    }
  }
  return null;
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-country-document-profile-"));
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

    const compiled = findCompiledModule(tempDir);
    if (!compiled) fail("compiled country document profile runtime module was not produced");

    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function expectInvalid(validate, label, fixture, countryProfile) {
  const result = validate(fixture, countryProfile);
  if (result.ok) fail(`invalid fixture was accepted: ${label}`);
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
if (runtime.COUNTRY_DOCUMENT_PROFILE_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.validateCountryDocumentProfile !== "function") fail("runtime validator export missing");

const countryProfile = {
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["zz"],
  timeZone: "Etc/UTC"
};

const validFixture = {
  countryCode: "ZZ",
  revision: 1,
  documents: [
    { key: "identity.primary", subject: "buyer", required: true },
    { key: "ownership.primary", subject: "vehicle", required: false }
  ]
};

const valid = runtime.validateCountryDocumentProfile(validFixture, countryProfile);
if (!valid.ok) fail(`valid country-neutral fixture rejected: ${valid.errors.join(", ")}`);
if (valid.value.countryCode !== "ZZ") fail("validated document profile country binding drift");
if (valid.value.documents.length !== 2) fail("validated document requirements length drift");
if (valid.value.documents[0].subject !== "buyer") fail("validated document subject drift");

expectInvalid(runtime.validateCountryDocumentProfile, "non-object", null, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "lowercase country code", {
  ...validFixture,
  countryCode: "zz"
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "country mismatch", {
  ...validFixture,
  countryCode: "AA"
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "revision zero", {
  ...validFixture,
  revision: 0
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "empty documents", {
  ...validFixture,
  documents: []
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "duplicate subject/key", {
  ...validFixture,
  documents: [
    { key: "identity.primary", subject: "buyer", required: true },
    { key: "identity.primary", subject: "buyer", required: false }
  ]
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "unsorted documents", {
  ...validFixture,
  documents: [
    { key: "ownership.primary", subject: "vehicle", required: false },
    { key: "identity.primary", subject: "buyer", required: true }
  ]
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "invalid document key", {
  ...validFixture,
  documents: [{ key: "Identity Primary", subject: "buyer", required: true }]
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "invalid subject", {
  ...validFixture,
  documents: [{ key: "identity.primary", subject: "Buyer Person", required: true }]
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "non-boolean required", {
  ...validFixture,
  documents: [{ key: "identity.primary", subject: "buyer", required: "yes" }]
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "extra profile field", {
  ...validFixture,
  storageBucket: "example"
}, countryProfile);
expectInvalid(runtime.validateCountryDocumentProfile, "extra document field", {
  ...validFixture,
  documents: [{ key: "identity.primary", subject: "buyer", required: true, mimeType: "application/pdf" }]
}, countryProfile);

if (process.argv.includes("--self-test")) {
  let rejectedLeak = false;
  try {
    verifySourceContract(source + "\nconst leaked = process.env.SECRET;\n", indexSource, docSource);
  } catch {
    rejectedLeak = true;
  }
  if (!rejectedLeak) fail("source contract did not reject runtime env access");

  let rejectedCountryLiteral = false;
  try {
    verifySourceContract(source + '\nconst x = { countryCode: "BG" };\n', indexSource, docSource);
  } catch {
    rejectedCountryLiteral = true;
  }
  if (!rejectedCountryLiteral) fail("source contract did not reject concrete country rule");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./country-document-profile";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("COUNTRY_DOCUMENT_PROFILE_SELF_TEST PASS runtime_negative_cases=12 source_negative_cases=3 country_binding=true subject_key_identity=true");
} else {
  console.log("COUNTRY_DOCUMENT_PROFILE PASS task=21.10 model_version=1 country_binding=true subject_key_identity=true deterministic_documents=true");
}

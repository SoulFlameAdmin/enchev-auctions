import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/country-kyc-profile.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_08_COUNTRY_SPECIFIC_KYC_PROFILE.md";

function fail(message) {
  throw new Error(`COUNTRY_KYC_PROFILE FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./country-kyc-profile";')) {
    fail("packages/config public entrypoint must export country-kyc-profile");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in KYC profile source: ${token}`);
  }

  for (const token of [
    "COUNTRY_KYC_PROFILE_MODEL_VERSION = 1",
    "export type CountryKycRequirement",
    "export type CountryKycProfile",
    "export function validateCountryKycProfile",
    "countryCode must match CountryProfile.countryCode",
    "requirements must not contain duplicate keys",
    "requirements must be sorted by key"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/\b(?:BG|US|DE|FR|GB)\b|bg-BG|en-US|Europe\/Sofia|Bulgaria|България/.test(source)) {
    fail("KYC profile source must not contain concrete country/locale rules");
  }

  for (const token of [
    "no concrete country KYC records",
    "21.09 Country-specific legal profile",
    "21.10 Country-specific document profile",
    "21.11 Market activation gate",
    "provider-neutral"
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
    } else if (entry.isFile() && entry.name === "country-kyc-profile.js") {
      return full;
    }
  }
  return null;
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-country-kyc-profile-"));
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
    if (!compiled) fail("compiled country KYC profile runtime module was not produced");

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
if (runtime.COUNTRY_KYC_PROFILE_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.validateCountryKycProfile !== "function") fail("runtime validator export missing");

const countryProfile = {
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["zz"],
  timeZone: "Etc/UTC"
};

const validFixture = {
  countryCode: "ZZ",
  revision: 1,
  requirements: [
    { key: "identity.primary", required: true },
    { key: "risk.review", required: false }
  ]
};

const valid = runtime.validateCountryKycProfile(validFixture, countryProfile);
if (!valid.ok) fail(`valid country-neutral fixture rejected: ${valid.errors.join(", ")}`);
if (valid.value.countryCode !== "ZZ") fail("validated profile country binding drift");
if (valid.value.requirements.length !== 2) fail("validated requirements length drift");
if (valid.value.requirements[0].key !== "identity.primary") fail("validated requirement ordering drift");

expectInvalid(runtime.validateCountryKycProfile, "non-object", null, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "lowercase country code", {
  ...validFixture,
  countryCode: "zz"
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "country mismatch", {
  ...validFixture,
  countryCode: "AA"
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "revision zero", {
  ...validFixture,
  revision: 0
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "empty requirements", {
  ...validFixture,
  requirements: []
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "duplicate requirements", {
  ...validFixture,
  requirements: [
    { key: "identity.primary", required: true },
    { key: "identity.primary", required: false }
  ]
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "unsorted requirements", {
  ...validFixture,
  requirements: [
    { key: "risk.review", required: false },
    { key: "identity.primary", required: true }
  ]
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "invalid requirement key", {
  ...validFixture,
  requirements: [{ key: "Identity Primary", required: true }]
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "non-boolean required", {
  ...validFixture,
  requirements: [{ key: "identity.primary", required: "yes" }]
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "extra profile field", {
  ...validFixture,
  provider: "example"
}, countryProfile);
expectInvalid(runtime.validateCountryKycProfile, "extra requirement field", {
  ...validFixture,
  requirements: [{ key: "identity.primary", required: true, document: "passport" }]
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
    verifySourceContract(source, indexSource.replace('export * from "./country-kyc-profile";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("COUNTRY_KYC_PROFILE_SELF_TEST PASS runtime_negative_cases=11 source_negative_cases=3 country_binding=true provider_neutral=true");
} else {
  console.log("COUNTRY_KYC_PROFILE PASS task=21.08 model_version=1 country_binding=true deterministic_requirements=true provider_neutral=true");
}

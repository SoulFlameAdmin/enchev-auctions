import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/country-market-bundle.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_12_COUNTRY_2_WITHOUT_CORE_REWRITE.md";

function fail(message) {
  throw new Error(`COUNTRY_2_NO_CORE_REWRITE FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./country-market-bundle";')) {
    fail("packages/config public entrypoint must export country-market-bundle");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in country bundle source: ${token}`);
  }

  for (const token of [
    "COUNTRY_MARKET_BUNDLE_MODEL_VERSION = 1",
    "export type CountryMarketBundle",
    "export function validateCountryMarketBundle",
    "validateCountryProfile",
    "validateCountryKycProfile",
    "validateCountryLegalProfile",
    "validateCountryDocumentProfile"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/\b(?:XA|XB|BG|US|DE|FR|GB)\b|bg-BG|en-US|Europe\/Sofia|Bulgaria|България/.test(source)) {
    fail("country bundle source must not contain concrete country/locale fixtures");
  }

  for (const token of [
    "same compiled runtime function",
    "synthetic country bundles",
    "not production country records",
    "No-core-rewrite law",
    "21.11 Market activation gate"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

function node16CompatibleSource(source) {
  return source
    .replaceAll('"./country-profile"', '"./country-profile.js"')
    .replaceAll('"./country-kyc-profile"', '"./country-kyc-profile.js"')
    .replaceAll('"./country-legal-profile"', '"./country-legal-profile.js"')
    .replaceAll('"./country-document-profile"', '"./country-document-profile.js"');
}

function findCompiledModule(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findCompiledModule(full);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === "country-market-bundle.js") {
      return full;
    }
  }
  return null;
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-country-2-"));
  try {
    const sourceDir = path.join(tempDir, "src");
    const outDir = path.join(tempDir, "out");
    fs.mkdirSync(sourceDir, { recursive: true });

    for (const sourcePath of [
      "packages/config/src/country-profile.ts",
      "packages/config/src/country-kyc-profile.ts",
      "packages/config/src/country-legal-profile.ts",
      "packages/config/src/country-document-profile.ts",
      SOURCE_PATH
    ]) {
      fs.writeFileSync(
        path.join(sourceDir, path.basename(sourcePath)),
        node16CompatibleSource(fs.readFileSync(sourcePath, "utf8")),
        "utf8"
      );
    }

    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [
      tscPath,
      path.join(sourceDir, "country-market-bundle.ts"),
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

    const compiled = findCompiledModule(outDir);
    if (!compiled) fail("compiled country-market-bundle runtime module was not produced");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function makeBundle(countryCode, locale, timeZone, suffix) {
  return {
    countryProfile: {
      countryCode,
      defaultLocale: locale,
      supportedLocales: [locale],
      timeZone
    },
    kycProfile: {
      countryCode,
      revision: 1,
      requirements: [{ key: `identity.${suffix}`, required: true }]
    },
    legalProfile: {
      countryCode,
      revision: 1,
      requirements: [{
        key: `notice.${suffix}`,
        required: true,
        authorityRef: `authority.${suffix}-1`
      }]
    },
    documentProfile: {
      countryCode,
      revision: 1,
      documents: [{
        key: `document.${suffix}`,
        subject: "participant",
        required: true
      }]
    }
  };
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");
verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
const validate = runtime.validateCountryMarketBundle ?? runtime.default?.validateCountryMarketBundle;
const version = runtime.COUNTRY_MARKET_BUNDLE_MODEL_VERSION ?? runtime.default?.COUNTRY_MARKET_BUNDLE_MODEL_VERSION;

if (version !== 1) fail("runtime model version drift");
if (typeof validate !== "function") fail("runtime bundle validator export missing");

const countryOne = makeBundle("XA", "xa", "UTC", "alpha");
const countryTwo = makeBundle("XB", "xb", "Etc/UTC", "beta");

const first = validate(countryOne);
if (!first.ok) fail(`Country #1 synthetic bundle rejected: ${first.errors.join(", ")}`);

const second = validate(countryTwo);
if (!second.ok) fail(`Country #2 synthetic bundle rejected: ${second.errors.join(", ")}`);

if (first.value.countryProfile.countryCode === second.value.countryProfile.countryCode) {
  fail("two-country proof did not use distinct country codes");
}
if (first.value.countryProfile.defaultLocale === second.value.countryProfile.defaultLocale) {
  fail("two-country proof did not vary locale configuration");
}
if (first.value.countryProfile.timeZone === second.value.countryProfile.timeZone) {
  fail("two-country proof did not vary timezone configuration");
}

const mixedSecond = {
  ...countryTwo,
  legalProfile: { ...countryOne.legalProfile }
};
const mixedResult = validate(mixedSecond);
if (mixedResult.ok) fail("cross-country profile mix was accepted");

const invalidCases = [
  ["non-object bundle", null],
  ["extra bundle field", { ...countryOne, forceCountry: true }],
  ["invalid country profile", {
    ...countryOne,
    countryProfile: { ...countryOne.countryProfile, countryCode: "x1" }
  }],
  ["empty KYC requirements", {
    ...countryOne,
    kycProfile: { ...countryOne.kycProfile, requirements: [] }
  }],
  ["empty legal requirements", {
    ...countryOne,
    legalProfile: { ...countryOne.legalProfile, requirements: [] }
  }],
  ["empty documents", {
    ...countryOne,
    documentProfile: { ...countryOne.documentProfile, documents: [] }
  }],
  ["cross-country KYC", {
    ...countryTwo,
    kycProfile: { ...countryOne.kycProfile }
  }],
  ["cross-country document", {
    ...countryTwo,
    documentProfile: { ...countryOne.documentProfile }
  }]
];

for (const [label, fixture] of invalidCases) {
  const result = validate(fixture);
  if (result.ok) fail(`invalid fixture was accepted: ${label}`);
}

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
    verifySourceContract(source + '\nconst secondCountry = { countryCode: "XB" };\n', indexSource, docSource);
  } catch {
    rejectedCountryLiteral = true;
  }
  if (!rejectedCountryLiteral) fail("source contract did not reject concrete Country #2 fixture");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./country-market-bundle";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("COUNTRY_2_NO_CORE_REWRITE_SELF_TEST PASS runtime_negative_cases=9 source_negative_cases=3 two_country_same_runtime=true cross_country_rejected=true core_country_literals=0");
} else {
  console.log("COUNTRY_2_NO_CORE_REWRITE PASS task=21.12 country1=XA country2=XB same_runtime=true data_only=true real_market_activated=false");
}

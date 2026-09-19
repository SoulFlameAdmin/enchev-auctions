import fs from "node:fs";
import ts from "typescript";

const SOURCE_PATH = "packages/config/src/country-profile.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_01_COUNTRY_PROFILE_CONFIGURATION_MODEL.md";

function fail(message) {
  throw new Error(`COUNTRY_PROFILE_MODEL FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./country-profile";')) {
    fail("packages/config public entrypoint must export country-profile");
  }

  for (const token of ["process.env", "Deno.env", "SUPABASE_SERVICE_ROLE_KEY", "REDIS_URL", "VERCEL_OIDC_TOKEN"]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in CountryProfile source: ${token}`);
  }

  if (!source.includes("COUNTRY_PROFILE_MODEL_VERSION = 1")) fail("model version marker missing");
  if (!source.includes("export type CountryProfile")) fail("CountryProfile type missing");
  if (!source.includes("export function validateCountryProfile")) fail("CountryProfile validator missing");
  if (!source.includes("defaultLocale must be present in supportedLocales")) fail("default-locale membership invariant missing");
  if (!source.includes("supportedLocales must not contain duplicates")) fail("duplicate-locale invariant missing");

  if (!docSource.includes("no concrete country records")) fail("documentation must preserve country-neutral scope");
  if (!docSource.includes("KYC/legal/document profiles")) fail("documentation must preserve downstream profile ownership");
  if (!docSource.includes("market activation logic")) fail("documentation must preserve downstream market-gate ownership");
}

async function loadRuntime(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    },
    reportDiagnostics: true
  });

  const diagnostics = result.diagnostics || [];
  const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    fail("TypeScript transpilation produced diagnostics");
  }

  const encoded = Buffer.from(result.outputText, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function expectInvalid(validateCountryProfile, label, fixture) {
  const result = validateCountryProfile(fixture);
  if (result.ok) fail(`invalid fixture was accepted: ${label}`);
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime(source);
if (runtime.COUNTRY_PROFILE_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.validateCountryProfile !== "function") fail("runtime validator export missing");

const valid = runtime.validateCountryProfile({
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["zz", "zz-Latn"],
  timeZone: "Etc/UTC"
});

if (!valid.ok) fail(`valid country-neutral fixture rejected: ${valid.errors.join(", ")}`);
if (valid.value.countryCode !== "ZZ") fail("validated profile countryCode drift");
if (valid.value.supportedLocales.length !== 2) fail("validated profile locale list drift");

expectInvalid(runtime.validateCountryProfile, "non-object", null);
expectInvalid(runtime.validateCountryProfile, "lowercase country code", {
  countryCode: "zz",
  defaultLocale: "zz",
  supportedLocales: ["zz"],
  timeZone: "UTC"
});
expectInvalid(runtime.validateCountryProfile, "default locale absent", {
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["aa"],
  timeZone: "UTC"
});
expectInvalid(runtime.validateCountryProfile, "duplicate locales", {
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["zz", "zz"],
  timeZone: "UTC"
});
expectInvalid(runtime.validateCountryProfile, "invalid locale", {
  countryCode: "ZZ",
  defaultLocale: "not a locale",
  supportedLocales: ["not a locale"],
  timeZone: "UTC"
});
expectInvalid(runtime.validateCountryProfile, "invalid timezone", {
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["zz"],
  timeZone: "UTC+3"
});

if (process.argv.includes("--self-test")) {
  let rejectedLeak = false;
  try {
    verifySourceContract(source + "\nconst leaked = process.env.SECRET;\n", indexSource, docSource);
  } catch {
    rejectedLeak = true;
  }
  if (!rejectedLeak) fail("source contract did not reject runtime env access");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./country-profile";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("COUNTRY_PROFILE_MODEL_SELF_TEST PASS runtime_negative_cases=6 source_negative_cases=2");
} else {
  console.log("COUNTRY_PROFILE_MODEL PASS task=21.01 model_version=1 country_neutral=true runtime_validation=true");
}

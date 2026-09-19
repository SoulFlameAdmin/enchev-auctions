import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/locale-fallback-chain.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_16_LOCALE_FALLBACK_CHAIN.md";

function fail(message) {
  throw new Error(`LOCALE_FALLBACK_CHAIN FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./locale-fallback-chain";')) {
    fail("packages/config public entrypoint must export locale-fallback-chain");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) {
      fail(`runtime/secret token forbidden in locale fallback source: ${token}`);
    }
  }

  for (const token of [
    "LOCALE_FALLBACK_CHAIN_MODEL_VERSION = 1",
    "export function resolveLocaleFallbackChain",
    "Intl.getCanonicalLocales",
    "new Intl.Locale",
    "supportedLocales must remain unique after locale canonicalization",
    "defaultLocale must canonicalize to a supported locale"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/["'`]en(?:-[A-Za-z0-9]+)*["'`]|["'`]bg(?:-[A-Za-z0-9]+)*["'`]/.test(source)) {
    fail("locale fallback source must not hardcode English/Bulgarian fallback locales");
  }

  for (const token of [
    "No hardcoded global fallback",
    "CountryProfile.defaultLocale",
    "21.15 Unicode normalization",
    "21.19",
    "21.20",
    "does not require Vercel create/update/redeploy"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

function node16CompatibleSource(source) {
  return source.replaceAll('"./country-profile"', '"./country-profile.js"');
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-locale-fallback-"));
  try {
    const sourceDir = path.join(tempDir, "src");
    const outDir = path.join(tempDir, "out");
    fs.mkdirSync(sourceDir, { recursive: true });

    for (const sourcePath of [
      "packages/config/src/country-profile.ts",
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
      path.join(sourceDir, "locale-fallback-chain.ts"),
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

    const compiled = path.join(outDir, "locale-fallback-chain.js");
    if (!fs.existsSync(compiled)) {
      fail("compiled locale fallback runtime module was not produced");
    }

    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function expectOk(resolve, label, profile, requested, expected) {
  const result = resolve(profile, requested);
  if (!result.ok) fail(`${label} rejected: ${result.errors.join(", ")}`);
  if (JSON.stringify(result.chain) !== JSON.stringify(expected)) {
    fail(`${label} chain drift: ${JSON.stringify(result.chain)}`);
  }
  if (result.resolvedLocale !== expected[0]) {
    fail(`${label} resolvedLocale drift`);
  }
  return result;
}

function expectInvalid(resolve, label, profile, requested) {
  const result = resolve(profile, requested);
  if (result.ok) fail(`invalid fixture was accepted: ${label}`);
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");
verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
if (runtime.LOCALE_FALLBACK_CHAIN_MODEL_VERSION !== 1) {
  fail("runtime model version drift");
}
if (typeof runtime.resolveLocaleFallbackChain !== "function") {
  fail("runtime resolver export missing");
}

const resolve = runtime.resolveLocaleFallbackChain;
const profile = {
  countryCode: "ZZ",
  defaultLocale: "en-US",
  supportedLocales: ["en-US", "en-GB", "fr-FR"],
  timeZone: "UTC"
};

const exact = expectOk(resolve, "exact locale", profile, "en-gb", ["en-GB", "en-US"]);
if (exact.requestedLocale !== "en-GB") fail("requested locale was not canonicalized");

expectOk(resolve, "same-language regional fallback", profile, "en-AU", ["en-GB", "en-US"]);
expectOk(resolve, "different-language fallback", profile, "de-DE", ["en-US"]);
expectOk(resolve, "exact default", profile, "en-us", ["en-US"]);
expectOk(resolve, "missing requested locale", profile, undefined, ["en-US"]);
expectOk(resolve, "null requested locale", profile, null, ["en-US"]);
expectOk(resolve, "supported non-default language", profile, "fr-ca", ["fr-FR", "en-US"]);

const baseProfile = {
  countryCode: "ZZ",
  defaultLocale: "fr-FR",
  supportedLocales: ["fr-FR", "en", "en-GB"],
  timeZone: "UTC"
};
expectOk(resolve, "language-only supported locale", baseProfile, "en-AU", ["en", "en-GB", "fr-FR"]);

expectInvalid(resolve, "non-string requested locale", profile, 42);
expectInvalid(resolve, "empty requested locale", profile, "");
expectInvalid(resolve, "invalid requested locale", profile, "not_a_locale");
expectInvalid(resolve, "invalid profile", { ...profile, supportedLocales: [] }, "en-US");
expectInvalid(resolve, "canonical duplicate supported locales", {
  ...profile,
  defaultLocale: "en-US",
  supportedLocales: ["en-US", "en-us"]
}, "en-US");

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

  let rejectedHardcodedFallback = false;
  try {
    verifySourceContract(
      source + '\nconst globalFallback = "en-US";\n',
      indexSource,
      docSource
    );
  } catch {
    rejectedHardcodedFallback = true;
  }
  if (!rejectedHardcodedFallback) fail("source contract did not reject hardcoded global locale fallback");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(
      source,
      indexSource.replace('export * from "./locale-fallback-chain";', ""),
      docSource
    );
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("LOCALE_FALLBACK_CHAIN_SELF_TEST PASS runtime_negative_cases=5 source_negative_cases=3 exact=true language_fallback=true profile_default_final=true hardcoded_global_fallback=false");
} else {
  console.log("LOCALE_FALLBACK_CHAIN PASS task=21.16 model_version=1 exact=true language_fallback=true profile_default_final=true hardcoded_global_fallback=false");
}

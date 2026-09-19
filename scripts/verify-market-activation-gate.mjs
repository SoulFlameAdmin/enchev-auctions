import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/market-activation-gate.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_11_MARKET_ACTIVATION_GATE.md";

function fail(message) {
  throw new Error(`MARKET_ACTIVATION_GATE FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./market-activation-gate";')) {
    fail("packages/config public entrypoint must export market-activation-gate");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in activation gate source: ${token}`);
  }

  for (const token of [
    "MARKET_ACTIVATION_GATE_MODEL_VERSION = 1",
    "export type MarketActivationApproval",
    "export type MarketActivationGateResult",
    "export function evaluateMarketActivationGate",
    "validateCountryKycProfile",
    "validateCountryLegalProfile",
    "validateCountryDocumentProfile",
    "KYC approval is required",
    "legal approval is required",
    "document approval is required"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/\b(?:BG|US|DE|FR|GB)\b|bg-BG|en-US|Europe\/Sofia|Bulgaria|България/.test(source)) {
    fail("activation gate source must not contain concrete country/locale rules");
  }

  for (const token of [
    "Profile existence is not market activation",
    "no active country record",
    "fails closed",
    "21.12 Country #2 without core rewrite",
    "does not fabricate legal/compliance/customer-data approval"
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
    } else if (entry.isFile() && entry.name === "market-activation-gate.js") {
      return full;
    }
  }
  return null;
}

function node16CompatibleSource(source) {
  return source
    .replaceAll('"./country-profile"', '"./country-profile.js"')
    .replaceAll('"./country-kyc-profile"', '"./country-kyc-profile.js"')
    .replaceAll('"./country-legal-profile"', '"./country-legal-profile.js"')
    .replaceAll('"./country-document-profile"', '"./country-document-profile.js"');
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-market-activation-gate-"));
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
      const sourceText = fs.readFileSync(sourcePath, "utf8");
      fs.writeFileSync(
        path.join(sourceDir, path.basename(sourcePath)),
        node16CompatibleSource(sourceText),
        "utf8"
      );
    }

    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const tempSourcePath = path.join(sourceDir, "market-activation-gate.ts");
    const result = spawnSync(process.execPath, [
      tscPath,
      tempSourcePath,
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
    if (!compiled) fail("compiled market activation gate runtime module was not produced");

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
const evaluate = runtime.evaluateMarketActivationGate ?? runtime.default?.evaluateMarketActivationGate;
const version = runtime.MARKET_ACTIVATION_GATE_MODEL_VERSION ?? runtime.default?.MARKET_ACTIVATION_GATE_MODEL_VERSION;

if (version !== 1) fail("runtime model version drift");
if (typeof evaluate !== "function") fail("runtime gate export missing");

const countryProfile = {
  countryCode: "ZZ",
  defaultLocale: "zz",
  supportedLocales: ["zz"],
  timeZone: "Etc/UTC"
};
const kycProfile = {
  countryCode: "ZZ",
  revision: 1,
  requirements: [{ key: "identity.primary", required: true }]
};
const legalProfile = {
  countryCode: "ZZ",
  revision: 1,
  requirements: [{ key: "consumer.notice", required: true, authorityRef: "authority.reference-1" }]
};
const documentProfile = {
  countryCode: "ZZ",
  revision: 1,
  documents: [{ key: "identity.primary", subject: "buyer", required: true }]
};
const approved = {
  countryCode: "ZZ",
  kycApproved: true,
  legalApproved: true,
  documentsApproved: true
};

const active = evaluate(approved, countryProfile, kycProfile, legalProfile, documentProfile);
if (!active.active) fail(`fully approved valid market was blocked: ${active.blockers.join(", ")}`);
if (active.countryCode !== "ZZ") fail("active country code drift");
if (active.blockers.length !== 0) fail("active result must not contain blockers");

function expectBlocked(label, approval, kyc = kycProfile, legal = legalProfile, document = documentProfile) {
  const result = evaluate(approval, countryProfile, kyc, legal, document);
  if (result.active) fail(`blocked fixture activated market: ${label}`);
  if (!Array.isArray(result.blockers) || result.blockers.length === 0) {
    fail(`blocked fixture did not report blockers: ${label}`);
  }
}

expectBlocked("non-object approval", null);
expectBlocked("country mismatch", { ...approved, countryCode: "AA" });
expectBlocked("KYC not approved", { ...approved, kycApproved: false });
expectBlocked("legal not approved", { ...approved, legalApproved: false });
expectBlocked("documents not approved", { ...approved, documentsApproved: false });
expectBlocked("profiles exist but all approvals false", {
  ...approved,
  kycApproved: false,
  legalApproved: false,
  documentsApproved: false
});
expectBlocked("invalid KYC profile", approved, { ...kycProfile, requirements: [] });
expectBlocked("invalid legal profile", approved, kycProfile, { ...legalProfile, requirements: [] });
expectBlocked("invalid document profile", approved, kycProfile, legalProfile, { ...documentProfile, documents: [] });
expectBlocked("cross-country KYC profile", approved, { ...kycProfile, countryCode: "AA" });
expectBlocked("extra approval field", { ...approved, forceActive: true });
expectBlocked("invalid approval country code", { ...approved, countryCode: "zz" });
expectBlocked("missing legal approval field", {
  countryCode: "ZZ",
  kycApproved: true,
  documentsApproved: true
});

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
    verifySourceContract(source + '\nconst activeCountry = "BG";\n', indexSource, docSource);
  } catch {
    rejectedCountryLiteral = true;
  }
  if (!rejectedCountryLiteral) fail("source contract did not reject concrete country rule");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./market-activation-gate";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("MARKET_ACTIVATION_GATE_SELF_TEST PASS runtime_negative_cases=13 source_negative_cases=3 fail_closed=true dependency_validation=true explicit_approvals=3");
} else {
  console.log("MARKET_ACTIVATION_GATE PASS task=21.11 model_version=1 fail_closed=true dependency_validation=true explicit_approvals=3 no_real_market_activated=true");
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/cross-script-search.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const INVENTORY_PATH = "app/inventory/page.tsx";
const DOC_PATH = "docs/21_20_CROSS_SCRIPT_SEARCH_TESTS.md";

function fail(message) {
  throw new Error(`CROSS_SCRIPT_SEARCH FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, inventorySource, docSource) {
  if (!indexSource.includes('export * from "./cross-script-search";')) {
    fail("packages/config public entrypoint must export cross-script-search");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in cross-script search source: ${token}`);
  }

  for (const token of [
    "CROSS_SCRIPT_SEARCH_MODEL_VERSION = 1",
    "BULGARIAN_TO_LATIN",
    "foldCrossScriptSearchText",
    "normalizeAsciiSearchIdentifier",
    "matchesCrossScriptSearch"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  for (const token of [
    'import { matchesCrossScriptSearch } from "../../packages/config/src/cross-script-search";',
    "matchesCrossScriptSearch(query,{",
    "text:[car.title,car.brand,car.model,car.location,car.damage,car.titleStatus]",
    "identifiers:[car.vin,car.lot]"
  ]) {
    if (!inventorySource.includes(token)) fail(`inventory integration missing token: ${token}`);
  }

  for (const token of [
    "derived, non-authoritative search projection",
    "VIN and LOT values are not passed through cross-script transliteration",
    "Cyrillic/mixed-script identifier confusables are rejected",
    "not linguistic translation",
    "does not require Vercel create/update/redeploy"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-cross-script-search-"));
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

    const compiled = path.join(tempDir, "cross-script-search.js");
    if (!fs.existsSync(compiled)) fail("compiled cross-script search runtime module was not produced");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const inventorySource = fs.readFileSync(INVENTORY_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

verifySourceContract(source, indexSource, inventorySource, docSource);

const runtime = await loadRuntime();
if (runtime.CROSS_SCRIPT_SEARCH_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.foldCrossScriptSearchText !== "function") fail("foldCrossScriptSearchText runtime export missing");
if (typeof runtime.normalizeAsciiSearchIdentifier !== "function") fail("normalizeAsciiSearchIdentifier runtime export missing");
if (typeof runtime.matchesCrossScriptSearch !== "function") fail("matchesCrossScriptSearch runtime export missing");

const fold = runtime.foldCrossScriptSearchText;
const normalizeIdentifier = runtime.normalizeAsciiSearchIdentifier;
const matches = runtime.matchesCrossScriptSearch;

if (fold("АУДИ") !== "audi") fail("Bulgarian Cyrillic Audi transliteration drift");
if (fold("A\u0301UDI") !== "audi") fail("derived Latin combining-mark folding drift");
if (fold("  Ауди   RS3  ") !== "audi rs3") fail("derived whitespace folding drift");
if (normalizeIdentifier(" ea-10482 ") !== "EA-10482") fail("ASCII identifier normalization drift");
if (normalizeIdentifier("ЕА-10482") !== null) fail("Cyrillic identifier confusable must be rejected");

const document = {
  text: ["2022 Audi RS3 Sportback", "София, България", "Florida, USA", "Minor scratches", "Clean"],
  identifiers: ["EA-10482", "WBS3R9C50JAK10482"]
};

const positiveCases = [
  ["Cyrillic to Latin make/model", "Ауди RS3"],
  ["Latin case fold", "aUdI"],
  ["Latin transliteration to Cyrillic location", "sofiya"],
  ["Cyrillic to Latin location", "Флорида"],
  ["full LOT identifier", "EA-10482"],
  ["partial LOT identifier", "10482"],
  ["partial VIN identifier", "WBS3R9"]
];

for (const [label, query] of positiveCases) {
  if (!matches(query, document)) fail(`positive fixture failed: ${label}`);
}

const negativeCases = [
  ["Cyrillic LOT confusable", "ЕА-10482"],
  ["mixed-script VIN confusable", "WВS3R9"],
  ["unknown vehicle text", "Lamborghini Huracan"]
];

for (const [label, query] of negativeCases) {
  if (matches(query, document)) fail(`negative fixture unexpectedly matched: ${label}`);
}

if (!matches("", document) || !matches("   ", document)) fail("blank query must preserve unfiltered behavior");

if (process.argv.includes("--self-test")) {
  let rejectedLeak = false;
  try {
    verifySourceContract(source + "\nconst leaked = process.env.SECRET;\n", indexSource, inventorySource, docSource);
  } catch {
    rejectedLeak = true;
  }
  if (!rejectedLeak) fail("source contract did not reject runtime env access");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./cross-script-search";', ""), inventorySource, docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  let rejectedIdentifierMix = false;
  try {
    verifySourceContract(
      source,
      indexSource,
      inventorySource.replace("identifiers:[car.vin,car.lot]", "text:[car.vin,car.lot]"),
      docSource
    );
  } catch {
    rejectedIdentifierMix = true;
  }
  if (!rejectedIdentifierMix) fail("source contract did not reject missing identifier boundary");

  console.log(`CROSS_SCRIPT_SEARCH_SELF_TEST PASS positive_cases=${positiveCases.length} negative_cases=${negativeCases.length} source_negative_cases=3 model_version=1 identifier_confusable_rejection=true`);
} else {
  console.log(`CROSS_SCRIPT_SEARCH PASS task=21.20 positive_cases=${positiveCases.length} negative_cases=${negativeCases.length} bg_cyrillic_latin=true ascii_identifier_boundary=true canonical_data_mutated=false`);
}

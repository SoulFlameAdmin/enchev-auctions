import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/regional-cdn-strategy.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_13_REGIONAL_CDN_STRATEGY.md";
const LIVE_ROUTE_PATH = "app/api/live-auction-clock/route.ts";
const HEALTH_SHARED_PATH = "app/api/health/_shared.ts";
const REDIS_HEALTH_PATH = "app/api/health/redis/route.ts";

function fail(message) {
  throw new Error(`REGIONAL_CDN_STRATEGY FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./regional-cdn-strategy";')) {
    fail("packages/config public entrypoint must export regional-cdn-strategy");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden in CDN strategy source: ${token}`);
  }

  for (const token of [
    "REGIONAL_CDN_STRATEGY_MODEL_VERSION = 1",
    "deliveryScope: \"global-edge\"",
    "originSelection: \"provider-managed\"",
    "explicitCacheOptIn: true",
    "dataResidencyClaim: false",
    "\"static-immutable\"",
    "\"public-revalidate\"",
    "\"realtime-no-store\"",
    "\"health-no-store\"",
    "export function buildRegionalCdnHeaders"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/\b(?:BG|US|DE|FR|GB)\b|Europe\/Sofia|Bulgaria|България/.test(source)) {
    fail("CDN strategy source must not contain concrete country rules");
  }

  for (const token of [
    "not a data-residency guarantee",
    "21.14 Regional data/residency review",
    "does not require a manual Vercel deployment",
    "realtime auction/session routes remain `no-store`",
    "health routes remain `no-store`"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

function verifyLiveNoStore() {
  const liveSource = fs.readFileSync(LIVE_ROUTE_PATH, "utf8");
  if (!liveSource.includes('"Cache-Control": "no-store, max-age=0"')) {
    fail("live auction clock must remain explicitly no-store");
  }

  const healthSource = fs.readFileSync(HEALTH_SHARED_PATH, "utf8");
  if (!healthSource.includes('"cache-control": "no-store, max-age=0"')) {
    fail("shared health response must remain explicitly no-store");
  }

  const redisSource = fs.readFileSync(REDIS_HEALTH_PATH, "utf8");
  if (!redisSource.includes('"cache-control": "no-store, max-age=0"')) {
    fail("Redis health response must remain explicitly no-store");
  }
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-regional-cdn-"));
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

    const compiled = path.join(tempDir, "regional-cdn-strategy.js");
    if (!fs.existsSync(compiled)) fail("compiled regional CDN runtime module was not produced");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

verifySourceContract(source, indexSource, docSource);
verifyLiveNoStore();

const runtime = await loadRuntime();
if (runtime.REGIONAL_CDN_STRATEGY_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.buildRegionalCdnHeaders !== "function") fail("runtime header builder missing");

const staticHeaders = runtime.buildRegionalCdnHeaders("static-immutable");
if (
  staticHeaders["Cache-Control"] !==
  "public, max-age=31536000, s-maxage=31536000, immutable"
) {
  fail("static immutable header drift");
}

const publicHeaders = runtime.buildRegionalCdnHeaders("public-revalidate");
if (
  publicHeaders["Cache-Control"] !==
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
) {
  fail("public revalidate header drift");
}

for (const cacheClass of ["realtime-no-store", "health-no-store"]) {
  const headers = runtime.buildRegionalCdnHeaders(cacheClass);
  if (headers["Cache-Control"] !== "no-store, max-age=0") {
    fail(`${cacheClass} must remain no-store`);
  }
}

let unknownRejected = false;
try {
  runtime.buildRegionalCdnHeaders("unknown-cache-class");
} catch {
  unknownRejected = true;
}
if (!unknownRejected) fail("unknown cache class was accepted");

if (runtime.REGIONAL_CDN_STRATEGY.dataResidencyClaim !== false) {
  fail("CDN strategy must not claim data residency");
}
if (runtime.REGIONAL_CDN_STRATEGY.explicitCacheOptIn !== true) {
  fail("public shared caching must remain explicit opt-in");
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
    verifySourceContract(source + '\nconst regionRule = { countryCode: "BG" };\n', indexSource, docSource);
  } catch {
    rejectedCountryLiteral = true;
  }
  if (!rejectedCountryLiteral) fail("source contract did not reject concrete country rule");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./regional-cdn-strategy";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("REGIONAL_CDN_STRATEGY_SELF_TEST PASS runtime_negative_cases=1 source_negative_cases=3 cache_classes=4 no_store_guards=3 residency_claim=false");
} else {
  console.log("REGIONAL_CDN_STRATEGY PASS task=21.13 cache_classes=4 explicit_opt_in=true realtime_no_store=true health_no_store=true residency_claim=false");
}

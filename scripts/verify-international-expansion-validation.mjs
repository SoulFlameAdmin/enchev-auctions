import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH = "config/enchev-country-2-dry-run.json";
const REGISTRY_PATH = "locales/translation-keys.json";
const LOCALE_META_PATH = "locales/de.json";
const LOCALE_PATH = "locales/messages/de-DE.json";
const REGIONAL_REVIEW_PATH = "config/enchev-regional-data-residency-review.json";

function fail(message) {
  throw new Error(`31_01_05_EXPANSION_VALIDATION FAIL: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function compatibleSource(source) {
  return source.replace(/from "(.\/[^"]+)";/g, (full, specifier) =>
    specifier.endsWith(".js") ? full : `from "${specifier}.js";`
  );
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-phase31-"));
  try {
    const sourceDir = path.join(tempDir, "src");
    const outDir = path.join(tempDir, "out");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "package.json"), '{"type":"module"}\n', "utf8");

    const sourceFiles = [
      "country-profile.ts",
      "country-kyc-profile.ts",
      "country-legal-profile.ts",
      "country-document-profile.ts",
      "country-market-bundle.ts",
      "country-provider-routing.ts",
      "country-data-residency-check.ts"
    ];

    for (const name of sourceFiles) {
      const source = fs.readFileSync(path.join("packages/config/src", name), "utf8");
      fs.writeFileSync(path.join(sourceDir, name), compatibleSource(source), "utf8");
    }

    fs.writeFileSync(path.join(sourceDir, "entry.ts"), [
      'export * from "./country-profile.js";',
      'export * from "./country-market-bundle.js";',
      'export * from "./country-provider-routing.js";',
      'export * from "./country-data-residency-check.js";'
    ].join("\n") + "\n", "utf8");

    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [
      tscPath,
      path.join(sourceDir, "entry.ts"),
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

    const entry = path.join(outDir, "entry.js");
    if (!fs.existsSync(entry)) fail("compiled expansion runtime entry missing");
    return await import(`${pathToFileURL(entry).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function verifyLocale(registry, metadata, catalog, expectedLocale) {
  if (metadata?.locale !== expectedLocale || catalog?.locale !== expectedLocale) {
    fail("31.02 locale identity mismatch");
  }
  if (metadata.direction !== "ltr" || metadata.script !== "Latn") {
    fail("31.02 locale metadata direction/script mismatch");
  }
  const keys = registry?.keys;
  const messages = catalog?.messages;
  if (!Array.isArray(keys) || !messages || typeof messages !== "object") {
    fail("31.02 locale registry/catalog malformed");
  }
  const catalogKeys = Object.keys(messages);
  if (JSON.stringify(catalogKeys) !== JSON.stringify(keys)) {
    fail("31.02 de-DE catalog must have exact translation-key parity");
  }
  for (const key of keys) {
    const value = messages[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(`31.02 blank de-DE message: ${key}`);
    }
    if (value.normalize("NFC") !== value) fail(`31.02 non-NFC de-DE message: ${key}`);
  }
  return keys.length;
}

function verifyGenericSources() {
  for (const sourcePath of [
    "packages/config/src/country-provider-routing.ts",
    "packages/config/src/country-data-residency-check.ts"
  ]) {
    const source = fs.readFileSync(sourcePath, "utf8");
    if (/\bDE\b|de-DE|Germany|Deutschland/.test(source)) {
      fail(`31.01 generic source contains Country #2 hardcoding: ${sourcePath}`);
    }
    for (const token of ["process.env", "Deno.env", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN"]) {
      if (source.includes(token)) fail(`31.04/31.05 generic source reads secret/runtime token: ${token}`);
    }
  }
}

function validatePhase(config, runtime, registry, metadata, catalog, regionalReview) {
  const ids = ["31.01", "31.02", "31.03", "31.04", "31.05"];
  if (config.phaseId !== "31" || config.phaseName !== "International expansion validation") {
    fail("phase identity mismatch");
  }
  if (JSON.stringify(config.tasks?.map((task) => task.id)) !== JSON.stringify(ids)) {
    fail("31.01-31.05 frozen task registry mismatch");
  }
  if (
    config.dryRunOnly !== true ||
    config.marketActivationApproved !== false ||
    config.legalValidated !== false ||
    config.productionProvidersBound !== false ||
    config.realCustomerDataAllowed !== false
  ) {
    fail("dry-run must remain non-production and fail-closed");
  }

  verifyGenericSources();

  const validateBundle = runtime.validateCountryMarketBundle;
  const validateRoutes = runtime.validateCountryProviderRoutes;
  const resolveRoute = runtime.resolveCountryProviderRoute;
  const evaluateResidency = runtime.evaluateCountryDataResidencyCheck;

  if ([validateBundle, validateRoutes, resolveRoute, evaluateResidency].some((fn) => typeof fn !== "function")) {
    fail("compiled generic runtime exports missing");
  }

  const bundle = {
    countryProfile: config.countryProfile,
    kycProfile: config.kycProfile,
    legalProfile: config.legalProfile,
    documentProfile: config.documentProfile
  };
  const bundleResult = validateBundle(bundle);
  if (!bundleResult.ok) fail(`31.01/31.03 Country #2 bundle rejected: ${bundleResult.errors.join(", ")}`);

  if (
    config.countryProfile.countryCode !== "DE" ||
    config.countryProfile.defaultLocale !== "de-DE" ||
    config.countryProfile.timeZone !== "Europe/Berlin"
  ) {
    fail("31.01 Country #2 dry-run identity drift");
  }

  const localeKeys = verifyLocale(registry, metadata, catalog, config.countryProfile.defaultLocale);
  if (config.localePackage?.completeAgainstRegistry !== true || config.localePackage?.path !== LOCALE_PATH) {
    fail("31.02 locale-package contract drift");
  }

  for (const requirement of config.legalProfile.requirements) {
    if (!String(requirement.authorityRef).startsWith("dry-run.de.non-authoritative.")) {
      fail("31.03 legal dry-run authority reference must remain explicitly non-authoritative");
    }
  }

  const routeResult = validateRoutes(config.providerRoutes, config.countryProfile);
  if (!routeResult.ok) fail(`31.04 provider routes rejected: ${routeResult.errors.join(", ")}`);
  if (routeResult.value.length < 4 || routeResult.value.some((route) => route.mode !== "dry-run")) {
    fail("31.04 provider routing must prove at least four dry-run capabilities");
  }
  for (const capability of ["documents", "identity", "notifications", "transport"]) {
    const resolved = resolveRoute(config.countryProfile, routeResult.value, capability);
    if (!resolved || resolved.mode !== "dry-run" || resolved.enabled !== true) {
      fail(`31.04 provider route unresolved: ${capability}`);
    }
  }
  if (resolveRoute(config.countryProfile, routeResult.value, "payments") !== null) {
    fail("31.04 undefined provider capability must fail closed");
  }

  const residency = evaluateResidency(config.countryProfile, config.residencyPolicy, config.dataPlanes);
  if (residency.completed !== true) fail("31.05 residency check did not complete");
  if (residency.approved !== config.expectedResidencyResult.approved) {
    fail("31.05 residency approval result drift");
  }
  if (residency.blockers.length < config.expectedResidencyResult.minimumBlockers) {
    fail("31.05 fail-closed residency blockers were hidden");
  }

  const unresolved = new Set(regionalReview?.unresolved_requirements || []);
  for (const requirement of [
    "object-storage-provider-region",
    "production-authoritative-database-region",
    "runtime-compute-region-policy",
    "runtime-observability-region-retention"
  ]) {
    if (!unresolved.has(requirement)) fail(`31.05 upstream residency blocker missing: ${requirement}`);
  }

  return {
    tasks: ids.length,
    country: config.countryProfile.countryCode,
    locale: config.countryProfile.defaultLocale,
    localeKeys,
    providerRoutes: routeResult.value.length,
    residency
  };
}

const config = readJson(CONFIG_PATH);
const registry = readJson(REGISTRY_PATH);
const metadata = readJson(LOCALE_META_PATH);
const catalog = readJson(LOCALE_PATH);
const regionalReview = readJson(REGIONAL_REVIEW_PATH);
const runtime = await loadRuntime();
const summary = validatePhase(config, runtime, registry, metadata, catalog, regionalReview);

if (process.argv.includes("--self-test")) {
  const cases = [];
  const expectRejected = (label, mutateConfig, mutateCatalog = (value) => value) => {
    const candidate = structuredClone(config);
    const candidateCatalog = structuredClone(catalog);
    mutateConfig(candidate);
    mutateCatalog(candidateCatalog);
    let rejected = false;
    try {
      validatePhase(candidate, runtime, registry, metadata, candidateCatalog, regionalReview);
    } catch {
      rejected = true;
    }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases.push(label);
  };

  expectRejected("activate dry-run market", (candidate) => { candidate.marketActivationApproved = true; });
  expectRejected("cross-country KYC profile", (candidate) => { candidate.kycProfile.countryCode = "GB"; });
  expectRejected("missing locale key", () => {}, (candidateCatalog) => { delete candidateCatalog.messages[registry.keys[0]]; });
  expectRejected("duplicate provider capability", (candidate) => { candidate.providerRoutes[1].capability = candidate.providerRoutes[0].capability; });
  expectRejected("hide residency blockers", (candidate) => { candidate.expectedResidencyResult.minimumBlockers = 0; candidate.dataPlanes = []; });

  console.log(`31_01_05_EXPANSION_VALIDATION_SELF_TEST PASS cases=${cases.length} country=${summary.country} locale=${summary.locale}`);
} else {
  console.log(`31_01_05_EXPANSION_VALIDATION PASS tasks=${summary.tasks} country=${summary.country} locale=${summary.locale} locale_keys=${summary.localeKeys} provider_routes=${summary.providerRoutes} residency_check_completed=${summary.residency.completed} residency_approved=${summary.residency.approved} blockers=${summary.residency.blockers.length} market_activation=false`);
}

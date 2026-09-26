import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH = "config/enchev-country-2-validation-31-06-10.json";
const COUNTRY_CONFIG_PATH = "config/enchev-country-2-dry-run.json";

function fail(message) {
  throw new Error(`31_06_10_EXPANSION_VALIDATION FAIL: ${message}`);
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-phase31b-"));
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
      "market-activation-gate.ts",
      "market-activation-feature-flag.ts",
      "timezone-aware-display.ts",
      "unicode-normalization.ts",
      "cross-script-search.ts"
    ];

    for (const name of sourceFiles) {
      const source = fs.readFileSync(path.join("packages/config/src", name), "utf8");
      fs.writeFileSync(path.join(sourceDir, name), compatibleSource(source), "utf8");
    }

    fs.writeFileSync(path.join(sourceDir, "entry.ts"), [
      'export * from "./market-activation-gate.js";',
      'export * from "./market-activation-feature-flag.js";',
      'export * from "./timezone-aware-display.js";',
      'export * from "./unicode-normalization.js";',
      'export * from "./cross-script-search.js";'
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
    if (!fs.existsSync(entry)) fail("compiled Phase 31.06-31.10 runtime entry missing");
    return await import(`${pathToFileURL(entry).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function offsetMinutes(instant, timeZone) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    year: "numeric"
  }).formatToParts(new Date(instant)).find((item) => item.type === "timeZoneName")?.value;

  if (part === "GMT" || part === "UTC") return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(part || "");
  if (!match) fail(`unable to resolve timezone offset for ${instant}: ${part || "missing"}`);
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function verifyTimezoneDst(config, country, runtime) {
  if (config.timezoneDst.timeZone !== country.countryProfile.timeZone) fail("31.06 timezone must match CountryProfile");
  if (config.timezoneDst.locale !== country.countryProfile.defaultLocale) fail("31.06 locale must match CountryProfile");

  const format = runtime.formatCountryProfileDateTime;
  if (typeof format !== "function") fail("31.06 timezone formatter export missing");

  const vectors = [...config.timezoneDst.springForward, ...config.timezoneDst.fallBack];
  const rendered = [];
  for (const vector of vectors) {
    const actualOffset = offsetMinutes(vector.instant, config.timezoneDst.timeZone);
    if (actualOffset !== vector.expectedOffsetMinutes) {
      fail(`31.06 offset mismatch for ${vector.instant}: expected ${vector.expectedOffsetMinutes}, got ${actualOffset}`);
    }
    const output = format(vector.instant, country.countryProfile, config.timezoneDst.locale, "numeric");
    if (typeof output !== "string" || output.trim().length === 0) fail("31.06 formatted timezone output is blank");
    rendered.push(output);
  }

  if (config.timezoneDst.springForward[0].expectedOffsetMinutes === config.timezoneDst.springForward[1].expectedOffsetMinutes) {
    fail("31.06 spring-forward test does not cross an offset transition");
  }
  if (config.timezoneDst.fallBack[0].expectedOffsetMinutes === config.timezoneDst.fallBack[1].expectedOffsetMinutes) {
    fail("31.06 fall-back test does not cross an offset transition");
  }

  return { vectors: vectors.length, rendered };
}

function verifyUnicodeSearch(config, runtime) {
  const normalize = runtime.normalizeUnicodeText;
  const matches = runtime.matchesCrossScriptSearch;
  if (typeof normalize !== "function" || typeof matches !== "function") {
    fail("31.07 Unicode/search runtime exports missing");
  }

  for (const vector of config.unicodeSearch.normalization) {
    const result = normalize(vector.input);
    if (!result.ok || result.value !== vector.expected || result.form !== "NFC") {
      fail(`31.07 Unicode normalization mismatch for ${JSON.stringify(vector.input)}`);
    }
  }

  for (const vector of config.unicodeSearch.searchCases) {
    const actual = matches(vector.query, { text: vector.text, identifiers: vector.identifiers });
    if (actual !== vector.expected) fail(`31.07 search mismatch for query ${vector.query}`);
  }

  return {
    normalizationCases: config.unicodeSearch.normalization.length,
    searchCases: config.unicodeSearch.searchCases.length
  };
}

function verifyActivationAndRollback(config, country, runtime) {
  const evaluateGate = runtime.evaluateMarketActivationGate;
  const applyFlag = runtime.applyMarketActivationFeatureFlag;
  if (typeof evaluateGate !== "function" || typeof applyFlag !== "function") {
    fail("31.08 activation runtime exports missing");
  }

  if (config.activationFeatureFlag.enabled !== false || config.marketActivationApproved !== false) {
    fail("31.08 real Country #2 activation must remain disabled");
  }

  const profiles = [
    country.countryProfile,
    country.kycProfile,
    country.legalProfile,
    country.documentProfile
  ];

  const actualGate = evaluateGate(
    {
      countryCode: country.countryProfile.countryCode,
      kycApproved: false,
      legalApproved: false,
      documentsApproved: false
    },
    ...profiles
  );
  const actualFlagResult = applyFlag(config.activationFeatureFlag, country.countryProfile, actualGate);
  if (actualFlagResult.active) fail("31.08 real dry-run Country #2 activated");

  if (config.rollback.simulationOnly !== true || config.rollback.enableForSyntheticGate !== true) {
    fail("31.09 rollback test must be simulation-only");
  }

  const syntheticApprovedGate = evaluateGate(
    {
      countryCode: country.countryProfile.countryCode,
      kycApproved: true,
      legalApproved: true,
      documentsApproved: true
    },
    ...profiles
  );
  if (!syntheticApprovedGate.active) fail("31.09 synthetic prerequisite gate did not activate");

  const enabledFlag = { ...config.activationFeatureFlag, enabled: true, revision: config.activationFeatureFlag.revision + 1 };
  const enabledResult = applyFlag(enabledFlag, country.countryProfile, syntheticApprovedGate);
  if (enabledResult.active !== config.rollback.expectedActiveAfterEnable) {
    fail("31.09 synthetic enable result mismatch");
  }

  const rollbackFlag = { ...enabledFlag, enabled: config.rollback.rollbackToEnabled, revision: enabledFlag.revision + 1 };
  const rollbackResult = applyFlag(rollbackFlag, country.countryProfile, syntheticApprovedGate);
  if (rollbackResult.active !== config.rollback.expectedActiveAfterRollback || rollbackResult.active !== false) {
    fail("31.09 rollback failed to restore inactive state");
  }

  return {
    actualActive: actualFlagResult.active,
    simulatedEnableActive: enabledResult.active,
    rollbackActive: rollbackResult.active
  };
}

function walkSourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkSourceFiles(full));
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function assertTextHasNoCountryTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) fail(`31.10 Country #2 token leaked into protected core source ${label}: ${token}`);
  }
}

function verifyNoCoreRewrite(config) {
  const script = config.noCoreRewrite.existingInvariant;
  const invariant = spawnSync(process.execPath, [script], { encoding: "utf8" });
  if (invariant.status !== 0 || !/COUNTRY_2_NO_CORE_REWRITE PASS/.test(invariant.stdout || "")) {
    fail(`31.10 existing no-core-rewrite invariant failed: ${(invariant.stderr || invariant.stdout || "").trim()}`);
  }

  let scanned = 0;
  for (const root of config.noCoreRewrite.protectedRoots) {
    for (const file of walkSourceFiles(root)) {
      assertTextHasNoCountryTokens(file, fs.readFileSync(file, "utf8"), config.noCoreRewrite.forbiddenCountryTokens);
      scanned += 1;
    }
  }
  if (scanned === 0) fail("31.10 protected core scan found no source files");

  for (const genericFile of [
    "packages/config/src/country-market-bundle.ts",
    "packages/config/src/market-activation-feature-flag.ts"
  ]) {
    assertTextHasNoCountryTokens(
      genericFile,
      fs.readFileSync(genericFile, "utf8"),
      config.noCoreRewrite.forbiddenCountryTokens
    );
  }

  return { scanned, invariantPass: true };
}

function validateConfigShape(config, country) {
  const ids = ["31.06", "31.07", "31.08", "31.09", "31.10"];
  if (config.phaseId !== "31" || config.phaseName !== "International expansion validation") fail("phase identity mismatch");
  if (JSON.stringify(config.tasks?.map((task) => task.id)) !== JSON.stringify(ids)) {
    fail("31.06-31.10 frozen task registry mismatch");
  }
  if (config.countryConfigSource !== COUNTRY_CONFIG_PATH) fail("Country #2 source config path drift");
  if (config.dryRunOnly !== true || config.marketActivationApproved !== false) fail("31.06-31.10 must remain dry-run and fail-closed");
  if (country.countryProfile.countryCode !== "DE") fail("Country #2 must remain DE for this dry run");
}

const config = readJson(CONFIG_PATH);
const country = readJson(COUNTRY_CONFIG_PATH);
const runtime = await loadRuntime();
validateConfigShape(config, country);

const timezone = verifyTimezoneDst(config, country, runtime);
const unicodeSearch = verifyUnicodeSearch(config, runtime);
const activation = verifyActivationAndRollback(config, country, runtime);
const core = verifyNoCoreRewrite(config);

if (process.argv.includes("--self-test")) {
  const negativeCases = [];

  const expectRejected = (label, action) => {
    let rejected = false;
    try { action(); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    negativeCases.push(label);
  };

  expectRejected("wrong DST offset", () => {
    const mutated = structuredClone(config);
    mutated.timezoneDst.springForward[1].expectedOffsetMinutes = 60;
    verifyTimezoneDst(mutated, country, runtime);
  });

  expectRejected("wrong Unicode normalization expectation", () => {
    const mutated = structuredClone(config);
    mutated.unicodeSearch.normalization[0].expected = "Munchen";
    verifyUnicodeSearch(mutated, runtime);
  });

  expectRejected("real activation flag enabled", () => {
    const mutated = structuredClone(config);
    mutated.activationFeatureFlag.enabled = true;
    verifyActivationAndRollback(mutated, country, runtime);
  });

  expectRejected("rollback left enabled", () => {
    const mutated = structuredClone(config);
    mutated.rollback.rollbackToEnabled = true;
    verifyActivationAndRollback(mutated, country, runtime);
  });

  expectRejected("Country #2 token in protected core", () => {
    assertTextHasNoCountryTokens("synthetic.ts", "const locale = 'de-DE';", config.noCoreRewrite.forbiddenCountryTokens);
  });

  console.log(`31_06_10_EXPANSION_VALIDATION_SELF_TEST PASS cases=${negativeCases.length} timezone_vectors=${timezone.vectors} normalization_cases=${unicodeSearch.normalizationCases} search_cases=${unicodeSearch.searchCases} core_files_scanned=${core.scanned}`);
} else {
  console.log(`31_06_10_EXPANSION_VALIDATION PASS tasks=5 country=DE timezone_vectors=${timezone.vectors} normalization_cases=${unicodeSearch.normalizationCases} search_cases=${unicodeSearch.searchCases} feature_flag_active=${activation.actualActive} simulated_enable=${activation.simulatedEnableActive} rollback_active=${activation.rollbackActive} no_core_rewrite=${core.invariantPass} core_files_scanned=${core.scanned}`);
}

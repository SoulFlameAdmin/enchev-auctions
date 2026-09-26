import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH = "config/enchev-phase31-11-to-32-03.json";
const MASTER_PATH = "app/components/MasterSystemPlanV1.tsx";

function fail(message) {
  throw new Error(`31_11_32_03_VALIDATION FAIL: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0) {
    fail(`${script} ${args.join(" ")} failed: ${output.trim()}`);
  }
  return output;
}

function frozenTaskMap() {
  const source = fs.readFileSync(MASTER_PATH, "utf8");
  const startMarker = "const raw: RawPhase[] = ";
  const endMarker = "\n\nconst WAVE_LABELS";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) fail("unable to locate frozen raw master plan");
  const literal = source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
  const raw = Function(`"use strict"; return (${literal});`)();
  const map = new Map();
  for (const [phaseId, , items] of raw) {
    items.forEach((entry, index) => {
      const [label] = String(entry).split("|");
      map.set(`${phaseId}.${String(index + 1).padStart(2, "0")}`, label);
    });
  }
  return map;
}

async function loadRtlRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-phase31-rtl-"));
  try {
    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const sourcePath = "packages/config/src/rtl-layout-capability.ts";
    const result = spawnSync(process.execPath, [
      tscPath,
      sourcePath,
      "--ignoreConfig",
      "--target", "ES2022",
      "--module", "ES2022",
      "--moduleResolution", "Bundler",
      "--skipLibCheck",
      "--outDir", tempDir,
      "--pretty", "false"
    ], { encoding: "utf8" });

    if (result.status !== 0) {
      fail(`RTL runtime TypeScript compile failed: ${(result.stderr || result.stdout || "").trim()}`);
    }

    const compiled = path.join(tempDir, "rtl-layout-capability.js");
    if (!fs.existsSync(compiled)) fail("compiled RTL runtime module missing");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function verifyTaskIdentity(config) {
  const expected = [
    ["31.11", "Third-language dry run"],
    ["31.12", "RTL dry run"],
    ["32.01", "Master task IDs immutable"],
    ["32.02", "No silent delete/renumber"],
    ["32.03", "GREEN requires evidence"]
  ];

  const actual = config.tasks?.map((task) => [task.id, task.name]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("task contract does not match the next five frozen master tasks");
  }

  const frozen = frozenTaskMap();
  for (const [id, label] of expected) {
    if (frozen.get(id) !== label) {
      fail(`frozen task identity drift for ${id}: expected "${label}", got "${frozen.get(id)}"`);
    }
  }
}

function verifyThirdLanguage(config) {
  const dryRun = config.thirdLanguageDryRun;
  const metadata = readJson(dryRun.localeMetadata);
  const catalog = readJson(dryRun.messageCatalog);
  const registry = readJson(dryRun.translationRegistry);
  const country = readJson(dryRun.countryConfig);
  const bg = readJson("locales/bg.json");
  const en = readJson("locales/en.json");

  const locales = [bg.locale, en.locale, metadata.locale];
  const languages = [bg.language, en.language, metadata.language];

  if (new Set(locales).size !== 3 || new Set(languages).size !== 3) {
    fail("31.11 dry run must prove a distinct third locale/language");
  }
  if (metadata.locale !== dryRun.thirdLocale || metadata.locale !== "de-DE") {
    fail("31.11 third-language locale must be de-DE");
  }
  if (metadata.direction !== "ltr" || metadata.script !== "Latn") {
    fail("31.11 de-DE locale metadata drift");
  }
  if (country.countryProfile?.defaultLocale !== metadata.locale ||
      !country.countryProfile?.supportedLocales?.includes(metadata.locale)) {
    fail("31.11 Country #2 is not wired to the third-language locale");
  }
  if (country.marketActivationApproved !== false || dryRun.productionActivation !== false) {
    fail("31.11 third-language dry run must not activate production market");
  }

  const registryKeys = registry.keys;
  const catalogKeys = Object.keys(catalog.messages || {});
  if (!Array.isArray(registryKeys) ||
      JSON.stringify(catalogKeys) !== JSON.stringify(registryKeys)) {
    fail("31.11 third-language catalog must have exact translation-key parity");
  }
  for (const key of registryKeys) {
    const value = catalog.messages[key];
    if (typeof value !== "string" || value.trim().length === 0 || value.normalize("NFC") !== value) {
      fail(`31.11 invalid de-DE message: ${key}`);
    }
  }

  let dateSample;
  let numberSample;
  try {
    dateSample = new Intl.DateTimeFormat(metadata.locale, {
      timeZone: country.countryProfile.timeZone,
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date("2026-09-26T12:34:00Z"));
    numberSample = new Intl.NumberFormat(metadata.locale).format(1234567.89);
  } catch (error) {
    fail(`31.11 Intl dry run failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!dateSample || !numberSample) fail("31.11 Intl dry run produced blank output");

  const completeness = runNode("scripts/verify-translation-completeness.mjs");
  const completenessSelf = runNode("scripts/verify-translation-completeness.mjs", ["--self-test"]);
  if (!/TRANSLATION_COMPLETENESS PASS/.test(completeness)) {
    fail("31.11 translation completeness invariant did not pass");
  }
  if (!/TRANSLATION_COMPLETENESS_SELF_TEST PASS/.test(completenessSelf)) {
    fail("31.11 translation completeness negative tests did not pass");
  }

  return { locales: locales.length, keys: registryKeys.length, dateSample, numberSample };
}

async function verifyRtlDryRun(config) {
  const dryRun = config.rtlDryRun;
  if (dryRun.productionLocale !== false || dryRun.direction !== "rtl") {
    fail("31.12 RTL dry run must remain a non-production rtl fixture");
  }

  const runtime = await loadRtlRuntime();
  const result = runtime.resolveLayoutDirection({
    locale: dryRun.locale,
    direction: dryRun.direction
  });
  if (!result?.ok || result.value.locale !== dryRun.locale || result.value.direction !== "rtl") {
    fail("31.12 RTL locale fixture failed runtime direction resolution");
  }

  const attrs = runtime.layoutDirectionAttributes({
    locale: dryRun.locale,
    direction: dryRun.direction
  });
  if (!attrs || attrs.lang !== dryRun.locale || attrs.dir !== "rtl") {
    fail("31.12 RTL lang/dir attributes drift");
  }

  const capability = runNode(dryRun.existingCapabilityVerifier);
  const capabilitySelf = runNode(dryRun.existingCapabilityVerifier, ["--self-test"]);
  if (!/RTL_LAYOUT_CAPABILITY PASS/.test(capability) ||
      !/logical_css=true/.test(capability) ||
      !/browser_fixture=\/rtl-capability/.test(capability)) {
    fail("31.12 existing RTL capability/browser fixture invariant did not pass");
  }
  if (!/RTL_LAYOUT_CAPABILITY_SELF_TEST PASS/.test(capabilitySelf)) {
    fail("31.12 RTL negative tests did not pass");
  }

  return { locale: attrs.lang, dir: attrs.dir, logicalCss: true, browserFixture: dryRun.browserFixture };
}

function verifyGovernance(config) {
  const governance = config.governance;

  const idLock = runNode(governance.masterIdVerifier);
  if (!idLock.includes(`MASTER_ID_LOCK count=${governance.expectedFrozenTaskCount}`)) {
    fail("32.01 frozen task count lock mismatch");
  }
  if (!idLock.includes(`MASTER_ID_LOCK sha256=${governance.expectedFrozenSha256}`)) {
    fail("32.01 frozen task hash lock mismatch");
  }
  if (!/MASTER_ID_LOCK PASS: frozen master task IDs are unchanged\./.test(idLock)) {
    fail("32.01 immutable task ID invariant did not pass");
  }

  const idSelf = runNode(governance.masterIdVerifier, ["--self-test"]);
  for (const token of [
    "silent delete rejected",
    "silent renumber rejected",
    "ID reuse/duplicate rejected",
    "delete, renumber and ID reuse are all rejected"
  ]) {
    if (!idSelf.includes(token)) fail(`32.02 governance rejection proof missing: ${token}`);
  }

  const evidence = runNode(governance.greenEvidenceVerifier);
  if (!/GREEN_EVIDENCE_GUARD PASS: every governed GREEN path requires non-empty evidence\./.test(evidence)) {
    fail("32.03 GREEN evidence invariant did not pass");
  }
  const evidenceSelf = runNode(governance.greenEvidenceVerifier, ["--self-test"]);
  for (const token of [
    "empty evidence is rejected",
    "whitespace evidence is rejected",
    "real evidence permits GREEN"
  ]) {
    if (!evidenceSelf.includes(token)) fail(`32.03 evidence self-test proof missing: ${token}`);
  }

  return {
    frozenTaskCount: governance.expectedFrozenTaskCount,
    frozenHash: governance.expectedFrozenSha256,
    deleteRenumberReuseRejected: true,
    greenEvidenceRequired: true
  };
}

const config = readJson(CONFIG_PATH);
verifyTaskIdentity(config);
const third = verifyThirdLanguage(config);
const rtl = await verifyRtlDryRun(config);
const governance = verifyGovernance(config);

if (process.argv.includes("--self-test")) {
  const cases = [];

  const expectRejected = (label, action) => {
    let rejected = false;
    try { action(); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases.push(label);
  };

  expectRejected("third-language production activation", () => {
    const mutated = structuredClone(config);
    mutated.thirdLanguageDryRun.productionActivation = true;
    verifyThirdLanguage(mutated);
  });

  expectRejected("duplicate third language", () => {
    const mutated = structuredClone(config);
    mutated.thirdLanguageDryRun.thirdLocale = "en-US";
    verifyThirdLanguage(mutated);
  });

  expectRejected("RTL production locale claim", () => {
    const mutated = structuredClone(config);
    mutated.rtlDryRun.productionLocale = true;
    if (mutated.rtlDryRun.productionLocale !== false) fail("production RTL locale is forbidden in dry run");
  });

  expectRejected("governance frozen count drift", () => {
    const mutated = structuredClone(config);
    mutated.governance.expectedFrozenTaskCount = 1053;
    verifyGovernance(mutated);
  });

  expectRejected("frozen task label drift", () => {
    const mutated = structuredClone(config);
    mutated.tasks[2].name = "Mutable task IDs";
    verifyTaskIdentity(mutated);
  });

  console.log(`31_11_32_03_VALIDATION_SELF_TEST PASS cases=${cases.length} third_language=${config.thirdLanguageDryRun.thirdLocale} rtl=${rtl.locale} frozen_tasks=${governance.frozenTaskCount}`);
} else {
  console.log(`31_11_32_03_VALIDATION PASS tasks=5 third_language=${config.thirdLanguageDryRun.thirdLocale} locales=${third.locales} translation_keys=${third.keys} rtl_locale=${rtl.locale} rtl_dir=${rtl.dir} logical_css=${rtl.logicalCss} frozen_tasks=${governance.frozenTaskCount} immutable_ids=true delete_renumber_reuse_rejected=${governance.deleteRenumberReuseRejected} green_evidence_required=${governance.greenEvidenceRequired} production_activation=false`);
}

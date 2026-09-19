import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/locale-aware-date.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_03_LOCALE_AWARE_DATES.md";

function fail(message) {
  throw new Error(`LOCALE_AWARE_DATES FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./locale-aware-date";')) {
    fail("packages/config public entrypoint must export locale-aware-date");
  }

  for (const token of ["process.env", "Deno.env", "navigator.language", "navigator.languages"]) {
    if (source.includes(token)) fail(`ambient locale/runtime token forbidden: ${token}`);
  }

  if (!source.includes("LOCALE_AWARE_DATE_MODEL_VERSION = 1")) fail("model version marker missing");
  if (!source.includes("export function formatLocaleDate")) fail("formatLocaleDate export missing");
  if (!source.includes("export function formatCountryProfileDate")) fail("CountryProfile formatter export missing");
  if (!source.includes("new Intl.DateTimeFormat(normalizedLocale")) {
    fail("final date formatter must pass an explicit normalized locale");
  }
  if (!source.includes("timeZone: DATE_ONLY_TIME_ZONE")) {
    fail("date-only formatter must neutralize host timezone drift");
  }
  if (!source.includes("profile.supportedLocales.includes(locale)")) {
    fail("CountryProfile requested locale membership check missing");
  }

  if (!docSource.includes("21.04 owns timezone-aware instant display")) {
    fail("documentation must preserve 21.04 timezone ownership");
  }
  if (!docSource.includes("calendar-date")) {
    fail("documentation must state date-only scope");
  }
  if (!docSource.includes("country-neutral")) {
    fail("documentation must preserve country-neutral scope");
  }
}

function findCompiledModule(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findCompiledModule(full);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === "locale-aware-date.js") {
      return full;
    }
  }
  return null;
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-locale-date-"));
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
    if (!compiled) fail("compiled locale-aware-date runtime module was not produced");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function expectThrows(label, action) {
  let threw = false;
  try {
    action();
  } catch {
    threw = true;
  }
  if (!threw) fail(`invalid runtime case was accepted: ${label}`);
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
if (runtime.LOCALE_AWARE_DATE_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.formatLocaleDate !== "function") fail("formatLocaleDate runtime export missing");
if (typeof runtime.formatCountryProfileDate !== "function") fail("formatCountryProfileDate runtime export missing");

const isoDate = "2026-09-19";
const english = runtime.formatLocaleDate(isoDate, "en", "numeric");
const german = runtime.formatLocaleDate(isoDate, "de", "numeric");
if (!english || !german) fail("valid locale formatting returned empty output");
if (english === german) fail("different locales did not produce locale-sensitive date output");

const partsOutput = runtime.formatLocaleDate({ year: 2026, month: 9, day: 19 }, "en", "numeric");
if (partsOutput !== english) fail("ISO and explicit date parts must format identically");

const profile = {
  countryCode: "ZZ",
  defaultLocale: "en",
  supportedLocales: ["en", "de"],
  timeZone: "Etc/UTC"
};
const profileDefault = runtime.formatCountryProfileDate(isoDate, profile);
if (profileDefault !== english) fail("CountryProfile default locale was not honored");
const profileOverride = runtime.formatCountryProfileDate(isoDate, profile, "de");
if (profileOverride !== german) fail("CountryProfile requested locale override was not honored");

expectThrows("invalid calendar date", () => runtime.formatLocaleDate("2026-02-30", "en"));
expectThrows("invalid ISO shape", () => runtime.formatLocaleDate("19/09/2026", "en"));
expectThrows("empty locale", () => runtime.formatLocaleDate(isoDate, ""));
expectThrows("unsupported profile locale", () => runtime.formatCountryProfileDate(isoDate, profile, "fr"));
expectThrows("unsupported style", () => runtime.formatLocaleDate(isoDate, "en", "wide"));

if (process.argv.includes("--self-test")) {
  let rejectedAmbient = false;
  try {
    verifySourceContract(
      source.replace("new Intl.DateTimeFormat(normalizedLocale", "new Intl.DateTimeFormat(undefined"),
      indexSource,
      docSource
    );
  } catch {
    rejectedAmbient = true;
  }
  if (!rejectedAmbient) fail("source contract did not reject ambient/default locale formatting");

  let rejectedMissingZoneNeutralization = false;
  try {
    verifySourceContract(
      source.replace("timeZone: DATE_ONLY_TIME_ZONE", "timeZone: undefined"),
      indexSource,
      docSource
    );
  } catch {
    rejectedMissingZoneNeutralization = true;
  }
  if (!rejectedMissingZoneNeutralization) fail("source contract did not reject host-timezone-sensitive date-only formatting");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./locale-aware-date";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("LOCALE_AWARE_DATES_SELF_TEST PASS runtime_negative_cases=5 source_negative_cases=3 locale_sensitive=true");
} else {
  console.log("LOCALE_AWARE_DATES PASS task=21.03 model_version=1 explicit_locale=true date_only=true country_neutral=true");
}

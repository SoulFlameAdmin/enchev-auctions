import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/timezone-aware-display.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_04_TIMEZONE_AWARE_DISPLAY.md";

function fail(message) {
  throw new Error(`TIMEZONE_AWARE_DISPLAY FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./timezone-aware-display";')) {
    fail("packages/config public entrypoint must export timezone-aware-display");
  }

  for (const token of ["process.env", "Deno.env", "navigator.language", "navigator.languages"]) {
    if (source.includes(token)) fail(`ambient runtime token forbidden: ${token}`);
  }

  if (!source.includes("TIMEZONE_AWARE_DISPLAY_MODEL_VERSION = 1")) fail("model version marker missing");
  if (!source.includes("export function formatTimeZoneDateTime")) fail("formatTimeZoneDateTime export missing");
  if (!source.includes("export function formatCountryProfileDateTime")) fail("CountryProfile formatter export missing");
  if (!source.includes("timeZone: normalizedTimeZone")) fail("final formatter must use explicit normalized timezone");
  if (!source.includes("new Intl.DateTimeFormat(normalizedLocale")) fail("final formatter must use explicit normalized locale");
  if (!source.includes("profile.timeZone")) fail("CountryProfile timezone integration missing");
  if (!source.includes("profile.supportedLocales.includes(locale)")) fail("CountryProfile locale membership check missing");
  if (!source.includes("ISO timestamp with Z or an explicit UTC offset")) fail("ambiguous timestamp rejection missing");

  if (!docSource.includes("21.03 remains the date-only contract")) {
    fail("documentation must preserve 21.03 date-only ownership");
  }
  if (!docSource.includes("21.05 and 21.06")) {
    fail("documentation must preserve later concrete locale ownership");
  }
  if (!docSource.includes("No timezone is inferred")) {
    fail("documentation must prohibit ambient timezone inference");
  }
}

function findCompiledModule(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findCompiledModule(full);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === "timezone-aware-display.js") {
      return full;
    }
  }
  return null;
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-timezone-display-"));
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
    if (!compiled) fail("compiled timezone-aware display runtime module was not produced");
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
if (runtime.TIMEZONE_AWARE_DISPLAY_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.formatTimeZoneDateTime !== "function") fail("formatTimeZoneDateTime runtime export missing");
if (typeof runtime.formatCountryProfileDateTime !== "function") fail("formatCountryProfileDateTime runtime export missing");

const instant = "2026-09-19T00:30:00Z";
const utc = runtime.formatTimeZoneDateTime(instant, "en", "Etc/UTC", "numeric");
const newYork = runtime.formatTimeZoneDateTime(instant, "en", "America/New_York", "numeric");
if (!utc || !newYork) fail("valid timezone formatting returned empty output");
if (utc === newYork) fail("same instant did not change when display timezone changed");

const equivalentOffset = runtime.formatTimeZoneDateTime("2026-09-18T20:30:00-04:00", "en", "Etc/UTC", "numeric");
if (equivalentOffset !== utc) fail("equivalent instant with explicit offset formatted differently");

const dateInput = runtime.formatTimeZoneDateTime(new Date(instant), "en", "Etc/UTC", "numeric");
if (dateInput !== utc) fail("Date input and ISO instant input must format identically");

const profile = {
  countryCode: "ZZ",
  defaultLocale: "en",
  supportedLocales: ["en", "de"],
  timeZone: "America/New_York"
};
const profileDefault = runtime.formatCountryProfileDateTime(instant, profile);
if (profileDefault !== newYork) fail("CountryProfile timezone/default locale were not honored");
const profileOverride = runtime.formatCountryProfileDateTime(instant, profile, "de");
if (!profileOverride || profileOverride === profileDefault) fail("CountryProfile locale override was not honored");

expectThrows("date-only string", () => runtime.formatTimeZoneDateTime("2026-09-19", "en", "Etc/UTC"));
expectThrows("ambiguous local timestamp", () => runtime.formatTimeZoneDateTime("2026-09-19T12:00:00", "en", "Etc/UTC"));
expectThrows("invalid instant", () => runtime.formatTimeZoneDateTime("2026-99-99T12:00:00Z", "en", "Etc/UTC"));
expectThrows("empty locale", () => runtime.formatTimeZoneDateTime(instant, "", "Etc/UTC"));
expectThrows("invalid timezone", () => runtime.formatTimeZoneDateTime(instant, "en", "Not/AZone"));
expectThrows("unsupported profile locale", () => runtime.formatCountryProfileDateTime(instant, profile, "fr"));
expectThrows("unsupported style", () => runtime.formatTimeZoneDateTime(instant, "en", "Etc/UTC", "wide"));

if (process.argv.includes("--self-test")) {
  let rejectedAmbientZone = false;
  try {
    verifySourceContract(
      source.replace("timeZone: normalizedTimeZone", "timeZone: undefined"),
      indexSource,
      docSource
    );
  } catch {
    rejectedAmbientZone = true;
  }
  if (!rejectedAmbientZone) fail("source contract did not reject ambient/default timezone display");

  let rejectedAmbientLocale = false;
  try {
    verifySourceContract(
      source.replace("new Intl.DateTimeFormat(normalizedLocale", "new Intl.DateTimeFormat(undefined"),
      indexSource,
      docSource
    );
  } catch {
    rejectedAmbientLocale = true;
  }
  if (!rejectedAmbientLocale) fail("source contract did not reject ambient/default locale display");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(source, indexSource.replace('export * from "./timezone-aware-display";', ""), docSource);
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("TIMEZONE_AWARE_DISPLAY_SELF_TEST PASS runtime_negative_cases=7 source_negative_cases=3 explicit_zone=true");
} else {
  console.log("TIMEZONE_AWARE_DISPLAY PASS task=21.04 model_version=1 explicit_locale=true explicit_timezone=true instant_safe=true");
}

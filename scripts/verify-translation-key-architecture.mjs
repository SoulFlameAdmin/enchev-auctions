import fs from "node:fs";

const REGISTRY_PATH = "locales/translation-keys.json";
const SOURCE_PATH = "packages/config/src/translation-key.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const DOC_PATH = "docs/21_07_TRANSLATION_KEY_ARCHITECTURE.md";

const EXACT_FIELDS = ["schemaVersion", "separator", "keyFormat", "keys"];
const KEY_PATTERN = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){2,}$/;
const MAX_KEY_LENGTH = 120;
const FORBIDDEN_REGISTRY_FIELDS = new Set([
  "messages",
  "translations",
  "dictionary",
  "fallback",
  "fallbackLocale",
  "defaultLocale",
  "supportedLocales",
  "locales",
  "timeZone",
  "countryCode",
  "currency",
  "pricing",
  "payment",
  "kyc",
  "legal",
  "documents",
  "secrets",
  "environment"
]);

function fail(message) {
  throw new Error(`TRANSLATION_KEY_ARCHITECTURE FAIL: ${message}`);
}

function loadRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
}

function validateRegistry(registry, source, indexSource, docSource) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    fail("registry must be an object");
  }

  const actualFields = Object.keys(registry).sort();
  const expectedFields = [...EXACT_FIELDS].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    fail(`registry fields drift: expected ${expectedFields.join(", ")} got ${actualFields.join(", ")}`);
  }

  for (const field of Object.keys(registry)) {
    if (FORBIDDEN_REGISTRY_FIELDS.has(field)) {
      fail(`forbidden registry field present: ${field}`);
    }
  }

  if (registry.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (registry.separator !== ".") fail("separator must be dot");
  if (registry.keyFormat !== "namespace.section.name") {
    fail("keyFormat must be namespace.section.name");
  }
  if (!Array.isArray(registry.keys) || registry.keys.length < 4) {
    fail("keys must be a non-empty architecture seed with at least four identifiers");
  }

  const unique = new Set(registry.keys);
  if (unique.size !== registry.keys.length) fail("translation keys must be unique");

  const sorted = [...registry.keys].sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(sorted) !== JSON.stringify(registry.keys)) {
    fail("translation keys must be stored in deterministic lexicographic order");
  }

  const namespaces = new Set();
  for (const key of registry.keys) {
    if (typeof key !== "string") fail("every translation key must be a string");
    if (key.length > MAX_KEY_LENGTH) fail(`translation key exceeds ${MAX_KEY_LENGTH} characters: ${key}`);
    if (!KEY_PATTERN.test(key)) fail(`invalid translation key syntax: ${key}`);
    if (/^(bg|en)\./i.test(key) || /(?:bg-BG|en-US)/i.test(key)) {
      fail(`translation key must be locale-neutral: ${key}`);
    }
    if (/\s/.test(key)) fail(`translation key must not contain whitespace: ${key}`);
    namespaces.add(key.split(".")[0]);
  }

  if (namespaces.size < 4) {
    fail("architecture seed must demonstrate at least four independent namespaces");
  }

  for (const token of [
    "TRANSLATION_KEY_MODEL_VERSION",
    "TRANSLATION_KEY_SEPARATOR",
    "TRANSLATION_KEY_PATTERN",
    "export type TranslationKey",
    "export function isTranslationKey",
    "export function assertTranslationKey",
    "export function translationKeySegments"
  ]) {
    if (!source.includes(token)) fail(`generic TypeScript contract missing token: ${token}`);
  }

  if (!source.includes("value.length <= 120")) {
    fail("generic TypeScript contract must enforce the 120-character bound");
  }
  if (/bg-BG|en-US|Europe\/Sofia|Bulgaria|България/.test(source)) {
    fail("generic TypeScript contract must not contain concrete locale/country markers");
  }
  if (!indexSource.includes('export * from "./translation-key";')) {
    fail("translation-key contract must be exported from @enchev/config");
  }

  for (const token of [
    "locale-neutral",
    "21.16 Locale fallback chain",
    "21.19 Translation completeness checks",
    "stable identifiers",
    "must not be prefixed by a locale code"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }

  return true;
}

function expectRejected(label, mutate) {
  const registry = loadRegistry();
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
  const docSource = fs.readFileSync(DOC_PATH, "utf8");
  let rejected = false;

  try {
    validateRegistry(mutate(structuredClone(registry)), source, indexSource, docSource);
  } catch {
    rejected = true;
  }

  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const registry = loadRegistry();
const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");
validateRegistry(registry, source, indexSource, docSource);

if (process.argv.includes("--self-test")) {
  expectRejected("schema version drift", (x) => ({ ...x, schemaVersion: 2 }));
  expectRejected("wrong separator", (x) => ({ ...x, separator: "_" }));
  expectRejected("duplicate key", (x) => ({ ...x, keys: [...x.keys, x.keys[0]] }));
  expectRejected("unsorted registry", (x) => ({ ...x, keys: [...x.keys].reverse() }));
  expectRejected("too few segments", (x) => ({ ...x, keys: [...x.keys.slice(0, -1), "common.confirm"] }));
  expectRejected("uppercase-leading segment", (x) => ({ ...x, keys: [...x.keys.slice(0, -1), "Common.actions.confirm"] }));
  expectRejected("whitespace in key", (x) => ({ ...x, keys: [...x.keys.slice(0, -1), "common.actions.confirm now"] }));
  expectRejected("locale-prefixed key", (x) => ({ ...x, keys: [...x.keys.slice(0, -1), "en.common.actions"] }));
  expectRejected("locale-tag key", (x) => ({ ...x, keys: [...x.keys.slice(0, -1), "common.en-US.confirm"] }));
  expectRejected("message catalog smuggled into registry", (x) => ({ ...x, messages: { "common.actions.confirm": "Confirm" } }));
  expectRejected("key length overflow", (x) => ({ ...x, keys: [...x.keys.slice(0, -1), `common.section.${"a".repeat(130)}`] }));

  console.log("TRANSLATION_KEY_ARCHITECTURE_SELF_TEST PASS negative_cases=11 namespaces>=4 locale_neutral=true stable_sorted_unique=true");
} else {
  console.log(`TRANSLATION_KEY_ARCHITECTURE PASS task=21.07 keys=${registry.keys.length} namespaces=${new Set(registry.keys.map((key) => key.split(".")[0])).size} locale_neutral=true`);
}

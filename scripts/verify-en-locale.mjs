import fs from "node:fs";

const RESOURCE_PATH = "locales/en.json";
const BG_RESOURCE_PATH = "locales/bg.json";
const DOC_PATH = "docs/21_06_EN_LOCALE.md";

const ALLOWED_KEYS = [
  "schemaVersion",
  "locale",
  "language",
  "script",
  "region",
  "direction",
  "nativeName",
  "englishName"
];

const FORBIDDEN_KEYS = new Set([
  "messages",
  "translations",
  "dictionary",
  "keys",
  "fallback",
  "fallbackLocale",
  "timeZone",
  "countryCode",
  "phonePrefix",
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
  throw new Error(`EN_LOCALE FAIL: ${message}`);
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function validateEnLocale(resource, bgResource, docSource) {
  if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
    fail("locale resource must be an object");
  }
  if (!bgResource || typeof bgResource !== "object" || Array.isArray(bgResource)) {
    fail("BG locale dependency must be an object");
  }

  const keys = sortedKeys(resource);
  const expectedKeys = [...ALLOWED_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    fail(`resource keys drift: expected ${expectedKeys.join(", ")} got ${keys.join(", ")}`);
  }

  const bgKeys = sortedKeys(bgResource);
  if (JSON.stringify(keys) !== JSON.stringify(bgKeys)) {
    fail("EN locale schema must stay in parity with completed BG locale registration");
  }

  for (const key of Object.keys(resource)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`forbidden locale-resource field present: ${key}`);
  }

  if (resource.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (resource.schemaVersion !== bgResource.schemaVersion) fail("schemaVersion must match BG locale");
  if (resource.locale !== "en-US") fail("locale must be canonical en-US");
  if (resource.language !== "en") fail("language must be en");
  if (resource.script !== "Latn") fail("script must be Latn");
  if (resource.region !== "US") fail("region must be US");
  if (resource.direction !== "ltr") fail("direction must be ltr");
  if (resource.nativeName !== "English") fail("nativeName must be English");
  if (resource.englishName !== "English") fail("englishName must be English");

  if (resource.locale === bgResource.locale) fail("EN locale must be distinct from BG locale");
  if (resource.language === bgResource.language) fail("EN language must be distinct from BG language");

  const canonical = Intl.getCanonicalLocales(resource.locale);
  if (canonical.length !== 1 || canonical[0] !== resource.locale) {
    fail("locale must already be canonical according to Intl");
  }

  const locale = new Intl.Locale(resource.locale).maximize();
  if (locale.language !== resource.language) fail("Intl language metadata mismatch");
  if (locale.script !== resource.script) fail("Intl script metadata mismatch");
  if (locale.region !== resource.region) fail("Intl region metadata mismatch");

  for (const [name, ctor] of [
    ["DateTimeFormat", Intl.DateTimeFormat],
    ["NumberFormat", Intl.NumberFormat],
    ["PluralRules", Intl.PluralRules]
  ]) {
    if (ctor.supportedLocalesOf([resource.locale]).length !== 1) {
      fail(`Intl.${name} does not support ${resource.locale}`);
    }
  }

  if (!/^[A-Za-z ]+$/.test(resource.nativeName)) {
    fail("nativeName must use Latin letters for the English locale");
  }

  for (const token of [
    "21.07 Translation key architecture",
    "locale registration only",
    "same locale-registration schema",
    "must not contain",
    "not a CountryProfile"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }

  return true;
}

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function expectRejected(label, mutate) {
  const resource = loadJson(RESOURCE_PATH);
  const bgResource = loadJson(BG_RESOURCE_PATH);
  const docSource = fs.readFileSync(DOC_PATH, "utf8");
  let rejected = false;
  try {
    validateEnLocale(mutate(structuredClone(resource)), bgResource, docSource);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const resource = loadJson(RESOURCE_PATH);
const bgResource = loadJson(BG_RESOURCE_PATH);
const docSource = fs.readFileSync(DOC_PATH, "utf8");
validateEnLocale(resource, bgResource, docSource);

if (process.argv.includes("--self-test")) {
  expectRejected("wrong locale", (x) => ({ ...x, locale: "bg-BG" }));
  expectRejected("wrong language", (x) => ({ ...x, language: "bg" }));
  expectRejected("wrong script", (x) => ({ ...x, script: "Cyrl" }));
  expectRejected("wrong direction", (x) => ({ ...x, direction: "rtl" }));
  expectRejected("translation catalog smuggled into locale", (x) => ({ ...x, messages: { hello: "Hello" } }));
  expectRejected("timezone smuggled into locale", (x) => ({ ...x, timeZone: "Etc/UTC" }));
  expectRejected("schema version drift", (x) => ({ ...x, schemaVersion: 2 }));
  expectRejected("schema parity drift", (x) => {
    const copy = { ...x };
    delete copy.englishName;
    return copy;
  });

  console.log("EN_LOCALE_SELF_TEST PASS negative_cases=8 intl_date_number_plural=true bg_schema_parity=true translation_catalog_absent=true");
} else {
  console.log("EN_LOCALE PASS task=21.06 locale=en-US language=en script=Latn direction=ltr intl_supported=true bg_schema_parity=true");
}

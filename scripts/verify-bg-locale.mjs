import fs from "node:fs";

const RESOURCE_PATH = "locales/bg.json";
const DOC_PATH = "docs/21_05_BG_LOCALE.md";

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
  throw new Error(`BG_LOCALE FAIL: ${message}`);
}

function validateBgLocale(resource, docSource) {
  if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
    fail("locale resource must be an object");
  }

  const keys = Object.keys(resource).sort();
  const expectedKeys = [...ALLOWED_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    fail(`resource keys drift: expected ${expectedKeys.join(", ")} got ${keys.join(", ")}`);
  }

  for (const key of Object.keys(resource)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`forbidden locale-resource field present: ${key}`);
  }

  if (resource.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (resource.locale !== "bg-BG") fail("locale must be canonical bg-BG");
  if (resource.language !== "bg") fail("language must be bg");
  if (resource.script !== "Cyrl") fail("script must be Cyrl");
  if (resource.region !== "BG") fail("region must be BG");
  if (resource.direction !== "ltr") fail("direction must be ltr");
  if (resource.nativeName !== "Български") fail("nativeName must be Български");
  if (resource.englishName !== "Bulgarian") fail("englishName must be Bulgarian");

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

  const cyrillicLetters = resource.nativeName.match(/[А-Яа-я]/g) || [];
  if (cyrillicLetters.length < 5) fail("nativeName must contain Bulgarian Cyrillic text");

  for (const token of [
    "21.07 Translation key architecture",
    "locale registration only",
    "must not contain",
    "not a CountryProfile"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }

  return true;
}

function loadResource() {
  return JSON.parse(fs.readFileSync(RESOURCE_PATH, "utf8"));
}

function expectRejected(label, mutate) {
  const resource = loadResource();
  const docSource = fs.readFileSync(DOC_PATH, "utf8");
  let rejected = false;
  try {
    validateBgLocale(mutate(structuredClone(resource)), docSource);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const resource = loadResource();
const docSource = fs.readFileSync(DOC_PATH, "utf8");
validateBgLocale(resource, docSource);

if (process.argv.includes("--self-test")) {
  expectRejected("wrong locale", (x) => ({ ...x, locale: "en-US" }));
  expectRejected("wrong language", (x) => ({ ...x, language: "en" }));
  expectRejected("wrong script", (x) => ({ ...x, script: "Latn" }));
  expectRejected("wrong direction", (x) => ({ ...x, direction: "rtl" }));
  expectRejected("translation catalog smuggled into locale", (x) => ({ ...x, messages: { hello: "Здравей" } }));
  expectRejected("timezone smuggled into locale", (x) => ({ ...x, timeZone: "Europe/Sofia" }));
  expectRejected("schema version drift", (x) => ({ ...x, schemaVersion: 2 }));

  console.log("BG_LOCALE_SELF_TEST PASS negative_cases=7 intl_date_number_plural=true translation_catalog_absent=true");
} else {
  console.log("BG_LOCALE PASS task=21.05 locale=bg-BG language=bg script=Cyrl direction=ltr intl_supported=true");
}

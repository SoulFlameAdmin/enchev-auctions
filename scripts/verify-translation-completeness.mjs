import fs from "node:fs";
import path from "node:path";

const LOCALES_DIR = "locales";
const REGISTRY_PATH = path.join(LOCALES_DIR, "translation-keys.json");
const MESSAGES_DIR = path.join(LOCALES_DIR, "messages");
const DOC_PATH = "docs/21_19_TRANSLATION_COMPLETENESS_CHECKS.md";

function fail(message) {
  throw new Error(`TRANSLATION_COMPLETENESS FAIL: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function assertSortedUnique(values, label) {
  if (!Array.isArray(values) || values.length === 0) fail(`${label} must be a non-empty array`);
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(values) !== JSON.stringify(sorted)) fail(`${label} must be sorted`);
  if (new Set(values).size !== values.length) fail(`${label} must be unique`);
}

function verifyDataset(registry, localeEntries, catalogs) {
  if (!isRecord(registry) || registry.schemaVersion !== 1) fail("translation key registry schemaVersion must be 1");
  assertSortedUnique(registry.keys, "translation registry keys");

  const registryKeys = registry.keys;
  const localeSet = new Set();

  if (!Array.isArray(localeEntries) || localeEntries.length === 0) fail("at least one locale metadata record is required");

  for (const entry of localeEntries) {
    const metadata = entry.metadata;
    if (!isRecord(metadata) || typeof metadata.locale !== "string") fail(`invalid locale metadata: ${entry.file}`);

    let canonicalLocale;
    try {
      [canonicalLocale] = Intl.getCanonicalLocales(metadata.locale);
    } catch {
      fail(`invalid locale identifier: ${metadata.locale}`);
    }
    if (canonicalLocale !== metadata.locale) fail(`locale metadata must use canonical locale: ${metadata.locale}`);
    if (localeSet.has(metadata.locale)) fail(`duplicate locale metadata: ${metadata.locale}`);
    localeSet.add(metadata.locale);

    const catalog = catalogs.get(metadata.locale);
    if (!catalog) fail(`missing message catalog for ${metadata.locale}`);
    if (!isRecord(catalog) || catalog.schemaVersion !== 1) fail(`catalog schemaVersion must be 1 for ${metadata.locale}`);
    if (catalog.locale !== metadata.locale) fail(`catalog locale mismatch for ${metadata.locale}`);
    if (!isRecord(catalog.messages)) fail(`catalog messages must be an object for ${metadata.locale}`);

    const catalogKeys = Object.keys(catalog.messages);
    assertSortedUnique(catalogKeys, `${metadata.locale} catalog keys`);

    const missing = registryKeys.filter((key) => !Object.prototype.hasOwnProperty.call(catalog.messages, key));
    const extra = catalogKeys.filter((key) => !registryKeys.includes(key));
    if (missing.length > 0) fail(`${metadata.locale} missing keys: ${missing.join(", ")}`);
    if (extra.length > 0) fail(`${metadata.locale} extra keys: ${extra.join(", ")}`);
    if (catalogKeys.length !== registryKeys.length) fail(`${metadata.locale} key count mismatch`);

    for (const key of registryKeys) {
      const message = catalog.messages[key];
      if (typeof message !== "string" || message.trim().length === 0) fail(`${metadata.locale} blank message: ${key}`);
      if (hasUnpairedSurrogate(message)) fail(`${metadata.locale} malformed Unicode message: ${key}`);
      if (message.normalize("NFC") !== message) fail(`${metadata.locale} message is not NFC-normalized: ${key}`);
    }
  }

  if (catalogs.size !== localeSet.size) {
    const unknown = [...catalogs.keys()].filter((locale) => !localeSet.has(locale));
    if (unknown.length > 0) fail(`catalog exists without registered locale metadata: ${unknown.join(", ")}`);
  }

  return {
    locales: localeSet.size,
    keys: registryKeys.length,
    messages: localeSet.size * registryKeys.length
  };
}

function loadDataset() {
  const registry = readJson(REGISTRY_PATH);
  const metadataFiles = fs.readdirSync(LOCALES_DIR)
    .filter((file) => file.endsWith(".json") && file !== "translation-keys.json")
    .sort((a, b) => a.localeCompare(b));

  const localeEntries = metadataFiles.map((file) => ({
    file,
    metadata: readJson(path.join(LOCALES_DIR, file))
  }));

  const catalogs = new Map();
  for (const entry of localeEntries) {
    const locale = entry.metadata?.locale;
    if (typeof locale !== "string") continue;
    const catalogPath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(catalogPath)) continue;
    catalogs.set(locale, readJson(catalogPath));
  }

  if (fs.existsSync(MESSAGES_DIR)) {
    for (const file of fs.readdirSync(MESSAGES_DIR).filter((name) => name.endsWith(".json"))) {
      const catalog = readJson(path.join(MESSAGES_DIR, file));
      if (typeof catalog?.locale === "string" && !catalogs.has(catalog.locale)) {
        catalogs.set(catalog.locale, catalog);
      }
    }
  }

  return { registry, localeEntries, catalogs };
}

function cloneDataset(dataset) {
  return {
    registry: structuredClone(dataset.registry),
    localeEntries: structuredClone(dataset.localeEntries),
    catalogs: new Map([...dataset.catalogs.entries()].map(([locale, catalog]) => [locale, structuredClone(catalog)]))
  };
}

const doc = fs.readFileSync(DOC_PATH, "utf8");
for (const token of [
  "missing keys are rejected",
  "extra/unknown keys are rejected",
  "well-formed Unicode and NFC-normalized",
  "21.16 locale fallback remains separate",
  "21.20",
  "does not require Vercel create/update/redeploy"
]) {
  if (!doc.includes(token)) fail(`documentation boundary missing: ${token}`);
}

const dataset = loadDataset();
const summary = verifyDataset(dataset.registry, dataset.localeEntries, dataset.catalogs);

if (process.argv.includes("--self-test")) {
  const cases = [];

  {
    const mutated = cloneDataset(dataset);
    const [locale, catalog] = mutated.catalogs.entries().next().value;
    delete catalog.messages[mutated.registry.keys[0]];
    cases.push(["missing key", mutated]);
  }
  {
    const mutated = cloneDataset(dataset);
    const [, catalog] = mutated.catalogs.entries().next().value;
    catalog.messages["unknown.section.key"] = "unexpected";
    cases.push(["extra key", mutated]);
  }
  {
    const mutated = cloneDataset(dataset);
    const [, catalog] = mutated.catalogs.entries().next().value;
    catalog.messages[mutated.registry.keys[0]] = "   ";
    cases.push(["blank message", mutated]);
  }
  {
    const mutated = cloneDataset(dataset);
    const [, catalog] = mutated.catalogs.entries().next().value;
    catalog.messages[mutated.registry.keys[0]] = "Jose\u0301";
    cases.push(["non-NFC message", mutated]);
  }
  {
    const mutated = cloneDataset(dataset);
    const [locale, catalog] = mutated.catalogs.entries().next().value;
    catalog.locale = locale === "bg-BG" ? "en-US" : "bg-BG";
    cases.push(["catalog locale mismatch", mutated]);
  }

  for (const [label, mutated] of cases) {
    let rejected = false;
    try {
      verifyDataset(mutated.registry, mutated.localeEntries, mutated.catalogs);
    } catch {
      rejected = true;
    }
    if (!rejected) fail(`negative self-test did not reject ${label}`);
  }

  console.log(`TRANSLATION_COMPLETENESS_SELF_TEST PASS negative_cases=${cases.length} locales=${summary.locales} keys=${summary.keys} messages=${summary.messages}`);
} else {
  console.log(`TRANSLATION_COMPLETENESS PASS task=21.19 locales=${summary.locales} keys=${summary.keys} messages=${summary.messages} exact_parity=true unicode_well_formed=true nfc=true fallback_substitute=false`);
}

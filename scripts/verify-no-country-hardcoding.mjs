import fs from "node:fs";
import path from "node:path";

const ROOTS = [
  "packages/domain/src",
  "packages/contracts/src",
  "packages/config/src",
  "packages/providers/src",
  "apps/api",
  "apps/realtime",
  "apps/worker",
  "app/api",
  "supabase/functions",
  "supabase/migrations"
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sql"]);

const RULES = [
  {
    id: "literal-country-code-assignment",
    pattern: /\bcountryCode\s*:\s*["'`][A-Z]{2}["'`]/g
  },
  {
    id: "literal-default-locale-assignment",
    pattern: /\bdefaultLocale\s*:\s*["'`][^"'`]+["'`]/g
  },
  {
    id: "literal-supported-locales-assignment",
    pattern: /\bsupportedLocales\s*:\s*\[[^\]]*["'`][^"'`]+["'`]/g
  },
  {
    id: "literal-timezone-assignment",
    pattern: /\btimeZone\s*:\s*["'`][^"'`]+["'`]/g
  },
  {
    id: "literal-country-branch",
    pattern: /\b(?:countryCode|country|locale|defaultLocale|timeZone)\s*(?:===|!==|==|!=)\s*["'`][^"'`]+["'`]/g
  },
  {
    id: "launch-country-name",
    pattern: /\bBulgaria\b|България/g
  },
  {
    id: "launch-country-timezone",
    pattern: /Europe\/Sofia/g
  },
  {
    id: "launch-country-locale",
    pattern: /\bbg-BG\b/g
  },
  {
    id: "launch-country-phone-prefix",
    pattern: /\+359\b/g
  }
];

function fail(message) {
  throw new Error(`NO_COUNTRY_HARDCODING FAIL: ${message}`);
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return SOURCE_EXTENSIONS.has(path.extname(root)) ? [root] : [];

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function scanSource(file, source) {
  const violations = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(source)) !== null) {
      const before = source.slice(0, match.index);
      const line = before.split("\n").length;
      violations.push({
        file,
        line,
        rule: rule.id,
        excerpt: match[0]
      });
      if (match.index === rule.pattern.lastIndex) rule.pattern.lastIndex += 1;
    }
  }
  return violations;
}

function scanRepository() {
  const files = ROOTS.flatMap(walkFiles);
  const violations = [];
  for (const file of files) {
    violations.push(...scanSource(file, fs.readFileSync(file, "utf8")));
  }
  return { files, violations };
}

if (process.argv.includes("--self-test")) {
  const fixtures = [
    ["country code", 'const x = { countryCode: "BG" };'],
    ["default locale", 'const x = { defaultLocale: "bg-BG" };'],
    ["supported locales", 'const x = { supportedLocales: ["bg-BG"] };'],
    ["timezone", 'const x = { timeZone: "Europe/Sofia" };'],
    ["literal branch", 'if (countryCode === "BG") enableRule();'],
    ["country name", 'const launchCountry = "Bulgaria";'],
    ["phone prefix", 'const prefix = "+359";']
  ];

  for (const [label, source] of fixtures) {
    const violations = scanSource(`self-test/${label}.ts`, source);
    if (violations.length === 0) fail(`self-test did not reject ${label}`);
  }

  const neutral = [
    "export function resolveCountry(profile) { return profile.countryCode; }",
    "const zone = profile.timeZone;",
    "const locales = profile.supportedLocales;",
    'if (typeof countryCode !== "string") throw new Error("invalid");'
  ].join("\n");

  if (scanSource("self-test/neutral.ts", neutral).length !== 0) {
    fail("self-test rejected country-neutral runtime code");
  }

  console.log(`NO_COUNTRY_HARDCODING_SELF_TEST PASS rejected=${fixtures.length} neutral_pass=true`);
  process.exit(0);
}

const { files, violations } = scanRepository();
if (files.length === 0) fail("no guarded runtime files were discovered");

if (violations.length > 0) {
  const details = violations
    .map((item) => `${item.file}:${item.line} [${item.rule}] ${item.excerpt}`)
    .join("\n");
  fail(`country-specific literals found in guarded runtime surfaces:\n${details}`);
}

console.log(`NO_COUNTRY_HARDCODING PASS task=21.02 files=${files.length} roots=${ROOTS.length} country_neutral_core=true`);

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_PATH = "packages/config/src/rtl-layout-capability.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const PAGE_PATH = "app/rtl-capability/page.tsx";
const CSS_PATH = "app/rtl-capability/rtl-capability.module.css";
const DOC_PATH = "docs/21_17_RTL_LAYOUT_CAPABILITY.md";

function fail(message) {
  throw new Error(`RTL_LAYOUT_CAPABILITY FAIL: ${message}`);
}

function verifySourceContract(source, indexSource, pageSource, cssSource, docSource) {
  if (!indexSource.includes('export * from "./rtl-layout-capability";')) {
    fail("packages/config public entrypoint must export rtl-layout-capability");
  }

  for (const token of ["process.env", "Deno.env", "VERCEL_OIDC_TOKEN"]) {
    if (source.includes(token)) fail(`runtime/secret token forbidden: ${token}`);
  }

  for (const token of [
    "RTL_LAYOUT_CAPABILITY_MODEL_VERSION = 1",
    'export type LayoutDirection = "ltr" | "rtl"',
    "export function resolveLayoutDirection",
    "export function layoutDirectionAttributes",
    "Intl.getCanonicalLocales",
    "direction must be ltr or rtl"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  if (/["'`](?:ar|he|fa|ur|ps|dv|yi)(?:-[A-Za-z0-9]+)*["'`]/.test(source)) {
    fail("core RTL contract must not hardcode a specific RTL locale");
  }

  for (const token of [
    "data-rtl-capability-page",
    'data-rtl-probe={direction}',
    "RTL capability fixture failed to resolve"
  ]) {
    if (!pageSource.includes(token)) fail(`RTL acceptance page missing token: ${token}`);
  }

  for (const token of [
    "padding-inline",
    "margin-inline",
    "border-inline-start",
    "inset-inline-start",
    "text-align:start",
    "min-inline-size"
  ]) {
    if (!cssSource.includes(token)) fail(`logical CSS capability missing: ${token}`);
  }

  for (const property of [
    "margin-left","margin-right","padding-left","padding-right","border-left","border-right"
  ]) {
    if (cssSource.includes(property)) {
      fail(`RTL acceptance CSS must not use physical inline property: ${property}`);
    }
  }

  for (const token of [
    "identical layout markup twice",
    "not a production locale",
    "does not claim that every legacy component",
    "does not require a Vercel create/update/redeploy operation"
  ]) {
    if (!docSource.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-rtl-layout-"));
  try {
    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [
      tscPath,
      SOURCE_PATH,
      "--ignoreConfig",
      "--target","ES2022",
      "--module","ES2022",
      "--moduleResolution","Bundler",
      "--skipLibCheck",
      "--outDir",tempDir,
      "--pretty","false"
    ], { encoding:"utf8" });

    if (result.status !== 0) {
      fail(`TypeScript compile failed: ${(result.stderr || result.stdout || "").trim()}`);
    }

    const compiled = path.join(tempDir, "rtl-layout-capability.js");
    if (!fs.existsSync(compiled)) fail("compiled RTL runtime module missing");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive:true, force:true });
  }
}

const source = fs.readFileSync(SOURCE_PATH,"utf8");
const indexSource = fs.readFileSync(INDEX_PATH,"utf8");
const pageSource = fs.readFileSync(PAGE_PATH,"utf8");
const cssSource = fs.readFileSync(CSS_PATH,"utf8");
const docSource = fs.readFileSync(DOC_PATH,"utf8");

verifySourceContract(source,indexSource,pageSource,cssSource,docSource);

const runtime = await loadRuntime();
if (runtime.RTL_LAYOUT_CAPABILITY_MODEL_VERSION !== 1) fail("runtime model version drift");
if (typeof runtime.resolveLayoutDirection !== "function") fail("runtime resolver missing");
if (typeof runtime.layoutDirectionAttributes !== "function") fail("runtime attribute helper missing");

const ltr = runtime.resolveLayoutDirection({ locale:"und", direction:"ltr" });
const rtl = runtime.resolveLayoutDirection({ locale:"und", direction:"rtl" });
if (!ltr.ok || ltr.value.direction !== "ltr") fail("LTR fixture rejected");
if (!rtl.ok || rtl.value.direction !== "rtl") fail("RTL fixture rejected");

const attrs = runtime.layoutDirectionAttributes({ locale:"und", direction:"rtl" });
if (!attrs || attrs.lang !== "und" || attrs.dir !== "rtl") fail("attribute helper drift");

for (const [label, fixture] of [
  ["non-object",null],
  ["invalid direction",{locale:"und",direction:"auto"}],
  ["invalid locale",{locale:"not_a_locale",direction:"rtl"}],
  ["empty locale",{locale:"",direction:"rtl"}],
  ["extra field",{locale:"und",direction:"rtl",countryCode:"ZZ"}]
]) {
  const result = runtime.resolveLayoutDirection(fixture);
  if (result.ok) fail(`invalid fixture accepted: ${label}`);
}

if (process.argv.includes("--self-test")) {
  let rejected = false;
  try { verifySourceContract(source + "\nconst x=process.env.SECRET;\n",indexSource,pageSource,cssSource,docSource); } catch { rejected = true; }
  if (!rejected) fail("source guard did not reject env access");

  rejected = false;
  try { verifySourceContract(source + '\nconst x="ar";\n',indexSource,pageSource,cssSource,docSource); } catch { rejected = true; }
  if (!rejected) fail("source guard did not reject hardcoded RTL locale");

  rejected = false;
  try { verifySourceContract(source,indexSource,pageSource,cssSource + "\n.x{margin-left:1px}\n",docSource); } catch { rejected = true; }
  if (!rejected) fail("CSS guard did not reject physical inline property");

  rejected = false;
  try { verifySourceContract(source,indexSource.replace('export * from "./rtl-layout-capability";',""),pageSource,cssSource,docSource); } catch { rejected = true; }
  if (!rejected) fail("source guard did not reject missing public export");

  console.log("RTL_LAYOUT_CAPABILITY_SELF_TEST PASS runtime_negative_cases=5 source_negative_cases=4 directions=ltr+rtl logical_css=true");
} else {
  console.log("RTL_LAYOUT_CAPABILITY PASS task=21.17 model_version=1 directions=ltr+rtl logical_css=true browser_fixture=/rtl-capability");
}

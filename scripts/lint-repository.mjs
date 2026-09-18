import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOTS = ["app", "scripts", "tools/david"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs"]);
const CONFLICT_PATTERN = /^(<{7}|={7}|>{7})(?:\s|$)/m;

function fail(message) {
  throw new Error(`REPOSITORY_LINT FAIL: ${message}`);
}

function collect(root, out = []) {
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((root) => collect(root)).sort();
if (!files.length) fail("no source files found");

let moduleSyntaxChecks = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("\0")) fail(`${file} contains a NUL byte`);
  if (CONFLICT_PATTERN.test(source)) fail(`${file} contains a merge-conflict marker`);
  if (/^\s*\/\/\s*@ts-nocheck\b/m.test(source)) fail(`${file} disables TypeScript checking with @ts-nocheck`);

  if (path.extname(file) === ".mjs") {
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (check.status !== 0) {
      fail(`${file} has invalid JavaScript syntax: ${(check.stderr || check.stdout || "").trim()}`);
    }
    moduleSyntaxChecks += 1;
  }
}

console.log(`REPOSITORY_LINT PASS files=${files.length} module_syntax_checks=${moduleSyntaxChecks}`);

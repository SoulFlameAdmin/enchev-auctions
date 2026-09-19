import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = "config/enchev-architecture-decisions.json";

function fail(message) {
  throw new Error(`ARCHITECTURE_DECISION_RECORDS FAIL: ${message}`);
}

export function validateAdrStructure(config, fsApi = fs) {
  if (config.task !== "02.10") fail("task must be 02.10");
  if (config.adr_root !== "docs/adr") fail("ADR root drift");
  if (config.naming !== "NNNN-kebab-case.md") fail("ADR naming contract drift");
  if (config.implementation_state !== "structure-established") fail("implementation_state drift");
  if (config.append_only !== true) fail("ADR history must be append-only");

  const allowed = new Set(config.status_values || []);
  for (const status of ["Proposed","Accepted","Deprecated","Superseded"]) {
    if (!allowed.has(status)) fail(`missing allowed status ${status}`);
  }

  const requiredSections = ["Status","Context","Decision","Consequences"];
  if (JSON.stringify(config.required_sections) !== JSON.stringify(requiredSections)) {
    fail("required section contract drift");
  }

  for (const requiredFile of [config.index, config.template]) {
    if (!fsApi.existsSync(requiredFile)) fail(`required ADR file missing: ${requiredFile}`);
  }

  const entries = fsApi.readdirSync(config.adr_root)
    .filter((name) => /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(name))
    .sort();

  if (!entries.includes("0000-template.md")) fail("ADR template filename missing");
  const decisions = entries.filter((name) => name !== "0000-template.md");
  if (decisions.length < 1) fail("at least one concrete ADR is required");

  const seenNumbers = new Set();
  for (const name of decisions) {
    const number = name.slice(0,4);
    if (seenNumbers.has(number)) fail(`duplicate ADR number ${number}`);
    seenNumbers.add(number);

    const content = fsApi.readFileSync(path.join(config.adr_root, name), "utf8");
    if (!content.startsWith(`# ADR ${number}:`)) fail(`title number mismatch in ${name}`);

    for (const section of requiredSections) {
      if (!content.includes(`## ${section}\n`)) fail(`missing section ${section} in ${name}`);
    }

    const statusMatch = content.match(/## Status\n\n([^\n]+)/);
    if (!statusMatch || !allowed.has(statusMatch[1].trim())) {
      fail(`invalid or missing status in ${name}`);
    }
  }

  const index = fsApi.readFileSync(config.index, "utf8");
  for (const name of decisions) {
    if (!index.includes(`./${name}`)) fail(`ADR index missing ${name}`);
  }

  const template = fsApi.readFileSync(config.template, "utf8");
  for (const section of requiredSections) {
    if (!template.includes(`## ${section}\n`)) fail(`template missing section ${section}`);
  }

  return true;
}

function load() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function expectRejected(label, mutate) {
  const config = structuredClone(load());
  let rejected = false;
  try {
    validateAdrStructure(mutate(config));
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

validateAdrStructure(load());

if (process.argv.includes("--self-test")) {
  expectRejected("wrong frozen task", (x) => ({ ...x, task: "02.09" }));
  expectRejected("append-only disabled", (x) => ({ ...x, append_only: false }));
  expectRejected("ADR root drift", (x) => ({ ...x, adr_root: "docs/decisions" }));
  expectRejected("status contract missing Accepted", (x) => ({ ...x, status_values: x.status_values.filter((s) => s !== "Accepted") }));
  expectRejected("required sections drift", (x) => ({ ...x, required_sections: ["Status","Context","Decision"] }));
  expectRejected("index path drift", (x) => ({ ...x, index: "docs/adr/MISSING.md" }));
  console.log("ARCHITECTURE_DECISION_RECORDS_SELF_TEST PASS negative_cases=6");
} else {
  console.log("ARCHITECTURE_DECISION_RECORDS PASS root=docs/adr append_only=true");
}

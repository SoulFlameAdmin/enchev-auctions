import { readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/sbom.yml";
const ARTIFACT = "artifacts/enchev-sbom.cdx.json";

export function verifyWorkflow(text) {
  const required = [
    ["pull_request trigger", "pull_request:"],
    ["push trigger", "push:"],
    ["main branch", "branches: [main]"],
    ["read-only contents permission", "contents: read"],
    ["Node 24", "node-version: '24'"],
    ["npm sbom", "npm sbom"],
    ["package-lock-only", "--package-lock-only"],
    ["CycloneDX format", "--sbom-format=cyclonedx"],
    ["application type", "--sbom-type=application"],
    ["artifact path", ARTIFACT],
    ["artifact validation", `node scripts/verify-sbom-generation.mjs --file ${ARTIFACT}`],
    ["artifact upload", "uses: actions/upload-artifact@v4"],
    ["exact-head artifact name", "enchev-sbom-${{ github.sha }}"],
    ["fail if artifact absent", "if-no-files-found: error"]
  ];
  const missing = required.filter(([, token]) => !text.includes(token)).map(([name]) => name);
  if (missing.length) throw new Error(`26.12 SBOM_WORKFLOW FAIL missing=${missing.join(",")}`);
  return required.length;
}

export function verifySbom(sbom) {
  const failures = [];
  if (!sbom || typeof sbom !== "object") failures.push("document");
  if (sbom?.bomFormat !== "CycloneDX") failures.push("bomFormat");
  if (typeof sbom?.specVersion !== "string" || !/^1\.[4-9]$/.test(sbom.specVersion)) failures.push("specVersion");
  if (sbom?.metadata?.component?.name !== "enchev-auctions") failures.push("root-name");
  if (sbom?.metadata?.component?.type !== "application") failures.push("root-type");
  if (!Array.isArray(sbom?.components) || sbom.components.length === 0) failures.push("components");
  if (failures.length) throw new Error(`26.12 SBOM_ARTIFACT FAIL fields=${failures.join(",")}`);
  return sbom.components.length;
}

function runSelfTest() {
  const goodWorkflow = [
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    branches: [main]",
    "permissions:",
    "  contents: read",
    "steps:",
    "  - uses: actions/setup-node@v4",
    "    with:",
    "      node-version: '24'",
    `  - run: mkdir -p artifacts && npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application > ${ARTIFACT}`,
    `  - run: node scripts/verify-sbom-generation.mjs --file ${ARTIFACT}`,
    "  - uses: actions/upload-artifact@v4",
    "    with:",
    "      name: enchev-sbom-${{ github.sha }}",
    `      path: ${ARTIFACT}`,
    "      if-no-files-found: error"
  ].join("\n");
  verifyWorkflow(goodWorkflow);

  const goodSbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    metadata: { component: { type: "application", name: "enchev-auctions", version: "0.1.0" } },
    components: [{ type: "library", name: "example-dependency", version: "1.0.0" }]
  };
  verifySbom(goodSbom);

  const workflowMutations = [
    goodWorkflow.replace("--package-lock-only", ""),
    goodWorkflow.replace("--sbom-format=cyclonedx", "--sbom-format=spdx"),
    goodWorkflow.replace("--sbom-type=application", "--sbom-type=library"),
    goodWorkflow.replace("actions/upload-artifact@v4", "actions/upload-artifact@v3"),
    goodWorkflow.replace("if-no-files-found: error", "if-no-files-found: warn")
  ];
  let rejectedWorkflow = 0;
  for (const sample of workflowMutations) {
    try { verifyWorkflow(sample); } catch { rejectedWorkflow += 1; }
  }

  const sbomMutations = [
    { ...goodSbom, bomFormat: "SPDX" },
    { ...goodSbom, specVersion: "0.1" },
    { ...goodSbom, metadata: { component: { ...goodSbom.metadata.component, name: "wrong" } } },
    { ...goodSbom, metadata: { component: { ...goodSbom.metadata.component, type: "library" } } },
    { ...goodSbom, components: [] }
  ];
  let rejectedSbom = 0;
  for (const sample of sbomMutations) {
    try { verifySbom(sample); } catch { rejectedSbom += 1; }
  }

  if (rejectedWorkflow !== workflowMutations.length || rejectedSbom !== sbomMutations.length) {
    throw new Error(`26.12 SBOM SELF_TEST FAIL workflow=${rejectedWorkflow}/${workflowMutations.length} artifact=${rejectedSbom}/${sbomMutations.length}`);
  }
  console.log(`26.12 SBOM SELF_TEST PASS workflow=${rejectedWorkflow} artifact=${rejectedSbom}`);
}

const fileIndex = process.argv.indexOf("--file");
if (fileIndex >= 0) {
  const file = process.argv[fileIndex + 1];
  if (!file) throw new Error("26.12 SBOM_ARTIFACT FAIL missing --file value");
  const sbom = JSON.parse(readFileSync(file, "utf8"));
  const components = verifySbom(sbom);
  console.log(`26.12 SBOM_ARTIFACT PASS components=${components} file=${file}`);
} else {
  const checks = verifyWorkflow(readFileSync(WORKFLOW, "utf8"));
  console.log(`26.12 SBOM_WORKFLOW PASS checks=${checks}`);
}

if (process.argv.includes("--self-test")) runSelfTest();

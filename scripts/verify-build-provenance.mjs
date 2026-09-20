import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";

const WORKFLOW = ".github/workflows/build-provenance.yml";
const ARTIFACT = "artifacts/enchev-build-provenance.intoto.json";
const BUILD_ROOT = ".next";

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hashFile(path) {
  return sha256(readFileSync(path));
}

function walkFiles(root, dir = root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(root, full, out);
    else if (stat.isFile()) out.push(full);
  }
  return out;
}

export function hashBuildTree(root = BUILD_ROOT) {
  if (!existsSync(root)) throw new Error(`26.13 BUILD_PROVENANCE FAIL missing-build-root=${root}`);
  const files = walkFiles(resolve(root));
  if (!files.length) throw new Error("26.13 BUILD_PROVENANCE FAIL empty-build-output");
  const manifest = files.map((file) => {
    const path = relative(resolve(root), file).replaceAll("\\", "/");
    return `${path}\0${hashFile(file)}`;
  }).join("\n");
  return { digest: sha256(manifest), files: files.length };
}

export function createStatement({ sourceSha, repository, workflowRef, runId, runAttempt, nodeVersion, lockDigest, buildDigest, buildFiles }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error("26.13 BUILD_PROVENANCE FAIL invalid-source-sha");
  const repo = repository || "SoulFlameAdmin/enchev-auctions";
  const workflow = workflowRef || ".github/workflows/build-provenance.yml";
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: "enchev-auctions/.next", digest: { sha256: buildDigest } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://github.com/Enchev-Auctions/build-types/nextjs@v1",
        externalParameters: {
          repository: `https://github.com/${repo}`,
          sourceSha,
          workflowRef: workflow,
          nodeVersion
        },
        internalParameters: {},
        resolvedDependencies: [
          { uri: `git+https://github.com/${repo}@${sourceSha}`, digest: { gitCommit: sourceSha } },
          { uri: "file:package-lock.json", digest: { sha256: lockDigest } }
        ]
      },
      runDetails: {
        builder: { id: `https://github.com/${repo}/actions/runs/${runId}` },
        metadata: {
          invocationId: `${runId}:${runAttempt}`,
          buildOutputFiles: buildFiles
        }
      }
    }
  };
}

export function verifyStatement(statement, expectedSha) {
  const failures = [];
  if (statement?._type !== "https://in-toto.io/Statement/v1") failures.push("_type");
  if (statement?.predicateType !== "https://slsa.dev/provenance/v1") failures.push("predicateType");
  const subject = statement?.subject?.[0];
  if (subject?.name !== "enchev-auctions/.next") failures.push("subject.name");
  if (!/^[0-9a-f]{64}$/.test(subject?.digest?.sha256 || "")) failures.push("subject.digest");
  const ext = statement?.predicate?.buildDefinition?.externalParameters;
  if (!/^https:\/\/github\.com\//.test(ext?.repository || "")) failures.push("repository");
  if (!/^[0-9a-f]{40}$/.test(ext?.sourceSha || "")) failures.push("sourceSha");
  if (expectedSha && ext?.sourceSha !== expectedSha) failures.push("exact-head");
  const deps = statement?.predicate?.buildDefinition?.resolvedDependencies;
  const lock = Array.isArray(deps) && deps.find((d) => d?.uri === "file:package-lock.json");
  if (!/^[0-9a-f]{64}$/.test(lock?.digest?.sha256 || "")) failures.push("lockDigest");
  const buildFiles = statement?.predicate?.runDetails?.metadata?.buildOutputFiles;
  if (!Number.isInteger(buildFiles) || buildFiles < 1) failures.push("buildOutputFiles");
  if (failures.length) throw new Error(`26.13 BUILD_PROVENANCE FAIL fields=${failures.join(",")}`);
  return { sourceSha: ext.sourceSha, buildDigest: subject.digest.sha256, buildFiles };
}

export function verifyWorkflow(text) {
  const required = [
    ["pull_request trigger", "pull_request:"],
    ["push trigger", "push:"],
    ["main branch", "branches: [main]"],
    ["contents read permission", "contents: read"],
    ["exact source checkout", "ref: ${{ github.event.pull_request.head.sha || github.sha }}"],
    ["Node 24", "node-version: '24'"],
    ["locked install", "npm ci --no-audit --no-fund"],
    ["production build", "npm run build"],
    ["exact source env", "SOURCE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}"],
    ["generate provenance", "node scripts/verify-build-provenance.mjs --generate"],
    ["verify provenance", `node scripts/verify-build-provenance.mjs --file ${ARTIFACT}`],
    ["artifact upload", "uses: actions/upload-artifact@v4"],
    ["exact-head artifact", "enchev-build-provenance-${{ github.event.pull_request.head.sha || github.sha }}"],
    ["artifact path", ARTIFACT],
    ["missing artifact fails", "if-no-files-found: error"]
  ];
  const missing = required.filter(([, token]) => !text.includes(token)).map(([name]) => name);
  if (missing.length) throw new Error(`26.13 BUILD_PROVENANCE_WORKFLOW FAIL missing=${missing.join(",")}`);
  return required.length;
}

function generate() {
  const sourceSha = process.env.SOURCE_SHA || "";
  const repository = process.env.GITHUB_REPOSITORY || "SoulFlameAdmin/enchev-auctions";
  const workflowRef = process.env.GITHUB_WORKFLOW_REF || ".github/workflows/build-provenance.yml";
  const runId = process.env.GITHUB_RUN_ID || "local";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
  const nodeVersion = process.version;
  const lockDigest = hashFile("package-lock.json");
  const { digest: buildDigest, files: buildFiles } = hashBuildTree();
  const statement = createStatement({ sourceSha, repository, workflowRef, runId, runAttempt, nodeVersion, lockDigest, buildDigest, buildFiles });
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(ARTIFACT, JSON.stringify(statement, null, 2) + "\n", "utf8");
  const result = verifyStatement(statement, sourceSha);
  console.log(`26.13 BUILD_PROVENANCE GENERATED sha=${result.sourceSha} files=${result.buildFiles} digest=${result.buildDigest}`);
}

function selfTest() {
  const sha = "a".repeat(40);
  const digest = "b".repeat(64);
  const good = createStatement({
    sourceSha: sha,
    repository: "SoulFlameAdmin/enchev-auctions",
    workflowRef: ".github/workflows/build-provenance.yml@refs/heads/test",
    runId: "123",
    runAttempt: "1",
    nodeVersion: "v24.0.0",
    lockDigest: digest,
    buildDigest: "c".repeat(64),
    buildFiles: 7
  });
  verifyStatement(good, sha);

  const mutations = [
    { ...good, _type: "wrong" },
    { ...good, predicateType: "wrong" },
    { ...good, subject: [{ ...good.subject[0], digest: { sha256: "bad" } }] },
    { ...good, predicate: { ...good.predicate, buildDefinition: { ...good.predicate.buildDefinition, externalParameters: { ...good.predicate.buildDefinition.externalParameters, sourceSha: "d".repeat(40) } } } },
    { ...good, predicate: { ...good.predicate, runDetails: { ...good.predicate.runDetails, metadata: { ...good.predicate.runDetails.metadata, buildOutputFiles: 0 } } } }
  ];
  let rejected = 0;
  for (const sample of mutations) {
    try { verifyStatement(sample, sha); } catch { rejected += 1; }
  }
  if (rejected !== mutations.length) throw new Error(`26.13 BUILD_PROVENANCE SELF_TEST FAIL rejected=${rejected}/${mutations.length}`);

  const workflow = [
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    branches: [main]",
    "permissions:",
    "  contents: read",
    "steps:",
    "  - uses: actions/checkout@v4",
    "    with:",
    "      ref: ${{ github.event.pull_request.head.sha || github.sha }}",
    "  - uses: actions/setup-node@v4",
    "    with:",
    "      node-version: '24'",
    "  - run: npm ci --no-audit --no-fund",
    "  - run: npm run build",
    "  - env:",
    "      SOURCE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}",
    "    run: node scripts/verify-build-provenance.mjs --generate",
    `  - run: node scripts/verify-build-provenance.mjs --file ${ARTIFACT}`,
    "  - uses: actions/upload-artifact@v4",
    "    with:",
    "      name: enchev-build-provenance-${{ github.event.pull_request.head.sha || github.sha }}",
    `      path: ${ARTIFACT}`,
    "      if-no-files-found: error"
  ].join("\n");
  verifyWorkflow(workflow);
  let workflowRejected = 0;
  for (const sample of [
    workflow.replace("npm ci --no-audit --no-fund", "npm install"),
    workflow.replace("npm run build", "echo skip-build"),
    workflow.replace("if-no-files-found: error", "if-no-files-found: warn")
  ]) {
    try { verifyWorkflow(sample); } catch { workflowRejected += 1; }
  }
  if (workflowRejected !== 3) throw new Error(`26.13 BUILD_PROVENANCE SELF_TEST FAIL workflow=${workflowRejected}/3`);
  console.log(`26.13 BUILD_PROVENANCE SELF_TEST PASS statement=${rejected} workflow=${workflowRejected}`);
}

if (process.argv.includes("--generate")) generate();

const fileIndex = process.argv.indexOf("--file");
if (fileIndex >= 0) {
  const file = process.argv[fileIndex + 1];
  if (!file) throw new Error("26.13 BUILD_PROVENANCE FAIL missing --file value");
  const statement = JSON.parse(readFileSync(file, "utf8"));
  const expected = process.env.SOURCE_SHA || undefined;
  const result = verifyStatement(statement, expected);
  console.log(`26.13 BUILD_PROVENANCE PASS sha=${result.sourceSha} files=${result.buildFiles} digest=${result.buildDigest}`);
} else if (!process.argv.includes("--generate")) {
  const checks = verifyWorkflow(readFileSync(WORKFLOW, "utf8"));
  console.log(`26.13 BUILD_PROVENANCE_WORKFLOW PASS checks=${checks}`);
}

if (process.argv.includes("--self-test")) selfTest();

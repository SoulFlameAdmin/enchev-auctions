import { readFileSync } from "node:fs";

const CONFIG_PATH = "config/enchev-ci-secret-scopes.json";
const EXPECTED_WORKFLOW = ".github/workflows/verify-enchev-web.yml";

function jobSection(text, jobName) {
  const marker = \`  \${jobName}:\n\`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(\`26.14 CI_SECRET_SCOPE FAIL missing-job=\${jobName}\`);
  const re = /^  ([A-Za-z0-9_-]+):\s*$/gm;
  re.lastIndex = start + marker.length;
  const next = re.exec(text);
  return text.slice(start, next ? next.index : text.length);
}

function secretRefs(text) {
  return [...text.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
}

export function verifyContract(workflow, config) {
  const failures = [];
  if (config?.version !== 1) failures.push("config.version");
  if (config?.workflow !== EXPECTED_WORKFLOW) failures.push("config.workflow");
  if (config?.environment !== "ci-verification") failures.push("config.environment");

  const secretNames = Array.isArray(config?.secretNames) ? config.secretNames : [];
  const sorted = [...secretNames].sort();
  if (secretNames.length !== 14 || new Set(secretNames).size !== secretNames.length || JSON.stringify(secretNames) !== JSON.stringify(sorted)) {
    failures.push("config.secretNames");
  }

  const rules = config?.rules || {};
  for (const name of [
    "pullRequestVerificationMustBeSecretFree",
    "secretJobMustRunOnlyOnTrustedMainPush",
    "environmentScopeRequired",
    "secretValuesMustNeverBeLoggedOrReadByVerifier",
    "oidcPreferredForCloudSync"
  ]) {
    if (rules[name] !== true) failures.push(\`config.rules.\${name}\`);
  }

  let verifyJob = "";
  let secretJob = "";
  let syncJob = "";
  try {
    verifyJob = jobSection(workflow, "verify-web");
    secretJob = jobSection(workflow, "verify-secret-bindings");
    syncJob = jobSection(workflow, "sync-plan-cloud");
  } catch (error) {
    failures.push(error.message);
  }

  if (verifyJob) {
    if (secretRefs(verifyJob).length) failures.push("verify-web-secret-reference");
    if (!verifyJob.includes("node scripts/verify-environment-scoped-ci-secrets.mjs")) failures.push("verify-web-26.14-gate");
  }

  if (secretJob) {
    if (!secretJob.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'")) failures.push("secret-job-trusted-main-only");
    if (!secretJob.includes("needs: verify-web")) failures.push("secret-job-needs-verify-web");
    if (!secretJob.includes(\`environment: \${config?.environment || ""}\`)) failures.push("secret-job-environment");
    if (!/permissions:\n\s{6}contents: read/.test(secretJob)) failures.push("secret-job-read-only");
    if (secretJob.includes("id-token: write")) failures.push("secret-job-oidc");
    const present = new Set(secretRefs(secretJob));
    for (const name of secretNames) if (!present.has(name)) failures.push(\`secret-job-missing-\${name}\`);
    for (const name of present) if (!secretNames.includes(name)) failures.push(\`secret-job-unregistered-\${name}\`);
  }

  const allRefs = secretRefs(workflow);
  if (allRefs.some((name) => !secretNames.includes(name))) failures.push("workflow-unregistered-secret");
  if (secretJob) {
    const outside = workflow.replace(secretJob, "");
    if (secretRefs(outside).length) failures.push("secret-reference-outside-scoped-job");
  }

  if (syncJob) {
    if (secretRefs(syncJob).length) failures.push("sync-plan-cloud-secret-reference");
    if (!syncJob.includes("id-token: write")) failures.push("sync-plan-cloud-oidc");
  }

  if (failures.length) throw new Error(\`26.14 CI_SECRET_SCOPE FAIL fields=\${[...new Set(failures)].join(",")}\`);
  return { secretReferences: allRefs.length, secretNames: secretNames.length, environment: config.environment };
}

function selfTest(workflow, config) {
  verifyContract(workflow, config);
  const secretExpr = "$" + "{{ secrets.VERCEL_TOKEN }}";
  const mutations = [
    [workflow.replace("    environment: ci-verification\n", ""), config],
    [workflow.replace("if: github.event_name == 'push' && github.ref == 'refs/heads/main'", "if: github.event_name == 'pull_request'"), config],
    [workflow.replace("    timeout-minutes: 15\n", \`    timeout-minutes: 15\n    env:\n      BAD_SCOPE: \${secretExpr}\n\`), config],
    [workflow, { ...config, secretNames: config.secretNames.slice(0, -1) }],
    [workflow.replace("    permissions:\n      contents: read\n    steps:\n", "    permissions:\n      contents: read\n      id-token: write\n    steps:\n"), config]
  ];
  let rejected = 0;
  for (const [sampleWorkflow, sampleConfig] of mutations) {
    try { verifyContract(sampleWorkflow, sampleConfig); } catch { rejected += 1; }
  }
  if (rejected !== mutations.length) throw new Error(\`26.14 CI_SECRET_SCOPE SELF_TEST FAIL rejected=\${rejected}/\${mutations.length}\`);
  console.log(\`26.14 CI_SECRET_SCOPE SELF_TEST PASS rejected=\${rejected}\`);
}

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const workflow = readFileSync(config.workflow || EXPECTED_WORKFLOW, "utf8");
const result = verifyContract(workflow, config);
console.log(\`26.14 CI_SECRET_SCOPE PASS environment=\${result.environment} names=\${result.secretNames} refs=\${result.secretReferences}\`);
if (process.argv.includes("--self-test")) selfTest(workflow, config);

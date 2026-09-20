import fs from "node:fs";

const TASK = "26.03";
const BRANCH = "main";

function fail(message) {
  throw new Error(`${TASK} preview deployment invariant failed: ${message}`);
}

export function validatePreviewDeploymentPolicy(vercelText, workflowText) {
  let vercel;
  try {
    vercel = JSON.parse(vercelText);
  } catch {
    fail("vercel.json must be valid JSON");
  }

  const deploymentEnabled = vercel?.git?.deploymentEnabled;
  if (!deploymentEnabled || typeof deploymentEnabled !== "object" || Array.isArray(deploymentEnabled)) {
    fail("vercel.git.deploymentEnabled must be an object");
  }

  // Production is intentionally not auto-deployed by the Git integration.
  if (deploymentEnabled.main !== false) {
    fail("main must remain excluded from automatic Git deployments; production promotion is separately gated");
  }

  // Product PR branches must remain eligible for Vercel Preview deployments.
  for (const key of ["*", "**", "preview", "pull_request", "system/*", "system/**"]) {
    if (deploymentEnabled[key] === false) {
      fail(`preview-capable branches must not be globally disabled via deploymentEnabled[${key}]`);
    }
  }

  const ignoreCommand = vercel.ignoreCommand;
  if (typeof ignoreCommand !== "string" || !ignoreCommand.trim()) {
    fail("vercel.ignoreCommand must be defined");
  }
  if (!ignoreCommand.includes("git diff --name-only HEAD^ HEAD") || !ignoreCommand.includes("grep -qEv")) {
    fail("ignoreCommand must decide from the changed-file set rather than unconditionally skipping previews");
  }
  if (!ignoreCommand.includes("exit 1") || !ignoreCommand.includes("exit 0")) {
    fail("ignoreCommand must explicitly distinguish deploy vs skip outcomes");
  }

  // The repository CI must exercise every PR targeting main and verify this invariant.
  if (!/pull_request:\s*\n\s*branches:\s*\[main\]/m.test(workflowText)) {
    fail("Verify Enchev Web must run for pull requests targeting main");
  }
  if (!workflowText.includes("Preview deployment per change gate contract (26.03)")) {
    fail("Verify Enchev Web must execute the 26.03 preview-deployment verifier");
  }

  return {
    task: TASK,
    productionAutoDeployDisabled: true,
    productPreviewBranchesEligible: true,
    prVerificationTarget: BRANCH
  };
}

function runSelfTests(vercelText, workflowText) {
  const cases = [
    {
      name: "reject-global-preview-disable",
      vercel: JSON.stringify({ ...JSON.parse(vercelText), git: { deploymentEnabled: { ...JSON.parse(vercelText).git.deploymentEnabled, "*": false } } }),
      workflow: workflowText
    },
    {
      name: "reject-system-preview-disable",
      vercel: JSON.stringify({ ...JSON.parse(vercelText), git: { deploymentEnabled: { ...JSON.parse(vercelText).git.deploymentEnabled, "system/**": false } } }),
      workflow: workflowText
    },
    {
      name: "reject-unconditional-skip",
      vercel: JSON.stringify({ ...JSON.parse(vercelText), ignoreCommand: "exit 0" }),
      workflow: workflowText
    },
    {
      name: "reject-missing-pr-trigger",
      vercel: vercelText,
      workflow: workflowText.replace(/pull_request:\s*\n\s*branches:\s*\[main\]\s*/m, "")
    }
  ];

  let rejected = 0;
  for (const testCase of cases) {
    try {
      validatePreviewDeploymentPolicy(testCase.vercel, testCase.workflow);
    } catch {
      rejected += 1;
    }
  }
  if (rejected !== cases.length) {
    fail(`self-test expected ${cases.length} rejections, got ${rejected}`);
  }
  console.log(`PREVIEW_DEPLOYMENT_PER_CHANGE_SELF_TEST PASS cases=${rejected}`);
}

const vercelText = fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
const workflowText = fs.readFileSync(new URL("../.github/workflows/verify-enchev-web.yml", import.meta.url), "utf8");

if (process.argv.includes("--self-test")) {
  runSelfTests(vercelText, workflowText);
} else {
  const result = validatePreviewDeploymentPolicy(vercelText, workflowText);
  console.log(`PREVIEW_DEPLOYMENT_PER_CHANGE PASS task=${result.task} production_auto_deploy_disabled=${result.productionAutoDeployDisabled} preview_branches_eligible=${result.productPreviewBranchesEligible} pr_target=${result.prVerificationTarget}`);
}

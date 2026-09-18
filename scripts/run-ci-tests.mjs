import { spawnSync } from "node:child_process";

const cases = [
  ["scripts/verify-master-task-ids.mjs", "--self-test"],
  ["scripts/verify-green-requires-evidence.mjs", "--self-test"],
  ["scripts/verify-green-requires-passing-test.mjs", "--self-test"],
  ["scripts/verify-yellow-semantics.mjs", "--self-test"],
  ["scripts/verify-red-semantics.mjs", "--self-test"],
  ["scripts/verify-gap-append-only.mjs", "--self-test"],
  ["scripts/verify-status-audit-trail.mjs", "--self-test"],
  ["scripts/verify-cloud-plan-state.mjs", "--self-test"],
  ["scripts/verify-plan-version-ui.mjs", "--self-test"],
  ["scripts/verify-supabase-project-binding.mjs", "--self-test"],
  ["scripts/verify-environment-variables.mjs", "--self-test"],
  ["scripts/verify-redis-environment.mjs", "--self-test"],
  ["scripts/verify-redis-production-gate.mjs", "--self-test"],
  ["scripts/verify-ci-quality-gates.mjs", "--self-test"],
  ["scripts/verify-mobile-first-design.mjs", "--self-test"],
  ["scripts/verify-accessibility-visual-pass.mjs", "--self-test"],
  ["scripts/verify-cross-browser-visual-contract.mjs", "--self-test"],
  ["scripts/capture-visual-regression.mjs", "--self-test"],
  ["scripts/verify-enchev-final-consistency.mjs", "--self-test"],
  ["tools/david/auto-complete-app2-v1.mjs", "--self-test"],
  ["tools/david/auto-continue-enchev-v5.mjs", "--self-test"],
  ["scripts/verify-health-endpoints.mjs", "--self-test"],
  ["scripts/verify-apps-web.mjs", "--self-test"],
  ["scripts/verify-apps-api.mjs", "--self-test"],
  ["scripts/verify-apps-realtime.mjs", "--self-test"],
  ["scripts/verify-apps-worker.mjs", "--self-test"],
  ["scripts/verify-packages-domain.mjs", "--self-test"],
  ["scripts/verify-packages-contracts.mjs", "--self-test"],
  ["scripts/verify-packages-config.mjs", "--self-test"],
  ["scripts/verify-packages-providers.mjs", "--self-test"]
];

for (const [file, ...args] of cases) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`CI_TEST_SUITE FAIL: ${file} ${args.join(" ")} exited with ${result.status}`);
  }
}

console.log(`CI_TEST_SUITE PASS cases=${cases.length}`);

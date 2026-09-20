import { spawnSync } from "node:child_process";

const gates = [
  ["scripts/verify-production-smoke-suite.mjs", "--self-test"],
  ["scripts/verify-failure-injection-harness.mjs", "--self-test"],
  ["scripts/verify-database-migration-gate.mjs", "--self-test"],
  ["scripts/verify-dependency-lockfile-enforcement.mjs", "--self-test"],
  ["scripts/verify-dependency-review.mjs", "--self-test"],
  ["scripts/verify-secret-scanning-gate.mjs", "--self-test"]
];

for (const [file, ...args] of gates) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`SYSTEM_TEST_PRE_GATES FAIL: ${file} ${args.join(" ")} exited with ${result.status}`);
  }
}

console.log(`SYSTEM_TEST_PRE_GATES PASS gates=${gates.length}`);

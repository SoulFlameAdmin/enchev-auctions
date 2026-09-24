import { spawnSync } from "node:child_process";

const gates = [
  ["scripts/verify-staging-deployment-pipeline.mjs", "--self-test"],
  ["scripts/verify-deployment-concurrency-control.mjs", "--self-test"],
  ["scripts/verify-production-smoke-suite.mjs", "--self-test"],
  ["scripts/verify-failure-injection-harness.mjs", "--self-test"],
  ["scripts/verify-database-migration-gate.mjs", "--self-test"],
  ["scripts/verify-dependency-lockfile-enforcement.mjs", "--self-test"],
  ["scripts/verify-dependency-review.mjs", "--self-test"],
  ["scripts/verify-sbom-generation.mjs", "--self-test"],
  ["scripts/verify-build-provenance.mjs", "--self-test"],
  ["scripts/verify-environment-scoped-ci-secrets.mjs", "--self-test"],
  ["scripts/verify-standard-error-envelope.mjs", "--self-test"],
  ["scripts/verify-request-correlation-id.mjs", "--self-test"],
  ["scripts/verify-idempotency-key-contract.mjs", "--self-test"],
  ["scripts/verify-rate-limit-response-contract.mjs", "--self-test"],
  ["scripts/verify-api-endpoint-inventory.mjs", "--self-test"],
  ["scripts/verify-api-compatibility-policy.mjs", "--self-test"],
  ["scripts/verify-webhook-signature-contract.mjs", "--self-test"],
  ["scripts/verify-websocket-event-registry.mjs", "--self-test"],
  ["scripts/verify-web-api-provider-contract-tests.mjs", "--self-test"],
  ["scripts/verify-critical-user-journey-slis.mjs", "--self-test"],
  ["scripts/verify-api-availability-sli.mjs", "--self-test"],
  ["scripts/verify-bid-acceptance-latency-sli.mjs", "--self-test"],
  ["scripts/verify-realtime-delivery-latency-sli.mjs", "--self-test"],
  ["scripts/verify-reconnect-success-sli.mjs", "--self-test"],
  ["scripts/verify-auction-finalization-success-sli.mjs", "--self-test"],
  ["scripts/verify-initial-slo-targets.mjs", "--self-test"],
  ["scripts/verify-error-budget-policy.mjs", "--self-test"]
];

for (const [file, ...args] of gates) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`SYSTEM_TEST_PRE_GATES FAIL: ${file} ${args.join(" ")} exited with ${result.status}`);
  }
}

console.log(`SYSTEM_TEST_PRE_GATES PASS gates=${gates.length}`);

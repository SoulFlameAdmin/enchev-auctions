import fs from "node:fs";

const CONFIG_PATH = "config/enchev-api-availability-sli.json";
const INVENTORY_PATH = "config/enchev-api-endpoint-inventory.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`API_AVAILABILITY_SLI FAIL: ${message}`);
}

export function validate(config, inventory, pkg, preGateSource) {
  if (config?.taskId !== "27.02") fail("taskId must be 27.02");
  if (config?.name !== "API availability SLI") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.scope !== "measurement-contract-only") fail("scope drift");
  if (config?.targetOwnershipTask !== "27.07") fail("SLO target ownership must remain 27.07");
  if (config?.sourceInventory !== INVENTORY_PATH) fail("endpoint source inventory drift");
  if (config?.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if (config?.telemetryMayMutateAuctionState !== false) fail("telemetry must never mutate auction state");

  if (inventory?.task !== "24.09" || inventory?.sourceOfTruth !== "packages/contracts/openapi/enchev-api.v1.json") fail("24.09 inventory contract drift");
  if (!Array.isArray(inventory?.endpoints) || inventory.endpoints.length < 1) fail("endpoint inventory empty");
  const operationIds = inventory.endpoints.map(item => item.operationId);
  if (operationIds.some(value => !value) || new Set(operationIds).size !== operationIds.length) fail("operation IDs invalid or duplicated");

  const indicator = config?.indicator;
  if (indicator?.name !== "api_availability_ratio" || indicator?.unit !== "ratio") fail("indicator identity drift");
  if (!indicator?.numerator || !indicator?.denominator) fail("ratio definition incomplete");
  if (indicator?.unknownOutcomeCountsAsBad !== true) fail("unknown outcomes must fail closed");

  const eligibility = config?.eligibility;
  if (eligibility?.listedOperationRequired !== true) fail("listed operation eligibility disabled");
  if (eligibility?.excludeMalformedBeforeIngressValidation !== true) fail("malformed pre-ingress requests must be excluded");
  if (eligibility?.excludeClientCancelledBeforeResponse !== true) fail("pre-response client cancellations must be excluded");
  if (eligibility?.excludeSynthetic !== false) fail("synthetic traffic must not be silently excluded");

  const classification = config?.classification;
  if (!Array.isArray(classification?.good) || classification.good.length < 4) fail("good classification incomplete");
  if (!Array.isArray(classification?.bad) || classification.bad.length < 6) fail("bad classification incomplete");
  if (classification?.rateLimitedCountsAsAvailable !== true) fail("valid 429 transport behavior must count as available");
  if (classification?.businessRejectionCountsAsAvailable !== true) fail("contract-valid business rejection must not become availability failure");
  if (!classification.bad.includes("5xx response")) fail("5xx must be bad");
  if (!classification.bad.includes("unknown outcome")) fail("unknown outcome must be bad");

  const measurement = config?.measurement;
  const required = ["environment", "operation_id", "method", "outcome"];
  if (JSON.stringify(measurement?.requiredDimensions) !== JSON.stringify(required)) fail("required dimensions drift");
  if (measurement?.piiForbidden !== true || measurement?.rawCredentialDataForbidden !== true || measurement?.requestBodyCaptureForbidden !== true) fail("privacy guardrail disabled");

  const guardrails = config?.guardrails;
  if (guardrails?.noSloTargetInThisTask !== true) fail("27.02 must not define SLO targets");
  if (guardrails?.noProviderSpecificAvailabilityShortcut !== true) fail("provider shortcut guardrail disabled");
  if (guardrails?.noTelemetryDerivedWinner !== true || guardrails?.noTelemetryDerivedAcceptedBid !== true) fail("auction authority guardrail disabled");
  if (guardrails?.rateLimitPolicyOwnershipTask !== "24.08") fail("rate-limit ownership drift");
  if (guardrails?.capacityOwnershipTask !== "27.11") fail("capacity ownership drift");

  const serialized = JSON.stringify(config);
  if (/"target"\s*:\s*[0-9]/i.test(serialized) || /"sloPercent"\s*:/i.test(serialized)) fail("27.02 must not invent SLO target values");

  if (pkg?.scripts?.["verify:api-availability-sli"] !== "node scripts/verify-api-availability-sli.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:api-availability-sli:self-test"] !== "node scripts/verify-api-availability-sli.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-api-availability-sli.mjs", "--self-test"]')) fail("27.02 missing from system pre-gates");

  return { endpoints: inventory.endpoints.length, dimensions: required.length };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, inventory, pkg, preGateSource);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, inventory, pkg, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("telemetry gains authority", c => { c.telemetryMayMutateAuctionState = true; });
  reject("unknown outcome treated as good", c => { c.indicator.unknownOutcomeCountsAsBad = false; });
  reject("5xx removed from bad events", c => { c.classification.bad = c.classification.bad.filter(x => x !== "5xx response"); });
  reject("rate limits mislabeled unavailable", c => { c.classification.rateLimitedCountsAsAvailable = false; });
  reject("request bodies allowed", c => { c.measurement.requestBodyCaptureForbidden = false; });
  reject("SLO target invented", c => { c.sloPercent = 99.9; });
  reject("capacity ownership drift", c => { c.guardrails.capacityOwnershipTask = "27.02"; });

  let inventoryRejected = false;
  const badInventory = structuredClone(inventory);
  badInventory.endpoints.push({ ...badInventory.endpoints[0] });
  try { validate(config, badInventory, pkg, preGateSource); } catch { inventoryRejected = true; }
  if (!inventoryRejected) fail("duplicate operation ID self-test not rejected");
  cases += 1;

  let preGateRejected = false;
  try {
    validate(config, inventory, pkg, preGateSource.replace('["scripts/verify-api-availability-sli.mjs", "--self-test"]', ""));
  } catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`API_AVAILABILITY_SLI_SELF_TEST PASS cases=${cases} endpoints=${result.endpoints} fail_closed=true`);
} else {
  console.log(`API_AVAILABILITY_SLI PASS task=27.02 endpoints=${result.endpoints} dimensions=${result.dimensions}`);
}

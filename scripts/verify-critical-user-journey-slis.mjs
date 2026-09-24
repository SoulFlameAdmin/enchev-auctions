import fs from "node:fs";

const CONFIG_PATH = "config/enchev-critical-user-journey-slis.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`CRITICAL_USER_JOURNEY_SLIS FAIL: ${message}`);
}

const expectedJourneys = [
  "inventory_discovery",
  "lot_detail",
  "live_auction_view",
  "bid_submission",
  "auction_result_visibility"
];

export function validate(config, pkg, preGateSource) {
  if (config?.taskId !== "27.01") fail("taskId must be 27.01");
  if (config?.name !== "Critical user-journey SLIs") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.scope !== "measurement-contract-only") fail("scope drift");
  if (config?.targetOwnershipTask !== "27.07") fail("SLO target ownership must remain 27.07");
  if (config?.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if (config?.telemetryMayMutateAuctionState !== false) fail("telemetry must never mutate auction state");

  const journeys = config?.journeys;
  if (!Array.isArray(journeys) || journeys.length !== expectedJourneys.length) fail("journey count drift");
  const ids = journeys.map(j => j.id);
  if (JSON.stringify(ids) !== JSON.stringify(expectedJourneys)) fail("journey registry drift");
  if (new Set(ids).size !== ids.length) fail("duplicate journey IDs");

  for (const journey of journeys) {
    if (!journey.entry || !journey.success || !journey.failure) fail(`${journey.id} missing contract field`);
    if (journey.sli !== "successful_journey_ratio") fail(`${journey.id} SLI drift`);
  }

  const ratio = config?.ratioDefinition;
  if (!ratio?.numerator || !ratio?.denominator) fail("ratio definition incomplete");
  if (ratio.excludeSynthetic !== false) fail("synthetic traffic must not be silently excluded");
  if (ratio.excludeUserCancelled !== true) fail("user-cancelled journeys must be excluded");
  if (ratio.unknownOutcomeCountsAsFailure !== true) fail("unknown outcomes must fail closed");

  const measurement = config?.measurement;
  if (JSON.stringify(measurement?.requiredDimensions) !== JSON.stringify(["environment","journey_id","outcome"])) fail("required dimensions drift");
  if (measurement?.piiForbidden !== true || measurement?.rawCredentialDataForbidden !== true) fail("privacy guardrail disabled");

  const guardrails = config?.guardrails;
  for (const key of ["noSloTargetInThisTask","noProviderSpecificSuccessShortcut","noTelemetryDerivedWinner","noTelemetryDerivedAcceptedBid"]) {
    if (guardrails?.[key] !== true) fail(`guardrail disabled: ${key}`);
  }

  const serialized = JSON.stringify(config);
  if (/"target"\s*:\s*[0-9]/i.test(serialized) || /"sloPercent"\s*:/i.test(serialized)) fail("27.01 must not invent SLO target values");

  if (pkg?.scripts?.["verify:critical-user-journey-slis"] !== "node scripts/verify-critical-user-journey-slis.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:critical-user-journey-slis:self-test"] !== "node scripts/verify-critical-user-journey-slis.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-critical-user-journey-slis.mjs", "--self-test"]')) fail("27.01 missing from system pre-gates");

  return { journeys: journeys.length, requiredDimensions: measurement.requiredDimensions.length };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, pkg, preGateSource);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, pkg, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("telemetry gains authority", c => { c.telemetryMayMutateAuctionState = true; });
  reject("journey removed", c => { c.journeys.pop(); });
  reject("unknown outcome ignored", c => { c.ratioDefinition.unknownOutcomeCountsAsFailure = false; });
  reject("PII allowed", c => { c.measurement.piiForbidden = false; });
  reject("SLO target invented", c => { c.sloPercent = 99.9; });
  reject("winner derived from telemetry", c => { c.guardrails.noTelemetryDerivedWinner = false; });
  reject("target ownership moved", c => { c.targetOwnershipTask = "27.01"; });

  let preGateRejected = false;
  try {
    validate(config, pkg, preGateSource.replace('["scripts/verify-critical-user-journey-slis.mjs", "--self-test"]', ""));
  } catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`CRITICAL_USER_JOURNEY_SLIS_SELF_TEST PASS cases=${cases} journeys=${result.journeys} fail_closed=true`);
} else {
  console.log(`CRITICAL_USER_JOURNEY_SLIS PASS task=27.01 journeys=${result.journeys} dimensions=${result.requiredDimensions}`);
}

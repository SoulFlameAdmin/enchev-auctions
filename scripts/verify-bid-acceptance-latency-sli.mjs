import fs from "node:fs";

const CONFIG_PATH = "config/enchev-bid-acceptance-latency-sli.json";
const JOURNEY_PATH = "config/enchev-critical-user-journey-slis.json";
const OPENAPI_PATH = "packages/contracts/openapi/enchev-api.v1.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`BID_ACCEPTANCE_LATENCY_SLI FAIL: ${message}`);
}

export function validate(config, journeys, openapi, pkg, preGateSource) {
  if (config?.taskId !== "27.03") fail("taskId must be 27.03");
  if (config?.name !== "Bid acceptance latency SLI") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.scope !== "measurement-contract-only") fail("scope drift");
  if (config?.targetOwnershipTask !== "27.07") fail("SLO target ownership must remain 27.07");
  if (config?.latencyBudgetOwnershipTask !== "27.09") fail("latency budget ownership must remain 27.09");
  if (config?.criticalJourneySource !== JOURNEY_PATH) fail("critical journey source drift");
  if (config?.journeyId !== "bid_submission") fail("journeyId drift");
  if (config?.authoritativeBidRoute !== "POST /api/bids") fail("authoritative bid route drift");
  if (config?.demoRouteExcluded !== "POST /api/live-auction-clock") fail("demo route exclusion drift");
  if (config?.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if (config?.telemetryMayMutateAuctionState !== false) fail("telemetry must never mutate auction state");

  const journey = journeys?.journeys?.find(item => item.id === "bid_submission");
  if (!journey) fail("27.01 bid_submission journey missing");
  if (journey.entry !== "POST /api/bids") fail("27.01 bid route drift");
  if (journey.success !== "authoritative_accept_or_explicit_reject") fail("27.01 bid success semantics drift");

  const apiBidImplemented = Boolean(openapi?.paths?.["/api/bids"]?.post);
  if (config?.authoritativeBidRouteImplemented !== apiBidImplemented) {
    fail("authoritativeBidRouteImplemented must match current OpenAPI truth");
  }
  if (!openapi?.paths?.["/api/live-auction-clock"]?.post) fail("demo route missing from OpenAPI");

  const indicator = config?.indicator;
  if (indicator?.name !== "bid_acceptance_latency_ms") fail("indicator name drift");
  if (indicator?.unit !== "milliseconds" || indicator?.type !== "distribution") fail("indicator unit/type drift");
  if (!indicator?.startEvent || !indicator?.endEvent || !indicator?.samplePopulation) fail("latency boundary incomplete");
  if (indicator?.rejectedBidsExcluded !== true) fail("rejected bids must be excluded from acceptance latency");
  if (indicator?.unknownOrAmbiguousAcceptanceExcluded !== true) fail("ambiguous acceptance must be excluded");

  const clock = config?.clock;
  if (clock?.required !== "monotonic server-side clock") fail("monotonic server-side clock required");
  if (clock?.clientClockForbidden !== true || clock?.wallClockForOrderingForbidden !== true || clock?.negativeDurationForbidden !== true) {
    fail("clock guardrail disabled");
  }

  const measurement = config?.measurement;
  if (JSON.stringify(measurement?.requiredDimensions) !== JSON.stringify(["environment","operation_id","outcome"])) fail("required dimensions drift");
  for (const key of [
    "correlationIdAsMetricDimensionForbidden",
    "piiForbidden",
    "rawCredentialDataForbidden",
    "requestBodyCaptureForbidden",
    "bidAmountAsMetricDimensionForbidden",
    "userIdAsMetricDimensionForbidden"
  ]) {
    if (measurement?.[key] !== true) fail(`measurement guardrail disabled: ${key}`);
  }
  if (measurement?.correlationIdAllowed !== true) fail("correlation IDs must remain usable for diagnostics");

  const guardrails = config?.guardrails;
  if (guardrails?.noSloTargetInThisTask !== true) fail("27.03 must not define SLO targets");
  if (guardrails?.noLatencyTargetInThisTask !== true) fail("27.03 must not define latency targets");
  if (guardrails?.demoBidFeedbackNeverAuthoritative !== true) fail("demo authority guardrail disabled");
  if (guardrails?.noTelemetryDerivedAcceptedBid !== true || guardrails?.noTelemetryDerivedWinner !== true) fail("auction authority guardrail disabled");
  if (guardrails?.idempotencyOwnershipTask !== "24.07") fail("idempotency ownership drift");
  if (guardrails?.correlationOwnershipTask !== "24.05") fail("correlation ownership drift");

  const serialized = JSON.stringify(config);
  if (/"target"\s*:\s*[0-9]/i.test(serialized) || /"sloPercent"\s*:/i.test(serialized) || /"latencyTargetMs"\s*:/i.test(serialized)) {
    fail("27.03 must not invent target values");
  }

  if (pkg?.scripts?.["verify:bid-acceptance-latency-sli"] !== "node scripts/verify-bid-acceptance-latency-sli.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:bid-acceptance-latency-sli:self-test"] !== "node scripts/verify-bid-acceptance-latency-sli.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-bid-acceptance-latency-sli.mjs", "--self-test"]')) fail("27.03 missing from system pre-gates");

  return { routeImplemented: apiBidImplemented, journey: journey.id };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const journeys = JSON.parse(fs.readFileSync(JOURNEY_PATH, "utf8"));
const openapi = JSON.parse(fs.readFileSync(OPENAPI_PATH, "utf8"));
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, journeys, openapi, pkg, preGateSource);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, journeys, openapi, pkg, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("demo becomes authoritative", c => { c.guardrails.demoBidFeedbackNeverAuthoritative = false; });
  reject("client clock allowed", c => { c.clock.clientClockForbidden = false; });
  reject("rejected bids included", c => { c.indicator.rejectedBidsExcluded = false; });
  reject("bid amount metric dimension allowed", c => { c.measurement.bidAmountAsMetricDimensionForbidden = false; });
  reject("telemetry derives accepted bid", c => { c.guardrails.noTelemetryDerivedAcceptedBid = false; });
  reject("latency target invented", c => { c.latencyTargetMs = 250; });
  reject("route implementation truth falsified", c => { c.authoritativeBidRouteImplemented = !c.authoritativeBidRouteImplemented; });

  let journeyRejected = false;
  const badJourneys = structuredClone(journeys);
  const bidJourney = badJourneys.journeys.find(item => item.id === "bid_submission");
  bidJourney.entry = "POST /api/live-auction-clock";
  try { validate(config, badJourneys, openapi, pkg, preGateSource); } catch { journeyRejected = true; }
  if (!journeyRejected) fail("critical journey drift self-test not rejected");
  cases += 1;

  let preGateRejected = false;
  try {
    validate(config, journeys, openapi, pkg, preGateSource.replace('["scripts/verify-bid-acceptance-latency-sli.mjs", "--self-test"]', ""));
  } catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`BID_ACCEPTANCE_LATENCY_SLI_SELF_TEST PASS cases=${cases} route_implemented=${result.routeImplemented} fail_closed=true`);
} else {
  console.log(`BID_ACCEPTANCE_LATENCY_SLI PASS task=27.03 journey=${result.journey} route_implemented=${result.routeImplemented}`);
}

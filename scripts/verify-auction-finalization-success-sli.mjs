import fs from "node:fs";

const CONFIG_PATH = "config/enchev-auction-finalization-success-sli.json";
const REGISTRY_PATH = "config/enchev-websocket-event-registry.json";
const JOURNEY_PATH = "config/enchev-critical-user-journey-slis.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`AUCTION_FINALIZATION_SUCCESS_SLI FAIL: ${message}`);
}

export function validate(config, registry, journeys, pkg, preGateSource) {
  if (config?.taskId !== "27.06") fail("taskId must be 27.06");
  if (config?.name !== "Auction finalization success SLI") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.scope !== "measurement-contract-only") fail("scope drift");
  if (config?.targetOwnershipTask !== "27.07") fail("SLO target ownership must remain 27.07");
  if (config?.eventRegistrySource !== REGISTRY_PATH) fail("registry source drift");
  if (config?.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if (config?.telemetryMayMutateAuctionState !== false) fail("telemetry must not mutate auction state");
  if (config?.runtimeFinalizationImplemented !== false) fail("runtime finalization implementation must not be falsely claimed");

  if (registry?.task !== "24.12") fail("registry task drift");
  if (registry?.transportAuthority !== false) fail("realtime transport must remain non-authoritative");
  if (!String(registry?.authorityBoundary).includes("PostgreSQL remains authoritative")) fail("registry authority boundary drift");
  const eventTypes = new Set((registry?.events || []).map(item => item.type));
  if (!eventTypes.has("enchev.auction.closed.v1")) fail("auction closed projection event missing");

  if (journeys?.taskId !== "27.01") fail("critical journey source drift");
  const resultJourney = (journeys?.journeys || []).find(j => j.id === "auction_result_visibility");
  if (!resultJourney) fail("auction_result_visibility journey missing");
  if (resultJourney?.success !== "authoritative_result_visible") fail("result visibility success drift");
  if (resultJourney?.failure !== "closed_auction_result_missing_or_ambiguous") fail("result visibility failure drift");

  const indicator = config?.indicator;
  if (indicator?.name !== "auction_finalization_success_ratio" || indicator?.type !== "ratio") fail("indicator drift");
  if (!indicator?.numerator || !indicator?.denominator) fail("ratio definition incomplete");
  for (const key of [
    "successRequiresDurablePostgresqlCommit",
    "successRequiresSingleUnambiguousFinalState",
    "successRequiresResultPublishable",
    "successRequiresWinnerOutcomeResolved",
    "unknownOutcomeCountsAsFailure",
    "timeoutCountsAsFailure"
  ]) {
    if (indicator?.[key] !== true) fail(`indicator guardrail disabled: ${key}`);
  }

  const winner = config?.winnerOutcome;
  if (JSON.stringify(winner?.acceptedTerminalOutcomes) !== JSON.stringify(["winner_assigned","closed_without_winner"])) fail("terminal winner outcomes drift");
  for (const key of ["ambiguousWinnerForbidden","multipleWinnersForbidden","telemetryMayNotChooseWinner","realtimeEventMayNotChooseWinner"]) {
    if (winner?.[key] !== true) fail(`winner guardrail disabled: ${key}`);
  }

  const eligibility = config?.eligibility;
  if (eligibility?.authoritativeCloseAttemptIncluded !== true) fail("authoritative finalization attempts must be included");
  if (eligibility?.workerRetryOfSameIdempotentFinalizationIncludedAsSameLogicalAttempt !== true) fail("idempotent retries must remain one logical attempt");
  if (eligibility?.syntheticAttemptsExcluded !== false) fail("synthetic attempts must not be silently excluded");
  if (eligibility?.cancelledBeforeFinalizationAttemptExcluded !== true) fail("pre-finalization cancellation exclusion drift");
  if (eligibility?.nonAuthoritativeBrowserClockExcluded !== true) fail("browser clock must be excluded");

  const projection = config?.projectionBoundary;
  if (projection?.closedEventType !== "enchev.auction.closed.v1") fail("closed projection event drift");
  if (projection?.closedEventIsProjectionNotAuthority !== true) fail("closed event authority drift");
  if (projection?.eventEmissionAloneIsNotSuccess !== true) fail("event emission alone cannot equal success");
  if (projection?.resultVisibilityJourneySourceTask !== "27.01") fail("result journey ownership drift");
  if (projection?.resultVisibilityJourneyId !== "auction_result_visibility") fail("result journey id drift");

  const measurement = config?.measurement;
  if (JSON.stringify(measurement?.requiredDimensions) !== JSON.stringify(["environment","outcome"])) fail("required dimensions drift");
  for (const key of [
    "correlationIdAsMetricDimensionForbidden",
    "auctionIdAsMetricDimensionForbidden",
    "winnerIdAsMetricDimensionForbidden",
    "sellerIdAsMetricDimensionForbidden",
    "buyerIdAsMetricDimensionForbidden",
    "piiForbidden",
    "rawCredentialDataForbidden",
    "bidAmountAsMetricDimensionForbidden"
  ]) {
    if (measurement?.[key] !== true) fail(`measurement guardrail disabled: ${key}`);
  }
  if (measurement?.correlationIdAllowedForDiagnostics !== true) fail("correlation IDs must remain available for diagnostics");

  const guardrails = config?.guardrails;
  if (guardrails?.noSloTargetInThisTask !== true) fail("27.06 must not define SLO targets");
  if (guardrails?.noProviderSpecificShortcut !== true) fail("provider shortcut guardrail disabled");
  if (guardrails?.noBrowserDerivedFinalization !== true) fail("browser-derived finalization forbidden");
  if (guardrails?.noTelemetryDerivedAcceptedBid !== true) fail("telemetry-derived accepted bid forbidden");
  if (guardrails?.noTelemetryDerivedWinner !== true) fail("telemetry-derived winner forbidden");
  if (guardrails?.noRealtimeDerivedWinner !== true) fail("realtime-derived winner forbidden");
  if (guardrails?.singleAuthoritativeFinalResultRequired !== true) fail("single final result guardrail disabled");
  if (guardrails?.registryOwnershipTask !== "24.12") fail("registry ownership drift");

  const serialized = JSON.stringify(config);
  if (/"target"\s*:\s*[0-9]/i.test(serialized) || /"sloPercent"\s*:/i.test(serialized)) fail("27.06 must not invent target values");

  if (pkg?.scripts?.["verify:auction-finalization-success-sli"] !== "node scripts/verify-auction-finalization-success-sli.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:auction-finalization-success-sli:self-test"] !== "node scripts/verify-auction-finalization-success-sli.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-auction-finalization-success-sli.mjs", "--self-test"]')) fail("27.06 missing from system pre-gates");

  return { events: eventTypes.size, resultJourney: resultJourney.id };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const journeys = JSON.parse(fs.readFileSync(JOURNEY_PATH, "utf8"));
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, registry, journeys, pkg, preGateSource);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, registry, journeys, pkg, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("durable commit not required", c => { c.indicator.successRequiresDurablePostgresqlCommit = false; });
  reject("ambiguous winner allowed", c => { c.winnerOutcome.ambiguousWinnerForbidden = false; });
  reject("multiple winners allowed", c => { c.winnerOutcome.multipleWinnersForbidden = false; });
  reject("event emission treated as success", c => { c.projectionBoundary.eventEmissionAloneIsNotSuccess = false; });
  reject("unknown outcome counted good", c => { c.indicator.unknownOutcomeCountsAsFailure = false; });
  reject("synthetic attempts excluded", c => { c.eligibility.syntheticAttemptsExcluded = true; });
  reject("winner id metric dimension allowed", c => { c.measurement.winnerIdAsMetricDimensionForbidden = false; });
  reject("browser finalization allowed", c => { c.guardrails.noBrowserDerivedFinalization = false; });
  reject("runtime implementation falsely claimed", c => { c.runtimeFinalizationImplemented = true; });
  reject("SLO target invented", c => { c.sloPercent = 99.9; });

  let registryRejected = false;
  const badRegistry = structuredClone(registry);
  badRegistry.events = badRegistry.events.filter(item => item.type !== "enchev.auction.closed.v1");
  try { validate(config, badRegistry, journeys, pkg, preGateSource); } catch { registryRejected = true; }
  if (!registryRejected) fail("missing closed-event registry self-test not rejected");
  cases += 1;

  let journeyRejected = false;
  const badJourneys = structuredClone(journeys);
  badJourneys.journeys = badJourneys.journeys.filter(item => item.id !== "auction_result_visibility");
  try { validate(config, registry, badJourneys, pkg, preGateSource); } catch { journeyRejected = true; }
  if (!journeyRejected) fail("missing result journey self-test not rejected");
  cases += 1;

  let preGateRejected = false;
  try {
    validate(config, registry, journeys, pkg, preGateSource.replace('["scripts/verify-auction-finalization-success-sli.mjs", "--self-test"]', ""));
  } catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`AUCTION_FINALIZATION_SUCCESS_SLI_SELF_TEST PASS cases=${cases} events=${result.events} journey=${result.resultJourney} fail_closed=true`);
} else {
  console.log(`AUCTION_FINALIZATION_SUCCESS_SLI PASS task=27.06 events=${result.events} journey=${result.resultJourney}`);
}

import fs from "node:fs";

const CONFIG_PATH = "config/enchev-realtime-delivery-latency-sli.json";
const REGISTRY_PATH = "config/enchev-websocket-event-registry.json";
const REALTIME_README_PATH = "apps/realtime/README.md";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`REALTIME_DELIVERY_LATENCY_SLI FAIL: ${message}`);
}

export function validate(config, registry, realtimeReadme, pkg, preGateSource) {
  if (config?.taskId !== "27.04") fail("taskId must be 27.04");
  if (config?.name !== "Realtime delivery latency SLI") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.scope !== "measurement-contract-only") fail("scope drift");
  if (config?.targetOwnershipTask !== "27.07") fail("SLO target ownership must remain 27.07");
  if (config?.latencyBudgetOwnershipTask !== "27.09") fail("latency budget ownership must remain 27.09");
  if (config?.eventRegistrySource !== REGISTRY_PATH) fail("registry source drift");
  if (config?.realtimeWorkspace !== "apps/realtime") fail("realtime workspace drift");
  if (config?.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if (config?.telemetryMayMutateAuctionState !== false) fail("telemetry must not mutate auction state");

  if (registry?.task !== "24.12") fail("24.12 registry task drift");
  if (registry?.transportAuthority !== false) fail("realtime transport must remain non-authoritative");
  if (registry?.sequenceScope !== "auction-stream") fail("registry sequence scope drift");
  if (!String(registry?.gapPolicy).toLowerCase().includes("resync")) fail("registry resync policy missing");
  if (!String(registry?.authorityBoundary).includes("PostgreSQL remains authoritative")) fail("registry authority boundary drift");
  if (!Array.isArray(registry?.events) || registry.events.length < 6) fail("realtime event registry incomplete");
  const eventTypes = registry.events.map(item => item.type);
  if (eventTypes.some(type => typeof type !== "string") || new Set(eventTypes).size !== eventTypes.length) fail("event type registry invalid");

  const runtimeImplemented = !/service shell only/i.test(realtimeReadme) && !/without claiming that WebSocket\/realtime runtime behavior has been implemented/i.test(realtimeReadme);
  if (config?.realtimeRuntimeImplemented !== runtimeImplemented) fail("realtimeRuntimeImplemented must match workspace truth");

  const indicator = config?.indicator;
  if (indicator?.name !== "realtime_delivery_latency_ms") fail("indicator name drift");
  if (indicator?.unit !== "milliseconds" || indicator?.type !== "distribution") fail("indicator unit/type drift");
  if (!indicator?.startEvent || !indicator?.endEvent || !indicator?.samplePopulation) fail("latency boundary incomplete");
  for (const key of ["clientRenderExcluded","clientAckExcluded","eventsWithoutEligibleSubscriberExcluded","failedDeliveryAttemptExcludedFromLatencyDistribution"]) {
    if (indicator?.[key] !== true) fail(`indicator guardrail disabled: ${key}`);
  }

  const clock = config?.clock;
  if (clock?.required !== "monotonic server-side clock") fail("monotonic server-side clock required");
  for (const key of ["clientClockForbidden","eventEnvelopeIsoTimeForbiddenForDurationMath","wallClockForOrderingForbidden","negativeDurationForbidden"]) {
    if (clock?.[key] !== true) fail(`clock guardrail disabled: ${key}`);
  }

  const failure = config?.failureSemantics;
  for (const key of ["failedOrUnknownDeliveryBelongsToHigherLevelReliabilityIndicators","sequenceGapLatencySampleForbidden","sequenceGapRequiresAuthoritativeResync","duplicateDeliveryMayNotCreateSecondLatencySample"]) {
    if (failure?.[key] !== true) fail(`failure semantic disabled: ${key}`);
  }

  const measurement = config?.measurement;
  if (JSON.stringify(measurement?.requiredDimensions) !== JSON.stringify(["environment","event_type","outcome"])) fail("required dimensions drift");
  for (const key of ["correlationIdAsMetricDimensionForbidden","auctionIdAsMetricDimensionForbidden","connectionIdAsMetricDimensionForbidden","userIdAsMetricDimensionForbidden","piiForbidden","rawCredentialDataForbidden","eventPayloadCaptureForbidden"]) {
    if (measurement?.[key] !== true) fail(`measurement guardrail disabled: ${key}`);
  }
  if (measurement?.correlationIdAllowedForDiagnostics !== true) fail("correlation IDs must remain usable for diagnostics");

  const guardrails = config?.guardrails;
  if (guardrails?.noSloTargetInThisTask !== true) fail("27.04 must not define SLO targets");
  if (guardrails?.noLatencyTargetInThisTask !== true) fail("27.04 must not define latency targets");
  if (guardrails?.noProviderSpecificShortcut !== true) fail("provider-specific shortcut guardrail disabled");
  if (guardrails?.transportNeverAuthoritative !== true) fail("transport authority guardrail disabled");
  if (guardrails?.noTelemetryDerivedAcceptedBid !== true || guardrails?.noTelemetryDerivedWinner !== true) fail("auction authority guardrail disabled");
  if (guardrails?.registryOwnershipTask !== "24.12") fail("registry ownership drift");
  if (guardrails?.reconnectOwnershipTask !== "27.05") fail("reconnect ownership drift");

  const serialized = JSON.stringify(config);
  if (/"target"\s*:\s*[0-9]/i.test(serialized) || /"sloPercent"\s*:/i.test(serialized) || /"latencyTargetMs"\s*:/i.test(serialized)) fail("27.04 must not invent target values");

  if (pkg?.scripts?.["verify:realtime-delivery-latency-sli"] !== "node scripts/verify-realtime-delivery-latency-sli.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:realtime-delivery-latency-sli:self-test"] !== "node scripts/verify-realtime-delivery-latency-sli.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-realtime-delivery-latency-sli.mjs", "--self-test"]')) fail("27.04 missing from system pre-gates");

  return { eventTypes: eventTypes.length, runtimeImplemented };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const realtimeReadme = fs.readFileSync(REALTIME_README_PATH, "utf8");
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, registry, realtimeReadme, pkg, preGateSource);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, registry, realtimeReadme, pkg, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("client render included", c => { c.indicator.clientRenderExcluded = false; });
  reject("client clock allowed", c => { c.clock.clientClockForbidden = false; });
  reject("sequence gap sampled", c => { c.failureSemantics.sequenceGapLatencySampleForbidden = false; });
  reject("duplicate creates second sample", c => { c.failureSemantics.duplicateDeliveryMayNotCreateSecondLatencySample = false; });
  reject("connection ID dimension allowed", c => { c.measurement.connectionIdAsMetricDimensionForbidden = false; });
  reject("transport becomes authoritative", c => { c.guardrails.transportNeverAuthoritative = false; });
  reject("latency target invented", c => { c.latencyTargetMs = 150; });
  reject("runtime truth falsified", c => { c.realtimeRuntimeImplemented = !c.realtimeRuntimeImplemented; });

  let registryRejected = false;
  const badRegistry = structuredClone(registry);
  badRegistry.transportAuthority = true;
  try { validate(config, badRegistry, realtimeReadme, pkg, preGateSource); } catch { registryRejected = true; }
  if (!registryRejected) fail("registry authority drift self-test not rejected");
  cases += 1;

  let preGateRejected = false;
  try {
    validate(config, registry, realtimeReadme, pkg, preGateSource.replace('["scripts/verify-realtime-delivery-latency-sli.mjs", "--self-test"]', ""));
  } catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`REALTIME_DELIVERY_LATENCY_SLI_SELF_TEST PASS cases=${cases} events=${result.eventTypes} runtime_implemented=${result.runtimeImplemented} fail_closed=true`);
} else {
  console.log(`REALTIME_DELIVERY_LATENCY_SLI PASS task=27.04 events=${result.eventTypes} runtime_implemented=${result.runtimeImplemented}`);
}

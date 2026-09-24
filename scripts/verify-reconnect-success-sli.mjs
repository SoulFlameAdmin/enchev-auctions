import fs from "node:fs";

const CONFIG_PATH = "config/enchev-reconnect-success-sli.json";
const REGISTRY_PATH = "config/enchev-websocket-event-registry.json";
const REALTIME_README_PATH = "apps/realtime/README.md";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`RECONNECT_SUCCESS_SLI FAIL: ${message}`);
}

export function validate(config, registry, realtimeReadme, pkg, preGateSource) {
  if (config?.taskId !== "27.05") fail("taskId must be 27.05");
  if (config?.name !== "Reconnect success SLI") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.scope !== "measurement-contract-only") fail("scope drift");
  if (config?.targetOwnershipTask !== "27.07") fail("SLO target ownership must remain 27.07");
  if (config?.eventRegistrySource !== REGISTRY_PATH) fail("registry source drift");
  if (config?.realtimeWorkspace !== "apps/realtime") fail("realtime workspace drift");
  if (config?.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if (config?.telemetryMayMutateAuctionState !== false) fail("telemetry must not mutate auction state");

  if (registry?.task !== "24.12") fail("registry task drift");
  if (registry?.transportAuthority !== false) fail("realtime transport must remain non-authoritative");
  if (registry?.sequenceScope !== "auction-stream") fail("registry sequence scope drift");
  if (!String(registry?.gapPolicy).toLowerCase().includes("resync")) fail("registry gap/resync policy missing");
  const eventTypes = new Set((registry?.events || []).map(item => item.type));
  if (!eventTypes.has("enchev.auction.snapshot.v1")) fail("snapshot recovery event missing");
  if (!eventTypes.has("enchev.resync.required.v1")) fail("resync-required event missing");

  const runtimeImplemented = !/service shell only/i.test(realtimeReadme) && !/without claiming that WebSocket\/realtime runtime behavior has been implemented/i.test(realtimeReadme);
  if (config?.realtimeRuntimeImplemented !== runtimeImplemented) fail("realtimeRuntimeImplemented must match workspace truth");

  const indicator = config?.indicator;
  if (indicator?.name !== "reconnect_success_ratio" || indicator?.type !== "ratio") fail("indicator drift");
  if (!indicator?.numerator || !indicator?.denominator) fail("ratio definition incomplete");
  for (const key of ["successRequiresTransportReestablished","successRequiresAuthoritativeBaseline","successRequiresSafeSequenceResume","unknownOutcomeCountsAsFailure","timeoutCountsAsFailure"]) {
    if (indicator?.[key] !== true) fail(`indicator guardrail disabled: ${key}`);
  }

  const recovery = config?.baselineRecovery;
  if (!Array.isArray(recovery?.acceptedMechanisms) || recovery.acceptedMechanisms.length !== 2) fail("baseline recovery mechanisms drift");
  if (!recovery.acceptedMechanisms.includes("enchev.auction.snapshot.v1")) fail("snapshot recovery missing");
  if (!recovery.acceptedMechanisms.includes("authoritative HTTP/PostgreSQL-backed resync")) fail("authoritative resync missing");
  for (const key of ["sequenceGapRequiresResync","incrementalResumeBeforeBaselineForbidden","resyncRequiredEventIsInstructionNotSuccess","duplicateEventMayNotCreateReconnectSuccess"]) {
    if (recovery?.[key] !== true) fail(`baseline recovery guardrail disabled: ${key}`);
  }

  const eligibility = config?.eligibility;
  for (const key of ["unexpectedDisconnectIncluded","networkInterruptionIncluded","serverRestartIncluded","userIntentionalDisconnectExcluded","pageNavigationAwayExcluded","explicitLogoutExcluded"]) {
    if (eligibility?.[key] !== true) fail(`eligibility guardrail disabled: ${key}`);
  }
  if (eligibility?.syntheticAttemptsExcluded !== false) fail("synthetic reconnect attempts must not be silently excluded");

  const measurement = config?.measurement;
  if (JSON.stringify(measurement?.requiredDimensions) !== JSON.stringify(["environment","outcome"])) fail("required dimensions drift");
  for (const key of ["correlationIdAsMetricDimensionForbidden","auctionIdAsMetricDimensionForbidden","connectionIdAsMetricDimensionForbidden","userIdAsMetricDimensionForbidden","piiForbidden","rawCredentialDataForbidden","eventPayloadCaptureForbidden"]) {
    if (measurement?.[key] !== true) fail(`measurement guardrail disabled: ${key}`);
  }
  if (measurement?.correlationIdAllowedForDiagnostics !== true) fail("correlation IDs must remain usable for diagnostics");

  const guardrails = config?.guardrails;
  if (guardrails?.noSloTargetInThisTask !== true) fail("27.05 must not define SLO targets");
  if (guardrails?.noRetryBudgetInThisTask !== true) fail("27.05 must not define retry budgets");
  if (guardrails?.noProviderSpecificShortcut !== true) fail("provider shortcut guardrail disabled");
  if (guardrails?.transportReopenAloneIsNotSuccess !== true) fail("transport reopen cannot equal success");
  if (guardrails?.transportNeverAuthoritative !== true) fail("transport authority guardrail disabled");
  if (guardrails?.noTelemetryDerivedAcceptedBid !== true || guardrails?.noTelemetryDerivedWinner !== true) fail("auction authority guardrail disabled");
  if (guardrails?.registryOwnershipTask !== "24.12") fail("registry ownership drift");
  if (guardrails?.retryBudgetOwnershipTask !== "27.10") fail("retry budget ownership drift");

  const serialized = JSON.stringify(config);
  if (/"target"\s*:\s*[0-9]/i.test(serialized) || /"sloPercent"\s*:/i.test(serialized) || /"retryBudget"\s*:\s*[0-9]/i.test(serialized)) fail("27.05 must not invent target/budget values");

  if (pkg?.scripts?.["verify:reconnect-success-sli"] !== "node scripts/verify-reconnect-success-sli.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:reconnect-success-sli:self-test"] !== "node scripts/verify-reconnect-success-sli.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-reconnect-success-sli.mjs", "--self-test"]')) fail("27.05 missing from system pre-gates");

  return { runtimeImplemented, events: eventTypes.size };
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

  reject("transport reopen alone accepted", c => { c.guardrails.transportReopenAloneIsNotSuccess = false; });
  reject("baseline not required", c => { c.indicator.successRequiresAuthoritativeBaseline = false; });
  reject("unknown counted good", c => { c.indicator.unknownOutcomeCountsAsFailure = false; });
  reject("sequence gap skips resync", c => { c.baselineRecovery.sequenceGapRequiresResync = false; });
  reject("resync instruction treated as success", c => { c.baselineRecovery.resyncRequiredEventIsInstructionNotSuccess = false; });
  reject("synthetic silently excluded", c => { c.eligibility.syntheticAttemptsExcluded = true; });
  reject("connection ID dimension allowed", c => { c.measurement.connectionIdAsMetricDimensionForbidden = false; });
  reject("retry budget invented", c => { c.retryBudget = 3; });
  reject("runtime truth falsified", c => { c.realtimeRuntimeImplemented = !c.realtimeRuntimeImplemented; });

  let registryRejected = false;
  const badRegistry = structuredClone(registry);
  badRegistry.events = badRegistry.events.filter(item => item.type !== "enchev.auction.snapshot.v1");
  try { validate(config, badRegistry, realtimeReadme, pkg, preGateSource); } catch { registryRejected = true; }
  if (!registryRejected) fail("missing snapshot registry self-test not rejected");
  cases += 1;

  let preGateRejected = false;
  try {
    validate(config, registry, realtimeReadme, pkg, preGateSource.replace('["scripts/verify-reconnect-success-sli.mjs", "--self-test"]', ""));
  } catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`RECONNECT_SUCCESS_SLI_SELF_TEST PASS cases=${cases} events=${result.events} runtime_implemented=${result.runtimeImplemented} fail_closed=true`);
} else {
  console.log(`RECONNECT_SUCCESS_SLI PASS task=27.05 events=${result.events} runtime_implemented=${result.runtimeImplemented}`);
}

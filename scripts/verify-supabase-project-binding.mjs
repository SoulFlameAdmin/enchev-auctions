import fs from 'node:fs';

const CONFIG_PATH = 'config/enchev-supabase-project.json';
const CLIENT_PATH = 'app/components/CloudPlanStateSync.tsx';
const SYNC_PATH = 'scripts/sync-cloud-plan-state.mjs';
const WORKFLOW_PATH = '.github/workflows/verify-enchev-web.yml';

const EXPECTED = {
  project_ref: 'frhletkiuupgksmgxoxc',
  project_url: 'https://frhletkiuupgksmgxoxc.supabase.co',
  project_name: 'soulflame-twins',
  region: 'eu-west-1',
  expected_status: 'ACTIVE_HEALTHY',
};

function fail(message) {
  throw new Error(`SUPABASE_PROJECT_BINDING FAIL: ${message}`);
}

function assertArrayEquals(actual, expected, label) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) fail(`${label} mismatch`);
}

export function validateBinding(config, sources) {
  for (const [key, value] of Object.entries(EXPECTED)) {
    if (config[key] !== value) fail(`${key} expected ${value}, got ${config[key]}`);
  }

  if (config.shared_project !== true) fail('shared_project must be explicitly true');
  if (config.scope !== 'development-governance') fail('scope must stay development-governance');
  if (config.auction_authority !== false) fail('shared Supabase project must not be marked auction authority');

  assertArrayEquals(config.enchev_resources?.tables || [], [
    'public.enchev_development_events',
    'public.enchev_plan_state',
  ], 'Enchev table allowlist');

  assertArrayEquals(config.enchev_resources?.edge_functions || [], [
    'enchev-development-status',
    'enchev-plan-state',
  ], 'Enchev edge-function allowlist');

  const serialized = JSON.stringify(config);
  if (/(service[_-]?role|password|secret|api[_-]?key|publishable[_-]?key|access[_-]?token)/i.test(serialized)) {
    fail('binding config must not contain credentials or secret material');
  }

  const endpoint = `${config.project_url}/functions/v1/enchev-plan-state`;
  if (!sources.client.includes(endpoint)) fail('CloudPlanStateSync endpoint does not match canonical Supabase project');
  if (!sources.sync.includes(endpoint)) fail('cloud sync endpoint does not match canonical Supabase project');
  if (!sources.workflow.includes('Supabase project binding invariant')) fail('CI invariant step missing');
  if (!sources.workflow.includes('Supabase project binding self-tests')) fail('CI self-test step missing');
  if (!sources.workflow.includes('Supabase project live endpoint')) fail('CI live endpoint step missing');

  return { endpoint, projectRef: config.project_ref, region: config.region };
}

// Billing failure on the legacy, read-only development-governance project must
// never be mistaken for an auction-pilot failure. Only PR previews may report
// the *specific* HTTP 402 as degraded; main remains a strict live health gate.
export function isPreviewOnlyLegacyBillingOutage(status, preview) {
  return preview === true && status === 402;
}

async function validateLive(config, preview = false) {
  const url = `${config.project_url}/functions/v1/enchev-plan-state`;
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (isPreviewOnlyLegacyBillingOutage(response.status, preview)) {
    console.warn('::warning title=Legacy governance unavailable::HTTP 402 from shared development-governance Supabase; pilot preview may proceed, but cloud Master Plan sync is NOT verified. Production remains blocked until restored.');
    console.log('SUPABASE_PROJECT_LIVE DEGRADED scope=legacy-governance status=402 preview-only');
    return;
  }
  if (!response.ok) fail(`live endpoint HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.rows)) fail('live endpoint response missing rows array');
  console.log(`SUPABASE_PROJECT_LIVE PASS endpoint=${url} rows=${body.rows.length}`);
}

function runSelfTest(config, sources) {
  validateBinding(config, sources);
  const badCases = [
    { ...config, project_ref: 'wrong-project' },
    { ...config, project_url: 'https://wrong.supabase.co' },
    { ...config, shared_project: false },
    { ...config, auction_authority: true },
    { ...config, scope: 'production-auction-authority' },
    { ...config, secret: 'must-not-exist' },
    { ...config, enchev_resources: { ...config.enchev_resources, tables: ['public.enchev_plan_state'] } },
  ];

  for (const [index, candidate] of badCases.entries()) {
    let rejected = false;
    try { validateBinding(candidate, sources); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test ${index + 1} was not rejected`);
  }

  // A regression must never make auth failures or unknown outages look healthy.
  if (!isPreviewOnlyLegacyBillingOutage(402, true) ||
      isPreviewOnlyLegacyBillingOutage(402, false) ||
      [200, 201, 400, 401, 403, 404, 429, 500, 503].some(status => isPreviewOnlyLegacyBillingOutage(status, true))) {
    fail('legacy billing preview policy broken');
  }
  console.log(`SUPABASE_PROJECT_BINDING_SELF_TEST PASS cases=${badCases.length} preview_policy_cases=12`);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const sources = {
  client: fs.readFileSync(CLIENT_PATH, 'utf8'),
  sync: fs.readFileSync(SYNC_PATH, 'utf8'),
  workflow: fs.readFileSync(WORKFLOW_PATH, 'utf8'),
};

if (process.argv.includes('--self-test')) {
  runSelfTest(config, sources);
} else if (process.argv.includes('--preview-live')) {
  validateBinding(config, sources);
  await validateLive(config, true);
} else if (process.argv.includes('--live')) {
  validateBinding(config, sources);
  await validateLive(config);
} else {
  const result = validateBinding(config, sources);
  console.log(`SUPABASE_PROJECT_BINDING PASS ref=${result.projectRef} region=${result.region}`);
}

import fs from 'node:fs';

const SOURCE_PATH = 'app/components/MasterSystemPlanV1.tsx';
const EXPECTED_VERSION = '1.0 FROZEN';

function fail(message) {
  throw new Error(`PLAN_VERSION_UI FAIL: ${message}`);
}

export function validatePlanVersionSource(source) {
  const declaration = source.match(/const\s+PLAN_VERSION\s*=\s*["']([^"']+)["']\s*;/);
  if (!declaration) fail('PLAN_VERSION constant is missing');
  if (declaration[1] !== EXPECTED_VERSION) fail(`expected ${EXPECTED_VERSION}, got ${declaration[1]}`);

  if (!/Plan version displayed in UI/.test(source)) fail('32.10 task label is missing from the frozen plan');

  const compactSurface = /Master\s+System\s+Plan\s+v\s*\{\s*PLAN_VERSION\s*\}/.test(source);
  const commandCenterSurface = /MASTER\s+SYSTEM\s+PLAN\s+v\s*\{\s*PLAN_VERSION\s*\}/.test(source);
  if (!compactSurface) fail('compact Command Center plan version display is missing');
  if (!commandCenterSurface) fail('full Command Center plan version display is missing');

  const versionBindings = source.match(/v\s*\{\s*PLAN_VERSION\s*\}/g) || [];
  if (versionBindings.length < 2) fail('plan version must be visibly bound to PLAN_VERSION in at least two UI surfaces');

  return { version: declaration[1], visibleBindings: versionBindings.length };
}

function runSelfTest() {
  const good = `
    const PLAN_VERSION = "1.0 FROZEN";
    const raw = [["32","Master plan governance",["Plan version displayed in UI"]]];
    <small>Master System Plan v{PLAN_VERSION}</small>
    <div>MASTER SYSTEM PLAN v{PLAN_VERSION}</div>
  `;
  validatePlanVersionSource(good);

  const badCases = [
    good.replace('1.0 FROZEN', '1.1 DRAFT'),
    good.replace('Master System Plan v{PLAN_VERSION}', 'Master System Plan'),
    good.replace('MASTER SYSTEM PLAN v{PLAN_VERSION}', 'MASTER SYSTEM PLAN'),
    good.replace('Plan version displayed in UI', 'Version hidden'),
  ];

  for (const [index, candidate] of badCases.entries()) {
    let rejected = false;
    try { validatePlanVersionSource(candidate); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test ${index + 1} was not rejected`);
  }

  console.log('PLAN_VERSION_UI_SELF_TEST PASS cases=4');
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const result = validatePlanVersionSource(source);
  console.log(`PLAN_VERSION_UI PASS version=${result.version} visibleBindings=${result.visibleBindings}`);
}

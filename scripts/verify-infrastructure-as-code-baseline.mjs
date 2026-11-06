import fs from "node:fs";

const CONFIG_PATH = "config/enchev-iac-baseline.json";
const ENV_PATH = "config/enchev-runtime-environments.json";
const VERCEL_PATH = "vercel.json";
const GATE_PATH = "scripts/run-system-test-pre-gates.mjs";
const REQUIRED = [
  ["web-deployment","vercel.json","deployment-configuration"],
  ["database-schema","supabase/migrations","versioned-postgresql-migrations"],
  ["ci-pipelines",".github/workflows","versioned-ci-workflows"],
  ["environment-matrix","config/enchev-runtime-environments.json","environment-contract"]
];

function fail(message) { throw Error("IAC_BASELINE_48_01 FAIL: " + message); }

export function validate(config, env, vercel, pathExists, gateSource) {
  if (config?.taskId !== "48.01" || config?.version !== 1) fail("identity drift");
  if (config?.scope !== "source-controlled declarative inventory, not provider provisioning") fail("scope overclaim");
  if (!Array.isArray(config.resources) || config.resources.length !== REQUIRED.length) fail("resource inventory count drift");
  const ids = new Set(), sources = new Set();
  for (const [id, source, kind] of REQUIRED) {
    const item = config.resources.find(x => x?.id === id);
    if (!item || item.source !== source || item.kind !== kind) fail("missing or modified source: " + id);
    if (item.provisioningCertified !== false) fail("uncertified provider provisioning: " + id);
    if (!pathExists(source)) fail("repository source absent: " + source);
  }
  for (const item of config.resources) {
    if (ids.has(item.id) || sources.has(item.source)) fail("duplicate resources");
    ids.add(item.id); sources.add(item.source);
  }
  if (JSON.stringify(config.environments) !== JSON.stringify(["local","staging","production"])) fail("environment list drift");
  const s = config.security;
  if (!s || s.secretValuesInRepository !== false || s.productionProviderApplyAllowedByThisTask !== false ||
      s.stagingIsolatedFromProductionMustBeProven !== true || s.infrastructureChangesRequireReview !== true ||
      s.providerStateOwnershipVerified !== false) fail("unsafe or overstated security boundary");
  const b = config.boundaries;
  if (!b || b.verifiedBy !== "scripts/verify-infrastructure-as-code-baseline.mjs" ||
      b.providerCredentialsNotRequired !== true || b.noNetworkOrCloudWrite !== true ||
      b.noDnsTlsOrStagingProvisioningClaim !== true || b.futureProvisioningTask !== "48.02") fail("scope boundary drift");
  if (env?.task !== "01.07" || env?.secret_values_in_repository !== false) fail("environment baseline missing");
  const e = env?.environments;
  if (!Array.isArray(e) || e.length !== 3) fail("environment matrix incomplete");
  for (const [name, authority] of [["local",false],["staging",false],["production",true]]) {
    const item = e.find(x => x.name === name);
    if (!item || item.production_authority !== authority) fail("environment production authority changed: " + name);
  }
  if (vercel?.$schema !== "https://openapi.vercel.sh/vercel.json" || typeof vercel?.git !== "object") fail("invalid Vercel config baseline");
  if (!gateSource.includes('["scripts/verify-infrastructure-as-code-baseline.mjs", "--self-test"]')) fail("CI pre-gate missing");
  return true;
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const env=JSON.parse(fs.readFileSync(ENV_PATH,"utf8"));
const vercel=JSON.parse(fs.readFileSync(VERCEL_PATH,"utf8"));
const gate=fs.readFileSync(GATE_PATH,"utf8");
const exists=(source)=>fs.existsSync(source);
validate(config,env,vercel,exists,gate);
if (fs.readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).length===0) fail("SQL migration baseline is empty");
if (fs.readdirSync(".github/workflows").filter(x=>/\.ya?ml$/.test(x)).length===0) fail("CI workflow baseline is empty");

if (process.argv.includes("--self-test")) {
  let cases=0;
  const reject=(name,mutate)=>{
    const candidate=structuredClone(config);
    mutate(candidate);
    let denied=false;
    try { validate(candidate,env,vercel,exists,gate); } catch { denied=true; }
    if (!denied) fail("negative case accepted: " + name);
    cases++;
  };
  reject("secret values allowed",c=>{c.security.secretValuesInRepository=true;});
  reject("production apply allowed",c=>{c.security.productionProviderApplyAllowedByThisTask=true;});
  reject("provider provisioning overclaimed",c=>{c.resources[0].provisioningCertified=true;});
  reject("migrations removed",c=>{c.resources.splice(1,1);});
  reject("source path swapped",c=>{c.resources[1].source="other/migrations";});
  reject("duplicate inventory",c=>{c.resources[2].source="vercel.json";});
  reject("staging isolation unrequired",c=>{c.security.stagingIsolatedFromProductionMustBeProven=false;});
  reject("provider ownership guessed",c=>{c.security.providerStateOwnershipVerified=true;});
  console.log("IAC_BASELINE_48_01_SELF_TEST PASS cases="+cases+" cloud_mutation=false");
} else {
  console.log("IAC_BASELINE_48_01 PASS inventory=4 cloud_mutation=false provisioning_certified=false");
}

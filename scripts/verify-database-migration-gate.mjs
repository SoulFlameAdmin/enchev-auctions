import fs from "node:fs";

const CONFIG_PATH="config/enchev-database-migration-gate.json";
const MIGRATION_CONFIG_PATH="config/enchev-database-migrations.json";
const STRUCTURE_VERIFIER_PATH="scripts/verify-database-migrations-structure.mjs";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";
const PACKAGE_PATH="package.json";

function fail(message){throw new Error(`DATABASE_MIGRATION_GATE FAIL: ${message}`);}

export function validate(config,migrationConfig,structureSource,preGateSource,pkg){
  if(config?.taskId!=="26.07")fail("taskId must be 26.07");
  if(config?.name!=="Database migration gate"||config?.gateVersion!==1)fail("identity drift");
  if(config?.migrationRoot!=="supabase/migrations")fail("migration root drift");
  if(config?.baselineTask!=="02.09")fail("baseline task drift");

  for(const key of [
    "appendOnlyHistory",
    "timestampedSnakeCaseNames",
    "duplicateTimestampPrefixesForbidden",
    "modifiedExistingSqlForbidden",
    "deletedExistingSqlForbidden",
    "newSqlMustPassStructureVerifier",
    "ciFailureBlocksGreen"
  ]){
    if(config.rules?.[key]!==true)fail(`rule disabled: ${key}`);
  }

  if(config.execution?.ciCommand!=="npm test")fail("CI command drift");
  if(config.execution?.preGateRunner!==PRE_GATE_PATH)fail("pre-gate runner drift");
  if(config.execution?.structureVerifier!==STRUCTURE_VERIFIER_PATH)fail("structure verifier drift");
  if(config.execution?.liveDatabaseMutationRequired!==false)fail("live DB mutation must not be required");

  if(migrationConfig?.task!=="02.09"||migrationConfig?.migration_root!=="supabase/migrations"||migrationConfig?.append_only!==true){
    fail("02.09 migration baseline drift");
  }

  for(const token of [
    "DATABASE_MIGRATIONS_STRUCTURE FAIL",
    "duplicate migration timestamp prefix",
    "invalid migration filename"
  ]){
    if(!structureSource.includes(token))fail(`structure verifier missing marker: ${token}`);
  }

  if(!preGateSource.includes('["scripts/verify-database-migration-gate.mjs", "--self-test"]')){
    fail("stable system pre-gate runner missing 26.07");
  }

  if(pkg?.scripts?.test!=="node scripts/run-system-test-pre-gates.mjs && node scripts/run-ci-tests.mjs"){
    fail("aggregate npm test contract drift");
  }

  for(const key of ["contractSelfTestsPass","aggregateCiPasses","noDestructiveDbActionRequired"]){
    if(config.greenRules?.[key]!==true)fail(`GREEN rule disabled: ${key}`);
  }
  if(config.greenRules?.providerMigrationExecutionRemainsOwnedByTask!=="03.02"){
    fail("provider migration execution ownership drift");
  }

  return true;
}

export function validateDiff(changes){
  for(const change of changes){
    const path=change.path||"";
    if(!path.startsWith("supabase/migrations/")||!path.endsWith(".sql"))continue;
    if(change.status==="deleted")fail(`existing migration deleted: ${path}`);
    if(change.status==="modified")fail(`existing migration modified: ${path}`);
    if(change.status!=="added")fail(`unsupported migration change status ${change.status}: ${path}`);
  }
  return true;
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const migrationConfig=JSON.parse(fs.readFileSync(MIGRATION_CONFIG_PATH,"utf8"));
const structureSource=fs.readFileSync(STRUCTURE_VERIFIER_PATH,"utf8");
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
validate(config,migrationConfig,structureSource,preGateSource,pkg);

if(process.argv.includes("--self-test")){
  let cases=0;
  const rejectConfig=(label,mutate)=>{
    const c=structuredClone(config);mutate(c);let rejected=false;
    try{validate(c,migrationConfig,structureSource,preGateSource,pkg);}catch{rejected=true;}
    if(!rejected)fail(`negative self-test not rejected: ${label}`);
    cases+=1;
  };
  const rejectDiff=(label,changes)=>{
    let rejected=false;try{validateDiff(changes);}catch{rejected=true;}
    if(!rejected)fail(`negative diff self-test not rejected: ${label}`);
    cases+=1;
  };

  rejectConfig("append-only disabled",c=>{c.rules.appendOnlyHistory=false;});
  rejectConfig("live mutation required",c=>{c.execution.liveDatabaseMutationRequired=true;});
  rejectConfig("runner ownership stolen",c=>{c.greenRules.providerMigrationExecutionRemainsOwnedByTask="26.07";});
  rejectDiff("existing SQL modified",[{path:"supabase/migrations/20260920010101_example.sql",status:"modified"}]);
  rejectDiff("existing SQL deleted",[{path:"supabase/migrations/20260920010101_example.sql",status:"deleted"}]);
  validateDiff([{path:"supabase/migrations/20260920020202_new_gate.sql",status:"added"}]);
  cases+=1;

  console.log(`DATABASE_MIGRATION_GATE_SELF_TEST PASS cases=${cases} fail_closed=true`);
}else{
  console.log("DATABASE_MIGRATION_GATE PASS task=26.07 append_only=true live_db_mutation=false");
}

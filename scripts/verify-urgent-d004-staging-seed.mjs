// D004: deterministic, strictly offline staging rehearsal. This script NEVER
// connects to Supabase and NEVER provisions or changes any cloud resource.
// Real staging deployment is separately blocked by D003's unverified provider gates.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const load=path=>JSON.parse(readFileSync(path,"utf8"));
const cfg=load("config/urgent-D004-staging-seed-v1.json");
const fixture=load(cfg.fixturePath);
const canonical=load("test/fixtures/canonical-v1.json");
const d003=load("config/urgent-D003-db-binding-audit.json");
const days=load("app/data/urgent-119-days.json");

const fail=message=>{throw new Error("URGENT_D004_STAGING_SEED FAIL "+message)};
export function verifySeedContract(config,car,canon,audit,baseline){
 if(config.schemaVersion!==1||config.taskId!=="D004"||config.dependency!=="D003")fail("D004 identity/dependency drift");
 const day=baseline.tasks.find(x=>x.id==="D004");
 if(day?.dependency!=="D003"||day?.passCriteria!==config.originalAcceptance)fail("original D004 frozen acceptance mismatch");
 if(config.sourceOfTruth!=="config/urgent-D003-db-binding-audit.json")fail("untracked D003 dependency");
 if(config.status!=="blocked-awaiting-staging-database"||config.releaseAuthority!==false)fail("cannot mark staging task ready without a real database");
 if(audit.auditStatus!=="blocked-pending-provider-evidence"||audit.acceptancePolicy?.d003CanBeMarkedDone!==false)fail("do not skip D003 required provider checks");
 if(config.staging?.projectRef!==null||config.staging?.projectType!==null||config.staging?.isolationVerified!==false||config.staging?.roleVerified!==false||config.staging?.seedApplied!==false||config.staging?.productionDataCopied!==null)fail("staging provider must be proven first");
 if(config.staging.ownerApprovedCost!==false)fail("cost approval must not be invented");
 if(config.production?.runtimeDbRef!==null||config.production?.bindingVerified!==false||config.production?.writeCountFromD004!==null)fail("cannot claim a production write audit without provider access");
 if(config.dryRun?.mode!=="local-in-memory-only"||config.dryRun.networkAllowed!==false||config.dryRun.credentialReadAllowed!==false||config.dryRun.persistedFiles!==false||config.dryRun.requiresNoExternalResources!==true||config.dryRun.expectedSyntheticRows!==1)fail("offline rehearsal contract drift");
 for(const key of ["d004DoneAllowed","realAuctionAllowed","remoteSeedAllowed"]){if(config.policy?.[key]!==false)fail("unsafe policy "+key)}
 for(const key of ["requireD003Complete","neverCopyProductionCustomerData","neverUseProductionAsStaging","requireOwnerApprovalForChargeableProvisioning","neverExposeCredentials"]){if(config.policy?.[key]!==true)fail("missing required policy "+key)}
 const controls=config.controls||[];
 if(controls.length!==4||new Set(controls.map(x=>x.id)).size!==4||controls.some(x=>x.state!=="blocked"))fail("real staging gates must remain blocked");
 if(controls.map(x=>x.id).join(",")!=="D004-G1,D004-G2,D004-G3,D004-G4")fail("staging gates altered");
 if(car.schemaVersion!==1||car.taskId!=="D004"||car.syntheticOnly!==true||car.remoteWritesAuthorized!==false||car.sourceCanonicalFixture!=="test/fixtures/canonical-v1.json")fail("synthetic-only fixture contract");
 if(car.vehicle.id!==canon.fixtures.syntheticVehicle.id||car.vehicle.vin!==canon.fixtures.syntheticVehicle.vin||car.vehicle.lotNumber!==canon.fixtures.syntheticVehicle.lotNumber||car.vehicle.year!==canon.fixtures.syntheticVehicle.year)fail("canonical test car identity drift");
 if(car.auction.id!==canon.fixtures.syntheticAuction.id||car.auction.currency!=="XXX"||car.auction.realMoneyAllowed!==false||car.auction.liveBidsAllowed!==false)fail("no real money or bids");
 if(car.vehicle.canPublish!==false||car.vehicle.source!=="synthetic"||car.vehicle.titleStatus!=="TEST-ONLY-NO-TITLE")fail("fake car must not publish/claim a title");
 if(!car.seller.contactEmail.endsWith("@example.test")||car.seller.verifiedForRealSales!==false)fail("never use real seller data");
 if(!Array.isArray(car.labels)||!["SYNTHETIC","STAGING ONLY","NOT A REAL VEHICLE","NO PAYMENTS"].every(x=>car.labels.includes(x)))fail("mandatory synthetic labels");
 if(car.expected?.stagingVehicles!==1||car.expected?.productionWrites!==0||car.expected?.realMoneyEvents!==0)fail("fixture expected counts");
 const text=JSON.stringify({config,car});
 if(/(?:sb_secret_|sk_live_|-----BEGIN|service[_-]?role[_-]?key|password\s*[:=])/i.test(text))fail("no credential or private key source fields");
 return {projectReady:false, fixtureCount:1, remoteWritesAllowed:false};
}
export function offlineSeedOneCar(car){
 const db=new DatabaseSync(":memory:");
 try{
  // A separate ephemeral SQLite database proves fixture determinism only.
  // This is NOT a Supabase staging instance and cannot satisfy D004.
  db.exec("CREATE TABLE d004_local_rehearsal_vehicle(id TEXT PRIMARY KEY, vin TEXT NOT NULL, lot TEXT NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL, model_year INTEGER NOT NULL, synthetic INTEGER NOT NULL CHECK(synthetic = 1), can_publish INTEGER NOT NULL CHECK(can_publish = 0), currency TEXT NOT NULL CHECK(currency = 'XXX'), seller_email TEXT NOT NULL)");
  const insert=db.prepare("INSERT OR IGNORE INTO d004_local_rehearsal_vehicle (id,vin,lot,make,model,model_year,synthetic,can_publish,currency,seller_email) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const args=[car.vehicle.id,car.vehicle.vin,car.vehicle.lotNumber,car.vehicle.make,car.vehicle.model,car.vehicle.year,1,0,"XXX",car.seller.contactEmail];
  insert.run(...args);
  insert.run(...args); // repeated dry-run must not create duplicates
  const rows=db.prepare("SELECT * FROM d004_local_rehearsal_vehicle").all();
  assert.equal(rows.length,1,"one and only one fake vehicle");
  assert.equal(rows[0].id,car.vehicle.id);
  assert.equal(rows[0].vin,car.vehicle.vin);
  assert.equal(rows[0].can_publish,0);
  assert.equal(rows[0].synthetic,1);
  assert.equal(rows[0].currency,"XXX");
  const result={records:rows.length,synthetic:true,localOnly:true,remoteSeedExecuted:false,productionDatabaseInspected:false,actualStagingCertified:false};
  return result;
 }finally{db.close()}
}
const output=verifySeedContract(cfg,fixture,canonical,d003,days);
const run=offlineSeedOneCar(fixture);
assert.equal(output.fixtureCount,run.records);
console.log("URGENT_D004_OFFLINE_REHEARSAL PASS synthetic_cars=1 sqlite_in_memory=true external_connections=0 actual_supabase_staging=NOT_VERIFIED task_acceptance=BLOCKED");
if(process.argv.includes("--self-test")){
 const clone=x=>structuredClone(x);
 const reject=(label,which,mutate)=>{
  const cfgCopy=clone(cfg),fixtureCopy=clone(fixture),auditCopy=clone(d003);
  mutate({config:cfgCopy,car:fixtureCopy,audit:auditCopy});
  assert.throws(()=>verifySeedContract(cfgCopy,fixtureCopy,canonical,auditCopy,days),undefined,label);
 };
 reject("fake staging project", "config",({config})=>{config.staging.projectRef="unverified-project"});
 reject("fake staging isolation", "config",({config})=>{config.staging.isolationVerified=true});
 reject("role not proved", "config",({config})=>{config.staging.roleVerified=true});
 reject("seed not applied", "config",({config})=>{config.staging.seedApplied=true});
 reject("fake production write audit", "config",({config})=>{config.production.writeCountFromD004=0});
 reject("fake cost permission", "config",({config})=>{config.staging.ownerApprovedCost=true});
 reject("enable remote write", "config",({config})=>{config.policy.remoteSeedAllowed=true});
 reject("enable real money", "config",({config})=>{config.policy.realAuctionAllowed=true});
 reject("fake task done", "config",({config})=>{config.policy.d004DoneAllowed=true});
 reject("fake D003 pass", "audit",({audit})=>{audit.acceptancePolicy.d003CanBeMarkedDone=true});
 reject("altered synthetic ID", "car",({car})=>{car.vehicle.id="some-new-identifier"});
 reject("realistic seller email", "car",({car})=>{car.seller.contactEmail="seller@real-provider.com"});
 reject("publish fake car", "car",({car})=>{car.vehicle.canPublish=true});
 reject("real currency", "car",({car})=>{car.auction.currency="EUR"});
 reject("remote fixture write", "car",({car})=>{car.remoteWritesAuthorized=true});
 reject("expected prod write", "car",({car})=>{car.expected.productionWrites=1});
 console.log("URGENT_D004_OFFLINE_REHEARSAL_SELF_TEST PASS negative_cases=16 no_network_calls=true");
}

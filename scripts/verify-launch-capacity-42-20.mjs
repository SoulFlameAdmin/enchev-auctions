import fs from "node:fs";

const config=JSON.parse(fs.readFileSync("config/enchev-launch-capacity-42-20.json","utf8"));
const soak=JSON.parse(fs.readFileSync(process.env.ENCHEV_42_14_OUTPUT||"artifacts/42-14-15/soak-memory.json","utf8"));
const cpu=JSON.parse(fs.readFileSync(process.env.ENCHEV_42_16_OUTPUT||"artifacts/42-16/cpu-saturation.json","utf8"));
const horizontal=JSON.parse(fs.readFileSync(process.env.ENCHEV_42_17_OUTPUT||"artifacts/42-17-19/horizontal-integrity.json","utf8"));
const shedding=JSON.parse(fs.readFileSync(process.env.ENCHEV_42_18_OUTPUT||"artifacts/42-18/load-shedding.json","utf8"));

function fail(message){throw new Error("LAUNCH_CAPACITY_42_20 FAIL: "+message);}

if(config.taskId!=="42.20"||config.title!=="Launch capacity limit documented"||config.version!==1) fail("identity drift");
if(config.status!=="preproduction-certified-local") fail("status drift");
if(config.productionLaunchApproved!==false) fail("production launch must remain unapproved");

if(!Array.isArray(soak.taskIds)||!soak.taskIds.includes("42.14")||!soak.taskIds.includes("42.15")||soak.certified!==true) fail("42.14/42.15 evidence missing");
if(Number(soak.durationSeconds)<600||soak.memory?.unboundedGrowthObserved!==false||Number(soak.failedResponses)!==0) fail("soak/memory evidence not launch-eligible");
if(cpu.taskId!=="42.16"||cpu.certified!==true||cpu.health?.recoveredAfterPressure!==true||Number(cpu.workload?.successfulResponses)!==Number(cpu.workload?.totalRequests)) fail("42.16 evidence not launch-eligible");
if(!Array.isArray(horizontal.taskIds)||!horizontal.taskIds.includes("42.17")||!horizontal.taskIds.includes("42.19")||horizontal.certified!==true) fail("42.17/42.19 evidence missing");
if(Number(horizontal.apiInstances)<2||horizontal.integrity?.noDataOrWinnerCorruption!==true||Number(horizontal.integrity?.winnerMismatch)!==0) fail("horizontal/integrity evidence not launch-eligible");
if(shedding.taskId!=="42.18"||shedding.certified!==true||shedding.shedBeforeAuthoritativeMutation!==true||shedding.fakeSuccessObserved!==false||Number(shedding.shed)<1) fail("42.18 evidence not launch-eligible");

const capacity=config.capacity;
for(const key of ["apiInstancesCertified","maxConcurrentBidRequestsPerApiInstance","initialAggregateConcurrentBidRequests","databasePoolConnectionsPerApiInstance","realtimeSubscribersPerInstance","admissionControlRecommendedMaxInflightPerApiInstance"]){
  if(!Number.isSafeInteger(capacity?.[key])||capacity[key]<1) fail("invalid capacity value: "+key);
}
if(capacity.apiInstancesCertified>horizontal.apiInstances) fail("documented API instance count exceeds certification");
if(capacity.initialAggregateConcurrentBidRequests>horizontal.peakLogicalConcurrentAuctions) fail("aggregate bid limit exceeds horizontal certification");
if(capacity.maxConcurrentBidRequestsPerApiInstance*capacity.apiInstancesCertified<capacity.initialAggregateConcurrentBidRequests) fail("aggregate limit exceeds per-instance envelope");
if(capacity.databasePoolConnectionsPerApiInstance>20) fail("DB pool limit exceeds 42.10 certified pool");
if(capacity.realtimeSubscribersPerInstance>500) fail("realtime limit exceeds 42.11 certified fanout");
if(capacity.admissionControlRecommendedMaxInflightPerApiInstance>capacity.maxConcurrentBidRequestsPerApiInstance) fail("admission limit exceeds documented per-instance concurrency");

const rules=config.operatingRules;
for(const key of ["doNotExceedDocumentedLimitsWithoutNewCertification","scaleBeforeSustainedSeventyPercentUtilization","authoritativeAuctionStateRemainsPostgreSQL","loadSheddingMustOccurBeforeAuthoritativeMutation"]){
  if(rules?.[key]!==true) fail("operating rule disabled: "+key);
}
if(rules.acceptedBidOrWinnerCorruptionTolerance!==0) fail("corruption tolerance must be zero");

const blockers=new Set(config.productionLaunchBlockers||[]);
for(const required of ["dedicated-auction-database-live-certification","production-websocket-session-authorization-integration","external-penetration-test-41.20","critical-high-resolution-41.21"]){
  if(!blockers.has(required)) fail("production launch blocker missing: "+required);
}

console.log(`LAUNCH_CAPACITY_42_20 PASS api_instances=${capacity.apiInstancesCertified} per_instance=${capacity.maxConcurrentBidRequestsPerApiInstance} aggregate=${capacity.initialAggregateConcurrentBidRequests} db_pool=${capacity.databasePoolConnectionsPerApiInstance} realtime=${capacity.realtimeSubscribersPerInstance} production_launch=false blockers=${blockers.size}`);

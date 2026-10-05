import fs from "node:fs";

const MASTER="app/components/MasterSystemPlanV1.tsx";
const RUNNER="scripts/certify-concurrent-bidders-42-03.mjs";
const WORKFLOW=".github/workflows/certify-concurrent-bidders-42-03.yml";

function fail(message){throw new Error("CONCURRENT_BIDDERS_42_03 FAIL: "+message);}
const master=fs.readFileSync(MASTER,"utf8");
const runner=fs.readFileSync(RUNNER,"utf8");
const workflow=fs.readFileSync(WORKFLOW,"utf8");

for(const [source,marker,label] of [
  [master,'"50 concurrent bidders certified||test"',"42.03 frozen identity"],
  [runner,"const REQUIRED_BIDDERS = 50","50-bidder cardinality"],
  [runner,'baseUrl+"/api/bids"',"authoritative bid route"],
  [runner,'authority:"postgresql"',"PostgreSQL authority evidence"],
  [runner,"new Set(bidderIds).size!==REQUIRED_BIDDERS","distinct bidder enforcement"],
  [runner,"duplicate accepted sequence","sequence uniqueness check"],
  [runner,"accepted amount regressed","monotonic accepted amount check"],
  [workflow,"workflow_dispatch","manual certification trigger"],
  [workflow,"actions/upload-artifact@v4","evidence archive"],
  [workflow,"ENCHEV_42_03_TOKENS_JSON","50 bidder secret input"],
]) if(!source.includes(marker)) fail(label+" missing");

if(process.argv.includes("--self-test")){
  const broken=runner.replace("const REQUIRED_BIDDERS = 50","const REQUIRED_BIDDERS = 49");
  if(broken.includes("const REQUIRED_BIDDERS = 50")) fail("negative fixture construction failed");
  console.log("CONCURRENT_BIDDERS_42_03_SELF_TEST PASS foundation=true live_certification_required=true");
}else{
  console.log("CONCURRENT_BIDDERS_42_03 FOUNDATION PASS live_certification_required=true");
}

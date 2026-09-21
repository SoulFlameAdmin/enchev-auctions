import fs from "node:fs";

const strategy = JSON.parse(fs.readFileSync("config/enchev-api-versioning-strategy.json", "utf8"));
const spec = JSON.parse(fs.readFileSync("packages/contracts/openapi/enchev-api.v1.json", "utf8"));

function valid(s, o) {
  return s.taskId === "24.02"
    && s.contractSeries === "v1"
    && s.maturity === "pre-stable"
    && s.currentInfoVersion === "0.1.0"
    && s.canonicalSpec === "packages/contracts/openapi/enchev-api.v1.json"
    && s.stableNamespaceTemplate === "/api/v{major}"
    && o.openapi === "3.1.0"
    && o.info?.version === "0.1.0";
}

if (!valid(strategy, spec)) throw new Error("24.02 API versioning strategy invalid");

if (process.argv.includes("--self-test")) {
  const invalid = { ...strategy, contractSeries: "invalid" };
  if (valid(invalid, spec)) throw new Error("24.02 self-test failed");
  console.log("24.02 API_VERSIONING_STRATEGY_SELF_TEST PASS");
} else {
  console.log("24.02 API_VERSIONING_STRATEGY PASS");
}

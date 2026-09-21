import fs from "node:fs";

const BASELINE_PATH = "config/enchev-schema-compatibility-baseline.json";

function fail(message) {
  throw new Error("24.13 SCHEMA_COMPATIBILITY_TESTS FAIL: " + message);
}

function sameScalar(a, b) {
  return Object.is(a, b);
}

function assertCompatible(base, current, path = "$") {
  if (!base || typeof base !== "object") return;
  if (!current || typeof current !== "object") fail(path + " missing");

  if ("type" in base && base.type !== current.type) {
    fail(path + " type changed from " + JSON.stringify(base.type) + " to " + JSON.stringify(current.type));
  }
  if ("const" in base && !sameScalar(base.const, current.const)) {
    fail(path + " const changed");
  }
  if (Array.isArray(base.enum)) {
    if (!Array.isArray(current.enum)) fail(path + " enum removed");
    for (const value of base.enum) {
      if (!current.enum.some((candidate) => sameScalar(candidate, value))) {
        fail(path + " enum narrowed; missing " + JSON.stringify(value));
      }
    }
  }

  if (typeof base.minimum === "number") {
    if (typeof current.minimum === "number" && current.minimum > base.minimum) {
      fail(path + " minimum tightened");
    }
  }
  if (typeof base.maximum === "number") {
    if (typeof current.maximum === "number" && current.maximum < base.maximum) {
      fail(path + " maximum tightened");
    }
  }
  if (typeof base.minLength === "number") {
    if (typeof current.minLength === "number" && current.minLength > base.minLength) {
      fail(path + " minLength tightened");
    }
  }
  if (typeof base.maxLength === "number") {
    if (typeof current.maxLength === "number" && current.maxLength < base.maxLength) {
      fail(path + " maxLength tightened");
    }
  }
  if ("pattern" in base && base.pattern !== current.pattern) {
    fail(path + " pattern changed");
  }

  if (Array.isArray(base.required)) {
    const required = new Set(Array.isArray(current.required) ? current.required : []);
    for (const field of base.required) {
      if (!required.has(field)) fail(path + " required field removed: " + field);
    }
  }

  if (base.properties && typeof base.properties === "object") {
    const currentProps = current.properties || {};
    for (const [name, child] of Object.entries(base.properties)) {
      if (!(name in currentProps)) fail(path + ".properties." + name + " removed");
      assertCompatible(child, currentProps[name], path + ".properties." + name);
    }
  }

  if (base.items) {
    if (!current.items) fail(path + ".items removed");
    assertCompatible(base.items, current.items, path + ".items");
  }

  if (Array.isArray(base.oneOf)) {
    if (!Array.isArray(current.oneOf)) fail(path + ".oneOf removed");
    for (let i = 0; i < base.oneOf.length; i += 1) {
      const baseBranch = base.oneOf[i];
      const matched = current.oneOf.some((candidate) => {
        try {
          assertCompatible(baseBranch, candidate, path + ".oneOf[" + i + "]");
          return true;
        } catch {
          return false;
        }
      });
      if (!matched) fail(path + ".oneOf baseline branch removed at index " + i);
    }
  }
}

export function validate(baseline, spec) {
  if (baseline.version !== 1 || baseline.task !== "24.13" || baseline.compatibilityLine !== "v1") {
    fail("baseline identity drift");
  }
  if (baseline.openApiPath !== "packages/contracts/openapi/enchev-api.v1.json") {
    fail("OpenAPI source path drift");
  }
  if (!String(baseline.authorityBoundary || "").includes("PostgreSQL remains authoritative")) {
    fail("authority boundary missing");
  }

  let componentCount = 0;
  for (const [name, schema] of Object.entries(baseline.componentSchemas || {})) {
    const current = spec?.components?.schemas?.[name];
    if (!current) fail("component schema removed: " + name);
    assertCompatible(schema, current, "#/components/schemas/" + name);
    componentCount += 1;
  }
  if (componentCount < 5) fail("component baseline incomplete");

  let headerCount = 0;
  for (const [name, schema] of Object.entries(baseline.headerSchemas || {})) {
    const current = spec?.components?.headers?.[name]?.schema;
    if (!current) fail("header schema removed: " + name);
    assertCompatible(schema, current, "#/components/headers/" + name + "/schema");
    headerCount += 1;
  }
  if (headerCount < 1) fail("header baseline incomplete");

  let requestCount = 0;
  for (const request of baseline.requestSchemas || []) {
    const operation = spec?.paths?.[request.path]?.[String(request.method).toLowerCase()];
    if (!operation) fail("request operation removed: " + request.method + " " + request.path);
    const body = operation.requestBody;
    if (!body) fail("request body removed: " + request.method + " " + request.path);
    if (request.required === true && body.required !== true) {
      fail("required request body weakened unexpectedly: " + request.method + " " + request.path);
    }
    const currentSchema = body?.content?.[request.contentType]?.schema;
    if (!currentSchema) fail("request content schema removed: " + request.method + " " + request.path);
    assertCompatible(request.schema, currentSchema, request.method + " " + request.path + " request");
    requestCount += 1;
  }
  if (requestCount < 1) fail("request baseline incomplete");

  return { componentCount, headerCount, requestCount };
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
const spec = JSON.parse(fs.readFileSync(baseline.openApiPath, "utf8"));
const result = validate(baseline, spec);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutateBaseline, mutateSpec) => {
    const b = structuredClone(baseline);
    const s = structuredClone(spec);
    if (mutateBaseline) mutateBaseline(b);
    if (mutateSpec) mutateSpec(s);
    let rejected = false;
    try { validate(b, s); } catch { rejected = true; }
    if (!rejected) fail("negative self-test accepted: " + label);
    cases += 1;
  };

  reject("required response field removed", null, (s) => {
    s.components.schemas.ComponentHealth.required = s.components.schemas.ComponentHealth.required.filter((x) => x !== "status");
  });
  reject("response property removed", null, (s) => {
    delete s.components.schemas.RedisHealth.properties.configured;
  });
  reject("response type changed", null, (s) => {
    s.components.schemas.LiveAuctionDemoClock.properties.lotId.type = "integer";
  });
  reject("enum narrowed", null, (s) => {
    s.components.schemas.ComponentHealth.properties.component.enum = ["web", "api", "realtime"];
  });
  reject("const drift", null, (s) => {
    s.components.schemas.LiveAuctionDemoClock.properties.auctionAuthority.const = true;
  });
  reject("numeric constraint tightened", null, (s) => {
    s.components.schemas.RedisHealth.properties.latencyMs.minimum = 10;
  });
  reject("header length tightened", null, (s) => {
    s.components.headers.RequestCorrelationId.schema.maxLength = 64;
  });
  reject("request required field added to baseline-protected object", null, (s) => {
    const schema = s.paths["/api/live-auction-clock"].post.requestBody.content["application/json"].schema;
    schema.required.push("clientNonce");
    schema.properties.clientNonce = { type: "string" };
  });
  reject("oneOf branch narrowed", null, (s) => {
    s.components.schemas.LiveAuctionDemoClock.properties.bidFeedback.oneOf[1].enum =
      s.components.schemas.LiveAuctionDemoClock.properties.bidFeedback.oneOf[1].enum.filter((x) => x !== "rejected");
  });
  reject("baseline identity drift", (b) => { b.task = "24.12"; }, null);

  console.log(
    "24.13 SCHEMA_COMPATIBILITY_TESTS_SELF_TEST PASS negative_cases=" + cases +
    " components=" + result.componentCount +
    " headers=" + result.headerCount +
    " requests=" + result.requestCount
  );
} else {
  console.log(
    "24.13 SCHEMA_COMPATIBILITY_TESTS PASS line=v1 components=" + result.componentCount +
    " headers=" + result.headerCount +
    " requests=" + result.requestCount
  );
}

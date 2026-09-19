import fs from "node:fs";

const REVIEW_PATH = "config/enchev-regional-data-residency-review.json";
const SUPABASE_PATH = "config/enchev-supabase-project.json";
const REDIS_PATH = "config/enchev-redis-environment.json";
const VERCEL_PATH = "vercel.json";
const CDN_SOURCE_PATH = "packages/config/src/regional-cdn-strategy.ts";
const DOC_PATH = "docs/21_14_REGIONAL_DATA_RESIDENCY_REVIEW.md";

const TOP_KEYS = [
  "data_planes",
  "legal_conclusion",
  "market_activation_approval",
  "name",
  "residency_compliance_approved",
  "review_completed",
  "review_version",
  "task",
  "unresolved_requirements"
];

const PLANE_KEYS = [
  "evidence",
  "id",
  "provider",
  "region",
  "residency_claim",
  "role",
  "status"
];

const EXPECTED_IDS = [
  "cdn-delivery",
  "development-governance-db",
  "object-storage",
  "redis-support",
  "runtime-compute",
  "runtime-observability"
];

const EXPECTED_UNRESOLVED = [
  "legal-compliance-sign-off",
  "object-storage-provider-region",
  "production-authoritative-database-region",
  "redis-provider-region",
  "runtime-compute-region-policy",
  "runtime-observability-region-retention"
];

const ALLOWED_STATUSES = new Set([
  "verified-region",
  "global-delivery",
  "region-unpinned",
  "provider-pending",
  "not-configured",
  "unverified"
]);

function fail(message) {
  throw new Error(`REGIONAL_DATA_RESIDENCY_REVIEW FAIL: ${message}`);
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} fields drift`);
  }
}

function planeById(review, id) {
  return review.data_planes.find((plane) => plane.id === id);
}

export function validateReview(review, sources) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    fail("review must be an object");
  }

  exactKeys(review, TOP_KEYS, "review");

  if (review.task !== "21.14") fail("task must be 21.14");
  if (review.name !== "Regional data/residency review") fail("name drift");
  if (review.review_version !== 1) fail("review_version must be 1");
  if (review.review_completed !== true) fail("review_completed must be true");
  if (review.legal_conclusion !== false) fail("legal_conclusion must remain false");
  if (review.residency_compliance_approved !== false) fail("residency_compliance_approved must remain false");
  if (review.market_activation_approval !== false) fail("market_activation_approval must remain false");

  if (!Array.isArray(review.data_planes)) fail("data_planes must be an array");
  const ids = review.data_planes.map((plane) => plane?.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    fail("data plane inventory must remain complete, unique, and sorted");
  }

  for (const [index, plane] of review.data_planes.entries()) {
    if (!plane || typeof plane !== "object" || Array.isArray(plane)) {
      fail(`data_planes[${index}] must be an object`);
    }
    exactKeys(plane, PLANE_KEYS, `data_planes[${index}]`);

    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(plane.id || "")) {
      fail(`invalid data plane id: ${plane.id}`);
    }
    if (!ALLOWED_STATUSES.has(plane.status)) {
      fail(`unsupported data plane status: ${plane.status}`);
    }
    if (plane.provider !== null && !/^[a-z][a-z0-9-]*$/.test(plane.provider)) {
      fail(`invalid provider: ${plane.provider}`);
    }
    if (typeof plane.role !== "string" || !plane.role) {
      fail(`${plane.id} role must be non-empty`);
    }
    if (plane.residency_claim !== false) {
      fail(`${plane.id} must not make a residency claim`);
    }
    if (!Array.isArray(plane.evidence) || plane.evidence.length === 0) {
      fail(`${plane.id} evidence must be non-empty`);
    }
    if (new Set(plane.evidence).size !== plane.evidence.length) {
      fail(`${plane.id} evidence must be unique`);
    }

    if (plane.status === "verified-region") {
      if (typeof plane.region !== "string" || !plane.region) {
        fail(`${plane.id} verified-region requires a region`);
      }
      if (!plane.provider) fail(`${plane.id} verified-region requires a provider`);
    } else if (plane.region !== null) {
      fail(`${plane.id} must not invent a region for status ${plane.status}`);
    }
  }

  if (JSON.stringify(review.unresolved_requirements) !== JSON.stringify(EXPECTED_UNRESOLVED)) {
    fail("unresolved residency requirements drift");
  }

  const supabasePlane = planeById(review, "development-governance-db");
  if (
    supabasePlane.provider !== "supabase" ||
    supabasePlane.status !== "verified-region" ||
    supabasePlane.region !== sources.supabase.region
  ) {
    fail("Supabase review plane must match canonical project binding region");
  }
  if (sources.supabase.scope !== "development-governance") {
    fail("Supabase binding scope must remain development-governance");
  }
  if (sources.supabase.auction_authority !== false) {
    fail("shared Supabase project must not become auction authority");
  }

  const redisPlane = planeById(review, "redis-support");
  if (
    redisPlane.provider !== null ||
    redisPlane.status !== "provider-pending" ||
    sources.redis.provider !== null ||
    sources.redis.binding_status !== "pending-live-provider"
  ) {
    fail("Redis review plane must preserve pending provider/region state");
  }
  if (sources.redis.authoritative_auction_state !== false) {
    fail("Redis must remain non-authoritative");
  }

  const runtimePlane = planeById(review, "runtime-compute");
  if (runtimePlane.provider !== "vercel" || runtimePlane.status !== "region-unpinned") {
    fail("runtime compute must remain region-unpinned until configuration evidence exists");
  }
  if (Object.prototype.hasOwnProperty.call(sources.vercel, "regions")) {
    fail("review says runtime-compute region-unpinned but vercel.json now configures regions");
  }
  if (Object.prototype.hasOwnProperty.call(sources.vercel, "functionFailoverRegions")) {
    fail("review must be updated when Vercel failover regions are configured");
  }

  const cdnPlane = planeById(review, "cdn-delivery");
  if (cdnPlane.provider !== "vercel" || cdnPlane.status !== "global-delivery") {
    fail("CDN review plane drift");
  }
  if (!sources.cdn.includes("dataResidencyClaim: false")) {
    fail("21.13 CDN strategy must explicitly reject a residency claim");
  }

  const objectPlane = planeById(review, "object-storage");
  if (objectPlane.provider !== null || objectPlane.status !== "not-configured") {
    fail("object storage must remain unconfigured until a provider is approved");
  }

  const observabilityPlane = planeById(review, "runtime-observability");
  if (observabilityPlane.provider !== "vercel" || observabilityPlane.status !== "unverified") {
    fail("runtime observability region/retention must remain unverified");
  }

  const serialized = JSON.stringify(review);
  if (/(password|service[_-]?role|secret|api[_-]?key|access[_-]?token|credential)/i.test(serialized)) {
    fail("review must not contain secret material or secret-like fields");
  }

  return {
    planes: review.data_planes.length,
    unresolved: review.unresolved_requirements.length,
    verifiedRegion: supabasePlane.region
  };
}

function validateDocumentation(doc) {
  for (const token of [
    "GREEN for 21.14 means",
    "residency_compliance_approved=false",
    "region-unpinned",
    "provider-pending",
    "not-configured",
    "21.13 Regional CDN strategy",
    "21.15 Unicode normalization",
    "does not require a Vercel create/update/redeploy operation"
  ]) {
    if (!doc.includes(token)) fail(`documentation boundary missing: ${token}`);
  }
}

function expectRejected(label, fn) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const review = JSON.parse(fs.readFileSync(REVIEW_PATH, "utf8"));
const sources = {
  supabase: JSON.parse(fs.readFileSync(SUPABASE_PATH, "utf8")),
  redis: JSON.parse(fs.readFileSync(REDIS_PATH, "utf8")),
  vercel: JSON.parse(fs.readFileSync(VERCEL_PATH, "utf8")),
  cdn: fs.readFileSync(CDN_SOURCE_PATH, "utf8")
};
const doc = fs.readFileSync(DOC_PATH, "utf8");

const result = validateReview(review, sources);
validateDocumentation(doc);

if (process.argv.includes("--self-test")) {
  expectRejected("legal conclusion", () => validateReview({ ...review, legal_conclusion: true }, sources));
  expectRejected("residency approval", () => validateReview({ ...review, residency_compliance_approved: true }, sources));
  expectRejected("market activation approval", () => validateReview({ ...review, market_activation_approval: true }, sources));
  expectRejected("fake Supabase region", () => validateReview({
    ...review,
    data_planes: review.data_planes.map((plane) =>
      plane.id === "development-governance-db" ? { ...plane, region: "fake-region" } : plane
    )
  }, sources));
  expectRejected("residency claim", () => validateReview({
    ...review,
    data_planes: review.data_planes.map((plane) =>
      plane.id === "runtime-compute" ? { ...plane, residency_claim: true } : plane
    )
  }, sources));
  expectRejected("invented Redis provider", () => validateReview({
    ...review,
    data_planes: review.data_planes.map((plane) =>
      plane.id === "redis-support" ? { ...plane, provider: "example" } : plane
    )
  }, sources));
  expectRejected("missing unresolved requirement", () => validateReview({
    ...review,
    unresolved_requirements: review.unresolved_requirements.slice(1)
  }, sources));
  expectRejected("unpinned review against pinned config", () => validateReview(review, {
    ...sources,
    vercel: { ...sources.vercel, regions: ["example-region"] }
  }));

  console.log("REGIONAL_DATA_RESIDENCY_REVIEW_SELF_TEST PASS negative_cases=8 planes=6 unresolved=6 legal_conclusion=false compliance_approved=false market_activation=false");
} else {
  console.log(`REGIONAL_DATA_RESIDENCY_REVIEW PASS task=21.14 planes=${result.planes} unresolved=${result.unresolved} verified_region=${result.verifiedRegion} compliance_approved=false`);
}

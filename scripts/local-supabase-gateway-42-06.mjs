import http from "node:http";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.ENCHEV_42_06_GATEWAY_PORT || 4011);
const publishableKey = process.env.ENCHEV_42_06_PUBLISHABLE_KEY || "ci-publishable";
const secretKey = process.env.ENCHEV_42_06_SECRET_KEY || "ci-secret";
const rpcDelayMs = Number(process.env.ENCHEV_42_GATEWAY_RPC_DELAY_MS || 0);
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

if (!databaseUrl) throw new Error("42.06 gateway requires DATABASE_URL");
if (!Number.isFinite(rpcDelayMs) || rpcDelayMs < 0 || rpcDelayMs > 5000) throw new Error("42.06 gateway RPC delay must be 0..5000ms");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function respond(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [databaseUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`psql exited ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
}

let active = 0;
const maxDbConcurrency = 40;
const waiters = [];
async function withSlot(fn) {
  if (active >= maxDbConcurrency) await new Promise((resolve) => waiters.push(resolve));
  active += 1;
  try { return await fn(); }
  finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return respond(res, 200, { ok: true, dbConcurrencyLimit: maxDbConcurrency, rpcDelayMs });
    }

    if (req.method === "GET" && url.pathname === "/auth/v1/user") {
      if (req.headers.apikey !== publishableKey) return respond(res, 401, { error: "invalid-api-key" });
      const authorization = String(req.headers.authorization || "");
      const match = authorization.match(UUID_RE);
      if (!authorization.startsWith("Bearer ") || !match) return respond(res, 401, { error: "invalid-session" });
      return respond(res, 200, { id: match[0] });
    }

    if (req.method === "POST" && url.pathname === "/rest/v1/rpc/enchev_place_bid") {
      if (req.headers.apikey !== secretKey) return respond(res, 401, { error: "invalid-secret-key" });
      const body = await readJson(req);
      const auctionId = String(body?.p_auction_id || "");
      const bidderId = String(body?.p_bidder_id || "");
      const amount = Number(body?.p_amount_cents);
      const idempotencyKey = String(body?.p_idempotency_key || "");
      const fingerprint = String(body?.p_request_fingerprint || "");

      if (!UUID_RE.test(auctionId) || !UUID_RE.test(bidderId) || !Number.isSafeInteger(amount)) {
        return respond(res, 400, { error: "invalid-rpc-payload" });
      }

      if (rpcDelayMs > 0) await delay(rpcDelayMs);

      const raw = await withSlot(() => psql(`
        set role service_role;
        select public.enchev_place_bid(
          '${escapeSql(auctionId)}'::uuid,
          '${escapeSql(bidderId)}'::uuid,
          ${amount}::bigint,
          '${escapeSql(idempotencyKey)}'::text,
          '${escapeSql(fingerprint)}'::text
        )::text;
      `));

      return respond(res, 200, JSON.parse(raw));
    }

    return respond(res, 404, { error: "not-found" });
  } catch (error) {
    return respond(res, 500, { error: "gateway-failure", detail: String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ENCHEV_42_06_GATEWAY READY http://127.0.0.1:${port} db_concurrency=${maxDbConcurrency}`);
});

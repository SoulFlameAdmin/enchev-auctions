import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl = String(process.argv[2] || "http://127.0.0.1:4020").replace(/\/$/, "");
const wsUrl = baseUrl.replace(/^http/, "ws");
const key = process.env.ENCHEV_REALTIME_INTERNAL_KEY || "ci-realtime";
const subscriberCount = Number(process.env.ENCHEV_42_07_SUBSCRIBERS || 50);
const eventCount = Number(process.env.ENCHEV_42_07_EVENTS || 100);
const output = process.env.ENCHEV_42_07_OUTPUT || "artifacts/42-07/realtime-latency.json";

if (typeof WebSocket !== "function") throw new Error("REALTIME_LATENCY_42_07 FAIL: Node WebSocket client unavailable");
if (!Number.isSafeInteger(subscriberCount) || subscriberCount < 10) throw new Error("REALTIME_LATENCY_42_07 FAIL: subscriber count too small");
if (!Number.isSafeInteger(eventCount) || eventCount < 20) throw new Error("REALTIME_LATENCY_42_07 FAIL: event count too small");

function percentile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] || 0;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const auctionId = randomUUID();
const subject = `auction/${auctionId}`;
const sockets = [];
const sequencesBySubscriber = Array.from({length: subscriberCount}, () => []);

await Promise.all(Array.from({length: subscriberCount}, (_, index) => new Promise((resolve, reject) => {
  const socket = new WebSocket(`${wsUrl}/ws?subject=${encodeURIComponent(subject)}`);
  sockets[index] = socket;
  const timer = setTimeout(() => reject(new Error(`subscriber ${index} open timeout`)), 5000);
  socket.addEventListener("open", () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
  socket.addEventListener("error", () => {
    clearTimeout(timer);
    reject(new Error(`subscriber ${index} socket error`));
  }, { once: true });
  socket.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(String(event.data));
      if (parsed.subject === subject && Number.isSafeInteger(parsed.sequence)) {
        sequencesBySubscriber[index].push(parsed.sequence);
      }
    } catch {}
  });
})));

const transportSamples = [];
const publishRequestLatencies = [];
const startedAt = new Date().toISOString();

for (let sequence = 1; sequence <= eventCount; sequence += 1) {
  const event = {
    id: randomUUID(),
    type: "enchev.bid.accepted.v1",
    source: "enchev.api",
    subject,
    time: new Date().toISOString(),
    sequence,
    schemaVersion: 1,
    correlationId: randomUUID(),
    data: {
      bidId: randomUUID(),
      amountCents: 1_000_000 + (sequence * 100),
    },
  };

  const t0 = process.hrtime.bigint();
  const response = await fetch(baseUrl + "/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-enchev-realtime-key": key,
    },
    body: JSON.stringify(event),
  });
  const requestLatencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
  publishRequestLatencies.push(requestLatencyMs);

  const body = await response.json();
  if (!response.ok || body?.ok !== true || body?.delivered !== subscriberCount || body?.transportAuthority !== false) {
    throw new Error(`REALTIME_LATENCY_42_07 FAIL: publish sequence=${sequence} status=${response.status} delivered=${body?.delivered}`);
  }
  if (!Array.isArray(body.samplesMs) || body.samplesMs.length !== subscriberCount) {
    throw new Error(`REALTIME_LATENCY_42_07 FAIL: invalid transport samples sequence=${sequence}`);
  }
  transportSamples.push(...body.samplesMs.map(Number));
}

const expectedDeliveries = subscriberCount * eventCount;
const deadline = Date.now() + 10000;
while (sequencesBySubscriber.reduce((sum, values) => sum + values.length, 0) < expectedDeliveries && Date.now() < deadline) {
  await delay(20);
}

for (let i = 0; i < sequencesBySubscriber.length; i += 1) {
  const values = sequencesBySubscriber[i];
  if (values.length !== eventCount) {
    throw new Error(`REALTIME_LATENCY_42_07 FAIL: subscriber=${i} deliveries=${values.length}/${eventCount}`);
  }
  for (let sequence = 1; sequence <= eventCount; sequence += 1) {
    if (values[sequence - 1] !== sequence) {
      throw new Error(`REALTIME_LATENCY_42_07 FAIL: subscriber=${i} sequence-order-drift at=${sequence}`);
    }
  }
}

if (transportSamples.length !== expectedDeliveries) {
  throw new Error(`REALTIME_LATENCY_42_07 FAIL: samples=${transportSamples.length}/${expectedDeliveries}`);
}

const report = {
  taskId: "42.07",
  title: "Realtime p50/p95/p99 recorded",
  certified: true,
  environment: "github-actions-production-like-local",
  runtime: "apps/realtime/server.mjs",
  transport: "websocket",
  transportAuthority: false,
  eventType: "enchev.bid.accepted.v1",
  subscribers: subscriberCount,
  events: eventCount,
  deliveries: expectedDeliveries,
  orderedDeliveryVerified: true,
  transportHandoffLatencyMs: {
    p50: percentile(transportSamples,.50),
    p95: percentile(transportSamples,.95),
    p99: percentile(transportSamples,.99),
    max: Math.max(...transportSamples),
    min: Math.min(...transportSamples),
  },
  publisherHttpLatencyMs: {
    p50: percentile(publishRequestLatencies,.50),
    p95: percentile(publishRequestLatencies,.95),
    p99: percentile(publishRequestLatencies,.99),
    max: Math.max(...publishRequestLatencies),
  },
  startedAt,
  completedAt: new Date().toISOString(),
  githubSha: process.env.GITHUB_SHA || "local",
};

fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, JSON.stringify(report,null,2) + "\n");

for (const socket of sockets) {
  try { socket.close(1000, "certification-complete"); } catch {}
}
await delay(100);

console.log(
  `REALTIME_LATENCY_42_07 PASS subscribers=${subscriberCount} events=${eventCount} deliveries=${expectedDeliveries} p50_ms=${report.transportHandoffLatencyMs.p50.toFixed(3)} p95_ms=${report.transportHandoffLatencyMs.p95.toFixed(3)} p99_ms=${report.transportHandoffLatencyMs.p99.toFixed(3)}`
);

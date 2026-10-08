import http from "node:http";
import { createHash } from "node:crypto";
import fs from "node:fs";

const host = process.env.ENCHEV_REALTIME_HOST || "127.0.0.1";
const port = Number(process.env.ENCHEV_REALTIME_PORT || 4020);
const internalKey = process.env.ENCHEV_REALTIME_INTERNAL_KEY || "";
const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
if (!loopbackHosts.has(host)) {
  throw new Error("REALTIME_RUNTIME FAIL: unauthenticated certification runtime must remain loopback-only until production session authorization is integrated");
}
const registry = JSON.parse(fs.readFileSync("config/enchev-websocket-event-registry.json", "utf8"));

if (registry.transportAuthority !== false) {
  throw new Error("REALTIME_RUNTIME FAIL: transportAuthority must remain false");
}
if (!internalKey) {
  throw new Error("REALTIME_RUNTIME FAIL: ENCHEV_REALTIME_INTERNAL_KEY is required");
}

const requiredFields = new Set(registry.requiredEnvelopeFields || []);
const eventByType = new Map((registry.events || []).map((event) => [event.type, event]));
const subscribers = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function percentile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 128 * 1024) throw new Error("payload-too-large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateEnvelope(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return "event-object-required";
  for (const field of requiredFields) {
    if (!(field in event)) return `missing-${field}`;
  }
  const definition = eventByType.get(event.type);
  if (!definition) return "event-type-not-registered";
  if (event.schemaVersion !== definition.schemaVersion) return "schema-version-mismatch";
  if (typeof event.subject !== "string" || !event.subject.startsWith(definition.subjectPrefix)) return "subject-prefix-invalid";
  if (typeof event.id !== "string" || event.id.length < 16) return "event-id-invalid";
  if (typeof event.source !== "string" || !event.source) return "source-invalid";
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) return "sequence-invalid";
  if (typeof event.correlationId !== "string" || event.correlationId.length < 8) return "correlation-id-invalid";
  if (typeof event.time !== "string" || !Number.isFinite(Date.parse(event.time))) return "time-invalid";
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return "data-invalid";
  return null;
}

function websocketFrame(payloadInput, opcode = 0x1) {
  const payload = Buffer.isBuffer(payloadInput) ? payloadInput : Buffer.from(payloadInput);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

function parseClientFrames(socket, chunk) {
  const previous = socket.__enchevIncoming || Buffer.alloc(0);
  let data = Buffer.concat([previous, chunk]);
  let offset = 0;

  while (offset + 2 <= data.length) {
    const first = data[offset];
    const second = data[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (offset + 4 > data.length) break;
      length = data.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > data.length) break;
      const big = data.readBigUInt64BE(offset + 2);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
        socket.destroy();
        return;
      }
      length = Number(big);
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + length;
    if (offset + frameLength > data.length) break;

    let payload = data.subarray(offset + headerLength + maskLength, offset + frameLength);
    if (masked) {
      const mask = data.subarray(offset + headerLength, offset + headerLength + 4);
      const decoded = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) decoded[i] = payload[i] ^ mask[i % 4];
      payload = decoded;
    }

    if (opcode === 0x8) {
      try { socket.write(websocketFrame(payload, 0x8)); } catch {}
      socket.end();
      offset += frameLength;
      break;
    }
    if (opcode === 0x9) {
      try { socket.write(websocketFrame(payload, 0xA)); } catch {}
    }

    offset += frameLength;
  }

  socket.__enchevIncoming = data.subarray(offset);
}

function register(subject, socket) {
  let set = subscribers.get(subject);
  if (!set) {
    set = new Set();
    subscribers.set(subject, set);
  }
  set.add(socket);

  const cleanup = () => {
    const current = subscribers.get(subject);
    current?.delete(socket);
    if (current?.size === 0) subscribers.delete(subject);
  };
  socket.once("close", cleanup);
  socket.once("error", cleanup);
  socket.on("data", (chunk) => parseClientFrames(socket, chunk));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const connectionCount = [...subscribers.values()].reduce((sum, set) => sum + set.size, 0);
      return json(res, 200, {
        ok: true,
        service: "enchev-realtime",
        transport: "websocket",
        authority: false,
        subjects: subscribers.size,
        connections: connectionCount,
      });
    }

    if (req.method === "POST" && url.pathname === "/publish") {
      if (req.headers["x-enchev-realtime-key"] !== internalKey) {
        return json(res, 401, { ok: false, error: "unauthorized-publisher" });
      }

      const event = await readJson(req);
      const invalid = validateEnvelope(event);
      if (invalid) return json(res, 400, { ok: false, error: invalid });

      const eligible = [...(subscribers.get(event.subject) || [])].filter((socket) => !socket.destroyed && socket.writable);
      if (!eligible.length) return json(res, 422, { ok: false, error: "no-eligible-subscriber" });

      const encoded = websocketFrame(JSON.stringify(event));
      const startedNs = process.hrtime.bigint();
      const samplesMs = [];

      for (const socket of eligible) {
        socket.write(encoded);
        const handedNs = process.hrtime.bigint();
        samplesMs.push(Number(handedNs - startedNs) / 1e6);
      }

      return json(res, 200, {
        ok: true,
        delivered: samplesMs.length,
        eventType: event.type,
        subject: event.subject,
        transportAuthority: false,
        latencyMs: {
          p50: percentile(samplesMs, .50),
          p95: percentile(samplesMs, .95),
          p99: percentile(samplesMs, .99),
          max: Math.max(...samplesMs),
        },
        samplesMs,
      });
    }

    return json(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    return json(res, 500, { ok: false, error: "realtime-runtime-failure", detail: String(error) });
  }
});

server.on("upgrade", (req, socket) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    const subject = url.searchParams.get("subject") || "";
    const key = req.headers["sec-websocket-key"];
    const upgrade = String(req.headers.upgrade || "").toLowerCase();

    if (
      url.pathname !== "/ws" ||
      upgrade !== "websocket" ||
      typeof key !== "string" ||
      !subject.startsWith("auction/")
    ) {
      socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const accept = createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    register(subject, socket);
  } catch {
    socket.destroy();
  }
});

server.listen(port, host, () => {
  console.log(`ENCHEV_REALTIME READY ws://${host}:${port}/ws transport_authority=false events=${eventByType.size}`);
});

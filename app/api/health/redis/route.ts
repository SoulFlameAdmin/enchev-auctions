import net from "node:net";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type ProbeResult = {
  binding: "tcp-url" | "upstash-rest" | "vercel-kv-rest";
  tls: boolean;
  latencyMs: number;
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex",
    },
  });
}

function resp(parts: string[]) {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

function validateTcpUrl(raw: string) {
  const url = new URL(raw);
  if (!["redis:", "rediss:"].includes(url.protocol)) throw new Error("unsupported-scheme");
  if (!url.hostname) throw new Error("missing-host");
  if (!LOCAL_HOSTS.has(url.hostname) && url.protocol !== "rediss:") throw new Error("tls-required");
  return url;
}

function validateRestUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("https-required");
  if (!url.hostname) throw new Error("missing-host");
  return url;
}

async function pingTcp(raw: string): Promise<ProbeResult> {
  const url = validateTcpUrl(raw);
  const port = Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379));
  const username = decodeURIComponent(url.username || "");
  const password = decodeURIComponent(url.password || "");
  const startedAt = Date.now();
  const socket = url.protocol === "rediss:"
    ? tls.connect({ host: url.hostname, port, servername: url.hostname, rejectUnauthorized: true })
    : net.connect({ host: url.hostname, port });

  socket.setTimeout(4000);
  let buffer = "";
  const commands: string[] = [];
  if (password) commands.push(username ? resp(["AUTH", username, password]) : resp(["AUTH", password]));
  commands.push(resp(["PING"]));

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };
    socket.once("error", () => {
      cleanup();
      reject(new Error("connection-error"));
    });
    socket.once("timeout", () => {
      cleanup();
      reject(new Error("timeout"));
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (buffer.includes("-ERR") || buffer.includes("-NOAUTH") || buffer.includes("-WRONGPASS")) {
        cleanup();
        reject(new Error("redis-rejected-probe"));
        return;
      }
      if (buffer.includes("+PONG")) {
        cleanup();
        resolve();
      }
    });
    socket.once(url.protocol === "rediss:" ? "secureConnect" : "connect", () => {
      for (const command of commands) socket.write(command);
    });
  });

  return { binding: "tcp-url", tls: url.protocol === "rediss:", latencyMs: Date.now() - startedAt };
}

async function pingRest(rawUrl: string, token: string, binding: ProbeResult["binding"]): Promise<ProbeResult> {
  validateRestUrl(rawUrl);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(rawUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(["PING"]),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("redis-rest-http-failure");
    const body = await response.json();
    if (body?.result !== "PONG") throw new Error("redis-rest-no-pong");
    return { binding, tls: true, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

async function probeRedisBinding(): Promise<ProbeResult> {
  const tcp = process.env.REDIS_URL?.trim();
  if (tcp) return pingTcp(tcp);

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl || upstashToken) {
    if (!upstashUrl || !upstashToken) throw new Error("incomplete-upstash-rest-binding");
    return pingRest(upstashUrl, upstashToken, "upstash-rest");
  }

  const kvUrl = process.env.KV_REST_API_URL?.trim();
  const kvToken = process.env.KV_REST_API_TOKEN?.trim();
  if (kvUrl || kvToken) {
    if (!kvUrl || !kvToken) throw new Error("incomplete-vercel-kv-rest-binding");
    return pingRest(kvUrl, kvToken, "vercel-kv-rest");
  }

  throw new Error("missing-redis-binding");
}

export async function GET() {
  const hasAnyBinding = Boolean(
    process.env.REDIS_URL?.trim() ||
      process.env.UPSTASH_REDIS_REST_URL?.trim() ||
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
      process.env.KV_REST_API_URL?.trim() ||
      process.env.KV_REST_API_TOKEN?.trim(),
  );

  try {
    const result = await probeRedisBinding();
    return json(
      {
        ok: true,
        configured: true,
        status: "pong",
        binding: result.binding,
        tls: result.tls,
        latencyMs: result.latencyMs,
      },
      200,
    );
  } catch (error) {
    return json(
      {
        ok: false,
        configured: hasAnyBinding,
        status: hasAnyBinding ? "redis-binding-ping-failed" : "missing-redis-binding",
      },
      503,
    );
  }
}

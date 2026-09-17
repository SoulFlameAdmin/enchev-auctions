import net from "node:net";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

function resp(parts: string[]) {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

function validateUrl(raw: string) {
  const url = new URL(raw);
  if (!['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error('unsupported-scheme');
  }
  if (!url.hostname) throw new Error('missing-host');
  if (!LOCAL_HOSTS.has(url.hostname) && url.protocol !== 'rediss:') {
    throw new Error('tls-required');
  }
  return url;
}

async function pingRedis(raw: string) {
  const url = validateUrl(raw);
  const port = Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379));
  const username = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');
  const startedAt = Date.now();

  const socket = url.protocol === 'rediss:'
    ? tls.connect({ host: url.hostname, port, servername: url.hostname, rejectUnauthorized: true })
    : net.connect({ host: url.hostname, port });

  socket.setTimeout(4000);
  let buffer = '';
  const commands: string[] = [];
  if (password) commands.push(username ? resp(['AUTH', username, password]) : resp(['AUTH', password]));
  commands.push(resp(['PING']));

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };
    socket.once('error', () => {
      cleanup();
      reject(new Error('connection-error'));
    });
    socket.once('timeout', () => {
      cleanup();
      reject(new Error('timeout'));
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('-ERR') || buffer.includes('-NOAUTH') || buffer.includes('-WRONGPASS')) {
        cleanup();
        reject(new Error('redis-rejected-probe'));
        return;
      }
      if (buffer.includes('+PONG')) {
        cleanup();
        resolve();
      }
    });
    socket.once(url.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => {
      for (const command of commands) socket.write(command);
    });
  });

  return {
    latencyMs: Date.now() - startedAt,
    tls: url.protocol === 'rediss:',
  };
}

export async function GET() {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) {
    return json({
      ok: false,
      configured: false,
      status: 'missing-redis-url',
    }, 503);
  }

  try {
    const result = await pingRedis(raw);
    return json({
      ok: true,
      configured: true,
      status: 'pong',
      tls: result.tls,
      latencyMs: result.latencyMs,
    }, 200);
  } catch {
    return json({
      ok: false,
      configured: true,
      status: 'redis-ping-failed',
    }, 503);
  }
}

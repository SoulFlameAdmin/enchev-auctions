import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';

const CONFIG_PATH = 'config/enchev-redis-environment.json';
const SECRET_KEY_PATTERN = /(password|secret|credential|api[_-]?key)/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const EXPECTED_BINDINGS = [
  { kind: 'tcp-url', url_env: 'REDIS_URL' },
  { kind: 'upstash-rest', url_env: 'UPSTASH_REDIS_REST_URL', token_env: 'UPSTASH_REDIS_REST_TOKEN' },
  { kind: 'vercel-kv-rest', url_env: 'KV_REST_API_URL', token_env: 'KV_REST_API_TOKEN' },
];

function fail(message) {
  throw new Error(`REDIS_ENV FAIL: ${message}`);
}

export function validateRedisConfig(config) {
  if (!config || typeof config !== 'object') fail('config must be an object');
  if (config.task !== '01.06') fail('task must be 01.06');
  if (config.name !== 'Redis environment') fail('name drift');
  if (config.authoritative_auction_state !== false) fail('Redis must never be auction authority');
  if (config.environment_variable !== 'REDIS_URL') fail('canonical environment variable must remain REDIS_URL');
  if (config.key_prefix !== 'enchev:') fail('key prefix must be enchev:');
  if (config.secret_values_in_repository !== false) fail('repository must not contain Redis secret values');
  if (config.live_ping_required_for_green !== true) fail('GREEN must require a live Redis PING');
  if (config.rest_tls_required !== true) fail('REST Redis bindings must require HTTPS');
  if (!Array.isArray(config.allowed_schemes) || !config.allowed_schemes.includes('redis:') || !config.allowed_schemes.includes('rediss:')) {
    fail('redis: and rediss: schemes must be supported');
  }
  if (JSON.stringify(config.binding_options) !== JSON.stringify(EXPECTED_BINDINGS)) {
    fail('binding options drift');
  }

  const forbidden = new Set(config.forbidden_roles || []);
  for (const role of ['accepted-bid-authority', 'auction-state-authority', 'winner-authority', 'final-result-authority']) {
    if (!forbidden.has(role)) fail(`missing forbidden authoritative role: ${role}`);
  }

  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEY_PATTERN.test(key) && key !== 'secret_values_in_repository') {
      if (value !== null && value !== false && value !== '') fail(`secret-like field ${key} must not contain a value`);
    }
  }

  return { task: config.task, bindingStatus: config.binding_status, keyPrefix: config.key_prefix };
}

export function validateRedisUrl(raw) {
  if (!raw || typeof raw !== 'string') fail('REDIS_URL is missing');
  let url;
  try { url = new URL(raw); } catch { fail('REDIS_URL is not a valid URL'); }
  if (!['redis:', 'rediss:'].includes(url.protocol)) fail('REDIS_URL scheme must be redis: or rediss:');
  if (!url.hostname) fail('REDIS_URL hostname is missing');
  if (!LOCAL_HOSTS.has(url.hostname) && url.protocol !== 'rediss:') fail('non-local Redis must use TLS (rediss:)');
  return url;
}

export function validateRedisRestUrl(raw) {
  if (!raw || typeof raw !== 'string') fail('Redis REST URL is missing');
  let url;
  try { url = new URL(raw); } catch { fail('Redis REST URL is not valid'); }
  if (url.protocol !== 'https:') fail('Redis REST URL must use HTTPS');
  if (!url.hostname) fail('Redis REST URL hostname is missing');
  return url;
}

function resp(parts) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

async function liveTcpPing(rawUrl) {
  const url = validateRedisUrl(rawUrl);
  const port = Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379));
  const username = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');
  const socket = url.protocol === 'rediss:'
    ? tls.connect({ host: url.hostname, port, servername: url.hostname, rejectUnauthorized: true })
    : net.connect({ host: url.hostname, port });

  socket.setTimeout(5000);
  let buffer = '';
  const commands = [];
  if (password) commands.push(username ? resp(['AUTH', username, password]) : resp(['AUTH', password]));
  commands.push(resp(['PING']));

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };
    socket.once('error', (error) => { cleanup(); reject(error); });
    socket.once('timeout', () => { cleanup(); reject(new Error('Redis connection timed out')); });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('-ERR') || buffer.includes('-NOAUTH') || buffer.includes('-WRONGPASS')) {
        cleanup();
        reject(new Error('Redis rejected TCP probe'));
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

  console.log(`REDIS_ENV_LIVE PASS binding=tcp-url tls=${url.protocol === 'rediss:'}`);
}

async function liveRestPing(rawUrl, token, binding) {
  validateRedisRestUrl(rawUrl);
  if (!token) fail(`${binding} token is missing`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(rawUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(['PING']),
      signal: controller.signal,
    });
    if (!response.ok) fail(`${binding} PING returned HTTP ${response.status}`);
    const body = await response.json();
    if (body?.result !== 'PONG') fail(`${binding} PING did not return PONG`);
    console.log(`REDIS_ENV_LIVE PASS binding=${binding} tls=true`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function livePingFromEnv(env = process.env) {
  const tcp = env.REDIS_URL?.trim();
  if (tcp) return liveTcpPing(tcp);

  const upstashUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl || upstashToken) {
    if (!upstashUrl || !upstashToken) fail('Upstash REST binding is incomplete');
    return liveRestPing(upstashUrl, upstashToken, 'upstash-rest');
  }

  const kvUrl = env.KV_REST_API_URL?.trim();
  const kvToken = env.KV_REST_API_TOKEN?.trim();
  if (kvUrl || kvToken) {
    if (!kvUrl || !kvToken) fail('Vercel KV REST binding is incomplete');
    return liveRestPing(kvUrl, kvToken, 'vercel-kv-rest');
  }

  fail('no Redis binding found in REDIS_URL, UPSTASH_REDIS_REST_* or KV_REST_API_*');
}

function runSelfTest() {
  const good = {
    task: '01.06',
    name: 'Redis environment',
    binding_status: 'pending-live-provider',
    provider: null,
    authoritative_auction_state: false,
    allowed_roles: ['cache'],
    forbidden_roles: ['accepted-bid-authority', 'auction-state-authority', 'winner-authority', 'final-result-authority'],
    environment_variable: 'REDIS_URL',
    binding_options: EXPECTED_BINDINGS,
    allowed_schemes: ['redis:', 'rediss:'],
    tls_required_nonlocal: true,
    rest_tls_required: true,
    key_prefix: 'enchev:',
    secret_values_in_repository: false,
    live_ping_required_for_green: true,
  };
  validateRedisConfig(good);
  validateRedisUrl('redis://localhost:6379');
  validateRedisUrl('rediss://cache.example.test:6380');
  validateRedisRestUrl('https://redis.example.test');

  const badCases = [
    { ...good, authoritative_auction_state: true },
    { ...good, environment_variable: 'CACHE_URL' },
    { ...good, key_prefix: 'shared:' },
    { ...good, live_ping_required_for_green: false },
    { ...good, forbidden_roles: ['auction-state-authority'] },
    { ...good, binding_options: [{ kind: 'tcp-url', url_env: 'CACHE_URL' }] },
    { ...good, rest_tls_required: false },
    { ...good, redis_password: 'do-not-store-this' },
  ];

  for (const [index, candidate] of badCases.entries()) {
    let rejected = false;
    try { validateRedisConfig(candidate); } catch { rejected = true; }
    if (!rejected) fail(`negative config self-test ${index + 1} was not rejected`);
  }

  for (const candidate of ['http://cache.example.test', 'redis://cache.example.test:6379', 'not-a-url']) {
    let rejected = false;
    try { validateRedisUrl(candidate); } catch { rejected = true; }
    if (!rejected) fail(`negative URL self-test was not rejected: ${candidate}`);
  }

  for (const candidate of ['http://redis.example.test', 'not-a-url']) {
    let rejected = false;
    try { validateRedisRestUrl(candidate); } catch { rejected = true; }
    if (!rejected) fail(`negative REST URL self-test was not rejected: ${candidate}`);
  }

  console.log('REDIS_ENV_SELF_TEST PASS config_cases=8 tcp_url_cases=3 rest_url_cases=2');
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const result = validateRedisConfig(config);

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else if (process.argv.includes('--live')) {
  await livePingFromEnv();
} else {
  console.log(`REDIS_ENV_CONTRACT PASS task=${result.task} binding=${result.bindingStatus} prefix=${result.keyPrefix}`);
}

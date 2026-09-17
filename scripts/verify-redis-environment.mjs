import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';

const CONFIG_PATH = 'config/enchev-redis-environment.json';
const SECRET_KEY_PATTERN = /(token|password|secret|credential|api[_-]?key)/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function fail(message) {
  throw new Error(`REDIS_ENV FAIL: ${message}`);
}

export function validateRedisConfig(config) {
  if (!config || typeof config !== 'object') fail('config must be an object');
  if (config.task !== '01.06') fail('task must be 01.06');
  if (config.name !== 'Redis environment') fail('name drift');
  if (config.authoritative_auction_state !== false) fail('Redis must never be auction authority');
  if (config.environment_variable !== 'REDIS_URL') fail('canonical environment variable must be REDIS_URL');
  if (config.key_prefix !== 'enchev:') fail('key prefix must be enchev:');
  if (config.secret_values_in_repository !== false) fail('repository must not contain Redis secret values');
  if (config.live_ping_required_for_green !== true) fail('GREEN must require a live Redis PING');
  if (!Array.isArray(config.allowed_schemes) || !config.allowed_schemes.includes('redis:') || !config.allowed_schemes.includes('rediss:')) {
    fail('redis: and rediss: schemes must be supported');
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

function resp(parts) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

async function livePing(rawUrl) {
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
        const safeError = buffer.split('\r\n')[0];
        cleanup();
        reject(new Error(`Redis rejected probe: ${safeError}`));
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

  console.log(`REDIS_ENV_LIVE PASS host=${url.hostname} tls=${url.protocol === 'rediss:'}`);
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
    allowed_schemes: ['redis:', 'rediss:'],
    tls_required_nonlocal: true,
    key_prefix: 'enchev:',
    secret_values_in_repository: false,
    live_ping_required_for_green: true,
  };
  validateRedisConfig(good);
  validateRedisUrl('redis://localhost:6379');
  validateRedisUrl('rediss://cache.example.test:6380');

  const badCases = [
    { ...good, authoritative_auction_state: true },
    { ...good, environment_variable: 'CACHE_URL' },
    { ...good, key_prefix: 'shared:' },
    { ...good, live_ping_required_for_green: false },
    { ...good, forbidden_roles: ['auction-state-authority'] },
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

  console.log('REDIS_ENV_SELF_TEST PASS config_cases=6 url_cases=3');
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const result = validateRedisConfig(config);

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else if (process.argv.includes('--live')) {
  await livePing(process.env.REDIS_URL);
} else {
  console.log(`REDIS_ENV_CONTRACT PASS task=${result.task} binding=${result.bindingStatus} prefix=${result.keyPrefix}`);
}

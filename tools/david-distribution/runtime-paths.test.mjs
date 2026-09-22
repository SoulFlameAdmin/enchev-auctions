import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runtimeDataDir } from '../david/runtime-paths.mjs';
import { ROOT } from './inventory.mjs';

test('no distribution override preserves legacy locations without creating directories', () => {
  assert.equal(runtimeDataDir('/legacy/data', {}), '/legacy/data');
  assert.equal(runtimeDataDir('/legacy/data', { DAVID_DATA_DIR: '' }), '/legacy/data');
  assert.throws(() => runtimeDataDir('/legacy/data', { DAVID_DATA_DIR: '../data' }), /must be absolute/);
});

test('real rate coordinator retains cooldown across process restart outside core', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'DAVID data with spaces-'));
  const data = path.join(root, 'user state');
  const moduleUrl = pathToFileURL(path.join(ROOT, 'tools/david/chatgpt-rate-limit-coordinator.mjs')).href;
  const stateFile = path.join(data, '.david-global-chatgpt-rate-limit.json');
  const legacyFile = path.join(ROOT, 'tools/david/.david-global-chatgpt-rate-limit.json');
  const before = fs.existsSync(legacyFile) ? fs.readFileSync(legacyFile) : null;
  const run = code => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...process.env, DAVID_DATA_DIR: data }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  try {
    const first = run(`const m = await import(${JSON.stringify(moduleUrl)}); await m.reportRateLimit('TEST', 'test fixture'); console.log(JSON.stringify(m.getRateLimitState()));`);
    assert.ok(fs.existsSync(stateFile));
    const second = run(`const m = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify(m.getRateLimitState()));`);
    assert.equal(first.blockedUntil, second.blockedUntil);
    assert.ok(Date.parse(second.blockedUntil) > Date.now());
    assert.equal(fs.existsSync(path.join(data, '.david-global-chatgpt-rate-limit.lock')), false);
    assert.deepEqual(fs.existsSync(legacyFile) ? fs.readFileSync(legacyFile) : null, before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

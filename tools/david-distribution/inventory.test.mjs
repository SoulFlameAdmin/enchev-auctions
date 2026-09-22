import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inventory, imports, MANIFEST, ROOT } from './inventory.mjs';

test('audited dependency closure includes current Scientist and verified send logic', () => {
  const result = inventory();
  const files = result.files.map(f => f.path);
  for (const name of ['sf-scientist-sidecar.mjs', 'chatgpt-send-ack.mjs', 'chatgpt-effort-mode.mjs', 'chatgpt-session-rotation.mjs'])
    assert.ok(files.includes(`tools/david/${name}`));
  assert.equal(result.coreVersion, '1.7.0');
  assert.equal(result.releaseReady, false);
  assert.deepEqual(result, inventory());
  assert.ok(!files.some(f => /(?:\.env|\.git|state\.json|verify-|auto-continue-enchev-v[234])/.test(f)));
});
test('literal static and dynamic imports; computed imports fail closed', () => {
  assert.deepEqual(imports('import { x } from "./x.mjs"; await import("playwright-core");'), ['./x.mjs', 'playwright-core']);
  assert.throws(() => imports('await import(variable)'), /Computed import/);
});
test('traversal and hidden state cannot enter manifest', () => {
  for (const name of ['../private.json', '.env', 'tools/david/.sf-scientist-state.json'])
    assert.throws(() => inventory(ROOT, { ...MANIFEST, runtimeAssets: [name] }), /Unsafe runtime path/);
});
test('missing dependency and undeclared package stop inventory', () => {
  assert.throws(() => inventory(ROOT, { ...MANIFEST, spawnedModules: ['tools/david/missing.mjs'] }), /ENOENT/);
  assert.throws(() => inventory(ROOT, { ...MANIFEST, externalDependencies: {} }), /Undeclared dependency/);
});
test('symlink to outside root and credential-bearing module are rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'david-inventory-'));
  try {
    const manifest = { ...MANIFEST, entrypoints: ['leak.mjs'], spawnedModules: [], hostScripts: [], runtimeAssets: [] };
    fs.symlinkSync(path.join(ROOT, 'tools/david/package.json'), path.join(root, 'leak.mjs'));
    assert.throws(() => inventory(root, manifest), /Symlink or outside-root/);
    fs.unlinkSync(path.join(root, 'leak.mjs'));
    fs.writeFileSync(path.join(root, 'leak.mjs'), ['-----BEGIN', 'PRIVATE KEY-----'].join(' '));
    assert.throws(() => inventory(root, manifest), /Credential signature/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

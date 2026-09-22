import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const MANIFEST = JSON.parse(fs.readFileSync(new URL('./runtime-manifest.json', import.meta.url)));

function safeFile(root, name) {
  if (typeof name !== 'string' || name.includes('\\') || path.posix.isAbsolute(name) || name.split('/').some(p => p === '..' || p.startsWith('.')))
    throw new Error(`Unsafe runtime path: ${name}`);
  if (!/\.(mjs|ps1|json)$/.test(name) || /(?:^|\/)(?:node_modules|tests?|docs)(?:\/|$)/i.test(name))
    throw new Error(`Non-runtime path: ${name}`);
  const full = path.resolve(root, name);
  const actual = fs.realpathSync(full);
  const relative = path.relative(fs.realpathSync(root), actual);
  if (relative.startsWith('..') || path.isAbsolute(relative) || actual !== full || !fs.lstatSync(full).isFile())
    throw new Error(`Symlink or outside-root runtime path: ${name}`);
  return full;
}

// This recognizes the literal import forms used by the audited DAVID source.
// Spawned scripts, PowerShell calls and non-import assets require explicit review
// in the manifest. This is not a general JavaScript/PowerShell dependency parser.
export function imports(source) {
  const found = new Set();
  for (const match of source.matchAll(/(?:^|\n)\s*import\s+(?:[^;]*?)\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g))
    found.add(match[1] || match[2] || match[3]);
  if (/\bimport\s*\(\s*[^\s"']/.test(source)) throw new Error('Computed import requires dependency review');
  return [...found].sort();
}

export function inventory(root = ROOT, manifest = MANIFEST) {
  const queue = [...manifest.entrypoints, ...manifest.spawnedModules, ...manifest.hostScripts, ...manifest.runtimeAssets];
  const files = new Map();
  const external = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (files.has(name)) continue;
    const bytes = fs.readFileSync(safeFile(root, name));
    const source = bytes.toString('utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bsbp_[a-f0-9]{30,}/.test(source))
      throw new Error(`Credential signature in runtime file: ${name}`);
    const dependencies = [];
    if (name.endsWith('.mjs')) {
      for (const specifier of imports(source)) {
        if (specifier.startsWith('node:')) continue;
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          const dep = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
          dependencies.push(dep);
          queue.push(dep);
        } else {
          if (!Object.hasOwn(manifest.externalDependencies, specifier)) throw new Error(`Undeclared dependency: ${specifier}`);
          external.add(specifier);
        }
      }
    }
    files.set(name, { path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), dependencies });
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'tools/david/package.json')));
  if (JSON.stringify(pkg.dependencies) !== JSON.stringify(manifest.externalDependencies)) throw new Error('Dependency versions changed; review manifest');
  return { schemaVersion: 1, kind: 'audited-source-inventory-not-installable', releaseReady: false,
    auditedCommit: manifest.auditedCommit, coreVersion: pkg.version,
    externalDependencies: Object.fromEntries([...external].sort().map(n => [n, manifest.externalDependencies[n]])),
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = inventory();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(`DAVID_RUNTIME_INVENTORY PASS files=${result.files.length} sourceBytes=${result.files.reduce((n, f) => n + f.bytes, 0)} core=${result.coreVersion} releaseReady=false`);
}

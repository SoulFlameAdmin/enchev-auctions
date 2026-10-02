import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'public/forge');
const digest = value => createHash('sha256').update(value).digest('hex');
const frontend = JSON.parse(gunzipSync(await readFile(path.join(root, 'config/forge-frontend.json.gz'))));
for (const [relative, content] of Object.entries(frontend)) {
  const target = path.join(output, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}
const pending = JSON.parse(await readFile(path.join(root, 'config/forge-assets.json'), 'utf8'));
let downloaded = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (pending.length) {
    const asset = pending.shift();
    const target = path.join(output, asset.path);
    try {
      if (digest(await readFile(target)) === asset.sha256) continue;
    } catch {}
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(asset.url, { signal: AbortSignal.timeout(90000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = Buffer.from(await response.arrayBuffer());
        if (digest(data) !== asset.sha256) throw new Error('Source content changed');
        break;
      } catch (error) {
        if (attempt === 2) throw new Error(`Cannot restore ${asset.path}: ${error.message}`);
      }
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    downloaded++;
  }
}));
console.log(`Forge frontend restored; ${downloaded} binary assets downloaded and verified.`);

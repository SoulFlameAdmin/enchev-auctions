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
const ctaMapScript = String.raw`(() => {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const rules = [
    { heading: "Your Route To Your Next Vehicle", label: "BID NOW", href: "/live-auctions" },
    { heading: "Identity", label: "BID NOW", href: "/live-auctions" },
    { heading: "Insight", label: "DOCUMENTS & TRANSPORT", href: "/transport" },
    { heading: "Cohesion", label: "BUY", href: "/inventory" },
    { heading: "Discovery", label: "CHECK VEHICLE", href: "/vehicle-history" },
    { heading: "Inspection", label: "ABOUT US", href: "/presentation" },
    { heading: "Auctions", label: "BID NOW", href: "/live-auctions" },
    { heading: "History", label: "CHECK VEHICLE", href: "/vehicle-history" },
    { heading: "Transport", label: "DOCUMENTS & TRANSPORT", href: "/transport" },
    { heading: "Support", label: "SUPPORT", href: "/support" }
  ];

  function nearestRule(element) {
    let node = element.parentElement;
    while (node && node !== document.body) {
      const headings = Array.from(node.querySelectorAll("h1,h2,h3,h4,h5"));
      for (const heading of headings) {
        const value = normalize(heading.textContent);
        const match = rules.find((rule) => value === normalize(rule.heading) || value.includes(normalize(rule.heading)));
        if (match) return match;
      }
      node = node.parentElement;
    }
    return null;
  }

  function applyCtas() {
    const candidates = Array.from(document.querySelectorAll("a,button")).filter((element) => {
      const value = normalize(element.textContent);
      return value === "start your project" || value === "start your project";
    });

    for (const element of candidates) {
      const rule = nearestRule(element);
      if (!rule) continue;
      if (element.dataset.enchevCtaLabel === rule.label) continue;
      element.textContent = rule.label;
      if (element.tagName === "A") element.setAttribute("href", rule.href);
      element.setAttribute("aria-label", rule.label);
      element.dataset.enchevCtaLabel = rule.label;
    }
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyCtas();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCtas, { once: true });
  } else {
    applyCtas();
  }

  new MutationObserver(scheduleApply).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();`;

const ctaScriptPath = path.join(output, 'enchev-cta-map.js');
await writeFile(ctaScriptPath, ctaMapScript);
const forgeIndexPath = path.join(output, 'index.html');
let forgeIndex = await readFile(forgeIndexPath, 'utf8');
if (!forgeIndex.includes('/forge/enchev-cta-map.js')) {
  forgeIndex = forgeIndex.replace('</body>', '<script src="/forge/enchev-cta-map.js" defer></script></body>');
  await writeFile(forgeIndexPath, forgeIndex);
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

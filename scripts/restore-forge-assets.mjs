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
const responsiveCss = String.raw`
html,body{max-width:100%;overflow-x:hidden}
[data-sanity*="path=introductionHeading"],
[data-sanity*="path=heroHeading"],
[data-sanity*="path=heroDescription"],
[data-sanity*="path=approachHeading"],
[data-sanity*="path=servicesHeading"],
[data-sanity*="path=heading"]{
  max-width:100%!important;
  box-sizing:border-box!important;
  overflow-wrap:normal!important;
  word-break:normal!important;
  hyphens:none!important;
}
[data-sanity*="path=heroHeading"]{
  width:min(94vw,1600px)!important;
  max-width:94vw!important;
  margin-inline:auto!important;
  font-size:clamp(4.2rem,9.2vw,10.5rem)!important;
  line-height:.88!important;
  letter-spacing:-.055em!important;
  text-wrap:balance!important;
}
[data-sanity*="path=heroDescription"]{
  width:min(90vw,900px)!important;
  max-width:900px!important;
  margin-inline:auto!important;
  text-wrap:balance!important;
}
[data-sanity*="path=approachHeading"],
[data-sanity*="path=approachHeading"] h2{
  max-width:min(92vw,1280px)!important;
  text-wrap:balance!important;
}
.sc-dd0c2790-3,
.sc-dd0c2790-3 > div,
.sc-dd0c2790-3 em,
.sc-dd0c2790-3 h2{
  max-width:92vw!important;
  box-sizing:border-box!important;
  white-space:normal!important;
  overflow-wrap:normal!important;
  word-break:normal!important;
  text-wrap:balance!important;
}
a[data-enchev-cta-label]{
  max-width:min(92vw,520px)!important;
  white-space:normal!important;
  text-align:center!important;
  line-height:1.2!important;
}
@media (max-width:767px){
  [data-sanity*="path=introductionHeading"]{
    width:88vw!important;
    max-width:88vw!important;
    margin-inline:auto!important;
    font-size:clamp(2.45rem,10.8vw,4rem)!important;
    line-height:.97!important;
    letter-spacing:-.045em!important;
    text-align:center!important;
  }
  [data-sanity*="path=heroHeading"]{
    width:92vw!important;
    max-width:92vw!important;
    margin-inline:auto!important;
    padding-inline:0!important;
    font-size:clamp(3rem,13.5vw,5.2rem)!important;
    line-height:.88!important;
    letter-spacing:-.055em!important;
    text-align:center!important;
    white-space:normal!important;
  }
  [data-sanity*="path=heroDescription"]{
    width:86vw!important;
    max-width:86vw!important;
    margin-inline:auto!important;
    font-size:clamp(1rem,4.5vw,1.25rem)!important;
    line-height:1.42!important;
    text-align:center!important;
  }
  [data-sanity*="path=approachHeading"],
  [data-sanity*="path=approachHeading"] h2{
    width:88vw!important;
    max-width:88vw!important;
    margin-inline:auto!important;
    font-size:clamp(3rem,12vw,4.9rem)!important;
    line-height:.9!important;
    letter-spacing:-.05em!important;
    white-space:normal!important;
  }
  [data-sanity*="path=servicesHeading"]{
    width:88vw!important;
    max-width:88vw!important;
    font-size:clamp(2.8rem,11vw,4.7rem)!important;
    line-height:.94!important;
  }
  .sc-dd0c2790-3,.sc-dd0c2790-3>div{
    width:90vw!important;
    max-width:90vw!important;
    margin-inline:auto!important;
    text-align:center!important;
  }
  .sc-dd0c2790-3 em,.sc-dd0c2790-3 h2{
    display:block!important;
    width:90vw!important;
    max-width:90vw!important;
    margin-inline:auto!important;
    font-size:clamp(3rem,12.5vw,4.9rem)!important;
    line-height:.9!important;
    letter-spacing:-.05em!important;
    text-align:center!important;
  }
  a[data-enchev-cta-label]{
    width:min(88vw,430px)!important;
    max-width:88vw!important;
    min-height:56px!important;
    padding-inline:1.15rem!important;
    font-size:clamp(.72rem,3.1vw,.92rem)!important;
    letter-spacing:.18em!important;
    white-space:normal!important;
  }
}
@media (min-width:768px) and (max-width:1199px){
  [data-sanity*="path=heroHeading"]{font-size:clamp(5.2rem,10vw,8rem)!important}
}
`;

// Mobile browsers (including in-app WebViews) sometimes leave Next/Image's
// low-quality placeholder in data-loaded=false even though the real original
// image is already decoded. The placeholder should never remain blurred.
const imageRecoveryCss = String.raw`
img.ckbPhL[data-loaded='false'] {
  filter: none !important;
}
img.ckbPhL[data-loaded='true'] {
  filter: none !important;
  background-image: none !important;
}
/* A sharp, original photographic fallback behind ActiveFrame's hero canvas.
   ActiveFrame keeps rendering normally on browsers that support its animation. */
@media (max-width: 767px) {
  .dKbqDu {
    background: #050608 url('/forge/media/a7d5d4e97875d7604f97.jpg') center 42% / cover no-repeat;
  }
}
/* Only on devices with no usable WebGL, display a crisp original poster above
   an unusable ActiveFrame canvas. Text and original navigation stay visible. */
html[data-enchev-no-webgl='1'] .dKbqDu::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.04) 45%, rgba(0,0,0,.55)),
              url('/forge/media/a7d5d4e97875d7604f97.jpg') center / cover no-repeat;
}
`;
await writeFile(path.join(output,'enchev-visual-recovery.css'),imageRecoveryCss);

const imageRecoveryJs = String.raw`(() => {
  const testCanvas = document.createElement('canvas');
  let webgl = null;
  try {
    webgl = testCanvas.getContext('webgl2', {failIfMajorPerformanceCaveat:true})
      || testCanvas.getContext('webgl', {failIfMajorPerformanceCaveat:true});
  } catch {}
  if (!webgl) document.documentElement.dataset.enchevNoWebgl = '1';

  function revealDecodedImages() {
    for (const img of document.querySelectorAll('img.ckbPhL')) {
      if (img.dataset.enchevSharpHook !== '1') {
        img.dataset.enchevSharpHook = '1';
        img.addEventListener('load', () => {
          if (img.naturalWidth > 0) img.setAttribute('data-loaded','true');
        }, {passive:true});
      }
      if (img.complete && img.naturalWidth > 0 && img.getAttribute('data-loaded') !== 'true') {
        img.setAttribute('data-loaded','true');
      }
    }
  }
  let queued = false;
  function scheduleReveal() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {queued = false; revealDecodedImages();});
  }
  const observer = new MutationObserver(scheduleReveal);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('DOMContentLoaded',scheduleReveal,{once:true});
  window.addEventListener('load',scheduleReveal,{once:true});
  scheduleReveal();
})();`;
await writeFile(path.join(output,'enchev-visual-recovery.js'),imageRecoveryJs);
await writeFile(path.join(output,'enchev-responsive.css'),responsiveCss);

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
      const destination = rule || { label: "OPEN FULL PLATFORM", href: "/platform" };
      if (element.dataset.enchevCtaLabel === destination.label) continue;
      element.textContent = destination.label;
      if (element.tagName === "A") {
        element.setAttribute("href", destination.href);
        element.setAttribute("target", "_top");
      } else {
        element.dataset.enchevCtaHref = destination.href;
      }
      element.setAttribute("aria-label", destination.label);
      element.dataset.enchevCtaLabel = destination.label;
    }
  }

  const navItems = [
    { label: "HOME", href: "/" },
    { label: "BUY", href: "/inventory" },
    { label: "LIVE AUCTIONS", href: "/live-auctions/etap-1" },
    { label: "DEMO BIDDING", href: "/live-auctions/etap-1" },
    { label: "CHECK VEHICLE", href: "/vehicle-history" },
    { label: "DOCUMENTS & TRANSPORT", href: "/transport" },
    { label: "ABOUT US", href: "/presentation" },
    { label: "SUPPORT", href: "/support" },
    { label: "PLATFORM", href: "/platform" }
  ];

  function setAnchor(anchor, item) {
    anchor.setAttribute("href", item.href);
    anchor.setAttribute("target", "_top");
    anchor.setAttribute("aria-label", item.label);
    anchor.textContent = item.label;
  }

  function findLegacyNavContainer(anchor) {
    let node = anchor.parentElement;
    for (let depth = 0; node && node !== document.body && depth < 7; depth += 1, node = node.parentElement) {
      const links = Array.from(node.querySelectorAll("a"));
      const hrefs = new Set(links.map((link) => link.getAttribute("href")));
      if (hrefs.has("/") && hrefs.has("/builds/") && hrefs.has("/stock/") && hrefs.has("/contact/")) return node;
    }
    return null;
  }

  function cloneNavUnit(templateAnchor, item) {
    const unit = templateAnchor.closest("li") || templateAnchor;
    const clone = unit.cloneNode(true);
    const anchor = clone.tagName === "A" ? clone : clone.querySelector("a");
    if (!anchor) return null;
    setAnchor(anchor, item);
    return clone;
  }

  function applyNavigation() {
    const legacyAnchors = Array.from(document.querySelectorAll('a[href="/builds/"],a[href="/stock/"],a[href="/contact/"]'));
    const containers = new Set();

    for (const anchor of legacyAnchors) {
      const container = findLegacyNavContainer(anchor);
      if (container) containers.add(container);
    }

    for (const container of containers) {
      if (container.dataset.enchevNavSignature === "v2") continue;

      const links = Array.from(container.querySelectorAll("a"));
      const byHref = new Map(links.map((link) => [link.getAttribute("href"), link]));
      const home = byHref.get("/");
      const builds = byHref.get("/builds/");
      const stock = byHref.get("/stock/");
      const contact = byHref.get("/contact/");
      if (!home || !builds || !stock || !contact) continue;

      setAnchor(home, navItems[0]);
      setAnchor(builds, navItems[1]);
      setAnchor(stock, navItems[2]);

      const supportUnit = contact.closest("li") || contact;
      const parent = supportUnit.parentElement;
      if (parent) {
        for (const item of [...navItems.slice(3, 7), navItems[8]]) {
          const clone = cloneNavUnit(contact, item);
          if (clone) parent.insertBefore(clone, supportUnit);
        }
      }
      setAnchor(contact, navItems[7]);
      container.dataset.enchevNavSignature = "v2";
    }

    const directMap = new Map([
      ["/builds/", navItems[1]],
      ["/stock/", navItems[2]],
      ["/contact/", navItems[7]]
    ]);
    for (const [href, item] of directMap) {
      for (const anchor of document.querySelectorAll('a[href="' + href + '"]')) {
        if (anchor.closest(".site-nav")) continue;
        setAnchor(anchor, item);
      }
    }
  }

  // The large Forge mobile overlay renders its LIVE link dynamically; the
  // static site-nav mapping alone cannot guarantee that LIVE opens the demo.
  // Only the explicit LIVE / LIVE AUCTIONS menu links are redirected here.
  const liveDemoHref = "/live-auctions/etap-1";
  const isLiveMenuLink = (anchor) => {
    const label = normalize(anchor.textContent);
    const ariaLabel = normalize(anchor.getAttribute("aria-label"));
    return ["live", "live auctions"].includes(label) ||
      ["live", "live auctions"].includes(ariaLabel);
  };

  function applyLiveDemoLinks() {
    for (const anchor of document.querySelectorAll("a")) {
      if (!isLiveMenuLink(anchor)) continue;
      if (anchor.getAttribute("href") !== liveDemoHref) anchor.setAttribute("href", liveDemoHref);
      if (anchor.getAttribute("target") !== "_top") anchor.setAttribute("target", "_top");
      anchor.setAttribute("data-enchev-live-demo", "true");
    }
  }

  // Capture the click before the animated Forge menu can swallow navigation.
  document.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest && event.target.closest("a");
    if (!anchor || !isLiveMenuLink(anchor)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.top.location.assign(liveDemoHref);
  }, true);

  // The cinematic homepage runs inside an iframe. Navigating inside that frame
  // would leave the system command center over the functional website.
  // Route internal platform links at the top-level page without changing the
  // original Forge transitions, animations, or embedded intro layout.
  function ensurePlatformNavigation() {
    for (const anchor of document.querySelectorAll('a[href^="/"]')) {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("//") || href.startsWith("/forge/")) continue;
      anchor.setAttribute("target", "_top");
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    const button = target && target.closest && target.closest('button[data-enchev-cta-href]');
    if (!button) return;
    const href = button.dataset.enchevCtaHref;
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    event.preventDefault();
    window.top.location.assign(href);
  });

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyCtas();
      applyNavigation();
      applyLiveDemoLinks();
      ensurePlatformNavigation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyCtas();
      applyNavigation();
      applyLiveDemoLinks();
      ensurePlatformNavigation();
    }, { once: true });
  } else {
    applyCtas();
    applyNavigation();
    applyLiveDemoLinks();
    ensurePlatformNavigation();
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
if (!forgeIndex.includes('/forge/enchev-responsive.css')) forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/forge/enchev-responsive.css"></head>');
if (!forgeIndex.includes('/forge/enchev-visual-recovery.css')) {
  forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/forge/enchev-visual-recovery.css"></head>');
}
if (!forgeIndex.includes('/forge/enchev-visual-recovery.js')) {
  forgeIndex = forgeIndex.replace('</body>', '<script src="/forge/enchev-visual-recovery.js" defer></script></body>');
}
if (!forgeIndex.includes('/forge/enchev-cta-map.js')) {
  forgeIndex = forgeIndex.replace('</body>', '<script src="/forge/enchev-cta-map.js" defer></script></body>');
}
await writeFile(forgeIndexPath, forgeIndex);

const pending = JSON.parse(await readFile(path.join(root, 'config/forge-assets.json'), 'utf8'));
// Archived deployments contain the exact, original checked-in manifest images
// before the upstream Sanity CDN removed them. These are emergency recovery
// sources, NOT substitute vehicle photos or approximations. Always verify SHA256.
// The primary alias is only a fallback once a healthy image-complete build is live.
const archivedForgeOrigins = [
  'https://enchev-auctions-2954ebwil-dimitar-lambovs-projects.vercel.app',
  'https://enchev-auctions-nowvojijd-dimitar-lambovs-projects.vercel.app',
  'https://enchev-auctions.vercel.app',
];
let downloaded = 0;
let recoveredFromArchives = 0;
const missingVisuals = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (pending.length) {
    const asset = pending.shift();
    const target = path.join(output, asset.path);
    try {
      if (digest(await readFile(target)) === asset.sha256) continue;
    } catch {}
    const candidates = [asset.url];
    if (asset.path.startsWith('media/')) {
      for (const origin of archivedForgeOrigins) {
        candidates.push(origin + '/forge/' + asset.path);
      }
    }
    let data;
    const errors = [];
    for (const candidate of candidates) {
      const maxAttempts = candidate === asset.url ? 3 : 2;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await fetch(candidate, { signal: AbortSignal.timeout(90000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (digest(bytes) !== asset.sha256) throw new Error('SHA256 mismatch');
          data = bytes;
          if (candidate !== asset.url) recoveredFromArchives++;
          break;
        } catch (error) {
          errors.push(`${candidate}: ${error.message}`);
          // A deleted CDN asset will not reappear on immediate retry.
          if (error.message === 'HTTP 404') break;
        }
      }
      if (data) break;
    }
    if (!data) {
      if (asset.path.startsWith('media/')) {
        missingVisuals.push(asset.path);
        console.error(`Missing verified photo ${asset.path}: ${errors.join(' | ')}`);
        continue;
      }
      throw new Error(`Cannot restore ${asset.path}: ${errors.join(' | ')}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    downloaded++;
  }
}));
console.log(`Forge frontend restored; ${downloaded} binary assets downloaded and verified; ${recoveredFromArchives} exact originals recovered from archived deployments.`);
if (missingVisuals.length) {
  throw new Error(`FORGE VISUAL QA BLOCKED: ${missingVisuals.length} original media files could not be verified; refusing to publish blurred or missing photos.`);
}
if (missingVisuals.length) {
  console.warn(`FORGE VISUAL QA WARNING: ${missingVisuals.length} remote images returned HTTP 404. Missing: ${missingVisuals.join(', ')}. Fix images before production lock.`);
  // Prevent broken-image icons in the legacy Forge shell. Never invent a
  // vehicle photograph: use an explicitly marked neutral placeholder instead.
  const missingPaths=JSON.stringify(missingVisuals.map(name=>"/forge/"+name));
  const fallbackScript=`(() => {
    const missing=${missingPaths};
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="#17251d"/><rect x="44" y="44" width="812" height="512" rx="18" fill="none" stroke="#8db69b" stroke-width="3"/><text x="450" y="290" text-anchor="middle" fill="#e2f7e9" font-family="Arial, sans-serif" font-size="35">IMAGE UNAVAILABLE</text><text x="450" y="345" text-anchor="middle" fill="#abd0b6" font-family="Arial, sans-serif" font-size="20">Original external asset missing - not a vehicle photo</text></svg>';
    function substitute(image){
      if(!(image instanceof HTMLImageElement) || image.dataset.enchevMissingMedia==='1')return;
      try {
        const path=new URL(image.currentSrc||image.src,window.location.href).pathname;
        if(!missing.some(name=>path.endsWith(name) || path.endsWith(name.slice(6))))return;
      } catch{return;}
      image.dataset.enchevMissingMedia='1';
      image.alt='Original external image unavailable; no replacement photograph provided';
      image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    }
    document.addEventListener('error',ev=>substitute(ev.target),true);
    function scan(){document.querySelectorAll('img').forEach(img=>{if(img.complete&&img.naturalWidth===0)substitute(img);});}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
  })();`;
  await writeFile(path.join(output,'missing-media-fallback.js'),fallbackScript);
  let html=await readFile(forgeIndexPath,'utf8');
  if(!html.includes('/forge/missing-media-fallback.js')){
    html=html.replace('</body>','<script src="/forge/missing-media-fallback.js" defer></script></body>');
    await writeFile(forgeIndexPath,html);
  }
}

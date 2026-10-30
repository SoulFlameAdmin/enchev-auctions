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
    { label: "LIVE AUCTIONS", href: "/live-auctions" },
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
      if (container.dataset.enchevNavSignature === "v1") continue;

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
        for (const item of [...navItems.slice(3, 6), navItems[7]]) {
          const clone = cloneNavUnit(contact, item);
          if (clone) parent.insertBefore(clone, supportUnit);
        }
      }
      setAnchor(contact, navItems[6]);
      container.dataset.enchevNavSignature = "v1";
    }

    const directMap = new Map([
      ["/builds/", navItems[1]],
      ["/stock/", navItems[2]],
      ["/contact/", navItems[6]]
    ]);
    for (const [href, item] of directMap) {
      for (const anchor of document.querySelectorAll('a[href="' + href + '"]')) {
        if (anchor.closest(".site-nav")) continue;
        setAnchor(anchor, item);
      }
    }
  }

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
      ensurePlatformNavigation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyCtas();
      applyNavigation();
      ensurePlatformNavigation();
    }, { once: true });
  } else {
    applyCtas();
    applyNavigation();
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
// The discontinued original Forge Sanity file was only an OpenGraph/Twitter
// social preview image (not runtime layout, animation or vehicle content).
// Replace ALL FOUR embedded SSR/RSC references with the approved local E&A
// brand image, and remove the dead asset from the download manifest separately.
const missingSocialImage = '/forge/media/2480ec12b70d13d46feb.jpg';
const approvedSocialImage = '/brand/ea-approved-1to1.jpg';
const localSocialImage = await readFile(path.join(root, 'public/brand/ea-approved-1to1.jpg'));
if (localSocialImage.byteLength < 1024 ||
    localSocialImage[0] !== 0xff || localSocialImage[1] !== 0xd8) {
  throw new Error('Approved E&A social image is not a valid local JPEG');
}
function socialJpegDimensions(data) {
  let offset = 2;
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) throw new Error('Malformed E&A social image');
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker === 0xd8 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) throw new Error('Malformed E&A JPEG segment');
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error('Cannot read approved E&A social image dimensions');
}
const { width: socialWidth, height: socialHeight } = socialJpegDimensions(localSocialImage);
if (socialWidth < 1 || socialHeight < 1) throw new Error('Invalid E&A social image dimensions');
function replaceSocialToken(original, replacement, expectedCount) {
  const occurrences = forgeIndex.split(original).length - 1;
  if (occurrences !== expectedCount) {
    throw new Error('Forge social preview reference changed: ' + original.slice(0, 60) +
      ' expected=' + expectedCount + ' actual=' + occurrences);
  }
  forgeIndex = forgeIndex.replaceAll(original, replacement);
}
replaceSocialToken(missingSocialImage, approvedSocialImage, 4);
const escapedQuote = String.fromCharCode(92) + '"';
function correctSocialDimension(field, oldSize, newSize) {
  replaceSocialToken(
    'og:image:' + field + '" content="' + oldSize + '"',
    'og:image:' + field + '" content="' + newSize + '"', 1
  );
  replaceSocialToken(
    'og:image:' + field + escapedQuote + ',' + escapedQuote + 'content' + escapedQuote + ':' + escapedQuote + oldSize + escapedQuote,
    'og:image:' + field + escapedQuote + ',' + escapedQuote + 'content' + escapedQuote + ':' + escapedQuote + newSize + escapedQuote, 1
  );
}
correctSocialDimension('width', 1200, socialWidth);
correctSocialDimension('height', 630, socialHeight);
if (forgeIndex.includes(missingSocialImage)) throw new Error('Dead Forge social asset still referenced');

if (!forgeIndex.includes('/forge/enchev-responsive.css')) forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/forge/enchev-responsive.css"></head>');
if (!forgeIndex.includes('/forge/enchev-cta-map.js')) {
  forgeIndex = forgeIndex.replace('</body>', '<script src="/forge/enchev-cta-map.js" defer></script></body>');
}
await writeFile(forgeIndexPath, forgeIndex);

const pending = JSON.parse(await readFile(path.join(root, 'config/forge-assets.json'), 'utf8'));
let downloaded = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (pending.length) {
    const asset = pending.shift();
    const target = path.join(output, asset.path);
    try {
      if (digest(await readFile(target)) === asset.sha256) continue;
    } catch {}
    // The supplied original Forge CDN now returns 404 for some captured
    // images. The already published Enchev frontend contains exact immutable
    // copies. Prefer that approved, same-project mirror; ALWAYS re-hash bytes.
    // Do not accept redirects, stale/different contents, or unverified files.
    if (typeof asset.path !== 'string' || asset.path.startsWith('/') ||
        asset.path.split('/').some(part => part === '..' || part === '.' || !part) ||
        !/^[a-zA-Z0-9_./-]+$/.test(asset.path) ||
        typeof asset.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(asset.sha256)) {
      throw new Error('Invalid Forge SHA-256 asset manifest entry');
    }
    let data;
    const sources = [
      { name: 'production-mirror', url: 'https://enchev-auctions.vercel.app/forge/' + asset.path, attempts: 1 },
      { name: 'captured-origin', url: asset.url, attempts: 3 },
    ];
    const failures = [];
    for (const source of sources) {
      for (let attempt = 0; attempt < source.attempts; attempt++) {
        try {
          const response = await fetch(source.url, {
            redirect: 'error',
            signal: AbortSignal.timeout(30000),
            cache: 'no-store',
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const candidate = Buffer.from(await response.arrayBuffer());
          if (digest(candidate) !== asset.sha256) throw new Error('SHA-256 mismatch');
          data = candidate;
          break;
        } catch (error) {
          failures.push(source.name + ':' + (error?.message || 'network-error'));
        }
      }
      if (data) break;
    }
    if (!data) {
      throw new Error(`Cannot restore ${asset.path}: ${failures.join(' | ')}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    downloaded++;
  }
}));
console.log(`Forge frontend restored; ${downloaded} binary assets downloaded and verified.`);

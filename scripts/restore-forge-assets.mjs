import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateManifest, verifyRestoredAssets } from './verify-urgent-d002-forge-media.mjs';

const root = process.cwd();
const output = path.join(root, 'public/forge');
const digest = value => createHash('sha256').update(value).digest('hex');
const frontend = JSON.parse(gunzipSync(await readFile(path.join(root, 'config/forge-frontend.json.gz'))));
// The desktop intro frames are not GLB: they are WebCodecs/ActiveFrame
// frames composited into a 2D/WebGL canvas. Track decoder instances and
// switch to software decoding if the PC hardware decoder starts failing.
// Keep the native animation/scroll timeline and original media unchanged.
function recoverDesktopActiveFrame(original) {
  let code = original;
  const rewrites = [
    [
      "\t\tthis.file = file;\n\t\tthis.init();",
      "\t\tthis.file = file;\n\t\t(window.__enchevActiveFrames ??= new Set()).add(this);\n\t\tthis.init();"
    ],
    [
      "\t\tthis.decoder.configure(this.config);\n\t\tthis._needsKeyFrame = true;",
      "\t\ttry { this.decoder.configure(this.config); }\n" +
      "\t\tcatch (error) {\n" +
      "\t\t\tif (this.config?.hardwareAcceleration !== 'prefer-software') throw error;\n" +
      "\t\t\tthis.config = { ...this.config, hardwareAcceleration: 'no-preference' };\n" +
      "\t\t\tthis.decoder.configure(this.config);\n" +
      "\t\t}\n" +
      "\t\tthis._needsKeyFrame = true;"
    ],
    [
      "\t\tif (this._decoderFailed) {\n\t\t\tthis._decoderFailed = false;\n\t\t\tthis._recoveries += 1;",
      "\t\tif (this._decoderFailed) {\n\t\t\tthis._decoderFailed = false;\n\t\t\tthis._recoveries += 1;\n" +
      "\t\t\tif (this._recoveries === 1) {\n" +
      "\t\t\t\tthis.config = { ...this.config, hardwareAcceleration: 'prefer-software' };\n" +
      "\t\t\t}"
    ],
    [
      "\t\tthis.stop();\n\n\t\tif (this.decoder && this.decoder.state !== 'closed')",
      "\t\tthis.stop();\n\t\twindow.__enchevActiveFrames?.delete(this);\n\n\t\tif (this.decoder && this.decoder.state !== 'closed')"
    ]
  ];
  for (const [before, after] of rewrites) {
    if (code.split(before).length !== 2) {
      throw new Error('ActiveFrame desktop recovery patch unexpectedly changed upstream');
    }
    code = code.replace(before, after);
  }
  return code;
}
for (const [relative, content] of Object.entries(frontend)) {
  const target = path.join(output, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, relative === 'ActiveFrame.js' ? recoverDesktopActiveFrame(content) : content);
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
  // The cinematic homepage has fourteen CTA buttons in its visual sections.
  // Map them to the same seven buyer stages used by /start; don't divert all
  // original "Start your project" controls to one generic destination.
  const rules = [
    { heading: "Identity", label: "REGISTER", href: "/register" },
    { heading: "Insight", label: "VERIFY & DEPOSIT", href: "/verification" },
    { heading: "Cohesion", label: "CHOOSE VEHICLE", href: "/vehicles" },
    { heading: "Discovery", label: "CHOOSE VEHICLE", href: "/auctions" },
    { heading: "Inspection", label: "CHECK VEHICLE", href: "/vehicle-history" },
    { heading: "Auctions", label: "LIVE AUCTIONS", href: "/auctions" },
    { heading: "History", label: "MY AUCTIONS", href: "/my-auctions" },
    { heading: "Transport", label: "TRANSPORT", href: "/transport" },
    { heading: "Support", label: "SUPPORT", href: "/support" },
    { heading: "Vehicle Inventory", label: "FIND VEHICLES", href: "/vehicles" },
    { heading: "Live Auctions", label: "LIVE AUCTIONS", href: "/auctions" },
    { heading: "Refuse Ordinary", label: "7 STEPS TO BUY", href: "/start" },
    { heading: "Your Route To Your Next Vehicle", label: "START HERE", href: "/start" }
  ];

  const defaultDestination = { label: "7 STEPS TO BUY", href: "/start" };
  function nearestRule(element) {
    let section=element.closest("section");
    while (section && section !== document.body) {
      const headingNodes=Array.from(section.querySelectorAll("h1,h2,h3,h4,h5"));
      for (const heading of headingNodes) {
        const value=normalize(heading.textContent);
        const rule=rules.find(item=>value===normalize(item.heading));
        if(rule)return rule;
      }
      const routeTo=section.dataset.enchevBuyerDestination;
      if(routeTo) return rules.find(item=>item.href===routeTo)||defaultDestination;
      section=section.parentElement && section.parentElement.closest("section");
    }
    return defaultDestination;
  }

  function applyCtas() {
    const candidates=Array.from(document.querySelectorAll("a.sc-6f2721c4-0,button.sc-6f2721c4-0"))
      .filter(element=>{
        const value=normalize(element.textContent);
        return value==="start your project" ||
          element.getAttribute("aria-label")==="Explore Inventory" ||
          element.getAttribute("aria-label")==="Browse Auctions" ||
          element.hasAttribute("data-enchev-cta-label");
      });

    for (const element of candidates) {
      const destination=nearestRule(element);
      if(element.dataset.enchevCtaHref===destination.href &&
         element.dataset.enchevCtaLabel===destination.label)continue;

      // Preserve the original split-letter spans and hover animation of Forge.
      const originalSpan=element.querySelector(":scope > span");
      if(originalSpan) {
        const letters=document.createDocumentFragment();
        for(const char of destination.label){
          const letter=document.createElement("span");
          letter.textContent=char===" "?"\u00a0":char;
          letters.append(letter);
        }
        originalSpan.replaceChildren(letters);
      } else {
        element.textContent=destination.label;
      }

      if(element.tagName==="A"){
        element.setAttribute("href",destination.href);
        element.setAttribute("target","_top");
      }else {
        element.dataset.enchevCtaHref=destination.href;
      }
      element.dataset.enchevCtaHref=destination.href;
      element.dataset.enchevCtaLabel=destination.label;
      element.setAttribute("aria-label",destination.label);
    }
  }

  const navItems = [
    { label: "HOME", href: "/" },
    { label: "BUY", href: "/start" },
    { label: "LIVE AUCTIONS", href: "/auctions" },
    { label: "REGISTER", href: "/register" },
    { label: "SIGN IN", href: "/login" },
    { label: "PAYMENTS", href: "/payments" },
    { label: "SUPPORT", href: "/support" }
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
        for (const item of navItems.slice(3, navItems.length-1)) {
          const clone = cloneNavUnit(contact, item);
          if (clone) parent.insertBefore(clone, supportUnit);
        }
      }
      setAnchor(contact, navItems[navItems.length-1]);
      container.dataset.enchevNavSignature = "v1";
    }

    const directMap = new Map([
      ["/builds/", navItems[1]],
      ["/stock/", navItems[2]],
      ["/contact/", navItems[navItems.length-1]]
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
if (!forgeIndex.includes('/forge/enchev-responsive.css')) forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/forge/enchev-responsive.css"></head>');
if (!forgeIndex.includes('/forge/enchev-cta-map.js')) {
  forgeIndex = forgeIndex.replace('</body>', '<script src="/forge/enchev-cta-map.js" defer></script></body>');
}
if (!forgeIndex.includes('/brand/ea-forge-branding.css')) forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/brand/ea-forge-branding.css"></head>');
if (!forgeIndex.includes('/brand/ea-buyer-navigation.css')) forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/brand/ea-buyer-navigation.css"></head>');
if (!forgeIndex.includes('/brand/ea-buyer-navigation.js')) forgeIndex = forgeIndex.replace('</body>', '<script src="/brand/ea-buyer-navigation.js" defer></script></body>');

// 1:1 red/white racing splash. Loaded AFTER Forge styles; only the intro dialog is styled.
if (!forgeIndex.includes('/brand/ea-cinematic-intro.css')) forgeIndex = forgeIndex.replace('</head>', '<link rel="stylesheet" href="/brand/ea-cinematic-intro.css"></head>');
if (!forgeIndex.includes('/brand/ea-forge-branding.js')) forgeIndex = forgeIndex.replace('</body>', '<script src="/brand/ea-forge-branding.js" defer></script></body>');
if (!forgeIndex.includes('/brand/ea-cinematic-intro.js')) forgeIndex = forgeIndex.replace('</body>', '<script src="/brand/ea-cinematic-intro.js" defer></script></body>');
// Restore the original Forge scroller/canvas lifecycle after either ad exit path.
if (!forgeIndex.includes('/brand/ea-forge-resume.js')) forgeIndex = forgeIndex.replace('</body>', '<script src="/brand/ea-forge-resume.js" defer></script></body>');
// Desktop-only progressive enhancement: retain native canvas, fallback to 3D GLB if no pixels.
if (!forgeIndex.includes('/brand/ea-desktop-3d-recovery.js')) forgeIndex = forgeIndex.replace('</body>', '<script src="/brand/ea-desktop-3d-recovery.js" defer></script></body>');
forgeIndex = forgeIndex.replace(/<title>[^<]*<\/title>/, '<title>E&amp;A East West Auctioneers Group | Vehicle Auctions</title>');
forgeIndex = forgeIndex.replace(/<meta property="og:site_name" content="[^"]*"/, '<meta property="og:site_name" content="E&amp;A East West Auctioneers Group"');
await writeFile(forgeIndexPath, forgeIndex);

const pending = JSON.parse(await readFile(path.join(root, 'config/forge-assets.json'), 'utf8'));
validateManifest(pending);
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
        // Original media links can disappear upstream. Try the last verified
        // ENCHEV production snapshot before declaring the immutable asset lost.
        const historicalUrl = 'https://enchev-auctions-qw3dawzn0-dimitar-lambovs-projects.vercel.app/forge/' + asset.path;
        const url = attempt === 0 ? asset.url : historicalUrl;
        const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
        if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
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
const confirmed = await verifyRestoredAssets(JSON.parse(await readFile(path.join(root, 'config/forge-assets.json'), 'utf8')),output);
console.log(`URGENT_D002_FORGE_MEDIA PASS count=${confirmed.count} bytes=${confirmed.bytes} repaired_404_asset=${confirmed.knownMissingMediaVerified}`);
console.log(`Forge frontend restored; ${downloaded} binary assets downloaded and verified.`);

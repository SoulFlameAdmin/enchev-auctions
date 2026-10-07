import zipfile,json,pathlib,urllib.parse,hashlib,re,html,collections
root=pathlib.Path(__file__).resolve().parents[1]
z=zipfile.ZipFile(root.parent/'upload/forgeautomotive-full-frontend.zip')
r=json.loads(z.read('download-report.json'))
out=root/'public/forge';out.mkdir(parents=True,exist_ok=True)
groups=collections.defaultdict(list)
for f in r['files']:
 if f['path'].startswith('external/'):
  u=urllib.parse.urlsplit(f['url']);groups[u.scheme+'://'+u.netloc+u.path].append(f)
choices={}
for base,items in groups.items():
 def score(f):
  q=urllib.parse.parse_qs(urllib.parse.urlsplit(f['url']).query)
  try:w=int(q.get('w',['1920'])[0])
  except:w=1920
  return abs(w-1920),f['bytes']
 selected=min(items,key=score)
 ext=pathlib.Path(urllib.parse.urlsplit(base).path).suffix or '.bin'
 rel='media/'+hashlib.sha256(base.encode()).hexdigest()[:20]+ext
 p=out/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(selected['path']))
 choices[base]='/forge/'+rel

copy={
 'Forge Automotive':'ENCHEV Auctions',
 'Forge home':'Enchev home',
 'Welcome to Forge Automotive':'Welcome to ENCHEV Auctions',
 'We don’t modify vehicles':'We connect you with vehicles',
 'We build them for you':'You choose your next one',
 'A luxury automotive atelier for bespoke styling, performance and craftsmanship.':'An international vehicle auction marketplace for discovery, bidding and delivery.',
 'Our Approach To Every Build':'Your Route To Your Next Vehicle',
 'Bodystyling':'Discovery','Interior':'Inspection','Wheels':'Auctions','Lighting':'History','Exhaust':'Transport','Protection':'Support',
 'Previous Builds':'Vehicle Inventory','Available Stock':'Live Auctions',
 'Explore Builds':'Explore Inventory','Browse Stock':'Browse Auctions',
 'Bespoke vehicles built on distinction, desire, and identity. not simply to be modified.':'Vehicle auctions with inventory, live bidding, vehicle history and transport in one place.',
}

def adapt(text):
 # Handles URLs in attributes, CSS, regular JSON and doubly escaped Next Flight records.
 pattern=r'https://cdn\.sanity\.io/[^\s<>"\'\\)]+(?:\\u0026[^\s<>"\'\\)]*)*'
 def media(m):
  value=html.unescape(m.group()).replace('\\u0026','&')
  u=urllib.parse.urlsplit(value)
  return choices.get(u.scheme+'://'+u.netloc+u.path,m.group())
 text=re.sub(pattern,media,text)
 text=text.replace('/_next/','/forge/_next/')
 text=text.replace('"/ActiveFrame.js"','"/forge/ActiveFrame.js"')
 text=re.sub(r'new URL\(([A-Za-z_$][\w$]*)\)',r'new URL(\1,window.location.origin)',text)
 text=text.replace('"/videos/', '"/forge/videos/')
 # Graceful fallback when the browser cannot decode ActiveFrame (for example HTTP previews).
 text=text.replace('K&&(!M||R)', 'K&&("unsupported"===T||"error"===T||!M||R)')
 text=re.sub(r'baseUrl:\([^)]*"https://api\.sanity\.io"\)\.replace\([^)]*\)', 'baseUrl:"/forge/sanity"', text)
 text=text.replace('"/_next"','"/forge/_next"')
 for before,after in copy.items():text=text.replace(before,after)
 text=text.replace('https://forgeautomotive.co.uk','https://enchev-auctions.vercel.app')
 text=text.replace('tel:+443330417965','/support')
 return text

for n in z.namelist():
 if n.startswith('external/') or n in ['download-report.json','rendered-page.html'] or n.endswith('index.html'):continue
 p=out/n;p.parent.mkdir(parents=True,exist_ok=True);data=z.read(n)
 if n.endswith(('.js','.css','.json','.svg')):data=adapt(data.decode()).encode()
 p.write_bytes(data)
cta_map_script=r'''(() => {
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
    const candidates = Array.from(document.querySelectorAll("a,button")).filter((element) => normalize(element.textContent) === "start your project");
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

  const navItems = [
    { label: "HOME", href: "/" },
    { label: "BUY", href: "/inventory" },
    { label: "LIVE AUCTIONS", href: "/live-auctions" },
    { label: "CHECK VEHICLE", href: "/vehicle-history" },
    { label: "DOCUMENTS & TRANSPORT", href: "/transport" },
    { label: "ABOUT US", href: "/presentation" },
    { label: "SUPPORT", href: "/support" }
  ];

  function setAnchor(anchor, item) {
    anchor.setAttribute("href", item.href);
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
        for (const item of navItems.slice(3, 6)) {
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
      for (const anchor of document.querySelectorAll(`a[href="${href}"]`)) {
        if (anchor.closest(".site-nav")) continue;
        setAnchor(anchor, item);
      }
    }
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyCtas();
      applyNavigation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyCtas();
      applyNavigation();
    }, { once: true });
  } else {
    applyCtas();
    applyNavigation();
  }

  new MutationObserver(scheduleApply).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();'''
(out/'enchev-cta-map.js').write_text(cta_map_script)
h=adapt(z.read('index.html').decode())
h=re.sub(r'<script[^>]*type="application/ld\+json"[^>]*>.*?</script>','',h,flags=re.S)
h=h.replace('</head>','<link rel="stylesheet" href="/forge/enchev-adaptation.css"><script src="/forge/enchev-adaptation.js" defer></script></head>')
h=h.replace('</body>','<script src="/forge/enchev-cta-map.js" defer></script></body>')
(out/'index.html').write_text(h)
(out/'source-manifest.json').write_text(json.dumps({'source':r['page'],'externalAssets':choices,'sourceFiles':len(z.namelist()),'failedSourceRequests':r['failed']},indent=2))
(root/'config/forge-image-paths.json').write_text(json.dumps({urllib.parse.urlsplit(base).path:local for base,local in choices.items()},indent=2))
print(json.dumps({'packagedFiles':len(list(out.rglob('*'))),'deduplicatedImages':len(choices),'bytes':sum(p.stat().st_size for p in out.rglob('*') if p.is_file())}))

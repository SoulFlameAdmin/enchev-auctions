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
const bgResponsiveCss = String.raw\`
/* ENCHEV Bulgarian copy + responsive safety layer */
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
[data-sanity*="path=introductionHeading"]{
  text-wrap:balance!important;
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
  font-size:clamp(1rem,1.65vw,1.65rem)!important;
  line-height:1.35!important;
  text-wrap:balance!important;
}
[data-sanity*="path=approachHeading"] h2,
[data-sanity*="path=approachHeading"]{
  max-width:min(92vw,1280px)!important;
  font-size:clamp(4rem,8vw,9rem)!important;
  line-height:.9!important;
  letter-spacing:-.045em!important;
  text-wrap:balance!important;
}
[data-sanity*="path=servicesHeading"]{
  max-width:min(92vw,1280px)!important;
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
    width:min(88vw,560px)!important;
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
  [data-sanity*="path=heroHeading"] *{
    white-space:normal!important;
    max-width:100%!important;
  }
  [data-sanity*="path=heroDescription"]{
    width:86vw!important;
    max-width:86vw!important;
    margin-inline:auto!important;
    padding-inline:0!important;
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
  [data-sanity*="path=heading"]{
    white-space:normal!important;
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
  [data-sanity*="path=approachHeading"],
  [data-sanity*="path=approachHeading"] h2{font-size:clamp(4.8rem,8.5vw,7.4rem)!important}
}
\`;
await writeFile(path.join(output, 'enchev-bg-responsive.css'), bgResponsiveCss);

const ctaMapScript = String.raw`(() => {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const rules = [
    { heading: "Your Route To Your Next Vehicle", label: "НАДДАВАЙ", href: "/live-auctions" },
    { heading: "Identity", label: "НАДДАВАЙ", href: "/live-auctions" },
    { heading: "Insight", label: "ДОКУМЕНТИ И ТРАНСПОРТ", href: "/transport" },
    { heading: "Cohesion", label: "КУПИ", href: "/inventory" },
    { heading: "Discovery", label: "ПРОВЕРИ АВТОМОБИЛА", href: "/vehicle-history" },
    { heading: "Inspection", label: "ЗА НАС", href: "/presentation" },
    { heading: "Auctions", label: "НАДДАВАЙ", href: "/live-auctions" },
    { heading: "History", label: "ПРОВЕРИ АВТОМОБИЛА", href: "/vehicle-history" },
    { heading: "Transport", label: "ДОКУМЕНТИ И ТРАНСПОРТ", href: "/transport" },
    { heading: "Support", label: "ПОДДРЪЖКА", href: "/support" }
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

  const textTranslations = new Map([
    ["skip to content","Към съдържанието"],
    ["navigate","Навигация"],
    ["close","Затвори"],
    ["we connect you with vehicles","Свързваме те с правилния автомобил"],
    ["you choose your next one","Ти избираш следващия"],
    ["for those who refuse ordinary","За тези, които отказват обикновеното"],
    ["an international vehicle auction marketplace for discovery, bidding and delivery.","Международна платформа за автомобили, търгове и доставка на едно място."],
    ["your route to your next vehicle","Твоят път към следващия автомобил"],
    ["every decision is intentional, every detail has purpose based on your taste, your lifestyle, and your standards.","Всяко решение е премерено, а всеки детайл има смисъл според твоя вкус, начин на живот и стандарти."],
    ["identity","Идентичност"],
    ["every build begins with the person behind the wheel, shaped around their individual taste, lifestyle, presence and personal sense of identity on the road.","Всичко започва с човека зад волана — неговия вкус, начин на живот, присъствие и личен стил на пътя."],
    ["insight","Поглед отвъд детайла"],
    ["exterior, interior and performance are brought together through a considered, detail-led approach, creating one complete and fully resolved vision.","Екстериорът, интериорът и представянето се обединяват в цялостна, прецизно изградена визия."],
    ["cohesion","Цялостност"],
    ["every modification is chosen with precision, ensuring each detail adds purpose, balance and distinction to the final bespoke automotive build.","Всеки избор е направен прецизно, така че всеки детайл да добавя смисъл, баланс и характер."],
    ["a vehicle should say something before it moves. every line, material, and finish is considered.","Автомобилът трябва да казва нещо още преди да потегли. Всяка линия, материал и завършек са обмислени."],
    ["our services are shaped with intent, from exterior styling and interior refinement to performance upgrades, detailing and bespoke finishes; each detail sharpens the vehicle’s character without overpowering it.","Услугите ни са изградени с ясна цел — от откриването и проверката на автомобил до търга, историята, транспорта и поддръжката."],
    ["service","Услуга"],
    ["discovery","Откриване"],
    ["from aero styling to carbon details and exterior refinement, bodywork is designed to change the vehicle’s presence without compromising its original character.","Открий автомобила, който отговаря на твоите изисквания, с ясна информация за лота и състоянието му."],
    ["inspection","Проверка"],
    ["material, stitching, trim and finish are selected to create an interior that feels personal, tactile and composed. we turn the cabin into a space of identity, comfort and control.","Провери автомобила преди покупка — данни, състояние, история и ключови детайли на едно място."],
    ["auctions","Търгове"],
    ["bespoke wheel upgrades designed to enhance stance, proportion and road presence, with fitments selected to complement the vehicle’s character and performance.","Наддавай в реално време и следи текущата цена, оставащото време и резултата от търга."],
    ["history","История"],
    ["history gives a vehicle its expression. from subtle tinting to signature illumination and refined visual details, we use light to sharpen character, presence and atmosphere.","Провери VIN, известни щети, пробег, регистрационен статус и налични аукционни записи."],
    ["transport","Транспорт"],
    ["transport upgrades are chosen for tone, response and presence. not noise for the sake of noise, but a sound profile that gives the vehicle more character and depth.","Организираме пътя на автомобила от площадката до България и до избрания от теб адрес."],
    ["support","Поддръжка"],
    ["paint protective film solutions that preserve the finish of the vehicle while allowing for satin finishes, coloured films and full visual transformation.","Една ясна точка за помощ при автомобили, търгове, документи, транспорт и работа с платформата."],
    ["ordinary","Обикновеното"],
    ["ends here","свършва тук"],
    ["complete expressions of taste, intent and individuality, shaped through detail, restraint and presence.","Подбрани автомобили, ясни данни и единен процес от избора до доставката."],
    ["vehicle inventory","Автомобили"],
    ["a collection of previous bespoke builds, shaped by craft, character and the people behind the wheel.","Разгледай наличните автомобили и намери следващия лот за теб."],
    ["live auctions","Търгове на живо"],
    ["builds available for purchase, refined with intent, engineered with purpose, and ready to make a statement.","Следи активните търгове и наддавай в реално време."],
    ["are you ready to","Готов ли си да"],
    ["refuse ordinary","избереш различното"],
    ["home","Начало"],
    ["builds","Автомобили"],
    ["stock","Търгове"],
    ["contact","Поддръжка"],
    ["cookies","Бисквитки"],
    ["privacy","Поверителност"],
    ["terms","Условия"],
    ["sitemap","Карта на сайта"],
    ["vehicle auctions with inventory, live bidding, vehicle history and transport in one place.","Автомобили, търгове на живо, история на МПС и транспорт на едно място."]
  ]);

  const forcedCopy = [
    ['[data-sanity*="path=introductionHeading"]',"Свързваме те с автомобилите|Ти избираш следващия"],
    ['[data-sanity*="path=heroHeading"]',"За тези, които отказват обикновеното"],
    ['[data-sanity*="path=heroDescription"]',"Международна платформа за автомобили, търгове и доставка на едно място."],
    ['[data-sanity*="path=approachHeading"]',"Твоят път към следващия автомобил"],
    ['[data-sanity*="path=servicesHeading"]',"Автомобилът трябва да казва нещо още преди да потегли. Всяка линия, материал и завършек са обмислени."],
    ['[data-sanity*="path=approachUsps:d9adc7372ab9.heading"]',"Идентичност"],
    ['[data-sanity*="path=approachUsps:568f1f1faddc.heading"]',"Поглед отвъд детайла"],
    ['[data-sanity*="path=approachUsps:7edeb5d12075.heading"]',"Цялостност"],
    ['[data-sanity*="id=globalAllBuildsCta"][data-sanity*="path=heading"]',"Автомобили"],
    ['[data-sanity*="id=globalStockCta"][data-sanity*="path=heading"]',"Търгове на живо"],
    ['[data-sanity*="id=globalCta"][data-sanity*="path=heading"]',"Избери различното"]
  ];

  const serviceHeadingCopy = new Map([
    ["discovery","Откриване"],
    ["inspection","Проверка"],
    ["auctions","Търгове"],
    ["history","История"],
    ["transport","Транспорт"],
    ["support","Поддръжка"]
  ]);

  function setCopy(element, value){
    if(!element) return;
    const expected=value.replaceAll("|"," ");
    if(normalize(element.textContent)===normalize(expected)) return;
    if(value.includes("|")){
      const [first,second]=value.split("|");
      element.innerHTML="";
      element.append(document.createTextNode(first),document.createElement("br"),document.createTextNode(second));
    }else{
      element.textContent=value;
    }
  }

  function forceBulgarianHomeCopy(){
    for(const [selector,value] of forcedCopy){
      document.querySelectorAll(selector).forEach((element)=>setCopy(element,value));
    }
    document.querySelectorAll('[data-sanity*="type=service"][data-sanity*="path=heading"]').forEach((element)=>{
      const key=normalize(element.textContent);
      const translated=serviceHeadingCopy.get(key);
      if(translated) setCopy(element,translated);
    });

    const splitWordMap=new Map([
      ["we","Свързваме"],["connect","свързваме"],["you","те"],["with","с"],["vehicles","автомобилите"],
      ["choose","избираш"],["your","твоя"],["next","следващия"],["one","автомобил"],
      ["for","За"],["those","тези,"],["who","които"],["refuse","отказват"],["ordinary","обикновеното"],
      ["start",""],["project",""]
    ]);
    document.querySelectorAll('[data-sanity*="path=introductionHeading"] span,[data-sanity*="path=heroHeading"] span').forEach((span)=>{
      const translated=splitWordMap.get(normalize(span.textContent));
      if(translated!==undefined && translated && span.textContent!==translated) span.textContent=translated;
    });
  }

  function translateVisibleText(){
    document.documentElement.lang = "bg";
    document.title = "Автомобилни търгове | ENCHEV Аукциони";
    const metaDescription = document.querySelector('meta[name="description"]');
    if(metaDescription) metaDescription.setAttribute("content","Автомобили, търгове на живо, проверка на история и транспорт в една система.");

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while((node = walker.nextNode())){
      const key = normalize(node.nodeValue);
      const translated = textTranslations.get(key);
      if(translated) node.nodeValue = translated;
    }

    for(const element of document.querySelectorAll("[aria-label],[title],[placeholder],[alt]")){
      for(const attribute of ["aria-label","title","placeholder","alt"]){
        const value = element.getAttribute(attribute);
        const translated = value ? textTranslations.get(normalize(value)) : null;
        if(translated) element.setAttribute(attribute, translated);
      }
    }

    const actionMap = new Map([
      ["/builds/", {label:"РАЗГЛЕДАЙ АВТОМОБИЛИТЕ", href:"/inventory"}],
      ["/stock/", {label:"ТЪРГОВЕ НА ЖИВО", href:"/live-auctions"}],
      ["/contact/", {label:"ПОДДРЪЖКА", href:"/support"}]
    ]);
    for(const [href, item] of actionMap){
      for(const anchor of document.querySelectorAll('a[href="' + href + '"]')){
        if(anchor.closest(".site-nav")) continue;
        anchor.setAttribute("href",item.href);
        anchor.setAttribute("aria-label",item.label);
        anchor.textContent=item.label;
      }
    }

    for(const button of document.querySelectorAll("button")){
      const value=normalize(button.textContent);
      if(value==="back to top"){
        button.textContent="НАГОРЕ";
        button.setAttribute("aria-label","Нагоре");
      }
    }
  }

  const navItems = [
    { label: "НАЧАЛО", href: "/" },
    { label: "КУПИ", href: "/inventory" },
    { label: "ТЪРГОВЕ НА ЖИВО", href: "/live-auctions" },
    { label: "ПРОВЕРИ АВТОМОБИЛА", href: "/vehicle-history" },
    { label: "ДОКУМЕНТИ И ТРАНСПОРТ", href: "/transport" },
    { label: "ЗА НАС", href: "/presentation" },
    { label: "ПОДДРЪЖКА", href: "/support" }
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
      for (const anchor of document.querySelectorAll('a[href="' + href + '"]')) {
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
      translateVisibleText();
      forceBulgarianHomeCopy();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyCtas();
      applyNavigation();
      translateVisibleText();
      forceBulgarianHomeCopy();
    }, { once: true });
  } else {
    applyCtas();
    applyNavigation();
    translateVisibleText();
    forceBulgarianHomeCopy();
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
const staticBulgarianReplacements = [
  ["We connect you with vehicles<br />You choose your next one","Свързваме те с автомобилите<br />Ти избираш следващия"],
  ["For Those Who Refuse Ordinary","За тези, които отказват обикновеното"],
  ["An international vehicle auction marketplace for discovery, bidding and delivery.","Международна платформа за автомобили, търгове и доставка на едно място."],
  ["Your Route To Your Next Vehicle","Твоят път към следващия автомобил"],
  ["Every decision is intentional, every detail has purpose based on your taste, your lifestyle, and your standards.","Всяко решение е премерено, а всеки детайл има смисъл според твоя вкус, начин на живот и стандарти."],
  [">Identity<",">Идентичност<"],
  [">Insight<",">Поглед отвъд детайла<"],
  [">Cohesion<",">Цялостност<"],
  ["A vehicle should say something before it moves. Every line, material, and finish is considered.","Автомобилът трябва да казва нещо още преди да потегли. Всяка линия, материал и завършек са обмислени."],
  ["Vehicle Inventory","Автомобили"],
  ["Live Auctions","Търгове на живо"],
  ["Refuse Ordinary","Избери различното"]
];
for(const [from,to] of staticBulgarianReplacements) forgeIndex=forgeIndex.replaceAll(from,to);
if(!forgeIndex.includes('/forge/enchev-bg-responsive.css')){
  forgeIndex=forgeIndex.replace('</head>','<link rel="stylesheet" href="/forge/enchev-bg-responsive.css"></head>');
}

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

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

  function translateVisibleText(){
    document.documentElement.lang = "bg";
    document.title = "Автомобилни търгове | ENCHEV Auctions";
    const metaDescription = document.querySelector('meta[name="description"]');
    if(metaDescription) metaDescription.setAttribute("content","Автомобили, търгове на живо, проверка на история и транспорт в една система.");

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while((node = walker.nextNode())){
      const key = normalize(node.nodeValue);
      const translated = textTranslations.get(key);
      if(translated) node.nodeValue = translated;
    }

    for(const element of document.querySelectorAll("[aria-label],[title],[placeholder]")){
      for(const attribute of ["aria-label","title","placeholder"]){
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
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyCtas();
      applyNavigation();
      translateVisibleText();
    }, { once: true });
  } else {
    applyCtas();
    applyNavigation();
    translateVisibleText();
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

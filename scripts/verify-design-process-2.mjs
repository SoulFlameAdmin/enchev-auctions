import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validatePremiumTokens(css, layout) {
  const requiredTokens = [
    "--ea-canvas",
    "--ea-surface-1",
    "--ea-surface-2",
    "--ea-border-default",
    "--ea-brand",
    "--ea-action-primary",
    "--ea-state-live",
    "--ea-state-info",
    "--ea-state-success",
    "--ea-state-warning",
    "--ea-state-danger",
    "--ea-state-sold",
    "--ea-elevation-1",
    "--ea-radius-control",
    "--ea-radius-card",
    "--ea-focus-ring"
  ];
  for (const token of requiredTokens) {
    assert(css.includes(`${token}:`), `DP2-02 missing premium token ${token}`);
  }

  const routeCoverage = [".eaHome", ".inventoryPage", ".lotPage", ".livePage", ".navigationPage"];
  for (const selector of routeCoverage) {
    assert(css.includes(selector), `DP2-02 token layer missing buyer-route coverage for ${selector}`);
  }

  assert(css.includes("var(--ea-state-live)"), "DP2-02 must map LIVE to a dedicated state token");
  assert(css.includes("var(--ea-action-primary)"), "DP2-02 must map primary actions to an action token");
  assert(css.includes("var(--ea-border-default)"), "DP2-02 must use neutral semantic borders");
  assert(layout.includes('import "./dp2-design-tokens.css";'), "Root layout must import DP2 design tokens");
}

function validateFoundation(css, layout, capture, workflow) {
  const tokens = [
    "--ea-type-micro",
    "--ea-type-label-lg",
    "--ea-type-body",
    "--ea-type-body-lg",
    "--ea-type-section",
    "--ea-type-page",
    "--ea-type-display",
    "--ea-space-1",
    "--ea-space-4",
    "--ea-space-8",
    "--ea-space-16",
    "--ea-space-24",
    "--ea-density-compact",
    "--ea-density-standard",
    "--ea-density-comfortable",
    "--ea-page-gutter",
    "--ea-grid-gap",
    "--ea-layout-standard",
    "--ea-grid-card-min"
  ];
  for (const token of tokens) {
    assert(css.includes(`${token}:`), `DP2-03 missing foundation token ${token}`);
  }

  for (const width of [360,390,430]) {
    assert(css.includes(`@media(max-width:${width}px)`), `DP2-03 missing phone breakpoint ${width}px`);
  }
  for (const width of [1366,1440,1920]) {
    assert(css.includes(`@media(min-width:${width}px)`), `DP2-03 missing desktop breakpoint ${width}px`);
  }

  for (const selector of [".eaHeroInner", ".inventoryShell", ".lotWrap", ".liveStage", ".profileRouteMain", ".navigationRouteMain"]) {
    assert(css.includes(selector), `DP2-03 foundation missing layout coverage for ${selector}`);
  }

  assert(css.includes("repeat(auto-fit,minmax("), "DP2-03 must use responsive auto-fit grid primitives");
  assert(layout.includes('import "./dp2-foundation.css";'), "Root layout must import DP2 foundation layer");

  for (const width of [360,390,430,1366,1440,1920]) {
    assert(capture.includes(`width:${width}`), `DP2-03 visual matrix missing ${width}px`);
  }
  assert(capture.includes("expected 30 screenshots"), "DP2-03 visual capture must require 30 screenshots");
  assert(workflow.includes("chrome.count!==30||edge.count!==30"), "DP2-03 CI must require 30 Chrome + 30 Edge screenshots");
  assert(workflow.includes("chrome.entries.map(e=>e.width)"), "DP2-03 CI must read width from the visual manifest entry schema");
  assert(workflow.includes('widths!=="360,390,430,1366,1440,1920"'), "DP2-03 CI must enforce the full responsive width set");
}

function validateAppShell(component, css, layout, capture) {
  for (const needle of [
    "data-design-task=\"DP2-04\"",
    "eaAppDesktopNav",
    "eaAppMenuButton",
    "eaAppMobileDrawer",
    "aria-controls=\"ea-mobile-navigation\"",
    "window.addEventListener(\"keydown\",onKey)"
  ]) assert(component.includes(needle), `DP2-04 shell missing ${needle}`);

  for (const needle of [
    ".eaAppShell",
    ".eaAppDesktopNav",
    ".eaAppMobileLayer",
    ".eaAppMobileDrawer",
    "@media(max-width:1050px)",
    ".inventoryPage>.inventoryHeader",
    ".lotPage>.lotHeader",
    ".livePage>.liveHeader",
    ".navigationPage>.navigationRouteHeader"
  ]) assert(css.includes(needle), `DP2-04 shell CSS missing ${needle}`);

  assert(layout.includes('import "./dp2-app-shell.css";'), "Root layout must import DP2 app shell CSS");
  assert(layout.includes("<EnchevAppShell />"), "Root layout must mount unified app shell");
  assert(capture.includes("verifyDP204AppShell"), "DP2-04 visual capture runtime verification missing");
  assert(capture.includes("drawer close control did not receive focus"), "DP2-04 mobile focus runtime assertion missing");
  assert(capture.includes("Escape did not close drawer"), "DP2-04 Escape-close runtime assertion missing");
}

function validateHomeHero(component,spotlight,messages,css,layout,page,translationKeys,capture) {
  for (const needle of [
    'data-design-task="DP2-05"',
    "eaHeroV2Title",
    "eaHeroV2Actions",
    "eaHeroV2Proof",
    "eaHeroV2Availability",
    "HomeLiveSpotlight"
  ]) assert(component.includes(needle), `DP2-05 hero missing ${needle}`);

  for (const needle of [
    '"bg-BG"',
    '"en-US"',
    "home.hero.title.primary",
    "home.hero.availability.note",
    "home.hero.spotlight.status",
    "home.hero.spotlight.cta"
  ]) assert(messages.includes(needle), `DP2-05 message catalog missing ${needle}`);
  assert(messages.includes("активирания market profile") && messages.includes("activated market profile"), "DP2-05 market-profile availability copy missing in BG/EN");
  assert(spotlight.includes("HOME_HERO_KEYS.spotlightStatus") && spotlight.includes("HOME_HERO_KEYS.spotlightCta"), "DP2-05 LIVE spotlight must consume hero translation keys");
  assert(!spotlight.includes("CURRENT_BID") && !spotlight.includes("toLocaleString("), "DP2-05 LIVE spotlight must not format ad-hoc money");
  assert(!spotlight.includes("Crewe, UK") && !spotlight.includes("€"), "DP2-05 LIVE spotlight must not hardcode market/currency display");

  const keys=JSON.parse(translationKeys).keys||[];
  for (const key of [
    "home.hero.actions.browse",
    "home.hero.actions.live",
    "home.hero.availability.note",
    "home.hero.eyebrow",
    "home.hero.lead",
    "home.hero.proof.identity",
    "home.hero.proof.status",
    "home.hero.proof.transport",
    "home.hero.title.accent",
    "home.hero.title.primary",
    "home.hero.title.secondary"
  ]) assert(keys.includes(key), `DP2-05 translation registry missing ${key}`);

  assert(layout.includes('import "./dp2-home-hero.css";'), "Root layout must import DP2-05 hero CSS");
  assert(page.includes("<HomeHeroV2 />"), "Homepage must render HomeHeroV2");
  assert(!page.includes('<section className="eaHero" id="top">'), "Legacy campaign hero must be removed from homepage DOM");
  assert(!page.includes("10K+"), "DP2-05 must not present unverified inventory-volume claims");
  assert(!page.includes("Европа · САЩ · Канада"), "DP2-05 must not hardcode market availability in the hero");
  for (const needle of ["@media(max-width:430px)","@media(max-width:360px)","@media(min-width:1920px)",".eaHeroV2Proof",".eaHeroDiscovery"]) {
    assert(css.includes(needle), `DP2-05 hero CSS missing ${needle}`);
  }
  assert(capture.includes("verifyDP205HomeHero"), "DP2-05 browser runtime verification missing");
  assert(capture.includes("spotlight must stack below hero content"), "DP2-05 mobile composition assertion missing");
  assert(capture.includes("desktop hero columns overlap"), "DP2-05 desktop composition assertion missing");
}

function validateEvidence(data) {
  assert(data && data.version === "2.0", "DP2 evidence version must be 2.0");
  assert(data.status === "active", "DP2 evidence status must be active");
  assert(data.plan === "docs/DESIGN_PROCESS_2.md", "DP2 evidence must point to DESIGN_PROCESS_2.md");
  assert(Array.isArray(data.tasks), "DP2 tasks must be an array");
  assert(data.tasks.length === 30, `DP2 must contain exactly 30 tasks, found ${data.tasks.length}`);

  const expected = Array.from({length:30},(_,i)=>`DP2-${String(i+1).padStart(2,"0")}`);
  const ids = data.tasks.map(task=>String(task.id||""));
  assert(JSON.stringify(ids) === JSON.stringify(expected), "DP2 IDs/order must be exactly DP2-01 -> DP2-30");
  assert(new Set(ids).size === ids.length, "DP2 task IDs must be unique");

  for (const task of data.tasks) {
    assert(["green","yellow","red"].includes(String(task.status)), `${task.id}: invalid status`);
    assert(String(task.group||"").trim(), `${task.id}: missing group`);
    assert(String(task.title||"").trim(), `${task.id}: missing title`);
    if (task.status === "green") {
      assert(String(task.evidence||"").trim(), `${task.id}: GREEN requires evidence`);
    }
  }
}

function validateRepository() {
  const evidence = JSON.parse(read("app/design-process-2-evidence.json"));
  validateEvidence(evidence);

  const premiumTokens = read("app/dp2-design-tokens.css");
  const rootLayout = read("app/layout.tsx");
  validatePremiumTokens(premiumTokens, rootLayout);

  const foundation = read("app/dp2-foundation.css");
  const capture = read("scripts/capture-visual-regression.mjs");
  const workflow = read(".github/workflows/verify-enchev-web.yml");
  validateFoundation(foundation, rootLayout, capture, workflow);

  const appShell = read("app/components/EnchevAppShell.tsx");
  const appShellCss = read("app/dp2-app-shell.css");
  validateAppShell(appShell, appShellCss, rootLayout, capture);

  const homeHero = read("app/components/HomeHeroV2.tsx");
  const homeHeroMessages = read("app/home-hero-messages.ts");
  const homeHeroSpotlight = read("app/components/HomeLiveSpotlight.tsx");
  const homeHeroCss = read("app/dp2-home-hero.css");
  const homePage = read("app/page.tsx");
  const translationKeys = read("locales/translation-keys.json");
  validateHomeHero(homeHero,homeHeroSpotlight,homeHeroMessages,homeHeroCss,rootLayout,homePage,translationKeys,capture);

  const plan = read("docs/DESIGN_PROCESS_2.md");
  assert(plan.includes("DP2-01") && plan.includes("DP2-30"), "DP2 plan must define DP2-01 and DP2-30");
  assert(plan.includes("Do not invent DP2-31") || plan.includes("Do not invent DP2-31 automatically"), "DP2 plan must forbid automatic DP2-31 scope growth");

  const menu = read("app/components/MasterSystemPlanV1.tsx");
  assert(menu.includes("Design Process 2"), "Enchev command-center menu must expose Design Process 2");
  assert(menu.includes("<DesignProcess2"), "Enchev command center must render the DesignProcess2 panel");

  const panel = read("app/components/DesignProcess2.tsx");
  assert(panel.includes("../design-process-2-evidence.json"), "Design Process 2 panel must read the canonical evidence tracker");
  assert(panel.includes('data-design-process="2"'), "Design Process 2 panel marker missing");

  const worker = read("tools/david/auto-continue-design-v1.mjs");
  assert(worker.includes("docs/DESIGN_PROCESS_2.md"), "DESIGN worker must target DESIGN_PROCESS_2.md");
  assert(worker.includes("design-process-2-evidence.json"), "DESIGN worker must target Process 2 evidence");
  assert(worker.includes("DP2-01") && worker.includes("DP2-30"), "DESIGN worker must enforce DP2 execution range");
  assert(worker.includes("[DAVID_RELAY_ENCHEV_DESIGN_PROCESS_2]"), "DESIGN worker Process 2 marker missing");

  const supervisor = read("tools/david/dual-session-worker.mjs");
  assert(supervisor.includes("DAVID_RELAY_ENCHEV_DESIGN_PROCESS_2"), "Supervisor must recognize Process 2 DESIGN marker");

  const dashboard = read("tools/david/david-status-dashboard.ps1");
  assert(dashboard.includes("design-process-2-evidence.json"), "Matrix must read Process 2 evidence");
  assert(dashboard.includes('Name="DESIGN2"'), "Matrix must label Process 2 progress as DESIGN2");

  const start = read("START_DAVID_ALL.ps1");
  assert(start.includes("ENCHEV DESIGN PROCESS 2"), "Startup summary must expose ENCHEV DESIGN PROCESS 2");

  console.log("DESIGN_PROCESS_2_INVARIANT PASS tasks=30 menu=1 worker=1 matrix=1");
}

function selfTest() {
  const good = {
    version:"2.0",
    status:"active",
    plan:"docs/DESIGN_PROCESS_2.md",
    tasks:Array.from({length:30},(_,i)=>({
      id:`DP2-${String(i+1).padStart(2,"0")}`,
      group:"G",
      title:"T",
      status:"red",
      evidence:""
    }))
  };
  validateEvidence(good);

  const broken = structuredClone(good);
  broken.tasks[1].id = "DP2-01";
  let rejected = false;
  try { validateEvidence(broken); } catch { rejected = true; }
  assert(rejected, "DP2 self-test must reject duplicate/out-of-order IDs");

  const greenWithoutEvidence = structuredClone(good);
  greenWithoutEvidence.tasks[0].status = "green";
  rejected = false;
  try { validateEvidence(greenWithoutEvidence); } catch { rejected = true; }
  assert(rejected, "DP2 self-test must reject GREEN without evidence");

  const requiredPremiumTokens = [
    "--ea-canvas","--ea-surface-1","--ea-surface-2","--ea-border-default",
    "--ea-brand","--ea-action-primary","--ea-state-live","--ea-state-info",
    "--ea-state-success","--ea-state-warning","--ea-state-danger","--ea-state-sold",
    "--ea-elevation-1","--ea-radius-control","--ea-radius-card","--ea-focus-ring"
  ];
  const tokenFixture =
    `:root{${requiredPremiumTokens.map(token=>`${token}:x;`).join("")}}` +
    ".eaHome,.inventoryPage,.lotPage,.livePage,.navigationPage{}" +
    ".live{color:var(--ea-state-live);border:var(--ea-border-default);background:var(--ea-action-primary)}";
  validatePremiumTokens(tokenFixture, 'import "./dp2-design-tokens.css";');

  rejected = false;
  try {
    validatePremiumTokens(tokenFixture.replace("--ea-state-live:x;", ""), 'import "./dp2-design-tokens.css";');
  } catch {
    rejected = true;
  }
  assert(rejected, "DP2 self-test must reject a missing semantic LIVE token");

  const foundationFixture =
    ':root{' +
    [
      "--ea-type-micro","--ea-type-label-lg","--ea-type-body","--ea-type-body-lg",
      "--ea-type-section","--ea-type-page","--ea-type-display","--ea-space-1",
      "--ea-space-4","--ea-space-8","--ea-space-16","--ea-space-24",
      "--ea-density-compact","--ea-density-standard","--ea-density-comfortable",
      "--ea-page-gutter","--ea-grid-gap","--ea-layout-standard","--ea-grid-card-min"
    ].map(token=>`${token}:x;`).join("") +
    '}.eaHeroInner,.inventoryShell,.lotWrap,.liveStage,.profileRouteMain,.navigationRouteMain{}' +
    '.grid{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}' +
    '@media(max-width:360px){}@media(max-width:390px){}@media(max-width:430px){}' +
    '@media(min-width:1366px){}@media(min-width:1440px){}@media(min-width:1920px){}';
  const captureFixture='width:360 width:390 width:430 width:1366 width:1440 width:1920 expected 30 screenshots';
  const workflowFixture='chrome.count!==30||edge.count!==30 chrome.entries.map(e=>e.width) widths!=="360,390,430,1366,1440,1920"';
  validateFoundation(foundationFixture, 'import "./dp2-foundation.css";', captureFixture, workflowFixture);

  rejected = false;
  try {
    validateFoundation(foundationFixture.replace("@media(max-width:360px){}", ""), 'import "./dp2-foundation.css";', captureFixture, workflowFixture);
  } catch {
    rejected = true;
  }
  assert(rejected, "DP2 self-test must reject a missing required acceptance breakpoint");

  const shellFixture='data-design-task="DP2-04" eaAppDesktopNav eaAppMenuButton eaAppMobileDrawer aria-controls="ea-mobile-navigation" window.addEventListener("keydown",onKey)';
  const shellCssFixture='.eaAppShell .eaAppDesktopNav .eaAppMobileLayer .eaAppMobileDrawer @media(max-width:1050px) .inventoryPage>.inventoryHeader .lotPage>.lotHeader .livePage>.liveHeader .navigationPage>.navigationRouteHeader';
  const shellLayoutFixture='import "./dp2-app-shell.css"; <EnchevAppShell />';
  const shellCaptureFixture='verifyDP204AppShell drawer close control did not receive focus Escape did not close drawer';
  validateAppShell(shellFixture,shellCssFixture,shellLayoutFixture,shellCaptureFixture);

  rejected=false;
  try{ validateAppShell(shellFixture.replace("eaAppMobileDrawer",""),shellCssFixture,shellLayoutFixture,shellCaptureFixture); }catch{ rejected=true; }
  assert(rejected,"DP2 self-test must reject missing mobile drawer contract");

  const heroFixture='data-design-task="DP2-05" eaHeroV2Title eaHeroV2Actions eaHeroV2Proof eaHeroV2Availability HomeLiveSpotlight';
  const heroMessagesFixture='"bg-BG" "en-US" home.hero.title.primary home.hero.availability.note home.hero.spotlight.status home.hero.spotlight.cta активирания market profile activated market profile';
  const heroCssFixture='@media(max-width:430px) @media(max-width:360px) @media(min-width:1920px) .eaHeroV2Proof .eaHeroDiscovery';
  const heroLayoutFixture='import "./dp2-home-hero.css";';
  const heroPageFixture='<HomeHeroV2 />';
  const heroKeysFixture=JSON.stringify({keys:["home.hero.actions.browse","home.hero.actions.live","home.hero.availability.note","home.hero.eyebrow","home.hero.lead","home.hero.proof.identity","home.hero.proof.status","home.hero.proof.transport","home.hero.title.accent","home.hero.title.primary","home.hero.title.secondary"]});
  const heroCaptureFixture='verifyDP205HomeHero spotlight must stack below hero content desktop hero columns overlap';
  const heroSpotlightFixture="HOME_HERO_KEYS.spotlightStatus HOME_HERO_KEYS.spotlightCta";
  validateHomeHero(heroFixture,heroSpotlightFixture,heroMessagesFixture,heroCssFixture,heroLayoutFixture,heroPageFixture,heroKeysFixture,heroCaptureFixture);
  rejected=false;
  try{validateHomeHero(heroFixture.replace("eaHeroV2Proof",""),heroSpotlightFixture,heroMessagesFixture,heroCssFixture,heroLayoutFixture,heroPageFixture,heroKeysFixture,heroCaptureFixture);}catch{rejected=true;}
  assert(rejected,"DP2 self-test must reject missing hero proof hierarchy");

  console.log("DESIGN_PROCESS_2_SELF_TEST PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else validateRepository();

import fs from "node:fs";

const FILES = {
  layout: "app/layout.tsx",
  mobile: "app/mobile-quality.css",
  homePage: "app/page.tsx",
  homeCss: "app/home-v2.css",
  inventoryPage: "app/inventory/page.tsx",
  inventoryCss: "app/inventory/inventory-v2.css",
  lotPage: "app/lot/[id]/page.tsx",
  lotDockCss: "app/lot/lot-d23.css",
  livePage: "app/live-auctions/page.tsx",
  liveCss: "app/live-auctions/live-auctions.css",
  liveD24Css: "app/live-auctions/live-d24.css",
  profilePage: "app/profile/page.tsx",
  profileCss: "app/profile/profile-shell.css",
};

function fail(message) {
  throw new Error(`MOBILE_FIRST_DESIGN FAIL: ${message}`);
}

function need(source, pattern, label) {
  if (!pattern.test(source)) fail(label);
}

export function validateMobileContract(sources) {
  need(sources.layout, /import "\.\/mobile-quality\.css";/, "root layout must load D32 mobile hardening");

  need(sources.mobile, /@media\(max-width:640px\)/, "D32 <=640px mobile layer missing");
  need(sources.mobile, /\.eaHome,[\s\S]*\.inventoryPage,[\s\S]*\.lotPage,[\s\S]*\.livePage,[\s\S]*\.navigationPage[\s\S]*overflow-x:clip/, "core routes need horizontal overflow protection");
  need(sources.mobile, /\.eaHeroCopy h1[\s\S]*font-size:clamp\(44px,17vw,58px\)!important/, "homepage narrow headline clamp missing");
  need(sources.mobile, /\.inventoryToolbar select,\s*\.inv2ViewSwitch button\{[^}]*min-height:44px!important/, "inventory mobile controls must reach 44px");
  need(sources.mobile, /\.liveHeader button[\s\S]*min-height:44px!important/, "live header mobile action must reach 44px");
  need(sources.mobile, /\.liveHero,[\s\S]*\.liveStage,[\s\S]*\.liveQueue,[\s\S]*\.liveSold[\s\S]*width:calc\(100% - 24px\)!important/, "live mobile gutters must use the compact width contract");
  need(sources.mobile, /@media\(max-width:380px\)/, "extra-narrow mobile fallback missing");

  need(sources.homePage, /<main[^>]*className="eaHome"[^>]*>/, "homepage root marker missing");
  need(sources.homeCss, /@media\(max-width:560px\)/, "homepage mobile breakpoint missing");
  need(sources.homeCss, /\.eaFeaturedGrid\{grid-template-columns:1fr\}/, "homepage featured cards must collapse to one column");

  need(sources.inventoryPage, /<main[^>]*className="inventoryPage"/, "inventory root marker missing");
  need(sources.inventoryCss, /@media\(max-width:640px\)/, "inventory mobile breakpoint missing");
  need(sources.inventoryCss, /\.inv2MobileFiltersToggle\{[^}]*min-height:44px/, "inventory mobile filter control must be touch-sized");
  need(sources.inventoryCss, /\.inventoryGrid\{grid-template-columns:1fr!important\}/, "inventory grid must collapse to one column");

  need(sources.lotPage, /<main[^>]*className="lotPage"/, "lot root marker missing");
  need(sources.lotDockCss, /@media\(max-width:560px\)/, "lot mobile dock breakpoint missing");
  need(sources.lotDockCss, /env\(safe-area-inset-bottom\)/, "lot mobile dock must respect safe-area inset");
  need(sources.lotDockCss, /\.lotMobileBidAction\{[^}]*min-height:48px/, "lot mobile bid action must be touch-sized");

  need(sources.livePage, /<main[^>]*className="livePage"[^>]*>/, "live root marker missing");
  need(sources.liveCss, /@media\(max-width:680px\)/, "live room mobile breakpoint missing");
  need(sources.liveCss, /\.liveQueueGrid,\.liveSoldGrid\{grid-template-columns:1fr\}/, "live queue and sold grid must collapse to one column");
  need(sources.liveD24Css, /@media\(max-width:560px\)/, "D24 next-lot preview mobile breakpoint missing");

  need(sources.profilePage, /data-design-task="D31"/, "profile D31 shell marker missing");
  need(sources.profileCss, /@media\(max-width:640px\)/, "profile mobile breakpoint missing");
  need(sources.profileCss, /\.profileAccountNav a\{[\s\S]*?min-height:44px/, "profile account navigation must be touch-sized");

  return true;
}

function readSources() {
  return Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]),
  );
}

function expectRejected(label, sources, mutate) {
  const copy = { ...sources };
  mutate(copy);
  let rejected = false;
  try {
    validateMobileContract(copy);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const sources = readSources();
validateMobileContract(sources);

if (process.argv.includes("--self-test")) {
  expectRejected("remove mobile overflow guard", sources, (copy) => {
    copy.mobile = copy.mobile.replace("overflow-x:clip;", "overflow-x:visible;");
  });
  expectRejected("shrink inventory mobile target", sources, (copy) => {
    copy.mobile = copy.mobile.replace("min-height:44px!important;", "min-height:40px!important;");
  });
  expectRejected("remove lot safe area", sources, (copy) => {
    copy.lotDockCss = copy.lotDockCss.replaceAll("env(safe-area-inset-bottom)", "0px");
  });
  console.log("MOBILE_FIRST_DESIGN_SELF_TEST PASS negative_cases=3");
} else {
  console.log("MOBILE_FIRST_DESIGN PASS routes=5 breakpoints=640,380 touch_target_px=44");
}

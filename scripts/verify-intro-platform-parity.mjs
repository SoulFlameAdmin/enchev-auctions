import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Structural guard. This does NOT certify live backend/auth/payment parity.
const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const requireText = (text, token, label) =>
  assert.ok(text.includes(token), `${label}: missing ${token}`);

const requiredRoutes = [
  "app/platform/page.tsx",
  "app/inventory/page.tsx",
  "app/live-auctions/page.tsx",
  "app/lot/[id]/page.tsx",
  "app/profile/page.tsx",
  "app/transport/page.tsx",
  "app/vehicle-history/page.tsx",
  "app/presentation/page.tsx",
  "app/support/page.tsx",
];
for (const file of requiredRoutes) {
  assert.ok(existsSync(path.join(root, file)), `Missing original platform route: ${file}`);
}

const intro = read("app/page.tsx");
requireText(intro, 'src="/forge/index.html"', "Cinematic intro preserved");
requireText(intro, "<MasterSystemPlanV1 />", "System status menu preserved");

const classic = read("app/platform/page.tsx");
for (const token of [
  "<HomeHeroV2 />", "eaFeaturedGrid", "eaJourneySteps",
  "<HomeTrustSupport />", 'href="/inventory"', 'href="/live-auctions"',
]) requireText(classic, token, "Classic marketplace homepage restored");

const hero = read("app/components/HomeHeroV2.tsx");
const discovery = read("app/components/HomeDiscoveryV2.tsx");
requireText(hero, "<HomeDiscoveryV2 />", "Old homepage discovery");
for (const token of ['/inventory', 'buyNow=1', 'live=1']) {
  requireText(discovery, token, "Original make/model/live/buy-now discovery");
}

const catalog = read("app/inventory/page.tsx");
for (const token of [
  "setBrand", "setModel", "setRegion", "setAuctionStatus",
  "setSort", "setCurrentPage", 'params.set("q"', 'params.set("make"',
  'params.set("model"', 'params.set("buyNow"', 'params.set("live"',
  '"/lot/"',
]) {
  // Lot navigation is implemented as a template literal in some releases.
  if (token === '"/lot/"' && catalog.includes("/lot/")) continue;
  requireText(catalog, token, "Original inventory search/filter/auction-state flow");
}

const nav = read("app/site-navigation.ts");
requireText(nav, 'href: "/platform"', "Marketplace navigation");
requireText(nav, 'href: "/platform#how"', "How to Buy must reach classic page");

const bridge = read("scripts/restore-forge-assets.mjs");
for (const token of [
  'href: "/platform"', 'href: "/inventory"', 'href: "/live-auctions"',
  'href: "/transport"', 'href: "/vehicle-history"', 'href: "/presentation"',
  'href: "/support"', '"_top"', "window.top.location.assign(href)",
  "ensurePlatformNavigation()",
]) requireText(bridge, token, "Cinematic button-to-platform bridge");

for (const file of [
  "app/live-auctions/page.tsx",
  "app/lot/[id]/page.tsx",
  "app/transport/page.tsx",
]) {
  const contents = read(file);
  assert.ok(!contents.includes('href="/#how"'),
    `${file} still links How to Buy to the intro instead of the original platform`);
}

console.log("PASS: cinematic intro + restored classic homepage + known page routes + CTA/navigation mappings.");
console.log("NOTE: Backend/auth, bids, persistence, payments and every browser-click path still require real E2E proof.");

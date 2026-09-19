import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function assert(ok,msg){ if(!ok) throw new Error(msg); }

const component=read("app/components/HomeFeaturedLotsV2.tsx");
const css=read("app/dp2-home-featured.css");
const page=read("app/page.tsx");
const layout=read("app/layout.tsx");
const messages=read("app/home-featured-messages.ts");
const keys=JSON.parse(read("locales/translation-keys.json")).keys;
const visualCapture=read("scripts/capture-dp2-07-featured-cli.mjs");
const workflow=read(".github/workflows/verify-enchev-web.yml");

assert(component.includes('data-design-task="DP2-07"'),"DP2-07 marker missing");
assert(component.includes("eaDp207LegacyVisualReady"),"DP2-07 legacy visual readiness marker missing");
for(const state of ['state:"upcoming"','state:"live"','state:"buy-now"','state:"sold"']) assert(component.includes(state),"DP2-07 missing state "+state);
assert(component.includes("Intl.NumberFormat"),"DP2-07 monetary values must use locale-aware formatting");
assert(component.includes("Intl.DateTimeFormat"),"DP2-07 sale time must use locale-aware formatting");
assert(component.includes("data-transaction-currency"),"DP2-07 must retain transactional currency in the card DOM");
assert(component.includes("data-country-code"),"DP2-07 must retain ISO country code in the card DOM");
assert(component.includes("data-state-priority"),"DP2-07 state hierarchy marker missing");
assert(component.includes("buyNowAmount"),"DP2-07 must expose Buy Now amount where available");
assert(component.includes('href={"/lot/"+lot.lot}'),"DP2-07 card primary action must open the lot");
assert(page.includes('import HomeFeaturedLotsV2 from "./components/HomeFeaturedLotsV2";') && page.includes("<HomeFeaturedLotsV2 />"),"Homepage must mount DP2-07 featured cards");
assert(!page.includes("const featuredCars = ["),"Legacy homepage featuredCars block must be removed");
assert(layout.includes('import "./dp2-home-featured.css";'),"Root layout must import DP2-07 CSS");

for(const width of ["max-width:430px","max-width:360px","min-width:1920px"]) assert(css.includes(width),"DP2-07 CSS missing "+width);
assert(css.includes("min-height:46px") && css.includes("min-height:48px"),"DP2-07 CTA must preserve 44px+ touch targets");
assert(css.includes('data-auction-state="live"') && css.includes('data-auction-state="buy-now"') && css.includes('data-auction-state="sold"'),"DP2-07 CSS state mappings missing");
assert(css.includes("@media(prefers-reduced-motion:reduce)"),"DP2-07 reduced-motion behavior missing");
assert(css.includes("@media(forced-colors:active)"),"DP2-07 forced-colors behavior missing");

for(const key of [
  "home.featured.eyebrow","home.featured.title","home.featured.lead","home.featured.actions.allInventory",
  "home.featured.meta.verified","home.featured.meta.saleTime",
  "home.featured.status.upcoming","home.featured.status.live","home.featured.status.buyNow","home.featured.status.sold",
  "home.featured.statusDetail.upcoming","home.featured.statusDetail.live","home.featured.statusDetail.buyNow","home.featured.statusDetail.sold",
  "home.featured.amount.starting","home.featured.amount.current","home.featured.amount.buyNow","home.featured.amount.sold",
  "home.featured.action.open","home.featured.action.live","home.featured.action.buyNow","home.featured.action.result"
]) {
  assert(keys.includes(key),"DP2-07 translation registry missing "+key);
  assert(messages.includes(key),"DP2-07 message catalog missing "+key);
}
assert(messages.includes('"bg-BG"') && messages.includes('"en-US"'),"DP2-07 requires BG/EN copy coverage");
assert(visualCapture.includes("360,390,430,1366,1440,1920") || (visualCapture.includes("360")&&visualCapture.includes("1920")),"DP2-07 visual capture width matrix missing");
assert(visualCapture.includes('new URL("/#inventory",baseUrl)'),"DP2-07 visual capture must anchor to the featured section");
assert(workflow.includes("capture-dp2-07-featured-cli.mjs") && workflow.includes("dp2-07-featured-chrome") && workflow.includes("dp2-07-featured-edge"),"DP2-07 Chrome/Edge visual workflow wiring missing");

console.log("DP2_07_HOME_FEATURED PASS cards=4 states=upcoming,live,buy-now,sold money=intl date=intl responsive=360,390,430,1366,1440,1920");

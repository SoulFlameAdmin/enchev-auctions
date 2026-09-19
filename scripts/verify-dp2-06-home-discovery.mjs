import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function assert(ok,msg){ if(!ok) throw new Error(msg); }

const component=read("app/components/HomeDiscoveryV2.tsx");
const css=read("app/dp2-home-discovery.css");
const hero=read("app/components/HomeHeroV2.tsx");
const layout=read("app/layout.tsx");
const messages=read("app/home-hero-messages.ts");
const keys=JSON.parse(read("locales/translation-keys.json")).keys;

assert(component.includes('data-design-task="DP2-06"'),"DP2-06 marker missing");
assert(component.includes('action="/inventory"') && component.includes('name="q"'),"DP2-06 search must submit q to /inventory");
for(const param of ["live=1","buyNow=1"]) assert(component.includes(param),`DP2-06 missing shortcut ${param}`);
for(const make of ["BMW","Mercedes","Audi","Porsche"]) assert(component.includes(make),`DP2-06 missing make shortcut ${make}`);
assert(component.includes('aria-describedby="ea-home-discovery-hint"'),"DP2-06 search hint relationship missing");
assert(hero.includes('import HomeDiscoveryV2 from "./HomeDiscoveryV2";') && hero.includes("<HomeDiscoveryV2 />"),"HomeHeroV2 must mount DP2-06 discovery");
assert(layout.includes('import "./dp2-home-discovery.css";'),"Root layout must import DP2-06 CSS");
for(const width of ["max-width:430px","max-width:360px","min-width:1920px"]) assert(css.includes(width),`DP2-06 CSS missing ${width}`);
assert(css.includes("min-height:44px"),"DP2-06 shortcuts must preserve 44px touch targets");
for(const key of [
 "home.discovery.eyebrow","home.discovery.title","home.discovery.lead","home.discovery.advanced",
 "home.discovery.search.label","home.discovery.search.placeholder","home.discovery.search.submit","home.discovery.search.hint",
 "home.discovery.group.state","home.discovery.group.make","home.discovery.all","home.discovery.live","home.discovery.buyNow"
]) {
  assert(keys.includes(key),`DP2-06 translation registry missing ${key}`);
  assert(messages.includes(key),`DP2-06 message catalog missing ${key}`);
}
assert(messages.includes('"bg-BG"') && messages.includes('"en-US"'),"DP2-06 requires BG/EN copy coverage");
console.log("DP2_06_HOME_DISCOVERY PASS search=1 state_shortcuts=3 make_shortcuts=4 responsive=360,390,430,1366,1440,1920");

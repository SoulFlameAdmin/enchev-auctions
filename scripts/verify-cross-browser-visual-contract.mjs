import fs from "node:fs";

const FILES={
  layout:"app/layout.tsx",
  browserCss:"app/cross-browser-quality.css",
  mobileCss:"app/mobile-quality.css",
  accessibilityCss:"app/accessibility-quality.css",
  homeCss:"app/home-v2.css",
  inventoryCss:"app/inventory/inventory-v2.css",
  liveCss:"app/live-auctions/live-auctions.css",
  profileCss:"app/profile/profile-shell.css",
};

function fail(message){
  throw new Error(`CROSS_BROWSER_VISUAL_CONTRACT FAIL: ${message}`);
}

function need(source,pattern,label){
  if(!pattern.test(source))fail(label);
}

export function validateCrossBrowserContract(sources){
  need(sources.layout,/import "\.\/cross-browser-quality\.css";/,"root layout must load D34 browser compatibility layer");
  need(sources.browserCss,/-webkit-text-size-adjust:100%/,"mobile text scaling compatibility missing");
  need(sources.browserCss,/text-size-adjust:100%/,"standard text scaling control missing");
  need(sources.browserCss,/-webkit-backdrop-filter:blur\(16px\)/,"Chromium/WebKit backdrop prefix missing");
  need(sources.browserCss,/@supports not \(\(backdrop-filter:blur\(1px\)\) or \(-webkit-backdrop-filter:blur\(1px\)\)\)/,"backdrop-filter fallback missing");
  need(sources.browserCss,/@supports not \(overflow:clip\)/,"overflow clip fallback missing");
  need(sources.browserCss,/@supports not \(text-wrap:balance\)/,"balanced-text fallback missing");
  need(sources.browserCss,/@media\(hover:none\) and \(pointer:coarse\)/,"coarse-pointer mobile interaction fallback missing");
  need(sources.browserCss,/:where\(a,button\)\{[\s\S]*?min-height:44px/,"coarse-pointer touch target missing");

  need(sources.mobileCss,/@media\(max-width:640px\)/,"D32 mobile layer missing");
  need(sources.accessibilityCss,/@media\(forced-colors:active\)/,"D33 forced-colors layer missing");
  need(sources.homeCss,/@media\(max-width:560px\)/,"homepage mobile fallback missing");
  need(sources.inventoryCss,/@media\(max-width:640px\)/,"inventory mobile fallback missing");
  need(sources.liveCss,/@media\(max-width:680px\)/,"live mobile fallback missing");
  need(sources.profileCss,/@media\(max-width:640px\)/,"profile mobile fallback missing");

  return true;
}

function readSources(){
  return Object.fromEntries(Object.entries(FILES).map(([key,file])=>[key,fs.readFileSync(file,"utf8")]));
}

function expectRejected(label,sources,mutate){
  const copy={...sources};
  mutate(copy);
  let rejected=false;
  try{validateCrossBrowserContract(copy);}catch{rejected=true;}
  if(!rejected)fail(`negative self-test was not rejected: ${label}`);
}

const sources=readSources();
validateCrossBrowserContract(sources);

if(process.argv.includes("--self-test")){
  expectRejected("remove backdrop fallback",sources,(copy)=>{
    copy.browserCss=copy.browserCss.replace("@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px)))","@supports (display:block)");
  });
  expectRejected("remove overflow fallback",sources,(copy)=>{
    copy.browserCss=copy.browserCss.replace("@supports not (overflow:clip)","@supports (overflow:clip)");
  });
  expectRejected("remove coarse pointer target",sources,(copy)=>{
    copy.browserCss=copy.browserCss.replace("min-height:44px;","min-height:32px;");
  });
  console.log("CROSS_BROWSER_VISUAL_CONTRACT_SELF_TEST PASS negative_cases=3");
}else{
  console.log("CROSS_BROWSER_VISUAL_CONTRACT PASS chrome=edge=chromium mobile=coarse-pointer css_fallbacks=backdrop+overflow+text-wrap");
}

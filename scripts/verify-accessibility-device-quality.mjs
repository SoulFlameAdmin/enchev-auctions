import fs from "node:fs";
import { spawnSync } from "node:child_process";

const CONFIG_PATH="config/enchev-accessibility-device-quality.json";

function fail(message){throw new Error(`ACCESSIBILITY_DEVICE_QUALITY FAIL: ${message}`);}
function need(source,pattern,label){if(!pattern.test(source))fail(label);}

function rgb(hex){
  const v=hex.replace("#","");
  if(!/^[0-9a-f]{6}$/i.test(v))fail(`invalid color ${hex}`);
  return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255);
}
function luminance(hex){
  const linear=rgb(hex).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  return 0.2126*linear[0]+0.7152*linear[1]+0.0722*linear[2];
}
function contrast(a,b){
  const la=luminance(a),lb=luminance(b);
  const hi=Math.max(la,lb),lo=Math.min(la,lb);
  return (hi+0.05)/(lo+0.05);
}

export function validate(config,sources){
  if(config?.phaseId!=="28")fail("phaseId must be 28");
  if(config?.phaseName!=="Accessibility & device quality")fail("phase name mismatch");
  const expectedIds=Array.from({length:14},(_,i)=>`28.${String(i+1).padStart(2,"0")}`);
  const actualIds=(config.tasks||[]).map(x=>x.id);
  if(JSON.stringify(actualIds)!==JSON.stringify(expectedIds))fail("all 14 frozen task IDs must be present in order");

  const target=config.standardTarget;
  if(target?.standard!=="WCAG"||target?.version!=="2.2"||target?.level!=="AA")fail("WCAG 2.2 AA target drift");
  if(target.certificationClaimed!==false)fail("formal certification must not be claimed");
  if(target.formalAuditRequiredForFinalProductionAcceptance!==true)fail("formal audit final gate missing");

  const core=["/","/inventory","/lot/EA-10539","/live-auctions","/profile"];
  if(JSON.stringify(config.coreRoutes)!==JSON.stringify(core))fail("core route matrix drift");

  need(sources.layout,/className="eaSkipLink" href="#main-content"/,"28.02 skip link missing");
  need(sources.layout,/import "\.\/accessibility-quality\.css";/,"accessibility layer not loaded");
  for(const [name,source] of Object.entries({home:sources.home,inventory:sources.inventory,lot:sources.lot,live:sources.live,profile:sources.profile})){
    need(source,/<main id="main-content"/,`28.02 main-content target missing on ${name}`);
  }

  need(sources.accessibility,/:where\(a,button,input,select,textarea,\[tabindex\]\):focus-visible/,"28.03 shared focus-visible rule missing");
  need(sources.accessibility,/outline:3px solid #8bffc0!important/,"28.03 strong focus indicator missing");
  need(sources.accessibility,/@media\(prefers-contrast:more\)/,"28.05 prefers-contrast support missing");
  need(sources.accessibility,/@media\(forced-colors:active\)/,"28.05 forced-colors support missing");
  need(sources.accessibility,/@media\(prefers-reduced-motion:reduce\)/,"28.10 reduced-motion support missing");

  need(sources.profile,/aria-label="Навигация на профила"/,"28.04 profile navigation label missing");
  need(sources.lot,/aria-label={`Галерия за/,"28.04 lot gallery label missing");
  need(sources.lot,/role="dialog" aria-modal="true" aria-labelledby="lot-viewer-title"/,"28.08 labelled modal dialog missing");
  need(sources.lot,/event\.key==="Escape"/,"28.08 Escape close handling missing");
  need(sources.lot,/viewerCloseRef\.current\?\.focus\(\)/,"28.08 initial dialog focus missing");
  if(!sources.lot.includes("trigger.focus({preventScroll:true})"))fail("28.08 focus restoration missing");

  const colorSources=`${sources.theme}\n${sources.accessibility}`.toLowerCase();
  for(const pair of config.contrastPairs||[]){
    const ratio=contrast(pair.foreground,pair.background);
    if(ratio+1e-9<pair.minimumRatio)fail(`28.05 contrast pair ${pair.name} ratio ${ratio.toFixed(2)} < ${pair.minimumRatio}`);
    if(!colorSources.includes(pair.foreground.toLowerCase())||!colorSources.includes(pair.background.toLowerCase())){
      fail(`28.05 contrast pair colors are not present in audited CSS: ${pair.name}`);
    }
  }

  need(sources.live,/connectionLabel=.*"СВЪРЗАН".*"ПОВТОРНО СВЪРЗВАНЕ".*"ДАННИТЕ СА ОСТАРЕЛИ"/s,"28.06 connection state text labels missing");
  need(sources.live,/SOLD · LOT/,"28.06 SOLD text state missing");
  need(sources.live,/ОФЕРТАТА Е ПРИЕТА/,"28.06 bid feedback text missing");

  need(sources.lot,/<label className="lotBidLabel" htmlFor="lot-bid-input">/,"28.07 bid input label missing");
  need(sources.lot,/<label>Дестинация<select/,"28.07 transport select label missing");
  need(sources.inventoryError,/role="alert" aria-labelledby="inventory-error-title"/,"28.07 accessible error alert missing");
  need(sources.inventoryLoading,/aria-busy="true" aria-live="polite"/,"28.07 accessible loading state missing");

  need(sources.live,/role="status"\s+aria-live="polite"/,"28.09 live status semantics missing");
  need(sources.live,/role="timer" aria-label={`Остават/,"28.09 live timer semantics missing");
  need(sources.live,/liveSoldTransition[^\n]*role="status" aria-live="polite"/,"28.09 sold transition live region missing");
  need(sources.live,/liveBidFeedback[\s\S]*role="status"[\s\S]*aria-live="polite"/,"28.09 bid feedback live region missing");

  need(sources.mobile,/@media\(max-width:640px\)/,"28.11 responsive 640px layer missing");
  need(sources.mobile,/overflow-x:clip/,"28.11 overflow protection missing");
  const zoom=config.zoomBaseline;
  if(zoom?.targetPercent!==200)fail("28.11 zoom target must be 200%");
  if(JSON.stringify(zoom.runtimeViewportWidths)!==JSON.stringify([360,390,430]))fail("28.11 runtime reflow widths drift");
  if(zoom.horizontalOverflowMustRemainControlled!==true)fail("28.11 overflow acceptance rule disabled");
  for(const width of zoom.runtimeViewportWidths){
    if(!sources.capture.includes(`width:${width}`)&&!sources.capture.includes(`width: ${width}`))fail(`28.11 capture matrix missing width ${width}`);
  }

  need(sources.mobile,/min-height:44px!important/,"28.12 44px mobile target missing");
  need(sources.crossBrowser,/@media\(hover:none\) and \(pointer:coarse\)/,"28.12 coarse pointer mode missing");
  need(sources.crossBrowser,/min-height:44px/,"28.12 coarse-pointer 44px target missing");

  const desktop=config.desktopMatrix;
  if(JSON.stringify(desktop.browsers?.map(x=>x.id))!==JSON.stringify(["chrome","edge"]))fail("28.13 desktop browser matrix drift");
  if(desktop.browsers.some(x=>x.required!==true))fail("28.13 Chrome and Edge must both be required");
  if(desktop.expectedScreenshotsPerBrowser!==30)fail("28.13 screenshot count drift");
  need(sources.workflow,/Install Microsoft Edge stable/,"28.13 Edge install missing from CI");
  need(sources.workflow,/Chrome and Edge visual regression screenshots/,"28.13 runtime browser matrix missing from CI");

  const mobileMatrix=config.mobileMatrix;
  const channels=mobileMatrix.executableCiBaseline?.channels||[];
  if(JSON.stringify(channels.map(x=>x.id))!==JSON.stringify(["chrome-mobile-emulation","edge-mobile-emulation"]))fail("28.14 mobile CI baseline drift");
  const release=mobileMatrix.releaseTarget?.realOrPlatformBrowserChannels||[];
  if(JSON.stringify(release.map(x=>x.id))!==JSON.stringify(["android-chrome","ios-safari"]))fail("28.14 Android/iOS release target drift");
  if(release.some(x=>x.requiredForFinalProductionAcceptance!==true))fail("28.14 Android/iOS must remain final-production release targets");
  if(release.some(x=>x.currentExecutionClaimed!==false))fail("28.14 real Android/iOS execution must not be falsely claimed");
  if(config.browserEvidence?.realAndroidOrIosExecutionClaimedByPhase28!==false)fail("28.14 phase truth boundary drift");
  need(sources.workflow,/DP2_MOBILE_BROWSER_MATRIX PASS chrome_mobile=15 edge_mobile=15 widths=360,390,430/,"28.14 executable mobile CI gate missing");

  for(const key of Object.keys(config.greenRules||{})){
    if(config.greenRules[key]!==true)fail(`GREEN rule disabled: ${key}`);
  }
  return {tasks:14,contrastPairs:config.contrastPairs.length,coreRoutes:5};
}

function readSources(){
  const read=p=>fs.readFileSync(p,"utf8");
  return {
    layout:read("app/layout.tsx"),
    accessibility:read("app/accessibility-quality.css"),
    theme:read("app/enchev-theme.css"),
    mobile:read("app/mobile-quality.css"),
    crossBrowser:read("app/cross-browser-quality.css"),
    home:read("app/page.tsx"),
    inventory:read("app/inventory/page.tsx"),
    inventoryError:read("app/inventory/error.tsx"),
    inventoryLoading:read("app/inventory/loading.tsx"),
    lot:read("app/lot/[id]/page.tsx"),
    live:read("app/live-auctions/page.tsx"),
    profile:read("app/profile/page.tsx"),
    capture:read("scripts/capture-visual-regression.mjs"),
    workflow:read(".github/workflows/verify-enchev-web.yml"),
  };
}
function runExisting(script,args=[]){
  const result=spawnSync(process.execPath,[script,...args],{stdio:"inherit"});
  if(result.status!==0)fail(`dependent verifier failed: ${script} ${args.join(" ")}`);
}

const raw=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const desktopMatrix=JSON.parse(fs.readFileSync("config/enchev-cross-browser-test-matrix.json","utf8"));
const mobileMatrix=JSON.parse(fs.readFileSync("config/enchev-mobile-browser-test-matrix.json","utf8"));
const config={...raw,desktopMatrix,mobileMatrix};
const sources=readSources();
const result=validate(config,sources);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutateConfig,mutateSources)=>{
    const candidate=structuredClone(config);
    const sourceCopy={...sources};
    if(mutateConfig)mutateConfig(candidate);
    if(mutateSources)mutateSources(sourceCopy);
    let rejected=false;
    try{validate(candidate,sourceCopy);}catch{rejected=true;}
    if(!rejected)fail(`negative self-test not rejected: ${label}`);
    cases+=1;
  };
  reject("drop frozen task",c=>{c.tasks.pop();});
  reject("claim certification",c=>{c.standardTarget.certificationClaimed=true;});
  reject("weaken contrast",c=>{c.contrastPairs[0].foreground="#777777";c.contrastPairs[0].background="#888888";});
  reject("remove focus ring",null,s=>{s.accessibility=s.accessibility.replace("outline:3px solid #8bffc0!important","outline:none!important");});
  reject("remove error alert",null,s=>{s.inventoryError=s.inventoryError.replace('role="alert"','role="group"');});
  reject("remove reduced motion",null,s=>{s.accessibility=s.accessibility.replace("@media(prefers-reduced-motion:reduce)","@media(min-width:1px)");});
  reject("remove zoom width",c=>{c.zoomBaseline.runtimeViewportWidths=[390,430];});
  reject("falsely claim iOS execution",c=>{c.mobileMatrix.releaseTarget.realOrPlatformBrowserChannels[1].currentExecutionClaimed=true;});
  console.log(`ACCESSIBILITY_DEVICE_QUALITY_SELF_TEST PASS cases=${cases} tasks=${result.tasks} contrast_pairs=${result.contrastPairs}`);
}else{
  runExisting("scripts/verify-accessibility-visual-pass.mjs");
  runExisting("scripts/verify-mobile-first-design.mjs");
  runExisting("scripts/verify-cross-browser-visual-contract.mjs");
  runExisting("scripts/verify-cross-browser-test-matrix.mjs");
  runExisting("scripts/verify-mobile-browser-test-matrix.mjs");
  runExisting("scripts/capture-visual-regression.mjs",["--self-test"]);
  console.log(`ACCESSIBILITY_DEVICE_QUALITY PASS phase=28 tasks=${result.tasks} core_routes=${result.coreRoutes} contrast_pairs=${result.contrastPairs} certification_claimed=false real_ios_android_execution_claimed=false`);
}


import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require("/tmp/enchev-browser/node_modules/playwright");
const BASE_URL=process.env.BASE_URL||"http://127.0.0.1:3000";
const DIR=path.resolve("visual-review");
fs.mkdirSync(DIR,{recursive:true});
const pages=[
  {path:"/",name:"intro"},
  {path:"/platform",name:"platform"},
  {path:"/inventory",name:"inventory"},
  {path:"/inventory?make=BMW&model=M4%20F82",name:"filtered-bmw"},
  {path:"/live-auctions",name:"live-auctions"},
  {path:"/auction-readiness",name:"auction-readiness"},
  {path:"/lot/EA-10511",name:"lot-bmw"},
  {path:"/profile",name:"profile"},
  {path:"/vehicle-history",name:"vehicle-history"},
  {path:"/transport",name:"transport"},
  {path:"/support",name:"support"},
  {path:"/presentation",name:"presentation"},
  {path:"/workspace",name:"workspace"},
  {path:"/rtl-capability",name:"rtl-capability"},
];
const browser=await chromium.launch({headless:true});
const manifest={source:"Actual running Next.js branch site, NOT illustrative mockups",branch:process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||"local",commit:process.env.GITHUB_SHA||"local",capture:new Date().toISOString(),screenshots:[]};
try{
  for(const device of [
    {name:"pc",width:1440,height:900,isMobile:false,deviceScaleFactor:1},
    {name:"phone-390",width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1}
  ]){
    const ctx=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.deviceScaleFactor,isMobile:device.isMobile,hasTouch:device.hasTouch??false,reducedMotion:"reduce"});
    for(const target of pages){
      const page=await ctx.newPage();
      const failures=[];
      page.on("pageerror",e=>failures.push(String(e.message).slice(0,200)));
      try {
        const response=await page.goto(BASE_URL+target.path,{waitUntil:"domcontentloaded",timeout:40000});
        if(!response || response.status()>=400)throw Error("HTTP "+(response?.status()??"none"));
        // The cinematic presentation re-renders its root during hydration; do not
        // block screenshot capture on an unstable body locator.
        if(target.name!=="presentation")await page.locator("body").waitFor();
        await page.evaluate(async()=>{await document.fonts.ready;});
        await page.waitForTimeout(target.name==="intro"||target.name==="workspace"?1200:550);
        if(target.name==="auction-readiness"){
          // D001 acceptance evidence: wait for actual browser GET probes, never guessed status colors.
          await page.waitForFunction(() => {
            const probes=[...document.querySelectorAll(".arService[data-probe]")];
            return probes.length===7 && probes.every(node => node.getAttribute("data-state")!=="checking");
          },null,{timeout:25000});
          const [download]=await Promise.all([
            page.waitForEvent("download",{timeout:15000}),
            page.getByRole("button",{name:/ЕКСПОРТ НА ДОКАЗАТЕЛСТВА/}).click(),
          ]);
          const evidenceFile=path.join(DIR,`${device.name}-auction-readiness-evidence.json`);
          await download.saveAs(evidenceFile);
          const evidence=JSON.parse(fs.readFileSync(evidenceFile,"utf8"));
          const critical=evidence?.checks?.filter(x=>x.requiredForAuction);
          if(evidence?.kind!=="ENCHEV_D001_BROWSER_HEALTH_AUDIT"||
             evidence?.checks?.length!==7||critical?.length!==6||
             critical.some(x=>typeof x.httpStatus!=="number"||x.state==="checking")){
            throw new Error("D001 export missing real HTTP evidence for six critical services");
          }
          manifest.evidence??=[];
          manifest.evidence.push({device:device.name,route:target.path,file:path.basename(evidenceFile),
            observedAt:evidence.observedAt,
            services:critical.map(x=>({service:x.service,httpStatus:x.httpStatus,state:x.state})),
            certifiedForRealAuctions:false});
          console.log("D001_EVIDENCE_PASS",device.name,critical.map(x=>x.service+":"+x.httpStatus+":"+x.state).join(" "));
        }
        const width=await page.evaluate(()=>document.documentElement.scrollWidth);
        if(width>device.width+2){throw new Error(`Horizontal scroll: ${width}px at viewport ${device.width}px`);}
        const screenshot=path.join(DIR,`${device.name}-${target.name}.png`);
        await page.screenshot({path:screenshot,fullPage:target.name!=="intro",animations:"disabled",timeout:50000});
        manifest.screenshots.push({device:device.name,route:target.path,file:path.basename(screenshot),title:await page.title(),pageErrors:failures});
        console.log("SCREENSHOT_PASS",device.name,target.path,path.basename(screenshot));
        if(target.name==="auction-readiness"){
          // A disconnected browser must never present stale HTTP statuses as live auction readiness.
          await ctx.setOffline(true);
          try {
            await page.getByRole("button",{name:/ПРОВЕРИ СИСТЕМАТА/}).click();
            await page.waitForFunction(() => {
              const probes=[...document.querySelectorAll(".arService[data-probe]")];
              return probes.length===7 && probes.every(node=>node.getAttribute("data-state")==="unavailable");
            },null,{timeout:20000});
            const offlineFile=path.join(DIR,`${device.name}-auction-readiness-offline.png`);
            await page.screenshot({path:offlineFile,fullPage:true,animations:"disabled",timeout:50000});
            manifest.screenshots.push({device:device.name,route:target.path,
              file:path.basename(offlineFile),network:"offline",verifiedFailClosed:true});
            console.log("D001_OFFLINE_PASS",device.name,path.basename(offlineFile));
          }finally{
            await ctx.setOffline(false);
          }
        }
      }catch(e){
        console.error("SCREENSHOT_FAIL",device.name,target.path,String(e));
        process.exitCode=1;
      }finally{await page.close();}
    }
    await ctx.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(DIR,"manifest.json"),JSON.stringify(manifest,null,2));

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
  {path:"/live-auctions/etap-1",name:"etap1-demo-lobby"},
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
        const width=await page.evaluate(()=>document.documentElement.scrollWidth);
        if(width>device.width+2){throw new Error(`Horizontal scroll: ${width}px at viewport ${device.width}px`);}
        const screenshot=path.join(DIR,`${device.name}-${target.name}.png`);
        await page.screenshot({path:screenshot,fullPage:target.name!=="intro",animations:"disabled",timeout:50000});
        manifest.screenshots.push({device:device.name,route:target.path,file:path.basename(screenshot),title:await page.title(),pageErrors:failures});

        if(target.name==="etap1-demo-lobby"){
          // Real interaction test: authenticated auction remains untouched; guest can
          // open the local three-bot demo from the lobby.
          const mobile=device.isMobile;
          const play=page.locator(mobile?".eaLxMobilePlayDemo":".eaLxDesktopPlayDemo");
          await page.locator(".eaLuxuryLobby").waitFor({state:"visible",timeout:12000});
          if(!await play.isVisible())throw Error("PLAY DEMO CTA missing from lobby");
          await play.click();
          await page.locator(".eaPDBotRoster").waitFor({state:"visible",timeout:10000});
          const startedAt=Date.now();
          await page.locator(".eaPDAuctionLayout").waitFor({state:"visible",timeout:12000});
          if(Date.now()-startedAt<3800)throw Error("5-second bot entrance was skipped");
          const joined=await page.locator(".eaPDBotRoster>div.is-here").count().catch(()=>3);
          if(joined!==3)console.log("Bot join completed at auction switch; prior roster is unmounted");
          if(!await page.locator(".eaPDGaugeSvg").isVisible())throw Error("Speedometer missing");
          if(!await page.locator(".eaPDTime").isVisible())throw Error("Countdown missing");
          const pre=await page.locator(".eaPDPrice strong").innerText();
          if(!pre.includes("1,000,000"))throw Error("Unexpected initial demo bid: "+pre);
          await page.locator(".eaPDMetalBid").click();
          if(!(await page.locator(".eaPDMetalBid").innerText()).includes("ПОТВЪРДИ"))throw Error("Two-tap bid confirmation missing");
          await page.locator(".eaPDMetalBid").click();
          const after=await page.locator(".eaPDPrice strong").innerText();
          if(!after.includes("1,100,000"))throw Error("Confirmed bid not applied: "+after);
          if(!await page.getByText("ВИЕ · ДЕМО").first().isVisible())throw Error("Demo bid absent from offer history");
          const fullWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
          if(fullWidth>device.width+2)throw Error("PLAY DEMO horizontal overflow "+fullWidth+"px");
          const demoShot=path.join(DIR,`${device.name}-etap1-play-demo-auction.png`);
          await page.screenshot({path:demoShot,fullPage:true,animations:"disabled",timeout:50000});
          manifest.screenshots.push({device:device.name,route:target.path+"#play-demo",file:path.basename(demoShot),pageErrors:failures});
          console.log("PLAY_DEMO_PASS",device.name,"5s bots, gauge, bid confirmation, feed, no overflow");
        }

        console.log("SCREENSHOT_PASS",device.name,target.path,path.basename(screenshot));
      }catch(e){
        console.error("SCREENSHOT_FAIL",device.name,target.path,String(e));
        process.exitCode=1;
      }finally{await page.close();}
    }
    await ctx.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(DIR,"manifest.json"),JSON.stringify(manifest,null,2));

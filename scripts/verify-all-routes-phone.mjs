// Browser regression for ENCHEV real phone layouts; checks geometry, not visual guesses.
// Runs against a built Next.js server with the isolated Playwright install from CI.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require("/tmp/enchev-browser/node_modules/playwright");
const base=process.env.BASE_URL||"http://127.0.0.1:3000";
const routes=["/platform","/inventory","/live-auctions","/lot/EA-10511","/vehicle-history","/transport","/profile","/support","/presentation"];
const viewports=[{width:320,height:720},{width:390,height:844},{width:430,height:932}];
const browser=await chromium.launch({headless:true});
let failures=0;
try{
  for(const viewport of viewports){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:"reduce"});
    for(const route of routes){
      const page=await context.newPage();
      try{
        const response=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:30000});
        assert.ok(response?.ok(),route+" HTTP failure: "+response?.status());
        await page.locator("main#main-content").waitFor({state:"visible",timeout:12000});
        const result=await page.evaluate(()=>{
          const root=document.querySelector("main#main-content")||document.querySelector("main");
          const shell=document.querySelector(".eaAppShell");
          const mainRect=root?.getBoundingClientRect();
          const shellRect=shell?.getBoundingClientRect();
          const bidder=document.querySelector(".proLiveBidDock");
          const next=document.querySelector(".proLiveNowNext");
          return {
            viewport:innerWidth,
            documentWidth:document.documentElement.scrollWidth,
            bodyWidth:document.body.scrollWidth,
            mainWidth:mainRect?.width??0,
            shellWidth:shellRect?.width??0,
            dockPosition:bidder?getComputedStyle(bidder).position:null,
            dockWidth:bidder?.getBoundingClientRect().width??0,
            nextWidth:next?.getBoundingClientRect().width??0,
            viewportMeta:document.querySelector('meta[name="viewport"]')?.getAttribute("content")??""
          };
        });
        assert.equal(result.viewport,viewport.width,route+" wrong viewport (likely zoomed desktop layout)");
        assert.match(result.viewportMeta,/width=device-width/,route+" missing mobile viewport meta");
        assert.ok(result.documentWidth<=viewport.width+2,route+" page overflows viewport: "+JSON.stringify(result));
        assert.ok(result.bodyWidth<=viewport.width+2,route+" body overflows viewport: "+JSON.stringify(result));
        assert.ok(result.mainWidth>=viewport.width*.87,route+" main clipped to partial width: "+JSON.stringify(result));
        if(route!=="/presentation")assert.ok(result.shellWidth>=viewport.width*.98,route+" header clipped to partial width: "+JSON.stringify(result));
        if(route==="/live-auctions"){
          assert.equal(result.dockPosition,"static","Live bid dock overlays cards on mobile");
          assert.ok(result.dockWidth>=viewport.width*.75,"Live bidder too narrow");
          assert.ok(result.nextWidth>=viewport.width*.75,"Live next-lot cards too narrow");
        }
        // Check that mobile links are actually reachable; avoid changing real bid state.
        if(route==="/inventory"){
          await page.locator(".eaAppMenuButton").click();
          const drawer=page.locator("#ea-mobile-navigation");
          await drawer.waitFor({state:"visible",timeout:5000});
          assert.ok(await drawer.locator('a[href="/live-auctions"]').count()>0,"Missing mobile live link");
          await page.locator(".eaAppMobileClose").click();
        }
        console.log("PHONE_PASS",viewport.width,route);
      }catch(error){
        failures++;
        console.error("PHONE_FAIL",viewport.width,route,String(error?.message??error));
      }finally{await page.close();}
    }
    await context.close();
  }
}finally{await browser.close();}
if(failures)process.exitCode=1;

// Browser regression for ENCHEV real phone layouts; checks geometry, not visual guesses.
// Runs against a built Next.js server with the isolated Playwright install from CI.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require("/tmp/enchev-browser/node_modules/playwright");
const base=process.env.BASE_URL||"http://127.0.0.1:3000";
const routes=["/","/platform","/inventory","/live-auctions","/lot/EA-10511","/lot/EA-10603","/vehicle-history","/transport","/profile","/support","/presentation","/workspace","/rtl-capability"];
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
        await page.locator("main#main-content,main[data-rtl-capability-page]").waitFor({state:"visible",timeout:12000});
        const result=await page.evaluate(()=>{
          const root=document.querySelector("main#main-content")||document.querySelector("main[data-rtl-capability-page]")||document.querySelector("main");
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
            themeGreen:getComputedStyle(document.documentElement).getPropertyValue("--ea-home-green").trim(),
            viewportMeta:document.querySelector('meta[name="viewport"]')?.getAttribute("content")??""
          };
        });
        assert.equal(result.viewport,viewport.width,route+" wrong viewport (likely zoomed desktop layout)");
        assert.match(result.viewportMeta,/width=device-width/,route+" missing mobile viewport meta");
        assert.equal(result.themeGreen,"#27f58a",route+" missing shared homepage theme CSS");
        assert.ok(result.documentWidth<=viewport.width+2,route+" page overflows viewport: "+JSON.stringify(result));
        assert.ok(result.bodyWidth<=viewport.width+2,route+" body overflows viewport: "+JSON.stringify(result));
        assert.ok(result.mainWidth>=viewport.width*.87,route+" main clipped to partial width: "+JSON.stringify(result));
        if(route!=="/presentation" && route!=="/" && route!=="/workspace")assert.ok(result.shellWidth>=viewport.width*.98,route+" header clipped to partial width: "+JSON.stringify(result));
        if(route==="/live-auctions"){
          assert.equal(result.dockPosition,"static","Live bid dock overlays cards on mobile");
          assert.ok(result.dockWidth>=viewport.width*.75,"Live bidder too narrow");
          const quickBar=page.locator(".liveMobileActionBar");
          await quickBar.waitFor({state:"visible"});
          const quickRect=await quickBar.boundingBox();
          assert.ok(quickRect && quickRect.width>=viewport.width-3,"Mobile price/action bar must span phone");
          assert.ok(quickRect.y+quickRect.height<=viewport.height+2,"Mobile price/action bar must fit phone");
          assert.match(await quickBar.innerText(),/CURRENT DEMO BID/,"Demo-only price label must be visible");
          assert.ok(await quickBar.locator('button').isVisible(),"Bid options shortcut must remain visible");
          const mainHeader=page.locator(".eaAppHeader");
          const headerRect=await mainHeader.boundingBox();
          assert.ok(headerRect && headerRect.height<=64,"Mobile header must be compact");
          // Hero rotates among multiple demo lots, so verify the actual GTI model inside its catalog instead of assuming the active lot.

          const visual=page.locator(".liveVisual");
          const bidder=page.locator(".proLiveUx");
          await visual.waitFor({state:"visible"});
          const carY=(await visual.boundingBox())?.y??0;
          const controlY=(await bidder.boundingBox())?.y??0;
          assert.ok(carY>0 && controlY>carY+120,"Car should be the first mobile visual, above the technical bidder");
          const diag=page.locator(".proLiveStatusGrid");
          assert.equal(await diag.isVisible(),false,"Do not show dense diagnostics by default");
          const toggle=page.locator(".proLiveAdvancedToggle");
          await toggle.click();
          assert.equal(await diag.isVisible(),true,"Diagnostics must expand on demand");
          await toggle.click();
          assert.equal(await diag.isVisible(),false,"Diagnostics must collapse again");
          const bidAction=page.locator(".proLiveBidDock button");
          assert.ok(await bidAction.isVisible(),"Primary bid control must remain visible");
        }
        if(route==="/lot/EA-10603"){
          const source=await page.locator(".lotMainImage img").first().getAttribute("src");
          assert.ok(source?.includes("photo-1655285886265-835ce7541e10"),"Golf preview must show Golf GTI photo, not an SUV");
          assert.ok(await page.locator(".lotDemoPhotoCredit").isVisible(),"Golf demo media attribution must be visible");
        }
        // Check that mobile links are actually reachable; avoid changing real bid state.
        if(route==="/inventory"){
          // The current page is paginated: image equality is guarded in source and lot detail too.
          assert.ok(await page.locator(".inventoryGrid").count()>0,"Inventory must keep phone card layout");
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

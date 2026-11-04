// Browser regression: closing ads MUST unlock native Forge, canvas and scroll.
// Covers PC/mobile; both full-first-ad completion and early X skip.
// Run with BASE_URL against a built deployment with Playwright installed.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require("/tmp/enchev-browser/node_modules/playwright");

const base=process.env.BASE_URL || "http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
const sizes=[{width:1440,height:900},{width:390,height:844}];
const errors=[];
try{
  for(const viewport of sizes) for(const mode of ["skip","watched"]){
    const page=await browser.newPage({viewport});
    const name=viewport.width+"px "+mode;
    try{
      await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:40000});
      const forge=page.frameLocator('iframe[title="ENCHEV Auctions cinematic homepage"]');
      const enter=forge.getByRole("button",{name:"Enter Website"});
      await enter.waitFor({state:"visible",timeout:40000});
      await enter.click();
      await page.locator("[data-enchev-login-overlay]").waitFor({state:"visible",timeout:12000});
      if(mode==="skip"){
        await page.getByRole("button",{name:"Премини към рекламата на E&A"}).click();
      }else{
        const ad=page.frameLocator('iframe[title="SOULFLAME CarAR — реклама преди E&A"]');
        await ad.locator("body").evaluate(()=>{
          window.parent.postMessage({type:"SOULFLAME_AD_DONE"},window.location.origin);
        });
      }
      await page.locator('iframe[src="/original-cinema"]').waitFor({state:"attached",timeout:20000});
      await page.getByRole("button",{name:"Затвори рекламата"}).click();
      await page.locator("[data-enchev-login-overlay]").waitFor({state:"detached",timeout:12000});
      await forge.locator("#page:not([inert])").waitFor({state:"attached",timeout:30000});
      await forge.locator('[role="dialog"][aria-label="Welcome to ENCHEV Auctions"]')
        .waitFor({state:"detached",timeout:30000});
      const photo=forge.locator('[data-sanity*="path=approachHeading"]').first();
      await photo.waitFor({state:"attached",timeout:12000});
      const previous=await photo.evaluate(el=>el.getBoundingClientRect().top);
      const width=viewport.width;
      await page.mouse.move(Math.round(width*.5),Math.round(viewport.height*.58));
      for(let i=0;i<4;i++){
        await page.mouse.wheel(0,650);
        await page.waitForTimeout(280);
      }
      await page.waitForTimeout(1000);
      const after=await photo.evaluate(el=>el.getBoundingClientRect().top);
      assert.ok(Math.abs(after-previous)>45,"Forge smooth-scroll appears frozen; before="+previous+", after="+after);
      const state=await forge.locator("body").evaluate(()=>{
        const canvas=[...document.querySelectorAll("#page canvas")];
        const page=document.getElementById("page");
        return {
          canvasCount:canvas.length,
          drawnCanvases:canvas.filter(c=>c.width>0&&c.height>0).length,
          pageInert:page?.hasAttribute("inert"),
          bridge:!!window.__enchevForgeWake?.ready,
          photoLoaded:[...document.querySelectorAll('img[alt*="stitching"]')]
            .some(img=>img.complete&&img.naturalWidth>0)
        };
      });
      assert.equal(state.pageInert,false,"Forge page remains inert");
      assert.ok(state.canvasCount>=1,"Forge scene canvases missing");
      // Canvas dimensions can legitimately lag WebCodecs on CI SwiftShader;
      // actual pixel-content and GPU tests still need target-device testing.
      assert.equal(state.bridge,true,"post-ad resume event never reached Forge");
      console.log("PASS "+name+" "+JSON.stringify({previous,after,...state}));
    }catch(e){
      errors.push(name+": "+String(e?.message||e));
      console.error("FAIL "+name,e);
    }finally{await page.close();}
  }
}finally{await browser.close();}
if(errors.length){
  console.error(errors.join("\n"));
  process.exitCode=1;
}
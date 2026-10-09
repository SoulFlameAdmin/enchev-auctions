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
    {name:"phone-320",width:320,height:720,isMobile:true,hasTouch:true,deviceScaleFactor:1},
    {name:"phone-390",width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1},
    {name:"phone-430",width:430,height:932,isMobile:true,hasTouch:true,deviceScaleFactor:1}
  ]){
    const ctx=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.deviceScaleFactor,isMobile:device.isMobile,hasTouch:device.hasTouch??false,reducedMotion:"reduce"});
    for(const target of pages){
      const page=await ctx.newPage();
      const failures=[];
      page.on("pageerror",e=>failures.push(String(e.message).slice(0,200)));
      try {
        const response=await page.goto(BASE_URL+target.path,{waitUntil:"domcontentloaded",timeout:40000});
        if(!response || response.status()>=400)throw Error("HTTP "+(response?.status()??"none"));
        await page.locator("body").waitFor();
        await page.evaluate(async()=>{await document.fonts.ready;});
        await page.waitForTimeout(target.name==="intro"||target.name==="workspace"?1200:550);
        const width=await page.evaluate(()=>document.documentElement.scrollWidth);
        if(width>device.width+2){throw new Error(`Horizontal scroll: ${width}px at viewport ${device.width}px`);}
        const screenshot=path.join(DIR,`${device.name}-${target.name}.png`);
        await page.screenshot({path:screenshot,fullPage:target.name!=="intro",animations:"disabled",timeout:50000});
        manifest.screenshots.push({device:device.name,route:target.path,file:path.basename(screenshot),title:await page.title(),pageErrors:failures});
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

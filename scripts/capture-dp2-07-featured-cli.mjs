import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const baseUrl=process.argv[2]||"http://127.0.0.1:3011";
const outputDir=process.argv[3]||"artifacts/dp2-07-featured";
const widths=[360,390,430,1366,1440,1920];
const heights={360:1100,390:1100,430:1100,1366:1200,1440:1200,1920:1200};

function fail(message){ throw new Error("DP2_07_FEATURED_VISUAL FAIL: "+message); }
function findBrowser(){
  const candidates=[process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean);
  for(const candidate of candidates){
    if(candidate.startsWith("/")&&fs.existsSync(candidate))return candidate;
    const probe=spawnSync("which",[candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  fail("browser executable not found");
}
function pngOk(file){
  if(!fs.existsSync(file))return false;
  const data=fs.readFileSync(file);
  return data.length>5000&&data[0]===0x89&&data[1]===0x50&&data[2]===0x4e&&data[3]===0x47;
}

const browser=findBrowser();
fs.mkdirSync(outputDir,{recursive:true});
const entries=[];
for(const width of widths){
  const height=heights[width];
  const file=path.resolve(outputDir,"home-featured--"+width+".png");
  const target=new URL("/#inventory",baseUrl).toString();
  const result=spawnSync(browser,[
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--virtual-time-budget=3500",
    "--window-size="+width+","+height,
    "--screenshot="+file,
    target,
  ],{encoding:"utf8",timeout:30000});
  if(result.status!==0)fail("browser screenshot failed width="+width+" stderr="+String(result.stderr||"").slice(-800));
  if(!pngOk(file))fail("invalid PNG width="+width);
  entries.push({width,height,file:path.basename(file),bytes:fs.statSync(file).size});
}
fs.writeFileSync(path.join(outputDir,"manifest.json"),JSON.stringify({version:1,browser,baseUrl,count:entries.length,entries},null,2)+"\n");
console.log("DP2_07_FEATURED_VISUAL PASS browser="+browser+" screenshots="+entries.length+" widths="+widths.join(","));

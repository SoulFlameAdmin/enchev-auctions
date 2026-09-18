import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const ROUTES=[
  {name:"home",path:"/"},
  {name:"inventory",path:"/inventory"},
  {name:"lot-ea-10539",path:"/lot/EA-10539"},
  {name:"live-auctions",path:"/live-auctions"},
  {name:"profile",path:"/profile"},
];

const VIEWPORTS=[
  {name:"desktop",width:1440,height:1200},
  {name:"mobile",width:390,height:844},
];

function fail(message){
  throw new Error(`VISUAL_REGRESSION_CAPTURE FAIL: ${message}`);
}

export function validateMatrix(routes=ROUTES,viewports=VIEWPORTS){
  if(routes.length!==5)fail(`expected 5 routes, got ${routes.length}`);
  if(viewports.length!==2)fail(`expected 2 viewports, got ${viewports.length}`);
  const routeNames=new Set(routes.map(route=>route.name));
  const paths=new Set(routes.map(route=>route.path));
  if(routeNames.size!==routes.length)fail("route names must be unique");
  if(paths.size!==routes.length)fail("route paths must be unique");
  if(!paths.has("/")||!paths.has("/inventory")||!paths.has("/lot/EA-10539")||!paths.has("/live-auctions")||!paths.has("/profile"))fail("core route matrix incomplete");
  for(const viewport of viewports){
    if(!Number.isInteger(viewport.width)||!Number.isInteger(viewport.height)||viewport.width<320||viewport.height<600)fail(`invalid viewport ${viewport.name}`);
  }
  if(!viewports.some(v=>v.name==="desktop"&&v.width>=1280))fail("desktop viewport missing");
  if(!viewports.some(v=>v.name==="mobile"&&v.width<=430))fail("mobile viewport missing");
  return true;
}

function findChrome(){
  const candidates=[
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for(const candidate of candidates){
    const probe=spawnSync("which",[candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
    if(candidate.startsWith("/")&&fs.existsSync(candidate))return candidate;
  }
  fail("Chrome/Chromium executable not found");
}

function sha256(file){
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function captureScreenshots(baseUrl,outputDir="artifacts/visual-regression"){
  validateMatrix();
  if(!/^https?:\/\//.test(baseUrl))fail("base URL must be http(s)");
  const chrome=findChrome();
  fs.mkdirSync(outputDir,{recursive:true});
  const entries=[];

  for(const route of ROUTES){
    for(const viewport of VIEWPORTS){
      const filename=`${route.name}--${viewport.name}.png`;
      const filepath=path.resolve(outputDir,filename);
      const url=new URL(route.path,baseUrl).toString();
      const args=[
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=3500",
        `--window-size=${viewport.width},${viewport.height}`,
        `--screenshot=${filepath}`,
        url,
      ];
      const result=spawnSync(chrome,args,{encoding:"utf8",timeout:30000});
      if(result.status!==0)fail(`${filename} chrome exit=${result.status}: ${(result.stderr||result.stdout||"").trim()}`);
      if(!fs.existsSync(filepath))fail(`${filename} was not created`);
      const bytes=fs.statSync(filepath).size;
      if(bytes<5000)fail(`${filename} is unexpectedly small (${bytes} bytes)`);
      entries.push({
        route:route.path,
        name:route.name,
        viewport:viewport.name,
        width:viewport.width,
        height:viewport.height,
        file:filename,
        bytes,
        sha256:sha256(filepath),
      });
    }
  }

  if(entries.length!==10)fail(`expected 10 screenshots, got ${entries.length}`);
  const manifest={
    version:1,
    generatedAt:new Date().toISOString(),
    baseUrl,
    browserExecutable:chrome,
    count:entries.length,
    entries,
  };
  fs.writeFileSync(path.join(outputDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log(`VISUAL_REGRESSION_CAPTURE PASS screenshots=${entries.length} output=${outputDir}`);
  return manifest;
}

if(process.argv.includes("--self-test")){
  validateMatrix();
  let rejected=false;
  try{validateMatrix(ROUTES.slice(0,4),VIEWPORTS);}catch{rejected=true;}
  if(!rejected)fail("negative self-test did not reject incomplete routes");
  rejected=false;
  try{validateMatrix(ROUTES,[{name:"mobile",width:200,height:400}]);}catch{rejected=true;}
  if(!rejected)fail("negative self-test did not reject invalid viewport");
  console.log("VISUAL_REGRESSION_CAPTURE_SELF_TEST PASS matrix=5x2 negative_cases=2");
}else{
  const baseUrl=process.argv[2]||"http://127.0.0.1:3011";
  captureScreenshots(baseUrl);
}

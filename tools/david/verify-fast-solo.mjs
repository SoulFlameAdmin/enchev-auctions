import fs from "node:fs";
import path from "node:path";

const HERE=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,"$1"));
const ROOT=path.resolve(HERE,"..","..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");

const selector=read("DAVID_MODE_SELECTOR_V2.ps1");
const start=read("START_DAVID_SINGLE.ps1");
const restart=read("RESTART_DAVID_SINGLE_CLEAN.ps1");
const enchev=read("tools/david/auto-continue-enchev-v5.mjs");
const dpp=read("tools/david/auto-complete-app2-v1.mjs");
const apk=read("tools/david/auto-continue-david-apk-v1.mjs");

for(const token of ["ENCHEV ONLY","DPP ONLY","DAVID APK ONLY","1 TAB / INSTANT","WATCH BACKGROUND","RESTART_DAVID_SINGLE_CLEAN.ps1","SOLO_SYSTEM","SOLO_DPP","SOLO_APK"])
  if(!selector.includes(token)) throw new Error("FAST SOLO selector invariant missing: "+token);

for(const token of [
  'ValidateSet("SYSTEM","APP2","APK")',
  'DAVID_CHATGPT_TAB_TARGET="1"',
  'DAVID_CONTROL_ENABLED="0"',
  'DAVID_PROJECT_EFFORT_MODE="instant"',
  'DAVID_REQUIRE_FRESH_EDGE_ON_START="1"',
  'DAVID_POLL_MS="250"',
  'DAVID_APP2_POLL_MS="250"',
  'DAVID_APK_POLL_MS="250"',
  'DAVID_COMPLETE_QUIET_MS="1200"',
  'DAVID_COMPLETE_STABLE_SAMPLES="2"',
  'DAVID_COMPLETE_SAMPLE_MS="350"',
  'DAVID_SEMANTIC_TERMINAL_QUIET_MS="2500"',
  'ChatGPT=1'
]) if(!start.includes(token)) throw new Error("FAST SOLO start invariant missing: "+token);

if(start.includes("DAVID_GLOBAL_SEND_INTERVAL_MS")) throw new Error("FAST SOLO must preserve global send pacing");
for(const token of ["STOP_DAVID_ALL_CLEAN.ps1","START_DAVID_SINGLE.ps1","WaitOne(90000)","-Worker $Worker"])
  if(!restart.includes(token)) throw new Error("FAST SOLO restart invariant missing: "+token);

for(const [name,src] of [["ENCHEV",enchev],["DPP",dpp],["APK",apk]]){
  for(const token of ["EFFORT_MODE","DAVID_PROJECT_EFFORT_MODE","ensureChatGptEffortMode(page, EFFORT_MODE)"])
    if(!src.includes(token)) throw new Error(name+" configurable effort invariant missing: "+token);
}

console.log("DAVID_FAST_SOLO PASS buttons=3 tabs=1 effort=INSTANT watch=BACKGROUND full_clean_restart=ON fresh_edge=ON completion_poll_ms=250 completion_quiet_ms=1200 rate_limit_safety=PRESERVED");

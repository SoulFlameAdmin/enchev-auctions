import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,"..","..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");

const side=read("tools/david/sf-scientist-sidecar.mjs");
const start=read("START_SF_SCIENTIST.ps1");
const stop=read("STOP_SF_SCIENTIST.ps1");
const center=read("DAVID_MODE_SELECTOR_V2.ps1");

for(const token of [
  'SF_SCIENTIST_CDP_URL||"http://127.0.0.1:9555"',
  'DAVID_CDP_URL||"http://127.0.0.1:9444"',
  '.sf-scientist-state.json',
  '.sf-scientist-command.json',
  'autonomous-decision',
  'CONSULT_AB',
  'OPEN_POWERSHELL',
  'SEARCH_WEB',
  'async function liveTelemetry',
  'PowerShell/CMD/Node',
  'recentLogs',
  'logAlerts',
  'probeErrors',
  'SETTLE_MS',
  'STARTING_DPP',
  'stable snapshot after event burst',
  'POWERSHELL_EXE',
  'replace(/^\\uFEFF/,"")',
  'MAX_AUTONOMOUS_STEPS',
  '.sf-scientist-operator.jsonl',
  'function classifyPowerShell',
  'async function runPowerShell',
  'async function captureDesktop',
  'async function inspectScreen',
  'async function consultProjectConnectors',
  'async function reasonActLoop',
  'ACTION: POWERSHELL <normal-user PowerShell command>',
  'ACTION: INSPECT_SCREEN',
  'ACTION: CHECK_PROJECT',
  'blocked-high-risk-pattern',
  'Recent persistent Scientist memory',
  'ensureChatGptEffortMode',
  'SCIENTIST_EFFORT="medium"',
  'scientistExperience:"CHAT"',
  'scientistModel:"GPT-5.6 Sol"',
  'scientistProfileConfirmed',
  'never ChatGPT Work'
]) if(!side.includes(token)) throw new Error("Scientist sidecar invariant missing: "+token);

for(const token of [
  'SF_SCIENTIST_CHATGPT_PROFILE',
  'sf-scientist-sidecar.mjs',
  '[int]$Port = 9555',
  '[int]$DavidPort = 9444',
  'Existing DAVID architecture was not modified'
]) if(!start.includes(token)) throw new Error("Scientist launcher invariant missing: "+token);

if(stop.includes("DAVID_CHATGPT_PROFILE")) throw new Error("Scientist stop must not target DAVID browser profile");
if(stop.includes("--remote-debugging-port=9444")) throw new Error("Scientist stop must not target DAVID CDP 9444");

if(!/Hide-OwnConsole\s+Update-Ui\s+try\{[\s\S]*?Start-ScientistSidecar[\s\S]*?\}catch\{\}/m.test(center))
  throw new Error("Mode Center must auto-start SF Scientist even when DAVID is STOPPED");

for(const token of [
  "DAVID MODE CENTER V2.1",
  "SF AI SCIENTIST",
  "START SCIENTIST",
  "STOP SCIENTIST",
  "AUTONOMOUS DECISION / OBSERVATION",
  "Start-ScientistSidecar",
  "sf-scientist-sidecar.mjs",
  "SOULFLAME SYSTEM",
  "DAVID A + B",
  "ENCHEV ONLY",
  "DPP ONLY",
  "DAVID APK ONLY",
  "UTF8Encoding($false,$true)",
  "WriteAllText($ScientistCommand",
  "CHAT | GPT-5.6 SOL | MEDIUM"
]) if(!center.includes(token)) throw new Error("Mode Center Scientist invariant missing: "+token);

for(const forbidden of ["START_DAVID_ALL.ps1 -ForceRestart","DAVID_CHATGPT_TAB_TARGET=\"2\""]) {
  if(start.includes(forbidden)) throw new Error("Scientist launcher may not rewrite DAVID topology: "+forbidden);
}

console.log("SF_SCIENTIST_SIDECAR PASS david_architecture=UNCHANGED scientist_experience=CHAT model=GPT-5.6_SOL effort=MEDIUM work=OFF scientist_cdp=9555 david_observe_cdp=9444 operator_reason_act_loop=ON");

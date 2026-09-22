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
const effort=read("tools/david/chatgpt-effort-mode.mjs");
const controlPreview=read("tools/david/control-panel-task-preview.mjs");

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
  'never ChatGPT Work',
  'async function ensureNormalChatExperience',
  '/^(Chat|Чат)$/i',
  'workLimitVisible',
  'scientistModelSolVisible',
  'profileVerifyAttempts',
  'scientistPickerLabel',
  'chat-click-confirmed',
  'continue;',
  'MAX_EVENT_BURST_MS',
  'pendingStartedAt',
  'burstExpired',
  'max burst snapshot',
  'lastSessionAnalysisAt',
  'booted=false',
  'online-warning',
  'Scientist send proceeding with profile warning',
  'BEST-EFFORT-MEDIUM',
  'async function safeDismissChatGptUi',
  'Твърде много заявки',
  'Разбрано',
  'RATE_LIMIT_BACKOFF_MS',
  'Scientist auto-dismissed safe ChatGPT rate-limit dialog',
  'Scientist respecting ChatGPT rate limit',
  'liveActivity',
  'lastResponsePreview',
  'currentMode',
  'SEND_ACK_MS',
  'MAX_SEND_ATTEMPTS',
  'async function userMessageCount',
  'async function waitForSendAck',
  'Scientist send acknowledged',
  'send-not-acknowledged',
  'inFlightObservation',
  'Autonomous Scientist analysis in flight',
  'GPT_WAIT_LIVE_REFRESH_MS',
  'gptWaitLiveRefreshedAt',
  'currentCdp9444Online:live.cdp9444Online',
  '.sf-scientist.lock',
  'function acquireSingleton',
  'if(!acquireSingleton())',
  'process.on("exit",releaseSingleton)',
  'rateLimitLiveRefreshedAt',
  'currentMode:live.mode',
  'status:"rate-limited"',
  'function compactThought',
  'lastThoughtSummary',
  'thoughtSummary',
  'summary=compactThought',
  'function materialSnapshotKey',
  'async function askFresh',
  'Scientist response captured but stale',
  'Scientist stale conclusion suppressed; refreshing',
  'staleResponseSuppressed',
  'responseContextStale',
  'lastToolKind:"POWERSHELL"',
  'lastToolStatus:"DONE"',
  'Scientist PowerShell requested',
  'Scientist tool action started',
  'kind:"tool-start"',
  'kind:"tool-finish"'
]) if(!side.includes(token)) throw new Error("Scientist sidecar invariant missing: "+token);

for(const token of [
  'effortPickerRegex',
  'GPT-5\\.6\\s*Sol',
  'cooldown-unconfirmed',
  'GPT-5.6 Sol Кратко',
  'async function findSolPicker',
  'still-short-after-medium-click',
  'pickerLabel'
]) if(!effort.includes(token)) throw new Error("ChatGPT effort controller invariant missing: "+token);

for(const token of [
  'SF_SCIENTIST_CHATGPT_PROFILE',
  'sf-scientist-sidecar.mjs',
  '[int]$Port = 9555',
  '[int]$DavidPort = 9444',
  'Existing DAVID architecture was not modified',
  '--disable-session-crashed-bubble',
  '--disable-features=msEdgeRestoreOnStartup'
]) if(!start.includes(token)) throw new Error("Scientist launcher invariant missing: "+token);

if(stop.includes("DAVID_CHATGPT_PROFILE")) throw new Error("Scientist stop must not target DAVID browser profile");
if(stop.includes("--remote-debugging-port=9444")) throw new Error("Scientist stop must not target DAVID CDP 9444");
for(const token of ['CloseMainWindow()', '.sf-scientist.lock']) if(!stop.includes(token))
  throw new Error("Scientist graceful-stop/singleton cleanup invariant missing: "+token);

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
  "CHAT | GPT-5.6 SOL | MEDIUM",
  "LIVE: ",
  "DAVID MODE: ",
  "UI RECOVERY: ",
  "GPT LIVE: ",
  "RATE LIMIT BACKOFF UNTIL: ",
  "IN FLIGHT: ",
  "SEND ACK: ",
  "SEND TRY: ",
  "$rp.summary",
  "$st.thoughtSummary",
  "$st.lastThoughtSummary",
  "LIVE ACTION / POWERSHELL",
  "$scientistAction",
  "STALE GPT RESPONSE: SUPPRESSED",
  "CONTEXT CHANGED -> stale GPT answer hidden",
  "$st.lastToolStatus",
  "$st.lastToolCommand",
  "$st.lastToolResult",
  "REALTIME SCIENTIST CONSOLE",
  "$scientistInnerMenu",
  "$scientistConsolePanel",
  "$scientistConsoleMenu",
  "Get-ScientistConsoleHistory",
  ".sf-scientist-operator.jsonl",
  "=== CURRENT ===",
  "=== RECENT ACTIVITY ===",
  "$st.lastToolStatus",
  "$st.lastToolCommand",
  "$st.lastToolResult",
  "PAGE 1 - CONTROL",
  "PAGE 2 - TASKS / ZADACHI",
  "DAVID TASKS - LIVE EDGE SESSIONS",
  "FOCUS SELECTED EDGE",
  "Start-ControlPanelPreviewWorker",
  "Update-TasksUi",
  ".david-control-panel-tasks.json",
  ".david-control-panel-command.json",
  "FormWindowState]::Maximized"
]) if(!center.includes(token)) throw new Error("Mode Center Scientist invariant missing: "+token);

for(const token of [
  'chromium.connectOverCDP',
  '.david-control-panel-tasks.json',
  '.david-control-panel-previews',
  'DAVID_CDP_URL',
  'SF_SCIENTIST_CDP_URL',
  'page.screenshot',
  'page.bringToFront',
  'action==="FOCUS"',
  'source==="DAVID"',
  'source==="SCIENTIST"'
]) if(!controlPreview.includes(token)) throw new Error("Control panel preview invariant missing: "+token);

if(/\.close\(\)/.test(controlPreview) && /Browser/.test(controlPreview))
  throw new Error("Control panel preview worker must not close external DAVID/Scientist browsers");

for(const forbidden of ["START_DAVID_ALL.ps1 -ForceRestart","DAVID_CHATGPT_TAB_TARGET=\"2\""]) {
  if(start.includes(forbidden)) throw new Error("Scientist launcher may not rewrite DAVID topology: "+forbidden);
}

console.log("SF_SCIENTIST_SIDECAR PASS david_architecture=UNCHANGED fullscreen_control_panel=ON page2_tasks=ON live_edge_previews=ON scientist_burger=ON realtime_console=ON stale_runtime_response=SUPPRESSED fresh_context=ON");

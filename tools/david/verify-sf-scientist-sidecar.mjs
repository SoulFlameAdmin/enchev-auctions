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
const matrix=read("DAVID_MATRIX_START.ps1");
const sendAck=read("tools/david/chatgpt-send-ack.mjs");
const app2Worker=read("tools/david/auto-complete-app2-v1.mjs");
const systemWorker=read("tools/david/auto-continue-enchev-v5.mjs");
const apkWorker=read("tools/david/auto-continue-david-apk-v1.mjs");
const designWorker=read("tools/david/auto-continue-design-v1.mjs");
const controlWorker=read("tools/david/auto-control-watchtower-v1.mjs");
const freeTalkWorker=read("tools/david/free-talk-session-v1.mjs");
const installerSync=read("tools/david/installer-client-registry-sync.mjs");
const installerHeartbeat=read("tools/david/david-installer-heartbeat.mjs");
const installerMigration=read("supabase/migrations/20260923011500_add_david_installer_clients_registry.sql");
const dualWorker=read("tools/david/dual-session-worker.mjs");
const operatingLaws=read("tools/david/DAVID_OPERATING_LAWS.md");

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
  'kind:"tool-finish"',
  '.sf-scientist-supervisor-command.json',
  '.sf-scientist-supervisor-result.json',
  'function scientistWatchdogAudit',
  'scientistAudit',
  'gpt-active-no-progress',
  'requestSupervisorAction',
  'DAVID_RECOVER',
  'DAVID_CLEAN_DUPLICATES',
  'All DAVID lifecycle recovery must use DAVID_RECOVER'
]) if(!side.includes(token)) throw new Error("Scientist sidecar invariant missing: "+token);

for(const token of [
  ".sf-scientist-supervisor-command.json",
  ".sf-scientist-supervisor-result.json",
  "executeScientistCommand",
  "controlActionProtected",
  "REJECTED: ",
  "pageShowsActiveWork"
]) if(!dualWorker.includes(token)) throw new Error("Unified Supervisor Scientist safety invariant missing: "+token);

for(const token of [
  "gpt-active-no-progress",
  "text-stall timer is advisory telemetry while ACTIVE is visible",
  "SF Scientist -> Supervisor recovery law",
  "must pass through the unified DAVID Supervisor"
]) if(!operatingLaws.includes(token)) throw new Error("DAVID active-response law invariant missing: "+token);

for(const [name,worker,token] of [
  ["SYSTEM",systemWorker,"gpt-active-no-progress"],
  ["DESIGN",designWorker,"design-active-no-progress"],
  ["APP2",app2Worker,"gpt-active-no-progress"],
  ["APK",apkWorker,"apk-active-no-progress"]
]) if(!worker.includes(token)) throw new Error(name+" active-response watchdog telemetry missing: "+token);

if(app2Worker.includes("async function forceStop")) throw new Error("APP2 must never own a forceStop recovery path");

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
  "DAVID TASKS - LIVE TOPOLOGY",
  "< BACK TO TASK MAP",
  "FOCUS REAL EDGE",
  "function Build-TaskGraph",
  "function Open-TaskDetail",
  "function Close-TaskDetail",
  "$taskGraph.Add_Paint",
  "LIVE CONNECTION",
  "Start-ControlPanelPreviewWorker",
  "Update-TasksUi",
  ".david-control-panel-tasks.json",
  ".david-control-panel-command.json",
  "FormWindowState]::Maximized",
  "$taskProgress",
  "DO KUDE E ZADACHATA",
  "GPT SEND ACK:",
  "GPT SEND STATUS:",
  "LAST VERIFIED SEND:",
  "LAST PROMPT PREVIEW:",
  "DavidModeCenterActivation",
  "FindWindow",
  "ShowWindowAsync",
  "SetForegroundWindow",
  "BringWindowToTop",
  "SetCurrentProcessExplicitAppUserModelID",
  '$form.ShowInTaskbar=$true',
  "$form.BringToFront()",
  "$form.Activate()",
  "CLICK MODE AGAIN TO RESTART",
  "INSTALLER CLIENTS",
  "CONNECTED:",
  "NO INSTALLER CLIENTS REGISTERED",
  "$installerClientsPanel",
  "$installerClientsList",
  "Update-InstallerClientsUi",
  "Start-InstallerClientsSync",
  "Stop-InstallerClientsSync",
  ".david-installer-clients.json",
  "Only authenticated DAVID Installer heartbeat clients appear here."
]) if(!center.includes(token)) throw new Error("Mode Center Scientist invariant missing: "+token);

for(const token of [
  'chromium.connectOverCDP',
  '.david-control-panel-tasks.json',
  'DAVID_CDP_URL',
  'SF_SCIENTIST_CDP_URL',
  'page.bringToFront',
  'action==="FOCUS"',
  'source==="DAVID"',
  'collect(scientistBrowser,"SCIENTIST",monitor)',
  'DAVID_ROLES',
  'STATE_FILE_BY_ROLE',
  'progressForRole',
  'lastSendAck',
  'lastSendStatus',
  'promptPreview',
  'previewKind:"disabled-task-status"',
  'working:false',
  'connections',
  'SAME_DAVID_RUNTIME',
  'SCIENTIST_OBSERVES_DAVID'
]) if(!controlPreview.includes(token)) throw new Error("Control panel preview invariant missing: "+token);

if(/\.close\(\)/.test(controlPreview) && /Browser/.test(controlPreview))
  throw new Error("Control panel preview worker must not close external DAVID/Scientist browsers");

if(controlPreview.includes("page.screenshot(") || controlPreview.includes("main.screenshot("))
  throw new Error("Task-status worker must not screenshot live Edge when box detail is status-only");

for(const token of [
  "sendPromptVerified",
  "user-count-increased",
  "latest-user-matches",
  "composer-cleared",
  "bounded_fallbacks=3",
  "duplicate_guard=ON"
]) if(!sendAck.includes(token)) throw new Error("Verified send-ack invariant missing: "+token);

for(const [name,worker] of [["APP2",app2Worker],["SYSTEM",systemWorker],["APK",apkWorker],["DESIGN",designWorker],["CONTROL",controlWorker],["FREE_TALK",freeTalkWorker]]){
  for(const token of [
    'from "./chatgpt-send-ack.mjs"',
    "lastSendAck",
    "lastSendStatus",
    "lastSendAttempt",
    "lastSendMethod",
    "lastSendSignal",
    "lastSendError"
  ]) if(!worker.includes(token)) throw new Error(name+" verified-send telemetry missing: "+token);
}

for(const token of [
  "david_installer_clients_snapshot",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "hardcoded_people=OFF",
  ".david-installer-clients.json"
]) if(!installerSync.includes(token)) throw new Error("Installer registry sync invariant missing: "+token);

for(const token of [
  "david_installer_heartbeat",
  "SOULFLAME_ACCESS_TOKEN",
  "DAVID_CLIENT_KEY",
  "authenticated_user=REQUIRED"
]) if(!installerHeartbeat.includes(token)) throw new Error("Installer heartbeat invariant missing: "+token);

for(const token of [
  "create table if not exists public.david_installer_clients",
  "enable row level security",
  "david_installer_clients_select_own",
  "create or replace function public.david_installer_heartbeat",
  "create or replace function public.david_installer_clients_snapshot",
  "grant execute on function public.david_installer_clients_snapshot() to anon, authenticated"
]) if(!installerMigration.includes(token)) throw new Error("Installer registry migration invariant missing: "+token);

if(!matrix.includes('-WindowStyle Hidden')) throw new Error("Mode Center launcher must hide its PowerShell console host");
if(matrix.includes('-WindowStyle Normal')) throw new Error("Mode Center launcher must not leave a visible selector PowerShell host");

for(const forbidden of ["START_DAVID_ALL.ps1 -ForceRestart","DAVID_CHATGPT_TAB_TARGET=\"2\""]) {
  if(start.includes(forbidden)) throw new Error("Scientist launcher may not rewrite DAVID topology: "+forbidden);
}

console.log("SF_SCIENTIST_SIDECAR PASS david_architecture=UNCHANGED active_response_lock=ON scientist_watchdog_audit=ON scientist_supervisor_recovery=ALLOWLISTED_AND_GUARDED installer_clients_panel=ON installer_registry=HEARTBEAT_ONLY hardcoded_people=OFF task_detail=STATUS_ONLY verified_gpt_send_ack=SYSTEM_DESIGN_APP2_APK_CONTROL_FREE_TALK scientist_panel=ON");

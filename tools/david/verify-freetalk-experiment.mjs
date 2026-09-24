import fs from "node:fs";
import path from "node:path";
const HERE=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,"$1"));
const ROOT=path.resolve(HERE,"..","..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const dual=read("tools/david/dual-session-worker.mjs");
const worker=read("tools/david/free-talk-session-v1.mjs");
const normal=read("START_DAVID_AUTONOMY.ps1");
const experiment=read("START_DAVID_EXPERIMENT_FREETALK.ps1");
const restart=read("RESTART_DAVID_EXPERIMENT_FREETALK_CLEAN.ps1");
const stop=read("STOP_DAVID_ALL_CLEAN.ps1");
const abOnly=read("START_DAVID_FREETALK_ONLY.ps1");
const abRestart=read("RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1");
const selector=read("DAVID_MODE_SELECTOR.ps1");
const selectorV2=read("DAVID_MODE_SELECTOR_V2.ps1");
const selectorCmd=read("DAVID_MODE_SELECTOR_V2.cmd");
const matrixMaster=read("DAVID_MATRIX_START.ps1");
const matrixCmd=read("DAVID_MATRIX_START.cmd");
const davidStart=read("DAVID_START.ps1");
const singleStart=read("START_DAVID_SINGLE.ps1");
const singleRestart=read("RESTART_DAVID_SINGLE_CLEAN.ps1");
for(const token of ["FREE_A","FREE_B","ACTIVE_EXPERIMENT_WORKERS","DAVID_FREE_A_MANAGED_V1","DAVID_FREE_B_MANAGED_V1","CONTROL_ENABLED"]) if(!dual.includes(token)) throw new Error("FREE TALK supervisor invariant missing: "+token);
for(const token of ["[DAVID_FREE_TALK_A_V1]","[DAVID_FREE_TALK_B_V1]","[DAVID_FREE_TALK_RELAY_V2 seq=","[DAVID_FREE_TALK_SEED_V2]","lastConsumedSeq","waitOnlyForActualGlobalBlock","waitForGlobalSendPermit","clickRateLimitAcknowledge","Разбрано","free-talk-rate-limit-resend","ensureInstantMode","Instant","INITIAL_CHAT_URL","RESUME_EXISTING","conversationLimitReached","rolloverConversation","rotateOwnedChatPage","browse/search","page.keyboard.insertText(text)"]) if(!worker.includes(token)) throw new Error("FREE TALK worker invariant missing: "+token);
for(const token of ['DAVID_ACTIVE_WORKERS = "SYSTEM,APP2,APK,FREE_A,FREE_B,CONTROL"','DAVID_CHATGPT_TAB_TARGET = "6"','FREE=2','ChatGPT=6','.david-free-talk-exchange.json','lastConsumedSeq = 0','instantMode = "pending"']) if(!experiment.includes(token)) throw new Error("FREE TALK launcher invariant missing: "+token);
for(const token of ['DAVID_ACTIVE_WORKERS = "SYSTEM,APP2,APK"','DAVID_CONTROL_ENABLED = "0"','DAVID_CHATGPT_TAB_TARGET = "3"','WATCH BACKGROUND','ChatGPT=3']) if(!normal.includes(token)) throw new Error("Normal AUTONOMY profile changed unexpectedly: "+token);
if(!restart.includes("STOP_DAVID_ALL_CLEAN.ps1")||!restart.includes("START_DAVID_EXPERIMENT_FREETALK.ps1")) throw new Error("FREE TALK restart is not atomic");
if(!stop.includes("free-talk-session-v1.mjs")) throw new Error("Clean stop does not own FREE TALK workers");
if(!stop.includes("david-freetalk-only-dashboard.ps1")) throw new Error("Clean stop does not own A+B-only dashboard");
for(const token of [
  'DAVID_ACTIVE_WORKERS="FREE_A,FREE_B"',
  'DAVID_CONTROL_ENABLED="0"',
  'DAVID_CHATGPT_TAB_TARGET="2"',
  '6ab08cb0-3738-83eb-b4bf-2ef8bf4933a8',
  '6ab08cab-006c-83eb-a753-2ea42567e22f',
  'DAVID_FREE_TALK_RESUME_EXISTING="1"',
  'DAVID_REQUIRE_FRESH_EDGE_ON_START="1"',
  'ChatGPT=2'
]) if(!abOnly.includes(token)) throw new Error("A+B-only mode invariant missing: "+token);
if(!abRestart.includes("STOP_DAVID_ALL_CLEAN.ps1")||!abRestart.includes("START_DAVID_FREETALK_ONLY.ps1")) throw new Error("A+B-only restart is not atomic");
for(const token of ["SOULFLAME SYSTEM","DAVID A + B","RESTART_DAVID_AUTONOMY_CLEAN.ps1","RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1","$Modes"]) if(!selector.includes(token)) throw new Error("Mode selector invariant missing: "+token);
for(const token of ["DAVID MODE CENTER V2.1","SOULFLAME SYSTEM","DAVID A + B","ENCHEV ONLY","DPP ONLY","DAVID APK ONLY","1 TAB / INSTANT","WATCH BACKGROUND","RESTART_DAVID_SINGLE_CLEAN.ps1","STOP ALL","PINNED SAME CHATS","REFRESH STATUS","RESTART_DAVID_AUTONOMY_CLEAN.ps1","RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1","STOP_DAVID_ALL_CLEAN.ps1","Start-Mode","FULL CLEAN RESTART","READY: CHOOSE MODE -> FULL CLEAN RESTART","Application]::DoEvents","PipelineStoppedException","-WindowStyle Hidden","Hide-OwnConsole","Close-OldDavidPowerShellWindows","GetConsoleWindow","ShowWindow","Global\\DAVID_MODE_CENTER_V2_SINGLETON","WaitOne(0)"]) if(!selectorV2.includes(token)) throw new Error("Mode selector V2 invariant missing: "+token);
if(selectorV2.includes('$SoulStart') || selectorV2.includes('$AbStart')) throw new Error("Matrix must never direct-start a mode; every selection must use clean restart");
for(const token of ["ENCHEV ONLY","DPP ONLY","DAVID APK ONLY","RESTART_DAVID_SINGLE_CLEAN.ps1","SOLO_SYSTEM","SOLO_DPP","SOLO_APK","1 TAB / INSTANT"]) if(!selectorV2.includes(token)) throw new Error("FAST SOLO selector invariant missing: "+token);
if(selectorV2.includes("System.Windows.Forms.Timer")) throw new Error("Mode selector V2 must not use WinForms Timer; it can trigger PipelineStoppedException/JIT dialogs");
if([...selectorV2].some(ch=>ch.charCodeAt(0)>127)) throw new Error("Mode selector V2 must remain ASCII-only for Windows PowerShell 5.1");
if(!normal.includes("-WindowStyle Hidden")) throw new Error("SYSTEM launcher/dashboard shells must be hidden");
if(!abOnly.includes("-WindowStyle Hidden")) throw new Error("A+B launcher/dashboard shells must be hidden");
for(const token of ["STOP FIRST","fetch origin","checkout $Branch","pull --ff-only","OPEN MATRIX VISIBLE OWN PROCESS","MATRIX READY","DAVID_MODE_SELECTOR_V2.ps1","Wait-OrchestrationMutex","Start-Process -FilePath $Pwsh","-WindowStyle Normal","launcher exits"]) if(!matrixMaster.includes(token)) throw new Error("Matrix master invariant missing: "+token);
if(!matrixMaster.includes("exit 0")) throw new Error("Matrix launcher must exit after spawning the own-process Mode Center");
if(!matrixCmd.includes("DAVID_MATRIX_START.ps1")) throw new Error("Matrix CMD launcher missing master script");
for(const token of ["DAVID_MATRIX_START.ps1","& $Master","param([int]$Port=9444)"]) if(!davidStart.includes(token)) throw new Error("PowerShell-only DAVID_START invariant missing: "+token);
if(!selectorCmd.includes("DAVID_MATRIX_START.ps1")) throw new Error("Legacy V2 CMD must route through Matrix master");
for(const token of ['DAVID_CHATGPT_TAB_TARGET="1"','DAVID_PROJECT_EFFORT_MODE="instant"','DAVID_COMPLETE_QUIET_MS="1200"','DAVID_COMPLETE_STABLE_SAMPLES="2"','DAVID_SEMANTIC_TERMINAL_QUIET_MS="2500"']) if(!singleStart.includes(token)) throw new Error("FAST SOLO invariant missing: "+token);
if(singleStart.includes("DAVID_GLOBAL_SEND_INTERVAL_MS")) throw new Error("FAST SOLO must preserve platform-safe global send pacing");
if(!singleRestart.includes("STOP_DAVID_ALL_CLEAN.ps1")||!singleRestart.includes("START_DAVID_SINGLE.ps1")||!singleRestart.includes("WaitOne(90000)")) throw new Error("FAST SOLO restart is not atomic");
console.log("DAVID_FREE_TALK_EXPERIMENT PASS normal_tabs=3 watch_background=ON solo_tabs=1 solo_modes=3 solo_instant=ON experiment_tabs=6 ab_only_tabs=2 persistent_chats=2 powershell_only_entry=ON matrix_visible=GUARANTEED center_own_process=ON center_singleton=HARD old_david_shell_cleanup=ON selector_console_hidden=ON selector_ascii=ON matrix_master=ON restart_first=ON update_before_choice=ON always_clean_restart_on_choice=ON fresh_edge=VERIFIED fast_solo_buttons=3 fast_solo_tabs=1 fast_solo_instant=ON fast_completion_detect=ON rate_limit_safety=PRESERVED selector_v2_1=STABLE no_timer=ON hidden_shells=ON live_status=ON stop_all=ON relay_dedupe=seq instant=FORCED rate_limit_auto_ack=ON rate_limit_auto_resume=ON same_tab_rollover=ON");

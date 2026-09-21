param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("SYSTEM","APP2","APK")]
  [string]$Worker,
  [int]$Port=9444
)
$ErrorActionPreference="Stop"
$Root="D:\ASI"
$Repo=Join-Path $Root "enchev-auctions"
$D=Join-Path $Repo "tools\david"
$Launcher=Join-Path $D "start-auto-continue.ps1"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

function G([string]$n,[string[]]$names=@("node.exe")){
  try{return @(Get-CimInstance Win32_Process|Where-Object{$names-contains([string]$_.Name).ToLowerInvariant()-and([string]$_.CommandLine)-like"*$n*"})}catch{return @()}
}
function CDP([int]$p){try{Invoke-RestMethod -Uri "http://127.0.0.1:$p/json/version" -TimeoutSec 2|Out-Null;return $true}catch{return $false}}
if(-not(Test-Path(Join-Path $Repo ".git"))){throw "Repo missing: $Repo"}
if(@(G "dual-session-worker.mjs").Count-gt 0){throw "DAVID already running. Use RESTART_DAVID_SINGLE_CLEAN.ps1."}

# One project worker + background WATCH/guard.
$env:DAVID_ACTIVE_WORKERS=$Worker
$env:DAVID_CONTROL_ENABLED="0"
$env:DAVID_CHATGPT_TAB_TARGET="1"
$env:DAVID_AUTONOMY_PROFILE=("SINGLE_"+$Worker)
$env:DAVID_DEDICATED_PROFILE="1"
$env:DAVID_PROJECT_EFFORT_MODE="instant"
$env:DAVID_REQUIRE_FRESH_EDGE_ON_START="1"

# FAST SOLO: detect completed replies quickly, while preserving real platform rate-limit handling.
$env:DAVID_POLL_MS="250"
$env:DAVID_APP2_POLL_MS="250"
$env:DAVID_APK_POLL_MS="250"
$env:DAVID_COOLDOWN_MS="300"
$env:DAVID_APP2_COOLDOWN_MS="300"
$env:DAVID_APK_COOLDOWN_MS="300"
$env:DAVID_COMPLETE_QUIET_MS="1200"
$env:DAVID_COMPLETE_STABLE_SAMPLES="2"
$env:DAVID_COMPLETE_SAMPLE_MS="350"
$env:DAVID_SEMANTIC_TERMINAL_QUIET_MS="2500"
$env:DAVID_GLOBAL_SEND_INTERVAL_MS="1500"

$args=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$Launcher,"-Port","$Port","-MaxTurns","2147483647")
Start-Process -FilePath $Pwsh -ArgumentList $args -WindowStyle Hidden

$ok=$false
$last="starting"
for($i=0;$i-lt 180;$i++){
  Start-Sleep -Seconds 1
  $sup=@(G "dual-session-worker.mjs").Count
  $sys=@(G "auto-continue-enchev-v5.mjs").Count
  $dpp=@(G "auto-complete-app2-v1.mjs").Count
  $apk=@(G "auto-continue-david-apk-v1.mjs").Count
  $ctrl=@(G "auto-control-watchtower-v1.mjs").Count
  $guard=@(G "connection-interruption-guard.mjs").Count
  $design=@(G "auto-continue-design-v1.mjs").Count
  $last="SUP=$sup SYSTEM=$sys DPP=$dpp APK=$apk CONTROL=$ctrl GUARD=$guard DESIGN=$design"

  $procOk=$false
  if($Worker-eq"SYSTEM"){$procOk=($sys-eq 1-and$dpp-eq 0-and$apk-eq 0)}
  elseif($Worker-eq"APP2"){$procOk=($sys-eq 0-and$dpp-eq 1-and$apk-eq 0)}
  elseif($Worker-eq"APK"){$procOk=($sys-eq 0-and$dpp-eq 0-and$apk-eq 1)}

  if($sup-eq 1-and$procOk-and$ctrl-eq 0-and$guard-eq 1-and$design-eq 0-and(CDP $Port)){
    $m=Join-Path $D ".david-tab-monitor.json"
    if(Test-Path $m){
      try{
        $t=Get-Content -Raw $m|ConvertFrom-Json
        $sc=@($t.managed.SYSTEM).Count
        $dc=@($t.managed.APP2).Count
        $kc=@($t.managed.APK).Count
        $cc=@($t.managed.CONTROL).Count
        $oneOk=$false
        if($Worker-eq"SYSTEM"){$oneOk=($sc-eq 1-and$dc-eq 0-and$kc-eq 0)}
        elseif($Worker-eq"APP2"){$oneOk=($sc-eq 0-and$dc-eq 1-and$kc-eq 0)}
        elseif($Worker-eq"APK"){$oneOk=($sc-eq 0-and$dc-eq 0-and$kc-eq 1)}
        if($oneOk-and$cc-eq 0-and[int]$t.totalChatGptTabs-eq 1){$ok=$true;break}
      }catch{}
    }
  }
}
if(-not$ok){throw "FAST SOLO health gate failed for $Worker: $last; expected exactly 1 project tab + WATCH background"}
$label=if($Worker-eq"SYSTEM"){"ENCHEV"}elseif($Worker-eq"APP2"){"DPP"}else{"DAVID APK"}
Write-Host ("[DAVID FAST SOLO] HEALTHY // {0} ONLY // Instant // WATCH BACKGROUND // ChatGPT=1" -f $label) -ForegroundColor Green

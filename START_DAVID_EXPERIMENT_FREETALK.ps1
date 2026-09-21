param([int]$Port=9444,[switch]$FreshSessions)
$ErrorActionPreference="Stop"
$Root="D:\ASI";$Repo=Join-Path $Root "enchev-auctions";$D=Join-Path $Repo "tools\david"
$Launcher=Join-Path $D "start-auto-continue.ps1";$Dashboard=Join-Path $D "david-freetalk-dashboard.ps1"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
function G([string]$n,[string[]]$names=@("node.exe")){try{return @(Get-CimInstance Win32_Process|Where-Object{$names-contains([string]$_.Name).ToLowerInvariant()-and([string]$_.CommandLine)-like"*$n*"})}catch{return @()}}
function CDP([int]$p){try{Invoke-RestMethod -Uri "http://127.0.0.1:$p/json/version" -TimeoutSec 2|Out-Null;return $true}catch{return $false}}
if(-not(Test-Path(Join-Path $Repo ".git"))){throw "Repo missing: $Repo"}
if(@(G "dual-session-worker.mjs").Count-gt 0){throw "DAVID already running. Use RESTART_DAVID_EXPERIMENT_FREETALK_CLEAN.ps1."}
$env:DAVID_ACTIVE_WORKERS = "SYSTEM,APP2,APK,FREE_A,FREE_B,CONTROL"
$env:DAVID_CHATGPT_TAB_TARGET = "6"
$env:DAVID_AUTONOMY_PROFILE = "SYSTEM_DPP_APK_FREETALK_AB"
$env:DAVID_DEDICATED_PROFILE = "1"
$a=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$Launcher,"-Port","$Port","-MaxTurns","2147483647");if($FreshSessions){$a+="-FreshSessions"}
Start-Process -FilePath $Pwsh -ArgumentList $a
$ok=$false;$last="starting"
for($i=0;$i-lt 180;$i++){
 Start-Sleep -Seconds 1
 $sup=@(G "dual-session-worker.mjs").Count;$sys=@(G "auto-continue-enchev-v5.mjs").Count;$dpp=@(G "auto-complete-app2-v1.mjs").Count;$apk=@(G "auto-continue-david-apk-v1.mjs").Count;$free=@(G "free-talk-session-v1.mjs").Count;$ctrl=@(G "auto-control-watchtower-v1.mjs").Count;$guard=@(G "connection-interruption-guard.mjs").Count;$design=@(G "auto-continue-design-v1.mjs").Count
 $last="SUP=$sup SYSTEM=$sys DPP=$dpp APK=$apk FREE=$free CONTROL=$ctrl GUARD=$guard DESIGN=$design"
 if($sup-eq 1-and$sys-eq 1-and$dpp-eq 1-and$apk-eq 1-and$free-eq 2-and$ctrl-eq 1-and$guard-eq 1-and$design-eq 0-and(CDP $Port)){
  $m=Join-Path $D ".david-tab-monitor.json";if(Test-Path $m){try{$t=Get-Content -Raw $m|ConvertFrom-Json;$cc=@($t.managed.CONTROL).Count;$sc=@($t.managed.SYSTEM).Count;$ac=@($t.managed.APP2).Count;$kc=@($t.managed.APK).Count;$fa=@($t.managed.FREE_A).Count;$fb=@($t.managed.FREE_B).Count;$dc=if($t.managed.PSObject.Properties.Name-contains"DESIGN"){@($t.managed.DESIGN).Count}else{0};if($cc-eq 1-and$sc-eq 1-and$ac-eq 1-and$kc-eq 1-and$fa-eq 1-and$fb-eq 1-and$dc-eq 0-and[int]$t.totalChatGptTabs-eq 6){$ok=$true;break}}catch{}}
 }
}
if(-not$ok){throw "FREE TALK experiment health gate failed: $last; expected DESIGN=0 FREE=2 ChatGPT=6"}
if(@(G "david-freetalk-dashboard.ps1" @("powershell.exe","pwsh.exe")).Count-eq 0){Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Dashboard)}
Write-Host "[DAVID EXPERIMENT] HEALTHY // CONTROL + SYSTEM + DPP + APK + FREE_A + FREE_B // DESIGN OFF // ChatGPT=6" -ForegroundColor Green

param([int]$Port=9444)
$ErrorActionPreference="Stop"
$Root="D:\ASI";$Repo=Join-Path $Root "enchev-auctions";$D=Join-Path $Repo "tools\david"
$Launcher=Join-Path $D "start-auto-continue.ps1";$Dashboard=Join-Path $D "david-freetalk-only-dashboard.ps1"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$FreeAUrl="https://chatgpt.com/c/6ab08cb0-3738-83eb-b4bf-2ef8bf4933a8"
$FreeBUrl="https://chatgpt.com/c/6ab08cab-006c-83eb-a753-2ea42567e22f"

function G([string]$n,[string[]]$names=@("node.exe")){try{return @(Get-CimInstance Win32_Process|Where-Object{$names-contains([string]$_.Name).ToLowerInvariant()-and([string]$_.CommandLine)-like"*$n*"})}catch{return @()}}
function CDP([int]$p){try{Invoke-RestMethod -Uri "http://127.0.0.1:$p/json/version" -TimeoutSec 2|Out-Null;return $true}catch{return $false}}
function Pin-FreeState([string]$Path,[string]$Role,[string]$Url){
  $st=$null
  if(Test-Path $Path){try{$st=Get-Content -Raw $Path|ConvertFrom-Json}catch{}}
  if($null-eq $st){$st=[pscustomobject]@{}}
  $pairs=@(
    @("version",1),@("role",$Role),@("chatUrl",$Url),@("pendingNewChat",$false),
    @("lastConsumedSeq",0),@("lastPublishedSeq",0),@("lastAssistantHash",$null),
    @("inflightKey",$null),@("inflightBaseHash",$null),@("justRolledOver",$false),
    @("instantMode","pending"),@("updatedAt",(Get-Date).ToUniversalTime().ToString("o")),
    @("lastAction","Persistent A+B mode selected; same ChatGPT conversation pinned")
  )
  foreach($pair in $pairs){
    $name=[string]$pair[0];$value=$pair[1]
    if($st.PSObject.Properties.Name -contains $name){$st.$name=$value}else{$st|Add-Member -NotePropertyName $name -NotePropertyValue $value}
  }
  $st|ConvertTo-Json -Depth 20|Set-Content -Encoding UTF8 $Path
}

if(-not(Test-Path(Join-Path $Repo ".git"))){throw "Repo missing: $Repo"}
if(@(G "dual-session-worker.mjs").Count-gt 0){throw "DAVID already running. Use RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1."}

# Relay transport resets on manual activation; remote ChatGPT conversation histories do not.
$exchange=Join-Path $D ".david-free-talk-exchange.json"
if(Test-Path $exchange){Remove-Item $exchange -Force -ErrorAction SilentlyContinue}
Pin-FreeState (Join-Path $D ".david-free-talk-a-state.json") "FREE_A" $FreeAUrl
Pin-FreeState (Join-Path $D ".david-free-talk-b-state.json") "FREE_B" $FreeBUrl

$env:DAVID_ACTIVE_WORKERS="FREE_A,FREE_B"
$env:DAVID_CONTROL_ENABLED="0"
$env:DAVID_CHATGPT_TAB_TARGET="2"
$env:DAVID_AUTONOMY_PROFILE="FREE_TALK_AB_ONLY"
$env:DAVID_DEDICATED_PROFILE="1"
$env:DAVID_FREE_A_CHAT_URL=$FreeAUrl
$env:DAVID_FREE_B_CHAT_URL=$FreeBUrl
$env:DAVID_FREE_TALK_RESUME_EXISTING="1"
$env:DAVID_FREE_TALK_POLL_MS="250"
$env:DAVID_FREE_TALK_QUIET_MS="700"

Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Launcher,"-Port","$Port","-MaxTurns","2147483647")

$ok=$false;$last="starting"
for($i=0;$i-lt 180;$i++){
 Start-Sleep -Seconds 1
 $sup=@(G "dual-session-worker.mjs").Count;$free=@(G "free-talk-session-v1.mjs").Count;$guard=@(G "connection-interruption-guard.mjs").Count
 $sys=@(G "auto-continue-enchev-v5.mjs").Count;$dpp=@(G "auto-complete-app2-v1.mjs").Count;$apk=@(G "auto-continue-david-apk-v1.mjs").Count;$ctrl=@(G "auto-control-watchtower-v1.mjs").Count;$design=@(G "auto-continue-design-v1.mjs").Count
 $last="SUP=$sup FREE=$free GUARD=$guard SYSTEM=$sys DPP=$dpp APK=$apk CONTROL=$ctrl DESIGN=$design"
 if($sup-eq 1-and$free-eq 2-and$guard-eq 1-and$sys-eq 0-and$dpp-eq 0-and$apk-eq 0-and$ctrl-eq 0-and$design-eq 0-and(CDP $Port)){
  $m=Join-Path $D ".david-tab-monitor.json"
  if(Test-Path $m){try{$t=Get-Content -Raw $m|ConvertFrom-Json;$fa=@($t.managed.FREE_A).Count;$fb=@($t.managed.FREE_B).Count;if($fa-eq 1-and$fb-eq 1-and[int]$t.totalChatGptTabs-eq 2){$ok=$true;break}}catch{}}
 }
}
if(-not$ok){throw "A+B ONLY health gate failed: $last; expected FREE=2 CONTROL=0 project=0 ChatGPT=2"}
if(@(G "david-freetalk-only-dashboard.ps1" @("powershell.exe","pwsh.exe")).Count-eq 0){Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Dashboard)}
Write-Host "[DAVID A+B] HEALTHY // persistent conversations // FREE_A + FREE_B // ChatGPT=2" -ForegroundColor Green
Write-Host "[DAVID A+B] A=$FreeAUrl" -ForegroundColor DarkCyan
Write-Host "[DAVID A+B] B=$FreeBUrl" -ForegroundColor DarkCyan

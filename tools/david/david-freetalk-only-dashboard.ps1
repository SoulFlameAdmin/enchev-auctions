$ErrorActionPreference="SilentlyContinue"
$D="D:\ASI\enchev-auctions\tools\david"
function J($p){try{Get-Content -Raw $p|ConvertFrom-Json}catch{$null}}
function C([string]$n){try{return @(Get-CimInstance Win32_Process|Where-Object{$_.Name-eq"node.exe"-and([string]$_.CommandLine)-like"*$n*"}).Count}catch{return 0}}
try{$Host.UI.RawUI.WindowTitle="DAVID A + B // PERSISTENT FREE TALK"}catch{}
while($true){
 Clear-Host
 Write-Host "============================================================" -ForegroundColor DarkCyan
 Write-Host " DAVID A + B // SAME CONVERSATIONS // INSTANT" -ForegroundColor Cyan
 Write-Host "============================================================" -ForegroundColor DarkCyan
 foreach($item in @(@("FREE_A",".david-free-talk-a-state.json"),@("FREE_B",".david-free-talk-b-state.json"))){
   $s=J(Join-Path $D $item[1]);$w=if($s){[string]$s.watchdog}else{"NO STATE"};$a=if($s){[string]$s.lastAction}else{"-"};$u=if($s){[string]$s.chatUrl}else{"-"}
   Write-Host ("{0,-8} {1,-28} {2}"-f $item[0],$w,$a)
   Write-Host ("         {0}"-f $u) -ForegroundColor DarkGray
 }
 $x=J(Join-Path $D ".david-free-talk-exchange.json")
 if($x){Write-Host ("EXCHANGE seq={0} speaker={1} updated={2}"-f $x.seq,$x.lastSpeaker,$x.updatedAt) -ForegroundColor Yellow}else{Write-Host "EXCHANGE waiting for FREE_A first turn..." -ForegroundColor Yellow}
 $t=J(Join-Path $D ".david-tab-monitor.json")
 if($t){$fa=@($t.managed.FREE_A).Count;$fb=@($t.managed.FREE_B).Count;$ok=([int]$t.totalChatGptTabs-eq 2-and$fa-eq 1-and$fb-eq 1);Write-Host ("TABS TOTAL={0}/2 FREE_A={1} FREE_B={2} => {3}"-f $t.totalChatGptTabs,$fa,$fb,$(if($ok){"STABLE"}else{"CHECK"})) -ForegroundColor $(if($ok){"Green"}else{"Red"})}
 Write-Host ("PROC SUP={0} FREE={1} GUARD={2}"-f (C "dual-session-worker.mjs"),(C "free-talk-session-v1.mjs"),(C "connection-interruption-guard.mjs"))
 Start-Sleep -Seconds 2
}

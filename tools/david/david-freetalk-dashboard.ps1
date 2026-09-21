$ErrorActionPreference="SilentlyContinue"
$D="D:\ASI\enchev-auctions\tools\david"
function J($p){try{Get-Content -Raw $p|ConvertFrom-Json}catch{$null}}
function C([string]$n){try{return @(Get-CimInstance Win32_Process|Where-Object{$_.Name-eq"node.exe"-and([string]$_.CommandLine)-like"*$n*"}).Count}catch{return 0}}
function S($n){switch($n){"SYSTEM"{J(Join-Path $D ".david-enchev-state.json")}"APP2"{J(Join-Path $D ".david-app2-state-6aac2dbb.json")}"APK"{J(Join-Path $D ".david-apk-state.json")}"FREE_A"{J(Join-Path $D ".david-free-talk-a-state.json")}"FREE_B"{J(Join-Path $D ".david-free-talk-b-state.json")}"CONTROL"{J(Join-Path $D ".david-control-state.json")}}}
try{$Host.UI.RawUI.WindowTitle="DAVID EXPERIMENT // FREE TALK A <-> B"}catch{}
while($true){
 Clear-Host
 Write-Host "============================================================" -ForegroundColor DarkCyan
 Write-Host " DAVID EXPERIMENT // FREE TALK A <-> B // 6 GPT TABS" -ForegroundColor Cyan
 Write-Host "============================================================" -ForegroundColor DarkCyan
 foreach($n in @("CONTROL","SYSTEM","APP2","APK","FREE_A","FREE_B")){$s=S $n;$w=if($s){[string]$s.watchdog}else{"NO STATE"};$a=if($s){[string]$s.lastAction}else{"-"};Write-Host ("{0,-8} {1,-28} {2}"-f $n,$w,$a)}
 $x=J(Join-Path $D ".david-free-talk-exchange.json")
 if($x){Write-Host ("EXCHANGE seq={0} speaker={1} updated={2}"-f $x.seq,$x.lastSpeaker,$x.updatedAt) -ForegroundColor Yellow}
 $t=J(Join-Path $D ".david-tab-monitor.json")
 if($t){$fa=@($t.managed.FREE_A).Count;$fb=@($t.managed.FREE_B).Count;Write-Host ("TABS TOTAL={0}/6 FREE_A={1} FREE_B={2}"-f $t.totalChatGptTabs,$fa,$fb) -ForegroundColor $(if([int]$t.totalChatGptTabs-eq 6-and$fa-eq 1-and$fb-eq 1){"Green"}else{"Red"})}
 Write-Host ("PROC SUP={0} FREE={1} GUARD={2}"-f (C "dual-session-worker.mjs"),(C "free-talk-session-v1.mjs"),(C "connection-interruption-guard.mjs"))
 Start-Sleep -Seconds 2
}

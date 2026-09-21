param([int]$RefreshSeconds=3,[string]$Root="D:\ASI")
$ErrorActionPreference="SilentlyContinue"
$Repo=Join-Path $Root "enchev-auctions"
$DavidDir=Join-Path $Repo "tools\david"
function J([string]$p){try{if(Test-Path $p){return Get-Content -Raw $p|ConvertFrom-Json}}catch{};return $null}
function C([string]$n,[string[]]$names=@("node.exe")){try{return @(Get-CimInstance Win32_Process|Where-Object{$names-contains([string]$_.Name).ToLowerInvariant()-and([string]$_.CommandLine)-like "*$n*"}).Count}catch{return 0}}
function S([string]$n){switch($n){"SYSTEM"{J(Join-Path $DavidDir ".david-enchev-state.json")}"APP2"{J(Join-Path $DavidDir ".david-app2-state-6aac2dbb.json")}"APK"{J(Join-Path $DavidDir ".david-apk-state.json")}"CONTROL"{J(Join-Path $DavidDir ".david-control-state.json")}}}
try{$Host.UI.RawUI.WindowTitle="DAVID AUTONOMY // SYSTEM + DPP + APK"}catch{}
while($true){
 Clear-Host
 $t=J(Join-Path $DavidDir ".david-tab-monitor.json")
 Write-Host "============================================================" -ForegroundColor DarkGreen
 Write-Host " DAVID AUTONOMY // SYSTEM + DPP + APK // DESIGN OFF" -ForegroundColor Green
 Write-Host "============================================================" -ForegroundColor DarkGreen
 foreach($n in @("SYSTEM","APP2","APK")){$s=S $n;$w=if($s){[string]$s.watchdog}else{"NO STATE"};$a=if($s){[string]$s.lastAction}else{"-"};Write-Host ("{0,-8} {1,-30} {2}"-f $n,$w,$a) -ForegroundColor Cyan}
 if($t -and $t.managed){
  $cc=@($t.managed.CONTROL).Count;$sc=@($t.managed.SYSTEM).Count;$ac=@($t.managed.APP2).Count;$kc=@($t.managed.APK).Count
  $dc=if($t.managed.PSObject.Properties.Name -contains "DESIGN"){@($t.managed.DESIGN).Count}else{0}
  $ok=($cc-eq 0 -and $sc-eq 1 -and $ac-eq 1 -and $kc-eq 1 -and $dc-eq 0 -and [int]$t.totalChatGptTabs-eq 3)
  Write-Host ("TABS ENCHEV={0} DPP={1} APK={2} CTRL_TAB={3} DESIGN={4} TOTAL={5} => {6}"-f $sc,$ac,$kc,$cc,$dc,$t.totalChatGptTabs,$(if($ok){"STABLE"}else{"CHECK"})) -ForegroundColor $(if($ok){"Green"}else{"Red"})
 }
 $p=[ordered]@{SUP=C "dual-session-worker.mjs";SYS=C "auto-continue-enchev-v5.mjs";DPP=C "auto-complete-app2-v1.mjs";APK=C "auto-continue-david-apk-v1.mjs";CTRL=C "auto-control-watchtower-v1.mjs";GUARD=C "connection-interruption-guard.mjs";DESIGN=C "auto-continue-design-v1.mjs"}
 Write-Host ("PROC SUP={0} SYS={1} DPP={2} APK={3} CTRL={4} GUARD={5} DESIGN={6}"-f $p.SUP,$p.SYS,$p.DPP,$p.APK,$p.CTRL,$p.GUARD,$p.DESIGN) -ForegroundColor Green; Write-Host ("WATCH BACKGROUND={0}" -f $(if($p.SUP-eq 1-and$p.GUARD-eq 1){"ON"}else{"CHECK"})) -ForegroundColor Cyan
 Write-Host "ACTIVE GPT=>WAIT | TRY AGAIN=>GUARD | RATE LIMIT=>GLOBAL WAIT | CAPTCHA/MFA/LOGIN=>HUMAN" -ForegroundColor Yellow
 Start-Sleep -Seconds ([math]::Max(1,$RefreshSeconds))
}

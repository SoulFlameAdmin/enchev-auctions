param([int]$Port=9555)
$ErrorActionPreference="SilentlyContinue"
$Root=if(Test-Path "D:\ASI"){"D:\ASI"}else{Join-Path $env:LOCALAPPDATA "DAVID"}
$ProfileDir=Join-Path $Root "SF_SCIENTIST_CHATGPT_PROFILE"
function Stop-Tree([int]$Id){
  $children=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$_.ParentProcessId-eq$Id})
  foreach($c in $children){Stop-Tree ([int]$c.ProcessId)}
  Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
}
$workers=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$_.Name-eq"node.exe"-and([string]$_.CommandLine)-like"*sf-scientist-sidecar.mjs*"})
foreach($p in $workers){Stop-Tree ([int]$p.ProcessId)}
$browsers=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{($_.Name-match'(?i)msedge|chrome|brave')-and((([string]$_.CommandLine)-like("*"+$ProfileDir+"*"))-or(([string]$_.CommandLine)-like("*--remote-debugging-port="+$Port+"*")))})

# Graceful browser close first, to avoid "restore pages / browser closed unexpectedly".
$mainBrowser=$browsers|Where-Object{([string]$_.CommandLine)-like("*--remote-debugging-port="+$Port+"*")}|Select-Object -First 1
if($mainBrowser){
  try{
    $gp=Get-Process -Id ([int]$mainBrowser.ProcessId) -ErrorAction SilentlyContinue
    if($gp){$null=$gp.CloseMainWindow()}
  }catch{}
  Start-Sleep -Seconds 2
}

# Force-stop only leftovers belonging to the Scientist profile/port.
$browsers=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{($_.Name-match'(?i)msedge|chrome|brave')-and((([string]$_.CommandLine)-like("*"+$ProfileDir+"*"))-or(([string]$_.CommandLine)-like("*--remote-debugging-port="+$Port+"*")))})
foreach($p in $browsers){Stop-Tree ([int]$p.ProcessId)}

$LockFile=Join-Path (Join-Path $Root "enchev-auctions\tools\david") ".sf-scientist.lock"
if(Test-Path $LockFile){Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue}

Write-Host "[SF SCIENTIST] STOPPED // DAVID stack untouched // profile/login/state preserved." -ForegroundColor Green

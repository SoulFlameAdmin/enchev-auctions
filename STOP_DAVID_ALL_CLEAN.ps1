param(
  [int]$Port = 9444
)

$ErrorActionPreference = "SilentlyContinue"
$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$ProfileDir = Join-Path $Root "DAVID_CHATGPT_PROFILE"
$DavidDir = Join-Path $Repo "tools\david"

Write-Host "" 
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host " DAVID CLEAN SHUTDOWN" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGreen

$workerPatterns = @(
  "dual-session-worker.mjs",
  "auto-continue-enchev-v5.mjs",
  "auto-continue-design-v1.mjs",
  "auto-continue-david-apk-v1.mjs",
  "connection-interruption-guard.mjs",
  "start-auto-continue.ps1",
  "start-app2-autopilot.ps1",
  ".auto-complete-app2-runtime.mjs",
  "auto-complete-app2-v1.mjs",
  "david-status-dashboard.ps1"
)

$all = @(Get-CimInstance Win32_Process)

$workers = @($all | Where-Object {
  $cmd = [string]$_.CommandLine
  if (-not $cmd) { return $false }
  foreach ($pat in $workerPatterns) {
    if ($cmd -like "*$pat*") { return $true }
  }
  return $false
})

foreach ($p in $workers) {
  Write-Host ("[STOP] worker pid={0} name={1}" -f $p.ProcessId,$p.Name) -ForegroundColor Yellow
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

$all = @(Get-CimInstance Win32_Process)
$davidBrowsers = @($all | Where-Object {
  $cmd = [string]$_.CommandLine
  if (-not $cmd) { return $false }
  (($cmd -like "*--remote-debugging-port=$Port*") -or
   ($cmd -like "*$ProfileDir*")) -and
  ($_.Name -match '(?i)msedge|chrome|brave')
})

foreach ($p in $davidBrowsers) {
  Write-Host ("[STOP] DAVID browser pid={0} name={1}" -f $p.ProcessId,$p.Name) -ForegroundColor Yellow
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

for ($i=0; $i -lt 20; $i++) {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 1 | Out-Null
    Start-Sleep -Milliseconds 500
  }
  catch { break }
}

$runtime = Join-Path $DavidDir ".auto-complete-app2-runtime.mjs"
if (Test-Path $runtime) {
  Remove-Item $runtime -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "[STOP] DAVID workers: OFF" -ForegroundColor Red
Write-Host "[STOP] DAVID Edge/CDP ${Port}: OFF" -ForegroundColor Red
Write-Host "[STOP] Profile/login/state preserved." -ForegroundColor Green
Write-Host "[STOP] No DAVID project state was deleted." -ForegroundColor Green

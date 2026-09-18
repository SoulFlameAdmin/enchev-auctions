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

function Get-ManagedWorkers {
  $all = @(Get-CimInstance Win32_Process)
  return @($all | Where-Object {
    if ($_.ProcessId -eq $PID) { return $false }
    $cmd = [string]$_.CommandLine
    if (-not $cmd) { return $false }
    foreach ($pat in $workerPatterns) {
      if ($cmd -like "*$pat*") { return $true }
    }
    return $false
  })
}

function Get-DavidBrowsers {
  $all = @(Get-CimInstance Win32_Process)
  return @($all | Where-Object {
    $cmd = [string]$_.CommandLine
    if (-not $cmd) { return $false }
    (($cmd -like "*--remote-debugging-port=$Port*") -or
     ($cmd -like "*$ProfileDir*")) -and
    ($_.Name -match '(?i)msedge|chrome|brave')
  })
}

for ($pass = 1; $pass -le 5; $pass++) {
  $workers = @(Get-ManagedWorkers)
  if ($workers.Count -eq 0) { break }
  Write-Host ("[STOP] worker cleanup pass {0}: {1} process(es)" -f $pass,$workers.Count) -ForegroundColor DarkYellow
  foreach ($p in $workers) {
    Write-Host ("[STOP] worker pid={0} name={1}" -f $p.ProcessId,$p.Name) -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 900
}

for ($pass = 1; $pass -le 5; $pass++) {
  $davidBrowsers = @(Get-DavidBrowsers)
  if ($davidBrowsers.Count -eq 0) { break }
  Write-Host ("[STOP] browser cleanup pass {0}: {1} process(es)" -f $pass,$davidBrowsers.Count) -ForegroundColor DarkYellow
  foreach ($p in $davidBrowsers) {
    Write-Host ("[STOP] DAVID browser pid={0} name={1}" -f $p.ProcessId,$p.Name) -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 900
}

$remainingWorkers = @(Get-ManagedWorkers)
if ($remainingWorkers.Count -gt 0) {
  throw "Clean shutdown failed: $($remainingWorkers.Count) managed DAVID worker process(es) are still alive."
}

$cdpStillUp = $false
for ($i=0; $i -lt 20; $i++) {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 1 | Out-Null
    $cdpStillUp = $true
    Start-Sleep -Milliseconds 500
  }
  catch {
    $cdpStillUp = $false
    break
  }
}
if ($cdpStillUp) {
  throw "Clean shutdown failed: DAVID CDP port $Port is still reachable."
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

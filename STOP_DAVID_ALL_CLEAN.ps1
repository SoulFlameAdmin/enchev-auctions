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
  "auto-control-watchtower-v1.mjs",
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

function Stop-ProcessTree {
  param([int]$Id)
  $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
  if (Test-Path $taskkill) {
    & $taskkill /PID $Id /T /F *> $null
  } else {
    Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
  }
}

function Get-RootProcesses {
  param([object[]]$Processes)
  $ids = @{}
  foreach ($p in $Processes) { $ids[[int]$p.ProcessId] = $true }
  return @($Processes | Where-Object { -not $ids.ContainsKey([int]$_.ParentProcessId) })
}

for ($pass = 1; $pass -le 8; $pass++) {
  $workers = @(Get-ManagedWorkers)
  if ($workers.Count -eq 0) { break }
  $roots = @(Get-RootProcesses -Processes $workers)
  Write-Host ("[STOP] worker cleanup pass {0}: {1} process(es), {2} root tree(s)" -f $pass,$workers.Count,$roots.Count) -ForegroundColor DarkYellow
  foreach ($p in $roots) {
    Write-Host ("[STOP] worker tree root pid={0} name={1}" -f $p.ProcessId,$p.Name) -ForegroundColor Yellow
    Stop-ProcessTree -Id ([int]$p.ProcessId)
  }
  Start-Sleep -Seconds 1
}

for ($pass = 1; $pass -le 8; $pass++) {
  $davidBrowsers = @(Get-DavidBrowsers)
  if ($davidBrowsers.Count -eq 0) { break }
  $roots = @(Get-RootProcesses -Processes $davidBrowsers)
  Write-Host ("[STOP] browser cleanup pass {0}: {1} process(es), {2} root tree(s)" -f $pass,$davidBrowsers.Count,$roots.Count) -ForegroundColor DarkYellow
  foreach ($p in $roots) {
    Write-Host ("[STOP] DAVID browser tree root pid={0} name={1}" -f $p.ProcessId,$p.Name) -ForegroundColor Yellow
    Stop-ProcessTree -Id ([int]$p.ProcessId)
  }
  Start-Sleep -Seconds 1
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

foreach ($ephemeral in @(
  (Join-Path $DavidDir ".david-control-command.json"),
  (Join-Path $DavidDir ".david-control-result.json"),
  (Join-Path $DavidDir ".david-tab-monitor.json")
)) {
  if (Test-Path $ephemeral) {
    Remove-Item $ephemeral -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "[STOP] DAVID workers: OFF" -ForegroundColor Red
Write-Host "[STOP] DAVID Edge/CDP ${Port}: OFF" -ForegroundColor Red
Write-Host "[STOP] Profile/login/state preserved." -ForegroundColor Green
Write-Host "[STOP] No DAVID project state was deleted." -ForegroundColor Green

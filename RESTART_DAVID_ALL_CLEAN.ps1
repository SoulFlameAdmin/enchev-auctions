param(
  [int]$Port = 9444,
  [switch]$FreshSessions
)

$ErrorActionPreference = "Stop"
$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$Git = Join-Path $Root "tools\PortableGit\cmd\git.exe"
$Pwsh = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Stop = Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$Start = Join-Path $Repo "START_DAVID_ALL.ps1"

$MutexName = "Global\DAVID_ORCHESTRATION_V1"
$Mutex = New-Object System.Threading.Mutex($false, $MutexName)
$MutexAcquired = $false
try {
  try { $MutexAcquired = $Mutex.WaitOne(0) }
  catch [System.Threading.AbandonedMutexException] { $MutexAcquired = $true }
  if (-not $MutexAcquired) {
    throw "Another DAVID START/RESTART operation is already running. Wait for it to finish; parallel orchestration is forbidden."
  }
  $env:DAVID_ORCHESTRATION_LOCK_HELD = "1"

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host " DAVID CLEAN RESTART // FULL STACK" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGreen

if (-not (Test-Path $Git)) { throw "PortableGit not found: $Git" }
if (-not (Test-Path (Join-Path $Repo ".git"))) { throw "Repo not found: $Repo" }

Write-Host "[RESTART] Pulling latest DAVID code..." -ForegroundColor Cyan
& $Git -C $Repo pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "git pull failed with exit code $LASTEXITCODE" }

if (-not (Test-Path $Stop)) { throw "Stop script not found after pull: $Stop" }

Write-Host "[RESTART] Stopping all managed DAVID processes..." -ForegroundColor Cyan
& $Pwsh -NoProfile -ExecutionPolicy Bypass -File $Stop -Port $Port
if ($LASTEXITCODE -ne 0) { throw "DAVID clean shutdown failed with exit code $LASTEXITCODE. Start aborted." }

Start-Sleep -Seconds 3

Write-Host "[RESTART] Starting clean DAVID stack..." -ForegroundColor Cyan
$startArgs = @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Start,"-Port","$Port")
if ($FreshSessions) {
  $startArgs += "-FreshSessions"
  Write-Host "[RESTART] FRESH SESSION MODE: all 5 DAVID GPT workers will start in new chats; project state/login are preserved." -ForegroundColor Magenta
}
& $Pwsh @startArgs
if ($LASTEXITCODE -ne 0) { throw "DAVID clean start failed with exit code $LASTEXITCODE." }

Write-Host ""
Write-Host "[RESTART] DAVID clean restart launched." -ForegroundColor Green
Write-Host "[RESTART] Expected: CONTROL + SYSTEM + DESIGN PROCESS 2 + APP2/DPP + APK + MATRIX." -ForegroundColor Green
Write-Host "[RESTART] APK continues from saved state/session and keeps upgrading with GPT." -ForegroundColor Green
Write-Host "[RESTART] Profile/login/project state preserved." -ForegroundColor Green
if ($FreshSessions) {
  Write-Host "[RESTART] Old GPT conversation URLs were not reused for this boot; 5 fresh managed chats were requested." -ForegroundColor Green
}
}
finally {
  Remove-Item Env:DAVID_ORCHESTRATION_LOCK_HELD -ErrorAction SilentlyContinue
  if ($MutexAcquired) {
    try { $Mutex.ReleaseMutex() | Out-Null } catch {}
  }
  try { $Mutex.Dispose() } catch {}
}

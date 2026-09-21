param(
  [int]$Port = 9444,
  [switch]$FreshSessions
)

$ErrorActionPreference = "Stop"

$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$StopScript = Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$StartScript = Join-Path $Repo "START_DAVID_AUTONOMY.ps1"
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$Mutex = New-Object System.Threading.Mutex($false, "Global\DAVID_AUTONOMY_ORCHESTRATION_V1")
$OwnsMutex = $false

try {
  try {
    $OwnsMutex = $Mutex.WaitOne(0)
  }
  catch [System.Threading.AbandonedMutexException] {
    $OwnsMutex = $true
  }

  if (-not $OwnsMutex) {
    Write-Host "[AUTONOMY] Another restart is already running. Waiting up to 90s before restart-first continues..." -ForegroundColor Yellow
    try {
      $OwnsMutex = $Mutex.WaitOne(90000)
    }
    catch [System.Threading.AbandonedMutexException] {
      $OwnsMutex = $true
    }
  }

  if (-not $OwnsMutex) {
    throw "Another DAVID AUTONOMY start/restart operation is still running after 90 seconds."
  }

  if (-not (Test-Path $StopScript)) {
    throw "Missing clean stop script: $StopScript"
  }
  if (-not (Test-Path $StartScript)) {
    throw "Missing AUTONOMY start script: $StartScript"
  }

  Write-Host "[AUTONOMY] Clean stop of old DAVID stack..." -ForegroundColor Cyan
  & $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $StopScript -Port $Port
  if ($LASTEXITCODE -ne 0) {
    throw "Clean stop failed with exit code $LASTEXITCODE."
  }

  Start-Sleep -Seconds 2

  Write-Host "[AUTONOMY] Starting SYSTEM + DPP/APP2 + APK + CONTROL..." -ForegroundColor Cyan
  $StartArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $StartScript,
    "-Port", "$Port"
  )
  if ($FreshSessions) {
    $StartArgs += "-FreshSessions"
  }

  & $PowerShellExe @StartArgs
  if ($LASTEXITCODE -ne 0) {
    throw "AUTONOMY start failed with exit code $LASTEXITCODE."
  }

  Write-Host "[AUTONOMY] Atomic restart complete. DESIGN remains OFF." -ForegroundColor Green
}
finally {
  if ($OwnsMutex) {
    try { $Mutex.ReleaseMutex() | Out-Null } catch {}
  }
  try { $Mutex.Dispose() } catch {}
}

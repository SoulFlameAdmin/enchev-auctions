param(
  [int]$Port = 9444
)

$ErrorActionPreference = "Stop"
$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$Git = Join-Path $Root "tools\PortableGit\cmd\git.exe"
$Pwsh = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Stop = Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$Start = Join-Path $Repo "START_DAVID_ALL.ps1"

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

Start-Sleep -Seconds 3

Write-Host "[RESTART] Starting clean DAVID stack..." -ForegroundColor Cyan
& $Pwsh -NoProfile -ExecutionPolicy Bypass -File $Start -Port $Port

Write-Host ""
Write-Host "[RESTART] DAVID clean restart launched." -ForegroundColor Green
Write-Host "[RESTART] Expected: SYSTEM + DESIGN + APP2/DPP + APK + MATRIX." -ForegroundColor Green
Write-Host "[RESTART] APK continues from saved state/session and keeps upgrading with GPT." -ForegroundColor Green
Write-Host "[RESTART] Profile/login/session state preserved." -ForegroundColor Green

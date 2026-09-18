param(
  [int]$Port = 9444,
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"
$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$PortableGit = Join-Path $Root "tools\PortableGit\cmd\git.exe"
$PortableGitDir = Join-Path $Root "tools\PortableGit"
$PortableNode = Join-Path $Root "tools\node"

if (Test-Path $PortableGitDir) { $env:Path = "$PortableGitDir\cmd;$PortableGitDir\bin;$env:Path" }
if (Test-Path $PortableNode) { $env:Path = "$PortableNode;$env:Path" }

function Test-CommandLineMatch {
  param([string[]]$Needles)
  try {
    foreach ($p in Get-CimInstance Win32_Process) {
      $cmd = [string]$p.CommandLine
      if (-not $cmd) { continue }
      $all = $true
      foreach ($n in $Needles) {
        if ($cmd -notlike "*$n*") { $all = $false; break }
      }
      if ($all) { return $true }
    }
  } catch {}
  return $false
}

if (-not (Test-Path (Join-Path $Repo ".git"))) {
  throw "Repository not found at $Repo. Run BOOTSTRAP_DAVID_ENCHEV.ps1 first."
}

$git = if (Test-Path $PortableGit) { $PortableGit } else {
  $g = Get-Command git -ErrorAction SilentlyContinue
  if (-not $g) { throw "Git not found." }
  $g.Source
}

$beforeHead = (& $git -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
Write-Host "[DAVID ALL] Updating orchestrator..." -ForegroundColor Cyan
& $git -C $Repo pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "git pull failed with exit code $LASTEXITCODE" }
$afterHead = (& $git -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
$codeUpdated = $ForceRestart -or ($beforeHead -and $afterHead -and $beforeHead -ne $afterHead)

if ($codeUpdated) {
  Write-Host "[DAVID ALL] New worker code detected. Restarting managed DAVID workers once..." -ForegroundColor Yellow
  $patterns = @(
    "dual-session-worker.mjs",
    "start-auto-continue.ps1",
    "start-app2-autopilot.ps1",
    ".auto-complete-app2-runtime.mjs",
    "auto-complete-app2-v1.mjs",
    "auto-continue-david-apk-v1.mjs"
  )
  try {
    $managed = Get-CimInstance Win32_Process | Where-Object {
      $cmd = [string]$_.CommandLine
      if (-not $cmd) { return $false }
      foreach ($p in $patterns) {
        if ($cmd -like "*$p*") { return $true }
      }
      return $false
    }
    foreach ($p in $managed) {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
  } catch {
    Write-Host "[DAVID ALL] Could not fully stop an old managed worker; duplicate guard will still apply." -ForegroundColor Yellow
  }
}

$mainLauncher = Join-Path $Repo "tools\david\start-auto-continue.ps1"
$app2Launcher = Join-Path $Repo "tools\david\start-app2-autopilot.ps1"
$pwsh = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$mainRunning = (Test-CommandLineMatch @("dual-session-worker.mjs")) -or
               (Test-CommandLineMatch @("start-auto-continue.ps1"))
if ($mainRunning) {
  Write-Host "[DAVID ALL] SYSTEM + DESIGN + APK supervisor already running. Reusing it." -ForegroundColor Green
} else {
  Write-Host "[DAVID ALL] Starting SYSTEM + DESIGN + APK supervisor..." -ForegroundColor Cyan
  Start-Process -FilePath $pwsh -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $mainLauncher,
    "-Port", "$Port",
    "-MaxTurns", "2147483647"
  )
}

Start-Sleep -Seconds 2

$app2Running = (Test-CommandLineMatch @("start-app2-autopilot.ps1")) -or
               (Test-CommandLineMatch @(".auto-complete-app2-runtime.mjs")) -or
               (Test-CommandLineMatch @("auto-complete-app2-v1.mjs"))
if ($app2Running) {
  Write-Host "[DAVID ALL] DPP/APP2 worker already running. Reusing it." -ForegroundColor Green
} else {
  Write-Host "[DAVID ALL] Starting DPP/APP2 worker..." -ForegroundColor Cyan
  Start-Process -FilePath $pwsh -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $app2Launcher,
    "-Port", "$Port"
  )
}

Write-Host ""
Write-Host "[DAVID ALL] Expected managed ChatGPT sessions:" -ForegroundColor Green
Write-Host "  1. ENCHEV SYSTEM"
Write-Host "  2. ENCHEV DESIGN"
Write-Host "  3. DPP / APP2"
Write-Host "  4. DAVID PHONE / APK"
Write-Host ""
Write-Host "[DAVID ALL] APK worker auto-discovers a unique recent DAVID Phone / SoulFlame Twins / DAVID APK chat when no exact URL is configured." -ForegroundColor Green
Write-Host "[DAVID ALL] On max-length rollover the worker stays in the same tab and closes stale copies of the old conversation." -ForegroundColor Green
Write-Host "[DAVID ALL] Duplicate worker launches are blocked by process detection." -ForegroundColor Green

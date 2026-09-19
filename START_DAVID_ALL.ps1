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

function Get-MatchingProcesses {
  param(
    [string[]]$Names,
    [string[]]$Needles
  )
  $hits = @()
  try {
    foreach ($p in Get-CimInstance Win32_Process) {
      if ($p.ProcessId -eq $PID) { continue }
      if ($Names -and ($Names -notcontains ([string]$p.Name).ToLowerInvariant())) { continue }
      $cmd = [string]$p.CommandLine
      if (-not $cmd) { continue }
      $all = $true
      foreach ($n in $Needles) {
        if ($cmd -notlike "*$n*") { $all = $false; break }
      }
      if ($all) { $hits += $p }
    }
  } catch {}
  return @($hits)
}

function Test-Cdp {
  param([int]$P)
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

function Stop-MatchingProcesses {
  param(
    [string[]]$Names,
    [string[]]$Needles
  )
  foreach ($p in (Get-MatchingProcesses -Names $Names -Needles $Needles)) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
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
    "auto-continue-enchev-v5.mjs",
    "auto-continue-design-v1.mjs",
    "auto-continue-david-apk-v1.mjs",
    "auto-control-watchtower-v1.mjs",
    "connection-interruption-guard.mjs",
    "david-status-dashboard.ps1"
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
$dashboard = Join-Path $Repo "tools\david\david-status-dashboard.ps1"
$pwsh = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$DppRepo = Join-Path $Root "DPPautopilot"
$DppUrl = "https://github.com/SoulFlameAdmin/DPPautopilot.git"
try {
  if (-not (Test-Path (Join-Path $DppRepo ".git"))) {
    Write-Host "[DAVID ALL] Cloning DPP progress source for Matrix..." -ForegroundColor Cyan
    & $git clone $DppUrl $DppRepo
    if ($LASTEXITCODE -ne 0) { throw "DPP clone failed with exit code $LASTEXITCODE" }
  } else {
    Write-Host "[DAVID ALL] Updating DPP progress source for Matrix..." -ForegroundColor DarkCyan
    & $git -C $DppRepo pull --ff-only
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[DAVID ALL] DPP progress source pull skipped; existing local copy will be used." -ForegroundColor Yellow
    }
  }
} catch {
  Write-Host "[DAVID ALL] DPP progress source unavailable; APP2 still starts, Matrix may show DPP N/A." -ForegroundColor Yellow
}

$mainNodes = @(Get-MatchingProcesses -Names @("node.exe") -Needles @("dual-session-worker.mjs"))
$cdpReady = Test-Cdp -P $Port

if ($mainNodes.Count -gt 1) {
  Write-Host "[DAVID ALL] DUPLICATE supervisors detected ($($mainNodes.Count)). Cleaning the full managed node set before start..." -ForegroundColor Red
  foreach ($needle in @(
    "dual-session-worker.mjs",
    "auto-continue-enchev-v5.mjs",
    "auto-continue-design-v1.mjs",
    "auto-complete-app2-v1.mjs",
    "auto-continue-david-apk-v1.mjs",
    "auto-control-watchtower-v1.mjs",
    "connection-interruption-guard.mjs"
  )) {
    Stop-MatchingProcesses -Names @("node.exe") -Needles @($needle)
  }
  Start-Sleep -Seconds 2
  $mainNodes = @()
  $cdpReady = Test-Cdp -P $Port
}

$mainRunning = ($mainNodes.Count -eq 1 -and $cdpReady)

if ($mainNodes.Count -gt 0 -and -not $cdpReady) {
  Write-Host "[DAVID ALL] Stale CONTROL/SYSTEM/DESIGN/APP2/APK supervisor detected without CDP. Killing stale process..." -ForegroundColor Yellow
  Stop-MatchingProcesses -Names @("node.exe") -Needles @("dual-session-worker.mjs")
  Start-Sleep -Seconds 1
  $mainRunning = $false
}

if ($mainRunning) {
  Write-Host "[DAVID ALL] CONTROL + SYSTEM + DESIGN + APP2 + APK supervisor healthy. Reusing it." -ForegroundColor Green
} else {
  Write-Host "[DAVID ALL] Starting CONTROL + SYSTEM + DESIGN + APP2 + APK supervisor..." -ForegroundColor Cyan
  Start-Process -FilePath $pwsh -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $mainLauncher,
    "-Port", "$Port",
    "-MaxTurns", "2147483647"
  )

  $mainHealthy = $false
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    $supervisorNodes = @(Get-MatchingProcesses -Names @("node.exe") -Needles @("dual-session-worker.mjs"))
    $app2Nodes = @(Get-MatchingProcesses -Names @("node.exe") -Needles @("auto-complete-app2-v1.mjs"))
    $controlNodes = @(Get-MatchingProcesses -Names @("node.exe") -Needles @("auto-control-watchtower-v1.mjs"))
    if ($supervisorNodes.Count -gt 0 -and $app2Nodes.Count -gt 0 -and $controlNodes.Count -gt 0 -and (Test-Cdp -P $Port)) {
      $mainHealthy = $true
      break
    }
  }
  if (-not $mainHealthy) {
    throw "Unified DAVID supervisor failed health check: supervisor + APP2 + CONTROL children + CDP $Port were not all ready."
  }
  Write-Host "[DAVID ALL] Unified process/CDP health check PASS." -ForegroundColor Green
}

$tabStateFile = Join-Path $Repo "tools\david\.david-tab-monitor.json"
$tabHealthStartedAt = Get-Date
$tabsHealthy = $false
$lastTabStatus = "monitor-not-ready"
for ($i = 0; $i -lt 180; $i++) {
  Start-Sleep -Seconds 1
  try {
    if (-not (Test-Path $tabStateFile)) { continue }
    $tabState = Get-Content -Raw -LiteralPath $tabStateFile | ConvertFrom-Json
    if (-not $tabState.managed) { continue }
    try {
      $checkedAt = [datetime]$tabState.checkedAt
      if ($checkedAt -lt $tabHealthStartedAt.AddSeconds(-2)) { continue }
    } catch { continue }
    $sc = @($tabState.managed.SYSTEM).Count
    $dc = @($tabState.managed.DESIGN).Count
    $ac = @($tabState.managed.APP2).Count
    $kc = @($tabState.managed.APK).Count
    $cc = @($tabState.managed.CONTROL).Count
    $lastTabStatus = "CONTROL=$cc SYSTEM=$sc DESIGN=$dc APP2=$ac APK=$kc ChatGPT=$($tabState.totalChatGptTabs)"
    if ($cc -eq 1 -and $sc -eq 1 -and $dc -eq 1 -and $ac -eq 1 -and $kc -eq 1) {
      $tabsHealthy = $true
      break
    }
  } catch {}
}
if (-not $tabsHealthy) {
  throw "DAVID managed-tab health check failed after 180s: $lastTabStatus"
}
Write-Host "[DAVID ALL] 5/5 managed GPT tabs health check PASS: $lastTabStatus" -ForegroundColor Green

$expectedNodeProcesses = [ordered]@{
  "SUPERVISOR" = "dual-session-worker.mjs"
  "SYSTEM"     = "auto-continue-enchev-v5.mjs"
  "DESIGN"     = "auto-continue-design-v1.mjs"
  "APP2"       = "auto-complete-app2-v1.mjs"
  "APK"        = "auto-continue-david-apk-v1.mjs"
  "CONTROL"    = "auto-control-watchtower-v1.mjs"
  "GUARD"      = "connection-interruption-guard.mjs"
}
$processStatus = @()
$processInvariantOk = $true
foreach ($entry in $expectedNodeProcesses.GetEnumerator()) {
  $count = @(Get-MatchingProcesses -Names @("node.exe") -Needles @([string]$entry.Value)).Count
  $processStatus += "$($entry.Key)=$count"
  if ($count -ne 1) { $processInvariantOk = $false }
}
if (-not $processInvariantOk) {
  throw "DAVID process invariant failed: $($processStatus -join ' ')"
}
Write-Host "[DAVID ALL] PROCESS INVARIANT PASS: $($processStatus -join ' ')" -ForegroundColor Green

Start-Sleep -Seconds 2

$dashboardProcesses = @(Get-MatchingProcesses -Names @("powershell.exe","pwsh.exe") -Needles @("david-status-dashboard.ps1"))
if ($dashboardProcesses.Count -gt 1) {
  Write-Host "[DAVID ALL] Duplicate Matrix dashboards detected ($($dashboardProcesses.Count)). Restarting one clean dashboard..." -ForegroundColor Yellow
  Stop-MatchingProcesses -Names @("powershell.exe","pwsh.exe") -Needles @("david-status-dashboard.ps1")
  Start-Sleep -Seconds 1
  $dashboardProcesses = @()
}
$dashboardRunning = ($dashboardProcesses.Count -eq 1)
if ($dashboardRunning) {
  Write-Host "[DAVID ALL] Matrix dashboard already running. Reusing it." -ForegroundColor Green
} else {
  Write-Host "[DAVID ALL] Starting DAVID Matrix live report..." -ForegroundColor Cyan
  Start-Process -FilePath $pwsh -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $dashboard,
    "-RefreshSeconds", "3"
  )
}

Write-Host ""
Write-Host "[DAVID ALL] Expected managed ChatGPT sessions:" -ForegroundColor Green
Write-Host "  1. DAVID CONTROL / WATCHTOWER"
Write-Host "  2. ENCHEV SYSTEM"
Write-Host "  3. ENCHEV DESIGN"
Write-Host "  4. DPP / APP2"
Write-Host "  5. DAVID PHONE / APK"
Write-Host ""
Write-Host "[DAVID ALL] APK worker auto-discovers a unique recent DAVID Phone / SoulFlame Twins / DAVID APK chat when no exact URL is configured." -ForegroundColor Green
Write-Host "[DAVID ALL] On max-length rollover the worker opens a new ChatGPT tab, closes the old managed tab, records the new URL/history, and continues there." -ForegroundColor Green
Write-Host "[DAVID ALL] One unified supervisor owns CONTROL + SYSTEM + DESIGN + APP2 + APK; duplicate launches are blocked." -ForegroundColor Green
Write-Host "[DAVID ALL] CONTROL WATCHTOWER: https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e" -ForegroundColor Magenta
Write-Host "[DAVID ALL] CONTROL can request only allowlisted WAIT/REFRESH/RESTART/CLEAN_DUPLICATES actions after exact final OK." -ForegroundColor Magenta

Write-Host "[DAVID ALL] FINAL GATE: exact final OK required before any next normal prompt." -ForegroundColor Red
Write-Host "[DAVID ALL] SEND TIMEOUT LAW: central managed guard owns bounded Retry; workers WAIT and never duplicate-send." -ForegroundColor Yellow
Write-Host "[DAVID ALL] Recovery laws: active thinking/tool work=>WAIT; no-thinking=>refresh+resend; confirmed interruption=>refresh/verify+resend." -ForegroundColor Yellow
Write-Host "[DAVID ALL] Vercel deploy coordinator: Supabase global lease; one worker deploys at a time." -ForegroundColor Yellow
Write-Host "[DAVID ALL] Matrix dashboard starts automatically with live progress + worker report." -ForegroundColor Yellow
Write-Host "[DAVID ALL] 24/7 SELF-HEAL: stale heartbeat or missing managed tab restarts only the affected worker." -ForegroundColor Yellow

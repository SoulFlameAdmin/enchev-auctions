param(
  [int]$Port = 9444,
  [int]$DashboardRefreshMs = 1000
)

$ErrorActionPreference = "Stop"

$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$Branch = "test/david-autonomy-system-dpp-apk-20260919"
$DavidDir = Join-Path $Repo "tools\david"
$StartScript = Join-Path $Repo "START_DAVID_AUTONOMY.ps1"
$ReportScript = Join-Path $Repo "DAVID_LIVE_MISSION_REPORT.ps1"
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

function Resolve-Git {
  $portable = Join-Path $Root "tools\PortableGit\cmd\git.exe"
  if (Test-Path $portable) { return $portable }
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  throw "Git not found."
}

function Resolve-Node {
  $portable = Join-Path $Root "tools\node\node.exe"
  if (Test-Path $portable) { return $portable }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  throw "Node.js not found."
}

function Get-ProcCount([string]$Needle, [string[]]$Names = @("node.exe","powershell.exe","pwsh.exe")) {
  try {
    return @(
      Get-CimInstance Win32_Process | Where-Object {
        $name = ([string]$_.Name).ToLowerInvariant()
        $cmd = [string]$_.CommandLine
        ($Names -contains $name) -and $cmd -and $cmd -like "*$Needle*"
      }
    ).Count
  } catch {
    return 0
  }
}

function Test-Cdp([int]$P) {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Read-JsonSafe([string]$Path) {
  try {
    if (Test-Path -LiteralPath $Path) {
      return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    }
  } catch {}
  return $null
}

function Get-RuntimeSnapshot {
  $tabs = Read-JsonSafe (Join-Path $DavidDir ".david-tab-monitor.json")
  $snap = [ordered]@{
    supervisor = Get-ProcCount "dual-session-worker.mjs" @("node.exe")
    system = Get-ProcCount "auto-continue-enchev-v5.mjs" @("node.exe")
    app2 = Get-ProcCount "auto-complete-app2-v1.mjs" @("node.exe")
    apk = Get-ProcCount "auto-continue-david-apk-v1.mjs" @("node.exe")
    guard = Get-ProcCount "connection-interruption-guard.mjs" @("node.exe")
    design = Get-ProcCount "auto-continue-design-v1.mjs" @("node.exe")
    control = Get-ProcCount "auto-control-watchtower-v1.mjs" @("node.exe")
    cdp = Test-Cdp $Port
    tabs = $tabs
  }
  return [pscustomobject]$snap
}

function Test-ExpectedRuntime($S) {
  if ($S.supervisor -ne 1) { return $false }
  if ($S.system -ne 1 -or $S.app2 -ne 1 -or $S.apk -ne 1) { return $false }
  if ($S.guard -ne 1) { return $false }
  if ($S.design -ne 0 -or $S.control -ne 0) { return $false }
  if (-not $S.cdp) { return $false }
  if (-not $S.tabs -or -not $S.tabs.managed) { return $false }

  $sc = @($S.tabs.managed.SYSTEM).Count
  $ac = @($S.tabs.managed.APP2).Count
  $kc = @($S.tabs.managed.APK).Count
  $dc = if ($S.tabs.managed.PSObject.Properties.Name -contains "DESIGN") { @($S.tabs.managed.DESIGN).Count } else { 0 }
  $cc = if ($S.tabs.managed.PSObject.Properties.Name -contains "CONTROL") { @($S.tabs.managed.CONTROL).Count } else { 0 }

  return ($sc -eq 1 -and $ac -eq 1 -and $kc -eq 1 -and $dc -eq 0 -and $cc -eq 0 -and [int]$S.tabs.totalChatGptTabs -eq 3)
}

function Write-Snapshot($S) {
  Write-Host ("[RUNTIME] SUP={0} SYS={1} APP2={2} APK={3} GUARD={4} DESIGN={5} CONTROL={6} CDP={7}" -f
    $S.supervisor,$S.system,$S.app2,$S.apk,$S.guard,$S.design,$S.control,$S.cdp) -ForegroundColor Cyan
  if ($S.tabs) {
    Write-Host ("[RUNTIME] ChatGPT tabs={0}" -f $S.tabs.totalChatGptTabs) -ForegroundColor Cyan
  }
}

function Run-NodeTest([string]$Node, [string]$RelativePath) {
  $path = Join-Path $Repo $RelativePath
  if (-not (Test-Path $path)) {
    throw "Required verification file missing: $RelativePath"
  }
  Write-Host ("[TEST] " + $RelativePath) -ForegroundColor DarkCyan
  & $Node $path
  if ($LASTEXITCODE -ne 0) {
    throw "Verification failed: $RelativePath"
  }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor DarkGreen
Write-Host " DAVID READY SHELL // STABILIZE -> VERIFY -> LIVE REPORT" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor DarkGreen

if (-not (Test-Path (Join-Path $Repo ".git"))) {
  throw "DAVID repository not found: $Repo"
}

$Git = Resolve-Git
$Node = Resolve-Node

$dirty = @(& $Git -C $Repo status --porcelain)
if ($LASTEXITCODE -ne 0) { throw "git status failed." }

# DAVID/SF Scientist emits local runtime telemetry under tools/david/.sf-scientist-*.
# These files are operational state, not source changes. Preserve them and ignore
# them for the clean-tree safety gate. Any other tracked/untracked change still blocks.
$runtimeOnlyPatterns = @(
  "tools/david/.sf-scientist-captures/",
  "tools/david/.sf-scientist-command.json",
  "tools/david/.sf-scientist-decisions.jsonl",
  "tools/david/.sf-scientist-memory.jsonl",
  "tools/david/.sf-scientist-operator.jsonl",
  "tools/david/.sf-scientist-response.json",
  "tools/david/.sf-scientist-state.json",
  "tools/david/.sf-scientist-state.json.tmp",
  "tools/david/.sf-scientist.lock"
)

$materialDirty = @()
foreach ($line in $dirty) {
  $path = ([string]$line).Substring([math]::Min(3, ([string]$line).Length)).Trim()
  $isRuntimeOnly = $false
  foreach ($pattern in $runtimeOnlyPatterns) {
    if ($path -eq $pattern -or $path.StartsWith($pattern)) {
      $isRuntimeOnly = $true
      break
    }
  }
  if (-not $isRuntimeOnly) { $materialDirty += $line }
}

if ($materialDirty.Count -gt 0) {
  Write-Host "[BLOCKED] Material local changes detected. Nothing was overwritten." -ForegroundColor Red
  $materialDirty | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
  throw "Commit/stash material local changes before stabilization."
}

if ($dirty.Count -gt 0) {
  Write-Host "[SAFE] Runtime-only SF Scientist telemetry detected; preserving and ignoring for source clean gate." -ForegroundColor DarkYellow
}

Write-Host "[SYNC] Fetching verified DAVID branch..." -ForegroundColor Cyan
& $Git -C $Repo fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }

$current = (& $Git -C $Repo rev-parse --abbrev-ref HEAD | Select-Object -First 1).Trim()
if ($current -ne $Branch) {
  Write-Host ("[SYNC] Switching to " + $Branch) -ForegroundColor Cyan
  & $Git -C $Repo checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw "Unable to checkout $Branch." }
}

Write-Host "[SYNC] Fast-forward only..." -ForegroundColor Cyan
& $Git -C $Repo pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) { throw "git pull --ff-only failed." }

Write-Host ""
Write-Host "[VERIFY] Runtime profile + Stage 7/8 tests" -ForegroundColor Green

$tests = @(
  "tools\david\verify-autonomy-profile.mjs",
  "scripts\verify-david-learning-loop.mjs",
  "scripts\verify-david-autonomy-learning-persistence.mjs",
  "scripts\verify-david-skill-retrieval.mjs",
  "scripts\verify-david-failure-aware-retry.mjs",
  "scripts\verify-david-learning-benchmark.mjs",
  "scripts\verify-david-self-upgrade-controller.mjs",
  "scripts\verify-david-weakness-detector.mjs",
  "scripts\verify-david-upgrade-candidate-builder.mjs",
  "scripts\verify-david-upgrade-test-matrix.mjs",
  "scripts\verify-david-post-promotion-observer.mjs",
  "scripts\verify-david-stage-8-integration.mjs"
)

foreach ($t in $tests) {
  Run-NodeTest $Node $t
}

Write-Host ""
Write-Host "[VERIFY] All code-level checks PASS." -ForegroundColor Green

$runtime = Get-RuntimeSnapshot
Write-Snapshot $runtime

if ($runtime.supervisor -eq 0) {
  Write-Host "[START] DAVID is not running. Starting verified AUTONOMY profile without destructive cleanup..." -ForegroundColor Yellow
  if (-not (Test-Path $StartScript)) { throw "Missing start script: $StartScript" }

  & $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $StartScript -Port $Port
  if ($LASTEXITCODE -ne 0) { throw "DAVID start failed." }

  Start-Sleep -Seconds 2
  $runtime = Get-RuntimeSnapshot
  Write-Snapshot $runtime
}
elseif ($runtime.supervisor -gt 1) {
  Write-Host "[BLOCKED] Duplicate supervisor detected. This ready shell will NOT taskkill or bypass active-work protection." -ForegroundColor Red
  throw "Duplicate DAVID runtime requires the approved DAVID recovery/duplicate-cleanup path."
}

if (-not (Test-ExpectedRuntime $runtime)) {
  Write-Host "[BLOCKED] Existing DAVID runtime is not in the expected stable profile." -ForegroundColor Red
  Write-Snapshot $runtime
  Write-Host "[SAFETY] No process was killed and no active ChatGPT turn was interrupted." -ForegroundColor Yellow
  throw "Runtime stability gate failed."
}

Write-Host ""
Write-Host "[READY] DAVID runtime stability gate PASS." -ForegroundColor Green
Write-Host "[READY] Stage 7/8 code verification PASS." -ForegroundColor Green
Write-Host "[READY] Opening read-only realtime mission report..." -ForegroundColor Green
Write-Host "[INFO] Ctrl+C closes only the report; DAVID workers continue." -ForegroundColor DarkGray

if (-not (Test-Path $ReportScript)) {
  throw "Live report missing: $ReportScript"
}

& $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $ReportScript -RefreshMs $DashboardRefreshMs -Root $Root

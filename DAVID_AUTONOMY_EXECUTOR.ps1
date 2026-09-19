param(
  [int]$Port = 9444,
  [switch]$FreshSessions
)

$ErrorActionPreference = "Stop"

$Root = "D:\ASI"
$Repo = Join-Path $Root "enchev-auctions"
$PortableGit = Join-Path $Root "tools\PortableGit\cmd\git.exe"
$Branch = "test/david-autonomy-system-dpp-apk-20260919"
$RestartScript = Join-Path $Repo "RESTART_DAVID_AUTONOMY_CLEAN.ps1"
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

function Resolve-Git {
  if (Test-Path $PortableGit) { return $PortableGit }
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  throw "Git not found. Expected PortableGit at $PortableGit or git in PATH."
}

if (-not (Test-Path (Join-Path $Repo ".git"))) {
  throw "Repository not found: $Repo"
}

$Git = Resolve-Git

Write-Host "" 
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host " DAVID AUTONOMY EXECUTOR // SYSTEM + DPP + APK" -ForegroundColor Green
Write-Host " DESIGN=OFF | CONTROL+GUARD=RECOVERY ONLY | GPT TABS=4" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGreen

$dirty = & $Git -C $Repo status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "git status failed with exit code $LASTEXITCODE"
}
if ($dirty) {
  throw "Repository has local uncommitted changes. AUTONOMY executor refuses destructive checkout. Commit/stash them first."
}

Write-Host "[AUTONOMY] Fetching verified autonomy branch..." -ForegroundColor Cyan
& $Git -C $Repo fetch origin $Branch
if ($LASTEXITCODE -ne 0) {
  throw "git fetch failed with exit code $LASTEXITCODE"
}

$currentBranch = (& $Git -C $Repo rev-parse --abbrev-ref HEAD | Select-Object -First 1).Trim()
if ($currentBranch -ne $Branch) {
  Write-Host "[AUTONOMY] Switching to $Branch..." -ForegroundColor Cyan
  & $Git -C $Repo checkout $Branch
  if ($LASTEXITCODE -ne 0) {
    & $Git -C $Repo checkout -b $Branch "origin/$Branch"
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to checkout autonomy branch $Branch"
    }
  }
}

Write-Host "[AUTONOMY] Fast-forwarding autonomy branch..." -ForegroundColor Cyan
& $Git -C $Repo pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) {
  throw "git pull --ff-only failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $RestartScript)) {
  throw "Verified restart script missing after update: $RestartScript"
}

Write-Host "[AUTONOMY] Running profile self-test before restart..." -ForegroundColor Cyan
$Node = Join-Path $Root "tools\node\node.exe"
if (-not (Test-Path $Node)) {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) { throw "Node.js not found." }
  $Node = $nodeCmd.Source
}
& $Node (Join-Path $Repo "tools\david\verify-autonomy-profile.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "DAVID autonomy profile self-test failed. Restart aborted."
}

Write-Host "[AUTONOMY] Verified scope: SYSTEM + DPP/APP2 + APK; DESIGN OFF." -ForegroundColor Green
Write-Host "[AUTONOMY] Clean restarting DAVID autonomy stack..." -ForegroundColor Cyan

$args = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $RestartScript,
  "-Port", "$Port"
)
if ($FreshSessions) {
  $args += "-FreshSessions"
}

& $PowerShellExe @args
if ($LASTEXITCODE -ne 0) {
  throw "DAVID autonomy restart failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "[AUTONOMY] READY" -ForegroundColor Green
Write-Host "[AUTONOMY] Project workers: SYSTEM + DPP + APK" -ForegroundColor Green
Write-Host "[AUTONOMY] DESIGN worker: OFF" -ForegroundColor Green
Write-Host "[AUTONOMY] CONTROL/WATCHTOWER + GUARD: ON for recovery only" -ForegroundColor Green
Write-Host "[AUTONOMY] Expected ChatGPT tabs: 4 total" -ForegroundColor Green

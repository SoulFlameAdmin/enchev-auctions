param(
  [int]$Port = 9444
)

$ErrorActionPreference = "Stop"

# APP2 now reuses the already-stable DAVID Edge profile/session used by Enchev.
# This avoids the blank/loading second-browser problem and keeps the logged-in ChatGPT session.
$SharedPort = 9444
$ChatUrl = "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$ProfileDir = Join-Path $Root "DAVID_CHATGPT_PROFILE"

$PortableGit = "D:\ASI\tools\PortableGit"
$PortableNode = "D:\ASI\tools\node"
if (Test-Path $PortableGit) { $env:Path = "$PortableGit\cmd;$PortableGit\bin;$env:Path" }
if (Test-Path $PortableNode) { $env:Path = "$PortableNode;$env:Path" }

function Test-Cdp {
  param([int]$P)
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2
    return $true
  }
  catch { return $false }
}

function Get-BrowserPath {
  $candidates = New-Object System.Collections.Generic.List[string]
  if (${env:ProgramFiles(x86)}) {
    $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"))
  }
  if ($env:ProgramFiles) {
    $candidates.Add((Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"))
  }
  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe"))
  }
  foreach ($cmdName in @("msedge.exe", "msedge")) {
    $cmd = Get-Command $cmdName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates.Add($cmd.Source) }
  }
  foreach ($regPath in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"
  )) {
    try {
      $value = (Get-ItemProperty -Path $regPath -ErrorAction Stop).'(default)'
      if ($value) { $candidates.Add($value) }
    }
    catch {}
  }
  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

if ($Port -ne $SharedPort) {
  Write-Host "[APP2] Ignoring old port $Port. Stable shared DAVID Edge uses port $SharedPort." -ForegroundColor Yellow
}
$Port = $SharedPort

if (-not (Test-Cdp -P $Port)) {
  $browser = Get-BrowserPath
  if (-not $browser) { throw "Microsoft Edge was not found." }
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  Write-Host "[APP2] Enchev DAVID Edge is not running. Starting the SAME stable profile on port $Port..." -ForegroundColor Cyan
  Start-Process -FilePath $browser -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    $ChatUrl
  )
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 750
    if (Test-Cdp -P $Port) { $ok = $true; break }
  }
  if (-not $ok) { throw "Shared DAVID Edge started, but CDP port 9444 did not become available." }
}
else {
  Write-Host "[APP2] Reusing working Enchev DAVID Edge on port 9444." -ForegroundColor Green
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $node) { throw "Node.js not found." }
if (-not $npm) { throw "npm not found." }

Push-Location $Here
try {
  if (-not (Test-Path (Join-Path $Here "node_modules\playwright-core"))) {
    Write-Host "[APP2] Installing local automation dependency..." -ForegroundColor Cyan
    & $npm.Source install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE." }
  }

  $env:DAVID_APP2_CDP_URL = "http://127.0.0.1:$Port"
  $env:DAVID_APP2_CHAT_URL = $ChatUrl
  $env:DAVID_APP2_STATE_FILE = Join-Path $Here ".david-app2-state-6aac2dbb.json"

  $WorkerSource = Join-Path $Here "auto-complete-app2-v1.mjs"
  $RuntimeWorker = Join-Path $Here ".auto-complete-app2-runtime.mjs"
  $source = [System.IO.File]::ReadAllText($WorkerSource)
  $source = $source.Replace(
    'chromium.connectOverCDP(CDP_URL)',
    'chromium.connectOverCDP(CDP_URL, { timeout: 120000 })'
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($RuntimeWorker, $source, $utf8NoBom)

  Write-Host ""
  Write-Host "[APP2] TARGET: $ChatUrl" -ForegroundColor Green
  Write-Host "[APP2] MODE: shared stable Enchev Edge / separate ChatGPT tab / separate APP2 state." -ForegroundColor Green
  Write-Host "[APP2] AUTOPILOT: plan -> build -> test -> fix -> verify -> 100%." -ForegroundColor Green
  Write-Host "[APP2] Enchev SYSTEM/DESIGN workers remain running; APP2 uses only its own target tab." -ForegroundColor Green
  Write-Host "[APP2] Ctrl+C stops only APP2 worker, not the browser and not Enchev DAVID." -ForegroundColor Yellow
  Write-Host ""

  $attempt = 0
  while ($true) {
    $attempt++
    Write-Host "[APP2] Starting worker attempt $attempt..." -ForegroundColor Cyan
    & $node.Source $RuntimeWorker
    $code = $LASTEXITCODE
    if ($code -eq 0) {
      Write-Host "[APP2] Worker finished normally." -ForegroundColor Green
      break
    }
    Write-Host "[APP2] Worker exited with code $code. Retrying in 4s on the same Edge session..." -ForegroundColor Yellow
    if (-not (Test-Cdp -P $Port)) { throw "Shared DAVID Edge on port 9444 is no longer available." }
    Start-Sleep -Seconds 4
  }
}
finally {
  $RuntimeWorker = Join-Path $Here ".auto-complete-app2-runtime.mjs"
  if (Test-Path $RuntimeWorker) { Remove-Item $RuntimeWorker -Force -ErrorAction SilentlyContinue }
  Pop-Location
}

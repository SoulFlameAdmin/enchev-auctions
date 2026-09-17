param(
  [int]$Port = 9444,
  [int]$MaxTurns = 30
)

$ErrorActionPreference = "Stop"
$ChatUrl = "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$ProfileDir = Join-Path $Root "DAVID_CHATGPT_PROFILE"

# Keep this file ASCII-only so Windows PowerShell 5.1 cannot corrupt UTF-8 text.
$PortableGit = "D:\ASI\tools\PortableGit"
$PortableNode = "D:\ASI\tools\node"
if (Test-Path $PortableGit) {
  $env:Path = "$PortableGit\cmd;$PortableGit\bin;$env:Path"
}
if (Test-Path $PortableNode) {
  $env:Path = "$PortableNode;$env:Path"
}

function Test-Cdp {
  param([int]$P)
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2
    return $true
  }
  catch {
    return $false
  }
}

if (-not (Test-Cdp -P $Port)) {
  $edgeCandidates = @(
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
  )

  $edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $edge) {
    throw "Microsoft Edge was not found. Install Edge or start Chromium manually with remote debugging on port $Port."
  }

  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  Write-Host "[DAVID] Starting dedicated Edge profile on CDP port $Port..." -ForegroundColor Cyan

  Start-Process -FilePath $edge -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$ProfileDir",
    $ChatUrl
  )

  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 750
    if (Test-Cdp -P $Port) {
      $ok = $true
      break
    }
  }

  if (-not $ok) {
    throw "Edge started, but CDP port $Port did not become available."
  }
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $node) {
  throw "Node.js was not found. Expected portable Node at D:\ASI\tools\node or Node in PATH."
}
if (-not $npm) {
  throw "npm was not found. Expected it beside Node.js or in PATH."
}

Push-Location $Here
try {
  if (-not (Test-Path (Join-Path $Here "node_modules\playwright-core"))) {
    Write-Host "[DAVID] Installing local automation dependency..." -ForegroundColor Cyan
    & $npm.Source install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed with exit code $LASTEXITCODE."
    }
  }

  $env:DAVID_CDP_URL = "http://127.0.0.1:$Port"
  $env:DAVID_CHAT_URL = $ChatUrl
  $env:DAVID_MAX_TURNS = "$MaxTurns"

  Write-Host ""
  Write-Host "[DAVID] TARGET: $ChatUrl" -ForegroundColor Green
  Write-Host "[DAVID] If this Edge profile is not logged in to ChatGPT, log in once, press Ctrl+C, and run again." -ForegroundColor Yellow
  Write-Host "[DAVID] Ctrl+C stops the worker." -ForegroundColor Yellow
  Write-Host ""

  & $npm.Source start
  if ($LASTEXITCODE -ne 0) {
    throw "DAVID worker exited with code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}

param(
  [int]$Port = 9555
)

$ErrorActionPreference = "Stop"
$ChatUrl = "https://chatgpt.com/c/6aac1739-4ac0-83ed-92b9-4995d81fe124"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$ProfileDir = Join-Path $Root "DAVID_APP2_PROFILE"

$PortableGit = "D:\ASI\tools\PortableGit"
$PortableNode = "D:\ASI\tools\node"
if (Test-Path $PortableGit) { $env:Path = "$PortableGit\cmd;$PortableGit\bin;$env:Path" }
if (Test-Path $PortableNode) { $env:Path = "$PortableNode;$env:Path" }

function Test-Cdp {
  param([int]$P)
  try {
    $v = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 3
    return [bool]$v.webSocketDebuggerUrl
  }
  catch { return $false }
}

function Wait-CdpStable {
  param([int]$P, [int]$MaxChecks = 80)
  $stable = 0
  for ($i = 0; $i -lt $MaxChecks; $i++) {
    if (Test-Cdp -P $P) {
      $stable++
      if ($stable -ge 3) {
        Start-Sleep -Seconds 3
        return $true
      }
    }
    else { $stable = 0 }
    Start-Sleep -Milliseconds 750
  }
  return $false
}

function Get-BrowserPath {
  $candidates = New-Object System.Collections.Generic.List[string]
  if (${env:ProgramFiles(x86)}) {
    $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"))
    $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"))
  }
  if ($env:ProgramFiles) {
    $candidates.Add((Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"))
    $candidates.Add((Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"))
    $candidates.Add((Join-Path $env:ProgramFiles "BraveSoftware\Brave-Browser\Application\brave.exe"))
  }
  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe"))
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"))
    $candidates.Add((Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\Application\brave.exe"))
  }
  foreach ($cmdName in @("msedge.exe", "msedge", "chrome.exe", "chrome", "brave.exe", "brave")) {
    $cmd = Get-Command $cmdName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates.Add($cmd.Source) }
  }
  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

if (-not (Test-Cdp -P $Port)) {
  $browser = Get-BrowserPath
  if (-not $browser) { throw "No supported Chromium browser found." }
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  Write-Host "[APP2] Browser: $browser" -ForegroundColor DarkGray
  Write-Host "[APP2] Starting isolated browser profile on CDP port $Port..." -ForegroundColor Cyan
  Start-Process -FilePath $browser -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--remote-allow-origins=*",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    $ChatUrl
  )
}
else {
  Write-Host "[APP2] Existing dedicated browser found on port $Port." -ForegroundColor DarkGray
}

Write-Host "[APP2] Waiting for CDP to become stable..." -ForegroundColor Cyan
if (-not (Wait-CdpStable -P $Port)) {
  throw "APP2 browser CDP did not become stable on port $Port. Close only the APP2 Edge window and run this command again."
}
Write-Host "[APP2] CDP stable on port $Port." -ForegroundColor Green

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
  $env:DAVID_APP2_STATE_FILE = Join-Path $Here ".david-app2-state.json"

  # Playwright can need more than its default 30s while a fresh Edge profile
  # initializes. Build a local runtime copy with a 120s CDP handshake timeout.
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
  Write-Host "[APP2] AUTOPILOT: plan -> implementation -> tests -> fixes -> production verification -> 100%." -ForegroundColor Green
  Write-Host "[APP2] Dedicated Edge profile and port $Port. Existing Enchev DAVID on 9444 is untouched." -ForegroundColor Green
  Write-Host "[APP2] CDP handshake timeout: 120s. Worker auto-restart: ON." -ForegroundColor Green
  Write-Host "[APP2] Ctrl+C stops only APP2 worker." -ForegroundColor Yellow
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

    Write-Host "[APP2] Worker exited with code $code. Keeping APP2 alive and reconnecting..." -ForegroundColor Yellow
    if (-not (Wait-CdpStable -P $Port -MaxChecks 20)) {
      throw "APP2 Edge/CDP disappeared. Restart only the APP2 Edge and run this script again."
    }
    Start-Sleep -Seconds 4
  }
}
finally {
  $RuntimeWorker = Join-Path $Here ".auto-complete-app2-runtime.mjs"
  if (Test-Path $RuntimeWorker) { Remove-Item $RuntimeWorker -Force -ErrorAction SilentlyContinue }
  Pop-Location
}

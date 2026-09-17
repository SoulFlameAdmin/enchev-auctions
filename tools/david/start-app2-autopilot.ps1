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

function Get-BrowserInfo {
  $items = New-Object System.Collections.Generic.List[object]
  function Add-Candidate([string]$Kind, [string]$Path) {
    if ($Path -and (Test-Path $Path)) {
      $items.Add([pscustomobject]@{ Kind = $Kind; Path = $Path })
    }
  }

  # APP2 intentionally prefers Chrome/Brave. Edge remains the fallback because
  # the second isolated Edge profile on this PC has repeatedly rendered a blank page.
  if (${env:ProgramFiles(x86)}) {
    Add-Candidate "chrome" (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
    Add-Candidate "brave"  (Join-Path ${env:ProgramFiles(x86)} "BraveSoftware\Brave-Browser\Application\brave.exe")
    Add-Candidate "edge"   (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
  }
  if ($env:ProgramFiles) {
    Add-Candidate "chrome" (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe")
    Add-Candidate "brave"  (Join-Path $env:ProgramFiles "BraveSoftware\Brave-Browser\Application\brave.exe")
    Add-Candidate "edge"   (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")
  }
  if ($env:LOCALAPPDATA) {
    Add-Candidate "chrome" (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    Add-Candidate "brave"  (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\Application\brave.exe")
    Add-Candidate "edge"   (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
  }

  foreach ($cmdName in @("chrome.exe", "chrome", "brave.exe", "brave", "msedge.exe", "msedge")) {
    $cmd = Get-Command $cmdName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
      $kind = if ($cmdName -like "chrome*") { "chrome" } elseif ($cmdName -like "brave*") { "brave" } else { "edge" }
      Add-Candidate $kind $cmd.Source
    }
  }

  return $items | Sort-Object @{Expression={ if ($_.Kind -eq "chrome") {0} elseif ($_.Kind -eq "brave") {1} else {2} }}, Path | Select-Object -First 1
}

function Stop-App2Browser {
  try {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe' OR Name='brave.exe'" |
      Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileDir*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  catch {}
  Start-Sleep -Seconds 2
}

if (-not (Test-Cdp -P $Port)) {
  $browserInfo = Get-BrowserInfo
  if (-not $browserInfo) { throw "No supported Chromium browser found (Chrome, Brave or Edge)." }
  $browser = $browserInfo.Path
  $browserKind = $browserInfo.Kind
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

  Write-Host "[APP2] Browser: $browser ($browserKind)" -ForegroundColor DarkGray
  Write-Host "[APP2] Starting isolated APP2 browser on CDP port $Port..." -ForegroundColor Cyan

  $args = @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--remote-allow-origins=*",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window"
  )
  if ($browserKind -eq "edge") {
    # Software rendering fallback for the blank second-Edge profile observed on this PC.
    $args += "--disable-gpu"
  }
  $args += $ChatUrl

  Start-Process -FilePath $browser -ArgumentList $args
}
else {
  Write-Host "[APP2] Existing dedicated browser found on port $Port." -ForegroundColor DarkGray
}

Write-Host "[APP2] Waiting for CDP to become stable..." -ForegroundColor Cyan
if (-not (Wait-CdpStable -P $Port)) {
  Stop-App2Browser
  throw "APP2 browser CDP did not become stable on port $Port. Run the launcher again."
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
  Write-Host "[APP2] Dedicated browser profile and port $Port. Enchev DAVID on 9444 is untouched." -ForegroundColor Green
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
      throw "APP2 browser/CDP disappeared. Restart only APP2 and run this script again."
    }
    Start-Sleep -Seconds 4
  }
}
finally {
  $RuntimeWorker = Join-Path $Here ".auto-complete-app2-runtime.mjs"
  if (Test-Path $RuntimeWorker) { Remove-Item $RuntimeWorker -Force -ErrorAction SilentlyContinue }
  Pop-Location
}

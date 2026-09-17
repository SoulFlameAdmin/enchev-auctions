param(
  [int]$Port = 9555
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ChatUrl = "https://chatgpt.com/c/6aac1739-4ac0-83ed-92b9-4995d81fe124"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$ToolsRoot = Join-Path $Root "tools"
$ChromeRoot = Join-Path $ToolsRoot "chrome-app2"
$ChromeExe = Join-Path $ChromeRoot "chrome-win64\chrome.exe"
$ProfileDir = Join-Path $Root "DAVID_APP2_CHROME_PROFILE"

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
  param([int]$P, [int]$MaxChecks = 100)
  $stable = 0
  for ($i = 0; $i -lt $MaxChecks; $i++) {
    if (Test-Cdp -P $P) {
      $stable++
      if ($stable -ge 4) {
        Start-Sleep -Seconds 2
        return $true
      }
    }
    else { $stable = 0 }
    Start-Sleep -Milliseconds 700
  }
  return $false
}

function Stop-App2Browser {
  try {
    Get-CimInstance Win32_Process |
      Where-Object {
        ($_.Name -eq "chrome.exe" -or $_.Name -eq "msedge.exe" -or $_.Name -eq "brave.exe") -and
        $_.CommandLine -and
        $_.CommandLine -like "*$ProfileDir*"
      } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  catch {}
  Start-Sleep -Seconds 2
}

function Ensure-PortableChrome {
  if (Test-Path $ChromeExe) { return $ChromeExe }

  New-Item -ItemType Directory -Force -Path $ToolsRoot | Out-Null
  Write-Host "[APP2] Downloading isolated Chrome for Testing..." -ForegroundColor Cyan

  $metaUrl = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json"
  $meta = Invoke-RestMethod -Uri $metaUrl -TimeoutSec 45
  $asset = $meta.channels.Stable.downloads.chrome | Where-Object { $_.platform -eq "win64" } | Select-Object -First 1
  if (-not $asset -or -not $asset.url) { throw "Could not resolve Chrome for Testing win64 download." }

  $zip = Join-Path $ToolsRoot "chrome-app2-win64.zip"
  $temp = Join-Path $ToolsRoot "chrome-app2-temp"
  if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
  if (Test-Path $ChromeRoot) { Remove-Item $ChromeRoot -Recurse -Force }

  Invoke-WebRequest -Uri $asset.url -OutFile $zip -TimeoutSec 180
  Expand-Archive -Path $zip -DestinationPath $temp -Force
  New-Item -ItemType Directory -Force -Path $ChromeRoot | Out-Null
  Move-Item -Path (Join-Path $temp "chrome-win64") -Destination $ChromeRoot
  Remove-Item $temp -Recurse -Force
  Remove-Item $zip -Force

  if (-not (Test-Path $ChromeExe)) { throw "Portable Chrome extraction failed: $ChromeExe not found." }
  Write-Host "[APP2] Portable Chrome ready: $ChromeExe" -ForegroundColor Green
  return $ChromeExe
}

$browser = Ensure-PortableChrome

if (-not (Test-Cdp -P $Port)) {
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  Write-Host "[APP2] Browser: $browser (portable Chrome for Testing)" -ForegroundColor DarkGray
  Write-Host "[APP2] Starting isolated APP2 browser on CDP port $Port..." -ForegroundColor Cyan

  Start-Process -FilePath $browser -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--remote-allow-origins=*",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-mode",
    "--disable-component-update",
    "--new-window",
    $ChatUrl
  )
}
else {
  Write-Host "[APP2] Existing dedicated APP2 browser found on port $Port." -ForegroundColor DarkGray
}

Write-Host "[APP2] Waiting for CDP to become stable..." -ForegroundColor Cyan
if (-not (Wait-CdpStable -P $Port)) {
  Stop-App2Browser
  throw "APP2 portable Chrome/CDP did not become stable on port $Port. Run the launcher again."
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
  Write-Host "[APP2] Browser isolation: portable Chrome + separate profile + port $Port." -ForegroundColor Green
  Write-Host "[APP2] Enchev DAVID on 9444 is untouched." -ForegroundColor Green
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
    if (-not (Wait-CdpStable -P $Port -MaxChecks 25)) {
      throw "APP2 portable Chrome/CDP disappeared. Run this launcher again."
    }
    Start-Sleep -Seconds 4
  }
}
finally {
  $RuntimeWorker = Join-Path $Here ".auto-complete-app2-runtime.mjs"
  if (Test-Path $RuntimeWorker) { Remove-Item $RuntimeWorker -Force -ErrorAction SilentlyContinue }
  Pop-Location
}

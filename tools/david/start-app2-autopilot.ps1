param(
  [int]$Port = 9555
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ChatUrl = "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4"
$ChatHome = "https://chatgpt.com/"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$ProfileDir = Join-Path $Root "DAVID_APP2_EDGE_PROFILE_V3"

$PortableGit = "D:\ASI\tools\PortableGit"
$PortableNode = "D:\ASI\tools\node"
if (Test-Path $PortableGit) { $env:Path = "$PortableGit\cmd;$PortableGit\bin;$env:Path" }
if (Test-Path $PortableNode) { $env:Path = "$PortableNode;$env:Path" }

function Get-EdgePath {
  $candidates = New-Object System.Collections.Generic.List[string]
  if (${env:ProgramFiles(x86)}) { $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")) }
  if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")) }
  if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")) }
  foreach ($name in @("msedge.exe", "msedge")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
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
    } catch {}
  }
  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

function Test-Cdp {
  param([int]$P)
  try {
    $v = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 3
    return [bool]$v.webSocketDebuggerUrl
  } catch { return $false }
}

function Wait-CdpStable {
  param([int]$P, [int]$MaxChecks = 100)
  $stable = 0
  for ($i = 0; $i -lt $MaxChecks; $i++) {
    if (Test-Cdp -P $P) {
      $stable++
      if ($stable -ge 4) { Start-Sleep -Seconds 2; return $true }
    } else { $stable = 0 }
    Start-Sleep -Milliseconds 700
  }
  return $false
}

function Stop-StaleApp2Browsers {
  try {
    Get-CimInstance Win32_Process |
      Where-Object {
        ($_.Name -eq "msedge.exe" -or $_.Name -eq "chrome.exe" -or $_.Name -eq "brave.exe") -and
        $_.CommandLine -and
        ($_.CommandLine -like "*DAVID_APP2_EDGE_PROFILE*" -or $_.CommandLine -like "*DAVID_APP2_CHROME_PROFILE*")
      } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch {}
  Start-Sleep -Seconds 2
}

function Wait-ChatWindow {
  param([int]$P, [int]$Seconds = 90)
  $until = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $until) {
    try {
      $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/list" -TimeoutSec 3
      $chat = $pages | Where-Object { $_.type -eq "page" -and $_.url -like "https://chatgpt.com/*" } | Select-Object -First 1
      if ($chat) {
        $title = [string]$chat.title
        if ($title -and $title -notmatch "(?i)loading|зареждане") { return $true }
      }
    } catch {}
    Start-Sleep -Seconds 1
  }
  return $false
}

$edge = Get-EdgePath
if (-not $edge) { throw "Microsoft Edge was not found." }

# Always remove only stale APP2 browser processes. Enchev on 9444 uses another profile and is untouched.
Stop-StaleApp2Browsers

if (Test-Cdp -P $Port) {
  throw "Port $Port is still occupied after stopping APP2 browsers. Close only the old APP2 browser and run again."
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
Write-Host "[APP2] Browser: $edge (Microsoft Edge)" -ForegroundColor DarkGray
Write-Host "[APP2] Starting clean isolated Edge profile on port $Port..." -ForegroundColor Cyan

Start-Process -FilePath $edge -ArgumentList @(
  "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=$Port",
  "--remote-allow-origins=*",
  "--user-data-dir=$ProfileDir",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-mode",
  "--new-window",
  $ChatHome
)

Write-Host "[APP2] Waiting for Edge CDP..." -ForegroundColor Cyan
if (-not (Wait-CdpStable -P $Port)) {
  Stop-StaleApp2Browsers
  throw "APP2 Edge started but CDP did not become stable on port $Port."
}
Write-Host "[APP2] CDP stable." -ForegroundColor Green

# Give ChatGPT home a chance to render before DAVID navigates to the conversation.
if (Wait-ChatWindow -P $Port -Seconds 30) {
  Write-Host "[APP2] ChatGPT UI detected." -ForegroundColor Green
} else {
  Write-Host "[APP2] ChatGPT is still loading. DAVID will keep recovering/retrying after startup." -ForegroundColor Yellow
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
  Write-Host "[APP2] AUTOPILOT: plan -> implementation -> tests -> fixes -> production verification -> 100%." -ForegroundColor Green
  Write-Host "[APP2] Edge isolation: separate profile + port $Port." -ForegroundColor Green
  Write-Host "[APP2] Enchev DAVID on 9444 is untouched." -ForegroundColor Green
  Write-Host "[APP2] If ChatGPT asks for login in this Edge, log in once; this profile will keep it." -ForegroundColor Yellow
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
    Write-Host "[APP2] Worker exited with code $code. Retrying in 4s..." -ForegroundColor Yellow
    if (-not (Wait-CdpStable -P $Port -MaxChecks 25)) {
      throw "APP2 Edge/CDP disappeared. Run the launcher again."
    }
    Start-Sleep -Seconds 4
  }
}
finally {
  $RuntimeWorker = Join-Path $Here ".auto-complete-app2-runtime.mjs"
  if (Test-Path $RuntimeWorker) { Remove-Item $RuntimeWorker -Force -ErrorAction SilentlyContinue }
  Pop-Location
}

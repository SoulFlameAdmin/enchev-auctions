param(
  [int]$Port = 9444,
  [int]$MaxTurns = 30,
  [switch]$ResumeOnStart,
  [switch]$FreshSessions
)

$ErrorActionPreference = "Stop"
$ChatUrl = "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$ProfileDir = Join-Path $Root "DAVID_CHATGPT_PROFILE"
$FreshMode = $FreshSessions -or ($env:DAVID_FRESH_SESSIONS_ON_START -eq "1")
$LaunchUrl = if ($FreshMode) { "https://chatgpt.com/" } else { $ChatUrl }

# Keep this file ASCII-only so Windows PowerShell 5.1 cannot corrupt UTF-8 text.
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
  foreach ($regPath in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
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

if (-not (Test-Cdp -P $Port)) {
  $browser = Get-BrowserPath
  if (-not $browser) { throw "No supported Chromium browser was found. Expected Microsoft Edge, Google Chrome, or Brave." }
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  Write-Host "[DAVID] Browser: $browser" -ForegroundColor DarkGray
  Write-Host "[DAVID] Starting dedicated browser profile on CDP port $Port..." -ForegroundColor Cyan
  Start-Process -FilePath $browser -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    $LaunchUrl
  )
  $ok = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 750
    if (Test-Cdp -P $Port) { $ok = $true; break }
  }
  if (-not $ok) { throw "Browser started, but CDP port $Port did not become available. Close the dedicated browser window and run again." }
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $node) { throw "Node.js was not found. Expected portable Node at D:\ASI\tools\node or Node in PATH." }
if (-not $npm) { throw "npm was not found. Expected it beside Node.js or in PATH." }

Push-Location $Here
try {
  if (-not (Test-Path (Join-Path $Here "node_modules\playwright-core"))) {
    Write-Host "[DAVID] Installing local automation dependency..." -ForegroundColor Cyan
    & $npm.Source install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE." }
  }

  if ($ResumeOnStart) {
    Write-Host "[DAVID] ResumeOnStart is legacy. V5 continuous mode always continues and does not use DAVID_STOP." -ForegroundColor Yellow
  }

  $env:DAVID_CDP_URL = "http://127.0.0.1:$Port"
  $env:DAVID_CHAT_URL = $ChatUrl
  $env:DAVID_MAX_TURNS = "$MaxTurns"
  if ($FreshMode) { $env:DAVID_FRESH_SESSIONS_ON_START = "1" } else { Remove-Item Env:DAVID_FRESH_SESSIONS_ON_START -ErrorAction SilentlyContinue }

  Write-Host ""
  Write-Host "[DAVID] TARGET: $LaunchUrl" -ForegroundColor Green
  if ($FreshMode) { Write-Host "[DAVID] FRESH SESSION MODE: old conversation URLs ignored for this boot; profile/login/project state preserved." -ForegroundColor Magenta }
  Write-Host "[DAVID] Continuous mode: GPT reports PROBLEM IN or OK; DAVID keeps working." -ForegroundColor Green
  Write-Host "[DAVID] Ctrl+C manually stops the local process." -ForegroundColor Yellow
  Write-Host ""

  & $npm.Source start
  if ($LASTEXITCODE -ne 0) { throw "DAVID worker exited with code $LASTEXITCODE." }
}
finally { Pop-Location }

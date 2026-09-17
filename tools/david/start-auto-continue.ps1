param(
  [int]$Port = 9444,
  [int]$MaxTurns = 30
)

$ErrorActionPreference = "Stop"
$ChatUrl = "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProfileDir = if (Test-Path "D:\ASI") { "D:\ASI\DAVID_CHATGPT_PROFILE" } else { Join-Path $env:LOCALAPPDATA "DAVID\ChatGPTProfile" }

function Test-Cdp {
  param([int]$P)
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2
    return $true
  } catch {
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
  if (-not $edge) { throw "Не намирам msedge.exe. Стартирай Edge ръчно с --remote-debugging-port=$Port." }

  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  Write-Host "[DAVID] Стартирам отделен Edge профил за ChatGPT на порт $Port..." -ForegroundColor Cyan
  Start-Process -FilePath $edge -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$ProfileDir",
    $ChatUrl
  )

  $ok = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 750
    if (Test-Cdp -P $Port) { $ok = $true; break }
  }
  if (-not $ok) { throw "Edge стартира, но CDP порт $Port не отговаря." }
}

Push-Location $Here
try {
  if (-not (Test-Path (Join-Path $Here "node_modules\playwright-core"))) {
    Write-Host "[DAVID] Инсталирам локалната automation зависимост..." -ForegroundColor Cyan
    npm install
  }

  $env:DAVID_CDP_URL = "http://127.0.0.1:$Port"
  $env:DAVID_CHAT_URL = $ChatUrl
  $env:DAVID_MAX_TURNS = "$MaxTurns"

  Write-Host "" 
  Write-Host "[DAVID] TARGET: $ChatUrl" -ForegroundColor Green
  Write-Host "[DAVID] Ако този отделен Edge профил не е логнат в ChatGPT, логни се веднъж и пусни файла пак." -ForegroundColor Yellow
  Write-Host "[DAVID] Ctrl+C спира automation-а." -ForegroundColor Yellow
  Write-Host ""

  npm start
}
finally {
  Pop-Location
}

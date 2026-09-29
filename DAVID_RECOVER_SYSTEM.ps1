param(
  [int]$TimeoutSeconds = 45,
  [string]$Root = "D:\ASI"
)

$ErrorActionPreference = "Stop"
$Repo = Join-Path $Root "enchev-auctions"
$DavidDir = Join-Path $Repo "tools\david"
$RequestFile = Join-Path $DavidDir ".david-recovery-request.json"
$ResultFile = Join-Path $DavidDir ".david-recovery-result.json"
$ScientistCommandFile = Join-Path $DavidDir ".sf-scientist-supervisor-command.json"
$ScientistResultFile = Join-Path $DavidDir ".sf-scientist-supervisor-result.json"
$StateFile = Join-Path $DavidDir ".david-enchev-state.json"
$RateFile = Join-Path $DavidDir ".david-global-chatgpt-rate-limit.json"

function Read-JsonSafe([string]$Path) {
  try {
    if (Test-Path -LiteralPath $Path) {
      $raw = Get-Content -Raw -LiteralPath $Path
      if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
      return $raw | ConvertFrom-Json
    }
  } catch {}
  return $null
}

function Count-Node([string]$Needle) {
  try {
    return @(Get-CimInstance Win32_Process | Where-Object {
      $_.Name -eq "node.exe" -and ([string]$_.CommandLine) -like "*$Needle*"
    }).Count
  } catch { return 0 }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host " DAVID RECOVER SYSTEM // SAFE SUPERVISOR REQUEST" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGreen

$supervisors = Count-Node "dual-session-worker.mjs"
$systems = Count-Node "auto-continue-enchev-v5.mjs"

Write-Host ("[CHECK] supervisor={0} system={1}" -f $supervisors,$systems) -ForegroundColor Cyan

if ($supervisors -ne 1) {
  throw "Expected exactly one DAVID supervisor. No recovery request was sent."
}

$rate = Read-JsonSafe $RateFile
$useScientistChannel = $false
if ($rate) {
  $rateStatus = ([string]$rate.status).ToLowerInvariant()

  if ($rateStatus -eq "probe") {
    Write-Host ("[WAIT] Active global probe owner={0}. SYSTEM restart remains deferred." -f $rate.probeOwner) -ForegroundColor Yellow
    exit 2
  }

  if ($rateStatus -eq "blocked") {
    $blockedExpired = $false
    try {
      $blockedExpired = (-not $rate.blockedUntil) -or ([DateTimeOffset]::Parse([string]$rate.blockedUntil) -le [DateTimeOffset]::Now)
    } catch { $blockedExpired = $false }

    if (-not $blockedExpired) {
      Write-Host ("[WAIT] Global cooldown is still active until {0}. SYSTEM restart remains deferred." -f $rate.blockedUntil) -ForegroundColor Yellow
      exit 2
    }

    $useScientistChannel = $true
    Write-Host "[SAFE] Cooldown has expired but coordinator is still marked blocked." -ForegroundColor Yellow
    Write-Host "[SAFE] Using SF Scientist supervisor channel; it will reject restart if SYSTEM/ChatGPT shows active work." -ForegroundColor Yellow
  }
}

$id = [guid]::NewGuid().ToString()
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ($useScientistChannel) {
  $command = [ordered]@{
    id = $id
    createdAt = [DateTimeOffset]::Now.ToString("o")
    sourceChatUrl = $null
    actions = @(
      [ordered]@{
        type = "RESTART"
        target = "SYSTEM"
      }
    )
  }

  $tmp = $ScientistCommandFile + ".tmp"
  $json = $command | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($tmp, $json, $utf8NoBom)
  Move-Item -LiteralPath $tmp -Destination $ScientistCommandFile -Force
  Write-Host ("[REQUEST] Protected SF Scientist SYSTEM restart requested. id={0}" -f $id) -ForegroundColor Cyan

  $deadline = (Get-Date).AddSeconds([math]::Max(10,$TimeoutSeconds))
  $scientistResult = $null
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $candidate = Read-JsonSafe $ScientistResultFile
    if ($candidate -and $candidate.id -eq $id) {
      $scientistResult = $candidate
      break
    }
  }

  if (-not $scientistResult) {
    throw "SF Scientist supervisor result timed out."
  }

  $actionResult = @($scientistResult.results) | Select-Object -First 1
  if (-not $actionResult -or -not $actionResult.ok) {
    $detail = if ($actionResult) { $actionResult.detail } else { "missing action result" }
    Write-Host ("[SAFE-NO-RESTART] " + $detail) -ForegroundColor Yellow
    exit 3
  }

  Write-Host ("[RECOVERY] " + $actionResult.detail) -ForegroundColor Green
} else {
  $request = [ordered]@{
    id = $id
    target = "SYSTEM"
    action = "RESTART"
    createdAt = [DateTimeOffset]::Now.ToString("o")
    reason = "SYSTEM state telemetry was zero-byte/stale; apply atomic state persistence fix"
  }

  $tmp = $RequestFile + ".tmp"
  $json = $request | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($tmp, $json, $utf8NoBom)
  Move-Item -LiteralPath $tmp -Destination $RequestFile -Force

  Write-Host ("[REQUEST] Safe SYSTEM restart requested. id={0}" -f $id) -ForegroundColor Cyan

  $deadline = (Get-Date).AddSeconds([math]::Max(10,$TimeoutSeconds))
  $result = $null
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $candidate = Read-JsonSafe $ResultFile
    if ($candidate -and $candidate.id -eq $id) {
      $result = $candidate
      break
    }
  }

  if (-not $result) {
    throw "Supervisor recovery result timed out."
  }

  if (-not $result.ok) {
    Write-Host ("[SAFE-NO-RESTART] " + $result.detail) -ForegroundColor Yellow
    exit 3
  }

  Write-Host ("[RECOVERY] " + $result.detail) -ForegroundColor Green
}

$stateDeadline = (Get-Date).AddSeconds([math]::Max(15,$TimeoutSeconds))
$state = $null
while ((Get-Date) -lt $stateDeadline) {
  Start-Sleep -Milliseconds 500
  $state = Read-JsonSafe $StateFile
  if ($state -and $state.updatedAt -and $state.watchdog) { break }
  $state = $null
}

if (-not $state) {
  throw "SYSTEM restarted but valid runtime state did not appear within timeout."
}

Write-Host ("[PASS] SYSTEM telemetry restored: watchdog={0} updatedAt={1}" -f $state.watchdog,$state.updatedAt) -ForegroundColor Green
Write-Host "[PASS] No taskkill / Stop-Process was used." -ForegroundColor Green

param(
  [int]$MaxWaitMinutes = 10,
  [int]$PollSeconds = 2,
  [string]$Root = "D:\ASI"
)

$ErrorActionPreference = "Stop"
$Repo = Join-Path $Root "enchev-auctions"
$DavidDir = Join-Path $Repo "tools\david"
$RateFile = Join-Path $DavidDir ".david-global-chatgpt-rate-limit.json"
$RecoverScript = Join-Path $Repo "DAVID_RECOVER_SYSTEM.ps1"
$ReportScript = Join-Path $Repo "DAVID_LIVE_MISSION_REPORT.ps1"
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

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

function Format-Remaining([object]$Iso) {
  if (-not $Iso) { return "-" }
  try {
    $target = [DateTimeOffset]::Parse([string]$Iso)
    $seconds = [math]::Max(0, [math]::Ceiling(($target - [DateTimeOffset]::Now).TotalSeconds))
    $m = [math]::Floor($seconds / 60)
    $s = $seconds % 60
    return ("{0:D2}:{1:D2}" -f [int]$m,[int]$s)
  } catch { return "?" }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor DarkGreen
Write-Host " DAVID WAIT -> RECOVER SYSTEM -> LIVE REPORT" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor DarkGreen
Write-Host "[SAFE] This script never clears/bypasses the global rate-limit state." -ForegroundColor Yellow
Write-Host "[SAFE] It waits for coordinator status=clear, then uses supervisor-mediated SYSTEM recovery." -ForegroundColor Yellow

if (-not (Test-Path $RecoverScript)) { throw "Missing recovery script: $RecoverScript" }
if (-not (Test-Path $ReportScript)) { throw "Missing live report script: $ReportScript" }

$deadline = (Get-Date).AddMinutes([math]::Max(1,$MaxWaitMinutes))
$lastLine = ""

while ((Get-Date) -lt $deadline) {
  $rate = Read-JsonSafe $RateFile
  if (-not $rate) {
    $line = "[WAIT] Rate-limit state unavailable; waiting for coordinator file..."
  } else {
    $status = ([string]$rate.status).ToLowerInvariant()
    if ($status -eq "clear") {
      Write-Host "[CLEAR] Global ChatGPT rate-limit coordinator is clear." -ForegroundColor Green
      break
    }

    $remaining = if ($status -eq "probe") {
      Format-Remaining $rate.probeLeaseUntil
    } elseif ($status -eq "blocked") {
      Format-Remaining $rate.blockedUntil
    } else {
      "-"
    }

    $owner = if ($rate.probeOwner) { [string]$rate.probeOwner } else { "none" }
    $line = "[WAIT] status=$status owner=$owner remaining=$remaining"
  }

  if ($line -ne $lastLine) {
    Write-Host $line -ForegroundColor Cyan
    $lastLine = $line
  }

  Start-Sleep -Seconds ([math]::Max(1,$PollSeconds))
}

$finalRate = Read-JsonSafe $RateFile
if (-not $finalRate -or ([string]$finalRate.status).ToLowerInvariant() -ne "clear") {
  Write-Host "[TIMEOUT] Coordinator did not reach clear within the wait window." -ForegroundColor Yellow
  if ($finalRate) {
    Write-Host ("[STATE] status={0} probeOwner={1} probeLeaseUntil={2} blockedUntil={3}" -f
      $finalRate.status,$finalRate.probeOwner,$finalRate.probeLeaseUntil,$finalRate.blockedUntil) -ForegroundColor Yellow
  }
  Write-Host "[SAFE] No recovery or manual rate-limit clear was attempted." -ForegroundColor Yellow
  exit 2
}

Write-Host "[RECOVER] Starting safe SYSTEM recovery..." -ForegroundColor Cyan
& $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $RecoverScript
$recoverExit = $LASTEXITCODE

if ($recoverExit -ne 0) {
  Write-Host ("[STOP] SYSTEM recovery returned exit code {0}. Live report not auto-opened." -f $recoverExit) -ForegroundColor Yellow
  exit $recoverExit
}

Write-Host "[READY] SYSTEM recovery PASS. Opening live mission report..." -ForegroundColor Green
& $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $ReportScript

param(
  [int]$RefreshMs = 1000,
  [string]$Root = "D:\ASI"
)

$ErrorActionPreference = "SilentlyContinue"
$Repo = Join-Path $Root "enchev-auctions"
$DavidDir = Join-Path $Repo "tools\david"

function Read-JsonSafe([string]$Path) {
  try {
    if (Test-Path -LiteralPath $Path) {
      return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    }
  } catch {}
  return $null
}

function Short([object]$Value, [int]$Max = 110) {
  $s = [string]$Value
  if ([string]::IsNullOrWhiteSpace($s)) { return "-" }
  $s = ($s -replace "\s+", " ").Trim()
  if ($s.Length -gt $Max) { return $s.Substring(0, $Max - 3) + "..." }
  return $s
}

function Age([object]$Iso) {
  if (-not $Iso) { return "?" }
  try {
    $t = [DateTimeOffset]::Parse([string]$Iso)
    $s = [math]::Max(0, [math]::Round(([DateTimeOffset]::Now - $t).TotalSeconds))
    return "$s" + "s"
  } catch { return "?" }
}

function Count-Proc([string]$Needle) {
  try {
    return @(Get-CimInstance Win32_Process | Where-Object {
      ([string]$_.CommandLine) -like "*$Needle*"
    }).Count
  } catch { return 0 }
}

function Get-WorkerState([string]$Name) {
  switch ($Name) {
    "SYSTEM" { return Read-JsonSafe (Join-Path $DavidDir ".david-enchev-state.json") }
    "APP2" {
      $f = Get-ChildItem -LiteralPath $DavidDir -Filter ".david-app2-state*.json" |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($f) { return Read-JsonSafe $f.FullName }
      return $null
    }
    "APK" { return Read-JsonSafe (Join-Path $DavidDir ".david-apk-state.json") }
    default { return $null }
  }
}

function Write-Line([string]$Text, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
  Write-Host $Text -ForegroundColor $Color
}

function Render-Worker([string]$Name, $State) {
  if (-not $State) {
    Write-Line ("{0,-7} OFFLINE / NO STATE" -f $Name) Red
    return
  }

  $watch = Short $State.watchdog 38
  $action = Short $State.lastAction 105
  $intent = Short $State.lastPromptPreview 105
  $problem = Short $State.problem 105
  $send = Short $State.lastSendStatus 28
  $age = Age $State.updatedAt
  $turns = if ($null -ne $State.turnsSent) { $State.turnsSent } else { 0 }

  $color = if ($State.problem) { "Red" } elseif ($watch -match "thinking|writing|active|sending|processing|waiting|acknowledged|next-task-ready|complete") { "Green" } else { "Yellow" }

  Write-Line ("[{0}] stage={1}  turns={2}  age={3}" -f $Name,$watch,$turns,$age) $color
  Write-Line ("  NOW:    " + $action) Cyan
  Write-Line ("  INTENT: " + $intent) White
  Write-Line ("  SEND:   " + $send) DarkCyan
  if ($State.problem) {
    Write-Line ("  BLOCKER:" + " " + $problem) Red
  }
  Write-Line ""
}

try {
  $Host.UI.RawUI.WindowTitle = "DAVID // LIVE MISSION REPORT"
} catch {}

while ($true) {
  Clear-Host

  $system = Get-WorkerState "SYSTEM"
  $app2 = Get-WorkerState "APP2"
  $apk = Get-WorkerState "APK"

  $learning = Read-JsonSafe (Join-Path $DavidDir ".david-learning-runtime.json")
  $upgrade = Read-JsonSafe (Join-Path $DavidDir ".david-self-upgrade-runtime.json")
  $tabs = Read-JsonSafe (Join-Path $DavidDir ".david-tab-monitor.json")

  $branch = "-"
  $commit = "-"
  try {
    $git = Join-Path $Root "tools\PortableGit\cmd\git.exe"
    if (-not (Test-Path $git)) { $git = "git" }
    $branch = (& $git -C $Repo rev-parse --abbrev-ref HEAD 2>$null | Select-Object -First 1)
    $commit = (& $git -C $Repo rev-parse --short HEAD 2>$null | Select-Object -First 1)
  } catch {}

  Write-Line "====================================================================================================" DarkGreen
  Write-Line "                              DAVID // LIVE MISSION REPORT" Green
  Write-Line "====================================================================================================" DarkGreen
  Write-Line ("TIME: {0}   BRANCH: {1}   COMMIT: {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),$branch,$commit) Gray
  Write-Line ("PROCESSES: supervisor={0} system={1} app2={2} apk={3}" -f
    (Count-Proc "dual-session-worker.mjs"),
    (Count-Proc "auto-continue-enchev-v5.mjs"),
    (Count-Proc "auto-complete-app2-v1.mjs"),
    (Count-Proc "auto-continue-david-apk-v1.mjs")) Gray
  if ($tabs) {
    Write-Line ("CHATGPT TABS: {0}" -f $tabs.totalChatGptTabs) Gray
  }
  Write-Line ""
  Write-Line "IMPORTANT: INTENT is the actual outgoing task/prompt preview and NOW is runtime action telemetry." Magenta
  Write-Line "It is not hidden chain-of-thought. It shows auditable operational planning only." DarkMagenta
  Write-Line ""

  Render-Worker "SYSTEM" $system
  Render-Worker "APP2" $app2
  Render-Worker "APK" $apk

  Write-Line "------------------------- STAGE 7 // LEARNING ------------------------------------------------------" Green
  if ($learning) {
    Write-Line ("STATUS:   " + (Short $learning.status 100)) Cyan
    Write-Line ("GOAL:     " + (Short $learning.goal 100)) White
    Write-Line ("SKILL:    " + (Short $learning.selectedSkill 100)) White
    Write-Line ("DECISION: " + (Short $learning.decision 100)) Yellow
    Write-Line ("EVIDENCE: " + (Short $learning.evidence 100)) Gray
  } else {
    Write-Line "Runtime learning telemetry file is not wired yet. Stage 7 code exists, but live PC hook is still pending." Yellow
  }

  Write-Line ""
  Write-Line "------------------------- STAGE 8 // SELF-UPGRADE -------------------------------------------------" Green
  if ($upgrade) {
    Write-Line ("WEAKNESS:  " + (Short $upgrade.weakness 100)) White
    Write-Line ("PROPOSAL:  " + (Short $upgrade.proposal 100)) White
    Write-Line ("CANDIDATE: " + (Short $upgrade.candidate 100)) Cyan
    Write-Line ("TEST:      " + (Short $upgrade.testStatus 100)) Yellow
    Write-Line ("DECISION:  " + (Short $upgrade.decision 100)) Magenta
  } else {
    Write-Line "Runtime self-upgrade telemetry file is not wired yet. Stage 8 is isolated/tested but not live-hooked." Yellow
  }

  Write-Line ""
  Write-Line ("Refresh: {0} ms | Ctrl+C closes only this report; DAVID workers continue running." -f $RefreshMs) DarkGray
  Start-Sleep -Milliseconds ([math]::Max(250,$RefreshMs))
}

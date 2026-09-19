param(
  [int]$RefreshSeconds = 3,
  [int]$LiveTimerTickMs = 16,
  [string]$Root = "D:\ASI"
)

$ErrorActionPreference = "SilentlyContinue"
$Repo = Join-Path $Root "enchev-auctions"
$DavidDir = Join-Path $Repo "tools\david"
$DashboardState = Join-Path $DavidDir ".david-dashboard-status.json"

try {
  $Host.UI.RawUI.WindowTitle = "DAVID MATRIX CONTROL // LIVE AUTONOMY REPORT"
  $Host.UI.RawUI.BackgroundColor = "Black"
  $Host.UI.RawUI.ForegroundColor = "Gray"
  Clear-Host
} catch {}

function Read-JsonSafe([string]$Path) {
  try {
    if (Test-Path $Path) { return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json }
  } catch {}
  return $null
}

function ClampPct([double]$Value) {
  if ([double]::IsNaN($Value) -or [double]::IsInfinity($Value)) { return 0.0 }
  if ($Value -lt 0) { return 0.0 }
  if ($Value -gt 100) { return 100.0 }
  return [math]::Round($Value, 1)
}

function CalcPct([int]$Green, [int]$Total) {
  if ($Total -le 0) { return $null }
  return ClampPct (($Green * 100.0) / $Total)
}

function Unique-Matches([string]$Text, [string]$Pattern) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  if (-not $Text) { return @() }
  foreach ($m in [regex]::Matches($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    if ($m.Groups.Count -gt 1) { [void]$set.Add($m.Groups[1].Value.ToUpperInvariant()) }
  }
  return @($set)
}

function Get-SystemProgress {
  $planSource = Join-Path $Repo "app\components\MasterSystemPlanV1.tsx"
  $verified = Join-Path $Repo "app\components\VerifiedPlanEvidenceSync.tsx"
  $gaps = Join-Path $Repo "app\components\SeedAuditGaps.tsx"
  $planText = if (Test-Path $planSource) { Get-Content -Raw $planSource } else { "" }
  $verifiedText = if (Test-Path $verified) { Get-Content -Raw $verified } else { "" }
  $gapText = if (Test-Path $gaps) { Get-Content -Raw $gaps } else { "" }

  $total = New-Object 'System.Collections.Generic.HashSet[string]'
  $green = New-Object 'System.Collections.Generic.HashSet[string]'

  $phaseRegex = New-Object System.Text.RegularExpressions.Regex(
    '\["(\d{2})","[^"]+",\[(.*?)\]\]',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  foreach ($pm in $phaseRegex.Matches($planText)) {
    $phaseId = $pm.Groups[1].Value
    $items = [regex]::Matches($pm.Groups[2].Value, '"((?:\\.|[^"\\])*)"')
    $index = 0
    foreach ($im in $items) {
      $index++
      $id = "{0}.{1:D2}" -f $phaseId,$index
      [void]$total.Add($id)
      $entry = $im.Groups[1].Value
      $parts = $entry -split '\|'
      if ($parts.Count -gt 1 -and $parts[1].Trim().ToLowerInvariant() -eq "green") {
        [void]$green.Add($id)
      }
    }
  }

  # Expansion v2 phases 62-99 are part of the same SYSTEM total.
  foreach ($part in 1..4) {
    $expansionPath = Join-Path $Repo ("app\master-system-expansion-v2\part-{0}.json" -f $part)
    $expansion = Read-JsonSafe $expansionPath
    if (-not $expansion -or -not $expansion.phases) { continue }
    foreach ($phase in @($expansion.phases)) {
      $phaseId = [string]$phase.id
      $index = 0
      foreach ($task in @($phase.tasks)) {
        $index++
        $id = "{0}.{1:D2}" -f $phaseId,$index
        [void]$total.Add($id)
        if (([string]$task.defaultStatus).ToLowerInvariant() -eq "green") {
          [void]$green.Add($id)
        }
      }
    }
  }

  foreach ($id in (Unique-Matches $verifiedText '["'']((?:\d{2}\.\d{2})|(?:GAP-\d{3,}))["'']\s*:')) {
    if ($total.Contains($id)) { [void]$green.Add($id) }
  }

  foreach ($gm in [regex]::Matches($gapText, 'id\s*:\s*"((?:GAP-|GAP\.)[^"]+)"')) {
    $id = $gm.Groups[1].Value.ToUpperInvariant()
    [void]$total.Add($id)
    $windowStart = [math]::Max(0, $gm.Index - 100)
    $windowLen = [math]::Min(500, $gapText.Length - $windowStart)
    $window = $gapText.Substring($windowStart, $windowLen)
    if ($window -match 'defaultStatus\s*:\s*"green"') { [void]$green.Add($id) }
  }

  $g = @($green | Where-Object { $total.Contains($_) }).Count
  [pscustomobject]@{ Name="SYSTEM"; Green=$g; Total=$total.Count; Percent=(CalcPct $g $total.Count) }
}

function Get-DesignV1Progress {
  $path = Join-Path $Repo "app\design-plan-evidence.json"
  $j = Read-JsonSafe $path
  $tasks = @()
  if ($j -and $j.tasks) {
    $tasks = @($j.tasks | Where-Object { ([string]$_.id) -match '^D\d{2}$' })
  }
  $green = @($tasks | Where-Object { ([string]$_.status).ToLowerInvariant() -eq "green" }).Count
  [pscustomobject]@{
    Name="DESIGN V1"
    Green=$green
    Total=$tasks.Count
    Percent=(CalcPct $green $tasks.Count)
    Complete=($tasks.Count -eq 36 -and $green -eq 36)
  }
}

function Get-Design2Progress {
  $path = Join-Path $Repo "app\design-process-2-evidence.json"
  $j = Read-JsonSafe $path
  $tasks = @()
  if ($j -and $j.tasks) { $tasks = @($j.tasks) }
  $green = @($tasks | Where-Object { ([string]$_.status).ToLowerInvariant() -eq "green" }).Count
  [pscustomobject]@{
    Name="DESIGN2"
    Green=$green
    Total=$tasks.Count
    Percent=(CalcPct $green $tasks.Count)
    Complete=($tasks.Count -gt 0 -and $green -eq $tasks.Count)
  }
}

function Find-DppPlan {
  $candidates = @(
    (Join-Path $Root "DPPautopilot\docs\MASTER_AUTOPILOT_PLAN.md"),
    (Join-Path $Root "dpp-autopilot\docs\MASTER_AUTOPILOT_PLAN.md"),
    (Join-Path $Root "DPPAutopilot\docs\MASTER_AUTOPILOT_PLAN.md")
  )
  foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
  return $null
}

function Get-DppProgress {
  $path = Find-DppPlan
  if (-not $path) { return [pscustomobject]@{ Name="DPP"; Green=0; Total=0; Percent=$null } }
  $lines = Get-Content -LiteralPath $path
  $rows = @($lines | Where-Object { $_ -match '^\s*\|\s*[A-Z]\d{2}\s*\|' })
  $green = @($rows | Where-Object { $_ -match '\|\s*GREEN\s*\|\s*$' }).Count
  [pscustomobject]@{ Name="DPP"; Green=$green; Total=$rows.Count; Percent=(CalcPct $green $rows.Count) }
}

function Count-ProcessNeedle([string]$Needle, [string[]]$Names = @("node.exe")) {
  $count = 0
  try {
    foreach ($p in Get-CimInstance Win32_Process) {
      if ($Names -notcontains ([string]$p.Name).ToLowerInvariant()) { continue }
      $cmd = [string]$p.CommandLine
      if ($cmd -and $cmd -like "*$Needle*") { $count++ }
    }
  } catch {}
  return $count
}

function Test-DavidCdp {
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:9444/json/version" -TimeoutSec 1
    return $true
  } catch { return $false }
}

function Get-State([string]$Kind) {
  switch ($Kind) {
    "SYSTEM" { return Read-JsonSafe (Join-Path $DavidDir ".david-enchev-state.json") }
    "DESIGN" { return Read-JsonSafe (Join-Path $DavidDir ".david-enchev-design-state.json") }
    "APP2" {
      $f = Get-ChildItem -LiteralPath $DavidDir -Filter ".david-app2-state*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($f) { return Read-JsonSafe $f.FullName }
      return $null
    }
    "APK" { return Read-JsonSafe (Join-Path $DavidDir ".david-apk-state.json") }
    "CONTROL" { return Read-JsonSafe (Join-Path $DavidDir ".david-control-state.json") }
  }
}

function Short([object]$Value, [int]$Max = 92) {
  $s = [string]$Value
  if ([string]::IsNullOrWhiteSpace($s)) { return "-" }
  $s = ($s -replace '\s+',' ').Trim()
  if ($s.Length -gt $Max) { return $s.Substring(0, $Max - 3) + "..." }
  return $s
}

function Progress-Bar($Pct, [int]$Width = 42) {
  if ($null -eq $Pct) { return "[" + ("?" * $Width) + "]" }
  try { $value = [double]$Pct } catch { return "[" + ("?" * $Width) + "]" }
  $filled = [int][math]::Round(($value / 100.0) * $Width)
  if ($filled -lt 0) { $filled = 0 }
  if ($filled -gt $Width) { $filled = $Width }
  return "[" + ("#" * $filled) + ("-" * ($Width - $filled)) + "]"
}

function Format-Countdown([object]$UntilValue) {
  if (-not $UntilValue) { return "00:00:00.000" }
  try {
    $until = [DateTimeOffset]::Parse(
      [string]$UntilValue,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [System.Globalization.DateTimeStyles]::RoundtripKind
    ).ToUniversalTime()
    $remainingMs = [int64][math]::Max(0,[math]::Ceiling(($until - [DateTimeOffset]::UtcNow).TotalMilliseconds))
    $hours = [int64][math]::Floor($remainingMs / 3600000)
    $minutes = [int64][math]::Floor(($remainingMs % 3600000) / 60000)
    $seconds = [int64][math]::Floor(($remainingMs % 60000) / 1000)
    $millis = [int64]($remainingMs % 1000)
    return ("{0:D2}:{1:D2}:{2:D2}.{3:D3}" -f $hours,$minutes,$seconds,$millis)
  } catch { return "00:00:00.000" }
}

function Format-LocalTime([object]$UntilValue) {
  if (-not $UntilValue) { return "-" }
  try {
    return [DateTimeOffset]::Parse(
      [string]$UntilValue,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [System.Globalization.DateTimeStyles]::RoundtripKind
    ).ToLocalTime().ToString("HH:mm:ss")
  } catch { return "-" }
}

function Write-Fit([string]$Text, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
  $width = 120
  try { $width = [math]::Max(80, [Console]::WindowWidth - 1) } catch {}
  if ($Text.Length -gt $width) { $Text = $Text.Substring(0, $width) }
  $line = $Text.PadRight($width)
  Write-Host $line -ForegroundColor $Color -BackgroundColor Black
}

function Write-FitAtRow(
  [int]$Row,
  [string]$Text,
  [ConsoleColor]$Color = [ConsoleColor]::Gray,
  [int]$RestoreRow = -1
) {
  if ($Row -lt 0) { return }
  try {
    $width = [math]::Max(80, [Console]::WindowWidth - 1)
    if ($Text.Length -gt $width) { $Text = $Text.Substring(0, $width) }
    $line = $Text.PadRight($width)
    [Console]::SetCursorPosition(0, $Row)
    Write-Host $line -NoNewline -ForegroundColor $Color -BackgroundColor Black
    if ($RestoreRow -ge 0) {
      [Console]::SetCursorPosition(0, $RestoreRow)
    }
  } catch {}
}

function Matrix-Fill {
  try {
    # Repaint in-place instead of Clear-Host so the live timer never blinks.
    [Console]::SetCursorPosition(0, 0)
    $w = [math]::Max(80, [Console]::WindowWidth - 1)
    $chars = "01DAVIDSOUL"
    $sb = New-Object System.Text.StringBuilder
    for ($x=0; $x -lt $w; $x++) {
      [void]$sb.Append($chars[(Get-Random -Minimum 0 -Maximum $chars.Length)])
    }
    Write-Host $sb.ToString().PadRight($w) -ForegroundColor DarkGreen -BackgroundColor Black
  } catch {}
}

function Render-Worker([string]$Name, $State) {
  if (-not $State) {
    Write-Fit ("{0,-8} OFFLINE/NO STATE" -f $Name) Red
    return
  }
  $watch = Short $State.watchdog 28
  $action = Short $State.lastAction 70
  $turns = if ($null -ne $State.turnsSent) { $State.turnsSent } else { 0 }
  $problem = Short $State.problem 70
  $color = if ($State.problem) { [ConsoleColor]::Red } elseif (($watch -match 'thinking|writing|sending|online|monitoring|complete')) { [ConsoleColor]::Green } else { [ConsoleColor]::Yellow }
  Write-Fit ("{0,-8} watchdog={1,-28} turns={2,-6} action={3}" -f $Name,$watch,$turns,$action) $color
  if ($State.problem) { Write-Fit ("          BLOCKER: " + $problem) Red }
}

while ($true) {
  $system = Get-SystemProgress
  $designV1 = Get-DesignV1Progress
  $design2 = Get-Design2Progress
  $dpp = Get-DppProgress

  # Active-scope total excludes completed DESIGN V1 to avoid double counting.
  $sumGreen = 0
  $sumTotal = 0
  foreach ($p in @($system,$design2,$dpp)) {
    if ($p.Total -gt 0) { $sumGreen += $p.Green; $sumTotal += $p.Total }
  }
  $overall = CalcPct $sumGreen $sumTotal
  if ($null -eq $overall) { $overall = 0.0 }

  $sysState = Get-State "SYSTEM"
  $desState = Get-State "DESIGN"
  $appState = Get-State "APP2"
  $apkState = Get-State "APK"
  $controlState = Get-State "CONTROL"
  $tabs = Read-JsonSafe (Join-Path $DavidDir ".david-tab-monitor.json")
  $rateLimit = Read-JsonSafe (Join-Path $DavidDir ".david-global-chatgpt-rate-limit.json")
  $sessionHealth = Read-JsonSafe (Join-Path $DavidDir ".david-session-health.json")

  Matrix-Fill
  Write-Fit "================================================================================================================" Green
  Write-Fit "                                  D A V I D   //   MATRIX CONTROL" Green
  Write-Fit "================================================================================================================" Green
  Write-Fit ("  TOTAL VERIFIED PROGRESS: {0,6:N1}%    {1}" -f $overall,(Progress-Bar $overall 48)) Red
  Write-Fit ("  GREEN EVIDENCE: {0} / {1} measurable plan items" -f $sumGreen,$sumTotal) White
  Write-Fit ""
  Write-Fit ("  SYSTEM    {0,6}  {1}  GREEN {2}/{3}" -f ($(if($null -ne $system.Percent){"$($system.Percent)%"}else{"N/A"})),(Progress-Bar $system.Percent 36),$system.Green,$system.Total) Cyan
  Write-Fit ("  DESIGN V1 {0,6}  {1}  GREEN {2}/{3}  {4}" -f ($(if($null -ne $designV1.Percent){"$($designV1.Percent)%"}else{"N/A"})),(Progress-Bar $designV1.Percent 36),$designV1.Green,$designV1.Total,$(if($designV1.Complete){"COMPLETE"}else{"CHECK"})) $(if($designV1.Complete){[ConsoleColor]::Green}else{[ConsoleColor]::Yellow})
  Write-Fit ("  DESIGN2   {0,6}  {1}  GREEN {2}/{3}  {4}" -f ($(if($null -ne $design2.Percent){"$($design2.Percent)%"}else{"N/A"})),(Progress-Bar $design2.Percent 36),$design2.Green,$design2.Total,$(if($design2.Complete){"COMPLETE"}else{"ACTIVE"})) Cyan
  Write-Fit ("  DPP       {0,6}  {1}  GREEN {2}/{3}" -f ($(if($null -ne $dpp.Percent){"$($dpp.Percent)%"}else{"N/A"})),(Progress-Bar $dpp.Percent 36),$dpp.Green,$dpp.Total) Cyan
  Write-Fit "  APK     plan%=N/A (no formal finite APK plan yet) -- live worker state shown below" Cyan
  Write-Fit ""
  Write-Fit "  ------------------------------ LIVE WORKERS ----------------------------------------------------" Green
  Render-Worker "CONTROL" $controlState
  Render-Worker "SYSTEM"  $sysState
  Render-Worker "DESIGN"  $desState
  Render-Worker "APP2"    $appState
  Render-Worker "APK"     $apkState
  Write-Fit ""
  Write-Fit "  ------------------------------ TAB OWNERSHIP ----------------------------------------------------" Green
  $tabStable = $false
  if ($tabs -and $tabs.managed) {
    $cc = @($tabs.managed.CONTROL).Count
    $sc = @($tabs.managed.SYSTEM).Count
    $dc = @($tabs.managed.DESIGN).Count
    $ac = @($tabs.managed.APP2).Count
    $kc = @($tabs.managed.APK).Count
    $tabStable = ($cc -eq 1 -and $sc -eq 1 -and $dc -eq 1 -and $ac -eq 1 -and $kc -eq 1 -and [int]$tabs.totalChatGptTabs -eq 5)
    Write-Fit ("  CONTROL={0} SYSTEM={1} DESIGN={2} APP2={3} APK={4} ChatGPT tabs={5} => {6}" -f $cc,$sc,$dc,$ac,$kc,$tabs.totalChatGptTabs,$(if($tabStable){"TAB-STABLE"}else{"CHECK"})) $(if($tabStable){[ConsoleColor]::Green}else{[ConsoleColor]::Red})
    if ($tabs.workerHealth) {
      $ch = $tabs.workerHealth.CONTROL
      $sh = $tabs.workerHealth.SYSTEM
      $dh = $tabs.workerHealth.DESIGN
      $ah = $tabs.workerHealth.APP2
      $kh = $tabs.workerHealth.APK
      $ccs = if ($null -ne $ch.heartbeatAgeMs) { [math]::Round(([double]$ch.heartbeatAgeMs)/1000) } else { "?" }
      $ss = if ($null -ne $sh.heartbeatAgeMs) { [math]::Round(([double]$sh.heartbeatAgeMs)/1000) } else { "?" }
      $dd = if ($null -ne $dh.heartbeatAgeMs) { [math]::Round(([double]$dh.heartbeatAgeMs)/1000) } else { "?" }
      $aa = if ($null -ne $ah.heartbeatAgeMs) { [math]::Round(([double]$ah.heartbeatAgeMs)/1000) } else { "?" }
      $kk = if ($null -ne $kh.heartbeatAgeMs) { [math]::Round(([double]$kh.heartbeatAgeMs)/1000) } else { "?" }
      Write-Fit ("  HEARTBEAT age(s): CONTROL={0} SYSTEM={1} DESIGN={2} APP2={3} APK={4} | self-heal stale>600s / missing-tab>90s" -f $ccs,$ss,$dd,$aa,$kk) DarkCyan
    }
  } else {
    Write-Fit "  Tab monitor state not available yet..." Yellow
  }
  Write-Fit ""
  Write-Fit "  ------------------------------ GPT SESSION RESILIENCE ------------------------------------------" Green
  if ($sessionHealth -and $sessionHealth.workers) {
    foreach ($sessionName in @("CONTROL","SYSTEM","DESIGN","APP2","APK")) {
      $h = $null
      try { $h = $sessionHealth.workers.PSObject.Properties[$sessionName].Value } catch {}
      if ($h) {
        $st = Short $h.state 26
        $issue = Short $h.issue 24
        $act = Short $h.action 24
        $detail = Short $h.detail 48
        $sessionColor = if ($h.issue -and ([string]$h.issue) -ne "none") { [ConsoleColor]::Yellow } elseif (($st -match 'active|ready')) { [ConsoleColor]::Green } else { [ConsoleColor]::Gray }
        Write-Fit ("  {0,-8} state={1,-26} issue={2,-24} action={3,-24} {4}" -f $sessionName,$st,$issue,$act,$detail) $sessionColor
      } else {
        Write-Fit ("  {0,-8} session-health=pending" -f $sessionName) DarkGray
      }
    }
  } else {
    Write-Fit "  Session resilience health not available yet..." Yellow
  }

  Write-Fit ""
  Write-Fit "  ------------------------------ RUNTIME INVARIANTS ----------------------------------------------" Green
  $proc = [ordered]@{
    SUPERVISOR = (Count-ProcessNeedle "dual-session-worker.mjs")
    SYSTEM = (Count-ProcessNeedle "auto-continue-enchev-v5.mjs")
    DESIGN = (Count-ProcessNeedle "auto-continue-design-v1.mjs")
    APP2 = (Count-ProcessNeedle "auto-complete-app2-v1.mjs")
    APK = (Count-ProcessNeedle "auto-continue-david-apk-v1.mjs")
    CONTROL = (Count-ProcessNeedle "auto-control-watchtower-v1.mjs")
    GUARD = (Count-ProcessNeedle "connection-interruption-guard.mjs")
  }
  $matrixCount = Count-ProcessNeedle "david-status-dashboard.ps1" @("powershell.exe","pwsh.exe")
  $processStable = $true
  foreach ($v in $proc.Values) { if ([int]$v -ne 1) { $processStable = $false } }
  if ($matrixCount -ne 1) { $processStable = $false }
  $cdpOnline = Test-DavidCdp
  $runtimeStable = ($tabStable -and $processStable -and $cdpOnline)

  Write-Fit ("  PROC SUP={0} SYS={1} DES={2} APP2={3} APK={4} CTRL={5} GUARD={6} MATRIX={7}" -f $proc.SUPERVISOR,$proc.SYSTEM,$proc.DESIGN,$proc.APP2,$proc.APK,$proc.CONTROL,$proc.GUARD,$matrixCount) $(if($processStable){[ConsoleColor]::Green}else{[ConsoleColor]::Red})
  Write-Fit ("  CDP 9444={0} | TABS={1} | PROCESSES={2} | OVERALL RUNTIME => {3}" -f $(if($cdpOnline){"ONLINE"}else{"OFFLINE"}),$(if($tabStable){"PASS"}else{"FAIL"}),$(if($processStable){"PASS"}else{"FAIL"}),$(if($runtimeStable){"STABLE"}else{"CHECK"})) $(if($runtimeStable){[ConsoleColor]::Green}else{[ConsoleColor]::Red})

  Write-Fit ""
  Write-Fit "  ------------------------------ CHATGPT RATE LIMIT -----------------------------------------------" Green
  $rateLimitTimerRow = -1
  $sendPacerRow = -1
  if ($rateLimit) {
    $rlStatus = [string]$rateLimit.status
    $rlStage = [int]$rateLimit.stage
    $rlOwner = [string]$rateLimit.probeOwner
    $rlUntil = if ($rlStatus -eq "blocked") { [string]$rateLimit.blockedUntil } elseif ($rlStatus -eq "probe") { [string]$rateLimit.probeLeaseUntil } else { "" }
    $rlStageText = if ($rlStage -lt 0) { "clear" } else { "60s" }
    $rateCountdown = Format-Countdown $rlUntil
    $nextSendCountdown = Format-Countdown ([string]$rateLimit.nextGlobalSendAt)
    $intervalSec = if ($rateLimit.globalSendIntervalMs) { [math]::Round(([double]$rateLimit.globalSendIntervalMs)/1000) } else { 60 }
    $untilLocal = Format-LocalTime $rlUntil
    try { $rateLimitTimerRow = [Console]::CursorTop } catch {}
    Write-Fit ("  STATUS={0}  STAGE={1}  RATE_LIMIT_TIMER={2}  UNTIL_LOCAL={3}  PROBE_OWNER={4}" -f $rlStatus,$rlStageText,$rateCountdown,$untilLocal,$(if($rlOwner){$rlOwner}else{"none"})) $(if($rlStatus -eq "clear"){[ConsoleColor]::Green}else{[ConsoleColor]::Yellow})
    try { $sendPacerRow = [Console]::CursorTop } catch {}
    Write-Fit ("  GLOBAL SEND PACER: min interval={0}s  NEXT_SEND={1}  SLOT_OWNER={2}" -f $intervalSec,$nextSendCountdown,$(if($rateLimit.sendSlotOwner){$rateLimit.sendSlotOwner}else{"none"})) Cyan
  } else {
    try { $rateLimitTimerRow = [Console]::CursorTop } catch {}
    Write-Fit "  STATUS=clear  STAGE=clear  RATE_LIMIT_TIMER=00:00:00.000  UNTIL_LOCAL=-  PROBE_OWNER=none" Green
    try { $sendPacerRow = [Console]::CursorTop } catch {}
    Write-Fit "  GLOBAL SEND PACER: min interval=10s  NEXT_SEND=00:00:00.000  SLOT_OWNER=none" Cyan
  }

  Write-Fit ""
  Write-Fit "  ------------------------------ DAVID LAWS -------------------------------------------------------" Green
  Write-Fit "  CONTROL WATCHTOWER => ALLOWLISTED WAIT/REFRESH/RESTART/CLEAN_DUPLICATES ONLY" Magenta
  Write-Fit "  FINAL GATE => NO EXACT FINAL OK = NO NEXT NORMAL PROMPT" Red
  Write-Fit "  SESSION RESILIENCE => TAGGED CHAT OWNERSHIP + LIVE ISSUE CLASSIFICATION + SAFE RECOVERY" Yellow
  Write-Fit "  SEND TIMEOUT => CENTRAL GUARD OWNS RETRY | WORKERS WAIT | NO DUPLICATE SEND" Yellow
  Write-Fit "  TOO MANY REQUESTS => AUTO-DISMISS POPUP + GLOBAL BLOCK 60s -> ONE PROBE -> repeat 60s if still limited" Yellow
  Write-Fit "  NORMAL SENDS => GLOBAL PACER >=10s BETWEEN EVERY DAVID RELAY; ONE SESSION SEND AT A TIME" Yellow
  Write-Fit "  ACTIVE THINKING/TOOL WORK => WAIT | LONG NO-PROGRESS >600s => REFRESH/VERIFY/RESEND" Yellow
  Write-Fit "  INTERRUPTED => CONFIRM + INACTIVE + NO PROGRESS => REFRESH/VERIFY/RESEND | NEVER STOP ACTIVE GPT" Yellow
  Write-Fit "  EXTERNAL BLOCKER => DEFER + independent work | CAPTCHA/MFA/LOGIN/PERMISSION => NEVER BYPASS" Yellow
  Write-Fit "  VERCEL => GLOBAL SUPABASE LEASE; ONLY ONE WORKER MAY DEPLOY AT A TIME" Yellow
  Write-Fit ""
  Write-Fit ("  Vercel coordinator: public.david_vercel_deploy_lease = ENABLED | refresh={0}s | {1}" -f $RefreshSeconds,(Get-Date -Format "yyyy-MM-dd HH:mm:ss")) Magenta
  Write-Fit "  Ctrl+C closes only this MATRIX dashboard. DAVID workers continue in their own processes." DarkGray

  $snapshot = [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    overallPercent = $overall
    system = $system
    designV1 = $designV1
    design2 = $design2
    dpp = $dpp
    workers = [ordered]@{
      CONTROL = $controlState
      SYSTEM = $sysState
      DESIGN = $desState
      APP2 = $appState
      APK = $apkState
    }
    tabs = $tabs
    chatgptRateLimit = $rateLimit
    chatgptSessionHealth = $sessionHealth
    runtime = [ordered]@{
      cdpOnline = $cdpOnline
      tabStable = $tabStable
      processStable = $processStable
      overallStable = $runtimeStable
      processes = $proc
      matrixCount = $matrixCount
    }
    vercelCoordinator = "public.david_vercel_deploy_lease"
  }
  try { $snapshot | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $DashboardState -Encoding UTF8 } catch {}

  # Heavy Matrix data refresh remains slow, but countdown rows tick independently
  # at ~60 Hz with millisecond precision and no screen clear/flicker.
  $frameUntil = [DateTimeOffset]::UtcNow.AddSeconds([math]::Max(1,$RefreshSeconds))
  $tickMs = [math]::Max(10,$LiveTimerTickMs)
  $restoreRow = -1
  try { $restoreRow = [Console]::CursorTop } catch {}

  while ([DateTimeOffset]::UtcNow -lt $frameUntil) {
    if ($rateLimit -and $rateLimitTimerRow -ge 0) {
      $liveRateCountdown = Format-Countdown $rlUntil
      $liveRateLine = ("  STATUS={0}  STAGE={1}  RATE_LIMIT_TIMER={2}  UNTIL_LOCAL={3}  PROBE_OWNER={4}" -f $rlStatus,$rlStageText,$liveRateCountdown,$untilLocal,$(if($rlOwner){$rlOwner}else{"none"}))
      Write-FitAtRow $rateLimitTimerRow $liveRateLine $(if($rlStatus -eq "clear"){[ConsoleColor]::Green}else{[ConsoleColor]::Yellow}) $restoreRow

      if ($sendPacerRow -ge 0) {
        $liveNextSend = Format-Countdown ([string]$rateLimit.nextGlobalSendAt)
        $livePacerLine = ("  GLOBAL SEND PACER: min interval={0}s  NEXT_SEND={1}  SLOT_OWNER={2}" -f $intervalSec,$liveNextSend,$(if($rateLimit.sendSlotOwner){$rateLimit.sendSlotOwner}else{"none"}))
        Write-FitAtRow $sendPacerRow $livePacerLine Cyan $restoreRow
      }
    }
    Start-Sleep -Milliseconds $tickMs
  }
}

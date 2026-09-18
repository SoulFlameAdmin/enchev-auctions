param(
  [int]$RefreshSeconds = 3,
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

function Get-DesignProgress {
  $path = Join-Path $Repo "app\design-plan-evidence.json"
  $j = Read-JsonSafe $path
  $tasks = @()
  if ($j -and $j.tasks) { $tasks = @($j.tasks) }
  $green = @($tasks | Where-Object { ([string]$_.status).ToLowerInvariant() -eq "green" }).Count
  [pscustomobject]@{ Name="DESIGN"; Green=$green; Total=$tasks.Count; Percent=(CalcPct $green $tasks.Count) }
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

function Write-Fit([string]$Text, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
  $width = 120
  try { $width = [math]::Max(80, [Console]::WindowWidth - 1) } catch {}
  if ($Text.Length -gt $width) { $Text = $Text.Substring(0, $width) }
  $line = $Text.PadRight($width)
  Write-Host $line -ForegroundColor $Color -BackgroundColor Black
}

function Matrix-Fill {
  try {
    Clear-Host
    $w = [math]::Max(80, [Console]::WindowWidth - 1)
    $chars = "01DAVIDSOUL"
    $sb = New-Object System.Text.StringBuilder
    for ($x=0; $x -lt $w; $x++) {
      [void]$sb.Append($chars[(Get-Random -Minimum 0 -Maximum $chars.Length)])
    }
    Write-Host $sb.ToString() -ForegroundColor DarkGreen -BackgroundColor Black
  } catch {
    Clear-Host
  }
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
  $design = Get-DesignProgress
  $dpp = Get-DppProgress

  $sumGreen = 0
  $sumTotal = 0
  foreach ($p in @($system,$design,$dpp)) {
    if ($p.Total -gt 0) { $sumGreen += $p.Green; $sumTotal += $p.Total }
  }
  $overall = CalcPct $sumGreen $sumTotal
  if ($null -eq $overall) { $overall = 0.0 }

  $sysState = Get-State "SYSTEM"
  $desState = Get-State "DESIGN"
  $appState = Get-State "APP2"
  $apkState = Get-State "APK"
  $tabs = Read-JsonSafe (Join-Path $DavidDir ".david-tab-monitor.json")

  Matrix-Fill
  Write-Fit "================================================================================================================" Green
  Write-Fit "                                  D A V I D   //   MATRIX CONTROL" Green
  Write-Fit "================================================================================================================" Green
  Write-Fit ("  TOTAL VERIFIED PROGRESS: {0,6:N1}%    {1}" -f $overall,(Progress-Bar $overall 48)) Red
  Write-Fit ("  GREEN EVIDENCE: {0} / {1} measurable plan items" -f $sumGreen,$sumTotal) White
  Write-Fit ""
  Write-Fit ("  SYSTEM  {0,6}  {1}  GREEN {2}/{3}" -f ($(if($null -ne $system.Percent){"$($system.Percent)%"}else{"N/A"})),(Progress-Bar $system.Percent 36),$system.Green,$system.Total) Cyan
  Write-Fit ("  DESIGN  {0,6}  {1}  GREEN {2}/{3}" -f ($(if($null -ne $design.Percent){"$($design.Percent)%"}else{"N/A"})),(Progress-Bar $design.Percent 36),$design.Green,$design.Total) Cyan
  Write-Fit ("  DPP     {0,6}  {1}  GREEN {2}/{3}" -f ($(if($null -ne $dpp.Percent){"$($dpp.Percent)%"}else{"N/A"})),(Progress-Bar $dpp.Percent 36),$dpp.Green,$dpp.Total) Cyan
  Write-Fit "  APK     plan%=N/A (no formal finite APK plan yet) -- live worker state shown below" Cyan
  Write-Fit ""
  Write-Fit "  ------------------------------ LIVE WORKERS ----------------------------------------------------" Green
  Render-Worker "SYSTEM" $sysState
  Render-Worker "DESIGN" $desState
  Render-Worker "APP2"   $appState
  Render-Worker "APK"    $apkState
  Write-Fit ""
  Write-Fit "  ------------------------------ TAB OWNERSHIP ----------------------------------------------------" Green
  if ($tabs -and $tabs.managed) {
    $sc = @($tabs.managed.SYSTEM).Count
    $dc = @($tabs.managed.DESIGN).Count
    $ac = @($tabs.managed.APP2).Count
    $kc = @($tabs.managed.APK).Count
    $stable = ($sc -eq 1 -and $dc -eq 1 -and $ac -eq 1 -and $kc -eq 1)
    Write-Fit ("  SYSTEM={0}  DESIGN={1}  APP2={2}  APK={3}  ChatGPT tabs={4}  => {5}" -f $sc,$dc,$ac,$kc,$tabs.totalChatGptTabs,$(if($stable){"STABLE"}else{"CHECK"})) $(if($stable){[ConsoleColor]::Green}else{[ConsoleColor]::Red})
  } else {
    Write-Fit "  Tab monitor state not available yet..." Yellow
  }
  Write-Fit ""
  Write-Fit "  ------------------------------ DAVID LAWS -------------------------------------------------------" Green
  Write-Fit "  FINAL GATE => NO EXACT FINAL OK = NO NEXT NORMAL PROMPT" Red
  Write-Fit "  STOPS THINKING/WRITING => bounded RESEND | NO THINKING START => REFRESH + RESEND" Yellow
  Write-Fit "  CONNECTION INTERRUPTED => STOP + recover prompt + RESEND | MAX CHAT => NEW TAB + CLOSE OLD TAB" Yellow
  Write-Fit "  EXTERNAL BLOCKER => DEFER + independent work | CAPTCHA/MFA/LOGIN/PERMISSION => NEVER BYPASS" Yellow
  Write-Fit "  VERCEL => GLOBAL SUPABASE LEASE; ONLY ONE WORKER MAY DEPLOY AT A TIME" Yellow
  Write-Fit ""
  Write-Fit ("  Vercel coordinator: public.david_vercel_deploy_lease = ENABLED | refresh={0}s | {1}" -f $RefreshSeconds,(Get-Date -Format "yyyy-MM-dd HH:mm:ss")) Magenta
  Write-Fit "  Ctrl+C closes only this MATRIX dashboard. DAVID workers continue in their own processes." DarkGray

  $snapshot = [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    overallPercent = $overall
    system = $system
    design = $design
    dpp = $dpp
    workers = [ordered]@{
      SYSTEM = $sysState
      DESIGN = $desState
      APP2 = $appState
      APK = $apkState
    }
    tabs = $tabs
    vercelCoordinator = "public.david_vercel_deploy_lease"
  }
  try { $snapshot | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $DashboardState -Encoding UTF8 } catch {}

  Start-Sleep -Seconds ([math]::Max(1,$RefreshSeconds))
}

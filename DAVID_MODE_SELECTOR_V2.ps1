param([int]$Port=9444)
$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Hard singleton: at most one DAVID Mode Center may exist.
$CenterMutex=New-Object System.Threading.Mutex($false,"Global\DAVID_MODE_CENTER_V2_SINGLETON")
$CenterMutexOwned=$false
try{
  try{$CenterMutexOwned=$CenterMutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$CenterMutexOwned=$true}
  if(-not$CenterMutexOwned){
    try{$CenterMutex.Dispose()}catch{}
    exit 0
  }
}catch{
  try{$CenterMutex.Dispose()}catch{}
  throw
}

$Repo="D:\ASI\enchev-auctions"
$DavidDir=Join-Path $Repo "tools\david"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$StopScript=Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$SoulRestart=Join-Path $Repo "RESTART_DAVID_AUTONOMY_CLEAN.ps1"
$AbRestart=Join-Path $Repo "RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1"
$SingleRestart=Join-Path $Repo "RESTART_DAVID_SINGLE_CLEAN.ps1"
$ScientistStart=Join-Path $Repo "START_SF_SCIENTIST.ps1"
$ScientistStop=Join-Path $Repo "STOP_SF_SCIENTIST.ps1"
$ScientistState=Join-Path $DavidDir ".sf-scientist-state.json"
$ScientistCommand=Join-Path $DavidDir ".sf-scientist-command.json"
$ScientistResponse=Join-Path $DavidDir ".sf-scientist-response.json"
$FreeAUrl="https://chatgpt.com/c/6ab08cb0-3738-83eb-b4bf-2ef8bf4933a8"
$FreeBUrl="https://chatgpt.com/c/6ab08cab-006c-83eb-a753-2ea42567e22f"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DavidConsoleWindow {
  [DllImport("kernel32.dll")]
  public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

function Hide-OwnConsole {
  try {
    $h=[DavidConsoleWindow]::GetConsoleWindow()
    if($h-ne[IntPtr]::Zero){[void][DavidConsoleWindow]::ShowWindow($h,0)}
  } catch {}
}

function Close-OldDavidPowerShellWindows {
  param([int]$KeepPid)

  $patterns=@(
    "DAVID_START.ps1",
    "DAVID_MATRIX_START.ps1",
    "DAVID_MODE_SELECTOR_V2.ps1",
    "START_DAVID_AUTONOMY.ps1",
    "START_DAVID_FREETALK_ONLY.ps1",
    "START_DAVID_EXPERIMENT_FREETALK.ps1",
    "RESTART_DAVID_AUTONOMY_CLEAN.ps1",
    "RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1",
    "RESTART_DAVID_SINGLE_CLEAN.ps1",
    "START_DAVID_SINGLE.ps1",
    "RESTART_DAVID_EXPERIMENT_FREETALK_CLEAN.ps1",
    "STOP_DAVID_ALL_CLEAN.ps1",
    "david-autonomy-dashboard.ps1",
    "david-freetalk-only-dashboard.ps1",
    "david-freetalk-dashboard.ps1",
    "start-auto-continue.ps1"
  )

  try {
    Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $pidValue=[int]$_.ProcessId
        $nameValue=[string]$_.Name
        $line=[string]$_.CommandLine
        $match=$false
        foreach($pattern in $patterns){
          if($line-like("*"+$pattern+"*")){$match=$true;break}
        }
        ($pidValue-ne$KeepPid)-and
        ($nameValue-eq"powershell.exe"-or$nameValue-eq"pwsh.exe")-and
        $match
      } |
      ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  } catch {}
}

function Get-NodeCount([string]$Pattern){
  try{return @(Get-CimInstance Win32_Process|Where-Object{$_.Name-eq"node.exe"-and([string]$_.CommandLine)-like"*$Pattern*"}).Count}catch{return 0}
}
function Read-Json([string]$Path){
  try{
    if(-not(Test-Path -LiteralPath $Path)){return $null}
    $utf8=New-Object System.Text.UTF8Encoding($false,$true)
    $raw=[System.IO.File]::ReadAllText($Path,$utf8)
    if([string]::IsNullOrWhiteSpace($raw)){return $null}
    return $raw|ConvertFrom-Json
  }catch{return $null}
}
function Get-ChatUrl([string]$Path){$s=Read-Json $Path;if($s){return [string]$s.chatUrl};return ""}
function Get-Snapshot{
  $sup=Get-NodeCount "dual-session-worker.mjs"
  $sys=Get-NodeCount "auto-continue-enchev-v5.mjs"
  $dpp=Get-NodeCount "auto-complete-app2-v1.mjs"
  $apk=Get-NodeCount "auto-continue-david-apk-v1.mjs"
  $ctrl=Get-NodeCount "auto-control-watchtower-v1.mjs"
  $free=Get-NodeCount "free-talk-session-v1.mjs"
  $guard=Get-NodeCount "connection-interruption-guard.mjs"
  $design=Get-NodeCount "auto-continue-design-v1.mjs"
  $tabs=0;$fa=0;$fb=0;$tsys=0;$tdpp=0;$tapk=0;$tctrl=0
  $tm=Read-Json (Join-Path $DavidDir ".david-tab-monitor.json")
  if($tm){
    $tabs=[int]$tm.totalChatGptTabs
    try{$fa=@($tm.managed.FREE_A).Count}catch{}
    try{$fb=@($tm.managed.FREE_B).Count}catch{}
    try{$tsys=@($tm.managed.SYSTEM).Count}catch{}
    try{$tdpp=@($tm.managed.APP2).Count}catch{}
    try{$tapk=@($tm.managed.APK).Count}catch{}
    try{$tctrl=@($tm.managed.CONTROL).Count}catch{}
  }
  $aUrl=Get-ChatUrl (Join-Path $DavidDir ".david-free-talk-a-state.json")
  $bUrl=Get-ChatUrl (Join-Path $DavidDir ".david-free-talk-b-state.json")
  $pinned=($aUrl-eq$FreeAUrl-and$bUrl-eq$FreeBUrl)
  $mode="CHECK"
  if($sup-eq 0-and$sys-eq 0-and$dpp-eq 0-and$apk-eq 0-and$ctrl-eq 0-and$free-eq 0){$mode="STOPPED"}
  elseif($sup-eq 1-and$sys-eq 1-and$dpp-eq 1-and$apk-eq 1-and$ctrl-eq 0-and$guard-eq 1-and$free-eq 0-and$design-eq 0){$mode="SOULFLAME"}
  elseif($sup-eq 1-and$free-eq 2-and$sys-eq 0-and$dpp-eq 0-and$apk-eq 0-and$ctrl-eq 0-and$design-eq 0){$mode="AB"}
  elseif($sup-eq 1-and$guard-eq 1-and$sys-eq 1-and$dpp-eq 0-and$apk-eq 0-and$ctrl-eq 0-and$free-eq 0-and$design-eq 0-and$tabs-eq 1){$mode="SOLO_SYSTEM"}
  elseif($sup-eq 1-and$guard-eq 1-and$sys-eq 0-and$dpp-eq 1-and$apk-eq 0-and$ctrl-eq 0-and$free-eq 0-and$design-eq 0-and$tabs-eq 1){$mode="SOLO_DPP"}
  elseif($sup-eq 1-and$guard-eq 1-and$sys-eq 0-and$dpp-eq 0-and$apk-eq 1-and$ctrl-eq 0-and$free-eq 0-and$design-eq 0-and$tabs-eq 1){$mode="SOLO_APK"}
  return [pscustomobject]@{Mode=$mode;Sup=$sup;System=$sys;Dpp=$dpp;Apk=$apk;Control=$ctrl;Free=$free;Guard=$guard;Design=$design;Tabs=$tabs;FreeA=$fa;FreeB=$fb;TabSystem=$tsys;TabDpp=$tdpp;TabApk=$tapk;TabControl=$tctrl;Pinned=$pinned;AUrl=$aUrl;BUrl=$bUrl}
}

$form=New-Object System.Windows.Forms.Form
$form.Text="DAVID MODE CENTER V2.1 STABLE"
$form.StartPosition="CenterScreen"
$form.Size=New-Object System.Drawing.Size(760,680)
$form.MinimumSize=New-Object System.Drawing.Size(760,680)
$form.MaximizeBox=$false
$form.BackColor=[System.Drawing.Color]::FromArgb(18,20,26)

$title=New-Object System.Windows.Forms.Label
$title.Text="DAVID MODE CENTER V2.1"
$title.ForeColor=[System.Drawing.Color]::White
$title.Font=New-Object System.Drawing.Font("Segoe UI",20,[System.Drawing.FontStyle]::Bold)
$title.AutoSize=$true
$title.Location=New-Object System.Drawing.Point(28,20)
$form.Controls.Add($title)

$subtitle=New-Object System.Windows.Forms.Label
$subtitle.Text="Choose a mode. Every selection performs a FULL CLEAN RESTART, then starts and verifies the selected stack."
$subtitle.ForeColor=[System.Drawing.Color]::Silver
$subtitle.Font=New-Object System.Drawing.Font("Segoe UI",9)
$subtitle.Size=New-Object System.Drawing.Size(690,36)
$subtitle.Location=New-Object System.Drawing.Point(31,63)
$form.Controls.Add($subtitle)

$badge=New-Object System.Windows.Forms.Label
$badge.Text="DETECTING..."
$badge.TextAlign="MiddleCenter"
$badge.ForeColor=[System.Drawing.Color]::White
$badge.BackColor=[System.Drawing.Color]::FromArgb(75,75,85)
$badge.Font=New-Object System.Drawing.Font("Consolas",11,[System.Drawing.FontStyle]::Bold)
$badge.Size=New-Object System.Drawing.Size(690,34)
$badge.Location=New-Object System.Drawing.Point(31,100)
$form.Controls.Add($badge)

$soul=New-Object System.Windows.Forms.Button
$soul.Text="SOULFLAME SYSTEM`r`nENCHEV SYSTEM + DPP + DAVID APK`r`n3 TABS / WATCH BACKGROUND / MEDIUM"
$soul.Size=New-Object System.Drawing.Size(325,118)
$soul.Location=New-Object System.Drawing.Point(31,153)
$soul.Font=New-Object System.Drawing.Font("Segoe UI",12,[System.Drawing.FontStyle]::Bold)
$soul.FlatStyle="Flat"
$soul.FlatAppearance.BorderSize=2
$soul.ForeColor=[System.Drawing.Color]::White
$soul.BackColor=[System.Drawing.Color]::FromArgb(44,118,214)
$form.Controls.Add($soul)

$ab=New-Object System.Windows.Forms.Button
$ab.Text="DAVID A + B`r`n2 PERSISTENT FREE-TALK CHATS`r`nINSTANT / SEND NOW"
$ab.Size=New-Object System.Drawing.Size(325,118)
$ab.Location=New-Object System.Drawing.Point(396,153)
$ab.Font=New-Object System.Drawing.Font("Segoe UI",12,[System.Drawing.FontStyle]::Bold)
$ab.FlatStyle="Flat"
$ab.FlatAppearance.BorderSize=2
$ab.ForeColor=[System.Drawing.Color]::White
$ab.BackColor=[System.Drawing.Color]::FromArgb(124,72,184)
$form.Controls.Add($ab)

$soloEnchev=New-Object System.Windows.Forms.Button
$soloEnchev.Text="ENCHEV ONLY`r`n1 TAB / INSTANT`r`nWATCH BACKGROUND"
$soloEnchev.Size=New-Object System.Drawing.Size(210,92)
$soloEnchev.Location=New-Object System.Drawing.Point(31,286)
$soloEnchev.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$soloEnchev.FlatStyle="Flat"
$soloEnchev.FlatAppearance.BorderSize=2
$soloEnchev.ForeColor=[System.Drawing.Color]::White
$soloEnchev.BackColor=[System.Drawing.Color]::FromArgb(31,139,119)
$form.Controls.Add($soloEnchev)

$soloDpp=New-Object System.Windows.Forms.Button
$soloDpp.Text="DPP ONLY`r`n1 TAB / INSTANT`r`nWATCH BACKGROUND"
$soloDpp.Size=New-Object System.Drawing.Size(210,92)
$soloDpp.Location=New-Object System.Drawing.Point(271,286)
$soloDpp.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$soloDpp.FlatStyle="Flat"
$soloDpp.FlatAppearance.BorderSize=2
$soloDpp.ForeColor=[System.Drawing.Color]::White
$soloDpp.BackColor=[System.Drawing.Color]::FromArgb(193,113,38)
$form.Controls.Add($soloDpp)

$soloApk=New-Object System.Windows.Forms.Button
$soloApk.Text="DAVID APK ONLY`r`n1 TAB / INSTANT`r`nWATCH BACKGROUND"
$soloApk.Size=New-Object System.Drawing.Size(210,92)
$soloApk.Location=New-Object System.Drawing.Point(511,286)
$soloApk.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$soloApk.FlatStyle="Flat"
$soloApk.FlatAppearance.BorderSize=2
$soloApk.ForeColor=[System.Drawing.Color]::White
$soloApk.BackColor=[System.Drawing.Color]::FromArgb(156,70,91)
$form.Controls.Add($soloApk)

$pinned=New-Object System.Windows.Forms.Label
$pinned.Text="A+B pinned sessions: checking..."
$pinned.ForeColor=[System.Drawing.Color]::Khaki
$pinned.Font=New-Object System.Drawing.Font("Consolas",9,[System.Drawing.FontStyle]::Bold)
$pinned.Size=New-Object System.Drawing.Size(690,24)
$pinned.Location=New-Object System.Drawing.Point(31,397)
$form.Controls.Add($pinned)

$runtime=New-Object System.Windows.Forms.TextBox
$runtime.Multiline=$true
$runtime.ReadOnly=$true
$runtime.BorderStyle="FixedSingle"
$runtime.BackColor=[System.Drawing.Color]::FromArgb(12,14,18)
$runtime.ForeColor=[System.Drawing.Color]::Gainsboro
$runtime.Font=New-Object System.Drawing.Font("Consolas",9)
$runtime.Size=New-Object System.Drawing.Size(690,115)
$runtime.Location=New-Object System.Drawing.Point(31,427)
$form.Controls.Add($runtime)

$stop=New-Object System.Windows.Forms.Button
$stop.Text="STOP ALL"
$stop.Size=New-Object System.Drawing.Size(160,46)
$stop.Location=New-Object System.Drawing.Point(31,565)
$stop.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$stop.FlatStyle="Flat"
$stop.ForeColor=[System.Drawing.Color]::White
$stop.BackColor=[System.Drawing.Color]::FromArgb(165,52,52)
$form.Controls.Add($stop)

$refresh=New-Object System.Windows.Forms.Button
$refresh.Text="REFRESH STATUS"
$refresh.Size=New-Object System.Drawing.Size(160,46)
$refresh.Location=New-Object System.Drawing.Point(207,565)
$refresh.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$refresh.FlatStyle="Flat"
$refresh.ForeColor=[System.Drawing.Color]::White
$refresh.BackColor=[System.Drawing.Color]::FromArgb(70,74,84)
$form.Controls.Add($refresh)

$note=New-Object System.Windows.Forms.Label
$note.Text="Closing this selector does NOT stop the active mode."
$note.ForeColor=[System.Drawing.Color]::DarkGray
$note.Font=New-Object System.Drawing.Font("Segoe UI",9)
$note.Size=New-Object System.Drawing.Size(340,28)
$note.Location=New-Object System.Drawing.Point(381,574)
$form.Controls.Add($note)

$scientistMenu=New-Object System.Windows.Forms.Button
$scientistMenu.Text=[string][char]0x2630
$scientistMenu.Size=New-Object System.Drawing.Size(40,36)
$scientistMenu.Location=New-Object System.Drawing.Point(681,18)
$scientistMenu.Font=New-Object System.Drawing.Font("Segoe UI",15,[System.Drawing.FontStyle]::Bold)
$scientistMenu.FlatStyle="Flat"
$scientistMenu.ForeColor=[System.Drawing.Color]::White
$scientistMenu.BackColor=[System.Drawing.Color]::FromArgb(48,52,63)
$form.Controls.Add($scientistMenu)

$scientistPanel=New-Object System.Windows.Forms.Panel
$scientistPanel.Size=New-Object System.Drawing.Size(370,640)
$scientistPanel.Location=New-Object System.Drawing.Point(742,0)
$scientistPanel.BackColor=[System.Drawing.Color]::FromArgb(13,15,20)
$scientistPanel.Visible=$false
$form.Controls.Add($scientistPanel)

$scientistTitle=New-Object System.Windows.Forms.Label
$scientistTitle.Text="SF AI SCIENTIST"
$scientistTitle.ForeColor=[System.Drawing.Color]::White
$scientistTitle.Font=New-Object System.Drawing.Font("Segoe UI",15,[System.Drawing.FontStyle]::Bold)
$scientistTitle.AutoSize=$true
$scientistTitle.Location=New-Object System.Drawing.Point(18,18)
$scientistPanel.Controls.Add($scientistTitle)

$scientistStatus=New-Object System.Windows.Forms.Label
$scientistStatus.Text="STATUS: OFFLINE"
$scientistStatus.ForeColor=[System.Drawing.Color]::Khaki
$scientistStatus.Font=New-Object System.Drawing.Font("Consolas",9,[System.Drawing.FontStyle]::Bold)
$scientistStatus.Size=New-Object System.Drawing.Size(330,42)
$scientistStatus.Location=New-Object System.Drawing.Point(20,54)
$scientistPanel.Controls.Add($scientistStatus)

$scientistStartBtn=New-Object System.Windows.Forms.Button
$scientistStartBtn.Text="START SCIENTIST"
$scientistStartBtn.Size=New-Object System.Drawing.Size(155,34)
$scientistStartBtn.Location=New-Object System.Drawing.Point(20,96)
$scientistStartBtn.FlatStyle="Flat"
$scientistStartBtn.ForeColor=[System.Drawing.Color]::White
$scientistStartBtn.BackColor=[System.Drawing.Color]::FromArgb(35,119,191)
$scientistPanel.Controls.Add($scientistStartBtn)

$scientistStopBtn=New-Object System.Windows.Forms.Button
$scientistStopBtn.Text="STOP SCIENTIST"
$scientistStopBtn.Size=New-Object System.Drawing.Size(155,34)
$scientistStopBtn.Location=New-Object System.Drawing.Point(190,96)
$scientistStopBtn.FlatStyle="Flat"
$scientistStopBtn.ForeColor=[System.Drawing.Color]::White
$scientistStopBtn.BackColor=[System.Drawing.Color]::FromArgb(130,52,52)
$scientistPanel.Controls.Add($scientistStopBtn)

$scientistDecisionLabel=New-Object System.Windows.Forms.Label
$scientistDecisionLabel.Text="AUTONOMOUS DECISION / OBSERVATION"
$scientistDecisionLabel.ForeColor=[System.Drawing.Color]::Silver
$scientistDecisionLabel.Font=New-Object System.Drawing.Font("Segoe UI",8,[System.Drawing.FontStyle]::Bold)
$scientistDecisionLabel.AutoSize=$true
$scientistDecisionLabel.Location=New-Object System.Drawing.Point(20,143)
$scientistPanel.Controls.Add($scientistDecisionLabel)

$scientistDecision=New-Object System.Windows.Forms.TextBox
$scientistDecision.Multiline=$true
$scientistDecision.ReadOnly=$true
$scientistDecision.ScrollBars="Vertical"
$scientistDecision.BackColor=[System.Drawing.Color]::FromArgb(10,12,16)
$scientistDecision.ForeColor=[System.Drawing.Color]::Gainsboro
$scientistDecision.Font=New-Object System.Drawing.Font("Consolas",9)
$scientistDecision.Size=New-Object System.Drawing.Size(325,185)
$scientistDecision.Location=New-Object System.Drawing.Point(20,166)
$scientistPanel.Controls.Add($scientistDecision)

$scientistChatLabel=New-Object System.Windows.Forms.Label
$scientistChatLabel.Text="CHAT WITH SCIENTIST"
$scientistChatLabel.ForeColor=[System.Drawing.Color]::Silver
$scientistChatLabel.Font=New-Object System.Drawing.Font("Segoe UI",8,[System.Drawing.FontStyle]::Bold)
$scientistChatLabel.AutoSize=$true
$scientistChatLabel.Location=New-Object System.Drawing.Point(20,367)
$scientistPanel.Controls.Add($scientistChatLabel)

$scientistReply=New-Object System.Windows.Forms.TextBox
$scientistReply.Multiline=$true
$scientistReply.ReadOnly=$true
$scientistReply.ScrollBars="Vertical"
$scientistReply.BackColor=[System.Drawing.Color]::FromArgb(10,12,16)
$scientistReply.ForeColor=[System.Drawing.Color]::White
$scientistReply.Font=New-Object System.Drawing.Font("Segoe UI",9)
$scientistReply.Size=New-Object System.Drawing.Size(325,125)
$scientistReply.Location=New-Object System.Drawing.Point(20,390)
$scientistPanel.Controls.Add($scientistReply)

$scientistInput=New-Object System.Windows.Forms.TextBox
$scientistInput.Multiline=$true
$scientistInput.BackColor=[System.Drawing.Color]::FromArgb(22,25,32)
$scientistInput.ForeColor=[System.Drawing.Color]::White
$scientistInput.Font=New-Object System.Drawing.Font("Segoe UI",9)
$scientistInput.Size=New-Object System.Drawing.Size(238,65)
$scientistInput.Location=New-Object System.Drawing.Point(20,528)
$scientistPanel.Controls.Add($scientistInput)

$scientistSend=New-Object System.Windows.Forms.Button
$scientistSend.Text="SEND"
$scientistSend.Size=New-Object System.Drawing.Size(77,65)
$scientistSend.Location=New-Object System.Drawing.Point(268,528)
$scientistSend.FlatStyle="Flat"
$scientistSend.ForeColor=[System.Drawing.Color]::White
$scientistSend.BackColor=[System.Drawing.Color]::FromArgb(83,64,145)
$scientistPanel.Controls.Add($scientistSend)

$scientistHint=New-Object System.Windows.Forms.Label
$scientistHint.Text="Scientist sidecar: DAVID 9444 architecture stays unchanged."
$scientistHint.ForeColor=[System.Drawing.Color]::DarkGray
$scientistHint.Font=New-Object System.Drawing.Font("Segoe UI",8)
$scientistHint.Size=New-Object System.Drawing.Size(325,35)
$scientistHint.Location=New-Object System.Drawing.Point(20,600)
$scientistPanel.Controls.Add($scientistHint)

$script:ActionProcess=$null
$script:ActionName=""
$script:Busy=$false
$script:Closing=$false
$script:LastRefresh=[DateTime]::MinValue

$script:ScientistDrawerOpen=$false
$script:ScientistProcess=$null

function Start-ScientistSidecar{
  if((Get-NodeCount "sf-scientist-sidecar.mjs")-gt 0){return}
  if(-not(Test-Path $ScientistStart)){return}
  try{
    $script:ScientistProcess=Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$ScientistStart,"-Port","9555","-DavidPort","$Port") -PassThru -WindowStyle Hidden
  }catch{}
}

function Stop-ScientistSidecar{
  if(-not(Test-Path $ScientistStop)){return}
  try{Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$ScientistStop,"-Port","9555") -WindowStyle Hidden|Out-Null}catch{}
}

function Update-ScientistUi{
  $st=Read-Json $ScientistState
  $rp=Read-Json $ScientistResponse
  $count=Get-NodeCount "sf-scientist-sidecar.mjs"

  if($st){
    $status=[string]$st.status
    $hb=[string]$st.heartbeatAt

    if($st.scientistProfileConfirmed){
      $profile="CHAT | GPT-5.6 SOL | MEDIUM"
    }elseif($status-eq"online-warning"){
      $profile="CHAT | MEDIUM BEST-EFFORT"
    }else{
      $profile="CHAT / MEDIUM: VERIFYING"
    }

    $scientistStatus.Text=("{0}  W={1} | {2}" -f $status.ToUpperInvariant(),$count,$profile)+[Environment]::NewLine+("HB: {0}" -f $hb)

    if($status-eq"online"){$scientistStatus.ForeColor=[System.Drawing.Color]::LightGreen}
    elseif($status-eq"thinking"){$scientistStatus.ForeColor=[System.Drawing.Color]::Cyan}
    elseif($status-eq"rate-limited"){$scientistStatus.ForeColor=[System.Drawing.Color]::Khaki}
    elseif($status-eq"online-warning"){$scientistStatus.ForeColor=[System.Drawing.Color]::Orange}
    elseif($status-eq"login-required"){$scientistStatus.ForeColor=[System.Drawing.Color]::Khaki}
    else{$scientistStatus.ForeColor=[System.Drawing.Color]::Orange}

    $lines=New-Object System.Collections.Generic.List[string]

    $activity=[string]$st.liveActivity
    if(-not[string]::IsNullOrWhiteSpace($activity)){
      $lines.Add("LIVE: "+$activity)
    }
    $activityAt=[string]$st.activityAt
    if(-not[string]::IsNullOrWhiteSpace($activityAt)){
      $lines.Add("AT: "+$activityAt)
    }

    $mode=[string]$st.currentMode
    if(-not[string]::IsNullOrWhiteSpace($mode)){
      $lines.Add("DAVID MODE: "+$mode)
    }

    if($null-ne$st.currentCdp9444Online){
      $lines.Add("CDP 9444: "+([string]$st.currentCdp9444Online).ToUpperInvariant())
    }

    if($st.pendingObservation){
      $reasons=@($st.pendingObservationReasons)
      if($reasons.Count-gt0){
        $lines.Add("PENDING: "+($reasons -join " | "))
      }else{
        $lines.Add("PENDING: live telemetry analysis")
      }
    }

    $inFlight=[string]$st.inFlightObservation
    if(-not[string]::IsNullOrWhiteSpace($inFlight)){
      $lines.Add("IN FLIGHT: "+$inFlight)
    }

    if($null-ne$st.sendAck){
      $lines.Add("SEND ACK: "+([string]$st.sendAck).ToUpperInvariant())
    }
    $sendAttempt=[string]$st.sendAttempt
    if(-not[string]::IsNullOrWhiteSpace($sendAttempt)){
      $method=[string]$st.sendMethod
      $sendLine="SEND TRY: "+$sendAttempt
      if(-not[string]::IsNullOrWhiteSpace($method)){$sendLine+=" via "+$method}
      $lines.Add($sendLine)
    }

    $backoff=[string]$st.rateLimitBackoffUntil
    if(-not[string]::IsNullOrWhiteSpace($backoff)){
      $lines.Add("RATE LIMIT BACKOFF UNTIL: "+$backoff)
    }

    if($st.lastUiRecovery){
      $uiType=[string]$st.lastUiRecovery.type
      $uiButton=[string]$st.lastUiRecovery.button
      $uiAt=[string]$st.lastUiRecovery.at
      $ui="UI RECOVERY: "+$uiType
      if(-not[string]::IsNullOrWhiteSpace($uiButton)){$ui+=" -> "+$uiButton}
      if(-not[string]::IsNullOrWhiteSpace($uiAt)){$ui+=" @ "+$uiAt}
      $lines.Add($ui)
    }

    $warning=[string]$st.scientistProfileWarning
    if(-not[string]::IsNullOrWhiteSpace($warning)){
      $lines.Add("PROFILE WARNING: "+$warning)
    }

    $err=[string]$st.lastError
    if(-not[string]::IsNullOrWhiteSpace($err)){
      $lines.Add("")
      $lines.Add("ERROR: "+$err)
    }

    $obs=[string]$st.lastObservation
    if(-not[string]::IsNullOrWhiteSpace($obs)){
      $lines.Add("")
      $lines.Add("LAST OBSERVATION: "+$obs)
    }

    $preview=[string]$st.lastResponsePreview
    if(-not[string]::IsNullOrWhiteSpace($preview)){
      $lines.Add("")
      $lines.Add("GPT LIVE: "+$preview)
    }

    $decision=[string]$st.lastDecision
    if(-not[string]::IsNullOrWhiteSpace($decision)){
      $lines.Add("")
      $lines.Add("LAST DECISION:")
      $lines.Add($decision)
    }

    $tool=[string]$st.lastToolResult
    if(-not[string]::IsNullOrWhiteSpace($tool)){
      $lines.Add("")
      $lines.Add("TOOL: "+$tool)
    }

    if($lines.Count-eq0){$lines.Add("Scientist connected. Waiting for live activity.")}
    $scientistDecision.Text=($lines -join [Environment]::NewLine)
  }else{
    $scientistStatus.Text=("STATUS: OFFLINE  WORKER={0}" -f $count)+[Environment]::NewLine+"Scientist auto-starts with DAVID."
    $scientistStatus.ForeColor=[System.Drawing.Color]::Khaki
    $scientistDecision.Text="No Scientist state yet."
  }

  if($rp-and$rp.response){
    $scientistReply.Text=[string]$rp.response
  }
}

function Send-ScientistChat{
  $text=[string]$scientistInput.Text
  if([string]::IsNullOrWhiteSpace($text)){return}
  Start-ScientistSidecar
  $cmd=[ordered]@{id=[guid]::NewGuid().ToString();createdAt=(Get-Date).ToUniversalTime().ToString("o");text=$text.Trim()}
  try{
    $json=$cmd|ConvertTo-Json -Depth 8
    $utf8NoBom=New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ScientistCommand,$json,$utf8NoBom)
    $scientistReply.Text="SENT -> Scientist is analyzing..."
    $scientistInput.Clear()
  }catch{
    $scientistReply.Text="Could not write Scientist command: "+$_.Exception.Message
  }
}

function Set-ModeButtons([bool]$Enabled){
  foreach($b in @($soul,$ab,$soloEnchev,$soloDpp,$soloApk)){$b.Enabled=$Enabled}
}

function Start-Mode([string]$Name,[string]$RestartScript,[string[]]$ExtraArgs=@()){
  if($script:Busy){return}

  if(-not(Test-Path $RestartScript)){
    [System.Windows.Forms.MessageBox]::Show("Missing restart script:`r`n"+$RestartScript,"DAVID MODE CENTER",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
    return
  }

  Start-ScientistSidecar
  $script:Busy=$true
  $script:ActionName=$Name
  Set-ModeButtons $false
  $stop.Enabled=$false
  $badge.Text="FULL CLEAN RESTART -> "+$Name
  $badge.BackColor=[System.Drawing.Color]::FromArgb(173,116,26)
  $args=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$RestartScript,"-Port","$Port")
  if($ExtraArgs){$args+=$ExtraArgs}
  $script:ActionProcess=Start-Process -FilePath $Pwsh -ArgumentList $args -PassThru -WindowStyle Hidden
}

function Start-StopAll{
  if($script:Busy){return}
  if(-not(Test-Path $StopScript)){return}
  $script:Busy=$true
  $script:ActionName="STOP ALL"
  Set-ModeButtons $false
  $stop.Enabled=$false
  $badge.Text="STOPPING ALL..."
  $badge.BackColor=[System.Drawing.Color]::FromArgb(173,116,26)
  $script:ActionProcess=Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$StopScript,"-Port","$Port") -PassThru -WindowStyle Hidden
}

function Update-Ui{
  $s=Get-Snapshot
  if(-not$script:Busy){
    Set-ModeButtons $true
    switch($s.Mode){
      "SOULFLAME"{$badge.Text="ACTIVE: SOULFLAME SYSTEM";$badge.BackColor=[System.Drawing.Color]::FromArgb(35,119,191);$soul.Enabled=$false;$stop.Enabled=$true}
      "AB"{$badge.Text="ACTIVE: DAVID A + B";$badge.BackColor=[System.Drawing.Color]::FromArgb(116,63,169);$ab.Enabled=$false;$stop.Enabled=$true}
      "SOLO_SYSTEM"{$badge.Text="ACTIVE: ENCHEV ONLY / FAST";$badge.BackColor=[System.Drawing.Color]::FromArgb(31,139,119);$soloEnchev.Enabled=$false;$stop.Enabled=$true}
      "SOLO_DPP"{$badge.Text="ACTIVE: DPP ONLY / FAST";$badge.BackColor=[System.Drawing.Color]::FromArgb(193,113,38);$soloDpp.Enabled=$false;$stop.Enabled=$true}
      "SOLO_APK"{$badge.Text="ACTIVE: DAVID APK ONLY / FAST";$badge.BackColor=[System.Drawing.Color]::FromArgb(156,70,91);$soloApk.Enabled=$false;$stop.Enabled=$true}
      "STOPPED"{$badge.Text="READY: CHOOSE MODE -> FULL CLEAN RESTART";$badge.BackColor=[System.Drawing.Color]::FromArgb(45,115,70);$stop.Enabled=$false}
      default{$badge.Text="CHECK / TRANSITION";$badge.BackColor=[System.Drawing.Color]::FromArgb(170,105,27);$stop.Enabled=$true}
    }
  }
  if($s.Pinned){
    $pinned.Text="A+B PINNED SAME CHATS: YES | A=6ab08cb0... | B=6ab08cab..."
    $pinned.ForeColor=[System.Drawing.Color]::LightGreen
  }else{
    $pinned.Text="A+B PINNED SAME CHATS: NOT CONFIRMED YET"
    $pinned.ForeColor=[System.Drawing.Color]::Khaki
  }
  $watch=if($s.Sup-eq 1-and$s.Guard-eq 1){"ON"}else{"CHECK"}; $runtime.Text=("MODE={0}   ChatGPT tabs={1}`r`nWATCH={2}  SUP={3} GUARD={4}  ENCHEV={5} DPP={6} APK={7} CTRL_TAB={8}`r`nTAB MAP: ENCHEV={9} DPP={10} APK={11} FREE_A={12} FREE_B={13}`r`nA={14}`r`nB={15}" -f $s.Mode,$s.Tabs,$watch,$s.Sup,$s.Guard,$s.System,$s.Dpp,$s.Apk,$s.Control,$s.TabSystem,$s.TabDpp,$s.TabApk,$s.FreeA,$s.FreeB,$s.AUrl,$s.BUrl)
}

$soul.Add_Click({Start-Mode "SOULFLAME SYSTEM" $SoulRestart})
$ab.Add_Click({Start-Mode "DAVID A + B" $AbRestart})
$soloEnchev.Add_Click({Start-Mode "ENCHEV ONLY" $SingleRestart @("-Worker","SYSTEM")})
$soloDpp.Add_Click({Start-Mode "DPP ONLY" $SingleRestart @("-Worker","APP2")})
$soloApk.Add_Click({Start-Mode "DAVID APK ONLY" $SingleRestart @("-Worker","APK")})
$stop.Add_Click({Start-StopAll})

$refresh.Add_Click({Update-Ui})
$scientistMenu.Add_Click({
  $script:ScientistDrawerOpen=-not$script:ScientistDrawerOpen
  $scientistPanel.Visible=$script:ScientistDrawerOpen
  if($script:ScientistDrawerOpen){$form.Size=New-Object System.Drawing.Size(1140,680);Update-ScientistUi}else{$form.Size=New-Object System.Drawing.Size(760,680)}
})
$scientistStartBtn.Add_Click({Start-ScientistSidecar;Start-Sleep -Milliseconds 150;Update-ScientistUi})
$scientistStopBtn.Add_Click({Stop-ScientistSidecar;Start-Sleep -Milliseconds 150;Update-ScientistUi})
$scientistSend.Add_Click({Send-ScientistChat})
$scientistInput.Add_KeyDown({
  if($_.Control-and$_.KeyCode-eq[System.Windows.Forms.Keys]::Enter){
    $_.SuppressKeyPress=$true
    Send-ScientistChat
  }
})

# V2.1 STABLE: no WinForms Timer.
# Timer.OnTick can invoke a PowerShell ScriptBlock after its pipeline is stopping,
# causing .NET PipelineStoppedException/JIT dialogs. Keep the UI on one guarded loop.
$form.Add_FormClosing({
  $script:Closing=$true
})

$form.Show()
[System.Windows.Forms.Application]::DoEvents()
Close-OldDavidPowerShellWindows -KeepPid $PID
Hide-OwnConsole
Update-Ui
try{
  # SF Scientist belongs to Mode Center, not to a DAVID runtime mode.
  # Start it whenever the selector opens, even while DAVID itself is STOPPED.
  Start-ScientistSidecar
}catch{}

while(-not $script:Closing -and $form.Visible){
  try{
    [System.Windows.Forms.Application]::DoEvents()

    if($script:Busy -and $script:ActionProcess){
      $exited=$false
      try{$exited=$script:ActionProcess.HasExited}catch{$exited=$true}
      if($exited){
        $code=-1
        try{$code=$script:ActionProcess.ExitCode}catch{}
        if($code-ne 0){
          $badge.Text="FAILED: "+$script:ActionName+" (exit "+$code+")"
          $badge.BackColor=[System.Drawing.Color]::FromArgb(170,45,45)
        }
        $script:ActionProcess=$null
        $script:Busy=$false
        $script:LastRefresh=[DateTime]::MinValue
      }
    }

    if(([DateTime]::UtcNow-$script:LastRefresh).TotalMilliseconds-ge 1000){
      Update-Ui
      if($script:ScientistDrawerOpen){Update-ScientistUi}
      $script:LastRefresh=[DateTime]::UtcNow
    }

    Start-Sleep -Milliseconds 60
  }catch [System.Management.Automation.PipelineStoppedException]{
    break
  }catch{
    try{
      $badge.Text="UI STATUS ERROR - DAVID STILL RUNNING"
      $badge.BackColor=[System.Drawing.Color]::FromArgb(170,45,45)
    }catch{}
    Start-Sleep -Milliseconds 250
  }
}

try{
  if(-not $form.IsDisposed){$form.Dispose()}
}catch{}

if($CenterMutexOwned){
  try{$CenterMutex.ReleaseMutex()|Out-Null}catch{}
}
try{$CenterMutex.Dispose()}catch{}

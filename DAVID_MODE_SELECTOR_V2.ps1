param([int]$Port=9444)
$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DavidModeCenterActivation {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hWnd);

  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
}
"@

# Hard singleton: at most one DAVID Mode Center may exist.
$CenterMutex=New-Object System.Threading.Mutex($false,"Global\DAVID_MODE_CENTER_V2_SINGLETON")
$CenterMutexOwned=$false
try{
  try{$CenterMutexOwned=$CenterMutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$CenterMutexOwned=$true}
  if(-not$CenterMutexOwned){
    try{
      $existing=[DavidModeCenterActivation]::FindWindow($null,"DAVID MODE CENTER V2.1 STABLE")
      if($existing-ne[IntPtr]::Zero){
        [void][DavidModeCenterActivation]::ShowWindowAsync($existing,9)
        [void][DavidModeCenterActivation]::BringWindowToTop($existing)
        [void][DavidModeCenterActivation]::SetForegroundWindow($existing)
      }
    }catch{}
    try{$CenterMutex.Dispose()}catch{}
    exit 0
  }
}catch{
  try{$CenterMutex.Dispose()}catch{}
  throw
}

try{[void][DavidModeCenterActivation]::SetCurrentProcessExplicitAppUserModelID("SoulFlame.DAVID.ModeCenter")}catch{}

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
$ScientistOperatorLog=Join-Path $DavidDir ".sf-scientist-operator.jsonl"
$ControlPanelPreviewWorker=Join-Path $DavidDir "control-panel-task-preview.mjs"
$ControlPanelTasks=Join-Path $DavidDir ".david-control-panel-tasks.json"
$ControlPanelCommand=Join-Path $DavidDir ".david-control-panel-command.json"
$InstallerClientsSyncWorker=Join-Path $DavidDir "installer-client-registry-sync.mjs"
$InstallerClientsCache=Join-Path $DavidDir ".david-installer-clients.json"
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
$form.MinimumSize=New-Object System.Drawing.Size(1180,760)
$form.MaximizeBox=$true
$form.WindowState=[System.Windows.Forms.FormWindowState]::Maximized
$form.ShowInTaskbar=$true
$form.TopMost=$false
$form.BackColor=[System.Drawing.Color]::FromArgb(18,20,26)

$mainTabs=New-Object System.Windows.Forms.TabControl
$mainTabs.Dock="Fill"
$mainTabs.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$mainTabs.Appearance="Normal"
$mainTabs.Padding=New-Object System.Drawing.Point(18,8)

$controlPage=New-Object System.Windows.Forms.TabPage
$controlPage.Text="PAGE 1 - CONTROL"
$controlPage.BackColor=[System.Drawing.Color]::FromArgb(18,20,26)
$controlPage.AutoScroll=$true

$tasksPage=New-Object System.Windows.Forms.TabPage
$tasksPage.Text="PAGE 2 - TASKS / ZADACHI"
$tasksPage.BackColor=[System.Drawing.Color]::FromArgb(12,14,18)

[void]$mainTabs.TabPages.Add($controlPage)
[void]$mainTabs.TabPages.Add($tasksPage)
$form.Controls.Add($mainTabs)

$tasksHeader=New-Object System.Windows.Forms.Label
$tasksHeader.Text="DAVID TASKS - LIVE TOPOLOGY"
$tasksHeader.ForeColor=[System.Drawing.Color]::White
$tasksHeader.Font=New-Object System.Drawing.Font("Segoe UI",18,[System.Drawing.FontStyle]::Bold)
$tasksHeader.AutoSize=$true
$tasksHeader.Location=New-Object System.Drawing.Point(24,18)
$tasksPage.Controls.Add($tasksHeader)

$tasksStatus=New-Object System.Windows.Forms.Label
$tasksStatus.Text="TASK STATUS WORKER: STARTING..."
$tasksStatus.ForeColor=[System.Drawing.Color]::Khaki
$tasksStatus.Font=New-Object System.Drawing.Font("Consolas",10,[System.Drawing.FontStyle]::Bold)
$tasksStatus.Size=New-Object System.Drawing.Size(1450,28)
$tasksStatus.Location=New-Object System.Drawing.Point(27,56)
$tasksStatus.Anchor="Top,Left,Right"
$tasksPage.Controls.Add($tasksStatus)

$taskOverview=New-Object System.Windows.Forms.Panel
$taskOverview.Location=New-Object System.Drawing.Point(20,90)
$taskOverview.Size=New-Object System.Drawing.Size(1510,650)
$taskOverview.Anchor="Top,Bottom,Left,Right"
$taskOverview.BackColor=[System.Drawing.Color]::FromArgb(10,12,16)
$taskOverview.BorderStyle="FixedSingle"
$tasksPage.Controls.Add($taskOverview)

$taskLegend=New-Object System.Windows.Forms.Label
$taskLegend.Text="GREEN/CYAN = WORKING  |  AMBER = PROCESS WITHOUT TAB  |  RED = OFFLINE  |  GLOW LINE = LIVE CONNECTION"
$taskLegend.ForeColor=[System.Drawing.Color]::Silver
$taskLegend.Font=New-Object System.Drawing.Font("Consolas",9,[System.Drawing.FontStyle]::Bold)
$taskLegend.Size=New-Object System.Drawing.Size(1400,24)
$taskLegend.Location=New-Object System.Drawing.Point(18,10)
$taskLegend.Anchor="Top,Left,Right"
$taskOverview.Controls.Add($taskLegend)

$taskGraph=New-Object System.Windows.Forms.Panel
$taskGraph.Location=New-Object System.Drawing.Point(18,42)
$taskGraph.Size=New-Object System.Drawing.Size(1470,585)
$taskGraph.Anchor="Top,Bottom,Left,Right"
$taskGraph.BackColor=[System.Drawing.Color]::FromArgb(7,9,13)
$taskGraph.BorderStyle="FixedSingle"
$taskOverview.Controls.Add($taskGraph)

$taskDetail=New-Object System.Windows.Forms.Panel
$taskDetail.Location=New-Object System.Drawing.Point(20,90)
$taskDetail.Size=New-Object System.Drawing.Size(1510,650)
$taskDetail.Anchor="Top,Bottom,Left,Right"
$taskDetail.BackColor=[System.Drawing.Color]::FromArgb(10,12,16)
$taskDetail.BorderStyle="FixedSingle"
$taskDetail.Visible=$false
$tasksPage.Controls.Add($taskDetail)

$taskBack=New-Object System.Windows.Forms.Button
$taskBack.Text="< BACK TO TASK MAP"
$taskBack.Size=New-Object System.Drawing.Size(190,42)
$taskBack.Location=New-Object System.Drawing.Point(18,16)
$taskBack.FlatStyle="Flat"
$taskBack.ForeColor=[System.Drawing.Color]::White
$taskBack.BackColor=[System.Drawing.Color]::FromArgb(70,74,84)
$taskDetail.Controls.Add($taskBack)

$taskDetailTitle=New-Object System.Windows.Forms.Label
$taskDetailTitle.Text="TASK DETAIL"
$taskDetailTitle.ForeColor=[System.Drawing.Color]::White
$taskDetailTitle.Font=New-Object System.Drawing.Font("Segoe UI",16,[System.Drawing.FontStyle]::Bold)
$taskDetailTitle.AutoSize=$true
$taskDetailTitle.Location=New-Object System.Drawing.Point(228,20)
$taskDetail.Controls.Add($taskDetailTitle)

$taskDetailStatus=New-Object System.Windows.Forms.Label
$taskDetailStatus.Text="STATUS: -"
$taskDetailStatus.ForeColor=[System.Drawing.Color]::Khaki
$taskDetailStatus.Font=New-Object System.Drawing.Font("Consolas",10,[System.Drawing.FontStyle]::Bold)
$taskDetailStatus.Size=New-Object System.Drawing.Size(900,26)
$taskDetailStatus.Location=New-Object System.Drawing.Point(228,51)
$taskDetail.Controls.Add($taskDetailStatus)

$taskPreview=New-Object System.Windows.Forms.PictureBox
$taskPreview.Visible=$false
$taskPreview.Size=New-Object System.Drawing.Size(1,1)
$taskDetail.Controls.Add($taskPreview)

$taskProgress=New-Object System.Windows.Forms.TextBox
$taskProgress.Multiline=$true
$taskProgress.ReadOnly=$true
$taskProgress.ScrollBars="Vertical"
$taskProgress.WordWrap=$true
$taskProgress.BackColor=[System.Drawing.Color]::FromArgb(7,9,13)
$taskProgress.ForeColor=[System.Drawing.Color]::Gainsboro
$taskProgress.Font=New-Object System.Drawing.Font("Consolas",12)
$taskProgress.Location=New-Object System.Drawing.Point(18,82)
$taskProgress.Size=New-Object System.Drawing.Size(1468,548)
$taskProgress.Anchor="Top,Bottom,Left,Right"
$taskProgress.Text="TASK STATUS - waiting for worker state..."
$taskDetail.Controls.Add($taskProgress)

$taskDetails=New-Object System.Windows.Forms.TextBox
$taskDetails.Multiline=$true
$taskDetails.ReadOnly=$true
$taskDetails.ScrollBars="Vertical"
$taskDetails.BackColor=[System.Drawing.Color]::FromArgb(9,11,15)
$taskDetails.ForeColor=[System.Drawing.Color]::Gainsboro
$taskDetails.Font=New-Object System.Drawing.Font("Consolas",9)
$taskDetails.Location=New-Object System.Drawing.Point(18,606)
$taskDetails.Size=New-Object System.Drawing.Size(1040,32)
$taskDetails.Anchor="Bottom,Left,Right"
$taskDetails.Visible=$false
$taskDetail.Controls.Add($taskDetails)

$focusTask=New-Object System.Windows.Forms.Button
$focusTask.Text="FOCUS REAL EDGE"
$focusTask.Size=New-Object System.Drawing.Size(180,42)
$focusTask.Location=New-Object System.Drawing.Point(1304,16)
$focusTask.Anchor="Top,Right"
$focusTask.FlatStyle="Flat"
$focusTask.ForeColor=[System.Drawing.Color]::White
$focusTask.BackColor=[System.Drawing.Color]::FromArgb(35,119,191)
$focusTask.Visible=$false
$taskDetail.Controls.Add($focusTask)

$taskDetail.Add_Resize({
  try{
    $pad=18
    $top=82
    $w=[Math]::Max(300,$taskDetail.ClientSize.Width-($pad*2))
    $h=[Math]::Max(220,$taskDetail.ClientSize.Height-$top-$pad)
    $taskProgress.Location=New-Object System.Drawing.Point($pad,$top)
    $taskProgress.Size=New-Object System.Drawing.Size($w,$h)
  }catch{}
})

$refreshTasks=New-Object System.Windows.Forms.Button
$refreshTasks.Text="REFRESH"
$refreshTasks.Size=New-Object System.Drawing.Size(105,34)
$refreshTasks.Location=New-Object System.Drawing.Point(1380,16)
$refreshTasks.Anchor="Top,Right"
$refreshTasks.FlatStyle="Flat"
$refreshTasks.ForeColor=[System.Drawing.Color]::White
$refreshTasks.BackColor=[System.Drawing.Color]::FromArgb(70,74,84)
$taskOverview.Controls.Add($refreshTasks)

$title=New-Object System.Windows.Forms.Label
$title.Text="DAVID MODE CENTER V2.1"
$title.ForeColor=[System.Drawing.Color]::White
$title.Font=New-Object System.Drawing.Font("Segoe UI",20,[System.Drawing.FontStyle]::Bold)
$title.AutoSize=$true
$title.Location=New-Object System.Drawing.Point(28,20)
$controlPage.Controls.Add($title)

$subtitle=New-Object System.Windows.Forms.Label
$subtitle.Text="Choose a mode. Every selection performs a FULL CLEAN RESTART, then starts and verifies the selected stack."
$subtitle.ForeColor=[System.Drawing.Color]::Silver
$subtitle.Font=New-Object System.Drawing.Font("Segoe UI",9)
$subtitle.Size=New-Object System.Drawing.Size(690,36)
$subtitle.Location=New-Object System.Drawing.Point(31,63)
$controlPage.Controls.Add($subtitle)

$badge=New-Object System.Windows.Forms.Label
$badge.Text="DETECTING..."
$badge.TextAlign="MiddleCenter"
$badge.ForeColor=[System.Drawing.Color]::White
$badge.BackColor=[System.Drawing.Color]::FromArgb(75,75,85)
$badge.Font=New-Object System.Drawing.Font("Consolas",11,[System.Drawing.FontStyle]::Bold)
$badge.Size=New-Object System.Drawing.Size(690,34)
$badge.Location=New-Object System.Drawing.Point(31,100)
$controlPage.Controls.Add($badge)

$soul=New-Object System.Windows.Forms.Button
$soul.Text="SOULFLAME SYSTEM`r`nENCHEV SYSTEM + DPP + DAVID APK`r`n3 TABS / WATCH BACKGROUND / MEDIUM"
$soul.Size=New-Object System.Drawing.Size(325,118)
$soul.Location=New-Object System.Drawing.Point(31,153)
$soul.Font=New-Object System.Drawing.Font("Segoe UI",12,[System.Drawing.FontStyle]::Bold)
$soul.FlatStyle="Flat"
$soul.FlatAppearance.BorderSize=2
$soul.ForeColor=[System.Drawing.Color]::White
$soul.BackColor=[System.Drawing.Color]::FromArgb(44,118,214)
$controlPage.Controls.Add($soul)

$ab=New-Object System.Windows.Forms.Button
$ab.Text="DAVID A + B`r`n2 PERSISTENT FREE-TALK CHATS`r`nINSTANT / SEND NOW"
$ab.Size=New-Object System.Drawing.Size(325,118)
$ab.Location=New-Object System.Drawing.Point(396,153)
$ab.Font=New-Object System.Drawing.Font("Segoe UI",12,[System.Drawing.FontStyle]::Bold)
$ab.FlatStyle="Flat"
$ab.FlatAppearance.BorderSize=2
$ab.ForeColor=[System.Drawing.Color]::White
$ab.BackColor=[System.Drawing.Color]::FromArgb(124,72,184)
$controlPage.Controls.Add($ab)

$soloEnchev=New-Object System.Windows.Forms.Button
$soloEnchev.Text="ENCHEV ONLY`r`n1 TAB / INSTANT`r`nWATCH BACKGROUND"
$soloEnchev.Size=New-Object System.Drawing.Size(210,92)
$soloEnchev.Location=New-Object System.Drawing.Point(31,286)
$soloEnchev.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$soloEnchev.FlatStyle="Flat"
$soloEnchev.FlatAppearance.BorderSize=2
$soloEnchev.ForeColor=[System.Drawing.Color]::White
$soloEnchev.BackColor=[System.Drawing.Color]::FromArgb(31,139,119)
$controlPage.Controls.Add($soloEnchev)

$soloDpp=New-Object System.Windows.Forms.Button
$soloDpp.Text="DPP ONLY`r`n1 TAB / INSTANT`r`nWATCH BACKGROUND"
$soloDpp.Size=New-Object System.Drawing.Size(210,92)
$soloDpp.Location=New-Object System.Drawing.Point(271,286)
$soloDpp.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$soloDpp.FlatStyle="Flat"
$soloDpp.FlatAppearance.BorderSize=2
$soloDpp.ForeColor=[System.Drawing.Color]::White
$soloDpp.BackColor=[System.Drawing.Color]::FromArgb(193,113,38)
$controlPage.Controls.Add($soloDpp)

$soloApk=New-Object System.Windows.Forms.Button
$soloApk.Text="DAVID APK ONLY`r`n1 TAB / INSTANT`r`nWATCH BACKGROUND"
$soloApk.Size=New-Object System.Drawing.Size(210,92)
$soloApk.Location=New-Object System.Drawing.Point(511,286)
$soloApk.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$soloApk.FlatStyle="Flat"
$soloApk.FlatAppearance.BorderSize=2
$soloApk.ForeColor=[System.Drawing.Color]::White
$soloApk.BackColor=[System.Drawing.Color]::FromArgb(156,70,91)
$controlPage.Controls.Add($soloApk)

$pinned=New-Object System.Windows.Forms.Label
$pinned.Text="A+B pinned sessions: checking..."
$pinned.ForeColor=[System.Drawing.Color]::Khaki
$pinned.Font=New-Object System.Drawing.Font("Consolas",9,[System.Drawing.FontStyle]::Bold)
$pinned.Size=New-Object System.Drawing.Size(690,24)
$pinned.Location=New-Object System.Drawing.Point(31,397)
$controlPage.Controls.Add($pinned)

$runtime=New-Object System.Windows.Forms.TextBox
$runtime.Multiline=$true
$runtime.ReadOnly=$true
$runtime.BorderStyle="FixedSingle"
$runtime.BackColor=[System.Drawing.Color]::FromArgb(12,14,18)
$runtime.ForeColor=[System.Drawing.Color]::Gainsboro
$runtime.Font=New-Object System.Drawing.Font("Consolas",9)
$runtime.Size=New-Object System.Drawing.Size(690,115)
$runtime.Location=New-Object System.Drawing.Point(31,427)
$controlPage.Controls.Add($runtime)

$stop=New-Object System.Windows.Forms.Button
$stop.Text="STOP ALL"
$stop.Size=New-Object System.Drawing.Size(160,46)
$stop.Location=New-Object System.Drawing.Point(31,565)
$stop.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$stop.FlatStyle="Flat"
$stop.ForeColor=[System.Drawing.Color]::White
$stop.BackColor=[System.Drawing.Color]::FromArgb(165,52,52)
$controlPage.Controls.Add($stop)

$refresh=New-Object System.Windows.Forms.Button
$refresh.Text="REFRESH STATUS"
$refresh.Size=New-Object System.Drawing.Size(160,46)
$refresh.Location=New-Object System.Drawing.Point(207,565)
$refresh.Font=New-Object System.Drawing.Font("Segoe UI",10,[System.Drawing.FontStyle]::Bold)
$refresh.FlatStyle="Flat"
$refresh.ForeColor=[System.Drawing.Color]::White
$refresh.BackColor=[System.Drawing.Color]::FromArgb(70,74,84)
$controlPage.Controls.Add($refresh)

$note=New-Object System.Windows.Forms.Label
$note.Text="Closing this selector does NOT stop the active mode."
$note.ForeColor=[System.Drawing.Color]::DarkGray
$note.Font=New-Object System.Drawing.Font("Segoe UI",9)
$note.Size=New-Object System.Drawing.Size(340,28)
$note.Location=New-Object System.Drawing.Point(381,574)
$controlPage.Controls.Add($note)

$scientistMenu=New-Object System.Windows.Forms.Button
$scientistMenu.Text=[string][char]0x2630
$scientistMenu.Size=New-Object System.Drawing.Size(40,36)
$scientistMenu.Location=New-Object System.Drawing.Point(681,18)
$scientistMenu.Font=New-Object System.Drawing.Font("Segoe UI",15,[System.Drawing.FontStyle]::Bold)
$scientistMenu.FlatStyle="Flat"
$scientistMenu.ForeColor=[System.Drawing.Color]::White
$scientistMenu.BackColor=[System.Drawing.Color]::FromArgb(48,52,63)
$controlPage.Controls.Add($scientistMenu)

$scientistPanel=New-Object System.Windows.Forms.Panel
$scientistPanel.Size=New-Object System.Drawing.Size(370,740)
$scientistPanel.Location=New-Object System.Drawing.Point(742,0)
$scientistPanel.BackColor=[System.Drawing.Color]::FromArgb(13,15,20)
$scientistPanel.Visible=$true
$controlPage.Controls.Add($scientistPanel)

$installerClientsPanel=New-Object System.Windows.Forms.Panel
$installerClientsPanel.Size=New-Object System.Drawing.Size(500,740)
$installerClientsPanel.Location=New-Object System.Drawing.Point(1120,0)
$installerClientsPanel.BackColor=[System.Drawing.Color]::FromArgb(11,13,18)
$installerClientsPanel.BorderStyle="FixedSingle"
$installerClientsPanel.Anchor="Top,Bottom,Left,Right"
$controlPage.Controls.Add($installerClientsPanel)

$installerClientsTitle=New-Object System.Windows.Forms.Label
$installerClientsTitle.Text="INSTALLER CLIENTS"
$installerClientsTitle.ForeColor=[System.Drawing.Color]::White
$installerClientsTitle.Font=New-Object System.Drawing.Font("Segoe UI",15,[System.Drawing.FontStyle]::Bold)
$installerClientsTitle.AutoSize=$true
$installerClientsTitle.Location=New-Object System.Drawing.Point(18,18)
$installerClientsPanel.Controls.Add($installerClientsTitle)

$installerClientsSummary=New-Object System.Windows.Forms.Label
$installerClientsSummary.Text="REGISTRY: STARTING..."
$installerClientsSummary.ForeColor=[System.Drawing.Color]::Khaki
$installerClientsSummary.Font=New-Object System.Drawing.Font("Consolas",9,[System.Drawing.FontStyle]::Bold)
$installerClientsSummary.Size=New-Object System.Drawing.Size(460,46)
$installerClientsSummary.Location=New-Object System.Drawing.Point(20,54)
$installerClientsSummary.Anchor="Top,Left,Right"
$installerClientsPanel.Controls.Add($installerClientsSummary)

$installerClientsList=New-Object System.Windows.Forms.ListView
$installerClientsList.View=[System.Windows.Forms.View]::Details
$installerClientsList.FullRowSelect=$true
$installerClientsList.GridLines=$true
$installerClientsList.HideSelection=$false
$installerClientsList.MultiSelect=$false
$installerClientsList.BackColor=[System.Drawing.Color]::FromArgb(8,10,14)
$installerClientsList.ForeColor=[System.Drawing.Color]::Gainsboro
$installerClientsList.Font=New-Object System.Drawing.Font("Consolas",9)
$installerClientsList.Location=New-Object System.Drawing.Point(20,105)
$installerClientsList.Size=New-Object System.Drawing.Size(455,430)
$installerClientsList.Anchor="Top,Bottom,Left,Right"
[void]$installerClientsList.Columns.Add("PERSON",135)
[void]$installerClientsList.Columns.Add("STATE",80)
[void]$installerClientsList.Columns.Add("VERSION",75)
[void]$installerClientsList.Columns.Add("MODE",90)
[void]$installerClientsList.Columns.Add("TASK",190)
[void]$installerClientsList.Columns.Add("LAST SEEN",155)
$installerClientsPanel.Controls.Add($installerClientsList)

$installerClientDetailLabel=New-Object System.Windows.Forms.Label
$installerClientDetailLabel.Text="SELECT INSTALLER CLIENT"
$installerClientDetailLabel.ForeColor=[System.Drawing.Color]::Silver
$installerClientDetailLabel.Font=New-Object System.Drawing.Font("Segoe UI",8,[System.Drawing.FontStyle]::Bold)
$installerClientDetailLabel.AutoSize=$true
$installerClientDetailLabel.Location=New-Object System.Drawing.Point(20,548)
$installerClientDetailLabel.Anchor="Bottom,Left"
$installerClientsPanel.Controls.Add($installerClientDetailLabel)

$installerClientDetail=New-Object System.Windows.Forms.TextBox
$installerClientDetail.Multiline=$true
$installerClientDetail.ReadOnly=$true
$installerClientDetail.ScrollBars="Vertical"
$installerClientDetail.BackColor=[System.Drawing.Color]::FromArgb(8,10,14)
$installerClientDetail.ForeColor=[System.Drawing.Color]::Gainsboro
$installerClientDetail.Font=New-Object System.Drawing.Font("Consolas",9)
$installerClientDetail.Location=New-Object System.Drawing.Point(20,572)
$installerClientDetail.Size=New-Object System.Drawing.Size(455,145)
$installerClientDetail.Anchor="Bottom,Left,Right"
$installerClientDetail.Text="Only authenticated DAVID Installer heartbeat clients appear here."
$installerClientsPanel.Controls.Add($installerClientDetail)

$scientistTitle=New-Object System.Windows.Forms.Label
$scientistTitle.Text="SF AI SCIENTIST"
$scientistTitle.ForeColor=[System.Drawing.Color]::White
$scientistTitle.Font=New-Object System.Drawing.Font("Segoe UI",15,[System.Drawing.FontStyle]::Bold)
$scientistTitle.AutoSize=$true
$scientistTitle.Location=New-Object System.Drawing.Point(18,18)
$scientistPanel.Controls.Add($scientistTitle)

$scientistInnerMenu=New-Object System.Windows.Forms.Button
$scientistInnerMenu.Text=[string][char]0x2630
$scientistInnerMenu.Size=New-Object System.Drawing.Size(34,32)
$scientistInnerMenu.Location=New-Object System.Drawing.Point(316,14)
$scientistInnerMenu.Font=New-Object System.Drawing.Font("Segoe UI",13,[System.Drawing.FontStyle]::Bold)
$scientistInnerMenu.FlatStyle="Flat"
$scientistInnerMenu.ForeColor=[System.Drawing.Color]::White
$scientistInnerMenu.BackColor=[System.Drawing.Color]::FromArgb(48,52,63)
$scientistInnerMenu.Tag="Toggle realtime Scientist console"
$scientistPanel.Controls.Add($scientistInnerMenu)

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
$scientistDecision.Size=New-Object System.Drawing.Size(325,115)
$scientistDecision.Location=New-Object System.Drawing.Point(20,166)
$scientistPanel.Controls.Add($scientistDecision)

$scientistChatLabel=New-Object System.Windows.Forms.Label
$scientistChatLabel.Text="CHAT WITH SCIENTIST"
$scientistChatLabel.ForeColor=[System.Drawing.Color]::Silver
$scientistChatLabel.Font=New-Object System.Drawing.Font("Segoe UI",8,[System.Drawing.FontStyle]::Bold)
$scientistChatLabel.AutoSize=$true
$scientistChatLabel.Location=New-Object System.Drawing.Point(20,294)
$scientistPanel.Controls.Add($scientistChatLabel)

$scientistReply=New-Object System.Windows.Forms.TextBox
$scientistReply.Multiline=$true
$scientistReply.ReadOnly=$true
$scientistReply.ScrollBars="Vertical"
$scientistReply.BackColor=[System.Drawing.Color]::FromArgb(10,12,16)
$scientistReply.ForeColor=[System.Drawing.Color]::White
$scientistReply.Font=New-Object System.Drawing.Font("Segoe UI",9)
$scientistReply.Size=New-Object System.Drawing.Size(325,100)
$scientistReply.Location=New-Object System.Drawing.Point(20,317)
$scientistPanel.Controls.Add($scientistReply)

$scientistActionLabel=New-Object System.Windows.Forms.Label
$scientistActionLabel.Text="LIVE ACTION / POWERSHELL"
$scientistActionLabel.ForeColor=[System.Drawing.Color]::Silver
$scientistActionLabel.Font=New-Object System.Drawing.Font("Segoe UI",8,[System.Drawing.FontStyle]::Bold)
$scientistActionLabel.AutoSize=$true
$scientistActionLabel.Location=New-Object System.Drawing.Point(20,430)
$scientistPanel.Controls.Add($scientistActionLabel)

$scientistAction=New-Object System.Windows.Forms.TextBox
$scientistAction.Multiline=$true
$scientistAction.ReadOnly=$true
$scientistAction.ScrollBars="Vertical"
$scientistAction.BackColor=[System.Drawing.Color]::FromArgb(10,12,16)
$scientistAction.ForeColor=[System.Drawing.Color]::LightGreen
$scientistAction.Font=New-Object System.Drawing.Font("Consolas",9)
$scientistAction.Size=New-Object System.Drawing.Size(325,120)
$scientistAction.Location=New-Object System.Drawing.Point(20,452)
$scientistAction.Text="IDLE - waiting for Scientist tool action."
$scientistPanel.Controls.Add($scientistAction)

$scientistInput=New-Object System.Windows.Forms.TextBox
$scientistInput.Multiline=$true
$scientistInput.BackColor=[System.Drawing.Color]::FromArgb(22,25,32)
$scientistInput.ForeColor=[System.Drawing.Color]::White
$scientistInput.Font=New-Object System.Drawing.Font("Segoe UI",9)
$scientistInput.Size=New-Object System.Drawing.Size(238,65)
$scientistInput.Location=New-Object System.Drawing.Point(20,585)
$scientistPanel.Controls.Add($scientistInput)

$scientistSend=New-Object System.Windows.Forms.Button
$scientistSend.Text="SEND"
$scientistSend.Size=New-Object System.Drawing.Size(77,65)
$scientistSend.Location=New-Object System.Drawing.Point(268,585)
$scientistSend.FlatStyle="Flat"
$scientistSend.ForeColor=[System.Drawing.Color]::White
$scientistSend.BackColor=[System.Drawing.Color]::FromArgb(83,64,145)
$scientistPanel.Controls.Add($scientistSend)

$scientistHint=New-Object System.Windows.Forms.Label
$scientistHint.Text="Scientist sidecar: DAVID 9444 architecture stays unchanged."
$scientistHint.ForeColor=[System.Drawing.Color]::DarkGray
$scientistHint.Font=New-Object System.Drawing.Font("Segoe UI",8)
$scientistHint.Size=New-Object System.Drawing.Size(325,55)
$scientistHint.Location=New-Object System.Drawing.Point(20,660)
$scientistPanel.Controls.Add($scientistHint)

$scientistConsolePanel=New-Object System.Windows.Forms.Panel
$scientistConsolePanel.Size=New-Object System.Drawing.Size(370,740)
$scientistConsolePanel.Location=New-Object System.Drawing.Point(0,0)
$scientistConsolePanel.BackColor=[System.Drawing.Color]::FromArgb(8,10,14)
$scientistConsolePanel.Visible=$false
$scientistPanel.Controls.Add($scientistConsolePanel)

$scientistConsoleTitle=New-Object System.Windows.Forms.Label
$scientistConsoleTitle.Text="REALTIME SCIENTIST CONSOLE"
$scientistConsoleTitle.ForeColor=[System.Drawing.Color]::White
$scientistConsoleTitle.Font=New-Object System.Drawing.Font("Segoe UI",14,[System.Drawing.FontStyle]::Bold)
$scientistConsoleTitle.AutoSize=$true
$scientistConsoleTitle.Location=New-Object System.Drawing.Point(18,18)
$scientistConsolePanel.Controls.Add($scientistConsoleTitle)

$scientistConsoleMenu=New-Object System.Windows.Forms.Button
$scientistConsoleMenu.Text=[string][char]0x2630
$scientistConsoleMenu.Size=New-Object System.Drawing.Size(34,32)
$scientistConsoleMenu.Location=New-Object System.Drawing.Point(316,14)
$scientistConsoleMenu.Font=New-Object System.Drawing.Font("Segoe UI",13,[System.Drawing.FontStyle]::Bold)
$scientistConsoleMenu.FlatStyle="Flat"
$scientistConsoleMenu.ForeColor=[System.Drawing.Color]::White
$scientistConsoleMenu.BackColor=[System.Drawing.Color]::FromArgb(48,52,63)
$scientistConsolePanel.Controls.Add($scientistConsoleMenu)

$scientistConsoleStatus=New-Object System.Windows.Forms.Label
$scientistConsoleStatus.Text="IDLE"
$scientistConsoleStatus.ForeColor=[System.Drawing.Color]::LightGreen
$scientistConsoleStatus.Font=New-Object System.Drawing.Font("Consolas",9,[System.Drawing.FontStyle]::Bold)
$scientistConsoleStatus.Size=New-Object System.Drawing.Size(325,45)
$scientistConsoleStatus.Location=New-Object System.Drawing.Point(20,58)
$scientistConsolePanel.Controls.Add($scientistConsoleStatus)

$scientistConsole=New-Object System.Windows.Forms.TextBox
$scientistConsole.Multiline=$true
$scientistConsole.ReadOnly=$true
$scientistConsole.ScrollBars="Both"
$scientistConsole.WordWrap=$false
$scientistConsole.BackColor=[System.Drawing.Color]::Black
$scientistConsole.ForeColor=[System.Drawing.Color]::LightGreen
$scientistConsole.Font=New-Object System.Drawing.Font("Consolas",9)
$scientistConsole.Size=New-Object System.Drawing.Size(325,585)
$scientistConsole.Location=New-Object System.Drawing.Point(20,105)
$scientistConsole.Text="Waiting for Scientist activity..."
$scientistConsolePanel.Controls.Add($scientistConsole)

$scientistConsoleHint=New-Object System.Windows.Forms.Label
$scientistConsoleHint.Text="Live view only. Full commands/results are still audited in .sf-scientist-operator.jsonl."
$scientistConsoleHint.ForeColor=[System.Drawing.Color]::DarkGray
$scientistConsoleHint.Font=New-Object System.Drawing.Font("Segoe UI",8)
$scientistConsoleHint.Size=New-Object System.Drawing.Size(325,35)
$scientistConsoleHint.Location=New-Object System.Drawing.Point(20,695)
$scientistConsolePanel.Controls.Add($scientistConsoleHint)

$script:ActionProcess=$null
$script:ActionName=""
$script:Busy=$false
$script:Closing=$false
$script:LastRefresh=[DateTime]::MinValue

$script:ScientistDrawerOpen=$true
$script:ScientistConsoleOpen=$false
$script:ScientistProcess=$null
$script:ControlPanelPreviewProcess=$null
$script:InstallerClientsSyncProcess=$null
$script:InstallerClientsSignature=""
$script:TaskRows=@()
$script:TaskConnections=@()
$script:TaskNodeControls=@{}
$script:SelectedTaskKey=""
$script:TaskDetailOpen=$false
$script:TaskGraphSignature=""
$script:GraphPulse=$false
$script:LastPreviewPath=""
$script:LastPreviewStamp=0

function Get-NodePath{
  $portableNode="D:\ASI\tools\node\node.exe"
  if(Test-Path $portableNode){return $portableNode}
  try{
    $n=Get-Command node.exe -ErrorAction SilentlyContinue
    if(-not$n){$n=Get-Command node -ErrorAction SilentlyContinue}
    if($n){return [string]$n.Source}
  }catch{}
  return ""
}

function Start-InstallerClientsSync{
  if((Get-NodeCount "installer-client-registry-sync.mjs")-gt 0){return}
  if(-not(Test-Path $InstallerClientsSyncWorker)){return}
  $nodePath=Get-NodePath
  if([string]::IsNullOrWhiteSpace($nodePath)){return}
  try{
    $script:InstallerClientsSyncProcess=Start-Process -FilePath $nodePath -ArgumentList @($InstallerClientsSyncWorker) -WorkingDirectory $DavidDir -PassThru -WindowStyle Hidden
  }catch{}
}

function Stop-InstallerClientsSync{
  try{
    Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $_.Name-eq"node.exe"-and
        ([string]$_.CommandLine)-like"*installer-client-registry-sync.mjs*"
      } |
      ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
  }catch{}
}

function Layout-InstallerClientsPanel{
  try{
    $scientistPanel.Height=[Math]::Max(640,$controlPage.ClientSize.Height-8)
    $x=$scientistPanel.Right+8
    $w=[Math]::Max(320,$controlPage.ClientSize.Width-$x-8)
    $installerClientsPanel.Location=New-Object System.Drawing.Point($x,0)
    $installerClientsPanel.Size=New-Object System.Drawing.Size($w,[Math]::Max(640,$controlPage.ClientSize.Height-8))
  }catch{}
}

function Show-InstallerClientDetail{
  if($installerClientsList.SelectedItems.Count-eq0){
    $installerClientDetail.Text="Select an installer client to see runtime details."
    return
  }

  $c=$installerClientsList.SelectedItems[0].Tag
  if(-not$c){return}
  $lines=New-Object System.Collections.Generic.List[string]
  $lines.Add("PERSON: "+[string]$c.name)
  $lines.Add("CONNECTION: "+[string]$c.connectionStatus+" | RUNTIME: "+[string]$c.runtimeStatus)
  $lines.Add("DAVID VERSION: "+[string]$c.installerVersion)
  if(-not[string]::IsNullOrWhiteSpace([string]$c.deviceName)){$lines.Add("DEVICE: "+[string]$c.deviceName)}
  if(-not[string]::IsNullOrWhiteSpace([string]$c.mode)){$lines.Add("MODE: "+[string]$c.mode)}
  if(-not[string]::IsNullOrWhiteSpace([string]$c.currentTask)){
    $lines.Add("")
    $lines.Add("CURRENT TASK:")
    $lines.Add([string]$c.currentTask)
  }
  if(-not[string]::IsNullOrWhiteSpace([string]$c.lastError)){
    $lines.Add("")
    $lines.Add("ERROR:")
    $lines.Add([string]$c.lastError)
  }
  $lines.Add("")
  $lines.Add("LAST SEEN: "+[string]$c.lastSeenAt)
  $installerClientDetail.Text=($lines -join [Environment]::NewLine)
}

function Update-InstallerClientsUi{
  Start-InstallerClientsSync
  $workerCount=Get-NodeCount "installer-client-registry-sync.mjs"
  $m=Read-Json $InstallerClientsCache

  if(-not$m){
    $installerClientsSummary.Text=("REGISTRY W={0} | waiting for installer heartbeat registry..." -f $workerCount)
    $installerClientsSummary.ForeColor=[System.Drawing.Color]::Khaki
    return
  }

  $clients=@($m.clients)
  $online=[int]$m.online
  $working=[int]$m.working
  $total=[int]$m.total
  $updated=[string]$m.updatedAt
  $err=[string]$m.error

  if([string]::IsNullOrWhiteSpace($err)){
    if($total-eq0){
      $installerClientsSummary.Text=("CONNECTED: 0/0 | NO INSTALLER CLIENTS REGISTERED | W={0}" -f $workerCount)
      $installerClientsSummary.ForeColor=[System.Drawing.Color]::DarkGray
    }else{
      $installerClientsSummary.Text=("CONNECTED: {0}/{1} | WORKING: {2} | W={3} | UPDATED={4}" -f $online,$total,$working,$workerCount,$updated)
      $installerClientsSummary.ForeColor=[System.Drawing.Color]::LightGreen
    }
  }else{
    $installerClientsSummary.Text=("REGISTRY WARNING | W={0} | {1}" -f $workerCount,$err)
    $installerClientsSummary.ForeColor=[System.Drawing.Color]::Orange
  }

  $sig=($clients|ForEach-Object{
    ([string]$_.name)+"|"+([string]$_.connectionStatus)+"|"+([string]$_.runtimeStatus)+"|"+([string]$_.installerVersion)+"|"+([string]$_.mode)+"|"+([string]$_.currentTask)+"|"+([string]$_.lastSeenAt)
  })-join"||"

  if($sig-ne$script:InstallerClientsSignature){
    $selectedName=""
    if($installerClientsList.SelectedItems.Count-gt0){$selectedName=[string]$installerClientsList.SelectedItems[0].Text}
    $script:InstallerClientsSignature=$sig
    $installerClientsList.BeginUpdate()
    try{
      $installerClientsList.Items.Clear()
      foreach($c in $clients){
        $name=[string]$c.name
        $connection=[string]$c.connectionStatus
        $runtimeStatus=[string]$c.runtimeStatus
        $state=$connection
        if($connection-eq"ONLINE"-and-not[string]::IsNullOrWhiteSpace($runtimeStatus)){$state=$runtimeStatus}
        $version=[string]$c.installerVersion
        $mode=[string]$c.mode
        $task=[string]$c.currentTask
        $lastSeen=[string]$c.lastSeenAt
        if($task.Length-gt70){$task=$task.Substring(0,70)+"..."}

        $item=New-Object System.Windows.Forms.ListViewItem($name)
        [void]$item.SubItems.Add($state)
        [void]$item.SubItems.Add($version)
        [void]$item.SubItems.Add($mode)
        [void]$item.SubItems.Add($task)
        [void]$item.SubItems.Add($lastSeen)
        $item.Tag=$c

        if($connection-eq"ONLINE"){
          if($runtimeStatus-eq"WORKING"){$item.ForeColor=[System.Drawing.Color]::Cyan}
          else{$item.ForeColor=[System.Drawing.Color]::LightGreen}
        }elseif($connection-eq"STALE"){
          $item.ForeColor=[System.Drawing.Color]::Khaki
        }else{
          $item.ForeColor=[System.Drawing.Color]::DarkGray
        }

        [void]$installerClientsList.Items.Add($item)
        if(-not[string]::IsNullOrWhiteSpace($selectedName)-and$name-eq$selectedName){$item.Selected=$true}
      }
    }finally{$installerClientsList.EndUpdate()}

    if($clients.Count-eq0){
      $installerClientDetail.Text="No registered DAVID Installer heartbeat clients yet."
    }elseif($installerClientsList.SelectedItems.Count-eq0-and$installerClientsList.Items.Count-gt0){
      $installerClientsList.Items[0].Selected=$true
    }
    Show-InstallerClientDetail
  }
}

function Start-ControlPanelPreviewWorker{
  if((Get-NodeCount "control-panel-task-preview.mjs")-gt 0){return}
  if(-not(Test-Path $ControlPanelPreviewWorker)){return}

  $nodePath=Get-NodePath
  if([string]::IsNullOrWhiteSpace($nodePath)){return}

  try{
    $env:DAVID_CDP_URL="http://127.0.0.1:$Port"
    $env:SF_SCIENTIST_CDP_URL="http://127.0.0.1:9555"
    $script:ControlPanelPreviewProcess=Start-Process -FilePath $nodePath -ArgumentList @($ControlPanelPreviewWorker) -WorkingDirectory $DavidDir -PassThru -WindowStyle Hidden
  }catch{}
}

function Stop-ControlPanelPreviewWorker{
  try{
    Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $_.Name-eq"node.exe"-and
        ([string]$_.CommandLine)-like"*control-panel-task-preview.mjs*"
      } |
      ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
  }catch{}
}

function Set-TaskPreviewImage{
  param([string]$Path)
  if([string]::IsNullOrWhiteSpace($Path)-or-not(Test-Path -LiteralPath $Path)){return}

  try{
    $stamp=[System.IO.File]::GetLastWriteTimeUtc($Path).Ticks
    if($script:LastPreviewPath-eq$Path-and$script:LastPreviewStamp-eq$stamp){return}

    $bytes=[System.IO.File]::ReadAllBytes($Path)
    $ms=New-Object System.IO.MemoryStream(,$bytes)
    try{
      $img=[System.Drawing.Image]::FromStream($ms)
      try{$clone=New-Object System.Drawing.Bitmap($img)}finally{$img.Dispose()}
    }finally{$ms.Dispose()}

    $old=$taskPreview.Image
    $taskPreview.Image=$clone
    if($old){try{$old.Dispose()}catch{}}
    $script:LastPreviewPath=$Path
    $script:LastPreviewStamp=$stamp
  }catch{}
}

function Get-TaskByKey{
  param([string]$Key)
  if([string]::IsNullOrWhiteSpace($Key)){return $null}
  foreach($t in @($script:TaskRows)){
    if(([string]$t.key)-eq$Key){return $t}
  }
  return $null
}

function Clear-TaskPreviewImage{
  try{
    $old=$taskPreview.Image
    $taskPreview.Image=$null
    if($old){$old.Dispose()}
  }catch{}
  $script:LastPreviewPath=""
  $script:LastPreviewStamp=0
}

function Set-TaskStatusStyle{
  param(
    [System.Windows.Forms.Button]$Button,
    [string]$Status,
    [bool]$Working
  )

  $st=([string]$Status).ToUpperInvariant()
  if($st-eq"THINKING"){
    $Button.BackColor=[System.Drawing.Color]::FromArgb(20,55,78)
    $Button.FlatAppearance.BorderColor=[System.Drawing.Color]::DeepSkyBlue
    $Button.ForeColor=[System.Drawing.Color]::White
  }elseif($Working){
    $Button.BackColor=[System.Drawing.Color]::FromArgb(20,62,42)
    $Button.FlatAppearance.BorderColor=[System.Drawing.Color]::LimeGreen
    $Button.ForeColor=[System.Drawing.Color]::White
  }elseif($st-eq"NO_TAB"){
    $Button.BackColor=[System.Drawing.Color]::FromArgb(74,57,18)
    $Button.FlatAppearance.BorderColor=[System.Drawing.Color]::Goldenrod
    $Button.ForeColor=[System.Drawing.Color]::White
  }else{
    $Button.BackColor=[System.Drawing.Color]::FromArgb(58,25,29)
    $Button.FlatAppearance.BorderColor=[System.Drawing.Color]::Firebrick
    $Button.ForeColor=[System.Drawing.Color]::Silver
  }
}

function Build-TaskGraph{
  $taskGraph.SuspendLayout()
  try{
    $taskGraph.Controls.Clear()
    $script:TaskNodeControls=@{}

    $rows=@($script:TaskRows)
    if($rows.Count-eq0){
      $empty=New-Object System.Windows.Forms.Label
      $empty.Text="NO TASK DATA YET"
      $empty.ForeColor=[System.Drawing.Color]::DarkGray
      $empty.Font=New-Object System.Drawing.Font("Segoe UI",18,[System.Drawing.FontStyle]::Bold)
      $empty.AutoSize=$true
      $empty.Location=New-Object System.Drawing.Point(40,60)
      $taskGraph.Controls.Add($empty)
      return
    }

    $w=[Math]::Max(900,$taskGraph.ClientSize.Width)
    $cols=4
    if($w-lt1200){$cols=3}
    if($w-lt900){$cols=2}

    $gap=28
    $boxW=[Math]::Floor(($w-(($cols+1)*$gap))/$cols)
    if($boxW-gt320){$boxW=320}
    if($boxW-lt210){$boxW=210}
    $boxH=122
    $rowGap=42
    $top=36
    $nl=[Environment]::NewLine

    for($i=0;$i-lt$rows.Count;$i++){
      $t=$rows[$i]
      $col=$i%$cols
      $row=[Math]::Floor($i/$cols)
      $x=$gap+($col*($boxW+$gap))
      $y=$top+($row*($boxH+$rowGap))

      $role=[string]$t.role
      $status=[string]$t.status
      $source=[string]$t.source
      $cdp=[string]$t.cdp
      $title=[string]$t.title
      if($title.Length-gt34){$title=$title.Substring(0,34)+"..."}
      $working=[bool]$t.working
      $phase=""
      $sendText="SEND: -"
      if($t.progress){
        $phase=[string]$t.progress.phase
        if($phase.Length-gt28){$phase=$phase.Substring(0,28)+"..."}
        if([bool]$t.progress.sendAck){$sendText="SEND: ACK"}
        elseif(-not[string]::IsNullOrWhiteSpace([string]$t.progress.sendStatus)){$sendText="SEND: "+[string]$t.progress.sendStatus}
      }

      $b=New-Object System.Windows.Forms.Button
      $b.Tag=[string]$t.key
      $line2=$status+" | "+$sendText
      $line3=if([string]::IsNullOrWhiteSpace($phase)){$source+" "+$cdp}else{"PHASE: "+$phase}
      $b.Text=($role+$nl+$line2+$nl+$line3)
      $b.TextAlign="MiddleLeft"
      $b.Size=New-Object System.Drawing.Size($boxW,$boxH)
      $b.Location=New-Object System.Drawing.Point($x,$y)
      $b.Font=New-Object System.Drawing.Font("Consolas",10,[System.Drawing.FontStyle]::Bold)
      $b.FlatStyle="Flat"
      $b.FlatAppearance.BorderSize=3
      $b.Cursor=[System.Windows.Forms.Cursors]::Hand
      Set-TaskStatusStyle -Button $b -Status $status -Working $working
      $b.Add_Click({
        param($sender,$e)
        Open-TaskDetail -Key ([string]$sender.Tag)
      })

      $taskGraph.Controls.Add($b)
      $script:TaskNodeControls[[string]$t.key]=$b
    }
  }finally{
    $taskGraph.ResumeLayout()
  }
  $taskGraph.Invalidate()
}

function Refresh-TaskDetail{
  $t=Get-TaskByKey -Key $script:SelectedTaskKey
  if(-not$t){
    $taskDetailTitle.Text="TASK NOT AVAILABLE"
    $taskDetailStatus.Text="STATUS: OFFLINE"
    $taskProgress.Text="TASK NOT AVAILABLE"+[Environment]::NewLine+"The selected task is no longer present in the current task manifest."
    return
  }

  $role=[string]$t.role
  $status=[string]$t.status
  $working=[bool]$t.working
  $taskDetailTitle.Text=$role+" - TASK PROGRESS"
  $taskDetailStatus.Text=("STATUS: {0} | WORKING: {1} | SOURCE: {2} | CDP: {3}" -f $status,([string]$working).ToUpperInvariant(),[string]$t.source,[string]$t.cdp)

  if($status-eq"THINKING"){
    $taskDetailStatus.ForeColor=[System.Drawing.Color]::DeepSkyBlue
  }elseif($working){
    $taskDetailStatus.ForeColor=[System.Drawing.Color]::LightGreen
  }elseif($status-eq"NO_TAB"){
    $taskDetailStatus.ForeColor=[System.Drawing.Color]::Khaki
  }else{
    $taskDetailStatus.ForeColor=[System.Drawing.Color]::Tomato
  }

  $lines=New-Object System.Collections.Generic.List[string]
  $lines.Add("=== DO KUDE E ZADACHATA ===")
  $lines.Add("")
  $lines.Add("TASK: "+$role)
  $lines.Add("RUNTIME: "+$status+" | WORKING="+([string]$working).ToUpperInvariant())
  $lines.Add("TITLE: "+[string]$t.title)
  $lines.Add("")

  if($t.progress){
    $p=$t.progress
    $phase=[string]$p.phase
    if([string]::IsNullOrWhiteSpace($phase)){$phase="unknown"}
    $lines.Add("PHASE NOW: "+$phase)

    $sendAck=if([bool]$p.sendAck){"TRUE"}else{"FALSE"}
    $sendStatus=[string]$p.sendStatus
    if([string]::IsNullOrWhiteSpace($sendStatus)){$sendStatus="NO SEND TELEMETRY YET"}
    $lines.Add("GPT SEND ACK: "+$sendAck)
    $lines.Add("GPT SEND STATUS: "+$sendStatus)

    if(-not[string]::IsNullOrWhiteSpace([string]$p.sendMethod)){
      $lines.Add("SEND METHOD: "+[string]$p.sendMethod)
    }
    if([int]$p.sendAttempt-gt0){
      $lines.Add("SEND ATTEMPT: "+[string]$p.sendAttempt)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.sendSignal)){
      $lines.Add("ACK SIGNAL: "+[string]$p.sendSignal)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.sendAt)){
      $lines.Add("LAST VERIFIED SEND: "+[string]$p.sendAt)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.sendError)){
      $lines.Add("SEND ERROR: "+[string]$p.sendError)
    }

    $lines.Add("")
    $lines.Add("TURNS SENT: "+[string]$p.turnsSent)
    $lines.Add("RELAY ATTEMPTS: "+[string]$p.relayAttempts)
    $lines.Add("RECOVERY ATTEMPT: "+[string]$p.recoveryAttempt)

    if(-not[string]::IsNullOrWhiteSpace([string]$p.lastAction)){
      $lines.Add("")
      $lines.Add("LAST ACTION:")
      $lines.Add([string]$p.lastAction)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.lastResult)){
      $lines.Add("")
      $lines.Add("LAST RESULT:")
      $lines.Add([string]$p.lastResult)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.problem)){
      $lines.Add("")
      $lines.Add("PROBLEM:")
      $lines.Add([string]$p.problem)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.problemRetryAt)){
      $lines.Add("RETRY AT: "+[string]$p.problemRetryAt)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.promptPreview)){
      $lines.Add("")
      $lines.Add("LAST PROMPT PREVIEW:")
      $lines.Add([string]$p.promptPreview)
    }
    if(-not[string]::IsNullOrWhiteSpace([string]$p.stateUpdatedAt)){
      $lines.Add("")
      $lines.Add("WORKER STATE UPDATED: "+[string]$p.stateUpdatedAt)
    }
  }else{
    $lines.Add("PHASE NOW: no worker state file available")
    $lines.Add("GPT SEND ACK: UNKNOWN")
  }

  $lines.Add("")
  $lines.Add("TAB UPDATED: "+[string]$t.updatedAt)
  $lines.Add("URL: "+[string]$t.url)

  $taskProgress.Text=($lines -join [Environment]::NewLine)
}
function Open-TaskDetail{
  param([string]$Key)
  $t=Get-TaskByKey -Key $Key
  if(-not$t){return}

  $script:SelectedTaskKey=$Key
  $script:TaskDetailOpen=$true
  $taskOverview.Visible=$false
  $taskDetail.Visible=$true
  $taskDetail.BringToFront()
  Refresh-TaskDetail
}

function Close-TaskDetail{
  $script:TaskDetailOpen=$false
  $taskDetail.Visible=$false
  $taskOverview.Visible=$true
  $taskOverview.BringToFront()
  Clear-TaskPreviewImage
  $taskGraph.Invalidate()
}

function Update-TasksUi{
  Start-ControlPanelPreviewWorker
  $workerCount=Get-NodeCount "control-panel-task-preview.mjs"
  $m=Read-Json $ControlPanelTasks

  if(-not$m){
    $tasksStatus.Text=("TASK STATUS WORKER: {0} | waiting for task topology..." -f $(if($workerCount-gt0){"ONLINE"}else{"OFFLINE"}))
    return
  }

  $rows=@($m.tasks)
  $connections=@($m.connections)
  $script:TaskRows=$rows
  $script:TaskConnections=$connections

  $working=@($rows|Where-Object{[bool]$_.working}).Count
  $davidOnline=[string]$m.davidCdpOnline
  $scientistOnline=[string]$m.scientistCdpOnline
  $updated=[string]$m.updatedAt
  $tasksStatus.Text=("STATUS W={0} | WORKING={1}/{2} | DAVID 9444={3} | SCIENTIST 9555={4} | UPDATED={5}" -f $workerCount,$working,$rows.Count,$davidOnline.ToUpperInvariant(),$scientistOnline.ToUpperInvariant(),$updated)

  $taskSig=($rows|ForEach-Object{([string]$_.key)+":"+([string]$_.status)+":"+([string]$_.working)+":"+([string]$_.progress.phase)+":"+([string]$_.progress.sendStatus)+":"+([string]$_.progress.sendAck)+":"+([string]$_.progress.stateUpdatedAt)})-join"|"
  $edgeSig=($connections|ForEach-Object{([string]$_.from)+">"+([string]$_.to)+":"+([string]$_.kind)+":"+([string]$_.active)})-join"|"
  $sizeSig=([string]$taskGraph.ClientSize.Width)+"x"+([string]$taskGraph.ClientSize.Height)
  $graphSig=$taskSig+"||"+$edgeSig+"||"+$sizeSig

  if($graphSig-ne$script:TaskGraphSignature){
    $script:TaskGraphSignature=$graphSig
    Build-TaskGraph
  }

  $script:GraphPulse=-not$script:GraphPulse
  $taskGraph.Invalidate()

  if($script:TaskDetailOpen){
    Refresh-TaskDetail
  }
}

function Focus-SelectedTask{
  $t=Get-TaskByKey -Key $script:SelectedTaskKey
  if(-not$t){return}
  if(-not[bool]$t.working){return}
  if([string]::IsNullOrWhiteSpace([string]$t.url)){return}

  try{
    $cmd=[ordered]@{
      id=[guid]::NewGuid().ToString()
      createdAt=(Get-Date).ToUniversalTime().ToString("o")
      action="FOCUS"
      taskKey=[string]$t.key
    }
    $json=$cmd|ConvertTo-Json -Depth 8
    $utf8NoBom=New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ControlPanelCommand,$json,$utf8NoBom)
  }catch{}
}

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

function Get-ScientistConsoleHistory{
  param($State)

  $out=New-Object System.Collections.Generic.List[string]

  if($State){
    $mode=[string]$State.currentMode
    $cdp=[string]$State.currentCdp9444Online
    $status=[string]$State.lastToolStatus
    $kind=[string]$State.lastToolKind
    $cmd=[string]$State.lastToolCommand
    $result=[string]$State.lastToolResult

    $out.Add("=== CURRENT ===")
    if(-not[string]::IsNullOrWhiteSpace($mode)){$out.Add("DAVID MODE: "+$mode)}
    if(-not[string]::IsNullOrWhiteSpace($cdp)){$out.Add("CDP 9444: "+$cdp.ToUpperInvariant())}
    if(-not[string]::IsNullOrWhiteSpace($status)){$out.Add("STATUS: "+$status)}
    if(-not[string]::IsNullOrWhiteSpace($kind)){$out.Add("ACTION: "+$kind)}
    if(-not[string]::IsNullOrWhiteSpace($cmd)){
      $out.Add("")
      $out.Add("COMMAND:")
      $out.Add($cmd)
    }
    if(-not[string]::IsNullOrWhiteSpace($result)){
      $out.Add("")
      $out.Add("RESULT:")
      $out.Add($result)
    }
    $out.Add("")
    $out.Add("=== RECENT ACTIVITY ===")
  }

  if(Test-Path $ScientistOperatorLog){
    try{
      $raw=@(Get-Content -LiteralPath $ScientistOperatorLog -Tail 30 -ErrorAction Stop)
      foreach($line in $raw){
        if([string]::IsNullOrWhiteSpace($line)){continue}
        try{
          $e=$line|ConvertFrom-Json -ErrorAction Stop
          $at=[string]$e.at
          $kind=[string]$e.kind
          $tool=[string]$e.tool
          if(-not[string]::IsNullOrWhiteSpace($at)){$out.Add("["+ $at +"] "+$kind+$(if($tool){" / "+$tool}else{""}))}
          elseif(-not[string]::IsNullOrWhiteSpace($kind)){$out.Add($kind)}

          $command=[string]$e.command
          if([string]::IsNullOrWhiteSpace($command)){$command=[string]$e.arg}
          if(-not[string]::IsNullOrWhiteSpace($command)){$out.Add("  > "+$command)}

          $stdout=[string]$e.stdout
          if(-not[string]::IsNullOrWhiteSpace($stdout)){$out.Add("  OUT: "+$stdout)}

          $stderr=[string]$e.stderr
          if(-not[string]::IsNullOrWhiteSpace($stderr)){$out.Add("  ERR: "+$stderr)}

          $errorText=[string]$e.error
          if(-not[string]::IsNullOrWhiteSpace($errorText)){$out.Add("  ERROR: "+$errorText)}

          $res=[string]$e.result
          if(-not[string]::IsNullOrWhiteSpace($res)){$out.Add("  RESULT: "+$res)}

          $button=[string]$e.button
          if(-not[string]::IsNullOrWhiteSpace($button)){$out.Add("  UI: "+$button)}
        }catch{
          $out.Add($line)
        }
      }
    }catch{
      $out.Add("Could not read operator log: "+$_.Exception.Message)
    }
  }else{
    $out.Add("No operator log yet.")
  }

  return ($out -join [Environment]::NewLine)
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

    if($st.staleResponseSuppressed){
      $lines.Add("STALE GPT RESPONSE: SUPPRESSED -> REFRESHING CURRENT DAVID STATE")
      $freshMode=[string]$st.freshRuntimeMode
      if(-not[string]::IsNullOrWhiteSpace($freshMode)){$lines.Add("FRESH MODE: "+$freshMode)}
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

    $actionLines=New-Object System.Collections.Generic.List[string]
    $toolStatus=[string]$st.lastToolStatus
    $toolKind=[string]$st.lastToolKind
    $toolCommand=[string]$st.lastToolCommand
    $toolResult=[string]$st.lastToolResult
    $toolStarted=[string]$st.lastToolStartedAt
    $toolFinished=[string]$st.lastToolFinishedAt

    if(-not[string]::IsNullOrWhiteSpace($toolStatus)){$actionLines.Add("STATUS: "+$toolStatus)}
    if(-not[string]::IsNullOrWhiteSpace($toolKind)){$actionLines.Add("ACTION: "+$toolKind)}
    if(-not[string]::IsNullOrWhiteSpace($toolStarted)){$actionLines.Add("START: "+$toolStarted)}
    if(-not[string]::IsNullOrWhiteSpace($toolCommand)){
      $actionLines.Add("")
      $actionLines.Add("COMMAND:")
      $actionLines.Add($toolCommand)
    }
    if(-not[string]::IsNullOrWhiteSpace($toolResult)){
      $actionLines.Add("")
      $actionLines.Add("RESULT:")
      $actionLines.Add($toolResult)
    }
    if(-not[string]::IsNullOrWhiteSpace($toolFinished)){$actionLines.Add("");$actionLines.Add("END: "+$toolFinished)}
    if($actionLines.Count-eq0){$actionLines.Add("IDLE - waiting for Scientist tool action.")}

    $scientistAction.Text=($actionLines -join [Environment]::NewLine)
    if($toolStatus-eq"RUNNING"){$scientistAction.ForeColor=[System.Drawing.Color]::Cyan}
    elseif($toolStatus-eq"DONE"){$scientistAction.ForeColor=[System.Drawing.Color]::LightGreen}
    elseif($toolStatus-eq"FAILED"){$scientistAction.ForeColor=[System.Drawing.Color]::Tomato}
    elseif($toolStatus-eq"BLOCKED"){$scientistAction.ForeColor=[System.Drawing.Color]::Khaki}
    else{$scientistAction.ForeColor=[System.Drawing.Color]::Gainsboro}
  }else{
    $scientistStatus.Text=("STATUS: OFFLINE  WORKER={0}" -f $count)+[Environment]::NewLine+"Scientist auto-starts with DAVID."
    $scientistStatus.ForeColor=[System.Drawing.Color]::Khaki
    $scientistDecision.Text="No Scientist state yet."
    $scientistAction.Text="OFFLINE - no Scientist tool activity."
    $scientistAction.ForeColor=[System.Drawing.Color]::DarkGray
  }

  if($st){
    $toolStatus=[string]$st.lastToolStatus
    $toolKind=[string]$st.lastToolKind
    $consoleHead="MODE="+([string]$st.currentMode)+" | CDP9444="+([string]$st.currentCdp9444Online).ToUpperInvariant()
    if(-not[string]::IsNullOrWhiteSpace($toolStatus)){$consoleHead+=" | "+$toolStatus}
    if(-not[string]::IsNullOrWhiteSpace($toolKind)){$consoleHead+=" | "+$toolKind}
    $scientistConsoleStatus.Text=$consoleHead
    $scientistConsole.Text=Get-ScientistConsoleHistory -State $st
  }else{
    $scientistConsoleStatus.Text="OFFLINE"
    $scientistConsole.Text="No Scientist state yet."
  }

  $shortThought=""
  if($st-and$st.staleResponseSuppressed){
    $shortThought="CONTEXT CHANGED -> stale GPT answer hidden. Refreshing current DAVID state..."
  }elseif($st-and$st.thoughtSummary){
    $shortThought=[string]$st.thoughtSummary
  }elseif($st-and$st.lastThoughtSummary){
    $shortThought=[string]$st.lastThoughtSummary
  }elseif($rp-and$rp.summary){
    $shortThought=[string]$rp.summary
  }elseif($st-and$st.status-eq"thinking"){
    $shortThought="Thinking... waiting for Scientist conclusion."
  }

  if(-not[string]::IsNullOrWhiteSpace($shortThought)){
    $scientistReply.Text=$shortThought
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
      "SOULFLAME"{$badge.Text="ACTIVE: SOULFLAME SYSTEM | CLICK MODE AGAIN TO RESTART";$badge.BackColor=[System.Drawing.Color]::FromArgb(35,119,191);$stop.Enabled=$true}
      "AB"{$badge.Text="ACTIVE: DAVID A + B | CLICK MODE AGAIN TO RESTART";$badge.BackColor=[System.Drawing.Color]::FromArgb(116,63,169);$stop.Enabled=$true}
      "SOLO_SYSTEM"{$badge.Text="ACTIVE: ENCHEV ONLY / FAST | CLICK AGAIN TO RESTART";$badge.BackColor=[System.Drawing.Color]::FromArgb(31,139,119);$stop.Enabled=$true}
      "SOLO_DPP"{$badge.Text="ACTIVE: DPP ONLY / FAST | CLICK AGAIN TO RESTART";$badge.BackColor=[System.Drawing.Color]::FromArgb(193,113,38);$stop.Enabled=$true}
      "SOLO_APK"{$badge.Text="ACTIVE: DAVID APK ONLY / FAST | CLICK AGAIN TO RESTART";$badge.BackColor=[System.Drawing.Color]::FromArgb(156,70,91);$stop.Enabled=$true}
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
$taskGraph.Add_Paint({
  param($sender,$e)

  try{
    $e.Graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    foreach($edge in @($script:TaskConnections)){
      $from=[string]$edge.from
      $to=[string]$edge.to

      if(-not$script:TaskNodeControls.ContainsKey($from)){continue}
      if(-not$script:TaskNodeControls.ContainsKey($to)){continue}

      $a=$script:TaskNodeControls[$from]
      $b=$script:TaskNodeControls[$to]
      if(-not$a-or-not$b){continue}

      $p1=New-Object System.Drawing.Point(
        [int]($a.Left+($a.Width/2)),
        [int]($a.Top+($a.Height/2))
      )
      $p2=New-Object System.Drawing.Point(
        [int]($b.Left+($b.Width/2)),
        [int]($b.Top+($b.Height/2))
      )

      $active=[bool]$edge.active
      $kind=[string]$edge.kind

      if(-not$active){
        $glowColor=[System.Drawing.Color]::FromArgb(35,120,120,120)
        $lineColor=[System.Drawing.Color]::DimGray
      }elseif($kind-eq"SCIENTIST_OBSERVES_DAVID"){
        if($script:GraphPulse){
          $glowColor=[System.Drawing.Color]::FromArgb(85,0,200,255)
          $lineColor=[System.Drawing.Color]::Cyan
        }else{
          $glowColor=[System.Drawing.Color]::FromArgb(60,0,150,220)
          $lineColor=[System.Drawing.Color]::DeepSkyBlue
        }
      }else{
        if($script:GraphPulse){
          $glowColor=[System.Drawing.Color]::FromArgb(85,0,255,120)
          $lineColor=[System.Drawing.Color]::Lime
        }else{
          $glowColor=[System.Drawing.Color]::FromArgb(60,0,200,90)
          $lineColor=[System.Drawing.Color]::LimeGreen
        }
      }

      $glow=New-Object System.Drawing.Pen -ArgumentList @($glowColor,[single]10)
      $line=New-Object System.Drawing.Pen -ArgumentList @($lineColor,[single]3)
      try{
        $e.Graphics.DrawLine($glow,$p1,$p2)
        $e.Graphics.DrawLine($line,$p1,$p2)
      }finally{
        $glow.Dispose()
        $line.Dispose()
      }
    }
  }catch{}
})

$taskBack.Add_Click({Close-TaskDetail})
$focusTask.Add_Click({Focus-SelectedTask})
$refreshTasks.Add_Click({
  $script:TaskGraphSignature=""
  Update-TasksUi
})
$installerClientsList.Add_SelectedIndexChanged({Show-InstallerClientDetail})
$controlPage.Add_Resize({Layout-InstallerClientsPanel})

$taskGraph.Add_SizeChanged({
  $script:TaskGraphSignature=""
})
$mainTabs.Add_SelectedIndexChanged({
  if($mainTabs.SelectedTab-eq$tasksPage){
    Start-ControlPanelPreviewWorker
    Update-TasksUi
  }
})

$scientistInnerMenu.Add_Click({
  $script:ScientistConsoleOpen=$true
  $scientistConsolePanel.Visible=$true
  $scientistConsolePanel.BringToFront()
  Update-ScientistUi
})
$scientistConsoleMenu.Add_Click({
  $script:ScientistConsoleOpen=$false
  $scientistConsolePanel.Visible=$false
  Update-ScientistUi
})

$scientistMenu.Add_Click({
  $script:ScientistDrawerOpen=-not$script:ScientistDrawerOpen
  $scientistPanel.Visible=$script:ScientistDrawerOpen
  if($script:ScientistDrawerOpen){
    if($script:ScientistConsoleOpen){$scientistConsolePanel.Visible=$true;$scientistConsolePanel.BringToFront()}
    Update-ScientistUi
  }else{
    $script:ScientistConsoleOpen=$false
    $scientistConsolePanel.Visible=$false
  }
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
try{
  $form.WindowState=[System.Windows.Forms.FormWindowState]::Maximized
  $form.BringToFront()
  $form.Activate()
}catch{}
Close-OldDavidPowerShellWindows -KeepPid $PID
Hide-OwnConsole
Update-Ui
try{
  # SF Scientist belongs to Mode Center, not to a DAVID runtime mode.
  # Start it whenever the selector opens, even while DAVID itself is STOPPED.
  Start-ScientistSidecar
  Start-ControlPanelPreviewWorker
  Start-InstallerClientsSync
  Layout-InstallerClientsPanel
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
      Update-InstallerClientsUi
      Update-TasksUi
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

try{Stop-ControlPanelPreviewWorker}catch{}
try{Stop-InstallerClientsSync}catch{}
try{
  $old=$taskPreview.Image
  $taskPreview.Image=$null
  if($old){$old.Dispose()}
}catch{}
try{
  if(-not $form.IsDisposed){$form.Dispose()}
}catch{}

if($CenterMutexOwned){
  try{$CenterMutex.ReleaseMutex()|Out-Null}catch{}
}
try{$CenterMutex.Dispose()}catch{}

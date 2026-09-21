param([int]$Port=9444)
$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Repo="D:\ASI\enchev-auctions"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

# Future modes: add one object here and the selector creates another button automatically.
$Modes=@(
  [pscustomobject]@{Name="SOULFLAME SYSTEM";Description="CONTROL + SYSTEM + DPP + APK";Script=(Join-Path $Repo "RESTART_DAVID_AUTONOMY_CLEAN.ps1")},
  [pscustomobject]@{Name="DAVID A + B";Description="2 persistent consciousness experiment chats";Script=(Join-Path $Repo "RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1")}
)

$form=New-Object System.Windows.Forms.Form
$form.Text="DAVID MODE SELECTOR"
$form.StartPosition="CenterScreen"
$form.Size=New-Object System.Drawing.Size(560,330)
$form.MinimumSize=New-Object System.Drawing.Size(560,330)
$form.MaximizeBox=$false
$form.BackColor=[System.Drawing.Color]::FromArgb(20,22,28)

$title=New-Object System.Windows.Forms.Label
$title.Text="DAVID WORK MODE"
$title.ForeColor=[System.Drawing.Color]::White
$title.Font=New-Object System.Drawing.Font("Segoe UI",18,[System.Drawing.FontStyle]::Bold)
$title.AutoSize=$true
$title.Location=New-Object System.Drawing.Point(28,24)
$form.Controls.Add($title)

$subtitle=New-Object System.Windows.Forms.Label
$subtitle.Text="Choose one mode. The other mode stops cleanly; conversation history stays preserved."
$subtitle.ForeColor=[System.Drawing.Color]::LightGray
$subtitle.Font=New-Object System.Drawing.Font("Segoe UI",9)
$subtitle.Size=New-Object System.Drawing.Size(485,42)
$subtitle.Location=New-Object System.Drawing.Point(30,63)
$form.Controls.Add($subtitle)

$status=New-Object System.Windows.Forms.Label
$status.Text="READY"
$status.ForeColor=[System.Drawing.Color]::LightGreen
$status.Font=New-Object System.Drawing.Font("Consolas",10,[System.Drawing.FontStyle]::Bold)
$status.Size=New-Object System.Drawing.Size(490,40)
$status.Location=New-Object System.Drawing.Point(30,238)
$form.Controls.Add($status)

$script:ModeProcess=$null
$script:SelectedMode=$null
$buttons=New-Object System.Collections.Generic.List[System.Windows.Forms.Button]
$x=30
foreach($mode in $Modes){
  $btn=New-Object System.Windows.Forms.Button
  $btn.Text=$mode.Name+"`r`n"+$mode.Description
  $btn.Tag=$mode
  $btn.Size=New-Object System.Drawing.Size(235,98)
  $btn.Location=New-Object System.Drawing.Point($x,118)
  $btn.Font=New-Object System.Drawing.Font("Segoe UI",11,[System.Drawing.FontStyle]::Bold)
  $btn.FlatStyle="Flat"
  $btn.ForeColor=[System.Drawing.Color]::White
  if($mode.Name-eq"SOULFLAME SYSTEM"){$btn.BackColor=[System.Drawing.Color]::FromArgb(40,105,190)}else{$btn.BackColor=[System.Drawing.Color]::FromArgb(120,70,170)}
  $btn.Add_Click({
    if($script:ModeProcess -and -not $script:ModeProcess.HasExited){return}
    $selected=$this.Tag
    if(-not(Test-Path $selected.Script)){
      $status.Text="ERROR: missing "+$selected.Script
      $status.ForeColor=[System.Drawing.Color]::Tomato
      return
    }
    foreach($b in $buttons){$b.Enabled=$false}
    $status.Text="SWITCHING -> "+$selected.Name+" ..."
    $status.ForeColor=[System.Drawing.Color]::Gold
    $script:SelectedMode=$selected.Name
    $script:ModeProcess=Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$selected.Script,"-Port","$Port") -PassThru
  })
  $buttons.Add($btn)
  $form.Controls.Add($btn)
  $x+=255
}

$timer=New-Object System.Windows.Forms.Timer
$timer.Interval=500
$timer.Add_Tick({
  if($script:ModeProcess -and $script:ModeProcess.HasExited){
    $code=$script:ModeProcess.ExitCode
    if($code-eq 0){
      $status.Text="ACTIVE: "+$script:SelectedMode
      $status.ForeColor=[System.Drawing.Color]::LightGreen
    }else{
      $status.Text="FAILED: "+$script:SelectedMode+" (exit "+$code+")"
      $status.ForeColor=[System.Drawing.Color]::Tomato
    }
    $script:ModeProcess=$null
    foreach($b in $buttons){$b.Enabled=$true}
  }
})
$timer.Start()
$form.Add_FormClosed({$timer.Stop()})
[void]$form.ShowDialog()

param([int]$Port=9444,[switch]$SkipUpdate)
$ErrorActionPreference="Stop"

$Repo="D:\ASI\enchev-auctions"
$Git="D:\ASI\tools\PortableGit\cmd\git.exe"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$StopScript=Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$Selector=Join-Path $Repo "DAVID_MODE_SELECTOR_V2.ps1"
$Branch="test/david-autonomy-system-dpp-apk-20260919"
$Log=Join-Path $Repo "tools\david\.david-matrix-start.log"

function Log([string]$Message){
  try{Add-Content -Path $Log -Value ("{0} {1}" -f ([DateTime]::UtcNow.ToString("o")),$Message) -Encoding UTF8}catch{}
}

function Wait-OrchestrationMutex([string]$Name,[int]$TimeoutMs=90000){
  $m=New-Object System.Threading.Mutex($false,$Name)
  $owned=$false
  try{
    try{$owned=$m.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$owned=$true}
    if(-not$owned){
      Log("Waiting for "+$Name)
      try{$owned=$m.WaitOne($TimeoutMs)}catch [System.Threading.AbandonedMutexException]{$owned=$true}
    }
    if(-not$owned){throw "Timed out waiting for DAVID orchestration: $Name"}
  }finally{
    if($owned){try{$m.ReleaseMutex()|Out-Null}catch{}}
    try{$m.Dispose()}catch{}
  }
}

function Stop-StaleSelectorHosts{
  try{
    Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $_.ProcessId -ne $PID -and
        ($_.Name -eq "powershell.exe" -or $_.Name -eq "pwsh.exe") -and
        ([string]$_.CommandLine -like "*DAVID_MODE_SELECTOR_V2.ps1*")
      } |
      ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
  }catch{}
}

try{
  Log("MATRIX START begin")
  Wait-OrchestrationMutex "Global\DAVID_AUTONOMY_ORCHESTRATION_V1"
  Wait-OrchestrationMutex "Global\DAVID_MODE_SWITCH_V2"

  if(Test-Path $StopScript){
    Log("STOP FIRST")
    & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $StopScript -Port $Port
    if($LASTEXITCODE-ne 0){throw "STOP_DAVID_ALL_CLEAN failed with exit code $LASTEXITCODE"}
  }

  Stop-StaleSelectorHosts

  if(-not$SkipUpdate){
    if(-not(Test-Path $Git)){throw "PortableGit missing: $Git"}
    Log("UPDATE "+$Branch)
    & $Git -C $Repo fetch origin $Branch
    if($LASTEXITCODE-ne 0){throw "git fetch failed with exit code $LASTEXITCODE"}
    & $Git -C $Repo checkout $Branch
    if($LASTEXITCODE-ne 0){throw "git checkout failed with exit code $LASTEXITCODE"}
    & $Git -C $Repo pull --ff-only origin $Branch
    if($LASTEXITCODE-ne 0){throw "git pull --ff-only failed with exit code $LASTEXITCODE"}
  }

  if(-not(Test-Path $Selector)){throw "Matrix selector missing: $Selector"}
  Log("OPEN MATRIX VISIBLE OWN PROCESS")
  Write-Host "[DAVID] MATRIX READY - choose SOULFLAME SYSTEM or DAVID A+B" -ForegroundColor Green
  Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Selector,"-Port","$Port") -WindowStyle Normal
  Log("MATRIX spawned in own PowerShell host; launcher exits")
  exit 0
}catch{
  Log("FATAL "+$_.Exception.Message)
  Add-Type -AssemblyName System.Windows.Forms
  $msg="DAVID MATRIX START failed: "+$_.Exception.Message
  [System.Windows.Forms.MessageBox]::Show($msg,"DAVID MATRIX",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
  exit 1
}

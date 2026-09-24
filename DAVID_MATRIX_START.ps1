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

    # Local branch validity is required even when GitHub is temporarily offline.
    # Checkout is intentionally done before fetch because it does not require network.
    & $Git -C $Repo checkout $Branch
    if($LASTEXITCODE-ne 0){throw "git checkout failed with exit code $LASTEXITCODE"}

    $localHead=(& $Git -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
    if($LASTEXITCODE-ne 0 -or [string]::IsNullOrWhiteSpace([string]$localHead)){
      throw "Unable to resolve local DAVID HEAD"
    }
    $localHead=([string]$localHead).Trim()
    Log("LOCAL HEAD "+$localHead)

    Log("UPDATE "+$Branch)
    & $Git -C $Repo fetch origin $Branch
    $fetchCode=$LASTEXITCODE

    if($fetchCode-eq 0){
      & $Git -C $Repo pull --ff-only origin $Branch
      if($LASTEXITCODE-ne 0){
        # Fetch succeeded, so a pull failure is a real repository state problem,
        # not a network outage. Do not hide divergence/conflicts.
        throw "git pull --ff-only failed with exit code $LASTEXITCODE"
      }
      $updatedHead=(& $Git -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
      Log("UPDATE OK HEAD "+([string]$updatedHead).Trim())
    }else{
      # Network/GitHub outage: preserve availability. We already proved the
      # expected local branch exists and has a resolvable commit, so boot that
      # last-known-good checkout instead of leaving DAVID completely OFF.
      Write-Warning ("[DAVID] GitHub update unavailable (fetch exit "+$fetchCode+"). Starting LAST KNOWN GOOD local HEAD "+$localHead+".")
      Write-Host "[DAVID] OFFLINE FALLBACK - local code only; remote freshness not verified." -ForegroundColor Yellow
      Log("OFFLINE FALLBACK fetch_exit="+$fetchCode+" local_head="+$localHead)
    }
  }else{
    $localHead=(& $Git -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
    Write-Host ("[DAVID] UPDATE SKIPPED - starting local HEAD "+([string]$localHead).Trim()) -ForegroundColor Yellow
    Log("UPDATE SKIPPED local_head="+([string]$localHead).Trim())
  }

  if(-not(Test-Path $Selector)){throw "Matrix selector missing: $Selector"}
  Log("OPEN MATRIX HIDDEN CONSOLE HOST / VISIBLE WINFORMS PANEL")
  Write-Host "[DAVID] MATRIX READY - choose SOULFLAME SYSTEM or DAVID A+B" -ForegroundColor Green
  Start-Process -FilePath $Pwsh -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Selector,"-Port","$Port") -WindowStyle Hidden
  Log("MATRIX spawned with hidden PowerShell console host; WinForms panel stays visible")
  exit 0
}catch{
  Log("FATAL "+$_.Exception.Message)
  Add-Type -AssemblyName System.Windows.Forms
  $msg="DAVID MATRIX START failed: "+$_.Exception.Message
  [System.Windows.Forms.MessageBox]::Show($msg,"DAVID MATRIX",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
  exit 1
}

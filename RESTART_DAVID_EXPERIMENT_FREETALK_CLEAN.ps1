param([int]$Port=9444,[switch]$FreshSessions)
$ErrorActionPreference="Stop"
$Repo="D:\ASI\enchev-auctions"
$Stop=Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$Start=Join-Path $Repo "START_DAVID_EXPERIMENT_FREETALK.ps1"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Mutex=New-Object System.Threading.Mutex($false,"Global\DAVID_EXPERIMENT_FREETALK_ORCHESTRATION_V1");$Own=$false
try{
 try{$Own=$Mutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$Own=$true}
 if(-not$Own){throw "Another DAVID FREE TALK experiment start/restart is running."}
 & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $Stop -Port $Port
 if($LASTEXITCODE-ne 0){throw "Clean stop failed: $LASTEXITCODE"}
 Start-Sleep -Seconds 2
 $a=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$Start,"-Port","$Port");if($FreshSessions){$a+="-FreshSessions"}
 & $Pwsh @a
 if($LASTEXITCODE-ne 0){throw "FREE TALK experiment start failed: $LASTEXITCODE"}
 Write-Host "[EXPERIMENT] Restart complete. FREE_A <-> FREE_B loop active; DESIGN OFF." -ForegroundColor Green
}finally{if($Own){try{$Mutex.ReleaseMutex()|Out-Null}catch{}};try{$Mutex.Dispose()}catch{}}

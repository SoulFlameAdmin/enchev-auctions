param([int]$Port=9444,[switch]$FreshSessions)
$ErrorActionPreference="Stop"
$Root="D:\ASI";$Repo=Join-Path $Root "enchev-auctions";$Stop=Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1";$Start=Join-Path $Repo "START_DAVID_AUTONOMY.ps1";$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$M=New-Object System.Threading.Mutex($false,"Global\DAVID_AUTONOMY_ORCHESTRATION_V1");$o=$false
try{try{$o=$M.WaitOne(0)}catch[System.Threading.AbandonedMutexException]{$o=$true};if(-not$o){throw "Another AUTONOMY restart is running."}
 & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $Stop -Port $Port;if($LASTEXITCODE-ne 0){throw "Clean stop failed: $LASTEXITCODE"};Start-Sleep -Seconds 2
 $a=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$Start,"-Port","$Port");if($FreshSessions){$a+="-FreshSessions"};& $Pwsh @a;if($LASTEXITCODE-ne 0){throw "Autonomy start failed: $LASTEXITCODE"}
 Write-Host "[AUTONOMY] Atomic restart complete. DESIGN remains OFF." -ForegroundColor Green
}finally{if($o){try{$M.ReleaseMutex()|Out-Null}catch{}};try{$M.Dispose()}catch{}}

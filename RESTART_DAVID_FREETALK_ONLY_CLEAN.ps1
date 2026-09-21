param([int]$Port=9444)
$ErrorActionPreference="Stop"
$Repo="D:\ASI\enchev-auctions"
$Stop=Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$Start=Join-Path $Repo "START_DAVID_FREETALK_ONLY.ps1"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Mutex=New-Object System.Threading.Mutex($false,"Global\DAVID_MODE_SWITCH_V2");$Own=$false
try{
 try{$Own=$Mutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$Own=$true}
 if(-not$Own){
  Write-Host "[MODE] Another DAVID mode switch is already running. Waiting up to 90s..." -ForegroundColor Yellow
  try{$Own=$Mutex.WaitOne(90000)}catch [System.Threading.AbandonedMutexException]{$Own=$true}
 }
 if(-not$Own){throw "Another DAVID mode switch is still running after 90 seconds."}
 & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $Stop -Port $Port
 if($LASTEXITCODE-ne 0){throw "Clean stop failed: $LASTEXITCODE"}
 Start-Sleep -Seconds 2
 & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $Start -Port $Port
 if($LASTEXITCODE-ne 0){throw "DAVID A+B start failed: $LASTEXITCODE"}
 Write-Host "[MODE] DAVID A+B active. Same two ChatGPT conversations preserved." -ForegroundColor Green
}finally{if($Own){try{$Mutex.ReleaseMutex()|Out-Null}catch{}};try{$Mutex.Dispose()}catch{}}

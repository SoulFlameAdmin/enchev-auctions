param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("SYSTEM","APP2","APK")]
  [string]$Worker,
  [int]$Port=9444
)
$ErrorActionPreference="Stop"
$Repo="D:\ASI\enchev-auctions"
$StopScript=Join-Path $Repo "STOP_DAVID_ALL_CLEAN.ps1"
$StartScript=Join-Path $Repo "START_DAVID_SINGLE.ps1"
$Pwsh="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Mutex=New-Object System.Threading.Mutex($false,"Global\DAVID_AUTONOMY_ORCHESTRATION_V1")
$Own=$false
try{
  try{$Own=$Mutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$Own=$true}
  if(-not$Own){
    Write-Host "[FAST SOLO] Another DAVID restart is running. Waiting up to 90s..." -ForegroundColor Yellow
    try{$Own=$Mutex.WaitOne(90000)}catch [System.Threading.AbandonedMutexException]{$Own=$true}
  }
  if(-not$Own){throw "Another DAVID restart is still running after 90 seconds."}
  if(-not(Test-Path $StopScript)){throw "Missing clean stop script: $StopScript"}
  if(-not(Test-Path $StartScript)){throw "Missing FAST SOLO start script: $StartScript"}

  Write-Host ("[FAST SOLO] Full clean restart -> {0}" -f $Worker) -ForegroundColor Cyan
  & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $StopScript -Port $Port
  if($LASTEXITCODE-ne 0){throw "Clean stop failed with exit code $LASTEXITCODE"}
  Start-Sleep -Seconds 2
  & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $StartScript -Worker $Worker -Port $Port
  if($LASTEXITCODE-ne 0){throw "FAST SOLO start failed with exit code $LASTEXITCODE"}
  Write-Host ("[FAST SOLO] Restart complete -> {0}" -f $Worker) -ForegroundColor Green
}finally{
  if($Own){try{$Mutex.ReleaseMutex()|Out-Null}catch{}}
  try{$Mutex.Dispose()}catch{}
}

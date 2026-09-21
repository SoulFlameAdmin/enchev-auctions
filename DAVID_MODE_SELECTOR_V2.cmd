@echo off
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "SCRIPT=D:\ASI\enchev-auctions\DAVID_MODE_SELECTOR_V2.ps1"

rem Kill only stale old Mode Center GUI hosts. Never touch DAVID workers here.
"%PS%" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$me=$PID; Get-CimInstance Win32_Process ^| Where-Object { $_.ProcessId -ne $me -and ($_.Name -eq 'powershell.exe' -or $_.Name -eq 'pwsh.exe') -and ([string]$_.CommandLine -like '*DAVID_MODE_SELECTOR_V2.ps1*') } ^| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

start "" "%PS%" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%"
exit /b 0
